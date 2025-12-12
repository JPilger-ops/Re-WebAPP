(async () => {
  const dbg = (...args) => console.info("[categories]", ...args);

  // Warte auf Auth-Init aus nav.js, aber mit Timeout-Fallback, damit die Seite nicht hängen bleibt
  const waitAuth = async () => {
    try {
      await Promise.race([
        ensureAuthReady(),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
    } catch (err) {
      console.error("Auth-Wartefehler:", err);
    }
    if (!window.userLoaded) {
      console.warn("Auth-Status unklar, fahre dennoch fort (Timeout).");
      window.userLoaded = true;
    }
  };

  await waitAuth();
  dbg("Auth ready, currentUserPermissions:", window.currentUserPermissions);

  const perms = window.currentUserPermissions || [];
  const hasPerm = (p) => perms.includes(p);
  const canEditBank = hasPerm("settings.general");
  const canReadCategories = hasPerm("categories.read") || canEditBank;
  const canWriteCategories = hasPerm("categories.write") || canEditBank;
  const canDeleteCategories = hasPerm("categories.delete") || canEditBank;
  let categoriesCache = [];
  let logosCache = [];
  let currentCategoryId = null;
  let lastFocusedField = null;
  const placeholders = [
    "{{recipient_name}}",
    "{{recipient_street}}",
    "{{recipient_zip}}",
    "{{recipient_city}}",
    "{{invoice_number}}",
    "{{invoice_date}}",
    "{{due_date}}",
    "{{amount}}",
    "{{bank_name}}",
    "{{iban}}",
    "{{bic}}",
  ];

  const elements = {
    catError: document.getElementById("error-box"),
    catSuccess: document.getElementById("cat-success"),
    bankError: document.getElementById("bank-error"),
    bankSuccess: document.getElementById("bank-success"),
    catBody: document.getElementById("cat-body"),
    newKey: document.getElementById("cat-key"),
    newLabel: document.getElementById("cat-label"),
    newLogo: document.getElementById("cat-logo"),
    keyHint: document.getElementById("cat-key-hint"),
    bankHolder: document.getElementById("bank-holder"),
    bankName: document.getElementById("bank-name"),
    bankIban: document.getElementById("bank-iban"),
    bankBic: document.getElementById("bank-bic"),
    bankSave: document.getElementById("bank-save"),
    bankReload: document.getElementById("bank-reload"),
    logoDropzone: document.getElementById("logo-dropzone"),
    logoInput: document.getElementById("logo-file"),
    logoButton: document.getElementById("logo-file-btn"),
    logoFileName: document.getElementById("logo-file-name"),
    emailModal: document.getElementById("email-modal"),
    emailModalClose: document.getElementById("email-modal-close"),
    emailError: document.getElementById("email-error"),
    emailSuccess: document.getElementById("email-success"),
    emailTitle: document.getElementById("email-modal-title"),
    emailDisplay: document.getElementById("email-display"),
    emailAddress: document.getElementById("email-address"),
    smtpHost: document.getElementById("smtp-host"),
    smtpPort: document.getElementById("smtp-port"),
    smtpSecure: document.getElementById("smtp-secure"),
    smtpUser: document.getElementById("smtp-user"),
    smtpPass: document.getElementById("smtp-pass"),
    emailTestBtn: document.getElementById("email-test"),
    emailSaveBtn: document.getElementById("email-save"),
    emailTestResult: document.getElementById("email-test-result"),
    templateModal: document.getElementById("template-modal"),
    templateModalClose: document.getElementById("template-modal-close"),
    templateError: document.getElementById("template-error"),
    templateSuccess: document.getElementById("template-success"),
    templateTitle: document.getElementById("template-modal-title"),
    tplSubject: document.getElementById("tpl-subject"),
    tplBody: document.getElementById("tpl-body"),
    tplSaveBtn: document.getElementById("tpl-save"),
    tplPreviewBtn: document.getElementById("tpl-preview"),
    placeholderList: document.getElementById("placeholder-list"),
  };

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const formatIbanForInput = (value) =>
    value ? value.replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim() : "";

  const normalizeIban = (value) => (value || "").replace(/\s+/g, "").toUpperCase();
  const normalizeBic = (value) => (value || "").replace(/\s+/g, "").toUpperCase();
  const formatCategoryKey = (value) => {
    if (!value) return "";
    const cleaned = value
      .trim()
      .replace(/ä/gi, "ae")
      .replace(/ö/gi, "oe")
      .replace(/ü/gi, "ue")
      .replace(/ß/gi, "ss")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
    return cleaned.toUpperCase();
  };

  const isValidBic = (bic) =>
    /^[A-Z0-9]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(normalizeBic(bic));

  const isValidIban = (ibanRaw) => {
    const iban = normalizeIban(ibanRaw);
    if (!iban || iban.length < 15 || iban.length > 34) return false;
    if (!/^[A-Z0-9]+$/.test(iban)) return false;

    const rearranged = iban.slice(4) + iban.slice(0, 4);
    const converted = rearranged
      .split("")
      .map((ch) => (/\d/.test(ch) ? ch : (ch.charCodeAt(0) - 55).toString()))
      .join("");

    let remainder = 0;
    for (const digit of converted) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }

    return remainder === 1;
  };

  const MAX_LOGO_SIZE = 1.5 * 1024 * 1024; // 1.5 MB
  const allowedLogoTypes = ["image/png", "image/jpeg", "image/svg+xml"];
  const allowedLogoExt = [".png", ".jpg", ".jpeg", ".svg"];

  const hideBox = (box) => {
    if (!box) return;
    box.classList.add("hidden");
    box.textContent = "";
  };

  const showBox = (box, message) => {
    if (!box) return;
    box.textContent = message;
    box.classList.remove("hidden");
  };

  const showModal = (modal) => {
    if (!modal) return;
    modal.classList.remove("hidden");
  };

  const hideModal = (modal) => {
    if (!modal) return;
    modal.classList.add("hidden");
  };

  const insertAtCursor = (input, text) => {
    if (!input) return;
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const before = input.value.slice(0, start);
    const after = input.value.slice(end);
    input.value = before + text + after;
    const pos = start + text.length;
    input.focus();
    input.setSelectionRange(pos, pos);
  };

  const ensureLogoOption = (filename) => {
    if (!filename) return;
    if (!logosCache.includes(filename)) {
      logosCache.push(filename);
      logosCache.sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" }));
    }
  };

  const renderLogoOptions = (selected) => {
    if (!elements.newLogo) return;
    const currentValue = selected ?? elements.newLogo.value;
    elements.newLogo.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.disabled = true;
    placeholder.selected = !currentValue;
    placeholder.textContent = "Logo auswählen...";
    elements.newLogo.appendChild(placeholder);

    logosCache.forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      if (currentValue === name) opt.selected = true;
      elements.newLogo.appendChild(opt);
    });

    // falls ein Wert gesetzt ist, aber nicht in der Liste steckt
    if (currentValue && !logosCache.includes(currentValue)) {
      const opt = document.createElement("option");
      opt.value = currentValue;
      opt.textContent = currentValue;
      opt.selected = true;
      elements.newLogo.appendChild(opt);
    }
  };

  const updateKeyHint = (valueFromInput) => {
    if (!elements.keyHint) return;
    const source = valueFromInput ?? elements.newKey?.value ?? elements.newLabel?.value ?? "";
    const formatted = formatCategoryKey(source);
    elements.keyHint.textContent = formatted
      ? `Empfohlener Schlüssel: ${formatted}`
      : "Großbuchstaben und Unterstriche werden automatisch gesetzt.";
  };

  const clearCategoryMessages = () => {
    hideBox(elements.catError);
    hideBox(elements.catSuccess);
  };

  const clearBankMessages = () => {
    hideBox(elements.bankError);
    hideBox(elements.bankSuccess);
  };

  const clearEmailMessages = () => {
    hideBox(elements.emailError);
    hideBox(elements.emailSuccess);
    if (elements.emailTestResult) elements.emailTestResult.textContent = "";
  };

  const clearTemplateMessages = () => {
    hideBox(elements.templateError);
    hideBox(elements.templateSuccess);
  };

  const renderPlaceholders = () => {
    if (!elements.placeholderList) return;
    elements.placeholderList.innerHTML = "";
    placeholders.forEach((ph) => {
      const pill = document.createElement("div");
      pill.className = "placeholder-pill";
      pill.textContent = ph;
      pill.draggable = true;
      pill.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", ph);
      });
      pill.addEventListener("click", () => {
        if (lastFocusedField) {
          insertAtCursor(lastFocusedField, ph);
        } else if (elements.tplBody) {
          insertAtCursor(elements.tplBody, ph);
        }
      });
      elements.placeholderList.appendChild(pill);
    });
  };

  async function loadLogos(preselect) {
    if (!canReadCategories && !canWriteCategories) return logosCache;

    try {
      const res = await fetch("/api/categories/logos", { credentials: "include" });
      if (res.status === 401) {
        window.location.href = "/login.html";
        return;
      }
      if (res.status === 403) {
        // still render existing value if provided
        renderLogoOptions(preselect);
        return;
      }
      if (!res.ok) {
        console.warn("Logos laden HTTP-Fehler", res.status);
        renderLogoOptions(preselect);
        return;
      }

      const data = await res.json();
      logosCache = Array.isArray(data) ? data : [];
      renderLogoOptions(preselect);
      return logosCache;
    } catch (err) {
      console.error("Logos laden fehlgeschlagen", err);
      renderLogoOptions(preselect);
    }
    return logosCache;
  }

  const disableBankForm = (message) => {
    [elements.bankHolder, elements.bankName, elements.bankIban, elements.bankBic, elements.bankSave, elements.bankReload].forEach((el) => {
      if (el) el.disabled = true;
    });
    if (message) showBox(elements.bankError, message);
  };

  async function loadBankData() {
    clearBankMessages();

    if (!canEditBank) {
      disableBankForm("Keine Berechtigung zum Ändern der Bankdaten.");
      return;
    }

    try {
      const res = await fetch("/api/settings/bank", { credentials: "include" });
      if (res.status === 401) {
        window.location.href = "/login.html";
        return;
      }
      if (res.status === 403) {
        disableBankForm("Keine Berechtigung zum Ändern der Bankdaten.");
        return;
      }
      if (!res.ok) {
        console.warn("Bank laden HTTP-Fehler", res.status);
        showBox(elements.bankError, "Bankdaten konnten nicht geladen werden.");
        return;
      }

      const data = await res.json();
      if (elements.bankHolder) elements.bankHolder.value = data.account_holder || "";
      if (elements.bankName) elements.bankName.value = data.bank_name || "";
      if (elements.bankIban) elements.bankIban.value = formatIbanForInput(data.iban || "");
      if (elements.bankBic) elements.bankBic.value = data.bic || "";
    } catch (err) {
      console.error("Bankdaten laden fehlgeschlagen", err);
      showBox(elements.bankError, "Bankdaten konnten nicht geladen werden.");
    }
  }

  async function saveBankData() {
    clearBankMessages();

    if (!canEditBank) {
      showBox(elements.bankError, "Keine Berechtigung zum Ändern der Bankdaten.");
      return;
    }

    const payload = {
      account_holder: elements.bankHolder?.value.trim() || "",
      bank_name: elements.bankName?.value.trim() || "",
      iban: normalizeIban(elements.bankIban?.value || ""),
      bic: normalizeBic(elements.bankBic?.value || ""),
    };

    if (!payload.account_holder || !payload.bank_name || !payload.iban || !payload.bic) {
      showBox(elements.bankError, "Bitte alle Bankfelder ausfüllen.");
      return;
    }

    if (!isValidIban(payload.iban)) {
      showBox(elements.bankError, "IBAN ist ungültig.");
      return;
    }

    if (!isValidBic(payload.bic)) {
      showBox(elements.bankError, "BIC ist ungültig (8 oder 11 Zeichen).");
      return;
    }

    try {
      const res = await fetch("/api/settings/bank", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const body = await res.json().catch(() => ({}));

      if (res.status === 401) {
        window.location.href = "/login.html";
        return;
      }
      if (res.status === 403) {
        showBox(elements.bankError, "Keine Berechtigung zum Ändern der Bankdaten.");
        return;
      }
      if (!res.ok) {
        console.warn("Bank speichern HTTP-Fehler", res.status, body);
        showBox(elements.bankError, body.message || "Fehler beim Speichern der Bankdaten.");
        return;
      }

      if (elements.bankHolder) elements.bankHolder.value = body.account_holder || payload.account_holder;
      if (elements.bankName) elements.bankName.value = body.bank_name || payload.bank_name;
      if (elements.bankIban) elements.bankIban.value = formatIbanForInput(body.iban || payload.iban);
      if (elements.bankBic) elements.bankBic.value = body.bic || payload.bic;

      showBox(elements.bankSuccess, "Bankdaten gespeichert.");
    } catch (err) {
      console.error("Bankdaten speichern fehlgeschlagen", err);
      showBox(elements.bankError, "Fehler beim Speichern der Bankdaten.");
    }
  }

  async function loadCategories() {
    clearCategoryMessages();

    if (!canReadCategories) {
      showBox(elements.catError, "Keine Berechtigung zum Anzeigen der Kategorien.");
      return;
    }

    try {
      await loadLogos();
      const res = await fetch("/api/categories", { credentials: "include" });
      if (res.status === 401) {
        window.location.href = "/login.html";
        return;
      }
      if (res.status === 403) {
        showBox(elements.catError, "Keine Berechtigung zum Anzeigen der Kategorien.");
        return;
      }
      if (!res.ok) {
        console.warn("Kategorien laden HTTP-Fehler", res.status);
        showBox(elements.catError, "Kategorien konnten nicht geladen werden.");
        return;
      }

      categoriesCache = await res.json();
      categoriesCache.forEach((cat) => ensureLogoOption(cat.logo_file));
      renderLogoOptions(elements.newLogo?.value);
      renderCategoryTable(categoriesCache);
    } catch (err) {
      console.error("Kategorien laden fehlgeschlagen", err);
      showBox(elements.catError, "Kategorien konnten nicht geladen werden.");
    }
  }

  function renderCategoryTable(categories) {
    if (!elements.catBody) return;
    elements.catBody.innerHTML = "";

    if (!Array.isArray(categories)) {
      showBox(elements.catError, "Kategorien konnten nicht geladen werden (ungültige Antwort).");
      console.error("[categories] Ungültige Kategorien-Antwort", categories);
      return;
    }

    const buildLogoSelect = (value, id) => {
      const current = (value || "").trim();
      const options = [`<option value="">Kein Logo</option>`];
      const all = new Set([current, ...logosCache.filter(Boolean)]);
      all.delete("");
      Array.from(all)
        .sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" }))
        .forEach((name) => {
          const selected = name === current ? "selected" : "";
          options.push(`<option value="${escapeHtml(name)}" ${selected}>${escapeHtml(name)}</option>`);
        });

      return `<select class="input select-input table-select" data-id="${id}" data-field="logo_file" ${canWriteCategories ? "" : "disabled"}>
        ${options.join("")}
      </select>`;
    };

    const buildLogoThumb = (cat) => {
      const rawLogo = (cat.logo_file || "").trim();
      const logoSrc = rawLogo ? `/logos/${encodeURIComponent(rawLogo)}` : "";
      const placeholder = ((cat.label || cat.key || "?").trim() || "?").slice(0, 2).toUpperCase();

      if (!rawLogo) {
        return `<div class="logo-thumb" data-logo-id="${cat.id}"><span class="logo-placeholder">${placeholder}</span></div>`;
      }

      return `
        <div class="logo-thumb" data-logo-id="${cat.id}">
          <img src="${escapeHtml(logoSrc)}" alt="${escapeHtml(cat.label || cat.key || rawLogo)} Logo" onerror="this.style.display='none'; this.nextElementSibling.classList.remove('hidden');" />
          <span class="logo-placeholder hidden">${placeholder}</span>
        </div>`;
    };

    if (!categories || categories.length === 0) {
      const emptyRow = document.createElement("tr");
      emptyRow.innerHTML = `
        <td colspan="5">
          <div class="table-empty">
            ${
              categoriesCache.length === 0
                ? "Keine Kategorien vorhanden. Lege über das Formular links eine neue an."
                : "Keine Treffer für deinen Filter."
            }
          </div>
        </td>`;
      elements.catBody.appendChild(emptyRow);
      return;
    }

    categories.forEach((cat) => {
      const tr = document.createElement("tr");

      const key = escapeHtml(cat.key);
      const label = escapeHtml(cat.label);
      const rawLogo = (cat.logo_file || "").trim();
      const emailAddress = escapeHtml(cat.email_account?.email_address || "Kein Konto");
      const hasTemplate = !!cat.template;

      const actions = [];
      actions.push(`<button class="secondary-button small-btn" data-action="email" data-id="${cat.id}">E-Mail-Konto</button>`);
      actions.push(`<button class="secondary-button small-btn" data-action="template" data-id="${cat.id}">Template</button>`);
      if (canWriteCategories) {
        actions.push(`<button class="secondary-button small-btn" data-action="save" data-id="${cat.id}">Speichern</button>`);
      }
      if (canDeleteCategories) {
        actions.push(
          `<button class="secondary-button small-btn" data-action="delete" data-id="${cat.id}" style="background:#ffecec;border-color:#ffc8c8;color:#b20000;">Löschen</button>`
        );
      }
      const actionMarkup = actions.length ? actions.join("") : `<span class="settings-note">Keine Aktionen</span>`;

      tr.innerHTML = `
        <td>
          <input class="input" value="${key}" data-id="${cat.id}" data-field="key" ${canWriteCategories ? "" : "disabled"} />
          <div class="settings-note">Interner Schlüssel</div>
        </td>
        <td>
          <input class="input" value="${label}" data-id="${cat.id}" data-field="label" ${canWriteCategories ? "" : "disabled"} />
        </td>
        <td>
          ${buildLogoSelect(cat.logo_file, cat.id)}
          <div class="settings-note">Dateiname aus /public/logos/</div>
        </td>
        <td>
          ${buildLogoThumb(cat)}
        </td>
        <td>
          <div class="settings-note">Konto</div>
          <div>${emailAddress}</div>
          <div class="settings-note">${hasTemplate ? "Template vorhanden" : "Kein Template"}</div>
        </td>
        <td class="table-actions">
          ${actionMarkup}
        </td>
      `;

      elements.catBody.appendChild(tr);
    });
  }

  async function handleCategoryAction(e) {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    clearCategoryMessages();

    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const cat = categoriesCache.find((c) => c.id == id);

    if (action === "save") {
      if (!canWriteCategories) {
        showBox(elements.catError, "Keine Berechtigung zum Ändern von Kategorien.");
        return;
      }

      const rowInputs = elements.catBody.querySelectorAll(`[data-id="${id}"]`);
      const payload = {};
      rowInputs.forEach((inp) => {
        payload[inp.dataset.field] = inp.value.trim();
      });

      try {
        const res = await fetch(`/api/categories/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });

        if (res.status === 401) {
          window.location.href = "/login.html";
          return;
        }
        if (res.status === 403) {
          showBox(elements.catError, "Keine Berechtigung zum Ändern von Kategorien.");
          return;
        }
        if (!res.ok) {
          showBox(elements.catError, "Fehler beim Speichern der Kategorie.");
          return;
        }

        showBox(elements.catSuccess, "Kategorie gespeichert.");
      } catch (err) {
        console.error("Kategorie speichern fehlgeschlagen", err);
        showBox(elements.catError, "Fehler beim Speichern der Kategorie.");
      }
    }

    if (action === "email") {
      if (!cat) return;
      openEmailModal(cat);
    }

    if (action === "template") {
      if (!cat) return;
      openTemplateModal(cat);
    }

    if (action === "delete") {
      if (!canDeleteCategories) {
        showBox(elements.catError, "Keine Berechtigung zum Löschen von Kategorien.");
        return;
      }
      if (!confirm("Kategorie wirklich löschen?")) return;

      try {
        const res = await fetch(`/api/categories/${id}`, {
          method: "DELETE",
          credentials: "include",
        });

        if (res.status === 401) {
          window.location.href = "/login.html";
          return;
        }
        if (res.status === 403) {
          showBox(elements.catError, "Keine Berechtigung zum Löschen von Kategorien.");
          return;
        }
        if (!res.ok) {
          showBox(elements.catError, "Fehler beim Löschen der Kategorie.");
          return;
        }

        showBox(elements.catSuccess, "Kategorie gelöscht.");
        loadCategories();
      } catch (err) {
        console.error("Kategorie löschen fehlgeschlagen", err);
        showBox(elements.catError, "Fehler beim Löschen der Kategorie.");
      }
    }
  }

  async function addCategory() {
    clearCategoryMessages();

    if (!canWriteCategories) {
      showBox(elements.catError, "Keine Berechtigung zum Anlegen von Kategorien.");
      return;
    }

    const rawKey = elements.newKey?.value || "";
    const formattedKey = formatCategoryKey(rawKey);
    const label = elements.newLabel?.value.trim() || "";
    const logo = elements.newLogo?.value.trim() || "";

    if (elements.newKey) elements.newKey.value = formattedKey;

    if (!formattedKey || !label || !logo) {
      showBox(elements.catError, "Bitte alle Felder ausfüllen.");
      return;
    }

    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ key: formattedKey, label, logo_file: logo }),
      });

      if (res.status === 401) {
        window.location.href = "/login.html";
        return;
      }
      if (res.status === 403) {
        showBox(elements.catError, "Keine Berechtigung zum Anlegen von Kategorien.");
        return;
      }
      if (!res.ok) {
        console.warn("Kategorie anlegen HTTP-Fehler", res.status);
        showBox(elements.catError, "Fehler beim Anlegen der Kategorie.");
        return;
      }

      if (elements.newKey) elements.newKey.value = "";
      if (elements.newLabel) elements.newLabel.value = "";
      if (elements.newLogo) elements.newLogo.value = "";
      updateKeyHint("");

      showBox(elements.catSuccess, "Kategorie angelegt.");
      loadCategories();
    } catch (err) {
      console.error("Kategorie anlegen fehlgeschlagen", err);
      showBox(elements.catError, "Fehler beim Anlegen der Kategorie.");
    }
  }

  function openEmailModal(cat) {
    currentCategoryId = cat.id;
    clearEmailMessages();
    if (elements.emailTitle) elements.emailTitle.textContent = `${cat.label || cat.key || "Kategorie"} · E-Mail`;
    const acct = cat.email_account || {};
    if (elements.emailDisplay) elements.emailDisplay.value = acct.display_name || "";
    if (elements.emailAddress) elements.emailAddress.value = acct.email_address || "";
    if (elements.smtpHost) elements.smtpHost.value = acct.smtp_host || "smtp.ionos.de";
    if (elements.smtpPort) elements.smtpPort.value = acct.smtp_port || 465;
    if (elements.smtpSecure) elements.smtpSecure.checked = acct.smtp_secure !== false;
    if (elements.smtpUser) elements.smtpUser.value = acct.smtp_user || (acct.email_address || "");
    if (elements.smtpPass) elements.smtpPass.value = "";
    showModal(elements.emailModal);
  }

  function collectEmailPayload() {
    return {
      display_name: elements.emailDisplay?.value || "",
      email_address: elements.emailAddress?.value || "",
      smtp_host: elements.smtpHost?.value || "",
      smtp_port: elements.smtpPort?.value ? Number(elements.smtpPort.value) : null,
      smtp_secure: elements.smtpSecure?.checked ?? true,
      smtp_user: elements.smtpUser?.value || "",
      smtp_pass: elements.smtpPass?.value || "",
    };
  }

  async function saveEmailAccount() {
    clearEmailMessages();
    if (!currentCategoryId) return;
    try {
      const payload = collectEmailPayload();
      const res = await fetch(`/api/categories/${currentCategoryId}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 401) {
        window.location.href = "/login.html";
        return;
      }
      if (!res.ok) {
        showBox(elements.emailError, body.message || "Speichern fehlgeschlagen.");
        return;
      }
      showBox(elements.emailSuccess, "E-Mail-Konto gespeichert.");
      await loadCategories();
    } catch (err) {
      console.error("E-Mail speichern fehlgeschlagen", err);
      showBox(elements.emailError, "Speichern fehlgeschlagen.");
    }
  }

  async function testEmailAccount() {
    clearEmailMessages();
    if (!currentCategoryId) return;
    const payload = collectEmailPayload();
    try {
      const res = await fetch(`/api/categories/${currentCategoryId}/email/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 401) {
        window.location.href = "/login.html";
        return;
      }
      if (!res.ok || body.ok === false) {
        showBox(elements.emailError, body.message || "Test fehlgeschlagen.");
        return;
      }
      if (elements.emailTestResult) elements.emailTestResult.textContent = "Verbindung erfolgreich.";
      showBox(elements.emailSuccess, "Test erfolgreich.");
    } catch (err) {
      console.error("E-Mail-Test fehlgeschlagen", err);
      showBox(elements.emailError, "Test fehlgeschlagen.");
    }
  }

  function openTemplateModal(cat) {
    currentCategoryId = cat.id;
    clearTemplateMessages();
    if (elements.templateTitle) elements.templateTitle.textContent = `${cat.label || cat.key || "Kategorie"} · Template`;
    const tpl = cat.template || {};
    if (elements.tplSubject) elements.tplSubject.value = tpl.subject || "";
    if (elements.tplBody) elements.tplBody.value = tpl.body_html || "";
    showModal(elements.templateModal);
    renderPlaceholders();
  }

  async function saveTemplate() {
    clearTemplateMessages();
    if (!currentCategoryId) return;
    const subject = elements.tplSubject?.value || "";
    const body_html = elements.tplBody?.value || "";
    if (!subject || !body_html) {
      showBox(elements.templateError, "Bitte Subject und Inhalt ausfüllen.");
      return;
    }
    try {
      const res = await fetch(`/api/categories/${currentCategoryId}/template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ subject, body_html }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 401) {
        window.location.href = "/login.html";
        return;
      }
      if (!res.ok) {
        showBox(elements.templateError, body.message || "Speichern fehlgeschlagen.");
        return;
      }
      showBox(elements.templateSuccess, "Template gespeichert.");
      await loadCategories();
    } catch (err) {
      console.error("Template speichern fehlgeschlagen", err);
      showBox(elements.templateError, "Speichern fehlgeschlagen.");
    }
  }

  function updateRowLogoPreview(id, filename) {
    if (!elements.catBody) return;
    const target = elements.catBody.querySelector(`[data-logo-id="${id}"]`);
    const value = (filename || "").trim();

    const placeholder = ((elements.catBody.querySelector(`input[data-id="${id}"][data-field="label"]`)?.value ||
      elements.catBody.querySelector(`input[data-id="${id}"][data-field="key"]`)?.value ||
      value ||
      "?").trim() || "?")
      .slice(0, 2)
      .toUpperCase();

    const container = document.createElement("div");
    container.className = "logo-thumb";
    container.setAttribute("data-logo-id", id);

    if (value) {
      const img = document.createElement("img");
      img.src = `/logos/${encodeURIComponent(value)}`;
      img.alt = `${placeholder} Logo`;
      img.onerror = () => {
        img.style.display = "none";
        placeholderEl.classList.remove("hidden");
      };
      container.appendChild(img);
    }

    const placeholderEl = document.createElement("span");
    placeholderEl.className = value ? "logo-placeholder hidden" : "logo-placeholder";
    placeholderEl.textContent = placeholder;
    container.appendChild(placeholderEl);

    if (target?.parentElement) {
      target.parentElement.replaceChild(container, target);
    }
  }

  function setLogoFileName(text) {
    if (elements.logoFileName) elements.logoFileName.textContent = text || "Keine Datei ausgewählt";
  }

  function handleLogoInput() {
    const file = elements.logoInput?.files?.[0];
    if (!file) return;
    processLogoFile(file);
    // ermöglicht erneute Auswahl derselben Datei
    if (elements.logoInput) elements.logoInput.value = "";
  }

  function validateLogoFile(file) {
    if (!file) return "Keine Datei ausgewählt.";
    const ext = (file.name || "").toLowerCase().match(/(\.[a-z0-9]+)$/)?.[1] || "";
    if (!allowedLogoExt.includes(ext) && !allowedLogoTypes.includes(file.type)) {
      return "Nur PNG, JPG oder SVG erlaubt.";
    }
    if (file.size > MAX_LOGO_SIZE) {
      return "Datei ist zu groß (max. 1.5 MB).";
    }
    return "";
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  async function processLogoFile(file) {
    clearCategoryMessages();

    if (!canWriteCategories) {
      showBox(elements.catError, "Keine Berechtigung zum Upload.");
      return;
    }

    const validationError = validateLogoFile(file);
    if (validationError) {
      showBox(elements.catError, validationError);
      setLogoFileName("Keine Datei ausgewählt");
      return;
    }

    setLogoFileName(file.name);

    try {
      const dataUrl = await readFileAsDataURL(file);
      const res = await fetch("/api/categories/logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ filename: file.name, dataUrl }),
      });

      const body = await res.json().catch(() => ({}));

      if (res.status === 401) {
        window.location.href = "/login.html";
        return;
      }
      if (res.status === 403) {
        showBox(elements.catError, "Keine Berechtigung zum Upload.");
        return;
      }
      if (!res.ok) {
        showBox(elements.catError, body.message || "Logo konnte nicht hochgeladen werden.");
        return;
      }

      // Dateiname ins Formular übernehmen
      const savedName = body.filename || file.name;
      ensureLogoOption(savedName);
      renderLogoOptions(savedName);
      if (elements.newLogo) elements.newLogo.value = savedName;
      showBox(elements.catSuccess, `Logo gespeichert (${body.filename || file.name}).`);
    } catch (err) {
      console.error("Logo-Upload fehlgeschlagen", err);
      showBox(elements.catError, "Logo konnte nicht hochgeladen werden.");
    }
  }

  // Initial states + event binding
  if (!canWriteCategories) {
    [elements.newKey, elements.newLabel, elements.newLogo].forEach((el) => {
      if (el) el.disabled = true;
    });
    const addBtn = document.getElementById("cat-add");
    if (addBtn) addBtn.disabled = true;
    if (elements.logoDropzone) elements.logoDropzone.classList.add("disabled");
    if (elements.logoButton) elements.logoButton.disabled = true;
    if (elements.logoInput) elements.logoInput.disabled = true;
  }
  if (!canReadCategories && elements.catFilter) {
    elements.catFilter.disabled = true;
  }

  if (elements.catBody) {
    elements.catBody.addEventListener("click", handleCategoryAction);
    elements.catBody.addEventListener("change", (e) => {
      const select = e.target.closest("select[data-field=\"logo_file\"]");
      if (!select) return;
      updateRowLogoPreview(select.dataset.id, select.value);
    });
  }
  const addBtn = document.getElementById("cat-add");
  if (addBtn) addBtn.addEventListener("click", addCategory);
  if (elements.newKey) {
    elements.newKey.addEventListener("input", (e) => updateKeyHint(e.target.value));
    elements.newKey.addEventListener("blur", (e) => {
      e.target.value = formatCategoryKey(e.target.value);
      updateKeyHint(e.target.value);
    });
  }
  if (elements.newLabel) {
    elements.newLabel.addEventListener("input", (e) => {
      if (elements.newKey && !elements.newKey.value.trim()) {
        elements.newKey.value = formatCategoryKey(e.target.value);
      }
      updateKeyHint(e.target.value);
    });
  }
  const refreshBtn = document.getElementById("cat-refresh");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      loadLogos();
      loadCategories();
    });
  }
  if (elements.bankSave) elements.bankSave.addEventListener("click", saveBankData);
  if (elements.bankReload) elements.bankReload.addEventListener("click", loadBankData);
  if (elements.logoButton && canWriteCategories) {
    elements.logoButton.addEventListener("click", () => elements.logoInput?.click());
  }
  if (elements.logoInput && canWriteCategories) {
    elements.logoInput.addEventListener("change", handleLogoInput);
  }
  if (elements.logoDropzone && canWriteCategories) {
    ["dragenter", "dragover"].forEach(evt =>
      elements.logoDropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        elements.logoDropzone.classList.add("dragover");
      })
    );
    ["dragleave", "drop"].forEach(evt =>
      elements.logoDropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        elements.logoDropzone.classList.remove("dragover");
      })
    );
    elements.logoDropzone.addEventListener("drop", (e) => {
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      processLogoFile(file);
    });
    elements.logoDropzone.addEventListener("click", () => elements.logoInput?.click());
  }

  if (elements.emailModalClose) elements.emailModalClose.addEventListener("click", () => hideModal(elements.emailModal));
  if (elements.templateModalClose) elements.templateModalClose.addEventListener("click", () => hideModal(elements.templateModal));
  if (elements.emailSaveBtn) elements.emailSaveBtn.addEventListener("click", saveEmailAccount);
  if (elements.emailTestBtn) elements.emailTestBtn.addEventListener("click", testEmailAccount);
  if (elements.tplSaveBtn) elements.tplSaveBtn.addEventListener("click", saveTemplate);
  if (elements.tplPreviewBtn) {
    elements.tplPreviewBtn.addEventListener("click", () => {
      alert("Preview:\n\n" + (elements.tplBody?.value || ""));
    });
  }

  if (elements.tplSubject) {
    elements.tplSubject.addEventListener("focus", () => (lastFocusedField = elements.tplSubject));
    elements.tplSubject.addEventListener("dragover", (e) => e.preventDefault());
    elements.tplSubject.addEventListener("drop", (e) => {
      e.preventDefault();
      const text = e.dataTransfer.getData("text/plain");
      insertAtCursor(elements.tplSubject, text);
    });
  }
  if (elements.tplBody) {
    elements.tplBody.addEventListener("focus", () => (lastFocusedField = elements.tplBody));
    elements.tplBody.addEventListener("dragover", (e) => e.preventDefault());
    elements.tplBody.addEventListener("drop", (e) => {
      e.preventDefault();
      const text = e.dataTransfer.getData("text/plain");
      insertAtCursor(elements.tplBody, text);
    });
  }

  updateKeyHint();
  loadBankData();
  loadLogos();
  loadCategories();
})();
