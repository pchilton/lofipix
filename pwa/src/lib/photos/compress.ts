export const MAX_IMAGE_WIDTH = 1280;
export const TARGET_IMAGE_BYTES = 300 * 1024;
export const INITIAL_IMAGE_QUALITY = 0.82;
export const MIN_IMAGE_QUALITY = 0.4;

const QUALITY_STEPS = [0.82, 0.7, 0.6, 0.5, 0.4] as const;
const WIDTH_FACTORS = [1, 0.8, 0.64, 0.51, 0.41, 0.33, 0.25, 0.2, 0.15, 0.1, 0.05] as const;

export interface Dimensions {
  width: number;
  height: number;
}

export interface CompressedImage {
  blob: Blob;
  width: number;
  height: number;
  quality: number;
}

export function fitWithinMaxWidth(
  width: number,
  height: number,
  maxWidth = MAX_IMAGE_WIDTH,
): Dimensions {
  if (width <= 0 || height <= 0) {
    throw new Error("Image dimensions must be positive.");
  }
  if (width <= maxWidth) {
    return { width, height };
  }
  const scale = maxWidth / width;
  return {
    width: maxWidth,
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function compressionPlan(maxWidth = MAX_IMAGE_WIDTH): Array<Dimensions & { quality: number }> {
  const steps: Array<Dimensions & { quality: number }> = [];
  for (const factor of WIDTH_FACTORS) {
    const width = Math.max(1, Math.round(maxWidth * factor));
    for (const quality of QUALITY_STEPS) {
      steps.push({ width, height: 0, quality });
    }
  }
  return steps;
}

async function canvasToJpeg(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  quality: number,
): Promise<Blob> {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not create an image canvas.");
    }
    context.drawImage(bitmap, 0, 0, width, height);
    return canvas.convertToBlob({ type: "image/jpeg", quality });
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not create an image canvas.");
  }
  context.drawImage(bitmap, 0, 0, width, height);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Could not encode the image."));
        }
      },
      "image/jpeg",
      quality,
    );
  });
}

export interface EncodeInput {
  width: number;
  height: number;
  quality: number;
}

export type ImageEncoder = (input: EncodeInput) => Promise<Blob>;

export async function compressWithEncoder(
  base: Dimensions,
  encode: ImageEncoder,
  targetBytes = TARGET_IMAGE_BYTES,
  maxWidth = MAX_IMAGE_WIDTH,
): Promise<CompressedImage> {
  let smallest: CompressedImage | null = null;

  for (const step of compressionPlan()) {
    const width = Math.max(1, Math.round(base.width * (step.width / maxWidth)));
    const height = Math.max(1, Math.round(base.height * (step.width / maxWidth)));
    const blob = await encode({ width, height, quality: step.quality });
    const candidate: CompressedImage = {
      blob,
      width,
      height,
      quality: Math.round(step.quality * 100),
    };
    smallest = candidate;
    if (blob.size <= targetBytes) {
      return candidate;
    }
  }

  if (!smallest) {
    throw new Error("Could not compress the image.");
  }
  return smallest;
}

async function decodeImage(source: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(source, { imageOrientation: "from-image" });
  } catch {
    return await createImageBitmap(source);
  }
}

export async function compressImage(
  source: Blob,
  maxWidth = MAX_IMAGE_WIDTH,
): Promise<CompressedImage> {
  const bitmap = await decodeImage(source);
  try {
    const base = fitWithinMaxWidth(bitmap.width, bitmap.height, maxWidth);
    return await compressWithEncoder(
      base,
      ({ width, height, quality }) => canvasToJpeg(bitmap, width, height, quality),
      TARGET_IMAGE_BYTES,
      maxWidth,
    );
  } finally {
    bitmap.close();
  }
}
