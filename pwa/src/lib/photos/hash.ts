function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let output = "";
  for (const byte of bytes) {
    output += byte.toString(16).padStart(2, "0");
  }
  return output;
}

export async function sha256Hex(data: Blob | ArrayBuffer | Uint8Array): Promise<string> {
  const buffer: ArrayBuffer =
    data instanceof Blob
      ? await data.arrayBuffer()
      : data instanceof Uint8Array
        ? (data.buffer.slice(
            data.byteOffset,
            data.byteOffset + data.byteLength,
          ) as ArrayBuffer)
        : data;
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return toHex(digest);
}
