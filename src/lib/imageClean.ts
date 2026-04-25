// Lightweight client-side image cleanup pipeline.
// - Honors EXIF orientation
// - Auto-trims uniform (white-ish / studio) borders
// - Resizes so longest side <= MAX_DIM
// - Pads to a clean square on a configurable background (white by default)
// - Re-encodes as JPEG for compact storage

const MAX_DIM = 1280;
const TRIM_TOLERANCE = 18;     // 0..255 — color distance to consider "background"
const TRIM_SAMPLE_RATIO = 0.94; // % of pixels in a row/col that must match bg to crop

export interface CleanOptions {
  background?: string;          // CSS color for square padding
  square?: boolean;             // pad to square (default true)
  trim?: boolean;               // auto-trim borders (default true)
  cropBox?: { x: number; y: number; w: number; h: number } | null; // 0..1 normalised
  quality?: number;             // 0..1
}

export interface CleanResult {
  base64: string;        // raw base64 (no data: prefix)
  mime: "image/jpeg";
  width: number;
  height: number;
  trimmed: boolean;
}

async function loadBitmap(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  // createImageBitmap honors EXIF on modern browsers via imageOrientation
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(blob, { imageOrientation: "from-image" } as any);
    } catch {
      /* fall back below */
    }
  }
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}

function bitmapSize(b: ImageBitmap | HTMLImageElement): { w: number; h: number } {
  return { w: (b as ImageBitmap).width, h: (b as ImageBitmap).height };
}

function autoTrim(ctx: CanvasRenderingContext2D, w: number, h: number): { x: number; y: number; w: number; h: number } | null {
  const data = ctx.getImageData(0, 0, w, h).data;
  // Sample background from the 4 corners (median average)
  const corners = [
    sample(data, 2, 2, w),
    sample(data, w - 3, 2, w),
    sample(data, 2, h - 3, w),
    sample(data, w - 3, h - 3, w),
  ];
  const bg = avgColor(corners);

  const isBg = (i: number) =>
    Math.abs(data[i] - bg[0]) <= TRIM_TOLERANCE &&
    Math.abs(data[i + 1] - bg[1]) <= TRIM_TOLERANCE &&
    Math.abs(data[i + 2] - bg[2]) <= TRIM_TOLERANCE;

  let top = 0, bottom = h - 1, left = 0, right = w - 1;

  rowScan: for (; top < h; top++) {
    let bgPx = 0;
    for (let x = 0; x < w; x += 2) {
      const i = (top * w + x) * 4;
      if (isBg(i)) bgPx++;
    }
    if (bgPx / (w / 2) < TRIM_SAMPLE_RATIO) break rowScan;
  }
  for (; bottom > top; bottom--) {
    let bgPx = 0;
    for (let x = 0; x < w; x += 2) {
      const i = (bottom * w + x) * 4;
      if (isBg(i)) bgPx++;
    }
    if (bgPx / (w / 2) < TRIM_SAMPLE_RATIO) break;
  }
  for (; left < w; left++) {
    let bgPx = 0;
    for (let y = 0; y < h; y += 2) {
      const i = (y * w + left) * 4;
      if (isBg(i)) bgPx++;
    }
    if (bgPx / (h / 2) < TRIM_SAMPLE_RATIO) break;
  }
  for (; right > left; right--) {
    let bgPx = 0;
    for (let y = 0; y < h; y += 2) {
      const i = (y * w + right) * 4;
      if (isBg(i)) bgPx++;
    }
    if (bgPx / (h / 2) < TRIM_SAMPLE_RATIO) break;
  }

  const tw = right - left;
  const th = bottom - top;
  // Reject if trim would remove almost everything (probably bad detection)
  if (tw < w * 0.4 || th < h * 0.4) return null;
  // Reject if trim removes nothing meaningful
  if (tw > w * 0.97 && th > h * 0.97) return null;
  return { x: left, y: top, w: tw, h: th };
}

function sample(data: Uint8ClampedArray, x: number, y: number, w: number) {
  const i = (y * w + x) * 4;
  return [data[i], data[i + 1], data[i + 2]] as [number, number, number];
}

function avgColor(cs: [number, number, number][]): [number, number, number] {
  const r = cs.reduce((s, c) => s + c[0], 0) / cs.length;
  const g = cs.reduce((s, c) => s + c[1], 0) / cs.length;
  const b = cs.reduce((s, c) => s + c[2], 0) / cs.length;
  return [r, g, b];
}

export async function cleanImage(file: Blob | string, opts: CleanOptions = {}): Promise<CleanResult> {
  const {
    background = "#ffffff",
    square = true,
    trim = true,
    cropBox = null,
    quality = 0.86,
  } = opts;

  // If string base64 input
  let blob: Blob;
  if (typeof file === "string") {
    const resp = await fetch(file.startsWith("data:") ? file : `data:image/jpeg;base64,${file}`);
    blob = await resp.blob();
  } else {
    blob = file;
  }

  const bitmap = await loadBitmap(blob);
  const { w: bw, h: bh } = bitmapSize(bitmap);

  // Stage 1: draw to a canvas at native size (after EXIF)
  const stage = document.createElement("canvas");
  stage.width = bw;
  stage.height = bh;
  const sctx = stage.getContext("2d")!;
  sctx.drawImage(bitmap as any, 0, 0);

  // Stage 2: apply manual crop box if provided
  let cropX = 0, cropY = 0, cropW = bw, cropH = bh;
  if (cropBox) {
    cropX = Math.max(0, Math.round(cropBox.x * bw));
    cropY = Math.max(0, Math.round(cropBox.y * bh));
    cropW = Math.min(bw - cropX, Math.round(cropBox.w * bw));
    cropH = Math.min(bh - cropY, Math.round(cropBox.h * bh));
  } else if (trim) {
    const trimmed = autoTrim(sctx, bw, bh);
    if (trimmed) {
      cropX = trimmed.x;
      cropY = trimmed.y;
      cropW = trimmed.w;
      cropH = trimmed.h;
    }
  }
  const didTrim = cropX !== 0 || cropY !== 0 || cropW !== bw || cropH !== bh;

  // Stage 3: scale to fit MAX_DIM
  const longest = Math.max(cropW, cropH);
  const scale = longest > MAX_DIM ? MAX_DIM / longest : 1;
  const dw = Math.round(cropW * scale);
  const dh = Math.round(cropH * scale);

  // Stage 4: composite onto square (or rect)
  const outSize = square ? Math.max(dw, dh) : 0;
  const outW = square ? outSize : dw;
  const outH = square ? outSize : dh;

  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const octx = out.getContext("2d")!;
  octx.fillStyle = background;
  octx.fillRect(0, 0, outW, outH);
  const dx = Math.round((outW - dw) / 2);
  const dy = Math.round((outH - dh) / 2);
  octx.imageSmoothingQuality = "high";
  octx.drawImage(stage, cropX, cropY, cropW, cropH, dx, dy, dw, dh);

  // Stage 5: encode JPEG
  const dataUrl = out.toDataURL("image/jpeg", quality);
  const base64 = dataUrl.split(",")[1];

  // Cleanup
  if ("close" in (bitmap as any)) (bitmap as any).close?.();

  return { base64, mime: "image/jpeg", width: outW, height: outH, trimmed: didTrim };
}
