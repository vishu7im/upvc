import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer";

const root = path.resolve(import.meta.dirname, "../../..");
const gallery = path.join(root, "Spec/v2/component-library/gallery.html");
const drawerGallery = path.join(root, "Spec/v2/component-library/gallery-drawer.html");
const output = path.join(root, "Spec/v2/component-library/screens");
const chrome = process.env.V2_GALLERY_CHROME
  ?? "/home/vishal/.cache/puppeteer/chrome-headless-shell/linux-150.0.7871.24/chrome-headless-shell-linux64/chrome-headless-shell";
const viewports = [
  { label: "1280", width: 1280, height: 1000 },
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
    await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(gallery).href, { waitUntil: "networkidle0" });
    await page.evaluate(async () => document.fonts?.ready);
    await page.focus(".v2-button");

    const metrics = await page.evaluate(() => {
      const visible = (element) => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return box.width > 0 && box.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      };
      const controls = [...document.querySelectorAll(".v2-button, .v2-icon-button, input:not([type='checkbox']), select, textarea")].filter(visible);
      const rowLinks = [...document.querySelectorAll(".v2-data-table tbody tr")].map((row) =>
        [...row.querySelectorAll("a")].filter((link) => link.tabIndex >= 0 && link.getAttribute("aria-hidden") !== "true").length,
      );
      const tableRegion = document.querySelector("[data-v2-scroll-region='table']");
      const firstButton = document.querySelector(".v2-button");
      const stateLabels = [...document.querySelectorAll("[data-v2-state-label]")].map((node) => node.textContent.trim());
      return {
        pageClientWidth: document.documentElement.clientWidth,
        pageScrollWidth: document.documentElement.scrollWidth,
        bodyFontPx: Number.parseFloat(getComputedStyle(document.body).fontSize),
        labelFontPx: Math.min(...[...document.querySelectorAll(".v2-field-label")].map((node) => Number.parseFloat(getComputedStyle(node).fontSize))),
        minimumControlHeightPx: Math.min(...controls.map((control) => control.getBoundingClientRect().height)),
        minimumControlWidthPx: Math.min(...controls.map((control) => control.getBoundingClientRect().width)),
        minimumTableRowHeightPx: Math.min(...[...document.querySelectorAll(".v2-data-table tbody tr")].map((row) => row.getBoundingClientRect().height)),
        focusOutlineWidthPx: Number.parseFloat(getComputedStyle(firstButton).outlineWidth),
        tableClientWidth: tableRegion.clientWidth,
        tableScrollWidth: tableRegion.scrollWidth,
        tableHasLocalOverflow: tableRegion.scrollWidth > tableRegion.clientWidth,
        reachableRowLinks: rowLinks,
        stateLabels,
      };
    });

    const failures = [];
    if (metrics.pageScrollWidth !== metrics.pageClientWidth) failures.push("page has horizontal overflow");
    if (metrics.bodyFontPx < 16 || metrics.labelFontPx < 16) failures.push("body or field label is below 16px");
    if (metrics.minimumControlHeightPx < 44 || metrics.minimumControlWidthPx < 44) failures.push("an interactive control is below 44px");
    if (metrics.minimumTableRowHeightPx < 56) failures.push("a default table row is below 56px");
    if (metrics.focusOutlineWidthPx < 3) failures.push("focus outline is below 3px");
    if (metrics.reachableRowLinks.some((count) => count !== 1)) failures.push("a table row does not have exactly one keyboard destination");
    if (!metrics.stateLabels.some((label) => label.startsWith("Changed."))) failures.push("changed text state is absent");
    if (!metrics.stateLabels.some((label) => label.startsWith("Attention needed."))) failures.push("attention text state is absent");
    if (!metrics.stateLabels.some((label) => label.startsWith("Error."))) failures.push("error text state is absent");
    if (viewport.width === 834 && !metrics.tableHasLocalOverflow) failures.push("tablet table does not contain its overflow");

    await page.screenshot({
      path: path.join(output, `gallery-${viewport.label}.png`),
      fullPage: true,
      type: "png",
    });
    results.push({ viewport, metrics, failures });
  }

  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(drawerGallery).href, { waitUntil: "networkidle0" });
  await page.screenshot({ path: path.join(output, "gallery-drawer-1280.png"), type: "png" });
  const drawer = await page.evaluate(() => {
    const panel = document.querySelector(".v2-drawer");
    const close = panel.querySelector(".v2-icon-button");
    const box = panel.getBoundingClientRect();
    return {
      widthPx: box.width,
      heightPx: box.height,
      role: panel.getAttribute("role"),
      modal: panel.getAttribute("aria-modal"),
      labelledBy: panel.getAttribute("aria-labelledby"),
      closeTargetWidthPx: close.getBoundingClientRect().width,
      closeTargetHeightPx: close.getBoundingClientRect().height,
    };
  });
  const drawerFailures = [];
  if (drawer.role !== "dialog" || drawer.modal !== "true" || !drawer.labelledBy) drawerFailures.push("drawer dialog semantics are incomplete");
  if (drawer.closeTargetWidthPx < 44 || drawer.closeTargetHeightPx < 44) drawerFailures.push("drawer close target is below 44px");
  results.push({ viewport: { label: "drawer-1280", width: 1280, height: 900 }, metrics: drawer, failures: drawerFailures });
} finally {
  await browser.close();
}

await fs.writeFile(
  path.join(output, "gallery-metrics.json"),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`,
);

for (const result of results) {
  console.log(`${result.viewport.label}px`, JSON.stringify(result.metrics));
  for (const failure of result.failures) console.error(`FAIL ${result.viewport.label}px: ${failure}`);
}

if (results.some((result) => result.failures.length > 0)) process.exitCode = 1;
