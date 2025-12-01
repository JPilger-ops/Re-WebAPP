async function loadCategories() {
  const res = await fetch("/api/categories", { credentials: "include" });
  if (res.status === 401) {
    window.location.href = "/login.html";
    return;
  }
  const data = await res.json();
  const body = document.getElementById("cat-body");
  body.innerHTML = "";

  data.forEach(cat => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input class="input" value="${cat.key}" data-id="${cat.id}" data-field="key" /></td>
      <td><input class="input" value="${cat.label}" data-id="${cat.id}" data-field="label" /></td>
      <td><input class="input" value="${cat.logo_file}" data-id="${cat.id}" data-field="logo_file" /></td>
      <td>
        <button class="primary-button" data-action="save" data-id="${cat.id}">Speichern</button>
        <button class="secondary-button" data-action="delete" data-id="${cat.id}" style="margin-left:8px;">Löschen</button>
      </td>
    `;
    body.appendChild(tr);
  });

  body.onclick = async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const id = btn.dataset.id;
    const action = btn.dataset.action;

    if (action === "save") {
      const rowInputs = body.querySelectorAll(`input[data-id="${id}"]`);
      const payload = {};
      rowInputs.forEach(inp => {
        payload[inp.dataset.field] = inp.value;
      });

      const res = await fetch(`/api/categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) alert("Fehler beim Speichern der Kategorie");
    }

    if (action === "delete") {
      if (!confirm("Kategorie wirklich löschen?")) return;
      const res = await fetch(`/api/categories/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) loadCategories();
      else alert("Fehler beim Löschen der Kategorie");
    }
  };
}

async function addCategory() {
  const key = document.getElementById("cat-key").value.trim();
  const label = document.getElementById("cat-label").value.trim();
  const logo = document.getElementById("cat-logo").value.trim();

  if (!key || !label || !logo) {
    alert("Bitte alle Felder ausfüllen.");
    return;
  }

  const res = await fetch("/api/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ key, label, logo_file: logo }),
  });

  if (!res.ok) {
    alert("Fehler beim Anlegen der Kategorie");
    return;
  }

  document.getElementById("cat-key").value = "";
  document.getElementById("cat-label").value = "";
  document.getElementById("cat-logo").value = "";

  loadCategories();
}

document.getElementById("cat-add").onclick = addCategory;

loadCategories();