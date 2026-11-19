import { describe, expect, it } from "vitest";

import {
  buildOpfsProviderRow,
  buildPhotoLocationRow,
  buildPhotoRow,
} from "./rows";

describe("photo rows", () => {
  it("builds a web OPFS provider row", () => {
    const row = buildOpfsProviderRow({
      id: "provider-1",
      organizationId: "org-1",
      deviceId: "device-1",
      userAgent: "Test browser",
      now: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(row).toMatchObject({
      id: "provider-1",
      organization_id: "org-1",
      provider_type: "opfs",
      external_id: "device-1",
      version: 1,
      deleted_at: null,
    });
    expect(JSON.parse(row.config as string)).toMatchObject({
      platform: "web",
      deviceName: "Browser",
      userAgent: "Test browser",
    });
  });

  it("builds a photo row with compression metadata", () => {
    const row = buildPhotoRow({
      id: "photo-1",
      albumId: "album-1",
      position: 2,
      width: 1280,
      height: 853,
      quality: 82,
      size: 250_000,
      checksum: "a".repeat(64),
      originatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(row).toMatchObject({
      id: "photo-1",
      album_id: "album-1",
      position: 2,
      image_width: 1280,
      image_height: 853,
      image_quality: 82,
      image_size: 250_000,
      image_checksum: "a".repeat(64),
      version: 1,
      deleted_at: null,
    });
  });

  it("points a location at the OPFS object key", () => {
    const row = buildPhotoLocationRow({
      id: "location-1",
      photoId: "photo-1",
      storageProviderId: "provider-1",
      objectKey: "photos/photo-1.jpg",
      originatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(row).toMatchObject({
      id: "location-1",
      photo_id: "photo-1",
      storage_provider_id: "provider-1",
      object_key: "photos/photo-1.jpg",
      version: 1,
      deleted_at: null,
    });
  });
});