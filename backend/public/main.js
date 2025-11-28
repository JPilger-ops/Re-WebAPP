// ---------------------------------------------------------
// Rechnungen abrufen
// ---------------------------------------------------------
async function fetchInvoices() {
  const res = await fetch("/api/invoices", {
    method: "GET",
    credentials: "include",
  });

  if (res.status === 401) {
    window.location.href = "/login.html";
    return [];
  }

  if (!res.ok) {
    throw new Error("Fehler beim Laden der Rechnungen");
  }

  return res.json();
}

// ---------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------
function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatAmount(value) {
  const num = Number(value || 0);
  return num.toFixed(2) + " €";
}

// ---------------------------------------------------------
// Rechnungsstatus bestimmen
// ---------------------------------------------------------
function getStatus(inv) {
  const now = new Date();

  if (inv.status_paid_at) return { key: "paid", label: "Bezahlt" };

  const dueBase = inv.due_date || inv.date;
  if (dueBase) {
    const due = new Date(dueBase);
    if (due < now && !inv.status_paid_at) {
      return { key: "overdue", label: "Überfällig" };
    }
  }

  if (inv.status_sent) return { key: "sent", label: "Versendet" };

  return { key: "open", label: "Offen" };
}

// ---------------------------------------------------------
// KPIs aktualisieren
// ---------------------------------------------------------
function updateKpis(invoices) {
  const elCreated = document.getElementById("kpi-created");
  const elSent = document.getElementById("kpi-sent");
  const elPaid = document.getElementById("kpi-paid");
  const elOverdue = document.getElementById("kpi-overdue");

  if (!Array.isArray(invoices)) invoices = [];

  const now = new Date();

  const total = invoices.length;
  const sent = invoices.filter(i => i.status_sent).length;
  const paid = invoices.filter(i => i.status_paid_at).length;

  const overdue = invoices.filter(i => {
    const base = i.due_date || i.date;
    if (!base || i.status_paid_at) return false;
    const d = new Date(base);
    return d < now;
  }).length;

  elCreated.textContent = total;
  elSent.textContent = sent;
  elPaid.textContent = paid;
  elOverdue.textContent = overdue;
}

// ---------------------------------------------------------
// Tabelle rendern
// ---------------------------------------------------------
function renderTable(invoices) {
  const tbody = document.getElementById("invoice-table-body");
  tbody.innerHTML = "";

  if (!Array.isArray(invoices) || invoices.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.textContent = "Keine Rechnungen vorhanden.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  const latest = [...invoices]
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, 10);

  for (const inv of latest) {
    const status = getStatus(inv);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>#${inv.invoice_number}</td>
      <td>${inv.recipient_name || ""}</td>
      <td>${formatDate(inv.date)}</td>
      <td>${formatAmount(inv.gross_total)}</td>
      <td>
        <span class="badge badge-${status.key}">
          ${status.label}
        </span>
      </td>
    `;
    tbody.appendChild(tr);
  }
}

// ---------------------------------------------------------
// Dashboard initialisieren
// ---------------------------------------------------------
async function initDashboard() {
  try {
    const invoices = await fetchInvoices();
    updateKpis(invoices);
    renderTable(invoices);
  } catch (err) {
    console.error("Dashboard-Fehler:", err);
    alert("Fehler beim Laden der Dashboard-Daten.");
    return;
  }

  const btn = document.getElementById("btn-create");
  if (btn) {
    btn.addEventListener("click", () => {
      window.location.href = "/create.html";
    });
  }
}

document.addEventListener("DOMContentLoaded", initDashboard);