import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";

const root = path.resolve(import.meta.dirname, "../../..");
const output = path.resolve(root, "Spec/v2/configure/screens");
const baseUrl = process.env.V2_CAPTURE_BASE_URL ?? "http://localhost:3100";
const token = process.env.V2_CAPTURE_TOKEN;
const chrome = process.env.AUDIT_CHROME
  ?? "/home/vishal/.cache/puppeteer/chrome-headless-shell/linux-150.0.7871.24/chrome-headless-shell-linux64/chrome-headless-shell";
const viewports = {
  "1280": { width: 1280, height: 900 },
  "834": { width: 834, height: 1112 },
};

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

  const openRoute = async (route, workspace = false) => {
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction((expectedPath) => window.location.pathname === expectedPath, {}, "/v2/configure");
    await page.waitForSelector("main h1", { visible: true });
    if (workspace) {
      await page.waitForSelector(".v2-configure-workspace", { visible: true });
      await page.waitForFunction(() => {
        const chips = [...document.querySelectorAll(".v2-status-chip")];
        return chips.some((chip) => ["Ready", "Needs attention"].includes(chip.textContent?.trim() ?? ""));
      }, { timeout: 30_000 });
    }
    await new Promise((resolve) => setTimeout(resolve, workspace ? 900 : 350));
    return response;
  };

  const capture = async ({ label, viewport, response, expected }) => {
    await page.setViewport(viewports[viewport]);
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise((resolve) => setTimeout(resolve, 200));
    const metrics = await page.evaluate(() => {
      const rootElement = document.querySelector("[data-v2]");
      const main = document.querySelector("main");
      const heading = main?.querySelector("h1");
      const visibleTargets = [...(main?.querySelectorAll("a[href], button, select, input:not([type=checkbox]), textarea") ?? [])]
        .map((element) => element.getBoundingClientRect())
        .filter((rect) => rect.width > 0 && rect.height > 0);
      const ready = [...document.querySelectorAll(".v2-status-chip")]
        .some((chip) => chip.textContent?.trim() === "Ready");
      const issueState = [...document.querySelectorAll(".v2-status-chip")]
        .some((chip) => chip.textContent?.trim() === "Needs attention");
      return {
        path: window.location.pathname,
        query: window.location.search,
        title: heading?.textContent?.trim() ?? null,
        pageClientWidth: document.documentElement.clientWidth,
        pageScrollWidth: document.documentElement.scrollWidth,
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        bodyFontSize: rootElement ? getComputedStyle(rootElement).fontSize : null,
        titleAboveFold: Boolean(heading && heading.getBoundingClientRect().bottom <= window.innerHeight),
        familyChoices: main?.querySelectorAll('.v2-card a[href*="family="]').length ?? 0,
        layoutChoices: main?.querySelectorAll('.v2-configure-layouts a[href*="design="]').length ?? 0,
        workspaces: main?.querySelectorAll(".v2-configure-workspace").length ?? 0,
        inspectorTabs: [...(main?.querySelectorAll('.v2-configure-inspector-tabs [role="tab"]') ?? [])]
          .map((node) => node.textContent?.trim()),
        previewViews: [...(main?.querySelectorAll('.v2-configure-preview-tools [role="tab"]') ?? [])]
          .map((node) => node.textContent?.trim()),
        resolverSettled: ready || issueState,
        previewPresent: Boolean(main?.querySelector(".v2-configure-preview canvas, .v2-configure-fallback-preview, .v2-configure-preview [data-window-designer]"))
          || Boolean(main?.querySelector(".v2-configure-preview")),
        engineeringPrice: main?.querySelector(".v2-configure-price")?.textContent?.trim() ?? null,
        bomLines: main?.querySelectorAll(".v2-configure-bom li").length ?? 0,
        issueDrawerOpen: Boolean(main?.querySelector('[role="dialog"]')),
        selectedPart: main?.querySelector(".v2-configure-scope-bar strong")?.textContent?.trim() ?? null,
        structuralActions: main?.querySelectorAll(".v2-configure-action-row").length ?? 0,
        structuralHistory: main?.querySelectorAll(".v2-configure-history li").length ?? 0,
        minimumTargetHeight: visibleTargets.length ? Math.min(...visibleTargets.map((rect) => rect.height)) : null,
      };
    });

    const failures = [];
    if (response && response.status() !== 200) failures.push(`HTTP ${response.status()}`);
    if (metrics.path !== "/v2/configure") failures.push(`unexpected path ${metrics.path}`);
    if (!metrics.title || !metrics.titleAboveFold) failures.push("page title is absent or below the fold");
    if (metrics.horizontalOverflow || metrics.pageScrollWidth !== metrics.pageClientWidth) failures.push("page-level horizontal overflow");
    if (metrics.bodyFontSize !== "16px") failures.push(`V2 root font is ${metrics.bodyFontSize}`);
    if (expected === "family" && metrics.familyChoices < 1) failures.push("no task-first family choice");
    if (expected === "layout" && metrics.layoutChoices < 1) failures.push("no family-scoped layout choice");
    if (expected === "standard" || expected === "custom") {
      if (metrics.workspaces !== 1) failures.push("workspace is missing or duplicated");
      if (metrics.inspectorTabs.length !== 2) failures.push("workspace does not have two inspector tabs");
      if (!metrics.resolverSettled || !metrics.previewPresent) failures.push("resolver preview did not settle");
      const expectedViews = expected === "custom" ? 4 : 2;
      if (metrics.previewViews.length !== expectedViews) failures.push(`preview has ${metrics.previewViews.length} views, expected ${expectedViews}`);
    }

    evidence.push({ label, viewport, metrics, failures });
    await page.screenshot({
      path: path.resolve(output, `${label}-${viewport}.png`),
      fullPage: true,
      type: "png",
    });
  };

  for (const viewport of Object.keys(viewports)) {
    await page.setViewport(viewports[viewport]);
    const response = await openRoute("/v2/configure?mode=standard");
    await capture({ label: "start-standard", viewport, response, expected: "family" });
  }

  await page.setViewport(viewports["1280"]);
  await openRoute("/v2/configure?mode=standard");
  const familyHref = await page.$eval('.v2-card a[href*="family="]', (node) => node.getAttribute("href"));
  if (!familyHref) throw new Error("No family link was available.");

  for (const viewport of Object.keys(viewports)) {
    await page.setViewport(viewports[viewport]);
    const response = await openRoute(familyHref);
    await capture({ label: "layouts-standard", viewport, response, expected: "layout" });
  }

  await page.setViewport(viewports["1280"]);
  await openRoute(familyHref);
  const workspaceHref = await page.$$eval(".v2-configure-layouts > .v2-card", (cards) => {
    const ranked = cards.map((card) => ({
      href: card.querySelector('a[href*="design="]')?.getAttribute("href") ?? null,
      leaves: Number.parseInt(card.querySelector(".v2-status-chip")?.textContent ?? "0", 10) || 0,
    }));
    ranked.sort((a, b) => b.leaves - a.leaves);
    return ranked.find((entry) => entry.href)?.href ?? null;
  });
  if (!workspaceHref) throw new Error("No layout link was available.");

  for (const viewport of Object.keys(viewports)) {
    await page.setViewport(viewports[viewport]);
    const response = await openRoute(workspaceHref, true);
    await capture({ label: "workspace-standard", viewport, response, expected: "standard" });
  }

  await page.setViewport(viewports["1280"]);
  let response = await openRoute(workspaceHref, true);
  const joints = await page.$(".v2-configure-joints input:not(:disabled)");
  if (joints) {
    await joints.click();
    await new Promise((resolve) => setTimeout(resolve, 900));
    await capture({ label: "workspace-standard-joints", viewport: "1280", response, expected: "standard" });
  }

  const customUrl = new URL(workspaceHref, baseUrl);
  customUrl.searchParams.set("mode", "custom");
  const customHref = `${customUrl.pathname}${customUrl.search}`;
  for (const viewport of Object.keys(viewports)) {
    await page.setViewport(viewports[viewport]);
    response = await openRoute(customHref, true);
    await capture({ label: "workspace-custom", viewport, response, expected: "custom" });
  }

  await page.setViewport(viewports["1280"]);
  response = await openRoute(customHref, true);
  const productTab = await page.$$(".v2-configure-inspector-tabs button");
  if (productTab[1]) await productTab[1].click();
  await page.waitForSelector(".v2-configure-option-search", { visible: true });
  await capture({ label: "custom-product-options", viewport: "1280", response, expected: "custom" });

  const partCount = await page.$$eval(".v2-configure-parts button", (nodes) => nodes.length);
  let foundActions = false;
  for (let index = 0; index < partCount; index += 1) {
    const parts = await page.$$(".v2-configure-parts button");
    if (!parts[index]) break;
    await parts[index].click();
    await new Promise((resolve) => setTimeout(resolve, 150));
    foundActions = (await page.$$(".v2-configure-action-row")).length > 0;
    if (foundActions) break;
    const wholeItem = await page.$(".v2-configure-scope-bar button");
    if (wholeItem) await wholeItem.click();
  }
  await capture({ label: "custom-part-selected", viewport: "1280", response, expected: "custom" });

  if (foundActions) {
    const apply = await page.$(".v2-configure-action-row button");
    if (apply) {
      await apply.click();
      await page.waitForSelector(".v2-configure-history li", { visible: true });
      await new Promise((resolve) => setTimeout(resolve, 900));
      await page.$eval(".v2-configure-inspector-scroll", (node) => {
        node.scrollTop = node.scrollHeight;
      });
      await capture({ label: "custom-structure-undo", viewport: "1280", response, expected: "custom" });
      const undo = await page.$(".v2-configure-history button");
      if (undo) await undo.click();
    }
  }

  const viewChecks = [];
  for (const label of ["External", "Internal", "Schematic", "3D"]) {
    const tabs = await page.$$(".v2-configure-preview-tools [role=tab]");
    const tabLabels = await Promise.all(tabs.map((tab) => tab.evaluate((node) => node.textContent?.trim())));
    const target = tabs[tabLabels.indexOf(label)];
    if (!target) {
      viewChecks.push({ label, active: false });
      continue;
    }
    await target.evaluate((node) => node.click());
    await page.waitForFunction((expected) => [...document.querySelectorAll(".v2-configure-preview-tools [role=tab]")]
      .some((node) => node.textContent?.trim() === expected && node.getAttribute("aria-selected") === "true"), {}, label);
    await new Promise((resolve) => setTimeout(resolve, label === "3D" ? 900 : 500));
    viewChecks.push({
      label,
      active: await page.$$eval(".v2-configure-preview-tools [role=tab]", (nodes, expected) => nodes
        .some((node) => node.textContent?.trim() === expected && node.getAttribute("aria-selected") === "true"), label),
    });
  }
  evidence.push({
    label: "custom-view-parity",
    viewport: "1280",
    metrics: { viewChecks },
    failures: viewChecks.every((entry) => entry.active) ? [] : ["one or more Custom views did not activate"],
  });
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    const inspector = document.querySelector(".v2-configure-inspector-scroll");
    if (inspector) inspector.scrollTop = 0;
    for (const button of document.querySelectorAll(".v2-toast button")) button.click();
  });
  await new Promise((resolve) => setTimeout(resolve, 200));
  await page.screenshot({ path: path.resolve(output, "custom-view-3d-1280.png"), fullPage: true, type: "png" });

  const allButtons = await page.$$("button");
  let issueTrigger = null;
  for (const button of allButtons) {
    if ((await button.evaluate((node) => node.textContent?.trim() ?? "")).startsWith("Issues (")) {
      issueTrigger = button;
      break;
    }
  }
  if (issueTrigger) {
    await issueTrigger.click();
    await page.waitForSelector('[role="dialog"]', { visible: true });
    await capture({ label: "custom-issues", viewport: "1280", response, expected: "custom" });
  }
} finally {
  await browser.close();
}

fs.writeFileSync(path.resolve(output, "configure-metrics.json"), `${JSON.stringify(evidence, null, 2)}\n`);
const failures = evidence.flatMap((entry) => entry.failures.map((failure) => `${entry.label} ${entry.viewport}: ${failure}`));
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`Captured ${evidence.length} live Quote/configure states with no measurement failures.`);
