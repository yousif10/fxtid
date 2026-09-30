import "server-only";
import { randomUUID } from "node:crypto";
import sharp, { type Metadata } from "sharp";
import { getStorage } from "@/lib/storage";

export const PHOTO_MAX_BYTES = 8 * 1024 * 1024;
export const PHOTO_MIN_WIDTH = 240;
export const PHOTO_MIN_HEIGHT = 320;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);

/** Card photo master: 3:4 portrait, ~600 DPI at the printed size. */
const OUT_W = 660;
const OUT_H = 880;
const THUMB_W = 180;
const THUMB_H = 240;

export type CropArea = { x: number; y: number; width: number; height: number };

export class PhotoValidationError extends Error {}

/**
 * Validates and normalises an uploaded photograph.
 * - checks declared MIME type AND decodes the actual bytes (magic bytes/format),
 * - enforces size & minimum dimensions, rejects animated images,
 * - applies EXIF orientation, crops to the admin-selected 3:4 area, resizes,
 * - re-encodes to JPEG, which strips all metadata (GPS/EXIF) and any
 *   non-image payload. No facial retouching or beautification is applied.
 */
export async function processPhoto(file: File, crop: CropArea | null): Promise<{ master: Buffer; thumb: Buffer }> {
  if (!ALLOWED_MIME.has(file.type)) throw new PhotoValidationError("Photo must be a JPG, PNG or WEBP image.");
  if (file.size <= 0) throw new PhotoValidationError("The uploaded file is empty.");
  if (file.size > PHOTO_MAX_BYTES) throw new PhotoValidationError("Photo must be 8 MB or smaller.");

  const input = Buffer.from(await file.arrayBuffer());
  let meta: Metadata;
  try {
    meta = await sharp(input, { failOn: "error", limitInputPixels: 40_000_000 }).metadata();
  } catch {
    throw new PhotoValidationError("The file is not a valid image.");
  }
  if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) {
    throw new PhotoValidationError("Photo must be a JPG, PNG or WEBP image.");
  }
  if ((meta.pages ?? 1) > 1) throw new PhotoValidationError("Animated images are not supported.");

  // Dimensions after EXIF rotation.
  const rotated = (meta.orientation ?? 1) >= 5;
  const w = rotated ? meta.height! : meta.width!;
  const h = rotated ? meta.width! : meta.height!;
  if (!w || !h || w < PHOTO_MIN_WIDTH || h < PHOTO_MIN_HEIGHT) {
    throw new PhotoValidationError(`Photo must be at least ${PHOTO_MIN_WIDTH} x ${PHOTO_MIN_HEIGHT} pixels.`);
  }

  let pipeline = sharp(input, { failOn: "error" }).rotate();
  if (crop) {
    const left = Math.max(0, Math.min(w - 1, Math.round(crop.x)));
    const top = Math.max(0, Math.min(h - 1, Math.round(crop.y)));
    const width = Math.max(1, Math.min(w - left, Math.round(crop.width)));
    const height = Math.max(1, Math.min(h - top, Math.round(crop.height)));
    if (width < 120 || height < 160) throw new PhotoValidationError("The selected crop area is too small.");
    pipeline = pipeline.extract({ left, top, width, height });
  }
  const normalised = await pipeline
    .resize(OUT_W, OUT_H, { fit: "cover", position: "attention" })
    .flatten({ background: "#ffffff" })
    .toColourspace("srgb")
    .jpeg({ quality: 90, mozjpeg: true, chromaSubsampling: "4:4:4" })
    .toBuffer();
  const thumb = await sharp(normalised).resize(THUMB_W, THUMB_H).webp({ quality: 82 }).toBuffer();
  return { master: normalised, thumb };
}

/**
 * Stores a processed photo and returns its storage key. Photos are immutable
 * (a replacement always gets a new server-generated key). If the second upload
 * fails, the first object is removed so no half-stored photo is left behind.
 */
export async function storePhoto(photo: { master: Buffer; thumb: Buffer }): Promise<string> {
  const storage = getStorage();
  const id = randomUUID();
  const key = `photos/${id}.jpg`;
  await storage.put(key, photo.master, "image/jpeg");
  try {
    await storage.put(thumbKeyFor(key), photo.thumb, "image/webp");
  } catch (err) {
    await storage.delete([key]).catch(() => undefined);
    throw err;
  }
  return key;
}

export function thumbKeyFor(key: string): string {
  return key.replace(/\.jpg$/, "-thumb.webp");
}

export async function readPhoto(key: string, variant: "full" | "thumb"): Promise<Buffer | null> {
  return getStorage().get(variant === "thumb" ? thumbKeyFor(key) : key);
}

export async function deletePhotoFiles(key: string): Promise<void> {
  await getStorage().delete([key, thumbKeyFor(key)]);
}

export async function photoDataUri(key: string | null): Promise<string | null> {
  if (!key) return null;
  const buf = await getStorage().get(key);
  return buf ? `data:image/jpeg;base64,${buf.toString("base64")}` : null;
}
