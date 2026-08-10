import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";

const root = path.resolve(import.meta.dirname, "../../..");
const output = path.resolve(root, "Spec/v2/products/screens");
const baseUrl = process.env.V2_CAPTURE_BASE_URL ?? "http://localhost:3100";
const chrome = process.env.AUDIT_CHROME
  ?? "/home/vishal/.cache/puppeteer/chrome-headless-shell/linux-150.0.7871.24/chrome-headless-shell-linux64/chrome-headless-shell";
const viewports = {
  "1280": { width: 1280, height: 900 },
  "834": { width: 834, height: 1112 },
};

function readEnvironment(file) {
  try {
    return Object.fromEntries(
      fs.readFileSync(file, "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => {
          const separator = line.indexOf("=");
          const key = line.slice(0, separator).trim();
          const value = line.slice(separator + 1).trim().replace(/^(["'])(.*)\1$/, "$2");
          return [key, value];
        }),
    );
  } catch {
    return {};
  }
}

const localEnvironment = readEnvironment(path.resolve(root, ".env"));
const email = process.env.V2_CAPTURE_EMAIL ?? localEnvironment.ADMIN_EMAIL ?? "admin@local";
const password = process.env.V2_CAPTURE_PASSWORD ?? localEnvironment.ADMIN_PASSWORD ?? "admin123";

fs.mkdirSync(output, { recursive: true });

const login = await fetch(`${baseUrl}/api/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email, password }),
});
if (!login.ok) throw new Error(`Local evidence login failed with HTTP ${login.status}.`);
const setCookies = typeof login.headers.getSetCookie === "function"
  ? login.headers.getSetCookie()
  : [login.headers.get("set-cookie")].filter(Boolean);
const tokenCookie = setCookies.find((cookie) => cookie.startsWith("token="));
const token = tokenCookie?.slice("token=".length).split(";")[0];
if (!token) throw new Error("Local evidence login did not return the auth cookie.");

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ["--no-sandbox"],
});

const evidence = [];
try {
  const page = await browser.newPage();
  await page.setCookie({ name: "token", value: token, url: baseUrl, httpOnly: true, sameSite: "Lax" });

  const openRoute = async (route, detail = false) => {
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForSelector("main h1", { visible: true });
    if (detail) await page.waitForSelector(".v2-product-design-grid, .v2-empty-state", { visible: true });
    await new Promise((resolve) => setTimeout(resolve, detail ? 500 : 250));
    return response;
  };

  const capture = async ({ label, viewport, response, expectedMode, detail = false, referenceOnly = false }) => {
    await page.setViewport(viewports[viewport]);
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise((resolve) => setTimeout(resolve, 150));
    const metrics = await page.evaluate(() => {
      const rootElement = document.querySelector("[data-v2]");
      const main = document.querySelector("main");
      const heading = main?.querySelector("h1");
      const sections = [...(main?.querySelectorAll(".v2-section") ?? [])];
      const sectionByTitle = (title) => sections.find((section) => section.querySelector("h2")?.textContent?.trim() === title);
      const configurableSection = sectionByTitle("Ready to configure");
      const referenceSection = sectionByTitle("Reference previews");
      const configurableCards = [...(configurableSection?.querySelectorAll(".v2-card") ?? [])];
      const referenceCards = [...(referenceSection?.querySelectorAll(".v2-card") ?? [])];
      const productCards = [...(sectionByTitle("Product lines")?.querySelectorAll(".v2-card") ?? [])];
      const controls = [...(main?.querySelectorAll("a[href], button, input, select, textarea") ?? [])]
        .map((element) => element.getBoundingClientRect())
        .filter((rect) => rect.width > 0 && rect.height > 0);
      const modeLinks = [...(main?.querySelectorAll(".v2-product-mode-choice a") ?? [])];
      return {
        path: window.location.pathname,
        query: window.location.search,
        title: heading?.textContent?.trim() ?? null,
        pageClientWidth: document.documentElement.clientWidth,
        pageScrollWidth: document.documentElement.scrollWidth,
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        bodyFontSize: rootElement ? getComputedStyle(rootElement).fontSize : null,
        titleAboveFold: Boolean(heading && heading.getBoundingClientRect().bottom <= window.innerHeight),
        productCards: productCards.length,
        productCardDestinations: productCards.map((card) => card.querySelectorAll('a[href*="/v2/products/"]').length),
        configurableCards: configurableCards.length,
        configurableDestinations: configurableCards.map((card) => card.querySelectorAll('a[href*="/v2/configure?"]').length),
        referenceCards: referenceCards.length,
        referenceDestinations: referenceCards.map((card) => card.querySelectorAll("a[href]").length),
        renderedPreviews: main?.querySelectorAll(".v2-product-preview-image").length ?? 0,
        missingPreviews: main?.querySelectorAll(".v2-product-preview-missing").length ?? 0,
        modeChoices: modeLinks.map((link) => link.textContent?.trim()),
        activeMode: modeLinks.find((link) => link.getAttribute("data-v2-variant") === "primary")?.textContent?.trim() ?? null,
        unsupportedFilterControls: main?.querySelectorAll('input[type="search"], select').length ?? 0,
        minimumControlHeight: controls.length ? Math.min(...controls.map((rect) => rect.height)) : null,
      };
    });

    const failures = [];
    if (response?.status() !== 200) failures.push(`HTTP ${response?.status()}`);
    if (!metrics.title || !metrics.titleAboveFold) failures.push("page title is absent or below the fold");
    if (metrics.horizontalOverflow || metrics.pageScrollWidth !== metrics.pageClientWidth) failures.push("page-level horizontal overflow");
    if (metrics.bodyFontSize !== "16px") failures.push(`V2 root font is ${metrics.bodyFontSize}`);
    if (metrics.unsupportedFilterControls !== 0) failures.push("unsupported catalog filter controls are visible");
    if (!detail) {
      if (metrics.productCards < 1) failures.push("no product lines rendered");
      if (metrics.productCardDestinations.some((count) => count !== 1)) failures.push("a product card does not have exactly one destination");
    } else {
      if (referenceOnly) {
        if (metrics.referenceCards < 1) failures.push("no reference-only layouts rendered");
      } else {
        if (metrics.configurableCards < 1) failures.push("no configurable layouts rendered");
        if (metrics.configurableDestinations.some((count) => count !== 1)) failures.push("a configurable layout does not have exactly one task action");
      }
      if (metrics.referenceDestinations.some((count) => count !== 0)) failures.push("a reference-only layout is actionable");
      if (metrics.modeChoices.length !== 2) failures.push("Standard/Custom task choice is incomplete");
      const wanted = expectedMode === "custom" ? "Custom unit" : "Standard quote";
      if (metrics.activeMode !== wanted) failures.push(`active mode is ${metrics.activeMode}, expected ${wanted}`);
      if (metrics.renderedPreviews + metrics.missingPreviews !== metrics.configurableCards + metrics.referenceCards) {
        failures.push("one or more design tiles has no isolated preview state");
      }
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
    const response = await openRoute("/v2/products");
    await capture({ label: "products", viewport, response });
  }

  const galleryTargets = await page.evaluate(async () => {
    const productResponse = await fetch("/api/products?page=1&limit=100");
    if (!productResponse.ok) throw new Error(`Products scan failed with ${productResponse.status}`);
    const products = (await productResponse.json()).data ?? [];
    let configurable = null;
    let reference = null;
    for (const product of products) {
      const first = await fetch(`/api/products/${encodeURIComponent(product.id)}/designs?page=1&limit=24`);
      if (!first.ok) continue;
      const payload = await first.json();
      const pages = Math.max(1, payload.pagination?.pages ?? 1);
      for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
        const pagePayload = pageNumber === 1
          ? payload
          : await fetch(`/api/products/${encodeURIComponent(product.id)}/designs?page=${pageNumber}&limit=24`).then((response) => response.json());
        const items = pagePayload.data ?? [];
        const hasConfigurable = items.some((item) => item.quotable);
        const hasReference = items.some((item) => !item.quotable);
        if (hasConfigurable && !configurable) configurable = { productId: product.id, page: pageNumber };
        if (hasReference && !reference) reference = { productId: product.id, page: pageNumber };
        if (hasConfigurable && hasReference) {
          const mixed = { productId: product.id, page: pageNumber };
          return { configurable: mixed, reference: mixed, mixed: true };
        }
      }
    }
    return { configurable, reference, mixed: false };
  });
  if (!galleryTargets.configurable) throw new Error("No product page with a configurable layout was available.");

  for (const mode of ["standard", "custom"]) {
    for (const viewport of Object.keys(viewports)) {
      await page.setViewport(viewports[viewport]);
      const route = `/v2/products/${encodeURIComponent(galleryTargets.configurable.productId)}?page=${galleryTargets.configurable.page}&mode=${mode}`;
      const response = await openRoute(route, true);
      await capture({ label: `layouts-${mode}`, viewport, response, expectedMode: mode, detail: true });
    }
  }

  if (galleryTargets.reference) {
    for (const viewport of Object.keys(viewports)) {
      await page.setViewport(viewports[viewport]);
      const route = `/v2/products/${encodeURIComponent(galleryTargets.reference.productId)}?page=${galleryTargets.reference.page}&mode=standard`;
      const response = await openRoute(route, true);
      await capture({ label: "layouts-reference", viewport, response, expectedMode: "standard", detail: true, referenceOnly: true });
    }
  }

  for (const mode of ["standard", "custom"]) {
    const galleryRoute = `/v2/products/${encodeURIComponent(galleryTargets.configurable.productId)}?page=${galleryTargets.configurable.page}&mode=${mode}`;
    await openRoute(galleryRoute, true);
    const href = await page.$eval('.v2-product-design-grid .v2-card a[href*="/v2/configure?"]', (link) => link.getAttribute("href"));
    if (!href) throw new Error(`The ${mode} gallery had no configuration destination.`);
    const response = await page.goto(`${baseUrl}${href}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForSelector(".v2-configure-workspace", { visible: true, timeout: 45_000 });
    const metrics = await page.evaluate(() => ({ path: window.location.pathname, query: window.location.search }));
    const failures = [];
    if (response?.status() !== 200) failures.push(`HTTP ${response?.status()}`);
    if (metrics.path !== "/v2/configure") failures.push(`unexpected destination ${metrics.path}`);
    if (!metrics.query.includes(`mode=${mode}`)) failures.push(`destination lost ${mode} mode`);
    evidence.push({ label: `task-destination-${mode}`, viewport: "runtime", metrics, failures });
  }

  evidence.push({
    label: "catalog-page-selection",
    viewport: "runtime",
    metrics: galleryTargets,
    failures: [],
  });
} finally {
  await browser.close();
}

fs.writeFileSync(path.resolve(output, "products-metrics.json"), `${JSON.stringify(evidence, null, 2)}\n`);
const failures = evidence.flatMap((entry) => entry.failures.map((failure) => `${entry.label} ${entry.viewport}: ${failure}`));
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`Captured ${evidence.length} live Products states with no measurement failures.`);
