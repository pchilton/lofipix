export const PHOTO_MAX_WIDTH = 1280;
export const PHOTO_TARGET_BYTES = 300_000;
export const PHOTO_JPEG_QUALITY = 0.82;
export const PHOTO_IMAGE_QUALITY = Math.round(PHOTO_JPEG_QUALITY * 100);

export interface CapturedPhoto {
  blob: Blob;
  width: number;
  height: number;
  checksum: string;
}

async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function captureFrame(video: HTMLVideoElement): Promise<CapturedPhoto> {
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;
  if (!sourceWidth || !sourceHeight) {
    throw new Error('The camera is not ready yet.');
  }

  const scale = Math.min(1, PHOTO_MAX_WIDTH / sourceWidth);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not read the camera frame.');
  }
  context.drawImage(video, 0, 0, width, height);

  let quality = PHOTO_JPEG_QUALITY;
  let blob = await encode(canvas, quality);
  while (blob.size > PHOTO_TARGET_BYTES && quality > 0.4) {
    quality = Math.max(0.4, quality - 0.08);
    blob = await encode(canvas, quality);
  }

  return { blob, width, height, checksum: await sha256Hex(blob) };
}

function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Could not encode the photo.'))),
      'image/jpeg',
      quality,
    );
  });
}
