// =====================================================================
// api/catalog-assets.ts — serving a picture for a hardware part.
//
// Two layers, resolved in this order:
//   1. an admin-uploaded product photo in object storage, and
//   2. the deterministic SVG glyph drawn by src/catalog/glyphs.ts.
//
// Key EXISTENCE is the override — the same "deterministic key IS the cache"
// trick the PDF routes and the branding logo already use — so an uploaded photo
// needs no column, no migration and no reseed. Storage being unavailable is
// non-fatal: the glyph still renders, exactly as a missing logo is non-fatal
// for documents.
//
// Public, like GET /api/branding/logo: a browser <img> must load it without a
// bearer token, and it carries no cost data.
// =====================================================================

import { Router } from "express";
import { hardwareGlyph } from "../catalog/glyphs.ts";
import { getSystem, listSystems } from "../catalog/index.ts";
import { asyncHandler, HttpError } from "./http.ts";
import { getObject, objectExists, storageConfigured } from "../services/storage.ts";

/** Deterministic object key for one hardware part's uploaded photo. */
export function hardwareAssetKey(partKey: string): string {
  return `catalog/hardware/${partKey}`;
}

export const catalogAssetsRouter = Router();

catalogAssetsRouter.get(
  "/hardware/:partKey",
  asyncHandler(async (req, res) => {
    const { partKey } = req.params;

    if (storageConfigured()) {
      const key = hardwareAssetKey(partKey);
      // A storage outage must not blank every picker tile, so a failed lookup
      // falls through to the glyph rather than 500ing.
      let uploaded = false;
      try {
        uploaded = await objectExists(key);
      } catch {
        uploaded = false;
      }
      if (uploaded) {
        try {
          const { body, contentType } = await getObject(key);
          res.setHeader("Content-Type", contentType);
          res.setHeader("Cache-Control", "public, max-age=300");
          res.send(body);
          return;
        } catch {
          /* fall through to the glyph */
        }
      }
    }

    // The part may live in any seeded system; the glyph depends only on its
    // name and category, so the first system that names it wins.
    const part = listSystems()
      .map((s) => getSystem(s.systemId)?.hardware?.[partKey])
      .find(Boolean);
    if (!part) throw new HttpError(404, `Unknown hardware part: ${partKey}`);

    res.setHeader("Content-Type", "image/svg+xml");
    // Generated from catalog data, so it changes only when the catalog does.
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(hardwareGlyph(part));
  }),
);
