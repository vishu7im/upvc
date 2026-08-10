import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";

const root = path.resolve(import.meta.dirname, "../../..");
const output = path.resolve(root, "Spec/v2/orders/screens");
const baseUrl = process.env.V2_CAPTURE_BASE_URL ?? "http://127.0.0.1:3100";
const token = process.env.V2_CAPTURE_TOKEN;
const chrome = process.env.AUDIT_CHROME
  ?? "/home/vishal/.cache/puppeteer/chrome-headless-shell/linux-150.0.7871.24/chrome-headless-shell-linux64/chrome-headless-shell";
const viewports = [
  { label: "1280", width: 1280, height: 900 },
  { label: "834", width: 834, height: 1112 },
];

if (!token) throw new Error("V2_CAPTURE_TOKEN is required and is never written to evidence.");
fs.mkdirSync(output, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ["--no-sandbox"],
});

const evidence = [];
try {
  const page = await browser.newPage();
  await page.setCookie({ name: "token", value: token, url: baseUrl, httpOnly: true, sameSite: "Lax" });
  const openRoute = async (route) => {
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction((expectedPath) => window.location.pathname === expectedPath, {}, route);
    await page.waitForSelector("main h1", { visible: true });
    if (/^\/v2\/orders\/[^/]+/.test(route)) {
      await page.waitForSelector(".v2-order-tabs a:nth-child(4)", { visible: true });
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
    return response;
  };
  await openRoute("/v2/orders");

  const orders = await page.evaluate(async () => {
    const fetchFirst = async (status) => {
      const response = await fetch(`/api/orders?page=1&limit=1&status=${status}`);
      if (!response.ok) throw new Error(`Orders ${status} request failed with ${response.status}`);
      const payload = await response.json();
      return payload.data?.[0]?.id ?? null;
    };
    return { draft: await fetchFirst("draft"), confirmed: await fetchFirst("confirmed") };
  });

  const variants = [{ label: "list", route: "/v2/orders", state: "list" }];
  for (const state of ["draft", "confirmed"]) {
    const id = orders[state];
    if (!id) continue;
    variants.push(
      { label: `${state}-overview`, route: `/v2/orders/${id}`, state },
      { label: `${state}-items`, route: `/v2/orders/${id}/items`, state },
      { label: `${state}-customer-price`, route: `/v2/orders/${id}/customer-price`, state },
      { label: `${state}-documents`, route: `/v2/orders/${id}/documents`, state },
    );
  }

  for (const variant of variants) {
    for (const viewport of viewports) {
      await page.setViewport(viewport);
      const response = await openRoute(variant.route);
      await page.evaluate(() => window.scrollTo(0, 0));

      const metrics = await page.evaluate(() => {
        const rootElement = document.querySelector("[data-v2]");
        const main = document.querySelector("main");
        const heading = main?.querySelector("h1");
        const primary = [...(main?.querySelectorAll('[data-v2-variant="primary"]') ?? [])];
        const rowKeyboardLinks = [...(main?.querySelectorAll("tbody tr") ?? [])].map((row) =>
          [...row.querySelectorAll("a[href]")].filter((link) =>
            link.getAttribute("aria-hidden") !== "true" && link.getAttribute("tabindex") !== "-1",
          ).length,
        );
        const groupHeadings = [...(main?.querySelectorAll(".v2-section-heading h2") ?? [])].map((node) => node.textContent?.trim());
        const controls = [...(main?.querySelectorAll('a[href], button, input:not([type="hidden"]), select, textarea') ?? [])]
          .map((element) => element.getBoundingClientRect())
          .filter((rect) => rect.width > 0 && rect.height > 0);
        return {
          statusCodeMarker: Boolean(main),
          pageClientWidth: document.documentElement.clientWidth,
          pageScrollWidth: document.documentElement.scrollWidth,
          horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          bodyFontSize: rootElement ? getComputedStyle(rootElement).fontSize : null,
          titleAboveFold: Boolean(heading && heading.getBoundingClientRect().bottom <= window.innerHeight),
          headerSearch: Boolean(document.querySelector('.v2-header-search input[name="q"]')),
          primaryTotal: primary.length,
          orderTabs: main?.querySelectorAll(".v2-order-tabs a").length ?? 0,
          unifiedItemLists: main?.querySelectorAll(".v2-order-lines").length ?? 0,
          documentCards: main?.querySelectorAll(".v2-section .v2-card").length ?? 0,
          groupHeadings,
          rowKeyboardLinks,
          minimumControlHeight: controls.length ? Math.min(...controls.map((rect) => rect.height)) : null,
        };
      });

      const failures = [];
      if (response?.status() !== 200 || !metrics.statusCodeMarker) failures.push("route did not render a V2 main surface");
      if (metrics.horizontalOverflow || metrics.pageScrollWidth !== metrics.pageClientWidth) failures.push("page-level horizontal overflow");
      if (metrics.bodyFontSize !== "16px") failures.push(`V2 root font is ${metrics.bodyFontSize}`);
      if (!metrics.titleAboveFold) failures.push("page title is below the fold");
      if (!metrics.headerSearch) failures.push("real Orders header search is absent");
      if (metrics.primaryTotal > 1) failures.push("more than one primary action is present");
      if (variant.state === "list" && metrics.rowKeyboardLinks.some((count) => count !== 1)) failures.push("an order row does not have exactly one keyboard destination");
      if (variant.state !== "list" && metrics.orderTabs !== 4) failures.push("order route does not expose all four order sections");
      if (variant.label.endsWith("-items") && metrics.unifiedItemLists > 1) failures.push("items are split into more than one list");
      if (variant.label === "confirmed-documents") {
        if (metrics.documentCards !== 7) failures.push(`confirmed pack has ${metrics.documentCards} document cards, expected 7`);
        if (!["Office", "Production", "Dispatch"].every((label) => metrics.groupHeadings.includes(label))) failures.push("confirmed documents are not grouped by the approved IA");
      }

      evidence.push({ variant: variant.label, viewport: viewport.label, metrics, failures });
      await page.screenshot({ path: path.resolve(output, `${variant.label}-${viewport.label}.png`), fullPage: true, type: "png" });
    }
  }

  if (orders.confirmed) {
    await page.setViewport(viewports[0]);
    await openRoute(`/v2/orders/${orders.confirmed}`);
    const buttons = await page.$$("button");
    for (const button of buttons) {
      const label = await button.evaluate((node) => node.textContent?.trim());
      if (label === "Reopen for editing") {
        await button.click();
        break;
      }
    }
    const drawer = await page.$eval('[role="dialog"]', (node) => ({
      explainsSevenDocuments: node.textContent?.includes("seven generated documents") ?? false,
      explainsRegeneration: node.textContent?.includes("Confirming again creates a fresh document pack") ?? false,
    }));
    evidence.push({ variant: "confirmed-reopen-drawer", viewport: "1280", metrics: drawer, failures: Object.values(drawer).every(Boolean) ? [] : ["reopen drawer does not explain document deletion and regeneration"] });
    await page.screenshot({ path: path.resolve(output, "confirmed-reopen-drawer-1280.png"), type: "png" });
  }
} finally {
  await browser.close();
}

fs.writeFileSync(path.resolve(output, "orders-metrics.json"), `${JSON.stringify(evidence, null, 2)}\n`);
const failures = evidence.flatMap((entry) => entry.failures.map((failure) => `${entry.variant} ${entry.viewport}: ${failure}`));
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`Captured ${evidence.length} live Orders route/viewport states with no measurement failures.`);
