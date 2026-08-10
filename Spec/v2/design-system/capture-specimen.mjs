import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const SPECIMEN = path.join(ROOT, "Spec/v2/design-system/specimen.html");
const OUT = path.join(ROOT, "Spec/v2/design-system/screens");
const CHROME = process.env.V2_SPECIMEN_CHROME
  ?? "/home/vishal/.cache/puppeteer/chrome-headless-shell/linux-150.0.7871.24/chrome-headless-shell-linux64/chrome-headless-shell";

const viewports = [
  { label: "1280", width: 1280, height: 1000 },
  { label: "834", width: 834, height: 1112 },
];

await fs.mkdir(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const results = [];

try {
  const page = await browser.newPage();

  for (const viewport of viewports) {
    await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(SPECIMEN).href, { waitUntil: "networkidle0" });
    await page.evaluate(async () => document.fonts?.ready);

    const metrics = await page.evaluate(() => {
      const px = (selector, property) => Number.parseFloat(getComputedStyle(document.querySelector(selector))[property]);
      const tableRegion = document.querySelector('[data-v2-scroll-region="table"]');
      const rows = [...document.querySelectorAll("tbody tr")];

      return {
        pageClientWidth: document.documentElement.clientWidth,
        pageScrollWidth: document.documentElement.scrollWidth,
        bodyFontPx: px("body", "fontSize"),
        tableFontPx: px("table", "fontSize"),
        defaultControlHeightPx: document.querySelector(".spec-input").getBoundingClientRect().height,
        compactControlHeightPx: document.querySelector(".spec-button-compact").getBoundingClientRect().height,
        minimumTableRowHeightPx: Math.min(...rows.map((row) => row.getBoundingClientRect().height)),
        focusOutlineWidthPx: px(".focus-sample", "outlineWidth"),
        tableClientWidth: tableRegion.clientWidth,
        tableScrollWidth: tableRegion.scrollWidth,
        tableHasLocalOverflow: tableRegion.scrollWidth > tableRegion.clientWidth,
        tabletNoticeVisible: getComputedStyle(document.querySelector(".tablet-note")).display !== "none",
        specimenColumns: getComputedStyle(document.querySelector(".spec-grid")).gridTemplateColumns.split(" ").length,
      };
    });

    const failures = [];
    if (metrics.pageScrollWidth !== metrics.pageClientWidth) failures.push("page has horizontal overflow");
    if (metrics.bodyFontPx < 16 || metrics.tableFontPx < 16) failures.push("body/table text is below 16px");
    if (metrics.defaultControlHeightPx < 48) failures.push("default control is below 48px");
    if (metrics.compactControlHeightPx < 44) failures.push("compact control is below 44px");
    if (metrics.minimumTableRowHeightPx < 44) failures.push("table row is below 44px");
    if (metrics.focusOutlineWidthPx < 3) failures.push("focus outline is below 3px");
    if (viewport.width === 834 && !metrics.tableHasLocalOverflow) failures.push("tablet table does not demonstrate local overflow");
    if (viewport.width === 834 && !metrics.tabletNoticeVisible) failures.push("tablet responsive state did not activate");

    await page.screenshot({
      path: path.join(OUT, `specimen-${viewport.label}.png`),
      fullPage: true,
      type: "png",
    });

    results.push({ viewport, metrics, failures });
  }
} finally {
  await browser.close();
}

await fs.writeFile(
  path.join(OUT, "specimen-metrics.json"),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`,
);

for (const result of results) {
  console.log(`${result.viewport.label}px`, JSON.stringify(result.metrics));
  for (const failure of result.failures) console.error(`FAIL ${result.viewport.label}px: ${failure}`);
}

if (results.some((result) => result.failures.length > 0)) process.exitCode = 1;
