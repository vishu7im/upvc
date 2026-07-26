// =====================================================================
// Client-side export of the elevation the user is looking at (D5).
//
// Entirely in the browser: the SVG string already IS the deliverable, so
// downloading it needs no backend route, no storage key and no PDF pipeline
// (that stays the documents' job). PNG is the same markup rasterised through
// a canvas, for pasting into email/chat.
// =====================================================================

/** Pixel width of an exported PNG (height follows the drawing's aspect). */
const PNG_WIDTH_PX = 2000;

function triggerDownload(url: string, filename: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * The engine SVG carries only a viewBox (it is drawn in mm), which is all an
 * `<img>` needs for layout — but a canvas rasteriser needs pixel dimensions.
 */
function withPixelSize(svg: string, pxWidth: number): { markup: string; width: number; height: number } {
  const vb = svg.match(/viewBox="\s*([-\d.]+)\s+([-\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  const vw = vb ? Number(vb[3]) : pxWidth;
  const vh = vb ? Number(vb[4]) : pxWidth;
  const height = Math.max(1, Math.round(pxWidth * (vh / (vw || 1))));
  const markup = svg.replace(/<svg\b/, `<svg width="${pxWidth}" height="${height}"`);
  return { markup, width: pxWidth, height };
}

export function downloadSvg(svg: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  triggerDownload(url, filename.endsWith(".svg") ? filename : `${filename}.svg`);
  URL.revokeObjectURL(url);
}

export function downloadPng(svg: string, filename: string): Promise<void> {
  const { markup, width, height } = withPixelSize(svg, PNG_WIDTH_PX);
  const source = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml;charset=utf-8" }));
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(source);
        reject(new Error("Canvas is unavailable in this browser"));
        return;
      }
      // The drawing assumes paper, not transparency.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(source);
      triggerDownload(canvas.toDataURL("image/png"), filename.endsWith(".png") ? filename : `${filename}.png`);
      resolve();
    };
    img.onerror = () => {
      URL.revokeObjectURL(source);
      reject(new Error("Could not rasterise this drawing"));
    };
    img.src = source;
  });
}

/** "casement-window-1200x1300-schematic" — a filename that says what it is. */
export function viewFilename(designName: string, widthMm: number, heightMm: number, view: string): string {
  const slug = designName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "window"}-${Math.round(widthMm)}x${Math.round(heightMm)}-${view}`;
}
