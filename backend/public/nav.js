// Sidebar Navigation + Rollen/Permissions-Steuerung
window.userLoaded = false;
const FAVICON_PATH = "/logos/RE-WebAPP.png";

function ensureFavicon() {
  if (!document) return;
  const head = document.head || document.getElementsByTagName("head")[0];
  if (!head) return;

  const ensureLink = (selector, relValue) => {
    let link = head.querySelector(selector);
    if (!link) {
      link = document.createElement("link");
      link.rel = relValue;
      head.appendChild(link);
    }
    link.type = "image/png";
    link.href = FAVICON_PATH;
  };

  // Standard-Favicon + Apple-Touch-Icon für iOS Homescreen
  ensureLink('link[rel="icon"]', "icon");
  ensureLink('link[rel="apple-touch-icon"]', "apple-touch-icon");
}

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
    const res = await fetch("/api/auth/me", {
      credentials: "include",
      cache: "no-store",
      headers: { "Cache-Control": "no-store" },
    });
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
  ensureFavicon();
  // 1. Aktuellen User laden
  const user = await loadUser();

  if (!user) {
    // nicht eingeloggt → ab zur Login-Seite
    window.userLoaded = true;
    window.location.href = "/login.html";
    return;
  }

  // 2. Rollen / Permissions auswerten
  const perms = user.permissions || [];
  window.currentUserRoleName = user.role_name;

  // Global verfügbar für alle Skripte
  window.currentUserPermissions = perms;

  // Nur anzeigen, wenn entsprechende Permission vorhanden ist
  if (!perms.includes("users.read")) hide("nav-users");
  if (!perms.includes("roles.read")) hide("nav-roles");
  if (!perms.includes("customers.read")) hide("nav-customers");
  if (!perms.includes("categories.read") && !perms.includes("settings.general")) hide("nav-categories");
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

  // Version-Badge in die Sidebar setzen
  renderVersionBadge();

  // Signal: Benutzer + Permissions sind bereit
  window.userLoaded = true;
}

document.addEventListener("DOMContentLoaded", initNavigation);

async function renderVersionBadge() {
  try {
    const res = await fetch("/api/version", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    const label = data?.version ? `RechnungsWebAPP  v${data.version}` : null;
    if (!label) return;

    const sidebar = document.querySelector(".sidebar");
    if (!sidebar) return;
    let badge = document.getElementById("sidebar-version");
    if (!badge) {
      badge = document.createElement("div");
      badge.id = "sidebar-version";
      badge.className = "sidebar-version";
      sidebar.appendChild(badge);
    }
    badge.textContent = data?.build ? `${label} • ${data.build}` : label;
  } catch (err) {
    console.warn("Version laden fehlgeschlagen:", err);
  }
}
