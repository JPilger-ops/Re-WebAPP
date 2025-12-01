let items = [];
let autoNumberActive = true;

// Formular-Felder referenzieren
const r_name   = document.getElementById("r_name");
const r_street = document.getElementById("r_street");
const r_zip    = document.getElementById("r_zip");
const r_city   = document.getElementById("r_city");

// Rechnungs-Felder
const i_number   = document.getElementById("i_number");
const i_date     = document.getElementById("i_date");
const i_category = document.getElementById("i_category");
const i_receipt  = document.getElementById("i_receipt");
const b2b_check = document.getElementById("b2b_check");
const ust_id = document.getElementById("ust_id");
const ust_wrapper = document.getElementById("ustid_wrapper");

// -------------------------------------------------
// 🔥 Fehlerbox & Fehler-Styles
// -------------------------------------------------
function showError(msg) {
  const box = document.getElementById("error-box");
  if (!box) return;
  box.textContent = msg;
  box.classList.remove("hidden");
}

function clearErrors() {
  const box = document.getElementById("error-box");
  if (box) {
    box.classList.add("hidden");
    box.textContent = "";
  }

  document.querySelectorAll(".input-error").forEach((el) => {
    el.classList.remove("input-error");
  });
}

// -------------------------------------------------------------
// 🔍 Nur Kunden-Suchfeld (AutoComplete – kein Dropdown)
// -------------------------------------------------------------
let allCustomers = [];

async function loadCustomers() {
  const res = await fetch("/api/customers", {
    credentials: "include",
  });
  allCustomers = await res.json();

  const search = document.getElementById("customer-search");
  const results = document.getElementById("customer-results");

  // Eingabe im Suchfeld
  search.oninput = () => {
    // 🔗 Suchfeld = Name (auch für neue Kunden)
    r_name.value = search.value;
    const q = search.value.toLowerCase();

    if (!q) {
      results.classList.add("hidden");
      results.innerHTML = "";
      return;
    }

    const filtered = allCustomers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.city.toLowerCase().includes(q) ||
      c.street.toLowerCase().includes(q)
    );

    if (filtered.length === 0) {
      results.classList.add("hidden");
      results.innerHTML = "";
      return;
    }

    results.innerHTML = filtered
      .map(c => `<div data-id="${c.id}">${c.name} – ${c.city}</div>`)
      .join("");

    results.classList.remove("hidden");

    [...results.children].forEach(el => {
      el.onclick = () => {
        const id = Number(el.dataset.id);
        const c = allCustomers.find(c => c.id === id);

        // Felder füllen
        r_name.value   = c.name;
        r_street.value = c.street;
        r_zip.value    = c.zip;
        r_city.value   = c.city;

        // Suchfeld setzen
        search.value = c.name;

        // Ergebnisliste ausblenden
        results.classList.add("hidden");
      };
    });
  };

  // wenn man außerhalb klickt → Liste schließen
  document.addEventListener("click", (e) => {
    if (!results.contains(e.target) && e.target !== search) {
      results.classList.add("hidden");
    }
  });
}

b2b_check.addEventListener("change", () => {
  if (b2b_check.checked) {
    ust_wrapper.classList.remove("hidden");
  } else {
    ust_wrapper.classList.add("hidden");
    ust_id.value = "";
  }
});

async function loadCategoriesForSelect() {
  try {
    const res = await fetch("/api/categories", { credentials: "include" });

    if (res.status === 401) {
      window.location.href = "/login.html";
      return;
    }

    const cats = await res.json();

    // Select leeren
    i_category.innerHTML = "";

    cats.forEach(cat => {
      const opt = document.createElement("option");
      opt.value = cat.key;       // für DB-Join
      opt.textContent = cat.label;
      i_category.appendChild(opt);
    });
  } catch (err) {
    console.error("Fehler beim Laden der Kategorien:", err);
  }
}

// -------------------------------------------------------------
// 🔢 Nächste freie Rechnungsnummer vom Server holen
// -------------------------------------------------------------
async function loadNextInvoiceNumber() {
  try {
    const res = await fetch("/api/invoices/next-number", {
      credentials: "include",
    });

    if (res.status === 401) {
      window.location.href = "/login.html";
      return;
    }
    const data = await res.json();

    // Nur automatisch setzen, wenn Benutzer nichts eingibt
    if (!i_number.value || autoNumberActive) {
      i_number.value = data.next;
    }

    // Sobald Benutzer tippt → automatische Nummer abschalten
    i_number.addEventListener("input", () => {
      autoNumberActive = false;
    });
  } catch (err) {
    console.error("Fehler beim Laden der Rechnungsnummer:", err);
  }
}

// -------------------------------------------------
// Positionen hinzufügen / rendern / ändern / löschen
// -------------------------------------------------
function addItem() {
  const item = {
    id: Date.now(),
    description: "",
    quantity: 1,
    unit_price_gross: 0,
    vat_key: 1,
  };

  items.push(item);
  renderItems();
  calculateTotals();
}

// Positionen rendern
function renderItems() {
  const body = document.getElementById("item-body");
  body.innerHTML = "";

  items.forEach((item) => {
    const tr = document.createElement("tr");
    tr.classList.add("pos-row");

    tr.innerHTML = `
      <td>
        <input
          class="input pos-desc"
          value="${item.description || ""}"
          oninput="updateItem(${item.id}, 'description', this.value)"
        />
      </td>
      <td>
        <input
          class="input pos-qty"
          type="number"
          min="1"
          value="${item.quantity}"
          oninput="updateItem(${item.id}, 'quantity', this.value)"
        />
      </td>
      <td>
        <input
          class="input pos-price"
          type="number"
          step="0.01"
          value="${item.unit_price_gross}"
          oninput="updateItem(${item.id}, 'unit_price_gross', this.value)"
        />
      </td>
      <td>
        <select
          class="input"
          onchange="updateItem(${item.id}, 'vat_key', this.value)"
        >
          <option value="1" ${item.vat_key == 1 ? "selected" : ""}>19%</option>
          <option value="2" ${item.vat_key == 2 ? "selected" : ""}>7%</option>
        </select>
      </td>
      <td>
        <button
          class="primary-button"
          style="padding:4px 10px;"
          onclick="deleteItem(${item.id})"
        >×</button>
      </td>
    `;

    body.appendChild(tr);
  });
}

// Position aktualisieren
function updateItem(id, field, value) {
  const i = items.find((x) => x.id === id);
  if (!i) return;

  if (field === "quantity" || field.includes("price")) {
    i[field] = Number(value) || 0;
  } else if (field === "vat_key") {
    i[field] = Number(value);
  } else {
    i[field] = value;
  }

  calculateTotals();
}

// Position löschen
function deleteItem(id) {
  items = items.filter((i) => i.id !== id);
  renderItems();
  calculateTotals();
}

// -------------------------------------------------
// Summen berechnen (Live-Vorschau)
// -------------------------------------------------
function calculateTotals() {
  let net19 = 0,
    vat19 = 0,
    gross19 = 0;
  let net7 = 0,
    vat7 = 0,
    gross7 = 0;

  items.forEach((i) => {
    const gross = (i.quantity || 0) * (i.unit_price_gross || 0);
    const rate = i.vat_key == 1 ? 0.19 : 0.07;

    const net = gross / (1 + rate);
    const vat = gross - net;

    if (i.vat_key == 1) {
      net19 += net;
      vat19 += vat;
      gross19 += gross;
    } else {
      net7 += net;
      vat7 += vat;
      gross7 += gross;
    }
  });

  const total = gross19 + gross7;

  document.getElementById("sum-net").innerText =
    (net19 + net7).toFixed(2) + " €";
  document.getElementById("sum-vat").innerText =
    (vat19 + vat7).toFixed(2) + " €";
  document.getElementById("sum-total").innerText = total.toFixed(2) + " €";
}

// -------------------------------------------------
// Formular-Validierung (Pflichtfelder + Positionen)
// -------------------------------------------------
function validateForm() {
  clearErrors();

  // Pflichtfelder Empfänger + Rechnung
  const requiredFields = [
    { id: "r_name", label: "Empfängername" },
    { id: "r_street", label: "Straße" },
    { id: "r_zip", label: "PLZ" },
    { id: "r_city", label: "Ort" },
    { id: "i_number", label: "Rechnungsnummer" },
    { id: "i_date", label: "Rechnungsdatum" },
  ];

  for (const f of requiredFields) {
    const el = document.getElementById(f.id);
    if (!el || el.value.trim() === "") {
      el && el.classList.add("input-error");
      showError(`Bitte fülle das Feld „${f.label}“ aus.`);
      return false;
    }
  }

  // Positionen prüfen
  const rows = document.querySelectorAll(".pos-row");
  if (rows.length === 0) {
    showError("Mindestens eine Rechnungsposition ist erforderlich.");
    return false;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const desc = row.querySelector(".pos-desc");
    const qty = row.querySelector(".pos-qty");
    const price = row.querySelector(".pos-price");

    if (!desc || !qty || !price) {
      showError("Interner Fehler bei den Positionen.");
      return false;
    }

    if (!desc.value.trim()) {
      desc.classList.add("input-error");
      showError(`Beschreibung fehlt in Position ${i + 1}.`);
      return false;
    }

    if (!qty.value || Number(qty.value) <= 0) {
      qty.classList.add("input-error");
      showError(`Menge ungültig in Position ${i + 1}.`);
      return false;
    }

    if (!price.value || Number(price.value) <= 0) {
      price.classList.add("input-error");
      showError(`Einzelpreis ungültig in Position ${i + 1}.`);
      return false;
    }
  }

  // B2B → USt-ID Pflicht
  if (b2b_check.checked) {
    if (!ust_id.value.trim()) {
      ust_id.classList.add("input-error");
      showError("Bitte USt-ID für B2B-Rechnung eingeben.");
      return false;
    }
  }

  return true;
}

// -------------------------------------------------
// Rechnung erstellen → API POST
// -------------------------------------------------
async function createInvoice() {
  // Frontend-Validierung zuerst
  if (!validateForm()) return;

  const payload = {
    recipient: {
      name: r_name.value,
      street: r_street.value,
      zip: r_zip.value,
      city: r_city.value,
    },
    invoice: {
      invoice_number: i_number.value,
      date: i_date.value,
      category: i_category.value,
      receipt_date: i_receipt.value,
      b2b: b2b_check.checked,
      ust_id: ust_id.value.trim(),
    },
    items: items,
  };

  const res = await fetch("/api/invoices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  // Wenn nicht eingeloggt → Loginseite öffnen
  if (res.status === 401) {
    window.location.href = "/login.html";
    return;
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Fehlermeldung vom Backend anzeigen, falls vorhanden
    showError(data.message || "Fehler beim Erstellen der Rechnung.");
    return;
  }

   const id = data.invoice_id;
if (!id) {
  showError("Rechnung gespeichert, aber keine ID zurückgegeben.");
  return;
}

// Popup Elemente
const popup = document.getElementById("invoiceCreatedPopup");
const popupTitle = document.getElementById("popupTitle");
const popupSubtitle = document.getElementById("popupSubtitle");
const popupButtons = document.getElementById("popupButtons");
const circle = document.querySelector(".ios-loader-fill");
const text = document.getElementById("progress-text");

popup.classList.remove("hidden");

// Loader vorbereiten
const fullDash = 264;
circle.style.strokeDasharray = fullDash;
circle.style.strokeDashoffset = fullDash;
text.textContent = "0%";

// Loader Animation simulieren (wie invoices.js)
(async () => {
  const totalTime = 1500 + Math.random() * 700; 
  const steps = 30;
  const stepTime = totalTime / steps;

  for (let s = 0; s <= steps; s++) {
    const p = (s / steps) * 100;
    const dashOffset = fullDash - (fullDash * (p / 100));

    circle.style.strokeDashoffset = dashOffset;
    text.textContent = `${Math.round(p)}%`;

    await new Promise(r => setTimeout(r, stepTime));
  }

  // Loader fertig
  popupTitle.textContent = "Rechnung erfolgreich erstellt!";
  popupSubtitle.textContent = "Was möchten Sie jetzt tun?";
  text.textContent = "Fertig";

  // Buttons anzeigen
  popupButtons.style.display = "block";

  // Button Events
  document.getElementById("openInvoice").onclick = () => {
    window.open(`/api/invoices/${id}/pdf?mode=inline`, "_blank");
  };

  document.getElementById("downloadInvoice").onclick = () => {
    window.location.href = `/api/invoices/${id}/pdf?mode=download`;
  };

  document.getElementById("goToInvoices").onclick = () => {
    window.location.href = "invoices.html";
  };

  document.getElementById("closePopup").onclick = () => {
    popup.classList.add("hidden");
  };

})();
}
// -------------------------------------------------
// Event-Handler & Initialisierung
// -------------------------------------------------
document.getElementById("add-item").onclick = addItem;
document.getElementById("submit-invoice").onclick = createInvoice;

// Standardmäßig 1 Position
addItem();

loadNextInvoiceNumber();

// Kundenliste fürs Dropdown laden
loadCustomers();

loadCategoriesForSelect();

