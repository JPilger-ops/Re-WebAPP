let allInvoices = [];
let currentEmailInvoice = null;
let bankDataCache = null;
let bankDataRequest = null;

const numberOrZero = (value) => Number(value) || 0;

const addDays = (value, days) => {
  const date = new Date(value);
  if (isNaN(date)) return null;
  date.setDate(date.getDate() + days);
  return date;
};

const formatDateDe = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  return isNaN(date) ? "-" : date.toLocaleDateString("de-DE");
};

const formatIban = (iban) => {
  if (!iban) return "-";
  return iban.replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim();
};

const formatAmount = (value) =>
  numberOrZero(value).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

async function loadBankData() {
  if (bankDataCache) return bankDataCache;
  if (!bankDataRequest) {
    bankDataRequest = fetch("/api/settings/bank", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);
  }
  const data = await bankDataRequest;
  if (data) bankDataCache = data;
  return bankDataCache;
}

async function waitForPermissions() {
  return new Promise(resolve => {
    const check = () => {
      if (window.currentUserPermissions && window.currentUserPermissions.length > 0) {
        resolve();
      } else {
        setTimeout(check, 50);
      }
    };
    check();
  });
}

//---Rechteabfrage---
function applyPermissionVisibility() {
  const perms = window.currentUserPermissions || [];

  // Multi-Download (PDF)
  if (!perms.includes("invoices.export")) {
    const el = document.getElementById("btn-multi-download");
    if (el) el.style.display = "none";
  }

  // Multi-Delete
  if (!perms.includes("invoices.delete")) {
    const el = document.getElementById("btn-multi-delete");
    if (el) el.style.display = "none";
  }
}

function safeDownload(id) {
  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  iframe.src = `/api/invoices/${id}/pdf`;
  document.body.appendChild(iframe);

  // iframe später entfernen
  setTimeout(() => iframe.remove(), 4000);
}

// ---------------------------------------------------------
// Rechnungen laden
// ---------------------------------------------------------
async function loadInvoices() {
  const res = await fetch("/api/invoices", {
    method: "GET",
    credentials: "include",
  });

  // Nicht eingeloggt?
  if (res.status === 401) {
    window.location.href = "/login.html";
    return;
  }

  if (!res.ok) {
    alert("Fehler beim Laden der Rechnungen");
    return;
  }

  const data = await res.json();
  allInvoices = data;
  renderList();
}

// ---------------------------------------------------------
// Liste rendern
// ---------------------------------------------------------
function renderList() {
  let list = [...allInvoices];

  // Suche
  const search = document.getElementById("search").value.toLowerCase();
  if (search.length > 0) {
    list = list.filter(i =>
      (i.recipient_name || "").toLowerCase().includes(search) ||
      String(i.invoice_number).includes(search)
    );
  }

  // Filter
  const filter = document.getElementById("filter").value;
  if (filter === "open") {
    list = list.filter(i => !i.status_sent && !i.status_paid_at);
  }
  if (filter === "sent") {
    list = list.filter(i => i.status_sent && !i.status_paid_at);
  }
  if (filter === "paid") {
    list = list.filter(i => i.status_paid_at);
  }

  // Sortierung
  const sort = document.getElementById("sort").value;
  list.sort((a, b) => {
    switch (sort) {
      case "date_desc": return new Date(b.date) - new Date(a.date);
      case "date_asc": return new Date(a.date) - new Date(b.date);
      case "num_desc": return b.invoice_number - a.invoice_number;
      case "num_asc": return a.invoice_number - b.invoice_number;
      case "total_desc": return b.gross_total - a.gross_total;
      case "total_asc": return a.gross_total - b.gross_total;
    }
  });

  // Rendern
  const body = document.getElementById("invoice-list");
  body.innerHTML = "";

  if (list.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 7;
    td.textContent = "Keine Rechnungen gefunden.";
    tr.appendChild(td);
    body.appendChild(tr);
    return;
  }

  list.forEach(i => {
    const tr = document.createElement("tr");

    let status = `<span class="status-badge status-open">Offen</span>`;
    if (i.status_paid_at) status = `<span class="status-badge status-paid">Bezahlt</span>`;
    else if (i.status_sent) status = `<span class="status-badge status-sent">Versendet</span>`;

    tr.innerHTML = `
      <td>
        <input type="checkbox" class="invoice-checkbox" data-id="${i.id}">
      </td>
      <td>${i.invoice_number}</td>
      <td>${(new Date(i.date)).toLocaleDateString("de-DE")}</td>
      <td>${i.recipient_name || "-"}</td>
      <td>${Number(i.gross_total).toFixed(2)} €</td>
      <td>${status}</td>
      <td>
        <button onclick="openInvoice(${i.id})">Öffnen</button>
        <button class="secondary-button small-btn" onclick="openEmailModal(${i.id})">Verschicken per E-Mail</button>

        ${
          (window.currentUserPermissions || []).includes("invoices.delete")
            ? `<button onclick="deleteInvoice(${i.id}, '${i.invoice_number}')">Löschen</button>`
            : ""
        }
      </td>
    `;

    body.appendChild(tr);
  });

  setupSelectAllHandler();
}

// ---------------------------------------------------------
// Rechnung öffnen
// ---------------------------------------------------------
function openInvoice(id) {
  window.location.href = `/invoice.html?id=${id}`;
}

// ---------------------------------------------------------
// Multi-Select: IDs einsammeln
// ---------------------------------------------------------
function getSelectedInvoiceIds() {
  return Array.from(
    document.querySelectorAll(".invoice-checkbox:checked")
  ).map(cb => cb.dataset.id);
}

// ---------------------------------------------------------
// Ausgewählte herunterladen
// ---------------------------------------------------------
async function downloadSelectedInvoices() {
  const ids = getSelectedInvoiceIds();
  if (ids.length === 0) {
    alert("Bitte mindestens eine Rechnung auswählen.");
    return;
  }

  const popup = document.getElementById("download-progress-popup");
  const circle = document.querySelector(".ios-loader-fill");
  const text = document.getElementById("progress-text");

  // ---- iOS STYLE FADE-IN --------------------------------------------------

  popup.style.display = "block";

  // Startzustand
  popup.style.opacity = "0";
  popup.style.transform = "translate(-50%, -52%) scale(0.92)";
  popup.style.transition =
    "opacity 0.6s cubic-bezier(0.22,0.61,0.36,1), transform 0.6s cubic-bezier(0.22,0.61,0.36,1)";

  // Browser Frame warten lassen, damit opacity=0 sichtbar wird
  await new Promise(res => requestAnimationFrame(() => res()));

  // Fade-In Zielzustand
  popup.style.opacity = "1";
  popup.style.transform = "translate(-50%, -50%) scale(1)";

  // kleinen Moment warten, bis das Fade-In vollständig sichtbar ist
  await new Promise(res => setTimeout(res, 200));

  // -------------------------------------------------------------------------

  // SAFARI kompatibler Kreis-Progress
  const total = ids.length;
  const fullDash = 264;
  let progressPercent = 0;

  const minStepTime = 550;
  const maxStepTime = 750;

  for (let i = 0; i < total; i++) {
    const id = ids[i];
    safeDownload(id);

    const target = Math.round(((i + 1) / total) * 100);
    const duration = minStepTime + Math.random() * (maxStepTime - minStepTime);
    const stepCount = 20;
    const stepTime = duration / stepCount;
    const stepIncrease = (target - progressPercent) / stepCount;

    for (let s = 0; s < stepCount; s++) {
      progressPercent += stepIncrease;

      const dashOffset = fullDash - (fullDash * (progressPercent / 100));
      circle.style.strokeDashoffset = dashOffset;
      text.textContent = `${Math.round(progressPercent)}%`;

      await new Promise(res => setTimeout(res, stepTime));
    }
  }

  // Final halten
  text.textContent = "Fertig";
  circle.style.strokeDashoffset = 0;
  await new Promise(res => setTimeout(res, 2000));

  // ---- iOS STYLE FADE-OUT --------------------------------------------------

  popup.style.opacity = "1";
  popup.style.transform = "translate(-50%, -50%) scale(1)";

  await new Promise(res => requestAnimationFrame(() => res()));

  // Zielzustand Fade-Out
  popup.style.opacity = "0";
  popup.style.transform = "translate(-50%, -48%) scale(0.94)";

  await new Promise(res => setTimeout(res, 800));

  // vollständig verstecken + Reset
  popup.style.display = "none";
  popup.style.opacity = "";
  popup.style.transform = "translate(-50%, -50%)";
  popup.style.transition = "";

  text.textContent = "0%";
  circle.style.strokeDashoffset = fullDash;
}

// ---------------------------------------------------------
// Ausgewählte löschen
// ---------------------------------------------------------
async function deleteSelectedInvoices() {
  const ids = getSelectedInvoiceIds();

  if (ids.length === 0) {
    alert("Bitte mindestens eine Rechnung auswählen.");
    return;
  }

  if (!confirm(`${ids.length} Rechnung(en) wirklich löschen?`)) return;

  for (const id of ids) {
    await fetch(`/api/invoices/${id}`, {
      method: "DELETE",
      credentials: "include"
    });
  }

  loadInvoices();
}

// ---------------------------------------------------------
// Einzelne Rechnung löschen
// ---------------------------------------------------------
async function deleteInvoice(id, number) {
  const ok = confirm(`Rechnung #${number} wirklich löschen? Dieser Vorgang kann nicht rückgängig gemacht werden.`);
  if (!ok) return;

  const res = await fetch(`/api/invoices/${id}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (res.status === 401) {
    window.location.href = "/login.html";
    return;
  }

  if (!res.ok) {
    alert("Fehler beim Löschen der Rechnung");
    return;
  }

  alert("Rechnung gelöscht");
  loadInvoices();
}

// ---------------------------------------------------------
// Rechnung per E-Mail versenden
// ---------------------------------------------------------
function setEmailStatus(message, type = "info") {
  const statusEl = document.getElementById("email-status");
  if (!statusEl) return;

  statusEl.textContent = message || "";

  if (type === "error") statusEl.style.color = "#b20000";
  else if (type === "success") statusEl.style.color = "#0a7c2f";
  else statusEl.style.color = "#444";
}

async function openEmailModal(invoiceId) {
  const modal = document.getElementById("email-modal");
  const invoice = allInvoices.find(inv => Number(inv.id) === Number(invoiceId));

  if (!invoice || !modal) {
    alert("Rechnung konnte nicht gefunden werden.");
    return;
  }

  currentEmailInvoice = invoice;

  const toInput = document.getElementById("email-to");
  const subjectInput = document.getElementById("email-subject");
  const messageInput = document.getElementById("email-message");
  const title = document.getElementById("email-modal-title");
  const subtitle = document.getElementById("email-modal-subtitle");
  const sendBtn = document.getElementById("email-send");

  if (sendBtn) {
    sendBtn.disabled = false;
    sendBtn.textContent = "Senden";
  }

  if (title) title.textContent = "Rechnung per E-Mail versenden";
  if (subtitle) {
    const recipientLabel = invoice.recipient_name || "Empfänger";
    subtitle.textContent = `Rechnung #${invoice.invoice_number} an ${recipientLabel}`;
  }

  const bankData = await loadBankData();
  const invoiceDate = formatDateDe(invoice.date);
  const serviceDate = formatDateDe(invoice.receipt_date || invoice.date);
  const dueDate = formatDateDe(addDays(invoice.date, 14));

  const bankName = bankData?.bank_name || "-";
  const ibanDisplay = formatIban(bankData?.iban);
  const bicDisplay = (bankData?.bic || "-").toUpperCase();

  const amountValue = invoice.b2b
    ? numberOrZero(invoice.net_19) + numberOrZero(invoice.net_7)
    : numberOrZero(invoice.gross_total);

  const amountDisplay = formatAmount(amountValue);

  const senderName = "Thomas Pilger";
  const senderCompany = "Waldwirtschaft Heidekönig";
  const senderPhone = "02241 76649";
  const senderEmail = "Rechnungen@der-heidekoenig.de";

  const defaultSubject = `Rechnung Nr. ${invoice.invoice_number}`;
  const defaultMessage = `Hallo ${invoice.recipient_name || "Kunde"},\n\nanbei erhältst du deine Rechnung Nr. ${invoice.invoice_number} vom ${invoiceDate}.\n\nDer Betrag von ${amountDisplay} € ist fällig bis ${dueDate}.\n\nBankverbindung:\n${bankName}\nIBAN: ${ibanDisplay}\nBIC: ${bicDisplay}\n\nBei Fragen melde dich gerne jederzeit.\n\nVielen Dank!\n\nBeste Grüße\n${senderName}\n${senderCompany}\n${senderPhone}\n${senderEmail}`;

  if (toInput) toInput.value = invoice.recipient_email || "";
  if (subjectInput) subjectInput.value = defaultSubject;
  if (messageInput) messageInput.value = defaultMessage;

  setEmailStatus("");
  modal.classList.remove("hidden");
}

function closeEmailModal() {
  const modal = document.getElementById("email-modal");
  if (modal) modal.classList.add("hidden");
  currentEmailInvoice = null;
  setEmailStatus("");
}

async function sendEmailForInvoice() {
  if (!currentEmailInvoice) {
    alert("Keine Rechnung ausgewählt.");
    return;
  }

  const toInput = document.getElementById("email-to");
  const subjectInput = document.getElementById("email-subject");
  const messageInput = document.getElementById("email-message");
  const sendBtn = document.getElementById("email-send");

  const email = (toInput?.value || "").trim();
  const subject = (subjectInput?.value || "").trim();
  const message = messageInput?.value || "";

  if (!email) {
    setEmailStatus("Bitte eine E-Mail-Adresse angeben.", "error");
    return;
  }

  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.textContent = "Senden…";
  }
  setEmailStatus("Sende E-Mail…", "info");

  try {
    const res = await fetch(`/api/invoices/${currentEmailInvoice.id}/send-email`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to: email, subject, message })
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const msg = data?.message || "E-Mail konnte nicht versendet werden.";
      setEmailStatus(msg, "error");
      return;
    }

    setEmailStatus(data?.message || "E-Mail wurde verschickt.", "success");
    await loadInvoices();
    setTimeout(() => closeEmailModal(), 700);
  } catch (err) {
    console.error("Fehler beim Versand:", err);
    setEmailStatus("E-Mail konnte nicht versendet werden.", "error");
  } finally {
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.textContent = "Senden";
    }
  }
}

// ---------------------------------------------------------
// Select-All Checkbox Handler
// ---------------------------------------------------------
function setupSelectAllHandler() {
  const selectAll = document.getElementById("select-all");
  if (!selectAll) return;

  selectAll.onclick = () => {
    const state = selectAll.checked;
    document.querySelectorAll(".invoice-checkbox").forEach(cb => {
      cb.checked = state;
    });
  };
}

// ---------------------------------------------------------
// Event-Listener
// ---------------------------------------------------------
document.getElementById("search").addEventListener("input", renderList);
document.getElementById("filter").addEventListener("change", renderList);
document.getElementById("sort").addEventListener("change", renderList);

// Buttons mit Funktionen verbinden
document.getElementById("btn-multi-download")?.addEventListener("click", downloadSelectedInvoices);
document.getElementById("btn-multi-delete")?.addEventListener("click", deleteSelectedInvoices);
document.getElementById("email-send")?.addEventListener("click", sendEmailForInvoice);
document.getElementById("email-cancel")?.addEventListener("click", closeEmailModal);
document.getElementById("email-close")?.addEventListener("click", closeEmailModal);
document.getElementById("email-modal")?.addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeEmailModal();
});

// Start
(async () => {
  await waitForPermissions();
  await loadInvoices();
  applyPermissionVisibility();
})();
