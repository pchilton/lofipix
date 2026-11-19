import { describe, expect, it } from "vitest";

import { sha256Hex } from "./hash";

describe("sha256Hex", () => {
  it("hashes bytes as lowercase hex", async () => {
    const digest = await sha256Hex(new TextEncoder().encode("abc"));
    expect(digest).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("hashes a Blob and an ArrayBuffer to the same value", async () => {
    const bytes = new TextEncoder().encode("lofipix");
    const fromBlob = await sha256Hex(new Blob([bytes]));
    const fromBuffer = await sha256Hex(bytes);
    expect(fromBlob).toBe(fromBuffer);
    expect(fromBlob).toMatch(/^[0-9a-f]{64}$/);
  });
});