import { describe, expect, it } from "vitest";

import { buildRebaseRows, resolveBaseVersion } from "./connector-utils";

describe("resolveBaseVersion", () => {
  it("starts inserts at version zero", () => {
    expect(resolveBaseVersion("PUT", { version: 9 }, 4)).toBe(0);
  });

  it("uses the tracked previous version for updates", () => {
    expect(resolveBaseVersion("PATCH", { version: 9 }, 4)).toBe(9);
  });

  it("uses the tracked previous version for deletes", () => {
    expect(resolveBaseVersion("DELETE", { version: "7" }, 4)).toBe(7);
  });

  it("falls back to the local version when no previous value was tracked", () => {
    expect(resolveBaseVersion("PATCH", undefined, 4)).toBe(4);
  });
});

describe("buildRebaseRows", () => {
  it("maps a server record and keeps pending album columns", () => {
    const { serverRow, pendingRow } = buildRebaseRows(
      "albums",
      {
        id: "album-1",
        organizationId: "org-1",
        name: "Server name",
        notes: "Server notes",
        version: 6,
        originatedAt: "2026-01-01T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: null,
        deletedAt: null,
      },
      {
        id: "album-1",
        name: "Local name",
        version: 4,
        organization_id: "org-1",
      },
    );

    expect(serverRow).toMatchObject({
      id: "album-1",
      organization_id: "org-1",
      name: "Server name",
      version: 6,
    });
    expect(pendingRow).toEqual({
      name: "Local name",
      organization_id: "org-1",
    });
  });

  it("never exposes encrypted provider data", () => {
    const { serverRow } = buildRebaseRows(
      "storage_providers",
      {
        id: "provider-1",
        organizationId: "org-1",
        providerType: "opfs",
        label: "This device",
        externalId: "device-1",
        config: { platform: "web" },
        encryptedData: { token: "secret" },
        version: 2,
        originatedAt: "2026-01-01T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: null,
        deletedAt: null,
      },
      { label: "Local label", config: '{"platform":"web"}' },
    );

    expect(serverRow).not.toHaveProperty("encrypted_data");
    expect(serverRow).not.toHaveProperty("encryptedData");
    expect(serverRow.config).toBe('{"platform":"web"}');
  });

  it("drops unknown and identity columns from the pending update", () => {
    const { pendingRow } = buildRebaseRows(
      "photos",
      { id: "photo-1", albumId: "album-1", version: 3 },
      {
        id: "photo-1",
        version: 2,
        album_id: "album-1",
        image_checksum: "abc",
        unknown_column: "ignored",
      },
    );

    expect(pendingRow).toEqual({
      album_id: "album-1",
      image_checksum: "abc",
    });
  });
});
