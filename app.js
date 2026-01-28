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

  function getUnitFactor() {
    const enabled = !!aptEnable?.checked;
    const unitsRaw = aptUnits ? Math.floor(toNumber(aptUnits.value)) : 0;
    const units = unitsRaw > 0 ? unitsRaw : 0;
    const factor = enabled && units >= 1 ? (1 / units) : 1;
    return { enabled, units, factor };
  }

  function renderApt() {
    if (!aptEnable || !aptUnits || !aptFactorEl) return;
    const { enabled, units, factor } = getUnitFactor();

    // toggle input enabled state
    aptUnits.disabled = !enabled;

    if (!enabled) {
      aptFactorEl.textContent = "Off";
      aptMiniNote &&
        (aptMiniNote.textContent =
          "Optional: enter unit count to estimate per-unit shares (chips + school allocation).");
      return;
    }

    if (units < 1) {
      aptFactorEl.textContent = "Enter units";
      aptMiniNote &&
        (aptMiniNote.textContent =
          "Per-unit mode is ON — enter the number of units (e.g., 48).");
      return;
    }

    aptFactorEl.textContent = `1 / ${units} (${(factor * 100).toFixed(2)}%)`;
    aptMiniNote &&
      (aptMiniNote.textContent =
        "Per-unit mode is ON — outputs below are divided by unit count (inputs remain parcel totals).");
  }

  // ---------- state ----------
  let DATA = null;
  let selectedYear = null;

  // ---------- elements ----------
  const yearSelect = $("yearSelect");

  // apartment / complex per-unit mode
  const aptEnable = $("aptEnable");
  const aptUnits = $("aptUnits");
  const aptFactorEl = $("aptFactor");
  const aptMiniNote = $("aptMiniNote");

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
      {
        id: "butler",
        label: "Butler County /",
        el: inputs.taxButlerCounty,
        desc:
          "Countywide services (courts/jail, sheriff functions, some roads & infrastructure, human services/public health, admin).",
      },
      {
        id: "csd",
        label: "Fairfield CSD /",
        el: inputs.taxFairfieldCsd,
        desc:
          "School district operating + debt (instruction, support, transportation, facilities, etc.).",
      },
      {
        id: "city",
        label: "Fairfield City /",
        el: inputs.taxFairfieldCity,
        desc:
          "City services can include streets/roads, police, fire, EMS/911, parks, admin (structure varies).",
      },
      {
        id: "jvsd",
        label: "Butler County JVSD /",
        el: inputs.taxButlerJvsd,
        desc:
          "Joint vocational school district (career technical education).",
      },
      {
        id: "parks",
        label: "Metro Parks of Butler County /",
        el: inputs.taxMetroParks,
        desc:
          "County metro parks levy/board line.",
      },
      {
        id: "library",
        label: "Lane Public Library District /",
        el: inputs.taxLibrary,
        desc:
          "Public library district levy/board line.",
      },
    ];

    const amounts = {};
    lines.forEach((x) => (amounts[x.id] = toNumber(x.el.value)));
    return { lines, amounts };
  }

  function getCountyItems() {
    const items = [
      {
        id: "gf",
        label: "General Fund",
        el: inputs.countyGeneralFund,
        desc:
          "General county operations (admin, courts, sheriff-related, etc. depends on county budgeting).",
      },
      {
        id: "dd",
        label: "Developmental Disabilities",
        el: inputs.countyDd,
        desc:
          "County DD services levy line.",
      },
      {
        id: "mh",
        label: "Mental Health",
        el: inputs.countyMentalHealth,
        desc:
          "Mental health services levy line.",
      },
      {
        id: "cs",
        label: "Children Services",
        el: inputs.countyChildren,
        desc:
          "Children services levy line.",
      },
      {
        id: "sc",
        label: "Senior Citizens",
        el: inputs.countySenior,
        desc:
          "Senior services levy/board line.",
      },
    ];
    const vals = items.map((x) => toNumber(x.el.value));
    const total = vals.reduce((a, b) => a + b, 0);
    return { items, total };
  }

  // ---------- rendering ----------
  function renderBreakdown() {
    const { factor } = getUnitFactor();
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
        <div class="refAmt">${money(amt * factor)}</div>
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
            <div class="refAmt">${money(val * factor)}</div>
          `;
          out.refList.appendChild(ciRow);
        });
      }
    });

    const totalLines = Object.values(amounts).reduce((a, b) => a + b, 0);

    out.refLinesTotal.textContent = money(totalLines * factor);
    out.refCountyItemsTotal.textContent = money(countyItemsTotal * factor);
  }

  function renderSchools() {
    if (!DATA) return;

    const yearKey = String(selectedYear);
    const uses = Array.isArray(DATA.uses) ? DATA.uses : [];

    const { factor } = getUnitFactor();
    const csdLine = toNumber(inputs.taxFairfieldCsd.value) * factor; // scaled for per-unit mode

    // compute district total from top-level uses only (NOT children)
    const districtTotal = uses.reduce(
      (sum, u) => sum + toNumber(u?.values?.[yearKey]),
      0
    );

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
    function addRow({
      labelHtml,
      desc,
      amount,
      share,
      isChild = false,
      isMemo = false,
      memoLabel = "Included",
    }) {
      const tr = document.createElement("tr");
      tr.className = [isChild ? "childRow" : "", isMemo ? "memoRow" : ""]
        .filter(Boolean)
        .join(" ");

      const badge = isMemo ? `<span class="badge">${memoLabel}</span>` : "";
      tr.innerHTML = `
        <td>
          <div class="catName">${labelHtml} ${badge}</div>
          <div class="catDesc">${desc || ""}</div>
        </td>
        <td class="num">${money(amount)}</td>
        <td class="num">${money(share)}</td>
      `;
      out.schoolsTbody.appendChild(tr);
    }

    // descriptions
    // Prefer descriptors coming from JSON (u.desc / c.desc). Fallback to this map for older data files.
    const descFallback = {
      instruction: "Direct classroom instruction and teaching-related costs.",
      instruction_regular:
        "General K–12 classroom instruction (non-special education).",
      instruction_special:
        "Special education instruction and required services.",
      instruction_vocational:
        "Career-technical/vocational instruction (when reported here).",
      instruction_other: "Other instructional programs/services.",
      support_services:
        "Guidance, support staff, athletics/activities support, transportation support, and other support functions (varies).",
      operation_maintenance:
        "Facilities operations, maintenance, utilities, custodial, repairs.",
      food: "Food service operations.",
      non_instructional: "Non-instructional programs (varies).",
      interest_fiscal:
        "Debt interest and fiscal charges (bond/notes interest, debt issuance costs where applicable).",
      capital_outlay:
        "Capital projects and major equipment/building improvements.",
      extracurricular:
        "Athletics and extracurricular programs (when separated).",
      benefits: "Benefits are included inside the category totals (not added on top).",
      strs: "STRS is included inside totals (not added on top).",
      sers: "SERS is included inside totals (not added on top).",
    };

    function getDesc(node) {
      if (node?.desc) return node.desc;
      const id = (node?.id || "").toLowerCase();
      return descFallback[id] || "";
    }

    uses.forEach((u) => {
      const id = (u?.id || u?.name || "").toLowerCase();
      const amount = toNumber(u?.values?.[yearKey]);

      // share for this top-level category
      const share = (amount / safeDistrictTotal) * csdLine;

      addRow({
        labelHtml: u.name || id,
        desc: getDesc(u),
        amount,
        share,
        isChild: false,
      });

      // ALWAYS expand Instruction children if present
      if (id === "instruction" && Array.isArray(u.children) && u.children.length) {
        // Child rows under Instruction include two types:
        //  1) additive sub-functions (Regular/Special/Other) that SHOULD roll up to Instruction
        //  2) memo-only "included" lines (Benefits/STRS/SERS) that are already embedded in totals and must NOT be re-added
        const denom = u.children.reduce((s, c) => {
          if (c && c.included) return s;
          return s + toNumber(c?.values?.[yearKey]);
        }, 0) || 1;

        u.children.forEach((c) => {
          const cAmt = toNumber(c?.values?.[yearKey]);

          if (c && c.included) {
            // memo-only: show "Included" and do NOT allocate additional dollars
            addRow({
              labelHtml: `↳ ${c.name || c.id || "Included line"}`,
              desc: getDesc(c),
              amount: cAmt,
              share: 0,
              isChild: true,
              isMemo: true,
              memoLabel: "Included",
            });
          } else {
            // additive instruction breakdown: allocate proportional share of Instruction share
            const cShare =
              ((cAmt / denom) * (amount / safeDistrictTotal) * csdLine);

            addRow({
              labelHtml: `↳ ${c.name || c.id || "Instruction detail"}`,
              desc: getDesc(c),
              amount: cAmt,
              share: cShare,
              isChild: true,
            });
          }
        });
      }
    });
  }

  function renderTotals() {
    const { factor } = getUnitFactor();
    const { amounts } = getTaxLines();
    const totalLines = Object.values(amounts).reduce((a, b) => a + b, 0);
    out.totalPropertyTax.textContent = money(totalLines * factor);
    out.chipTotalPropertyTax.textContent = money(totalLines * factor);

    const { total: countyItemsTotal } = getCountyItems();
    out.countyPortionTotal.textContent = money(countyItemsTotal * factor);
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
    renderApt();
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
    if (aptEnable) aptEnable.checked = false;
    if (aptUnits) aptUnits.value = "";
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

    inputs.annualIncome.value = "50000";

    // leave per-unit mode OFF by default in demo
    if (aptEnable) aptEnable.checked = false;
    if (aptUnits) aptUnits.value = "";

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

    // apartment per-unit mode
    aptEnable?.addEventListener("change", () => {
      if (aptUnits) {
        aptUnits.disabled = !aptEnable.checked;
        if (aptEnable.checked) aptUnits.focus();
      }
      onAnyChange();
    });

    aptUnits?.addEventListener("input", onAnyChange);

    $("openAuditorBtn")?.addEventListener("click", () => {
      // Butler County Auditor property search (generic)
      window.open("https://auditor.bcohio.gov/", "_blank");
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

    // ensure apt input starts disabled unless checked
    if (aptUnits && aptEnable) aptUnits.disabled = !aptEnable.checked;

    wireEvents();
    onAnyChange();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
