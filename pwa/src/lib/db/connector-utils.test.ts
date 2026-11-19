import { describe, expect, it } from "vitest";

import type { SyncUploadResult } from "@lofipix/db/schema";

import {
  clearConflictVersions,
  conflictKey,
  mergeConflictVersions,
  resolveBaseVersion,
} from "./connector-utils";

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

  it("prefers a conflict override over the tracked version", () => {
    expect(resolveBaseVersion("PATCH", { version: 2 }, 2, 11)).toBe(11);
    expect(resolveBaseVersion("DELETE", undefined, 0, 11)).toBe(11);
  });
});

describe("mergeConflictVersions", () => {
  const uploads = [
    { table: "albums" as const, id: "album-1" },
    { table: "photos" as const, id: "photo-1" },
  ];

  it("records the server version for each conflicted row", () => {
    const results: SyncUploadResult[] = [
      { opId: 1, status: "applied" },
      {
        opId: 2,
        status: "conflict",
        record: { id: "photo-1", version: 5, albumId: "album-1" },
      },
    ];

    const next = mergeConflictVersions(new Map(), uploads, results);
    expect(next.get(conflictKey("photos", "photo-1"))).toBe(5);
    expect(next.has(conflictKey("albums", "album-1"))).toBe(false);
  });

  it("keeps unrelated overrides and clears uploaded rows", () => {
    const overrides = new Map([[conflictKey("albums", "album-1"), 3]]);
    const next = mergeConflictVersions(overrides, uploads, [
      { opId: 1, status: "applied" },
      { opId: 2, status: "applied" },
    ]);
    expect(next.get(conflictKey("albums", "album-1"))).toBe(3);

    clearConflictVersions(next, uploads);
    expect(next.size).toBe(0);
  });
});