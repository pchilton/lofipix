import { ELECTRIC_PROTOCOL_QUERY_PARAMS } from '@electric-sql/client';
import type { Context } from 'hono';
import type { SyncTable } from '@lofipix/db/schema';

interface ShapeDefinition {
  table: SyncTable;
  columns: readonly string[];
}

const COMMON_COLUMNS = [
  'id',
  'organization_id',
  'version',
  'deleted_at',
  'created_at',
  'updated_at',
] as const;

export const shapeDefinitions: Record<SyncTable, ShapeDefinition> = {
  albums: {
    table: 'albums',
    columns: [
      ...COMMON_COLUMNS,
      'name',
      'notes',
    ],
  },
  photos: {
    table: 'photos',
    columns: [
      ...COMMON_COLUMNS,
      'album_id',
      'position',
      'image_width',
      'image_height',
      'image_quality',
      'image_size',
      'captured_at',
      'image_checksum',
    ],
  },
  photo_locations: {
    table: 'photo_locations',
    columns: [
      ...COMMON_COLUMNS,
      'photo_id',
      'storage_provider_id',
      'object_key',
    ],
  },
  storage_providers: {
    table: 'storage_providers',
    columns: [
      ...COMMON_COLUMNS,
      'provider_type',
      'label',
      'external_id',
      'config',
    ],
  },
};

function isSyncTable(value: string): value is SyncTable {
  return Object.hasOwn(shapeDefinitions, value);
}

export async function proxyShape(
  c: Context,
  organizationId: string,
): Promise<Response> {
  const table = c.req.param('table') ?? '';
  if (!isSyncTable(table)) {
    return c.json({ error: 'Unknown sync table.' }, 404);
  }

  const electricUrl = process.env.ELECTRIC_INTERNAL_URL ?? 'http://127.0.0.1:5637';
  const secret = process.env.ELECTRIC_SECRET;
  if (!secret) {
    return c.json({ error: 'ElectricSQL is not configured.' }, 503);
  }

  const definition = shapeDefinitions[table];
  const upstream = new URL('/v1/shape', electricUrl);
  const requested = new URL(c.req.url);
  for (const key of ELECTRIC_PROTOCOL_QUERY_PARAMS) {
    if (key.startsWith('subset__')) {
      continue;
    }
    const values = requested.searchParams.getAll(key);
    for (const value of values) {
      upstream.searchParams.append(key, value);
    }
  }

  upstream.searchParams.set('table', definition.table);
  upstream.searchParams.set('where', 'organization_id = $1');
  upstream.searchParams.set('params[1]', organizationId);
  upstream.searchParams.set('columns', definition.columns.join(','));
  upstream.searchParams.set('secret', secret);

  const method = c.req.method === 'POST' ? 'POST' : 'GET';
  const headers = new Headers();
  const accept = c.req.header('accept');
  if (accept) {
    headers.set('accept', accept);
  }
  let body: string | undefined;
  if (method === 'POST') {
    headers.set('content-type', 'application/json');
    body = await c.req.text();
  }

  let response: Response;
  try {
    response = await fetch(upstream, {
      method,
      headers,
      body,
      signal: c.req.raw.signal,
    });
  } catch {
    return c.json({ error: 'ElectricSQL is unreachable.' }, 502);
  }

  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('content-length');
  for (const key of [...responseHeaders.keys()]) {
    if (key.startsWith('access-control-')) {
      responseHeaders.delete(key);
    }
  }
  responseHeaders.set(
    'access-control-expose-headers',
    [
      'electric-offset',
      'electric-handle',
      'electric-schema',
      'electric-up-to-date',
      'electric-has-data',
      'electric-cursor',
      'electric-snapshot',
      'electric-internal-known-error',
      'retry-after',
    ].join(','),
  );
  responseHeaders.set('cache-control', 'no-store');
  responseHeaders.set('vary', 'Cookie');

  return new Response(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
}
