import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";

const output = path.join(import.meta.dirname, "screens");
const base = process.env.V2_BASE_URL ?? "http://127.0.0.1:3100";
const chrome = process.env.V2_GALLERY_CHROME
  ?? "/home/vishal/.cache/puppeteer/chrome-headless-shell/linux-150.0.7871.24/chrome-headless-shell-linux64/chrome-headless-shell";
const viewports = [
  { label: "1280", width: 1280, height: 900 },
  { label: "834", width: 834, height: 1112 },
];

await fs.mkdir(output, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const results = [];

try {
  const page = await browser.newPage();

  for (const viewport of viewports) {
    await page.setCookie({ name: "ui-version", value: "v2", url: base });
    await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1 });
    await page.goto(`${base}/`, { waitUntil: "networkidle0" });
    await page.focus(".v2-version-options a");

    const metrics = await page.evaluate(() => {
      const links = [...document.querySelectorAll(".v2-version-options a")];
      const preferred = document.querySelector("[data-v2-preferred]");
      const focused = document.activeElement;
      return {
        publicPath: window.location.pathname,
        pageClientWidth: document.documentElement.clientWidth,
        pageScrollWidth: document.documentElement.scrollWidth,
        fontPx: Number.parseFloat(getComputedStyle(document.querySelector("[data-v2]")).fontSize),
        optionCount: document.querySelectorAll(".v2-version-options .v2-card").length,
        minimumLinkHeightPx: Math.min(...links.map((link) => link.getBoundingClientRect().height)),
        preferredLabel: preferred?.textContent?.includes("FabricatorOS V2") ? "v2" : "unknown",
        focusOutlineWidthPx: Number.parseFloat(getComputedStyle(focused).outlineWidth),
      };
    });

    const failures = [];
    if (metrics.publicPath !== "/") failures.push("chooser did not retain the public root URL");
    if (metrics.pageClientWidth !== metrics.pageScrollWidth) failures.push("page has horizontal overflow");
    if (metrics.fontPx < 16) failures.push("chooser text is below 16px");
    if (metrics.optionCount !== 2) failures.push("chooser does not have exactly two destinations");
    if (metrics.minimumLinkHeightPx < 44) failures.push("chooser action is below 44px");
    if (metrics.preferredLabel !== "v2") failures.push("remembered preference is not visible");
    if (metrics.focusOutlineWidthPx < 3) failures.push("focus outline is below 3px");

    await page.screenshot({
      path: path.join(output, `chooser-${viewport.label}.png`),
      fullPage: true,
      type: "png",
    });
    results.push({ viewport, metrics, failures });
  }
} finally {
  await browser.close();
}

await fs.writeFile(
  path.join(output, "chooser-metrics.json"),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`,
);

for (const result of results) {
  console.log(`${result.viewport.label}px`, JSON.stringify(result.metrics));
  for (const failure of result.failures) console.error(`FAIL ${result.viewport.label}px: ${failure}`);
}
if (results.some((result) => result.failures.length > 0)) process.exitCode = 1;
