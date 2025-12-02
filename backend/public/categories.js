(async () => {
  await ensureAuthReady();

  const perms = window.currentUserPermissions || [];
  const canReadCategories = perms.includes("categories.read");
  const canWriteCategories = perms.includes("categories.write");
  const canDeleteCategories = perms.includes("categories.delete");
  const canEditBank = perms.includes("settings.general");
  let categoriesCache = [];

  const elements = {
    catError: document.getElementById("error-box"),
    catSuccess: document.getElementById("cat-success"),
    bankError: document.getElementById("bank-error"),
    bankSuccess: document.getElementById("bank-success"),
    catBody: document.getElementById("cat-body"),
    newKey: document.getElementById("cat-key"),
    newLabel: document.getElementById("cat-label"),
    newLogo: document.getElementById("cat-logo"),
    bankHolder: document.getElementById("bank-holder"),
    bankName: document.getElementById("bank-name"),
    bankIban: document.getElementById("bank-iban"),
    bankBic: document.getElementById("bank-bic"),
    bankSave: document.getElementById("bank-save"),
    bankReload: document.getElementById("bank-reload"),
    catFilter: document.getElementById("cat-filter"),
    logoDropzone: document.getElementById("logo-dropzone"),
    logoInput: document.getElementById("logo-file"),
    logoButton: document.getElementById("logo-file-btn"),
    logoFileName: document.getElementById("logo-file-name"),
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

  const clearCategoryMessages = () => {
    hideBox(elements.catError);
    hideBox(elements.catSuccess);
  };

  const clearBankMessages = () => {
    hideBox(elements.bankError);
    hideBox(elements.bankSuccess);
  };

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
        showBox(elements.catError, "Kategorien konnten nicht geladen werden.");
        return;
      }

      categoriesCache = await res.json();
      renderCategoryTable(getFilteredCategories());
    } catch (err) {
      console.error("Kategorien laden fehlgeschlagen", err);
      showBox(elements.catError, "Kategorien konnten nicht geladen werden.");
    }
  }

  function getFilteredCategories() {
    if (!elements.catFilter) return categoriesCache;
    const term = elements.catFilter.value.trim().toLowerCase();
    if (!term) return categoriesCache;

    return categoriesCache.filter((cat) => {
      return (
        (cat.key || "").toLowerCase().includes(term) ||
        (cat.label || "").toLowerCase().includes(term)
      );
    });
  }

  function renderCategoryTable(categories) {
    if (!elements.catBody) return;
    elements.catBody.innerHTML = "";

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
      const logo = escapeHtml(cat.logo_file || "");
      const logoSrc = logo ? `/logos/${logo}` : "";

      const actions = [];
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
          <input class="input" value="${logo}" data-id="${cat.id}" data-field="logo_file" ${canWriteCategories ? "" : "disabled"} />
          <div class="settings-note">Dateiname aus /public/logos/</div>
        </td>
        <td>
          ${
            logo
              ? `<div class="logo-thumb"><img src="${logoSrc}" alt="${label || key} Logo" onerror="this.parentElement.innerHTML='Fehlt';"></div>`
              : `<div class="settings-note">Kein Logo</div>`
          }
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

    if (action === "save") {
      if (!canWriteCategories) {
        showBox(elements.catError, "Keine Berechtigung zum Ändern von Kategorien.");
        return;
      }

      const rowInputs = elements.catBody.querySelectorAll(`input[data-id="${id}"]`);
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

    const key = elements.newKey?.value.trim() || "";
    const label = elements.newLabel?.value.trim() || "";
    const logo = elements.newLogo?.value.trim() || "";

    if (!key || !label || !logo) {
      showBox(elements.catError, "Bitte alle Felder ausfüllen.");
      return;
    }

    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ key, label, logo_file: logo }),
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
        showBox(elements.catError, "Fehler beim Anlegen der Kategorie.");
        return;
      }

      if (elements.newKey) elements.newKey.value = "";
      if (elements.newLabel) elements.newLabel.value = "";
      if (elements.newLogo) elements.newLogo.value = "";

      showBox(elements.catSuccess, "Kategorie angelegt.");
      loadCategories();
    } catch (err) {
      console.error("Kategorie anlegen fehlgeschlagen", err);
      showBox(elements.catError, "Fehler beim Anlegen der Kategorie.");
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
      if (elements.newLogo) elements.newLogo.value = body.filename || file.name;
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
  }
  const addBtn = document.getElementById("cat-add");
  if (addBtn) addBtn.addEventListener("click", addCategory);
  const refreshBtn = document.getElementById("cat-refresh");
  if (refreshBtn) refreshBtn.addEventListener("click", loadCategories);
  if (elements.bankSave) elements.bankSave.addEventListener("click", saveBankData);
  if (elements.bankReload) elements.bankReload.addEventListener("click", loadBankData);
  if (elements.catFilter) {
    elements.catFilter.addEventListener("input", () => renderCategoryTable(getFilteredCategories()));
  }
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

  loadBankData();
  loadCategories();
})();
