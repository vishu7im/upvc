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

/** Render a full HTML document to an A4 PDF buffer. */
export async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // The HTML is self-contained (inline CSS, data-URI images) so network
    // settling is immediate; "load" is enough and avoids hanging on idle.
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", bottom: "12mm", left: "10mm", right: "10mm" },
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
