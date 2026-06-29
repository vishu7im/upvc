// =====================================================================
// api/server.ts — Express HTTP API.
//
// Public (stateless, for the driver UI & live preview):
//   GET  /api/systems          → list available profile systems
//   GET  /api/designs          → list quotable (engine) designs
//   POST /api/quote            → run the engine (supports mode/overrides)
//   GET  /api/quote/document   → quote, then send one document as HTML
//   GET  /                     → driver UI (public/index.html)
//
// Authenticated (JWT bearer) — the SaaS order flow:
//   /api/auth/*                → login / register / me
//   /api/products/*            → product lines + paginated design gallery
//   /api/designs/:id           → single design (incl. SVG, quotable flag)
//   /api/orders/*              → draft → items → confirm → documents
// =====================================================================

import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { solve } from "../engine/solve.ts";
import { loadCatalog, listSystems, listDesigns, getSystem } from "../catalog/index.ts";
import { prisma } from "../db/client.ts";
import { authRouter } from "./auth.ts";
import { productsRouter } from "./products.ts";
import { designsRouter } from "./designs.ts";
import { ordersRouter } from "./orders.ts";
import { settingsRouter } from "./settings.ts";
import { catalogRouter } from "./catalog.ts";
import { requireAuth } from "./middleware/auth.ts";
import { asyncHandler, HttpError, errorHandler } from "./http.ts";
import { ensureBucket, getObject, storageConfigured } from "../services/storage.ts";
import { closeBrowser } from "../services/pdf.ts";

const app = express();
app.use(express.json({ limit: "2mb" }));

// Static driver UI
const __dirname = dirname(fileURLToPath(import.meta.url));
app.use(express.static(join(__dirname, "..", "..", "public")));

// ---- Public endpoints (driver UI + live preview) --------------------

app.get("/api/systems", (_req, res) => {
  const out = listSystems().map((s) => ({
    systemId: s.systemId,
    name: s.name,
    currency: s.currency,
    stockBarLengthMm: s.stockBarLengthMm,
  }));
  res.json(out);
});

// Selectable glass + colour options for one system (U3 configurator).
// Read-only and free of supplier costs (only key/name + customer-facing colour
// uplift %), so it's public alongside /api/systems — unlike the admin catalog
// dump (/api/catalog/:id) which carries cost/price.
app.get("/api/systems/:id/options", (req, res) => {
  const sys = getSystem(req.params.id);
  if (!sys) return res.status(404).json({ error: `Unknown system: ${req.params.id}` });
  res.json({
    // Chamber options = the system's frame profiles (e.g. 5ch / 6ch).
    chambers: Object.entries(sys.frames).map(([key, f]) => ({ key, name: f.name })),
    glass: Object.entries(sys.glass).map(([key, g]) => ({ key, name: g.name })),
    colours: Object.values(sys.colours ?? {}).map((c) => ({
      key: c.key,
      name: c.name,
      priceUpliftPct: c.priceUpliftPct,
    })),
    cills: Object.values(sys.cills ?? {}).map((c) => ({
      key: c.key,
      name: c.name,
      projectionMm: c.projectionMm,
    })),
    defaultColourKey: sys.defaultColourKey ?? null,
  });
});

// Quick list of the quotable (engine) designs for the driver UI.
app.get("/api/designs", (_req, res) => {
  const out = listDesigns().map((d) => ({
    designId: d.designId,
    name: d.name,
    productType: d.productType,
    frameKey: d.frameKey,
  }));
  res.json(out);
});

// Live preview / stateless quote. Body may include mode + overrides
// (Custom mode) — they flow straight into solve().
app.post("/api/quote", (req, res) => {
  try {
    const input = req.body;
    if (!input.designId || !input.widthMm || !input.heightMm || !input.systemId) {
      return res.status(400).json({ error: "Missing designId, widthMm, heightMm, or systemId" });
    }
    if (!input.orderNo) input.orderNo = "Q-" + Date.now();
    if (!input.customer) input.customer = "Customer";
    res.json(solve(input));
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/quote/document", (req, res) => {
  try {
    const { which, ...input } = req.body;
    if (!input.orderNo) input.orderNo = "Q-" + Date.now();
    if (!input.customer) input.customer = "Customer";
    const result = solve(input);
    const html =
      which === "cuttingList"
        ? result.documents.cuttingList
        : which === "bom"
          ? result.documents.bom
          : which === "priceSummary"
            ? result.documents.priceSummary
            : result.documents.workOrder;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err: any) {
    console.error(err);
    res.status(500).send(`<pre>${err.message}</pre>`);
  }
});

// ---- Authenticated flow routers -------------------------------------

app.use("/api/auth", authRouter);
app.use("/api/products", requireAuth, productsRouter);
app.use("/api/designs", requireAuth, designsRouter); // only defines "/:id"
app.use("/api/orders", requireAuth, ordersRouter);
app.use("/api/settings", settingsRouter); // per-route admin guards inside
app.use("/api/catalog", catalogRouter); // admin-only (guards inside the router)

// Public company logo (so a browser <img> can load it without a token).
app.get(
  "/api/branding/logo",
  asyncHandler(async (_req, res) => {
    const s = await prisma.setting.findUnique({ where: { id: 1 } });
    if (!s?.logoKey) throw new HttpError(404, "No logo configured");
    const { body, contentType } = await getObject(s.logoKey);
    res.setHeader("Content-Type", contentType);
    res.send(body);
  }),
);

// Central error handler (formats HttpError + async failures). Mount last.
app.use(errorHandler);

const PORT = Number(process.env.PORT ?? 3005);

// Close the shared Puppeteer browser on shutdown.
for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    closeBrowser().finally(() => process.exit(0));
  });
}

// Load the catalog from PostgreSQL into memory BEFORE accepting requests.
loadCatalog()
  .then(async () => {
    // Ensure the object-storage bucket exists (PDF cache + logo). Non-fatal:
    // if storage is unreachable, the API still starts; PDF routes will error
    // per-request until it's back.
    if (storageConfigured()) {
      try {
        await ensureBucket();
      } catch (err) {
        console.warn("[storage] bucket not ready (PDF export unavailable):", (err as Error).message);
      }
    } else {
      console.warn("[storage] MINIO_* not configured — PDF export disabled.");
    }

    app.listen(PORT, () => {
      console.log(`uPVC engine running at http://localhost:${PORT}`);
      console.log(`  Public:  GET /api/systems · GET /api/designs · POST /api/quote`);
      console.log(`  Auth:    POST /api/auth/login`);
      console.log(`  Flow:    /api/products · /api/designs/:id · /api/orders  (Bearer token)`);
      console.log(`  Docs:    GET /api/orders/:id/documents/:type/pdf  ·  /api/settings (admin)`);
    });
  })
  .catch((err) => {
    console.error("Failed to load catalog from database:", err);
    process.exit(1);
  });
