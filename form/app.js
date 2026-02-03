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

  // ---------- state ----------
  let DATA = null;
  let selectedYear = null;

  // ---------- elements ----------
  const yearSelect = $("yearSelect");
  const perUnitToggle = $("perUnitToggle");
  const unitCount = $("unitCount");
  const perUnitStatus = $("perUnitStatus");

  // Auto-fill (Butler County)
  const autoAddress = $("autoAddress");
  const autoFillBtn = $("autoFillBtn");
  const openAuditorBtn = $("openAuditorBtn");
  const autoStatus = $("autoStatus");

  // Your PHP API endpoint on HostGator
  const BUTLER_API_URL = "https://tri-star-automotive.com/api/butler-tax.php";

  function setAutoStatus(msg, kind) {
    if (!autoStatus) return;
    autoStatus.textContent = msg || "";
    autoStatus.classList.remove("ok","bad");
    if (kind) autoStatus.classList.add(kind);
  }

  function applyMoneyToInput(id, amountStr) {
    const el = inputs[id];
    if (!el) return;
    // amountStr like "$1,626.45" -> "1626.45"
    const cleaned = String(amountStr || "").replace(/[^0-9.\-]/g, "");
    el.value = cleaned;
  }

  async function autoFillFromAddress() {
    if (!autoAddress || !autoFillBtn) return;
    const addr = (autoAddress.value || "").trim();
    if (!addr) {
      setAutoStatus("Enter an address first.", "bad");
      return;
    }

    autoFillBtn.disabled = true;
    setAutoStatus("Looking up parcel + pulling tax distribution…", "");

    try {
      const url = `${BUTLER_API_URL}?address=${encodeURIComponent(addr)}`;
      const res = await fetch(url, { method: "GET" });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data || data.ok !== true) {
        const msg = (data && data.error) ? data.error : `HTTP ${res.status}`;
        throw new Error(msg);
      }

      // Fill Tax Distribution inputs
      const dist = data?.taxes?.distribution || [];
      const map = new Map(dist.map(r => [String(r.authority || "").trim().toLowerCase(), r.amount]));

      const getAmt = (...keys) => {
        for (const k of keys) {
          const v = map.get(String(k).toLowerCase());
          if (v) return v;
        }
        return "";
      };

      applyMoneyToInput("taxButlerCounty", getAmt("Butler County"));
      applyMoneyToInput("taxFairfieldCsd", getAmt("Fairfield Csd", "Fairfield CSD"));
      applyMoneyToInput("taxFairfieldCity", getAmt("Fairfield City"));
      applyMoneyToInput("taxButlerJvsd", getAmt("Butler County Jvsd", "Butler County JVSD"));
      applyMoneyToInput("taxMetroParks", getAmt("Metro Parks Of Butler County", "Metro Parks of Butler County"));
      applyMoneyToInput("taxLibrary", getAmt("Lane Public Library District"));
      // Total Tax is computed by the form; we don't need to set it.

      // Fill County Portion Only inputs (if present)
      const county = data?.taxes?.countyPortionOnly || [];
      const cmap = new Map(county.map(r => [String(r.authority || "").trim().toLowerCase(), r.amount]));

      const cGet = (key) => cmap.get(String(key).toLowerCase()) || "";

      applyMoneyToInput("countyGeneralFund", cGet("General Fund"));
      applyMoneyToInput("countyDd", cGet("Developmental Disabilities"));
      applyMoneyToInput("countyMentalHealth", cGet("Mental Health"));
      applyMoneyToInput("countyChildren", cGet("Children Services"));
      applyMoneyToInput("countySenior", cGet("Senior Citizens"));
      // Optional total field
      if (inputs.countyTotal) applyMoneyToInput("countyTotal", cGet("County Total Tax"));

      onAnyChange();
      const pin = data?.picked?.PIN ? ` (PIN ${data.picked.PIN})` : "";
      setAutoStatus(`Auto-fill complete${pin}. You can edit any box below.`, "ok");
    } catch (err) {
      setAutoStatus(`Auto-fill failed: ${err.message || err}`, "bad");
      console.error(err);
    } finally {
      autoFillBtn.disabled = false;
    }
  }

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

  // ---------- per-unit ----------
  function getPerUnitFactor() {
    const enabled = !!perUnitToggle?.checked;
    const units = Math.round(toNumber(unitCount?.value));
    if (!enabled || !Number.isFinite(units) || units <= 1) return 1;
    return 1 / units;
  }

  function renderPerUnitStatus() {
    if (!perUnitStatus) return;
    const enabled = !!perUnitToggle?.checked;
    const units = Math.round(toNumber(unitCount?.value));
    if (!enabled) {
      perUnitStatus.textContent = "Per-unit factor: Off";
      return;
    }
    if (!Number.isFinite(units) || units <= 1) {
      perUnitStatus.textContent = "Per-unit factor: On (enter units)";
      return;
    }
    perUnitStatus.textContent = `Per-unit factor: 1/${units}`;
  }

  // ---------- load data ----------
  async function loadJson() {
    // Try ./data/fairfield.json first, then fallback to ./fairfield.json
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
      { id: "csd", label: "Fairfield CSD /", el: inputs.taxFairfieldCsd, desc: "School district tax line. This drives “Your City Schools Share.”" },
      { id: "city", label: "Fairfield City /", el: inputs.taxFairfieldCity, desc: "City services can include streets/roads, police, fire, EMS/911, parks, admin (structure varies)." },
      { id: "jvsd", label: "Butler County JVSD /", el: inputs.taxButlerJvsd, desc: "Joint vocational school district (career/tech education)." },
      { id: "parks", label: "Metro Parks of Butler County /", el: inputs.taxMetroParks, desc: "MetroParks levy and operations (parks, trails, conservation)." },
      { id: "library", label: "Lane Public Library District /", el: inputs.taxLibrary, desc: "Public library levy and operations." },
    ];

    const amounts = {};
    lines.forEach((x) => (amounts[x.id] = toNumber(x.el.value)));
    return { lines, amounts };
  }

  function getCountyItems() {
    const items = [
      { id: "gf", label: "General Fund", el: inputs.countyGeneralFund, desc: "General county operations and services." },
      { id: "dd", label: "Developmental Disabilities", el: inputs.countyDd, desc: "DDS levy and services." },
      { id: "mh", label: "Mental Health", el: inputs.countyMentalHealth, desc: "Mental health services and programs." },
      { id: "cs", label: "Children Services", el: inputs.countyChildren, desc: "Children Services levy and operations." },
      { id: "sc", label: "Senior Citizens", el: inputs.countySenior, desc: "Senior services levy and programs." },
    ];

    const total = items.reduce((sum, i) => sum + toNumber(i.el.value), 0);
    return { items, total };
  }

  function renderTotals() {
    const f = getPerUnitFactor();
    const { amounts } = getTaxLines();
    const totalLinesParcel = Object.values(amounts).reduce((a, b) => a + b, 0);
    const totalLines = totalLinesParcel * f;

    out.totalPropertyTax.textContent = money(totalLines);
    out.chipTotalPropertyTax.textContent = money(totalLines);

    const { total: countyItemsTotalParcel } = getCountyItems();
    out.countyPortionTotal.textContent = money(countyItemsTotalParcel * f);
  }

  function renderEit() {
    const annual = toNumber(inputs.annualIncome.value);
    const rate = 0.0125;
    const yearly = annual * rate;
    const monthly = yearly / 12;
    out.eitYear.textContent = money(yearly);
    out.eitMonth.textContent = money(monthly);
  }

  function renderBreakdown() {
    const f = getPerUnitFactor();
    const { lines, amounts } = getTaxLines();
    const { items, total: countyItemsTotalParcel } = getCountyItems();

    out.refList.innerHTML = "";

    lines.forEach((x) => {
      const amt = (amounts[x.id] || 0) * f;
      const row = document.createElement("div");
      row.className = "refRow";
      if (x.id === "butler") row.classList.add("countyHighlightRow");

      row.innerHTML = `
        <div class="refLeft">
          <div class="refTitle">${x.label}</div>
          <div class="refDesc">${x.desc}</div>
        </div>
        <div class="refAmt">${money(amt)}</div>
      `;
      out.refList.appendChild(row);
    });

    const sep = document.createElement("div");
    sep.className = "refSep";
    sep.innerHTML = `<div class="refSepTitle">County Portion Only (breakdown of the Butler County line)</div>`;
    out.refList.appendChild(sep);

    items.forEach((ci) => {
      const val = toNumber(ci.el.value) * f;
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

    const totalLinesParcel = Object.values(amounts).reduce((a, b) => a + b, 0);
    out.refLinesTotal.textContent = money(totalLinesParcel * f);
    out.refCountyItemsTotal.textContent = money(countyItemsTotalParcel * f);
  }

  function renderSchools() {
    if (!DATA) return;

    const f = getPerUnitFactor();
    const yearKey = String(selectedYear);
    const uses = Array.isArray(DATA.uses) ? DATA.uses : [];

    const csdLineParcel = toNumber(inputs.taxFairfieldCsd.value);
    const csdLine = csdLineParcel * f;

    const districtTotal = uses.reduce((sum, u) => sum + toNumber(u?.values?.[yearKey]), 0);
    const safeDistrictTotal = districtTotal > 0 ? districtTotal : 1;

    out.districtSpendingTotal.textContent = money(districtTotal);
    out.csdShareTotal.textContent = money(csdLine);

    out.chipDistrictSpend.textContent = money(districtTotal);
    out.chipCitySchoolsShare.textContent = money(csdLine);

    out.schoolsTbody.innerHTML = "";

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

    uses.forEach((u) => {
      const amount = toNumber(u?.values?.[yearKey]);
      const share = (amount / safeDistrictTotal) * csdLine;
      const hasChildren = Array.isArray(u.children) && u.children.length > 0;

      addRow({
        labelHtml: hasChildren ? `<span class="caret">▸</span> ${u.name || u.id || "Category"}` : (u.name || u.id || "Category"),
        desc: u.desc || "",
        amount,
        share
      });

      if (hasChildren) {
        u.children.forEach((c) => {
          const cAmount = toNumber(c?.values?.[yearKey]);
          const cShare = (cAmount / safeDistrictTotal) * csdLine;

          addRow({
            labelHtml: `<span class="childIndent"></span>${c.name || c.id || "Detail"}`,
            desc: c.desc || "",
            amount: cAmount,
            share: cShare,
            isChild: true
          });
        });
      }
    });
  }

  function onAnyChange() {
    renderPerUnitStatus();
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
    if (perUnitToggle) perUnitToggle.checked = false;
    if (unitCount) unitCount.value = "";
    renderPerUnitStatus();
    onAnyChange();
  }

  function fillExample(which) {
    if (which === "apt72") {
      // Timber Hollow Apartments (parcel totals) — enable per-unit mode with 72 units
      inputs.taxButlerCounty.value = "12354.10";
      inputs.taxFairfieldCsd.value = "56508.66";
      inputs.taxFairfieldCity.value = "15912.32";
      inputs.taxButlerJvsd.value = "3095.70";
      inputs.taxMetroParks.value = "1001.80";
      inputs.taxLibrary.value = "941.10";

      inputs.countyGeneralFund.value = "1603.99";
      inputs.countyDd.value = "3626.85";
      inputs.countyMentalHealth.value = "2010.94";
      inputs.countyChildren.value = "2417.90";
      inputs.countySenior.value = "2694.42";
      inputs.countyTotalOptional.value = "12354.10";

      if (perUnitToggle) perUnitToggle.checked = true;
      if (unitCount) unitCount.value = "72";
    } else {
      // Single-family A07 demo (parcel totals)
      inputs.taxButlerCounty.value = "772.00";
      inputs.taxFairfieldCsd.value = "3066.17";
      inputs.taxFairfieldCity.value = "1095.69";
      inputs.taxButlerJvsd.value = "241.78";
      inputs.taxMetroParks.value = "71.33";
      inputs.taxLibrary.value = "54.77";

      inputs.countyGeneralFund.value = "125.28";
      inputs.countyDd.value = "190.19";
      inputs.countyMentalHealth.value = "133.81";
      inputs.countyChildren.value = "142.51";
      inputs.countySenior.value = "180.21";
      inputs.countyTotalOptional.value = "772.00";

      if (perUnitToggle) perUnitToggle.checked = false;
      if (unitCount) unitCount.value = "";
    }

    inputs.annualIncome.value = "50000";
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
      window.open("https://auditor.bcohio.gov/", "_blank");
    });

    autoFillBtn?.addEventListener("click", autoFillFromAddress);

    $("demoHouseBtn")?.addEventListener("click", () => fillExample("house"));
    $("demoAptBtn")?.addEventListener("click", () => fillExample("apt72"));
    $("clearBtn")?.addEventListener("click", clearAll);

    perUnitToggle?.addEventListener("change", onAnyChange);
    unitCount?.addEventListener("input", onAnyChange);
  }

  async function init() {
    DATA = await loadJson();

    const years = Array.isArray(DATA.years) ? DATA.years : [];
    buildYearSelect(years);

    selectedYear = years.length ? years[years.length - 1] : 2024;
    yearSelect.value = String(selectedYear);

    wireEvents();
    onAnyChange();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
