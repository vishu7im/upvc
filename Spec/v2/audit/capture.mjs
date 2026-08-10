import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";

const BASE = "http://localhost:3000";
const CHROME = process.env.AUDIT_CHROME ?? "/home/vishal/.cache/puppeteer/chrome/linux-150.0.7871.24/chrome-linux64/chrome";
const OUT = path.resolve("Spec/v2/audit/screens");
const METADATA_FILE = path.resolve("Spec/v2/audit/audit-metadata.json");
const PASSWORD = process.env.AUDIT_PASSWORD;
const ADMIN_EMAIL = process.env.AUDIT_ADMIN_EMAIL;
const CUSTOMER_EMAIL = process.env.AUDIT_CUSTOMER_EMAIL;

if (!PASSWORD || !ADMIN_EMAIL || !CUSTOMER_EMAIL) {
  throw new Error("Set AUDIT_PASSWORD, AUDIT_ADMIN_EMAIL, and AUDIT_CUSTOMER_EMAIL before capturing.");
}

const PRODUCT_ID = "1e503ae1-b978-4dc7-8747-935423503cc9";
const DESIGN_ID = "ed5acf4b-c491-48ed-b519-aa16877efbeb";
const DRAFT_ORDER_ID = "14aa4392-6d4a-441e-b718-a9b9894e3f61";
const CONFIRMED_ORDER_ID = "ff1fe42a-759f-4789-9d96-b9e4c483a4d6";
const AUDIT_ADMIN_ID = "4f17ba55-d6a5-4591-8fad-e06736c015a2";
const ADMIN_ROLE_ID = "d6a21504-c4b5-4375-915c-e194f06a0f13";

const QUOTE = `/quote?systemId=sunnyplast-70&designId=${DESIGN_ID}&productId=${PRODUCT_ID}&name=1`;
const DESIGNER = `/designer?family=casement-window&design=${DESIGN_ID}&system=sunnyplast-70&name=1`;

const VIEWPORTS = [
  { label: "1280", width: 1280, height: 900 },
  { label: "1920", width: 1920, height: 1080 },
  { label: "834", width: 834, height: 1112 },
];

const SCREENS = [
  { id: "01-login", path: "/login", public: true },
  { id: "02-change-password", path: "/change-password" },
  { id: "03-dashboard", path: "/" },
  { id: "04-products", path: "/products" },
  { id: "05-product-detail", path: `/products/${PRODUCT_ID}` },
  { id: "06-quote", path: QUOTE },
  { id: "07-designer", path: DESIGNER },
  { id: "08-orders", path: "/orders" },
  { id: "09-order-detail", path: `/orders/${CONFIRMED_ORDER_ID}` },
  { id: "10-account", path: "/account" },
  { id: "11-admin", path: "/admin" },
  { id: "12-admin-settings", path: "/admin/settings" },
  { id: "13-admin-catalog", path: "/admin/catalog" },
  { id: "14-admin-discounts", path: "/admin/discounts" },
  { id: "15-admin-users", path: "/admin/users" },
  { id: "16-admin-user-detail", path: `/admin/users/${AUDIT_ADMIN_ID}` },
  { id: "17-admin-roles", path: "/admin/roles" },
  { id: "18-admin-role-detail", path: `/admin/roles/${ADMIN_ROLE_ID}` },
];

const TRADE_TERMS = [
  "BOM", "DMO", "chamber", "cill", "joints", "stulp", "transom", "mullion",
  "weld allowance", "planner list", "work planner", "profile system", "frame key",
];

await fs.mkdir(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

async function newContext() {
  return browser.createBrowserContext();
}

async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle2", timeout: 60_000 });
  const result = await page.evaluate(async ({ email, password }) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    return { status: response.status, body: await response.text() };
  }, { email, password: PASSWORD });
  if (result.status !== 200) throw new Error(`Login failed for ${email}: ${JSON.stringify(result)}`);
}

async function settle(page) {
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  }).catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 900));
}

async function renderedMetrics(page, loadMs) {
  return page.evaluate(({ loadMs, tradeTerms }) => {
    const main = document.querySelector("main") ?? document.body;
    const interactive = [...main.querySelectorAll("a[href],button,input,select,textarea")];
    const visible = interactive.filter((el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
    });
    const atRest = visible.filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.top < innerHeight && rect.bottom > 0 && rect.left < innerWidth && rect.right > 0;
    });
    const text = main.innerText.toLowerCase();
    return {
      loadMs,
      finalPath: location.pathname + location.search,
      title: document.title,
      headings: [...main.querySelectorAll("h1,h2,h3")].map((el) => el.textContent?.trim()).filter(Boolean),
      controlsAtRest: atRest.length,
      controlsTotal: visible.length,
      tradeTerms: tradeTerms.filter((term) => text.includes(term.toLowerCase())),
      scrollHeight: document.documentElement.scrollHeight,
      viewportHeight: innerHeight,
      scrollScreens: Number((document.documentElement.scrollHeight / innerHeight).toFixed(1)),
      horizontalOverflowPx: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      textLength: main.innerText.trim().length,
    };
  }, { loadMs, tradeTerms: TRADE_TERMS });
}

async function goto(page, route) {
  const started = Date.now();
  const response = await page.goto(`${BASE}${route}`, { waitUntil: "networkidle2", timeout: 90_000 });
  await settle(page);
  return { status: response?.status() ?? null, loadMs: Date.now() - started };
}

async function shot(page, file, fullPage = true) {
  await page.screenshot({ path: path.join(OUT, file), fullPage, type: "png" });
}

const metadata = {
  generatedAt: new Date().toISOString(),
  method: "Authenticated Puppeteer walkthrough against the running Next.js V1 and configured PostgreSQL database.",
  viewports: VIEWPORTS,
  screens: [],
  states: [],
  roleChecks: [],
};

async function persistMetadata() {
  await fs.writeFile(METADATA_FILE, JSON.stringify(metadata, null, 2) + "\n");
}

// Public login screen in an isolated context.
{
  const context = await newContext();
  const page = await context.newPage();
  for (const viewport of VIEWPORTS) {
    await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1 });
    const nav = await goto(page, "/login");
    const metrics = await renderedMetrics(page, nav.loadMs);
    await shot(page, `01-login-${viewport.label}.png`);
    metadata.screens.push({ id: "01-login", requestedPath: "/login", viewport: viewport.label, status: nav.status, ...metrics });
    await persistMetadata();
    console.log(`captured 01-login ${viewport.label}`);
  }
  await context.close();
}

// Authenticated admin screen set.
{
  const context = await newContext();
  const page = await context.newPage();
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
  await login(page, ADMIN_EMAIL);

  for (const screen of SCREENS.filter((item) => !item.public)) {
    for (const viewport of VIEWPORTS) {
      await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1 });
      const nav = await goto(page, screen.path);
      const metrics = await renderedMetrics(page, nav.loadMs);
      const fullPage = metrics.scrollHeight <= 16_000;
      await shot(page, `${screen.id}-${viewport.label}.png`, fullPage);
      if (!fullPage) {
        await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
        await settle(page);
        await shot(page, `${screen.id}-${viewport.label}-bottom.png`, false);
      }
      metadata.screens.push({ id: screen.id, requestedPath: screen.path, viewport: viewport.label, status: nav.status, fullPage, ...metrics });
      await persistMetadata();
      console.log(`captured ${screen.id} ${viewport.label}`);
    }
  }

  // Required alternate states: quote empty, designer empty, draft order, and a real client error.
  const stateRoutes = [
    { id: "state-quote-empty", path: "/quote" },
    { id: "state-designer-empty", path: "/designer" },
    { id: "state-order-draft", path: `/orders/${DRAFT_ORDER_ID}` },
  ];
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
  for (const state of stateRoutes) {
    const nav = await goto(page, state.path);
    const metrics = await renderedMetrics(page, nav.loadMs);
    await shot(page, `${state.id}-1280.png`, metrics.scrollHeight <= 16_000);
    metadata.states.push({ id: state.id, requestedPath: state.path, status: nav.status, ...metrics });
    await persistMetadata();
    console.log(`captured ${state.id}`);
  }

  const errorPage = await context.newPage();
  await errorPage.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
  await errorPage.setRequestInterception(true);
  errorPage.on("request", async (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/api/quote") {
      await request.respond({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Audit-injected engine outage" }) });
    } else {
      await request.continue();
    }
  });
  const nav = await goto(errorPage, QUOTE);
  await errorPage.waitForFunction(() => document.body.innerText.includes("Quote failed"), { timeout: 20_000 }).catch(() => {});
  const metrics = await renderedMetrics(errorPage, nav.loadMs);
  await shot(errorPage, "state-quote-error-1280.png", metrics.scrollHeight <= 16_000);
  metadata.states.push({ id: "state-quote-error", requestedPath: QUOTE, status: nav.status, injected: "POST /api/quote -> 503", ...metrics });
  await persistMetadata();
  console.log("captured state-quote-error");

  await context.close();
}

// Customer-role comparison and permission-boundary checks.
{
  const context = await newContext();
  const page = await context.newPage();
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
  await login(page, CUSTOMER_EMAIL);
  for (const check of [
    { id: "customer-dashboard", path: "/" },
    { id: "customer-orders", path: "/orders" },
    { id: "customer-admin-attempt", path: "/admin" },
  ]) {
    const nav = await goto(page, check.path);
    if (check.id === "customer-admin-attempt") {
      await page.waitForFunction(() => location.pathname === "/", { timeout: 20_000 }).catch(() => {});
      await settle(page);
    }
    const metrics = await renderedMetrics(page, nav.loadMs);
    await shot(page, `${check.id}-1280.png`, metrics.scrollHeight <= 16_000);
    await new Promise((resolve) => setTimeout(resolve, 500));
    const navLabels = await page.evaluate(() => [...document.querySelectorAll("nav a")].map((a) => a.textContent?.trim()).filter(Boolean)).catch(() => []);
    metadata.roleChecks.push({ id: check.id, requestedPath: check.path, status: nav.status, navLabels, ...metrics });
    await persistMetadata();
    console.log(`captured ${check.id}`);
  }
  await context.close();
}

await persistMetadata();
await browser.close();
console.log(`wrote ${metadata.screens.length} viewport captures, ${metadata.states.length} state captures, and ${metadata.roleChecks.length} role checks`);
