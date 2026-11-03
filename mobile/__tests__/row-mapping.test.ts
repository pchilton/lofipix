import {
  fullUpdatePayload,
  insertPayload,
  normalizeServerRow,
  stripSystem,
  updatePayload,
} from '../src/lib/row-mapping';

const album = {
  id: 'album-1',
  organizationId: 'org-1',
  name: 'AB12 CDE',
  notes: 'Front bumper',
  version: 3,
  outboxNeeded: true,
  deletedAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
};

describe('sync payloads', () => {
  it('keeps createdAt and domain fields for inserts', () => {
    expect(insertPayload(album)).toEqual({
      name: 'AB12 CDE',
      notes: 'Front bumper',
      createdAt: album.createdAt,
    });
  });

  it('strips system fields', () => {
    expect(stripSystem(album, false)).toEqual({ name: 'AB12 CDE', notes: 'Front bumper' });
  });

  it('only sends album writable fields on update', () => {
    expect(updatePayload('albums', { ...album, ignored: true })).toEqual({
      name: 'AB12 CDE',
      notes: 'Front bumper',
    });
  });

  it('only sends photo writable fields on update', () => {
    expect(
      updatePayload('photos', {
        position: 2,
        imageWidth: 1280,
        imageHeight: 720,
        imageQuality: 82,
        imageSize: 200_000,
        imageChecksum: 'abc',
        capturedAt: new Date(),
      }),
    ).toEqual({
      position: 2,
      imageWidth: 1280,
      imageHeight: 720,
      imageQuality: 82,
      imageSize: 200_000,
      imageChecksum: 'abc',
    });
  });

  it('builds a full update for reconciliation', () => {
    expect(fullUpdatePayload('albums', album)).toEqual({ name: 'AB12 CDE', notes: 'Front bumper' });
  });

  it('clears the outbox flag on server rows and parses dates', () => {
    const normalized = normalizeServerRow({
      id: 'album-1',
      organizationId: 'org-1',
      name: 'AB12 CDE',
      notes: null,
      version: 4,
      deletedAt: null,
      createdAt: '2026-01-01 00:00:00+00',
      updatedAt: '2026-01-02T00:00:00Z',
    });
    expect(normalized.outboxNeeded).toBe(false);
    expect(normalized.createdAt).toBeInstanceOf(Date);
    expect(normalized.deletedAt).toBeNull();
  });
});
