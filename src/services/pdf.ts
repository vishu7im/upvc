// =====================================================================
// services/pdf.ts — HTML → PDF via Puppeteer (headless Chromium).
//
// I/O service: NEVER imported by src/engine/*. The engine produces
// print-ready HTML (src/engine/documents.ts); this turns it into a PDF.
//
// A single browser instance is launched lazily and reused across requests
// (launch is ~1s; reuse keeps per-PDF cost to ~0.3–1s). Call closeBrowser()
// on shutdown. --no-sandbox is required under WSL/Docker/root.
// =====================================================================

import puppeteer, { type Browser } from "puppeteer";

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
  }
  try {
    const b = await browserPromise;
    if (b.connected) return b;
  } catch {
    // launch failed — fall through to relaunch
  }
  browserPromise = null;
  return getBrowser();
}

// A4 page geometry. The usable height is derived from the SAME margins the
// page.pdf() call below uses, so the fit-to-one-page check and the actual print
// area can never drift apart.
const A4_HEIGHT_MM = 297;
const MARGIN_MM = { top: 12, bottom: 12, left: 10, right: 10 };
const PX_PER_MM = 96 / 25.4; // CSS reference pixel
const USABLE_HEIGHT_PX =
  (A4_HEIGHT_MM - MARGIN_MM.top - MARGIN_MM.bottom) * PX_PER_MM; // ≈ 1032

/**
 * The floor on `fitToOnePage` shrinking. Below ~0.8 the cut list stops being
 * readable across a workshop bench, and an unreadable one-pager is worse than
 * two readable pages — so anything needing more than a 20% reduction is left to
 * paginate. In practice that is a multi-item order, which SHOULD paginate
 * (engine/documents.ts, WORK_ORDER_COMPACT_CSS).
 */
const MIN_FIT_SCALE = 0.8;

export interface PdfOptions {
  /**
   * Shrink-to-fit a single page when the content lands just over one. Used for
   * the Work Order only (api/orders.ts) — it is the document the shop floor
   * wants on one sheet, and its layout is already compacted for it.
   */
  fitToOnePage?: boolean;
}

/** Render a full HTML document to an A4 PDF buffer. */
export async function htmlToPdf(html: string, opts: PdfOptions = {}): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // The HTML is self-contained (inline CSS, data-URI images) so network
    // settling is immediate; "load" is enough and avoids hanging on idle.
    await page.setContent(html, { waitUntil: "load" });

    let scale: number | undefined;
    if (opts.fitToOnePage) {
      // Measure under PRINT media — the document's own @media/print-only rules
      // must be the ones in effect, or we would scale against the wrong height.
      await page.emulateMediaType("print");
      // documentElement, not body: it includes the body's own margins, which
      // are part of what has to fit inside the print area.
      const contentPx = await page.evaluate(
        () => document.documentElement.scrollHeight,
      );
      if (contentPx > USABLE_HEIGHT_PX) {
        const needed = USABLE_HEIGHT_PX / contentPx;
        if (needed >= MIN_FIT_SCALE) scale = needed;
      }
    }

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: `${MARGIN_MM.top}mm`,
        bottom: `${MARGIN_MM.bottom}mm`,
        left: `${MARGIN_MM.left}mm`,
        right: `${MARGIN_MM.right}mm`,
      },
      // Omitted entirely when we are not fitting, so the default render path is
      // byte-for-byte the pre-change call.
      ...(scale === undefined ? {} : { scale }),
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

/** Close the shared browser (graceful shutdown). */
export async function closeBrowser(): Promise<void> {
  if (!browserPromise) return;
  try {
    const b = await browserPromise;
    await b.close();
  } catch {
    // already gone
  } finally {
    browserPromise = null;
  }
}
