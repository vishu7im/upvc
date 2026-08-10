import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer";

const root = path.resolve(import.meta.dirname, "../../..");
const output = path.resolve(root, "Spec/v2/dashboard/screens");
const chrome = process.env.AUDIT_CHROME
  ?? "/home/vishal/.cache/puppeteer/chrome-headless-shell/linux-150.0.7871.24/chrome-headless-shell-linux64/chrome-headless-shell";
const variants = ["organisation-scope", "personal-scope", "empty"];
const viewports = [
  { label: "1280", width: 1280, height: 900 },
  { label: "834", width: 834, height: 1112 },
];

fs.mkdirSync(output, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ["--no-sandbox"],
});

const evidence = [];
try {
  const page = await browser.newPage();
  for (const variant of variants) {
    for (const viewport of viewports) {
      await page.setViewport(viewport);
      await page.goto(pathToFileURL(path.resolve(root, `Spec/v2/dashboard/${variant}.html`)).href, {
        waitUntil: "networkidle0",
      });
      await page.evaluate(() => window.scrollTo(0, 0));

      const metrics = await page.evaluate(() => {
        const visibleAboveFold = (element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.bottom <= window.innerHeight;
        };
        const heading = document.querySelector(".v2-page-heading");
        const title = heading?.querySelector("h1");
        const description = heading?.querySelector(".v2-lead");
        const primary = [...document.querySelectorAll('[data-v2-variant="primary"]')];
        const primaryAboveFold = primary.filter(visibleAboveFold);
        return {
          pageClientWidth: document.documentElement.clientWidth,
          pageScrollWidth: document.documentElement.scrollWidth,
          horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          bodyFontSize: getComputedStyle(document.body).fontSize,
          titleAboveFold: Boolean(title && visibleAboveFold(title)),
          descriptionAboveFold: Boolean(description && visibleAboveFold(description)),
          primaryTotal: primary.length,
          primaryAboveFold: primaryAboveFold.length,
          primaryLabel: primaryAboveFold[0]?.textContent?.trim() ?? null,
          eyebrow: heading?.querySelector(".v2-eyebrow")?.textContent?.trim() ?? null,
          emptyState: Boolean(document.querySelector(".v2-empty-state")),
          metricCards: document.querySelectorAll(".v2-metric-card").length,
          trendRows: document.querySelectorAll(".v2-dashboard-trend li").length,
        };
      });

      const failures = [];
      if (metrics.horizontalOverflow) failures.push("page-level horizontal overflow");
      if (metrics.pageScrollWidth !== metrics.pageClientWidth) failures.push("page width does not match the viewport");
      if (metrics.bodyFontSize !== "16px") failures.push(`body font is ${metrics.bodyFontSize}`);
      if (!metrics.titleAboveFold || !metrics.descriptionAboveFold) failures.push("heading answers are below the fold");
      if (metrics.primaryTotal !== 1 || metrics.primaryAboveFold !== 1) failures.push("primary action count is not exactly one at rest");
      if (variant === "empty" && (!metrics.emptyState || metrics.metricCards !== 0 || metrics.trendRows !== 0)) {
        failures.push("fresh-install state renders invented metrics or trend rows");
      }
      if (variant !== "empty" && (metrics.metricCards !== 3 || metrics.trendRows !== 6)) {
        failures.push("ready dashboard is missing its three KPIs or six UTC buckets");
      }

      evidence.push({ variant, viewport, metrics, failures });
      await page.screenshot({
        path: path.resolve(output, `${variant}-${viewport.label}.png`),
        type: "png",
      });
    }
  }
} finally {
  await browser.close();
}

fs.writeFileSync(
  path.resolve(output, "dashboard-metrics.json"),
  `${JSON.stringify(evidence, null, 2)}\n`,
);

const failures = evidence.flatMap((entry) =>
  entry.failures.map((failure) => `${entry.variant} ${entry.viewport.label}: ${failure}`),
);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Captured ${evidence.length} dashboard role/viewport states with no measurement failures.`);
