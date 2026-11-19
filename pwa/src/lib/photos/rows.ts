export interface DeviceIdentity {
  deviceId: string;
  userAgent: string;
  now?: Date;
}

export interface ProviderRowInput extends DeviceIdentity {
  id: string;
  organizationId: string;
}

export interface PhotoRowInput {
  id: string;
  albumId: string;
  position: number;
  width: number;
  height: number;
  quality: number;
  size: number;
  checksum: string;
  originatedAt?: Date;
}

export interface PhotoLocationRowInput {
  id: string;
  photoId: string;
  storageProviderId: string;
  objectKey: string;
  originatedAt?: Date;
}

function iso(value: Date): string {
  return value.toISOString();
}

export function buildOpfsProviderRow(input: ProviderRowInput): Record<string, unknown> {
  const now = input.now ?? new Date();
  return {
    id: input.id,
    organization_id: input.organizationId,
    provider_type: "opfs",
    label: "This browser",
    external_id: input.deviceId,
    config: JSON.stringify({
      platform: "web",
      deviceName: "Browser",
      userAgent: input.userAgent,
    }),
    version: 1,
    originated_at: iso(now),
    created_at: iso(now),
    updated_at: null,
    deleted_at: null,
  };
}

export function buildPhotoRow(input: PhotoRowInput): Record<string, unknown> {
  const now = input.originatedAt ?? new Date();
  return {
    id: input.id,
    album_id: input.albumId,
    position: input.position,
    image_width: input.width,
    image_height: input.height,
    image_quality: input.quality,
    image_size: input.size,
    image_checksum: input.checksum,
    version: 1,
    originated_at: iso(now),
    created_at: iso(now),
    updated_at: null,
    deleted_at: null,
  };
}

export function buildPhotoLocationRow(input: PhotoLocationRowInput): Record<string, unknown> {
  const now = input.originatedAt ?? new Date();
  return {
    id: input.id,
    photo_id: input.photoId,
    storage_provider_id: input.storageProviderId,
    object_key: input.objectKey,
    version: 1,
    originated_at: iso(now),
    created_at: iso(now),
    updated_at: null,
    deleted_at: null,
  };
}
