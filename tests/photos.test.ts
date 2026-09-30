import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { PhotoValidationError, processPhoto } from "@/lib/photos";

async function jpeg(w: number, h: number, withExif = false) {
  let img = sharp({ create: { width: w, height: h, channels: 3, background: "#8899aa" } }).jpeg();
  if (withExif) img = img.withExif({ IFD0: { Copyright: "secret-gps-marker" } });
  return img.toBuffer();
}

const file = (buf: Buffer | string, type: string, name = "photo.jpg") => new File([typeof buf === "string" ? buf : new Uint8Array(buf)], name, { type });

describe("photo processing", () => {
  it("crops to 3:4, resizes and strips metadata", async () => {
    const out = await processPhoto(file(await jpeg(1200, 1200, true), "image/jpeg"), { x: 300, y: 100, width: 600, height: 800 });
    const meta = await sharp(out.master).metadata();
    expect([meta.width, meta.height]).toEqual([660, 880]);
    expect(meta.exif).toBeUndefined();
    expect(out.master.includes(Buffer.from("secret-gps-marker"))).toBe(false);
    expect((await sharp(out.thumb).metadata()).format).toBe("webp");
  });

  it("rejects a non-image disguised as a JPEG", async () => {
    await expect(processPhoto(file("<?php system($_GET['c']); ?>", "image/jpeg"), null)).rejects.toThrow(PhotoValidationError);
  });

  it("rejects unsupported MIME types and tiny images", async () => {
    await expect(processPhoto(file(await jpeg(800, 800), "image/gif", "a.gif"), null)).rejects.toThrow(/JPG, PNG or WEBP/);
    await expect(processPhoto(file(await jpeg(100, 100), "image/jpeg"), null)).rejects.toThrow(/at least/);
  });

  it("rejects SVG even when labelled as PNG", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><script>alert(1)</script></svg>';
    await expect(processPhoto(file(svg, "image/png", "x.png"), null)).rejects.toThrow(PhotoValidationError);
  });
});
