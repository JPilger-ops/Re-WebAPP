let allInvoices = [];
let currentEmailInvoice = null;
let currentEmailPreview = null;
let bankDataCache = null;
let bankDataRequest = null;
let datevSettingsCache = null;
let datevSettingsRequest = null;
const datevExporting = new Set();
let messageEdited = false;
let suppressMessageChangeEvent = false;

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

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const messageToHtml = (text) => escapeHtml(text || "").replace(/\n/g, "<br>");
const getDatevEmailFromCache = () => (datevSettingsCache?.email || "").trim();

function buildFallbackEmail(invoice, bankData) {
  const invoiceDate = formatDateDe(invoice.date);
  const dueDate = formatDateDe(addDays(invoice.date, 14));
  const bankName = bankData?.bank_name || "-";
  const ibanDisplay = formatIban(bankData?.iban);
  const bicDisplay = (bankData?.bic || "-").toUpperCase();

  const amountValue = invoice.b2b
    ? numberOrZero(invoice.net_19) + numberOrZero(invoice.net_7)
    : numberOrZero(invoice.gross_total);

  const amountDisplay = formatAmount(amountValue);
  const defaultSubject = `Rechnung Nr. ${invoice.invoice_number}`;
  const defaultMessage = `Hallo ${invoice.recipient_name || "Kunde"},

anbei erhältst du deine Rechnung Nr. ${invoice.invoice_number} vom ${invoiceDate}.

Der Betrag von ${amountDisplay} € ist fällig bis ${dueDate}.

Bankverbindung:
${bankName}
IBAN: ${ibanDisplay}
BIC: ${bicDisplay}

Bei Fragen melde dich gerne jederzeit.

Vielen Dank!

Beste Grüße
Waldwirtschaft Heidekönig
Thomas Pilger
02241 76649`;

  return { subject: defaultSubject, body: defaultMessage };
}

async function loadEmailPreview(invoiceId) {
  const res = await fetch(`/api/invoices/${invoiceId}/email-preview`, {
    method: "GET",
    credentials: "include",
  });
  const data = await res.json().catch(() => null);

  if (res.status === 401) {
    window.location.href = "/login.html";
    return null;
  }

  if (!res.ok) {
    const msg = data?.message || "E-Mail-Vorlage konnte nicht geladen werden.";
    throw new Error(msg);
  }

  return data;
}

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

async function loadDatevSettings(force = false) {
  if (datevSettingsCache && !force) return datevSettingsCache;
  if (!datevSettingsRequest || force) {
    datevSettingsRequest = fetch("/api/settings/datev", { credentials: "include" })
      .then(async (res) => {
        if (res.status === 401) {
          window.location.href = "/login.html";
          return null;
        }
        if (!res.ok) return null;
        return res.json();
      })
      .catch(() => null);
  }

  const data = await datevSettingsRequest;
  if (data) {
    datevSettingsCache = data;
  } else if (force) {
    datevSettingsCache = null;
  }
  return datevSettingsCache;
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

function renderDatevBadge(invoice) {
  const statusRaw = (invoice.datev_export_status || "NOT_SENT").toString().toUpperCase();
  const exportedAt = invoice.datev_exported_at ? new Date(invoice.datev_exported_at) : null;
  const error = invoice.datev_export_error;

  if (statusRaw === "SENT") {
    const suffix = exportedAt ? ` · ${exportedAt.toLocaleDateString("de-DE")} ${exportedAt.toLocaleTimeString("de-DE")}` : "";
    return `<span class="status-badge status-datev-sent">DATEV: Gesendet${suffix}</span>`;
  }

  if (statusRaw === "FAILED") {
    const title = error ? ` title="${escapeHtml(error)}"` : "";
    return `<span class="status-badge status-datev-failed"${title}>DATEV: Fehlgeschlagen</span>`;
  }

  return `<span class="status-badge status-datev-open">DATEV: Offen</span>`;
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
    td.colSpan = 8;
    td.textContent = "Keine Rechnungen gefunden.";
    tr.appendChild(td);
    body.appendChild(tr);
    return;
  }

  list.forEach(i => {
    const tr = document.createElement("tr");
    const datevBadge = renderDatevBadge(i);
    const datevEmailKnown = datevSettingsCache !== null;
    const datevEmailSet = !!getDatevEmailFromCache();
    const exportInProgress = datevExporting.has(Number(i.id));
    const exportDisabled = exportInProgress || (datevEmailKnown && !datevEmailSet);
    const exportLabel = exportInProgress ? "Senden..." : "DATEV EXPORT";
    const exportTitle = datevEmailKnown && !datevEmailSet
      ? "Keine DATEV-E-Mail hinterlegt. Bitte in den Einstellungen speichern."
      : "Rechnung an DATEV senden.";

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
      <td>${datevBadge}</td>
      <td>
        <button onclick="openInvoice(${i.id})">Öffnen</button>
        <button class="success-button small-btn" ${exportDisabled ? "disabled" : ""} title="${escapeHtml(exportTitle)}" onclick="exportInvoiceToDatev(${i.id})">${exportLabel}</button>
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

async function exportInvoiceToDatev(id) {
  const invoiceId = Number(id);
  const invoice = allInvoices.find((inv) => Number(inv.id) === invoiceId);
  await loadDatevSettings();
  const datevEmailKnown = datevSettingsCache !== null;
  const datevEmailSet = !!getDatevEmailFromCache();

  if (datevEmailKnown && !datevEmailSet) {
    alert("Keine DATEV-E-Mail hinterlegt. Bitte unter Einstellungen → DATEV speichern.");
    return;
  }

  datevExporting.add(invoiceId);
  renderList();

  try {
    const res = await fetch(`/api/invoices/${invoiceId}/datev-export`, {
      method: "POST",
      credentials: "include",
    });

    const body = await res.json().catch(() => null);

    if (res.status === 401) {
      window.location.href = "/login.html";
      return;
    }

    if (!res.ok) {
      const msg = body?.message || "DATEV Export fehlgeschlagen.";
      alert(msg + "\n\nHinweis: DATEV-E-Mail unter Einstellungen hinterlegen.");
      return;
    }

    const label = invoice ? `Rechnung #${invoice.invoice_number}` : "Rechnung";
    alert(body?.message || `${label} wurde an DATEV gesendet.`);
    await loadInvoices();
  } catch (err) {
    console.error("DATEV Export fehlgeschlagen", err);
    alert("DATEV Export fehlgeschlagen. Bitte erneut versuchen.");
  } finally {
    datevExporting.delete(invoiceId);
    renderList();
  }
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
  currentEmailPreview = null;

  const toInput = document.getElementById("email-to");
  const subjectInput = document.getElementById("email-subject");
  const messageInput = document.getElementById("email-message");
  const title = document.getElementById("email-modal-title");
  const subtitle = document.getElementById("email-modal-subtitle");
  const sendBtn = document.getElementById("email-send");
  const sendDatevBtn = document.getElementById("email-send-datev");
  const templateInfo = document.getElementById("email-template-info");
  const fromInfo = document.getElementById("email-from-info");
  const datevInfo = document.getElementById("email-datev-info");
  const templateNote = document.getElementById("email-template-note");
  messageEdited = false;

  if (sendBtn) {
    sendBtn.disabled = false;
    sendBtn.textContent = "Senden";
  }
  if (sendDatevBtn) {
    sendDatevBtn.disabled = true;
    sendDatevBtn.textContent = "Senden + DATEV";
  }

  if (title) title.textContent = "Rechnung per E-Mail versenden";
  if (subtitle) {
    const recipientLabel = invoice.recipient_name || "Empfänger";
    const catLabel = invoice.category_label || invoice.category || "";
    const suffix = catLabel ? ` · ${catLabel}` : "";
    subtitle.textContent = `Rechnung #${invoice.invoice_number} an ${recipientLabel}${suffix}`;
  }

  const bankData = await loadBankData();
  const fallback = buildFallbackEmail(invoice, bankData || {});

  suppressMessageChangeEvent = true;
  if (toInput) toInput.value = invoice.recipient_email || "";
  if (subjectInput) subjectInput.value = fallback.subject;
  if (messageInput) messageInput.value = fallback.body;
  suppressMessageChangeEvent = false;
  if (templateInfo) templateInfo.textContent = "Vorlage wird geladen…";
  if (fromInfo) fromInfo.textContent = "Absender wird geladen…";
  if (datevInfo) {
    datevInfo.textContent = "DATEV wird geladen…";
    datevInfo.style.background = "#f5f5f7";
    datevInfo.style.color = "#4a4a4a";
  }
  if (templateNote) templateNote.textContent = "Nachricht basiert auf der Kategorien-Vorlage und kann angepasst werden.";

  setEmailStatus("Lade E-Mail-Vorlage…", "info");

  try {
    await loadDatevSettings();
    const preview = await loadEmailPreview(invoiceId);
    if (preview) {
      currentEmailPreview = preview;
      suppressMessageChangeEvent = true;
      if (subjectInput) subjectInput.value = preview.subject || fallback.subject;
      if (messageInput) messageInput.value = preview.body_text || fallback.body;
      suppressMessageChangeEvent = false;
      messageEdited = false;
      if (templateInfo) {
        templateInfo.textContent = preview.template_used
          ? `Vorlage: ${preview.category?.label || preview.category?.key || "Kategorie"}`
          : "Standard-Text (keine Kategorie-Vorlage)";
      }
      if (fromInfo) {
        fromInfo.textContent = preview.from
          ? `Absender: ${preview.from}${preview.using_category_account ? " · Kategorie-Konto" : " · Standard"}`
          : "Absender: Standard-SMTP";
      }
      if (templateNote) {
        templateNote.textContent = preview.template_used
          ? "Vorlage geladen. Du kannst Text und Empfänger noch anpassen."
          : "Standard-Text geladen. Du kannst Text und Empfänger anpassen.";
      }
      setEmailStatus(preview.template_used ? "Kategorie-Vorlage angewendet." : "Standard-Text geladen.", "info");
      if (!preview.smtp_ready) {
        setEmailStatus("Hinweis: Es ist kein SMTP-Konto hinterlegt. Bitte Kategorie- oder Standard-SMTP prüfen.", "error");
      }
      const datevEmail = (preview.datev_email || getDatevEmailFromCache() || "").trim();
      const hasDatevEmail = Boolean(datevEmail);
      if (datevInfo) {
        datevInfo.textContent = hasDatevEmail ? `DATEV: ${datevEmail}` : "DATEV: nicht hinterlegt";
        datevInfo.style.background = hasDatevEmail ? "#e7ffe5" : "#fff5e5";
        datevInfo.style.color = hasDatevEmail ? "#0a7c2f" : "#b20000";
      }
      if (sendDatevBtn) {
        sendDatevBtn.disabled = !hasDatevEmail;
        sendDatevBtn.title = hasDatevEmail
          ? "E-Mail zusätzlich an DATEV senden"
          : "Bitte DATEV-E-Mail in den Einstellungen hinterlegen.";
      }
    }
  } catch (err) {
    console.error("E-Mail-Vorlage laden fehlgeschlagen:", err);
    if (templateInfo) templateInfo.textContent = "Standard-Text (Fallback)";
    if (fromInfo) fromInfo.textContent = "Absender: Standard-SMTP";
    if (templateNote) templateNote.textContent = "Vorlage konnte nicht geladen werden. Standardtext verwendet.";
    const cachedDatev = getDatevEmailFromCache();
    const hasCachedDatev = Boolean(cachedDatev);
    if (datevInfo) {
      datevInfo.textContent = hasCachedDatev ? `DATEV: ${cachedDatev}` : "DATEV: unbekannt";
      datevInfo.style.background = hasCachedDatev ? "#e7ffe5" : "#fff5e5";
      datevInfo.style.color = hasCachedDatev ? "#0a7c2f" : "#b20000";
    }
    if (sendDatevBtn) {
      sendDatevBtn.disabled = !hasCachedDatev;
      sendDatevBtn.title = hasCachedDatev
        ? "E-Mail zusätzlich an DATEV senden"
        : "Bitte DATEV-E-Mail in den Einstellungen hinterlegen.";
    }
    setEmailStatus(err.message || "Vorlage konnte nicht geladen werden.", "error");
  }

  modal.classList.remove("hidden");
}

function closeEmailModal() {
  const modal = document.getElementById("email-modal");
  if (modal) modal.classList.add("hidden");
  currentEmailInvoice = null;
  currentEmailPreview = null;
  messageEdited = false;
  setEmailStatus("");
}

async function sendEmailForInvoice(includeDatev = false) {
  if (!currentEmailInvoice) {
    alert("Keine Rechnung ausgewählt.");
    return;
  }

  const toInput = document.getElementById("email-to");
  const subjectInput = document.getElementById("email-subject");
  const messageInput = document.getElementById("email-message");
  const sendBtn = document.getElementById("email-send");
  const sendDatevBtn = document.getElementById("email-send-datev");

  const email = (toInput?.value || "").trim();
  const subject = (subjectInput?.value || "").trim();
  const message = messageInput?.value || "";
  const trimmedMessage = message.trim();
  const previewBody = (currentEmailPreview?.body_text || "").trim();

  if (!email) {
    setEmailStatus("Bitte eine E-Mail-Adresse angeben.", "error");
    return;
  }

  const targetBtn = includeDatev ? sendDatevBtn : sendBtn;

  if (targetBtn) {
    targetBtn.disabled = true;
    targetBtn.textContent = includeDatev ? "Senden + DATEV…" : "Senden…";
  }
  if (!includeDatev && sendDatevBtn) {
    sendDatevBtn.disabled = true;
  }
  setEmailStatus(includeDatev ? "Sende E-Mail + DATEV…" : "Sende E-Mail…", "info");

  try {
    const htmlPayload =
      !messageEdited && currentEmailPreview?.body_html
        ? currentEmailPreview.body_html
        : messageToHtml(message);

    const res = await fetch(`/api/invoices/${currentEmailInvoice.id}/send-email`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to: email, subject, message, html: htmlPayload, include_datev: includeDatev })
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const msg = data?.message || "E-Mail konnte nicht versendet werden.";
      setEmailStatus(msg, "error");
      return;
    }

    const successMsg = includeDatev ? "E-Mail (inkl. DATEV) wurde verschickt." : "E-Mail wurde verschickt.";
    setEmailStatus(data?.message || successMsg, "success");
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
    if (sendDatevBtn) {
      sendDatevBtn.disabled = false;
      sendDatevBtn.textContent = "Senden + DATEV";
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
document.getElementById("email-send")?.addEventListener("click", () => sendEmailForInvoice(false));
document.getElementById("email-send-datev")?.addEventListener("click", () => sendEmailForInvoice(true));
document.getElementById("email-cancel")?.addEventListener("click", closeEmailModal);
document.getElementById("email-close")?.addEventListener("click", closeEmailModal);
document.getElementById("email-modal")?.addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeEmailModal();
});
document.getElementById("email-message")?.addEventListener("input", () => {
  if (suppressMessageChangeEvent) return;
  messageEdited = true;
});

// Start
(async () => {
  await waitForPermissions();
  await Promise.all([loadDatevSettings().catch(() => null), loadInvoices()]);
  renderList();
  applyPermissionVisibility();
})();
