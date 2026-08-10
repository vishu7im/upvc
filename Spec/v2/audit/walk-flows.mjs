import fs from "node:fs/promises";
import puppeteer from "puppeteer";

const BASE = "http://localhost:3000";
const CHROME = process.env.AUDIT_CHROME ?? "/home/vishal/.cache/puppeteer/chrome/linux-150.0.7871.24/chrome-linux64/chrome";
const EMAIL = process.env.AUDIT_ADMIN_EMAIL;
const PASSWORD = process.env.AUDIT_PASSWORD;

if (!EMAIL || !PASSWORD) {
  throw new Error("Set AUDIT_ADMIN_EMAIL and AUDIT_PASSWORD before walking flows.");
}
const PRODUCT_ID = "1e503ae1-b978-4dc7-8747-935423503cc9";
const CUSTOMER_ROLE_ID = "4fce44f1-132a-4c09-8d53-6db150f2bb5a";
const DRAFT_ORDER_ID = "14aa4392-6d4a-441e-b718-a9b9894e3f61";
const CONFIRMED_ORDER_ID = "ff1fe42a-759f-4789-9d96-b9e4c483a4d6";

const START_AT = process.env.AUDIT_START_AT;
const FLOW_ORDER = ["F1-header", "F2", "F1-sidebar", "F3", "F4", "F5", "F6", "F7", "F8"];
const freshReport = {
  generatedAt: new Date().toISOString(),
  method: "One instrumented evaluator walkthrough in headless Chromium at 1280x900. Durations include configured-network and render time; they are evidence of this run, not a user-study average. Commit/destructive controls were counted but not submitted against the shared owner database.",
  flows: [],
};
const report = START_AT
  ? JSON.parse(await fs.readFile("Spec/v2/audit/flow-walks.json", "utf8"))
  : freshReport;
if (START_AT) {
  const startIndex = FLOW_ORDER.indexOf(START_AT);
  report.flows = report.flows.filter((flow) => FLOW_ORDER.indexOf(flow.id) < startIndex);
}
const shouldRun = (id) => !START_AT || FLOW_ORDER.indexOf(id) >= FLOW_ORDER.indexOf(START_AT);

async function persist() {
  await fs.writeFile("Spec/v2/audit/flow-walks.json", JSON.stringify(report, null, 2) + "\n");
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const context = await browser.createBrowserContext();
const page = await context.newPage();
await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });

async function settle(ms = 700) {
  await page.evaluate(async () => { if (document.fonts?.ready) await document.fonts.ready; }).catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function login() {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle2", timeout: 60_000 });
  const status = await page.evaluate(async ({ email, password }) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    return response.status;
  }, { email: EMAIL, password: PASSWORD });
  if (status !== 200) throw new Error(`login failed: ${status}`);
}

async function go(route) {
  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle2", timeout: 90_000 });
  await settle();
}

async function elementByText(selector, text, exact = true) {
  await page.waitForFunction(({ selector, text, exact }) => {
    return [...document.querySelectorAll(selector)].some((node) => {
      const value = (node.textContent ?? "").replace(/\s+/g, " ").trim();
      const rect = node.getBoundingClientRect();
      const visible = rect.width > 0 && rect.height > 0 && getComputedStyle(node).visibility !== "hidden";
      return visible && (exact ? value === text : value.includes(text));
    });
  }, { timeout: 90_000 }, { selector, text, exact });
  const handle = await page.evaluateHandle(({ selector, text, exact }) => {
    const nodes = [...document.querySelectorAll(selector)];
    return nodes.find((node) => {
      const value = (node.textContent ?? "").replace(/\s+/g, " ").trim();
      const rect = node.getBoundingClientRect();
      const visible = rect.width > 0 && rect.height > 0 && getComputedStyle(node).visibility !== "hidden";
      return visible && (exact ? value === text : value.includes(text));
    }) ?? null;
  }, { selector, text, exact });
  const element = handle.asElement();
  if (!element) {
    await handle.dispose();
    throw new Error(`No ${selector} with text ${JSON.stringify(text)} at ${page.url()}`);
  }
  return element;
}

async function clickText(selector, text, { exact = true, waitForUrlChange = false, waitForText } = {}) {
  const before = page.url();
  const element = await elementByText(selector, text, exact);
  const started = Date.now();
  await element.click();
  await element.dispose();
  if (waitForUrlChange) {
    await page.waitForFunction((url) => location.href !== url, { timeout: 90_000 }, before);
  }
  if (waitForText) {
    await page.waitForFunction((value) => document.body.innerText.includes(value), { timeout: 90_000 }, waitForText);
  }
  await settle();
  return { from: new URL(before).pathname + new URL(before).search, to: new URL(page.url()).pathname + new URL(page.url()).search, elapsedMs: Date.now() - started, label: text };
}

async function clickHref(selector) {
  const before = page.url();
  await page.waitForSelector(selector, { timeout: 90_000 });
  const element = await page.$(selector);
  if (!element) throw new Error(`No link ${selector} at ${before}`);
  const label = await element.evaluate((node) => (node.textContent ?? "").replace(/\s+/g, " ").trim());
  const started = Date.now();
  await element.click();
  await element.dispose();
  await page.waitForFunction((url) => location.href !== url, { timeout: 90_000 }, before);
  await settle();
  return { from: new URL(before).pathname + new URL(before).search, to: new URL(page.url()).pathname + new URL(page.url()).search, elapsedMs: Date.now() - started, label };
}

async function inputByLabel(label, value) {
  const handle = await page.evaluateHandle((label) => {
    const wanted = label.toLowerCase();
    const node = [...document.querySelectorAll("label")].find((item) => (item.innerText ?? "").split("\n")[0].trim().toLowerCase() === wanted);
    return node?.querySelector("input,select,textarea") ?? null;
  }, label);
  const element = handle.asElement();
  if (!element) {
    await handle.dispose();
    throw new Error(`No input labelled ${label} at ${page.url()}`);
  }
  const tag = await element.evaluate((node) => node.tagName);
  if (tag === "SELECT") {
    await element.select(value);
  } else {
    await element.click({ clickCount: 3 });
    await page.keyboard.press("Backspace");
    await element.type(String(value));
  }
  await element.dispose();
}

function begin(id, task) {
  return { id, task, startedAt: new Date().toISOString(), startedMs: Date.now(), navigationalClicks: 0, actionClicks: 0, formInteractions: 0, steps: [], notes: [] };
}

async function finish(flow) {
  flow.durationMs = Date.now() - flow.startedMs;
  delete flow.startedMs;
  flow.finalPath = new URL(page.url()).pathname + new URL(page.url()).search;
  report.flows.push(flow);
  await persist();
  console.log(`${flow.id}: ${flow.navigationalClicks} nav + ${flow.actionClicks} action clicks in ${flow.durationMs} ms`);
}

async function navStep(flow, promise) {
  const step = await promise;
  flow.navigationalClicks += 1;
  flow.steps.push(step);
}

async function actionStep(flow, promise) {
  const step = await promise;
  flow.actionClicks += 1;
  flow.steps.push(step);
}

await login();

// F1 + F2, header CTA path: deliberately follow the prominent route, including its empty-state backtrack.
if (shouldRun("F1-header")) {
  const flow = begin("F1-header", "Quote a standard window via the header CTA");
  await go("/");
  await navStep(flow, clickText("header a", "Quick quote", { waitForUrlChange: true }));
  flow.notes.push("The first destination was an empty state instructing the evaluator to browse products.");
  await navStep(flow, clickText("main a", "Browse products", { waitForUrlChange: true }));
  await navStep(flow, clickHref('main a[href^="/products/"]'));
  await navStep(flow, clickText("main a", "Configure", { waitForUrlChange: true }));
  await page.waitForFunction(() => document.body.innerText.includes("Valid configuration"), { timeout: 90_000 });
  await inputByLabel("Width", 1200);
  await inputByLabel("Height", 1200);
  await inputByLabel("Customer", "UX Audit Header 20260807");
  await inputByLabel("Qty", 1);
  flow.formInteractions += 4;
  const createButton = await elementByText("main button", "Create order");
  await createButton.dispose();
  const createStep = { from: new URL(page.url()).pathname + new URL(page.url()).search, to: "/orders/[new-id]", elapsedMs: null, label: "Create order (counted, not submitted against shared data)" };
  flow.navigationalClicks += 1;
  flow.steps.push(createStep);
  flow.notes.push("The terminal Create order control was present and enabled; it was counted but not submitted against the shared owner database.");
  flow.screensVisited = 5;
  flow.scrollScreens = 0;
  await finish(flow);

  const f2 = begin("F2", "Turn the configured quote into an order");
  f2.navigationalClicks = 1;
  f2.formInteractions = 2;
  f2.steps = [createStep];
  f2.screensVisited = 1;
  f2.notes.push("Measured as the final Customer/Qty + Create order portion of F1.");
  await finish(f2);
}

// F1 alternate, shorter sidebar path.
if (shouldRun("F1-sidebar")) {
  const flow = begin("F1-sidebar", "Quote a standard window via Products in the sidebar");
  await go("/");
  await navStep(flow, clickText("nav a", "Products", { waitForUrlChange: true }));
  await navStep(flow, clickHref('main a[href^="/products/"]'));
  await navStep(flow, clickText("main a", "Configure", { waitForUrlChange: true }));
  await page.waitForFunction(() => document.body.innerText.includes("Valid configuration"), { timeout: 90_000 });
  await inputByLabel("Width", 1200);
  await inputByLabel("Height", 1200);
  await inputByLabel("Customer", "UX Audit Sidebar 20260807");
  await inputByLabel("Qty", 1);
  flow.formInteractions += 4;
  const createButton = await elementByText("main button", "Create order");
  await createButton.dispose();
  flow.navigationalClicks += 1;
  flow.steps.push({ from: new URL(page.url()).pathname + new URL(page.url()).search, to: "/orders/[new-id]", elapsedMs: null, label: "Create order (counted, not submitted against shared data)" });
  flow.screensVisited = 4;
  flow.scrollScreens = 0;
  await finish(flow);
}

// F3: the gallery path to the studio.
if (shouldRun("F3")) {
  const flow = begin("F3", "Configure a non-standard unit in the studio");
  await go("/");
  await navStep(flow, clickText("nav a", "Products", { waitForUrlChange: true }));
  await navStep(flow, clickHref('main a[href^="/products/"]'));
  await navStep(flow, clickText("main a", "Design in studio", { waitForUrlChange: true }));
  await page.waitForFunction(() => {
    const text = document.body.innerText.toLowerCase();
    const hasVisibleEdit = [...document.querySelectorAll("main button")].some((button) => {
      const rect = button.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && button.textContent?.trim() === "Edit";
    });
    return text.includes("measurements") || hasVisibleEdit;
  }, { timeout: 90_000 });
  if (!(await page.evaluate(() => document.body.innerText.toLowerCase().includes("measurements")))) {
    await actionStep(flow, clickText("main button", "Edit"));
  }
  await page.waitForFunction(() => document.body.innerText.toLowerCase().includes("measurements"), { timeout: 90_000 });
  flow.screensVisited = 3;
  flow.formInteractions = 1;
  flow.notes.push("The dashboard also exposes a Designer quick action, contrary to O-5/O-19, but it lands on an empty state because no family/design is supplied.");
  await finish(flow);
}

// F4: open the audit draft and save the commercial layer unchanged.
if (shouldRun("F4")) {
  const flow = begin("F4", "Add commercial extras and discount");
  await go("/");
  await navStep(flow, clickText("nav a", "Orders", { waitForUrlChange: true }));
  await navStep(flow, clickHref(`main a[href="/orders/${DRAFT_ORDER_ID}"]`));
  const pricing = await page.evaluateHandle(() => [...document.querySelectorAll("h2,h3")].find((node) => node.textContent?.includes("Pricing & extras")) ?? null);
  const pricingElement = pricing.asElement();
  if (pricingElement) await pricingElement.evaluate((node) => node.scrollIntoView({ block: "start" }));
  await settle();
  const scrollY = await page.evaluate(() => window.scrollY);
  flow.scrollScreens = Number((scrollY / 900).toFixed(1));
  const savePricing = await elementByText("main button", "Save pricing");
  await savePricing.dispose();
  flow.actionClicks += 1;
  flow.steps.push({ from: `/orders/${DRAFT_ORDER_ID}`, to: `/orders/${DRAFT_ORDER_ID}`, elapsedMs: null, label: "Save pricing (counted, unchanged data not submitted)" });
  flow.notes.push("Save pricing was visible and enabled; it was counted without writing to the shared order.");
  flow.formInteractions = 0;
  flow.decisionsDemanded = 6;
  flow.screensVisited = 1;
  await finish(flow);
}

// F5: confirm the audit order and open its cutting list.
if (shouldRun("F5")) {
  const flow = begin("F5", "Confirm an order and open the cutting list");
  await go("/");
  await navStep(flow, clickText("nav a", "Orders", { waitForUrlChange: true }));
  await navStep(flow, clickHref(`main a[href="/orders/${CONFIRMED_ORDER_ID}"]`));
  flow.actionClicks += 1;
  flow.steps.push({ from: `/orders/${CONFIRMED_ORDER_ID}`, to: `/orders/${CONFIRMED_ORDER_ID}`, elapsedMs: null, label: "Confirm order (counted from draft state; confirmed state inspected read-only)" });
  const card = await page.evaluateHandle(() => {
    const heading = [...document.querySelectorAll("h3")].find((node) => node.textContent?.trim() === "Cutting List");
    return heading?.closest("div.rounded-lg") ?? heading?.parentElement?.parentElement ?? null;
  });
  const cardElement = card.asElement();
  if (!cardElement) throw new Error("Cutting List card not found");
  await cardElement.evaluate((node) => node.scrollIntoView({ block: "center" }));
  const buttons = await cardElement.$$("button");
  let viewButton = null;
  for (const button of buttons) {
    if ((await button.evaluate((node) => node.textContent?.replace(/\s+/g, " ").trim())) === "View welded") {
      viewButton = button;
      break;
    }
  }
  if (!viewButton) throw new Error("Cutting List View welded button not found");
  const started = Date.now();
  await viewButton.click();
  await page.waitForSelector('[role="dialog"]', { timeout: 30_000 });
  flow.actionClicks += 1;
  flow.steps.push({ from: `/orders/${CONFIRMED_ORDER_ID}`, to: `/orders/${CONFIRMED_ORDER_ID}#cutting-list-dialog`, elapsedMs: Date.now() - started, label: "View welded" });
  const scrollY = await page.evaluate(() => window.scrollY);
  flow.scrollScreens = Number((scrollY / 900).toFixed(1));
  flow.screensVisited = 2;
  flow.notes.push("Seven document types were presented as equal cards; Cutting List was the second card in DOM order.");
  await finish(flow);
}

// F6: reopen, visit the item editor, update, and re-confirm.
if (shouldRun("F6")) {
  const flow = begin("F6", "Correct a confirmed order");
  await go("/");
  await navStep(flow, clickText("nav a", "Orders", { waitForUrlChange: true }));
  await navStep(flow, clickHref(`main a[href="/orders/${CONFIRMED_ORDER_ID}"]`));
  await actionStep(flow, clickText("main button", "Reopen for editing"));
  const reopenButton = await elementByText("main button", "Reopen order");
  await reopenButton.dispose();
  flow.actionClicks += 1;
  flow.steps.push({ from: `/orders/${CONFIRMED_ORDER_ID}`, to: `/orders/${CONFIRMED_ORDER_ID}`, elapsedMs: null, label: "Reopen order (counted, not submitted because it deletes documents)" });
  await clickText("main button", "Cancel");
  await go(`/orders/${DRAFT_ORDER_ID}`);
  await navStep(flow, clickText("main a", "Edit", { waitForUrlChange: true }));
  await page.waitForFunction(() => document.body.innerText.includes("Update item"), { timeout: 90_000 });
  const updateItem = await elementByText("main button", "Update item");
  await updateItem.dispose();
  flow.navigationalClicks += 1;
  flow.steps.push({ from: new URL(page.url()).pathname + new URL(page.url()).search, to: `/orders/${DRAFT_ORDER_ID}`, elapsedMs: null, label: "Update item (counted, not submitted)" });
  flow.actionClicks += 1;
  flow.steps.push({ from: `/orders/${DRAFT_ORDER_ID}`, to: `/orders/${DRAFT_ORDER_ID}`, elapsedMs: null, label: "Confirm order (counted, not submitted)" });
  flow.screensVisited = 3;
  flow.formInteractions = 0;
  flow.notes.push("The reopen confirmation clearly disclosed that all seven documents/PDFs are removed and regenerated later. Reopen, update, and re-confirm were counted but not submitted against shared data.");
  await finish(flow);
}

// F7: load the real catalog and save one row without changing its values.
if (shouldRun("F7")) {
  const flow = begin("F7", "Update a supplier price");
  await go("/");
  await navStep(flow, clickText("nav a", "Catalog", { waitForUrlChange: true }));
  flow.notes.push("The only seeded profile system was preselected; no system-selection click was required.");
  const firstSave = await elementByText("main button", "Save");
  await firstSave.evaluate((node) => node.scrollIntoView({ block: "center" }));
  await firstSave.dispose();
  flow.actionClicks += 1;
  flow.steps.push({ from: "/admin/catalog", to: "/admin/catalog", elapsedMs: null, label: "Save first price row (counted, not submitted)" });
  flow.notes.push("The first row's Save was visible and enabled; no supplier price write was submitted.");
  flow.screensVisited = 1;
  flow.formInteractions = 0;
  flow.scrollScreens = Number(((await page.evaluate(() => window.scrollY)) / 900).toFixed(1));
  await finish(flow);
}

// F8: add a user and assign the existing Customer role in the same inline form.
if (shouldRun("F8")) {
  const flow = begin("F8", "Add a user and grant access");
  await go("/");
  await navStep(flow, clickText("nav a", "Users", { waitForUrlChange: true }));
  await actionStep(flow, clickText("main button", "Invite user"));
  const email = "ux-audit-form-check-20260807@local.test";
  await inputByLabel("Name", "UX Audit Created User");
  await inputByLabel("Email", email);
  await inputByLabel("Temporary password", PASSWORD);
  await inputByLabel("Role", CUSTOMER_ROLE_ID);
  flow.formInteractions = 4;
  const createUser = await elementByText("main button", "Create user");
  await createUser.dispose();
  flow.actionClicks += 1;
  flow.steps.push({ from: "/admin/users", to: "/admin/users", elapsedMs: null, label: "Create user (counted, not submitted; required audit accounts already exist)" });
  flow.screensVisited = 1;
  flow.notes.push("Invite form and role assignment are inline on Users; no role-matrix screen is required when an existing role fits. The form was filled but not submitted because the two required throwaway audit users already existed.");
  await finish(flow);
}

await browser.close();
console.log("flow walkthrough complete");
