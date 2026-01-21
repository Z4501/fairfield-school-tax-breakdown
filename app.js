(() => {
  // ---------- helpers ----------
  const $ = (id) => document.getElementById(id);

  function toNumber(v) {
    if (v == null) return 0;
    const s = String(v).replace(/[$, ]/g, "").trim();
    if (!s) return 0;
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  function money(n) {
    const x = Number(n) || 0;
    return x.toLocaleString(undefined, { style: "currency", currency: "USD" });
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  // ---------- state ----------
  let DATA = null;
  let selectedYear = null;

  // ---------- elements ----------
  const yearSelect = $("yearSelect");

  const inputs = {
    taxButlerCounty: $("taxButlerCounty"),
    taxFairfieldCsd: $("taxFairfieldCsd"),
    taxFairfieldCity: $("taxFairfieldCity"),
    taxButlerJvsd: $("taxButlerJvsd"),
    taxMetroParks: $("taxMetroParks"),
    taxLibrary: $("taxLibrary"),

    countyGeneralFund: $("countyGeneralFund"),
    countyDd: $("countyDd"),
    countyMentalHealth: $("countyMentalHealth"),
    countyChildren: $("countyChildren"),
    countySenior: $("countySenior"),
    countyTotalOptional: $("countyTotalOptional"),

    annualIncome: $("annualIncome"),
  };

  const out = {
    totalPropertyTax: $("totalPropertyTax"),
    countyPortionTotal: $("countyPortionTotal"),

    districtSpendingTotal: $("districtSpendingTotal"),
    csdShareTotal: $("csdShareTotal"),

    chipDistrictSpend: $("chipDistrictSpend"),
    chipCitySchoolsShare: $("chipCitySchoolsShare"),
    chipTotalPropertyTax: $("chipTotalPropertyTax"),

    eitYear: $("eitYear"),
    eitMonth: $("eitMonth"),

    refList: $("refList"),
    refLinesTotal: $("refLinesTotal"),
    refCountyItemsTotal: $("refCountyItemsTotal"),

    schoolsTbody: $("schoolsTbody"),
  };

  // ---------- load data ----------
  async function loadJson() {
    // Try ./data/fairfield.json first (your folder screenshot),
    // then fallback to ./fairfield.json if you move it.
    const paths = ["./data/fairfield.json", "./fairfield.json"];
    let lastErr = null;

    for (const p of paths) {
      try {
        const r = await fetch(p, { cache: "no-store" });
        if (!r.ok) throw new Error(`${p} HTTP ${r.status}`);
        return await r.json();
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("Could not load fairfield.json");
  }

  // ---------- UI ----------
  function buildYearSelect(years) {
    yearSelect.innerHTML = "";
    years.forEach((y) => {
      const opt = document.createElement("option");
      opt.value = String(y);
      opt.textContent = String(y);
      yearSelect.appendChild(opt);
    });
  }

  function getTaxLines() {
    const lines = [
      { id: "butler", label: "Butler County /", el: inputs.taxButlerCounty, desc: "Countywide services (courts/jail, sheriff functions, some roads & infrastructure, human services/public health, admin)." },
      { id: "city", label: "Fairfield City /", el: inputs.taxFairfieldCity, desc: "City services can include streets/roads, police, fire, EMS/911, parks, admin (structure varies)." },
      { id: "csd", label: "Fairfield CSD /", el: inputs.taxFairfieldCsd, desc: "School district tax line. This drives “Your City Schools Share.”" },
      { id: "jvsd", label: "Butler County JVSD /", el: inputs.taxButlerJvsd, desc: "Joint vocational school district (career/tech education)." },
      { id: "parks", label: "Metro Parks of Butler County /", el: inputs.taxMetroParks, desc: "County metro parks system (parks, trails, maintenance)." },
      { id: "library", label: "Lane Public Library District /", el: inputs.taxLibrary, desc: "Public library levy/service district." },
    ];

    const amounts = {};
    lines.forEach((x) => (amounts[x.id] = toNumber(x.el.value)));
    return { lines, amounts };
  }

  function getCountyItems() {
    const items = [
      { id: "gen", label: "General Fund", el: inputs.countyGeneralFund, desc: "County operations (admin, courts, jail, sheriff functions, roads/infrastructure)." },
      { id: "dd", label: "Developmental Disabilities", el: inputs.countyDd, desc: "County Board of DD programs/services." },
      { id: "mh", label: "Mental Health", el: inputs.countyMentalHealth, desc: "Mental health/addiction levy/board line." },
      { id: "cs", label: "Children Services", el: inputs.countyChildren, desc: "Children services levy/board line." },
      { id: "sr", label: "Senior Citizens", el: inputs.countySenior, desc: "Senior services levy/board line." },
    ];
    const vals = items.map((x) => toNumber(x.el.value));
    const total = vals.reduce((a, b) => a + b, 0);
    return { items, total };
  }

  // ---------- rendering ----------
  function renderBreakdown() {
    const { lines, amounts } = getTaxLines();
    const { total: countyItemsTotal } = getCountyItems();

    out.refList.innerHTML = "";

    lines.forEach((x) => {
      const amt = amounts[x.id] || 0;
      const row = document.createElement("div");
      row.className = "refRow";

      // highlight Butler County row to visually connect to the county breakdown
      if (x.id === "butler") row.classList.add("countyHighlightRow");

      row.innerHTML = `
        <div class="refLeft">
          <div class="refTitle">${x.label}</div>
          <div class="refDesc">${x.desc}</div>
        </div>
        <div class="refAmt">${money(amt)}</div>
      `;
      out.refList.appendChild(row);

      // Insert shaded header before county items list
      if (x.id === "library") {
        const sep = document.createElement("div");
        sep.className = "refSep";
        sep.innerHTML = `<div class="refSepTitle">County Portion Only (breakdown of the Butler County line)</div>`;
        out.refList.appendChild(sep);

        // Show the 5 county items as mini rows (shaded)
        const { items } = getCountyItems();
        items.forEach((ci) => {
          const val = toNumber(ci.el.value);
          const ciRow = document.createElement("div");
          ciRow.className = "refRow countyItemRow";
          ciRow.innerHTML = `
            <div class="refLeft">
              <div class="refTitle">${ci.label}</div>
              <div class="refDesc">${ci.desc}</div>
            </div>
            <div class="refAmt">${money(val)}</div>
          `;
          out.refList.appendChild(ciRow);
        });
      }
    });

    const totalLines = Object.values(amounts).reduce((a, b) => a + b, 0);

    out.refLinesTotal.textContent = money(totalLines);
    out.refCountyItemsTotal.textContent = money(countyItemsTotal);
  }

  function renderSchools() {
    if (!DATA) return;

    const yearKey = String(selectedYear);
    const uses = Array.isArray(DATA.uses) ? DATA.uses : [];
    const csdLine = toNumber(inputs.taxFairfieldCsd.value); // "Your City Schools Share"

    // compute district total from top-level uses only (NOT children)
    const districtTotal = uses.reduce((sum, u) => sum + toNumber(u?.values?.[yearKey]), 0);

    out.districtSpendingTotal.textContent = money(districtTotal);
    out.csdShareTotal.textContent = money(csdLine);

    // chips
    out.chipDistrictSpend.textContent = money(districtTotal);
    out.chipCitySchoolsShare.textContent = money(csdLine);

    // table
    out.schoolsTbody.innerHTML = "";

    // If districtTotal is 0, prevent NaN propagation
    const safeDistrictTotal = districtTotal > 0 ? districtTotal : 1;

    // helper to add rows
    function addRow({ labelHtml, desc, amount, share, isChild = false }) {
      const tr = document.createElement("tr");
      tr.className = isChild ? "childRow" : "";
      tr.innerHTML = `
        <td>
          <div class="catName">${labelHtml}</div>
          <div class="catDesc">${desc || ""}</div>
        </td>
        <td class="num">${money(amount)}</td>
        <td class="num">${money(share)}</td>
      `;
      out.schoolsTbody.appendChild(tr);
    }

    // descriptions (your descriptors map — you already had these)
    const descMap = {
      instruction: "Direct classroom instruction and teaching-related costs.",
      instruction_regular: "General K–12 classroom instruction (non-special education).",
      instruction_special: "Special education instruction and required services.",
      instruction_other: "Other instructional costs not classified elsewhere.",
      instruction_benefits: "District-paid health insurance and benefits already included.",
      instruction_strs: "STRS employer retirement contributions for certified teachers.",
      instruction_sers: "SERS employer retirement contributions for non-teaching staff.",

      support: "Administrative, counseling, health, library, IT, finance, and central office services.",
      operations: "Building utilities, custodial services, maintenance, repairs, and grounds.",
      transportation: "Busing, fleet operations, routing, fuel, and transportation support.",
      food: "School meal programs, cafeteria staff, food purchases, and kitchen operations.",
      extracurricular: "Athletics, clubs, activities, and extracurricular programs.",
      interest: "Interest and financing costs on bonds and long-term district debt.",
    };

    // main loop
    uses.forEach((u) => {
      const id = u.id;
      const amount = toNumber(u?.values?.[yearKey]);

      // share for this top-level category
      const share = (amount / safeDistrictTotal) * csdLine;

      addRow({
        labelHtml: u.name || id,
        desc: descMap[id] || "",
        amount,
        share,
        isChild: false,
      });

      // ALWAYS expand Instruction children if present
      if (id === "instruction" && Array.isArray(u.children) && u.children.length) {
        // instruction share is the parent share computed above
        const instructionTotal = amount > 0 ? amount : 1;

        u.children.forEach((c) => {
          const cId = c.id;
          const cAmount = toNumber(c?.values?.[yearKey]);

          // IMPORTANT: child share is proportional INSIDE instruction (so it sums to Instruction share)
          const cShare = (cAmount / instructionTotal) * share;

          addRow({
            labelHtml: `↳ ${c.name || cId}`,
            desc: descMap[cId] || "",
            amount: cAmount,
            share: cShare,
            isChild: true,
          });
        });
      }
    });
  }

  function renderTotals() {
    const { amounts } = getTaxLines();
    const totalLines = Object.values(amounts).reduce((a, b) => a + b, 0);
    out.totalPropertyTax.textContent = money(totalLines);
    out.chipTotalPropertyTax.textContent = money(totalLines);

    const { total: countyItemsTotal } = getCountyItems();
    out.countyPortionTotal.textContent = money(countyItemsTotal);
  }

  function renderEit() {
    const annual = toNumber(inputs.annualIncome.value);
    const rate = 0.0125;
    const yearly = annual * rate;
    const monthly = yearly / 12;
    out.eitYear.textContent = money(yearly);
    out.eitMonth.textContent = money(monthly);
  }

  function onAnyChange() {
    renderTotals();
    renderEit();
    renderBreakdown();
    renderSchools();
  }

  function clearAll() {
    Object.values(inputs).forEach((el) => {
      if (!el) return;
      el.value = "";
    });
    onAnyChange();
  }

  function fillExample() {
    // demo numbers matching your screenshots
    inputs.taxButlerCounty.value = "722";
    inputs.taxFairfieldCsd.value = "3066";
    inputs.taxFairfieldCity.value = "1095";
    inputs.taxButlerJvsd.value = "241";
    inputs.taxMetroParks.value = "71";
    inputs.taxLibrary.value = "54";

    inputs.countyGeneralFund.value = "125.28";
    inputs.countyDd.value = "190.19";
    inputs.countyMentalHealth.value = "133.81";
    inputs.countyChildren.value = "142.51";
    inputs.countySenior.value = "180.21";
    inputs.countyTotalOptional.value = "772";

    inputs.annualIncome.value = "80000";

    onAnyChange();
  }

  function wireEvents() {
    yearSelect.addEventListener("change", () => {
      selectedYear = Number(yearSelect.value);
      onAnyChange();
    });

    Object.values(inputs).forEach((el) => {
      if (!el) return;
      el.addEventListener("input", onAnyChange);
    });

    $("openAuditorBtn")?.addEventListener("click", () => {
      // Butler County Auditor property search (generic)
      window.open("https://auditor.butlercountyohio.org/", "_blank");
    });

    $("clearBtn")?.addEventListener("click", clearAll);
    $("fillExampleBtn")?.addEventListener("click", fillExample);
  }

  async function init() {
    DATA = await loadJson();

    const years = Array.isArray(DATA.years) ? DATA.years : [];
    buildYearSelect(years);

    // default to last year
    selectedYear = years.length ? years[years.length - 1] : 2024;
    yearSelect.value = String(selectedYear);

    wireEvents();
    onAnyChange();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
