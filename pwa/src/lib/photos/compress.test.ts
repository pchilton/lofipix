import { describe, expect, it } from "vitest";

import {
  compressionPlan,
  compressWithEncoder,
  fitWithinMaxWidth,
  INITIAL_IMAGE_QUALITY,
  MAX_IMAGE_WIDTH,
  MIN_IMAGE_QUALITY,
  TARGET_IMAGE_BYTES,
} from "./compress";

describe("fitWithinMaxWidth", () => {
  it("resizes a large landscape image to the maximum width", () => {
    expect(fitWithinMaxWidth(3000, 2000)).toEqual({ width: 1280, height: 853 });
  });

  it("does not upscale a smaller image", () => {
    expect(fitWithinMaxWidth(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("rejects invalid dimensions", () => {
    expect(() => fitWithinMaxWidth(0, 100)).toThrow();
  });
});

describe("compressionPlan", () => {
  it("never exceeds the maximum width and stays inside the quality range", () => {
    const plan = compressionPlan();
    expect(plan.some((step) => step.quality === INITIAL_IMAGE_QUALITY)).toBe(true);
    expect(plan.some((step) => step.quality === MIN_IMAGE_QUALITY)).toBe(true);
    for (const step of plan) {
      expect(step.width).toBeLessThanOrEqual(MAX_IMAGE_WIDTH);
      expect(step.quality).toBeGreaterThanOrEqual(MIN_IMAGE_QUALITY);
      expect(step.quality).toBeLessThanOrEqual(INITIAL_IMAGE_QUALITY);
    }
  });
});

describe("compressWithEncoder", () => {
  it("stops at the first quality that meets the byte target", async () => {
    const base = fitWithinMaxWidth(3000, 2000);
    const target = 600;
    const encode = async ({ width, quality }: { width: number; quality: number }) =>
      new Blob([new Uint8Array(Math.round(width * quality))]);

    const result = await compressWithEncoder(base, encode, target);

    expect(result.width).toBeLessThanOrEqual(MAX_IMAGE_WIDTH);
    expect(result.height).toBeLessThanOrEqual(853);
    expect(result.blob.size).toBeLessThanOrEqual(target);
    expect(result.quality).toBeGreaterThanOrEqual(40);
  });

  it("falls back to the smallest plan when no step meets the target", async () => {
    const base = fitWithinMaxWidth(3000, 2000);
    const encode = async ({ width, quality }: { width: number; quality: number }) =>
      new Blob([new Uint8Array(Math.round(width * quality))]);

    const result = await compressWithEncoder(base, encode, 1);

    expect(result.width).toBeLessThan(MAX_IMAGE_WIDTH);
    expect(result.quality).toBe(40);
    expect(result.blob.size).toBeGreaterThan(1);
  });

  it("uses the production target by default", async () => {
    const base = { width: 1280, height: 853 };
    const encode = async () => new Blob([new Uint8Array(TARGET_IMAGE_BYTES + 1)]);
    const result = await compressWithEncoder(base, encode);
    expect(result.width).toBeLessThan(1280);
  });
});