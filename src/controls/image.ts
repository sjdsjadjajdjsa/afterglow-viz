export const MAX_IMAGE_PX = 512;

export function fitWithin(width: number, height: number, max: number): [number, number] {
  const scale = Math.min(1, max / Math.max(width, height, 1));
  return [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))];
}

// localStorage only holds a few MB, so the picked image is stored small
export async function imageFileToDataUrl(file: Blob, max = MAX_IMAGE_PX): Promise<string> {
  const img = await decode(file);
  const [w, h] = fitWithin(img.width, img.height, max);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  // jpeg has no alpha
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img.source, 0, 0, w, h);
  img.close();
  const url = canvas.toDataURL("image/jpeg", 0.85);
  if (!url.startsWith("data:image/")) throw new Error("could not encode image");
  return url;
}

interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  close(): void;
}

async function decode(file: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // fall through to <img>, which decodes a few more formats
    }
  }
  const url = URL.createObjectURL(file);
  const close = () => URL.revokeObjectURL(url);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close };
  } catch (error) {
    close();
    throw error;
  }
}
