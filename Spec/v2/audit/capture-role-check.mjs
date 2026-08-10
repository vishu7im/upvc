import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";

const BASE = "http://localhost:3000";
const CHROME = process.env.AUDIT_CHROME ?? "/home/vishal/.cache/puppeteer/chrome/linux-150.0.7871.24/chrome-linux64/chrome";
const METADATA_FILE = path.resolve("Spec/v2/audit/audit-metadata.json");
const SCREEN_FILE = path.resolve("Spec/v2/audit/screens/customer-admin-attempt-1280.png");
const CUSTOMER_EMAIL = process.env.AUDIT_CUSTOMER_EMAIL;
const PASSWORD = process.env.AUDIT_PASSWORD;

if (!CUSTOMER_EMAIL || !PASSWORD) {
  throw new Error("Set AUDIT_CUSTOMER_EMAIL and AUDIT_PASSWORD before capturing the role check.");
}

const metadata = JSON.parse(await fs.readFile(METADATA_FILE, "utf8"));
metadata.roleChecks = metadata.roleChecks.filter((item) => item.id !== "customer-admin-attempt");

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const context = await browser.createBrowserContext();
const page = await context.newPage();
await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
await page.goto(`${BASE}/login`, { waitUntil: "networkidle2", timeout: 60_000 });
const status = await page.evaluate(async ({ email, password }) => {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email,
      password,
    }),
  });
  return response.status;
}, { email: CUSTOMER_EMAIL, password: PASSWORD });
if (status !== 200) throw new Error(`Customer login failed: ${status}`);

const started = Date.now();
await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForFunction(() => location.pathname === "/", { timeout: 30_000 });
await page.waitForFunction(() => document.body.innerText.includes("Welcome"), { timeout: 30_000 });
await page.waitForNetworkIdle({ idleTime: 800, timeout: 30_000 }).catch(() => {});
await new Promise((resolve) => setTimeout(resolve, 700));
const result = await page.evaluate((loadMs) => {
  const main = document.querySelector("main") ?? document.body;
  const interactive = [...main.querySelectorAll("a[href],button,input,select,textarea")].filter((el) => {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
  });
  return {
    id: "customer-admin-attempt",
    requestedPath: "/admin",
    status: 200,
    navLabels: [...document.querySelectorAll("nav a")].map((a) => a.textContent?.trim()).filter(Boolean),
    loadMs,
    finalPath: location.pathname + location.search,
    title: document.title,
    headings: [...main.querySelectorAll("h1,h2,h3")].map((el) => el.textContent?.trim()).filter(Boolean),
    controlsAtRest: interactive.filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.top < innerHeight && rect.bottom > 0 && rect.left < innerWidth && rect.right > 0;
    }).length,
    controlsTotal: interactive.length,
    tradeTerms: [],
    scrollHeight: document.documentElement.scrollHeight,
    viewportHeight: innerHeight,
    scrollScreens: Number((document.documentElement.scrollHeight / innerHeight).toFixed(1)),
    horizontalOverflowPx: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    textLength: main.innerText.trim().length,
  };
}, Date.now() - started);
await page.screenshot({ path: SCREEN_FILE, fullPage: true, type: "png" });
metadata.roleChecks.push(result);
await fs.writeFile(METADATA_FILE, JSON.stringify(metadata, null, 2) + "\n");
await browser.close();
console.log(JSON.stringify(result, null, 2));
