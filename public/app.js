// Driver UI — minimal but exercises every API endpoint.
// Built to be replaced by your real SaaS frontend.

let LAST_QUOTE = null;

// ---------- Init ----------------------------------------------------
window.addEventListener("DOMContentLoaded", async () => {
  await loadSystems();
  await loadDesigns();
  hookTabs();
});

async function loadSystems() {
  const res = await fetch("/api/systems");
  const list = await res.json();
  const sel = document.getElementById("system");
  for (const s of list) {
    const opt = document.createElement("option");
    opt.value = s.systemId;
    opt.textContent = s.name;
    sel.appendChild(opt);
  }
}

async function loadDesigns() {
  const res = await fetch("/api/designs");
  const list = await res.json();
  const sel = document.getElementById("design");
  for (const d of list) {
    const opt = document.createElement("option");
    opt.value = d.designId;
    opt.textContent = d.name + (d.productType === "door" ? " (door)" : "");
    sel.appendChild(opt);
  }
  // Default to the Job 85 design for easy testing.
  sel.value = "win-th-over-fixed-z";
}

function hookTabs() {
  // Top-level tabs
  document.querySelectorAll(".tabs .tab[data-tab]").forEach((t) => {
    t.onclick = () => {
      document.querySelectorAll(".tab[data-tab]").forEach((x) => x.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((x) => x.classList.remove("active"));
      t.classList.add("active");
      document.querySelector(`.panel[data-panel="${t.dataset.tab}"]`).classList.add("active");
    };
  });
  // Document tabs
  document.querySelectorAll(".tab[data-doc]").forEach((t) => {
    t.onclick = () => {
      document.querySelectorAll(".tab[data-doc]").forEach((x) => x.classList.remove("active"));
      t.classList.add("active");
      if (LAST_QUOTE) showDocument(t.dataset.doc);
    };
  });
}

// ---------- Generate quote ------------------------------------------
async function run() {
  const status = document.getElementById("status");
  status.textContent = "Solving…";
  try {
    const body = {
      systemId: document.getElementById("system").value,
      designId: document.getElementById("design").value,
      widthMm: Number(document.getElementById("width").value),
      heightMm: Number(document.getElementById("height").value),
      customer: document.getElementById("customer").value,
      orderNo:  document.getElementById("orderNo").value,
    };
    const res = await fetch("/api/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Unknown error");
    }
    LAST_QUOTE = await res.json();
    render(LAST_QUOTE);
    status.textContent = `OK — ${LAST_QUOTE.parts.bars.length} bars, ${LAST_QUOTE.parts.glass.length} glass, £${LAST_QUOTE.pricing.totals.grandTotal.toFixed(2)}`;
  } catch (e) {
    status.textContent = "Error: " + e.message;
  }
}

// ---------- Render --------------------------------------------------
function render(quote) {
  document.getElementById("preview").innerHTML = quote.geometry.svg;

  document.getElementById("bars-table").innerHTML = barsTable(quote.parts.bars);
  document.getElementById("glass-table").innerHTML = glassTable(quote.parts.glass);
  document.getElementById("gaskets-table").innerHTML = gasketTable(quote.parts.gaskets);
  document.getElementById("hardware-table").innerHTML = hardwareTable(quote.parts.hardware);

  document.getElementById("cutting-plan").innerHTML = cuttingPlanTable(quote.cuttingPlan);
  document.getElementById("pricing-lines").innerHTML = pricingLinesTable(quote.pricing);
  document.getElementById("pricing-totals").innerHTML = pricingTotalsTable(quote.pricing);

  // Default to the work order
  showDocument("workOrder");
}

function barsTable(bars) {
  const rows = bars.map((b) => `
    <tr>
      <td>${esc(b.code)}</td>
      <td>${esc(b.name)}</td>
      <td>${esc(b.position)}</td>
      <td>${b.orientation}</td>
      <td class="right">${b.extMm}</td>
      <td class="right">${b.intMm}</td>
      <td>${esc(b.endPrep)}</td>
      <td>${esc(b.reinforcementCode ?? "")}</td>
    </tr>
  `).join("");
  return `<table>
    <thead><tr><th>Code</th><th>Name</th><th>Position</th><th>H/V</th><th class="right">Ext</th><th class="right">Int</th><th>End Prep</th><th>Reinf</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function glassTable(glass) {
  const rows = glass.map((g) => `
    <tr><td>${esc(g.label)}</td><td>${esc(g.name)}</td><td class="right">${g.widthMm}</td><td class="right">${g.heightMm}</td><td class="right">${g.areaM2.toFixed(3)} m²</td></tr>
  `).join("");
  return `<table><thead><tr><th>Label</th><th>Type</th><th class="right">Width</th><th class="right">Height</th><th class="right">Area</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function gasketTable(gk) {
  const rows = gk.map((g) => `<tr><td>${esc(g.code)}</td><td>${esc(g.name)}</td><td class="right">${g.lengthMm} mm</td></tr>`).join("");
  return `<table><thead><tr><th>Code</th><th>Name</th><th class="right">Length</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function hardwareTable(hw) {
  const rows = hw.map((h) => `<tr><td>${esc(h.code)}</td><td>${esc(h.name)}</td><td class="right">${h.qty}</td><td>${esc(h.why || "")}</td></tr>`).join("");
  return `<table><thead><tr><th>Code</th><th>Name</th><th class="right">Qty</th><th>Why</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function cuttingPlanTable(plan) {
  return Object.entries(plan.byCode).map(([code, group]) => {
    const barRows = group.bars.map((bar, i) => `
      <tr>
        <td>Bar ${i + 1}</td>
        <td>${bar.cuts.map((c) => `${c.lengthMm}mm (${c.position})`).join(" + ")}</td>
        <td class="right">${bar.usedMm.toFixed(1)} / ${bar.stockMm} mm</td>
        <td class="right">${bar.remainderMm.toFixed(1)} mm</td>
      </tr>
    `).join("");
    return `
      <h4>${esc(group.name)} — ${group.bars.length} bars, ${group.utilizationPct}% util</h4>
      <table>
        <thead><tr><th>Bar</th><th>Cuts</th><th class="right">Used</th><th class="right">Drop</th></tr></thead>
        <tbody>${barRows}</tbody>
      </table>
    `;
  }).join("");
}

function pricingLinesTable(p) {
  const rows = p.lines.map((l) => `
    <tr>
      <td>${esc(l.category)}</td>
      <td>${esc(l.description)}</td>
      <td class="right">${l.qty}</td>
      <td>${l.unit}</td>
      <td class="right">£${l.unitPrice.toFixed(2)}</td>
      <td class="right">£${l.totalPrice.toFixed(2)}</td>
    </tr>
  `).join("");
  return `<table><thead><tr><th>Category</th><th>Description</th><th class="right">Qty</th><th>Unit</th><th class="right">Unit £</th><th class="right">Total £</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function pricingTotalsTable(p) {
  const T = p.totals;
  return `<table class="totals"><tbody>
    <tr><td>Material Cost</td><td>£${T.materialCost.toFixed(2)}</td></tr>
    <tr><td>Material Price (incl. wastage)</td><td>£${T.materialPrice.toFixed(2)}</td></tr>
    <tr><td>Labour</td><td>£${T.labour.toFixed(2)}</td></tr>
    <tr><td><b>Factory Cost</b></td><td><b>£${T.factoryCost.toFixed(2)}</b></td></tr>
    <tr><td>Markup</td><td>£${T.markup.toFixed(2)}</td></tr>
    <tr><td><b>Net Price</b></td><td><b>£${T.netPrice.toFixed(2)}</b></td></tr>
    <tr><td>Tax (VAT)</td><td>£${T.tax.toFixed(2)}</td></tr>
    <tr class="grand"><td>GRAND TOTAL</td><td>£${T.grandTotal.toFixed(2)}</td></tr>
  </tbody></table>`;
}

function showDocument(which) {
  if (!LAST_QUOTE) return;
  const html = LAST_QUOTE.documents[which];
  const frame = document.getElementById("doc-frame");
  frame.srcdoc = html;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[m]);
}
