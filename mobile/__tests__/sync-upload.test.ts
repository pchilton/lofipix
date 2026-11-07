import {
  localRowToServer,
  serverRowToLocal,
  syncUploadEntrySchema,
} from '@lofipix/db/models/sync-upload';

describe('sync upload contract', () => {
  it('maps local snake_case rows to server camelCase fields', () => {
    expect(
      localRowToServer('photos', {
        album_id: 'album-1',
        image_width: 1280,
        image_checksum: 'abc',
        version: 3,
      }),
    ).toEqual({
      albumId: 'album-1',
      imageWidth: 1280,
      imageChecksum: 'abc',
      version: 3,
    });
  });

  it('maps server rows to SQLite-friendly local values', () => {
    expect(
      serverRowToLocal('storage_providers', {
        id: 'provider-1',
        organizationId: 'org-1',
        providerType: 's3',
        config: { bucket: 'photos' },
        originatedAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ).toEqual({
      id: 'provider-1',
      organization_id: 'org-1',
      provider_type: 's3',
      config: '{"bucket":"photos"}',
      originated_at: '2026-01-01T00:00:00.000Z',
    });
  });

  it('accepts a PowerSync CRUD entry', () => {
    expect(
      syncUploadEntrySchema.parse({
        op: 'PATCH',
        table: 'albums',
        id: '01912345-6789-7abc-8def-0123456789ab',
        opData: { notes: 'Updated' },
        opId: 12,
        clientId: 'client-1',
        baseVersion: 2,
      }),
    ).toMatchObject({ op: 'PATCH', baseVersion: 2 });
  });
});
