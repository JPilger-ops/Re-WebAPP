// ID aus URL holen
const url = new URL(window.location.href);
const id = url.searchParams.get("id");

const formatNumber = (value) =>
  Number(value || 0).toLocaleString("de-DE", {
    maximumFractionDigits: 2,
  });

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " €";

// API laden
async function loadInvoice() {
  const res = await fetch(`/api/invoices/${id}`);
  const data = await res.json();

  if (!res.ok) {
    alert("Fehler beim Laden der Rechnung");
    return;
  }

  const inv = data.invoice;
  const items = data.items;

  // Header
  document.getElementById("title").innerText = `Rechnung #${inv.invoice_number}`;

  // Rechnungsdaten
  document.getElementById("d-number").innerText = inv.invoice_number;
  document.getElementById("d-date").innerText = formatDate(inv.date);
  document.getElementById("d-cat").innerText = inv.category;
  document.getElementById("d-reservation").innerText = inv.reservation_request_id || "–";
  document.getElementById("d-reference").innerText = inv.external_reference || "–";

  const status = inv.status_paid_at
    ? "Bezahlt"
    : inv.status_sent
    ? "Versendet"
    : "Entwurf";

  document.getElementById("d-status").innerText = status;

  // Empfänger
  document.getElementById("r-name").innerText = inv.recipient.name;
  document.getElementById("r-street").innerText = inv.recipient.street;
  document.getElementById("r-zip").innerText = inv.recipient.zip;
  document.getElementById("r-city").innerText = inv.recipient.city;

  // Positionen
  const body = document.getElementById("pos-body");
  body.innerHTML = "";

  items.forEach((i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i.description}</td>
      <td>${formatNumber(i.quantity)}</td>
      <td>${formatCurrency(i.unit_price_gross)}</td>
      <td>${formatCurrency(i.line_total_gross)}</td>
    `;
    body.appendChild(tr);
  });

  // Summen
  const net = Number(inv.net_19) + Number(inv.net_7);
  const vat = Number(inv.vat_19) + Number(inv.vat_7);

  document.getElementById("sum-net").innerText = formatCurrency(net);
  document.getElementById("sum-vat").innerText = formatCurrency(vat);
  document.getElementById("sum-total").innerText = formatCurrency(inv.gross_total);

  // PDF Öffnen im neuen Tab (optional)
  const btnOpen = document.getElementById("btn-pdf-open");
  const btnDownload = document.getElementById("btn-pdf-download");
  if (btnOpen) {
    btnOpen.onclick = () => openPdfInline(id);
  }

  // PDF Direkt-Download (erzwingt Download)
  if (btnDownload) {
  btnDownload.onclick = async () => {
    const popup = document.getElementById("download-progress-popup");
    const circle = document.querySelector(".ios-loader-fill");
    const text = document.getElementById("progress-text");

    // ---- Fade-In (iOS) ----
    popup.style.display = "block";
    popup.style.opacity = "0";
    popup.style.transform = "translate(-50%, -52%) scale(0.92)";
    popup.style.transition =
      "opacity 0.6s cubic-bezier(0.22,0.61,0.36,1), transform 0.6s cubic-bezier(0.22,0.61,0.36,1)";

    await new Promise(r => requestAnimationFrame(r));

    popup.style.opacity = "1";
    popup.style.transform = "translate(-50%, -50%) scale(1)";
    await new Promise(r => setTimeout(r, 200));

    // ---- Safari-sicherer Download ----
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = `/api/invoices/${id}/pdf`;
    document.body.appendChild(iframe);

    // ---- Progress simulieren (iOS-Style) ----
    const totalTime = 1600 + Math.random() * 600; // 1.6–2.2s
    const steps = 30;
    const stepTime = totalTime / steps;
    const fullDash = 264;

    for (let s = 0; s <= steps; s++) {
      const p = (s / steps) * 100;
      const dashOffset = fullDash - (fullDash * (p / 100));
      circle.style.strokeDashoffset = dashOffset;
      text.textContent = `${Math.round(p)}%`;

      await new Promise(r => setTimeout(r, stepTime));
    }

    text.textContent = "Fertig";
    circle.style.strokeDashoffset = 0;

    await new Promise(r => setTimeout(r, 800));

    iframe.remove(); // cleanup

    // ---- Fade-Out (iOS) ----
    popup.style.opacity = "1";
    popup.style.transform = "translate(-50%, -50%) scale(1)";
    await new Promise(r => requestAnimationFrame(r));

    popup.style.opacity = "0";
    popup.style.transform = "translate(-50%, -48%) scale(0.94)";

    await new Promise(r => setTimeout(r, 800));

    popup.style.display = "none";
    popup.style.opacity = "";
    popup.style.transform = "";
    popup.style.transition = "";

    // Reset für nächste Nutzung
    text.textContent = "0%";
    circle.style.strokeDashoffset = fullDash;
  };
}
}

// Status ändern
async function setStatus(type) {
  let url = "";

  if (type === "sent") url = `/api/invoices/${id}/status/sent`;
  if (type === "paid") url = `/api/invoices/${id}/status/paid`;

  const res = await fetch(url, { method: "POST" });

  if (!res.ok) {
    alert("Fehler beim Aktualisieren des Status");
    return;
  }

  alert("Status aktualisiert");
  loadInvoice();
}

function formatDate(v) {
  if (!v) return "";
  return new Date(v).toLocaleDateString("de-DE");
}

loadInvoice();

async function openPdfInline(invoiceId) {
  const url = `/api/invoices/${invoiceId}/pdf?mode=inline`;

  // Versuch 1: direktes window.open (wenn Popup erlaubt + Cookie mitgeschickt)
  const win = window.open(url, "_blank", "noopener");
  if (win) return;

  // Fallback: PDF als Blob holen und in neuem Tab öffnen
  try {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) {
      alert("PDF konnte nicht geladen werden (Fehler " + res.status + ").");
      return;
    }
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
  } catch (err) {
    console.error("PDF laden fehlgeschlagen:", err);
    alert("PDF konnte nicht geladen werden.");
  }
}
