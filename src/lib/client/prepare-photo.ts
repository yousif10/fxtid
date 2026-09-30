/**
 * Browser-side upload preparation (client only).
 *
 * Serverless platforms cap request bodies (Vercel: 4.5 MB), while phone photos
 * are often larger. Before uploading, the admin-selected 3:4 crop is applied in
 * the browser and the result is capped at 2x the stored master size, producing
 * a small JPEG. The SERVER STILL re-validates, decodes, re-encodes and strips
 * metadata exactly as before - this step only reduces the payload and is not a
 * security control.
 */
export const UPLOAD_PAYLOAD_LIMIT = 4 * 1024 * 1024;
const MAX_W = 1320;
const MAX_H = 1760;
const MIN_W = 240;
const MIN_H = 320;

export type PixelCrop = { x: number; y: number; width: number; height: number };

/** Output size for a crop: at most MAX, at least MIN (3:4), preserving the crop's aspect. */
export function preparedSize(crop: PixelCrop): { width: number; height: number } {
  const down = Math.min(1, MAX_W / crop.width, MAX_H / crop.height);
  const up = Math.max(1, MIN_W / crop.width, MIN_H / crop.height);
  const scale = down < 1 ? down : up;
  return { width: Math.round(crop.width * scale), height: Math.round(crop.height * scale) };
}

export async function preparePhotoForUpload(file: File, crop: PixelCrop | null): Promise<{ file: File; cropApplied: boolean }> {
  if (!crop || typeof createImageBitmap !== "function") return { file, cropApplied: false };
  try {
    // "from-image" applies EXIF orientation, matching the <img> shown in the cropper.
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const { width, height } = preparedSize(crop);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { file, cropApplied: false };
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) return { file, cropApplied: false };
    return { file: new File([blob], "photo.jpg", { type: "image/jpeg" }), cropApplied: true };
  } catch {
    return { file, cropApplied: false };
  }
}
