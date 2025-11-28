let users = [];
let allRoles = [];
let editUserId = null; // NULL = Neuer Benutzer, >0 = Bearbeiten-Modus

// -----------------------------------------------
// Helper-Funktionen für Feedback
// -----------------------------------------------
function showUserError(msg) {
  const box = document.getElementById("user-error-box");
  box.textContent = msg;
  box.classList.remove("hidden");
  box.classList.remove("success-box");
}

function showUserSuccess(msg) {
  const box = document.getElementById("user-success-box");
  box.textContent = msg;
  box.classList.remove("hidden");
  box.classList.add("success-box");
  setTimeout(() => box.classList.add("hidden"), 2000);
}


// -----------------------------------------------
// Passwort-Stärke
// -----------------------------------------------
function calcStrength(pw) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.match(/[A-Z]/)) score++;
  if (pw.match(/[a-z]/)) score++;
  if (pw.match(/[0-9]/)) score++;
  if (pw.match(/[^A-Za-z0-9]/)) score++;
  return score;
}

function renderUserPwStrength(pw) {
  const box = document.getElementById("u_pw-strength");
  const score = calcStrength(pw);

  const map = {
    1: ["Sehr schwach", "#b20000"],
    2: ["Schwach", "#e67e22"],
    3: ["Mittel", "#f1c40f"],
    4: ["Gut", "#2ecc71"],
    5: ["Sehr stark", "#27ae60"],
  };

  const [text, color] = map[score] || ["-", "#666"];
  box.textContent = "Passwort-Stärke: " + text;
  box.style.color = color;
}

document.getElementById("u_password").addEventListener("input", (e) => {
  renderUserPwStrength(e.target.value);
});


// -----------------------------------------------
// Passwort anzeigen / verstecken
// -----------------------------------------------
function setupToggle(inputId, toggleId) {
  const input = document.getElementById(inputId);
  const toggle = document.getElementById(toggleId);

  toggle.addEventListener("click", () => {
    const isText = input.type === "text";
    input.type = isText ? "password" : "text";
    toggle.textContent = isText ? "👁" : "🙈";
  });
}

setupToggle("u_password", "toggle-u_password");


// -----------------------------------------------
// Rollen laden
// -----------------------------------------------
async function loadAllRoles() {
  const res = await fetch("/api/roles", { credentials: "include" });
  allRoles = await res.json();
}

function fillRoleDropdown(selected) {
  const select = document.getElementById("u_role");
  select.innerHTML = "";

  allRoles.forEach((role) => {
    const opt = document.createElement("option");
    opt.value = role.id;
    opt.textContent = role.name;
    if (selected && Number(selected) === role.id) opt.selected = true;
    select.appendChild(opt);
  });
}


// -----------------------------------------------
// Benutzer laden
// -----------------------------------------------
async function loadUsers() {
  const res = await fetch("/api/users", { credentials: "include" });

  if (res.status === 401) {
    window.location.href = "/login.html";
    return;
  }

  users = await res.json();
  renderTable();
}


// -----------------------------------------------
// Tabelle rendern
// -----------------------------------------------
function renderTable() {
  const tbody = document.getElementById("user-table-body");
  tbody.innerHTML = "";

  users.forEach((user) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${user.id}</td>
      <td>${user.username}</td>
      <td>${user.role_name || "-"}</td>
      <td>${user.created_at ? new Date(user.created_at).toLocaleDateString("de-DE") : "-"}</td>
      <td class="actions-cell">

        <button class="secondary-button small-btn" onclick="openEditUser(${user.id})">
          Bearbeiten
        </button>

        <button class="secondary-button small-btn" onclick="resetPassword(${user.id})">
          Passwort zurücksetzen
        </button>

        <button class="secondary-button small-btn" onclick="toggleActive(${user.id}, ${user.is_active})">
          ${user.is_active ? "Deaktivieren" : "Aktivieren"}
        </button>

        <button class="danger-button small-btn" onclick="deleteUser(${user.id})">
          Löschen
        </button>

      </td>
    `;

    tbody.appendChild(tr);
  });
}


// -----------------------------------------------
// Benutzer löschen
// -----------------------------------------------
async function deleteUser(id) {
  const ok = confirm("Diesen Benutzer wirklich löschen?");
  if (!ok) return;

  await fetch(`/api/users/${id}`, {
    method: "DELETE",
    credentials: "include",
  });

  loadUsers();
}


// -----------------------------------------------
// Modal öffnen – Neuer Benutzer
// -----------------------------------------------
document.getElementById("btn-new-user").addEventListener("click", () => {
  editUserId = null;

  document.getElementById("modal-title").textContent = "Neuer Benutzer";
  document.getElementById("pw-section").classList.remove("hidden");

  u_username.value = "";
  u_password.value = "";
  renderUserPwStrength("");
  fillRoleDropdown(null);

  document.getElementById("modal").classList.remove("hidden");
});


// -----------------------------------------------
// Modal schließen
// -----------------------------------------------
document.getElementById("close-modal").addEventListener("click", () => {
  document.getElementById("modal").classList.add("hidden");
});


// -----------------------------------------------
// SPEICHERN – entscheidet zwischen „Neu“ und „Bearbeiten“
// -----------------------------------------------
document.getElementById("save-user").addEventListener("click", async () => {
  if (editUserId === null) {
    await createNewUser();
  } else {
    await saveEditedUser(editUserId);
  }
});


// -----------------------------------------------
// Neuen Benutzer erstellen
// -----------------------------------------------
async function createNewUser() {
  const username = u_username.value.trim();
  const password = u_password.value;
  const role_id = Number(u_role.value);

  if (!username || !password) {
    showUserError("Bitte alle Felder ausfüllen.");
    return;
  }

  if (calcStrength(password) < 3) {
    showUserError("Passwort ist zu schwach.");
    return;
  }

  const res = await fetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ username, password, role_id }),
  });

  const data = await res.json().catch(() => ({}));

  if (res.status === 409) {
    showUserError("Benutzername existiert bereits.");
    return;
  }

  if (!res.ok) {
    showUserError(data.message || "Fehler beim Speichern.");
    return;
  }

  showUserSuccess("Benutzer erfolgreich erstellt.");
  document.getElementById("modal").classList.add("hidden");
  loadUsers();
}


// -----------------------------------------------
// Benutzer bearbeiten – Modal öffnen
// -----------------------------------------------
function openEditUser(id) {
  editUserId = id;
  const user = users.find(u => u.id === id);

  document.getElementById("modal-title").textContent = "Benutzer bearbeiten";
  document.getElementById("pw-section").classList.add("hidden");

  u_username.value = user.username;
  u_password.value = "";
  fillRoleDropdown(user.role_id);

  document.getElementById("modal").classList.remove("hidden");
}


// -----------------------------------------------
// Bearbeiteten Benutzer speichern (PUT)
// -----------------------------------------------
async function saveEditedUser(id) {
  const username = u_username.value.trim();
  const role_id = Number(u_role.value);

  if (!username) {
    showUserError("Benutzername darf nicht leer sein.");
    return;
  }

  const user = users.find(u => u.id === id);

  const res = await fetch(`/api/users/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      username,
      role_id,
      is_active: user.is_active
    })
  });

  const data = await res.json().catch(() => ({}));

  if (res.status === 409) {
    showUserError("Benutzername existiert bereits.");
    return;
  }

  if (!res.ok) {
    showUserError(data.message || "Fehler beim Aktualisieren.");
    return;
  }

  showUserSuccess("Benutzer gespeichert.");
  document.getElementById("modal").classList.add("hidden");
  loadUsers();
}


// -----------------------------------------------
// Aktiv / Inaktiv umschalten
// -----------------------------------------------
async function toggleActive(id, current) {
  const user = users.find(u => u.id === id);

  const res = await fetch(`/api/users/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      username: user.username,
      role_id: user.role_id,
      is_active: !current
    })
  });

  if (!res.ok) {
    alert("Fehler beim Umschalten des Status.");
    return;
  }

  loadUsers();
}


// -----------------------------------------------
// Passwort zurücksetzen (Admin)
// -----------------------------------------------
async function resetPassword(id) {
  const ok = confirm("Passwort wirklich zurücksetzen?");
  if (!ok) return;

  const res = await fetch(`/api/users/${id}/reset-password`, {
    method: "POST",
    credentials: "include"
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    alert(data.message || "Fehler beim Zurücksetzen.");
    return;
  }

  alert(`Neues Passwort für Benutzer:\n${data.username}\n\nPasswort: ${data.newPassword}`);
}


// -----------------------------------------------
// Initialisierung
// -----------------------------------------------
(async () => {
  await loadAllRoles();
  await loadUsers();
})();