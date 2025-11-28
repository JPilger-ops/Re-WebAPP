function showError(msg) {
  const box = document.getElementById("error-box");
  box.textContent = msg;
  box.classList.remove("hidden");
  box.classList.add("shake");
  setTimeout(() => box.classList.remove("shake"), 300);
}

document.addEventListener("DOMContentLoaded", () => {

  const form = document.getElementById("login-form");
  const pw = document.getElementById("login-password");
  const toggle = document.getElementById("password-toggle");

  // Passwort Auge
  toggle.addEventListener("click", () => {
    const isText = pw.type === "text";
    pw.type = isText ? "password" : "text";
    toggle.textContent = isText ? "👁" : "🙈";
  });

  // SAFARI AUTOFILL FIX
  form.addEventListener("submit", async (e) => {

    // Safari MUSS das als "echten Submit" erkennen → kein preventDefault am Anfang

    const username = document.getElementById("login-username").value.trim();
    const password = pw.value;

    if (!username || !password) {
      e.preventDefault();
      showError("Bitte Benutzername und Passwort eingeben.");
      return;
    }

    // Jetzt Safari denkt: Login Formular wurde abgeschickt → AutoFill aktiv

    // Jetzt fangen wir den Request ab, um FETCH zu benutzen:
    e.preventDefault();

    const res = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showError(data.message || "Login fehlgeschlagen.");
      return;
    }

    window.location.href = "/";
  });
});