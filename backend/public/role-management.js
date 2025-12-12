// -----------------------------------------------
// Rollenverwaltung – role-management.js
// -----------------------------------------------

let roles = [];
let permissions = [];
let editingRoleId = null;

// -----------------------------------------------
// Fehler + Erfolg
// -----------------------------------------------
function showRoleError(msg) {
  const box = document.getElementById("role-error-box");
  box.textContent = msg;
  box.classList.remove("hidden");
  box.classList.remove("success-box");
}

function showRoleSuccess(msg) {
  const box = document.getElementById("role-success-box");
  box.textContent = msg;
  box.classList.remove("hidden");
  box.classList.add("success-box");
  setTimeout(() => box.classList.add("hidden"), 2000);
}

// -----------------------------------------------
// Verfügbare Permissions (Option A)
// -----------------------------------------------
permissions = [
  "invoices.read",
  "invoices.create",
  "invoices.update",
  "invoices.export",
  "invoices.delete",
  "customers.read",
  "customers.create",
  "customers.update",
  "customers.delete",
  "users.read",
  "users.create",
  "users.update",
  "users.delete",
  "users.resetPassword",
  "roles.read",
  "roles.create",
  "roles.update",
  "roles.delete",
  "settings.general",
  "categories.read",
  "categories.write",
  "categories.delete",
];

// -----------------------------------------------
// Rollen aus Backend laden
// -----------------------------------------------
async function loadRoles() {
  const res = await fetch("/api/roles", { credentials: "include" });

  if (res.status === 401) {
    window.location.href = "/login.html";
    return;
  }

  roles = await res.json();
  renderRoleTable();
}

// -----------------------------------------------
// Tabelle rendern
// -----------------------------------------------
function renderRoleTable() {
  const tbody = document.getElementById("role-table-body");
  tbody.innerHTML = "";

  roles.forEach(r => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${r.id}</td>
      <td>${r.name}</td>
      <td>${r.description || "-"}</td>
      <td>
        <button class="secondary-button small-btn" onclick="openRoleEdit(${r.id})">Bearbeiten</button>
        <button class="secondary-button small-btn" onclick="deleteRole(${r.id})" 
          style="background:#ffe5e5;border-color:#ffb3b3;color:#b20000;">Löschen</button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

// -----------------------------------------------
// Modal öffnen: Rolle bearbeiten
// -----------------------------------------------
window.openRoleEdit = async (id) => {
  editingRoleId = id;

  document.getElementById("modal-title").textContent = "Rolle bearbeiten";
  document.getElementById("role-error-box").classList.add("hidden");
  document.getElementById("role-success-box").classList.add("hidden");

  const role = roles.find(r => r.id === id);
  r_name.value = role.name;
  r_description.value = role.description || "";

  // Role permissions laden
  const res = await fetch(`/api/roles/${id}/permissions`, { credentials: "include" });
  const rolePerms = await res.json();

  renderPermissionList(rolePerms);

  document.getElementById("modal").classList.remove("hidden");
};

// -----------------------------------------------
// Modal öffnen: Neue Rolle
// -----------------------------------------------
document.getElementById("btn-new-role").addEventListener("click", () => {
  editingRoleId = null;
  document.getElementById("modal-title").textContent = "Neue Rolle";
  r_name.value = "";
  r_description.value = "";

  renderPermissionList([]);

  document.getElementById("role-error-box").classList.add("hidden");
  document.getElementById("role-success-box").classList.add("hidden");

  document.getElementById("modal").classList.remove("hidden");
});

// -----------------------------------------------
// Permissions-Checkboxen rendern
// -----------------------------------------------
function renderPermissionList(selected) {
  const list = document.getElementById("permission-list");
  list.innerHTML = "";

  permissions.forEach(p => {
    const row = document.createElement("div");
    row.style.marginBottom = "6px";

    row.innerHTML = `
      <label style="font-size:14px;display:flex;align-items:center;gap:8px;">
        <input type="checkbox" class="permCheck" value="${p}" ${selected.includes(p) ? "checked" : ""}>
        ${p}
      </label>
    `;

    list.appendChild(row);
  });
}

// -----------------------------------------------
// Speichern (neu oder update)
// -----------------------------------------------
document.getElementById("save-role").addEventListener("click", async () => {
  const name = r_name.value.trim();
  const description = r_description.value.trim();

  if (!name) {
    showRoleError("Rollenname darf nicht leer sein.");
    return;
  }

  const selectedPerms = [...document.querySelectorAll(".permCheck:checked")].map(c => c.value);

  let res;

  if (editingRoleId) {
    // Update
    res = await fetch(`/api/roles/${editingRoleId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name, description, permissions: selectedPerms })
    });
  } else {
    // Neu
    res = await fetch(`/api/roles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name, description, permissions: selectedPerms })
    });
  }

  if (!res.ok) {
    showRoleError("Fehler beim Speichern.");
    return;
  }

  showRoleSuccess("Gespeichert");
  document.getElementById("modal").classList.add("hidden");
  loadRoles();
});

// -----------------------------------------------
// Rolle löschen
// -----------------------------------------------
window.deleteRole = async (id) => {
  const ok = confirm("Diese Rolle wirklich löschen?");
  if (!ok) return;

  const res = await fetch(`/api/roles/${id}`, {
    method: "DELETE",
    credentials: "include"
  });

  if (!res.ok) {
    showRoleError("Fehler beim Löschen.");
    return;
  }

  loadRoles();
};

// -----------------------------------------------
// Modal schließen
// -----------------------------------------------
document.getElementById("close-modal").addEventListener("click", () => {
  document.getElementById("modal").classList.add("hidden");
});

// -----------------------------------------------
// Start
// -----------------------------------------------
loadRoles();