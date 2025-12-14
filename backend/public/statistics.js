let availableYears = [];
let currentYearFilter = "";
let currentCategories = [];
let availableCategories = [];

const yearSelect = document.getElementById("year-filter");
const categoryListEl = document.getElementById("category-list");
const overallGrid = document.getElementById("overall-grid");
const yearBody = document.getElementById("stats-year-body");
const yearEmpty = document.getElementById("stats-year-empty");
const yearWrapper = document.getElementById("stats-year-wrapper");
const loadingEl = document.getElementById("stats-loading");
const errorBox = document.getElementById("stats-error");
const forbiddenBox = document.getElementById("stats-forbidden");
const contentEl = document.getElementById("stats-content");
const selectionChip = document.getElementById("stats-selection");
const yearHint = document.getElementById("year-hint");

const formatEuro = (value) => {
  const num = Number(value || 0);
  return num.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " €";
};

const formatInt = (value) => Number(value || 0).toLocaleString("de-DE");

function setLoading(state) {
  if (!loadingEl) return;
  loadingEl.classList.toggle("hidden", !state);
}

function clearErrors() {
  errorBox?.classList.add("hidden");
  forbiddenBox?.classList.add("hidden");
}

function showError(msg) {
  if (!errorBox) return;
  errorBox.textContent = msg;
  errorBox.classList.remove("hidden");
}

function showForbidden() {
  if (contentEl) contentEl.classList.add("hidden");
  setLoading(false);
  if (forbiddenBox) {
    forbiddenBox.textContent = "Keine Berechtigung für Statistik (stats.view erforderlich).";
    forbiddenBox.classList.remove("hidden");
  }
}

function updateSelection(year) {
  const yearLabel = year ? `Jahr: ${year}` : "Alle Jahre";
  const catLabel = currentCategories.length
    ? `Kategorien: ${currentCategories
      .map((key) => availableCategories.find((c) => c.key === key)?.label || key)
      .join(", ")}`
    : "Alle Kategorien";

  if (selectionChip) selectionChip.textContent = `${yearLabel} • ${catLabel}`;

  if (yearHint) {
    yearHint.textContent = year
      ? `Gefiltert auf ${year}. Gesamt bleibt über alle Jahre.`
      : "Aufgeschlüsselt nach Rechnungsjahr.";
  }
}

function mergeYears(byYear) {
  const years = (byYear || []).map((y) => y.year).filter(Boolean);
  availableYears = Array.from(new Set([...availableYears, ...years])).sort((a, b) => b - a);
}

function renderYearOptions() {
  if (!yearSelect) return;
  const previous = currentYearFilter;
  yearSelect.innerHTML = `<option value="">Alle Jahre</option>`;

  availableYears.forEach((year) => {
    const opt = document.createElement("option");
    opt.value = year;
    opt.textContent = year;
    yearSelect.appendChild(opt);
  });

  if (previous) {
    yearSelect.value = previous;
  } else {
    yearSelect.value = "";
  }
}

function renderCategoryOptions(list = []) {
  availableCategories = list;
  if (!categoryListEl) return;

  categoryListEl.innerHTML = "";

  const createChip = (key, label) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "category-chip";
    chip.dataset.key = key;
    chip.textContent = label;

    if (!key && currentCategories.length === 0) chip.classList.add("active");
    if (key && currentCategories.includes(key)) chip.classList.add("active");

    chip.addEventListener("click", () => {
      if (!key) {
        currentCategories = [];
      } else {
        const exists = currentCategories.includes(key);
        currentCategories = exists
          ? currentCategories.filter((k) => k !== key)
          : [...currentCategories, key];
      }
      renderCategoryOptions(availableCategories);
      loadStats(currentYearFilter || null);
    });

    return chip;
  };

  categoryListEl.appendChild(createChip("", "Alle"));
  list.forEach((cat) => {
    categoryListEl.appendChild(createChip(cat.key, cat.label || cat.key));
  });
}

function renderOverall(overall = {}) {
  if (!overallGrid) return;

  const cards = [
    { label: "Rechnungen gesamt", value: formatInt(overall.count) },
    { label: "Brutto gesamt", value: formatEuro(overall.sum_total) },
    { label: "Netto gesamt", value: formatEuro(overall.sum_net) },
    { label: "Steuern", value: formatEuro(overall.sum_tax) },
    { label: "Bezahlt", value: formatEuro(overall.paid_sum), sub: `${formatInt(overall.paid_count)} bezahlt` },
    { label: "Offen", value: formatEuro(overall.outstanding_sum), sub: `${formatInt(overall.unpaid_count)} offen` },
    { label: "Durchschnitt", value: formatEuro(overall.avg_value), sub: "pro Rechnung" },
  ];

  overallGrid.innerHTML = cards.map((card) => `
    <div class="stat-card">
      <div class="stat-label">${card.label}</div>
      <div class="stat-value">${card.value}</div>
      ${card.sub ? `<div class="stat-sub">${card.sub}</div>` : ""}
    </div>
  `).join("");
}

function renderByYear(byYear = []) {
  if (!yearBody || !yearEmpty || !yearWrapper) return;

  if (!byYear.length) {
    yearEmpty.classList.remove("hidden");
    yearWrapper.classList.add("hidden");
    yearBody.innerHTML = "";
    return;
  }

  yearEmpty.classList.add("hidden");
  yearWrapper.classList.remove("hidden");
  yearBody.innerHTML = "";

  byYear.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.year}</td>
      <td>${formatInt(row.count)}</td>
      <td>${formatEuro(row.sum_total)}</td>
      <td>${formatEuro(row.paid_sum)}</td>
      <td>${formatEuro(row.outstanding_sum)}</td>
      <td>${formatEuro(row.avg_value)}</td>
    `;
    yearBody.appendChild(tr);
  });
}

async function loadStats(year) {
  setLoading(true);
  clearErrors();
  contentEl?.classList.remove("hidden");
  currentYearFilter = year || "";
  const params = new URLSearchParams();
  if (year) params.append("year", year);
  if (currentCategories.length) params.append("category", currentCategories.join(","));
  const query = params.toString() ? `?${params.toString()}` : "";

  try {
    const res = await fetch(`/api/stats/invoices${query}`, {
      credentials: "include",
    });

    if (res.status === 401) {
      window.location.href = "/login.html";
      return;
    }

    if (res.status === 403) {
      showForbidden();
      return;
    }

    if (!res.ok) {
      showError("Fehler beim Laden der Statistik.");
      return;
    }

    const data = await res.json();

    mergeYears(data.byYear);
    renderCategoryOptions(data.categories || []);
    renderYearOptions();
    renderOverall(data.overall);
    renderByYear(data.byYear);
    updateSelection(year);
  } catch (err) {
    console.error("Statistik-Fehler:", err);
    showError("Fehler beim Laden der Statistik.");
  } finally {
    setLoading(false);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadStats();

  if (yearSelect) {
    yearSelect.addEventListener("change", (e) => {
      currentYearFilter = e.target.value;
      loadStats(currentYearFilter || null);
    });
  }
});
