import '@lofipix/env';

import { createHash } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { db } from '@lofipix/db';
import { auth } from '@lofipix/db/auth';
import { albums, normalizeNotes, photos } from '@lofipix/db/schema';

interface SeedAlbum {
  name: string;
  notes: string | null;
  photoCount: number;
}

interface SeedOrganisation {
  name: string;
  slug: string;
  owner: { email: string; name: string };
  albums: SeedAlbum[];
}

const ORGANISATIONS: SeedOrganisation[] = [
  {
    name: 'Harbour Panel & Paint',
    slug: 'harbour-panel-paint',
    owner: { email: 'alice@harbour.test', name: 'Alice Harbour' },
    albums: [
      { name: 'AB12 CDE', notes: 'Front bumper scuffed.\n\nRear quarter panel dent.', photoCount: 3 },
      { name: 'XY99 ZZT', notes: null, photoCount: 2 },
    ],
  },
  {
    name: 'Coastline Smash Repairs',
    slug: 'coastline-smash-repairs',
    owner: { email: 'bob@coastline.test', name: 'Bob Coastline' },
    albums: [{ name: 'QR55 LMN', notes: 'Windscreen chip, driver side.', photoCount: 2 }],
  },
];

type Context = Awaited<typeof auth.$context>;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}.`);
  }
  return value;
}

async function ensureUser(context: Context, email: string, name: string, password: string): Promise<string> {
  const existing = await context.adapter.findOne<{ id: string }>({
    model: 'user',
    where: [{ field: 'email', value: email }],
  });
  if (existing) {
    return existing.id;
  }
  const created = await auth.api.signUpEmail({ body: { email, password, name } });
  return created.user.id;
}

async function ensureOrganisation(context: Context, organisation: SeedOrganisation, userId: string): Promise<string> {
  const existing = await context.adapter.findOne<{ id: string }>({
    model: 'organization',
    where: [{ field: 'slug', value: organisation.slug }],
  });
  const organizationId =
    existing?.id ??
    (
      await context.adapter.create<{ id: string }>({
        model: 'organization',
        data: { name: organisation.name, slug: organisation.slug, createdAt: new Date() },
      })
    ).id;

  const member = await context.adapter.findOne<{ id: string }>({
    model: 'member',
    where: [
      { field: 'organizationId', value: organizationId },
      { field: 'userId', value: userId },
    ],
  });
  if (!member) {
    await context.adapter.create({
      model: 'member',
      data: { organizationId, userId, role: 'owner', createdAt: new Date() },
    });
  }
  return organizationId;
}

async function seedAlbum(organizationId: string, album: SeedAlbum): Promise<void> {
  const [existing] = await db
    .select({ id: albums.id })
    .from(albums)
    .where(and(eq(albums.organizationId, organizationId), eq(albums.name, album.name), isNull(albums.deletedAt)))
    .limit(1);
  if (existing) {
    return;
  }

  const albumId = uuidv7();
  await db.insert(albums).values({
    id: albumId,
    organizationId,
    name: album.name,
    notes: album.notes === null ? null : normalizeNotes(album.notes),
  });

  const capturedAt = new Date();
  await db.insert(photos).values(
    Array.from({ length: album.photoCount }, (_, index) => ({
      id: uuidv7(),
      albumId,
      position: index + 1,
      imageWidth: 1280,
      imageHeight: 960,
      imageQuality: 80,
      imageSize: 240_000,
      capturedAt,
      imageChecksum: createHash('sha256').update(`${albumId}:${index + 1}`).digest('hex'),
    })),
  );
}

async function main(): Promise<void> {
  if (!process.argv.includes('--apply')) {
    throw new Error('This script writes demo users, organisations, albums, and photo metadata. Re-run with --apply to proceed.');
  }
  const password = requiredEnv('SEED_PASSWORD');
  const context = await auth.$context;

  for (const organisation of ORGANISATIONS) {
    const userId = await ensureUser(context, organisation.owner.email, organisation.owner.name, password);
    const organizationId = await ensureOrganisation(context, organisation, userId);
    for (const album of organisation.albums) {
      await seedAlbum(organizationId, album);
    }
    console.log(
      `${organisation.name}: owner ${organisation.owner.email}, ${organisation.albums.length} albums (organizationId=${organizationId}).`,
    );
  }

  console.log('Seed complete. Sign in with the owner email and SEED_PASSWORD.');
  process.exit(0);
}

await main();
