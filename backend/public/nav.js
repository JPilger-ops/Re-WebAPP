// Sidebar Navigation + Rollen/Permissions-Steuerung
window.ensureAuthReady = async function () {
  if (!window.userLoaded) {
    await new Promise(resolve => {
      const check = setInterval(() => {
        if (window.userLoaded) {
          clearInterval(check);
          resolve();
        }
      }, 20);
    });
  }
}
// Hilfsfunktion: Element ausblenden
function hide(id) {
  const el = document.getElementById(id);
  if (el) {
    el.style.display = "none";
  }
}

// User-Daten vom Backend holen
async function loadUser() {
  try {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    if (!res.ok) {
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error("Fehler beim Laden des Benutzers:", err);
    return null;
  }
}

// Logout-Funktion
async function logout() {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
  } catch (err) {
    console.error("Fehler beim Logout:", err);
  }
  window.location.href = "/login.html";
}

async function initNavigation() {
  // 1. Aktuellen User laden
  const user = await loadUser();

  if (!user) {
    // nicht eingeloggt → ab zur Login-Seite
    window.location.href = "/login.html";
    return;
  }

  // 2. Rollen / Permissions auswerten
  const perms = user.permissions || [];

  // Global verfügbar für alle Skripte
  window.currentUserPermissions = perms;

  // Nur anzeigen, wenn entsprechende Permission vorhanden ist
  if (!perms.includes("users.read")) hide("nav-users");
  if (!perms.includes("roles.read")) hide("nav-roles");
  if (!perms.includes("customers.read")) hide("nav-customers");
  if (!perms.includes("categories.read")) hide("nav-categories");
  // Rechnungsübersicht darf praktisch jeder, also lassen wir die sichtbar.

  // 3. Navigation-Buttons mit Aktionen verknüpfen
  const bind = (id, target) => {
    const el = document.getElementById(id);
    if (!el) return;

    if (target === "#logout") {
      el.addEventListener("click", logout);
      return;
    }

    el.addEventListener("click", () => {
      window.location.href = target;
    });
  };

  bind("nav-dashboard", "/");
  bind("nav-invoices", "/invoices.html");
  bind("nav-create", "/create.html");
  bind("nav-customers", "/customers.html");
  bind("nav-users", "/user-management.html");
  bind("nav-roles", "/role-management.html");
  bind("nav-account", "/account.html");
  bind("nav-categories", "/categories.html");
  bind("nav-logout", "#logout");
}

document.addEventListener("DOMContentLoaded", initNavigation);

window.userLoaded = true;