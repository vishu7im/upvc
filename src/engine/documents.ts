// =====================================================================
// engine/documents.ts — HTML renderers for the four shop-floor docs.
//
// Outputs follow Quotila's column layout so the shop floor sees
// familiar paperwork. To turn these into PDFs, pipe them through
// Puppeteer or Playwright — the HTML is already print-ready.
// =====================================================================

import type { QuoteInput, SolvedParts, CuttingPlan, Pricing, SolvedGeometry, ProfileSystem, DocBranding, DocImage, DocCill, BarPiece } from "../types.ts";

const STYLE = `
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 12px; color: #28323c; margin: 32px; }
  h1   { font-size: 18px; text-align: center; margin: 0 0 12px; letter-spacing: 0.04em; }
  .header { display: grid; grid-template-columns: 80px 1fr 80px 1fr; gap: 4px 12px; border: 1px solid #28323c; padding: 8px 12px; margin-bottom: 16px; }
  .header b { color: #555; font-weight: normal; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th, td { padding: 4px 6px; text-align: left; border-bottom: 1px solid #ddd; font-size: 11.5px; vertical-align: top; }
  thead th { background: #f1f3f5; border-bottom: 2px solid #28323c; }
  .right { text-align: right; }
  .section-title { font-weight: bold; background: #eef0f3; padding: 4px 6px; border-top: 1px solid #28323c; }
  .totals td { border: none; padding: 3px 6px; }
  .totals .grand td { border-top: 2px solid #28323c; font-weight: bold; font-size: 13px; padding-top: 6px; }
  .meta { margin-bottom: 12px; font-size: 11px; color: #555; }
  .previews { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
  .preview { margin: 0; border: 1px solid #ccd2d8; border-radius: 6px; padding: 8px; background: #fafbfc; text-align: center; }
  .preview .preview-svg { width: 180px; height: 150px; display: flex; align-items: center; justify-content: center; }
  .preview .preview-svg svg { max-width: 100%; max-height: 100%; }
  .preview figcaption { margin-top: 5px; font-size: 10.5px; color: #555; }
`;

/**
 * Cut-length variant for the length-bearing docs:
 *   "normal" → finished sizes (BarPiece.extMm)         — default, byte-identical
 *   "welded" → sizes WITH welding-shrinkage allowance (BarPiece.weldedExtMm)
 */
export type DocVariant = "normal" | "welded";

/** Pick the length column to print for the chosen variant. */
function barLen(b: { extMm: number; weldedExtMm?: number }, variant: DocVariant): number {
  return variant === "welded" ? b.weldedExtMm ?? b.extMm : b.extMm;
}

/** A banner clarifying that welded lengths already include the weld allowance. */
function weldNote(variant: DocVariant): string {
  if (variant !== "welded") return "";
  return `<div class="meta weld-note" style="border-left:3px solid #b45309;background:#fffbeb;padding:6px 10px;color:#92400e;">
    <b>Welded cut list.</b> Lengths below INCLUDE the welding-shrinkage allowance — cut bars to these sizes.
    After welding, the finished assembly returns to the ordered dimensions.
  </div>`;
}

/** " (Welded)" suffix on titles so the two printouts can't be mixed up. */
function variantSuffix(variant: DocVariant): string {
  return variant === "welded" ? " (Welded)" : "";
}

/**
 * Club identical bar pieces into quantity rows. Two pieces club when they share
 * profile, internal length, end-prep, orientation, reinforcement AND the printed
 * length (`len`, which is Ext for Normal / weldedExt for Welded). So a square
 * frame's 4 bars become 2 rows × qty 2 (one H, one V); the cut count is unchanged.
 */
function groupBars(
  pieces: BarPiece[],
  len: (b: BarPiece) => number,
): { piece: BarPiece; lenMm: number; qty: number }[] {
  const map = new Map<string, { piece: BarPiece; lenMm: number; qty: number }>();
  for (const b of pieces) {
    const L = len(b);
    const key = `${b.code}|${b.name}|${b.intMm}|${L}|${b.endPrep}|${b.orientation}|${b.reinforcementCode ?? ""}|${b.reinforcementLengthMm ?? ""}`;
    const slot = map.get(key) ?? { piece: b, lenMm: L, qty: 0 };
    slot.qty++;
    map.set(key, slot);
  }
  return [...map.values()];
}

/** True when any branding field is set (otherwise we render the plain header). */
function hasBranding(b?: DocBranding): b is DocBranding {
  return Boolean(b && (b.companyName || b.address || b.logoDataUri || b.accentColor));
}

/** Extra CSS injected only when branding is present (keeps un-branded output unchanged). */
function brandCss(b: DocBranding): string {
  const accent = b.accentColor || "#28323c";
  return `
  h1 { color: ${accent}; }
  .brandbar { display: flex; align-items: center; gap: 14px; border-bottom: 2px solid ${accent}; padding-bottom: 8px; margin-bottom: 12px; }
  .brandbar img.logo { max-height: 52px; max-width: 200px; object-fit: contain; }
  .brandbar .cname { font-size: 15px; font-weight: bold; color: ${accent}; }
  .brandbar .caddr { font-size: 10.5px; color: #555; white-space: pre-line; }
`;
}

/** The company branding band — only rendered when branding is configured. */
function brandBar(b?: DocBranding): string {
  if (!hasBranding(b)) return "";
  const logo = b.logoDataUri ? `<img class="logo" src="${b.logoDataUri}" alt="logo">` : "";
  const name = b.companyName ? `<div class="cname">${esc(b.companyName)}</div>` : "";
  const addr = b.address ? `<div class="caddr">${esc(b.address)}</div>` : "";
  const company = name || addr ? `<div class="company">${name}${addr}</div>` : "";
  return `<div class="brandbar">${logo}${company}</div>`;
}

/**
 * Design-preview band: one inline SVG card per supplied image. Order documents
 * pass catalog previews so this matches the product gallery/configurator; engine
 * SVG is still valid fallback markup. Absent/empty ⇒ nothing rendered.
 */
function previewBand(images?: DocImage[]): string {
  if (!images || images.length === 0) return "";
  const cards = images.map((im) => `
      <figure class="preview">
        <div class="preview-svg">${im.svg}</div>
        <figcaption>${esc(im.caption)}</figcaption>
      </figure>`).join("");
  return `<div class="previews">${cards}</div>`;
}

/**
 * Cill header rows. Only rendered when a cill is selected: shows the cill name
 * and the reduced manufacturing height (the "Width × Height" row above keeps the
 * unchanged customer dimensions). Absent ⇒ "" (byte-identical header).
 */
function cillRows(cill?: DocCill): string {
  if (!cill) return "";
  return `
      <b>Cill:</b><span>${esc(cill.name)}</span>
      <b>Mfg. Height:</b><span>${cill.manufacturingHeightMm} mm</span>`;
}

function header(input: QuoteInput, title: string, systemName: string, designName: string, branding?: DocBranding, images?: DocImage[], cill?: DocCill): string {
  const today = new Date().toLocaleDateString("en-GB");
  return `
    ${brandBar(branding)}
    <h1>${title}</h1>
    <div class="header">
      <b>Customer:</b><span>${esc(input.customer)}</span>
      <b>Job No:</b><span>${esc(input.orderNo)}</span>
      <b>Reference:</b><span>${esc(input.reference ?? "")}</span>
      <b>Print Date:</b><span>${today}</span>
      <b>System:</b><span>${esc(systemName)}</span>
      <b>Design:</b><span>${esc(designName)}</span>
      <b>Width × Height:</b><span>${input.widthMm > 0 && input.heightMm > 0 ? `${input.widthMm} × ${input.heightMm} mm` : "—"}</span>
      <b>Quote#:</b><span>${esc(input.orderNo)}</span>${cillRows(cill)}
    </div>
    ${previewBand(images)}
  `;
}

// ---------- WORK ORDER ----------------------------------------------
export function renderWorkOrder(
  input: QuoteInput,
  systemName: string,
  designName: string,
  parts: SolvedParts,
  branding?: DocBranding,
  images?: DocImage[],
  variant: DocVariant = "normal",
  cill?: DocCill,
): string {
  // Club identical pieces into qty rows (e.g. a frame's 4 bars → 2 rows × qty 2).
  const len = (b: BarPiece) => barLen(b, variant);
  const sectionsRow = groupBars(parts.bars, len).map(({ piece: b, lenMm, qty }) => `
    <tr>
      <td>${b.orientation === "H" ? "Hor" : "Vert"}</td>
      <td>${section(b)}</td>
      <td>${esc(b.name)}</td>
      <td class="right">${qty}</td>
      <td class="right">${lenMm}</td>
      <td>${b.endPrep}</td>
      <td>${b.reinforcementCode ? esc(b.reinforcementCode) : ""}</td>
      <td class="right">${b.reinforcementLengthMm ?? ""}</td>
    </tr>
  `).join("");

  const reinfRow = groupBars(parts.reinforcement, len).map(({ piece: r, lenMm, qty }) => `
    <tr>
      <td>${r.orientation === "H" ? "Hor" : "Vert"}</td>
      <td>Sash</td>
      <td>${esc(r.name)}</td>
      <td class="right">${qty}</td>
      <td class="right">${lenMm}</td>
      <td>${r.endPrep}</td>
      <td></td>
      <td></td>
    </tr>
  `).join("");

  const hwRow = parts.hardware.map((h) => `
    <tr>
      <td>${esc(h.name)}</td>
      <td class="right">${h.qty}</td>
      <td>${h.code.startsWith("GKT") ? "Metres" : "Unit"}</td>
    </tr>
  `).join("");
  const gasketRow = parts.gaskets.map((g) => `
    <tr>
      <td>${esc(g.name)}</td>
      <td class="right">${g.lengthMm}</td>
      <td>Metres</td>
    </tr>
  `).join("");

  const glassRow = parts.glass.map((g) => `
    <tr>
      <td>${esc(g.label)} ${esc(g.name)}</td>
      <td class="right">1</td>
      <td class="right">${g.widthMm}</td>
      <td class="right">${g.heightMm}</td>
    </tr>
  `).join("");

  return wrap("Work Order" + variantSuffix(variant), `
    ${header(input, "WORK ORDER" + variantSuffix(variant).toUpperCase(), systemName, designName, branding, images, cill)}
    ${weldNote(variant)}

    <div class="section-title">Sections Required</div>
    <table>
      <thead>
        <tr><th>H/V</th><th>Section</th><th>Description</th><th class="right">Qty</th><th class="right">Length</th><th>End Prep</th><th>Reinforcing</th><th class="right">Reinf Length</th></tr>
      </thead>
      <tbody>${sectionsRow}${reinfRow}</tbody>
    </table>

    <div class="section-title">Accessories Required</div>
    <table>
      <thead><tr><th>Description</th><th class="right">Qty</th><th>Unit Of Measurement</th></tr></thead>
      <tbody>${hwRow}${gasketRow}</tbody>
    </table>

    <div class="section-title">Glass Required</div>
    <table>
      <thead><tr><th>Description</th><th class="right">Qty</th><th class="right">Width</th><th class="right">Length</th></tr></thead>
      <tbody>${glassRow}</tbody>
    </table>
  `, branding);
}

// ---------- CUTTING LIST --------------------------------------------
export function renderCuttingList(
  input: QuoteInput,
  systemName: string,
  designName: string,
  parts: SolvedParts,
  branding?: DocBranding,
  images?: DocImage[],
  variant: DocVariant = "normal",
  cill?: DocCill,
): string {
  // Group by section description (matches Quotila — one table per profile).
  const all = [...parts.bars, ...parts.reinforcement];
  const groups = new Map<string, typeof all>();
  for (const b of all) {
    if (!groups.has(b.name)) groups.set(b.name, []);
    groups.get(b.name)!.push(b);
  }

  const len = (b: BarPiece) => barLen(b, variant);
  const sections = Array.from(groups.entries()).map(([name, list], idx) => {
    // Club identical pieces in this profile group into qty rows.
    const rows = groupBars(list, len).map(({ piece: b, lenMm, qty }) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${section(b)}</td>
        <td>${esc(b.name)}</td>
        <td class="right">${qty}</td>
        <td class="right">${b.intMm}</td>
        <td class="right">${lenMm}</td>
        <td>${b.orientation === "H" ? "Hor" : "Vert"}</td>
        <td>${b.endPrep}</td>
      </tr>
    `).join("");
    const extHeader = variant === "welded" ? "Length Ext (welded)" : "Length Ext";
    return `
      <div class="section-title">${esc(name)}</div>
      <table>
        <thead><tr><th>Item</th><th>Section</th><th>Description</th><th class="right">Qty</th><th class="right">Length Int</th><th class="right">${extHeader}</th><th>H/V</th><th>End Prep</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }).join("");

  return wrap("Cutting List" + variantSuffix(variant), `
    ${header(input, "CUTTING LIST" + variantSuffix(variant).toUpperCase(), systemName, designName, branding, images, cill)}
    ${weldNote(variant)}
    ${sections}
  `, branding);
}

// ---------- BOM (Bill of Materials) ---------------------------------
export function renderBom(
  input: QuoteInput,
  systemName: string,
  designName: string,
  pricing: Pricing,
  branding?: DocBranding,
  images?: DocImage[],
  cill?: DocCill,
): string {
  // Group by financial category to mirror your spec.
  const byCat = new Map<string, typeof pricing.lines>();
  for (const l of pricing.lines) {
    if (!byCat.has(l.category)) byCat.set(l.category, []);
    byCat.get(l.category)!.push(l);
  }

  const sections = Array.from(byCat.entries()).map(([cat, lines]) => {
    const rows = lines.map((l) => `
      <tr>
        <td>${esc(l.code)}</td>
        <td>${esc(l.description)}</td>
        <td class="right">${l.qty}</td>
        <td>${l.unit}</td>
        <td class="right">${l.unitCost.toFixed(2)}</td>
        <td class="right">${l.unitPrice.toFixed(2)}</td>
        <td class="right">${l.totalCost.toFixed(2)}</td>
        <td class="right">${l.totalPrice.toFixed(2)}</td>
      </tr>
    `).join("");
    return `
      <div class="section-title">${esc(cat)}</div>
      <table>
        <thead><tr><th>Code</th><th>Description</th><th class="right">Qty</th><th>Unit</th><th class="right">Unit Cost</th><th class="right">Unit Price</th><th class="right">Total Cost</th><th class="right">Total Price</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }).join("");

  return wrap("Bill of Materials", `
    ${header(input, "BILL OF MATERIALS", systemName, designName, branding, images, cill)}
    ${sections}
  `, branding);
}

// ---------- PRICE SUMMARY -------------------------------------------
export function renderPriceSummary(
  input: QuoteInput,
  systemName: string,
  designName: string,
  pricing: Pricing,
  branding?: DocBranding,
  images?: DocImage[],
  cill?: DocCill,
): string {
  const T = pricing.totals;
  const c = pricing.currency === "GBP" ? "£" : pricing.currency + " ";
  return wrap("Price Summary", `
    ${header(input, "PRICE SUMMARY", systemName, designName, branding, images, cill)}

    <table class="totals">
      <tbody>
        <tr><td>Material Cost (factory)</td><td class="right">${c}${T.materialCost.toFixed(2)}</td></tr>
        <tr><td>Material Price (incl. wastage)</td><td class="right">${c}${T.materialPrice.toFixed(2)}</td></tr>
        <tr><td>Labour</td><td class="right">${c}${T.labour.toFixed(2)}</td></tr>
        <tr><td><b>Factory Cost</b></td><td class="right"><b>${c}${T.factoryCost.toFixed(2)}</b></td></tr>
        <tr><td>Markup</td><td class="right">${c}${T.markup.toFixed(2)}</td></tr>
        <tr><td><b>Net Price</b></td><td class="right"><b>${c}${T.netPrice.toFixed(2)}</b></td></tr>
        <tr><td>Tax (VAT)</td><td class="right">${c}${T.tax.toFixed(2)}</td></tr>
        <tr class="grand"><td>GRAND TOTAL</td><td class="right">${c}${T.grandTotal.toFixed(2)}</td></tr>
      </tbody>
    </table>
  `, branding);
}

// ---------- WORK PLANNER --------------------------------------------
// A per-station task list for the shop floor: saw → reinforce → weld →
// glaze → accessories. Derived entirely from the solved parts.
export function renderWorkPlanner(
  input: QuoteInput,
  systemName: string,
  designName: string,
  parts: SolvedParts,
  branding?: DocBranding,
  images?: DocImage[],
  variant: DocVariant = "normal",
): string {
  // Group identical cut pieces (same code + length + end-prep) into a qty.
  // Key/print on the chosen variant's length so welded pieces of the same
  // finished size but different weld counts don't wrongly collapse together.
  const lenSel = (p: { extMm: number; weldedExtMm?: number }) => barLen(p, variant);
  const cut = groupPieces(parts.bars, lenSel);
  const reinf = groupPieces(parts.reinforcement, lenSel);

  const cutRows = cut.map((g, i) => `
    <tr><td>${i + 1}</td><td>${section({ name: g.name })}</td><td>${esc(g.name)}</td>
        <td class="right">${g.qty}</td><td class="right">${g.extMm}</td><td>${g.endPrep}</td><td></td></tr>
  `).join("");

  const reinfRows = reinf.map((g, i) => `
    <tr><td>${i + 1}</td><td>${esc(g.name)}</td><td class="right">${g.qty}</td><td class="right">${g.extMm}</td><td></td></tr>
  `).join("");

  const frameWelds = parts.bars.filter((b) => /frame/i.test(b.name)).length;
  const sashWelds = parts.bars.filter((b) => /sash/i.test(b.name) && !/reinf/i.test(b.name)).length;
  const weldRows = `
    <tr><td>Weld &amp; clean outer frame corners</td><td class="right">${frameWelds}</td><td></td></tr>
    <tr><td>Weld &amp; clean sash corners</td><td class="right">${sashWelds}</td><td></td></tr>
  `;

  const glazeRows = parts.glass.map((g, i) => `
    <tr><td>${i + 1}</td><td>${esc(g.label)} ${esc(g.name)}</td><td class="right">${g.widthMm} × ${g.heightMm}</td><td></td></tr>
  `).join("");

  const accRows = [
    ...parts.hardware.map((h) => `<tr><td>${esc(h.name)}</td><td class="right">${h.qty}</td><td>Unit</td><td></td></tr>`),
    ...parts.gaskets.map((g) => `<tr><td>${esc(g.name)}</td><td class="right">${g.lengthMm}</td><td>Metres</td><td></td></tr>`),
  ].join("");

  return wrap("Work Planner" + variantSuffix(variant), `
    ${header(input, "WORK PLANNER" + variantSuffix(variant).toUpperCase(), systemName, designName, branding, images)}
    ${weldNote(variant)}

    <div class="section-title">Station 1 — Cutting (Saw)</div>
    <table><thead><tr><th>#</th><th>Section</th><th>Profile</th><th class="right">Qty</th><th class="right">Cut Length</th><th>End Prep</th><th>Done</th></tr></thead>
      <tbody>${cutRows}</tbody></table>

    <div class="section-title">Station 2 — Reinforcement</div>
    <table><thead><tr><th>#</th><th>Reinforcement</th><th class="right">Qty</th><th class="right">Length</th><th>Done</th></tr></thead>
      <tbody>${reinfRows || `<tr><td colspan="5">None</td></tr>`}</tbody></table>

    <div class="section-title">Station 3 — Welding &amp; Assembly</div>
    <table><thead><tr><th>Task</th><th class="right">Corners</th><th>Done</th></tr></thead>
      <tbody>${weldRows}</tbody></table>

    <div class="section-title">Station 4 — Glazing</div>
    <table><thead><tr><th>#</th><th>Glass</th><th class="right">Size (mm)</th><th>Done</th></tr></thead>
      <tbody>${glazeRows}</tbody></table>

    <div class="section-title">Station 5 — Accessories &amp; Hardware</div>
    <table><thead><tr><th>Item</th><th class="right">Qty</th><th>Unit</th><th>Done</th></tr></thead>
      <tbody>${accRows}</tbody></table>
  `, branding);
}

// ---------- DMO (Despatch / Material Output) ------------------------
// A material movement / despatch summary: every material leaving stores,
// grouped by financial category, with quantities (no pricing).
export function renderDmo(
  input: QuoteInput,
  systemName: string,
  designName: string,
  pricing: Pricing,
  branding?: DocBranding,
  images?: DocImage[],
): string {
  const byCat = new Map<string, typeof pricing.lines>();
  for (const l of pricing.lines) {
    if (!byCat.has(l.category)) byCat.set(l.category, []);
    byCat.get(l.category)!.push(l);
  }
  const sections = Array.from(byCat.entries()).map(([cat, lines]) => {
    const rows = lines.map((l) => `
      <tr><td>${esc(l.code)}</td><td>${esc(l.description)}</td><td class="right">${l.qty}</td><td>${l.unit}</td><td></td></tr>
    `).join("");
    return `
      <div class="section-title">${esc(cat)}</div>
      <table><thead><tr><th>Code</th><th>Description</th><th class="right">Qty Issued</th><th>Unit</th><th>Picked</th></tr></thead>
        <tbody>${rows}</tbody></table>`;
  }).join("");

  return wrap("DMO — Despatch / Material Output", `
    ${header(input, "DMO — DESPATCH / MATERIAL OUTPUT", systemName, designName, branding, images)}
    <div class="meta">Materials issued from stores for this order. Tick each line as picked.</div>
    ${sections}
  `, branding);
}

// ---------- PLANNER LIST --------------------------------------------
// Order-level summary: one row per order line (design, size, qty, price).
export interface PlannerLine {
  lineNo: number;
  productName: string;
  designName: string;
  widthMm: number;
  heightMm: number;
  qty: number;
  mode: string;
  totalPrice: number;
}
export function renderPlannerList(
  input: QuoteInput,
  systemName: string,
  lines: PlannerLine[],
  currency: string,
  branding?: DocBranding,
  images?: DocImage[],
): string {
  const c = currency === "GBP" ? "£" : currency + " ";
  const rows = lines.map((l) => `
    <tr>
      <td>${l.lineNo}</td>
      <td>${esc(l.productName)}</td>
      <td>${esc(l.designName)}</td>
      <td class="right">${l.widthMm} × ${l.heightMm}</td>
      <td class="right">${l.qty}</td>
      <td>${esc(l.mode)}</td>
      <td class="right">${c}${l.totalPrice.toFixed(2)}</td>
    </tr>
  `).join("");
  const grand = lines.reduce((s, l) => s + l.totalPrice, 0);

  return wrap("Planner List", `
    ${header(input, "PLANNER LIST", systemName, `${lines.length} line(s)`, branding, images)}
    <table>
      <thead><tr><th>#</th><th>Product</th><th>Design</th><th class="right">Size (mm)</th><th class="right">Qty</th><th>Mode</th><th class="right">Line Total</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="6" class="right"><b>Order Total</b></td><td class="right"><b>${c}${grand.toFixed(2)}</b></td></tr></tfoot>
    </table>
  `, branding);
}

// ---------- helpers --------------------------------------------------
/**
 * Group identical bar pieces by name+length+endPrep into a single qty row.
 * `len` selects which length to group/print on (default extMm = finished size);
 * the welded planner passes weldedExtMm so it groups on the compensated length.
 * The returned `extMm` field carries whichever length was selected.
 */
function groupPieces(
  pieces: { name: string; extMm: number; weldedExtMm?: number; endPrep: string }[],
  len: (p: { extMm: number; weldedExtMm?: number }) => number = (p) => p.extMm,
) {
  const map = new Map<string, { name: string; extMm: number; endPrep: string; qty: number }>();
  for (const p of pieces) {
    const L = len(p);
    const key = `${p.name}|${L}|${p.endPrep}`;
    const slot = map.get(key) ?? { name: p.name, extMm: L, endPrep: p.endPrep, qty: 0 };
    slot.qty++;
    map.set(key, slot);
  }
  return Array.from(map.values());
}

function wrap(title: string, body: string, branding?: DocBranding): string {
  const extra = hasBranding(branding) ? brandCss(branding) : "";
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${STYLE}${extra}</style></head><body>${body}</body></html>`;
}
function esc(s: string): string {
  return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[m]);
}
function section(b: any): string {
  const n = b.name as string;
  if (n.toLowerCase().includes("bead")) return "Bead";
  if (n.toLowerCase().includes("frame") || n.toLowerCase().includes("transom") || n.toLowerCase().includes("mullion") || n.toLowerCase().includes("chasement")) return "Frame";
  if (n.toLowerCase().includes("sash")) return "Sash";
  if (n.toLowerCase().includes("reinf")) return "Reinf";
  return "—";
}
