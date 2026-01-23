// Fairfield CSD — Where the Money Goes
// Loads: ./data/fairfield.json
// Builds schools spending table + allocates pasted Fairfield CSD tax across categories.

const $ = (id) => document.getElementById(id);

const els = {
  yearSelect: $("yearSelect"),
  schoolsTbody: $("schoolsTbody"),

  chipDistrictSpend: $("chipDistrictSpend"),
  chipCitySchoolsShare: $("chipCitySchoolsShare"),
  chipTotalPropertyTax: $("chipTotalPropertyTax"),

  districtSpendingTotal: $("districtSpendingTotal"),
  csdShareTotal: $("csdShareTotal"),

  // EIT
  annualIncome: $("annualIncome"),
  eitYear: $("eitYear"),
  eitMonth: $("eitMonth"),

  // Property tax inputs
  taxButlerCounty: $("taxButlerCounty"),
  taxFairfieldCsd: $("taxFairfieldCsd"),
  taxFairfieldCity: $("taxFairfieldCity"),
  taxButlerJvsd: $("taxButlerJvsd"),
  taxMetroParks: $("taxMetroParks"),
  taxLibrary: $("taxLibrary"),

  totalPropertyTax: $("totalPropertyTax"),
  countyPortionTotal: $("countyPortionTotal"),

  // County detail inputs
  countyGeneralFund: $("countyGeneralFund"),
  countyDd: $("countyDd"),
  countyMentalHealth: $("countyMentalHealth"),
  countyChildren: $("countyChildren"),
  countySenior: $("countySenior"),
  countyTotalOptional: $("countyTotalOptional"),

  // Right panel
  refList: $("refList"),
  refLinesTotal: $("refLinesTotal"),
  refCountyItemsTotal: $("refCountyItemsTotal"),

  // Buttons
  fillExampleBtn: $("fillExampleBtn"),
  clearBtn: $("clearBtn"),
  openAuditorBtn: $("openAuditorBtn"),
};

let dataset = null;
let currentYear = null;

// Track expanded parents (Instruction always expanded)
const expanded = new Set(["instruction"]);

function fmtMoney(n) {
  if (typeof n !== "number" || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
function fmtMoney2(n) {
  if (typeof n !== "number" || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function toNum(v) {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v).replace(/[$,]/g, "").trim();
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function getYearValue(obj, year) {
  if (!obj) return 0;
  const v = obj[String(year)];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function calcDistrictTotalForYear(year) {
  // Sum top-level categories for selected year.
  // Note: "included" overlays are in children and do NOT affect totals.
  let total = 0;
  for (const u of dataset.uses) total += getYearValue(u.values, year);
  return total;
}

function buildYearSelect() {
  els.yearSelect.innerHTML = "";
  for (const y of dataset.years) {
    const opt = document.createElement("option");
    opt.value = String(y);
    opt.textContent = String(y);
    els.yearSelect.appendChild(opt);
  }
  // default latest
  const last = dataset.years[dataset.years.length - 1];
  els.yearSelect.value = String(last);
  currentYear = last;
}

function buildRefList() {
  const items = [
    { id: "taxButlerCounty", label: "Butler County /", desc: "County operations & countywide levies. Not automatically “police.”" },
    { id: "taxFairfieldCsd", label: "Fairfield CSD /", desc: "School district portion (this is the one allocated across categories on the left)." },
    { id: "taxFairfieldCity", label: "Fairfield City /", desc: "City services (varies: police/fire/EMS/streets/parks depending on structure)." },
    { id: "taxButlerJvsd", label: "Butler County JVSD /", desc: "Joint Vocational School District (career-technical)." },
    { id: "taxMetroParks", label: "Metro Parks of Butler County /", desc: "County parks and related services." },
    { id: "taxLibrary", label: "Lane Public Library District /", desc: "Library district operations." },
  ];

  els.refList.innerHTML = "";
  for (const it of items) {
    const wrap = document.createElement("div");
    wrap.className = "refItem";
    wrap.innerHTML = `
      <div class="t">${it.label}</div>
      <div class="d">${it.desc}</div>
    `;
    els.refList.appendChild(wrap);
  }
}

function renderSchoolsTable() {
  if (!dataset || !currentYear) return;

  const year = currentYear;
  const districtTotal = calcDistrictTotalForYear(year);

  // Inputs
  const csdTax = toNum(els.taxFairfieldCsd.value);

  // Compute allocation share (avoid divide by zero)
  const shareFactor = districtTotal > 0 ? (csdTax / districtTotal) : 0;

  // Update chips + totals
  els.chipDistrictSpend.textContent = fmtMoney(districtTotal);
  els.districtSpendingTotal.textContent = fmtMoney(districtTotal);

  els.chipCitySchoolsShare.textContent = fmtMoney2(csdTax);
  els.csdShareTotal.textContent = fmtMoney2(csdTax);

  // Build rows
  els.schoolsTbody.innerHTML = "";

  const makeParentRow = (use) => {
    const amt = getYearValue(use.values, year);
    const share = amt * shareFactor;

    const tr = document.createElement("tr");
    const hasKids = Array.isArray(use.children) && use.children.length > 0;
    const isExpanded = expanded.has(use.id);

    const left = document.createElement("td");
    const title = document.createElement("div");
    title.className = "rowTitle";

    if (hasKids) {
      const btn = document.createElement("button");
      btn.className = "expBtn";
      btn.type = "button";
      btn.textContent = isExpanded ? "–" : "+";
      btn.addEventListener("click", () => {
        if (expanded.has(use.id)) expanded.delete(use.id);
        else expanded.add(use.id);
        renderSchoolsTable();
      });
      title.appendChild(btn);
    } else {
      // spacer to align
      const spacer = document.createElement("span");
      spacer.style.display = "inline-block";
      spacer.style.width = "22px";
      title.appendChild(spacer);
    }

    const name = document.createElement("div");
    name.textContent = use.name;
    title.appendChild(name);

    left.appendChild(title);

    if (use.desc) {
      const desc = document.createElement("div");
      desc.className = "muted";
      desc.style.marginTop = "4px";
      desc.textContent = use.desc;
      left.appendChild(desc);
    }

    const tdAmt = document.createElement("td");
    tdAmt.className = "num";
    tdAmt.textContent = fmtMoney(amt);

    const tdShare = document.createElement("td");
    tdShare.className = "num";
    tdShare.textContent = fmtMoney2(share);

    tr.appendChild(left);
    tr.appendChild(tdAmt);
    tr.appendChild(tdShare);

    els.schoolsTbody.appendChild(tr);

    // children
    if (hasKids && isExpanded) {
      for (const c of use.children) {
        const cAmt = getYearValue(c.values, year);
        const cShare = cAmt * shareFactor;

        const ctr = document.createElement("tr");
        ctr.className = "childRow";

        const ctdName = document.createElement("td");
        ctdName.className = "childName";

        const label = document.createElement("span");
        label.textContent = c.name;

        ctdName.appendChild(label);

        if (c.included) {
          const badge = document.createElement("span");
          badge.className = "badgeIncluded";
          badge.textContent = "Included";
          ctdName.appendChild(badge);
        }

        if (c.desc) {
          const d = document.createElement("span");
          d.className = "childDesc";
          d.textContent = c.desc;
          ctdName.appendChild(d);
        }

        const ctdAmt = document.createElement("td");
        ctdAmt.className = "num";
        ctdAmt.textContent = fmtMoney(cAmt);

        const ctdShare = document.createElement("td");
        ctdShare.className = "num";
        ctdShare.textContent = fmtMoney2(cShare);

        ctr.appendChild(ctdName);
        ctr.appendChild(ctdAmt);
        ctr.appendChild(ctdShare);

        els.schoolsTbody.appendChild(ctr);
      }
    }
  };

  for (const use of dataset.uses) makeParentRow(use);
}

function updatePropertyTaxTotals() {
  const lines = [
    els.taxButlerCounty,
    els.taxFairfieldCsd,
    els.taxFairfieldCity,
    els.taxButlerJvsd,
    els.taxMetroParks,
    els.taxLibrary
  ];

  const total = lines.reduce((sum, el) => sum + toNum(el.value), 0);
  els.totalPropertyTax.textContent = fmtMoney2(total);
  els.chipTotalPropertyTax.textContent = fmtMoney2(total);

  // county portion total (entered)
  els.countyPortionTotal.textContent = fmtMoney2(toNum(els.taxButlerCounty.value));

  // breakdown totals
  els.refLinesTotal.textContent = fmtMoney2(total);

  const countyItems = [
    els.countyGeneralFund,
    els.countyDd,
    els.countyMentalHealth,
    els.countyChildren,
    els.countySenior
  ].reduce((sum, el) => sum + toNum(el.value), 0);

  els.refCountyItemsTotal.textContent = fmtMoney2(countyItems);
}

function updateEIT() {
  const income = toNum(els.annualIncome.value);
  const rate = 0.0125;
  const perYear = income * rate;
  const perMonth = perYear / 12;

  els.eitYear.textContent = fmtMoney2(perYear);
  els.eitMonth.textContent = fmtMoney2(perMonth);
}

function clearAllInputs() {
  const inputs = document.querySelectorAll("input");
  for (const i of inputs) i.value = "";
  updatePropertyTaxTotals();
  updateEIT();
  renderSchoolsTable();
}

function fillExampleA07() {
  // These are demo placeholders. You can change them.
  els.taxButlerCounty.value = "722";
  els.taxFairfieldCsd.value = "3066";
  els.taxFairfieldCity.value = "1095";
  els.taxButlerJvsd.value = "241";
  els.taxMetroParks.value = "71";
  els.taxLibrary.value = "54";

  els.countyGeneralFund.value = "125.28";
  els.countyDd.value = "190.19";
  els.countyMentalHealth.value = "133.81";
  els.countyChildren.value = "142.51";
  els.countySenior.value = "180.21";

  els.annualIncome.value = "80000";

  updatePropertyTaxTotals();
  updateEIT();
  renderSchoolsTable();
}

function wireEvents() {
  els.yearSelect.addEventListener("change", () => {
    currentYear = Number(els.yearSelect.value);
    renderSchoolsTable();
  });

  // Inputs that affect totals + allocation
  const watched = [
    els.taxButlerCounty, els.taxFairfieldCsd, els.taxFairfieldCity, els.taxButlerJvsd,
    els.taxMetroParks, els.taxLibrary,
    els.countyGeneralFund, els.countyDd, els.countyMentalHealth, els.countyChildren, els.countySenior,
    els.countyTotalOptional
  ];
  for (const el of watched) el.addEventListener("input", () => {
    updatePropertyTaxTotals();
    renderSchoolsTable();
  });

  els.annualIncome.addEventListener("input", updateEIT);

  els.fillExampleBtn.addEventListener("click", fillExampleA07);
  els.clearBtn.addEventListener("click", clearAllInputs);

  els.openAuditorBtn.addEventListener("click", () => {
    // You can swap this URL to the exact Butler County Auditor search page you want.
    window.open("https://propertysearch.butlercountyauditor.org/", "_blank");
  });

  // GAAP "About the data" toggle
  (() => {
    const btn = document.getElementById("aboutToggle");
    const body = document.getElementById("aboutBody");
    if (!btn || !body) return;

    btn.addEventListener("click", () => {
      const expanded = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!expanded));
      body.hidden = expanded;
      btn.textContent = expanded
        ? "About the data (GAAP) ▸"
        : "About the data (GAAP) ▾";
    });
  })();
}

async function loadData() {
  // Adjust path if your JSON is elsewhere.
  // If your site uses /data/fairfield.json, keep it.
  const res = await fetch("./data/fairfield.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load fairfield.json (${res.status})`);
  return await res.json();
}

async function main() {
  dataset = await loadData();
  buildYearSelect();
  buildRefList();
  wireEvents();
  updatePropertyTaxTotals();
  updateEIT();
  renderSchoolsTable();
}

main().catch(err => {
  console.error(err);
  alert("Failed to load data. Check console for details.");
});

// GAAP "About the data" toggle (safe, standalone)
(() => {
  const btn = document.getElementById("aboutToggle");
  const body = document.getElementById("aboutBody");
  if (!btn || !body) return;

  btn.addEventListener("click", () => {
    const expanded = btn.getAttribute("aria-expanded") === "true";
    btn.setAttribute("aria-expanded", String(!expanded));
    body.hidden = expanded;
    btn.textContent = expanded
      ? "About the data (GAAP) ▸"
      : "About the data (GAAP) ▾";
  });
})();
