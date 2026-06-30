// =====================================================================
// catalog/index.ts — single import point for the catalog.
//
// The catalog now lives in PostgreSQL. Call `loadCatalog()` once during
// bootstrap (see src/api/server.ts and src/validation/jobs.ts); after
// that these synchronous accessors serve from the in-memory cache, so
// the engine and solve() consume the catalog exactly as before.
//
// The hardcoded TypeScript catalog (system-sunnyplast.ts, designs.ts,
// settings.ts) is retained as the SEED source of truth (prisma/seed.ts).
// =====================================================================

export {
  loadCatalog,
  refreshSystemCatalog,
  getSystem,
  getDesign,
  listSystems,
  listDesigns,
  DEFAULT_SETTINGS,
} from "./loader.ts";
