function showError(msg) {
  const box = document.getElementById("error-box");
  box.textContent = msg;
  box.classList.remove("hidden");
  box.classList.remove("success-box");
}

function showSuccess(msg) {
  const box = document.getElementById("error-box");
  box.textContent = msg;
  box.classList.add("success-box");
  box.classList.remove("hidden");
}


// --------------------------------------------
// Passwort-Stärke Berechnung
// --------------------------------------------
function calculateStrength(pw) {
  let score = 0;

  if (pw.length >= 8) score++;
  if (pw.match(/[A-Z]/)) score++;
  if (pw.match(/[a-z]/)) score++;
  if (pw.match(/[0-9]/)) score++;
  if (pw.match(/[^A-Za-z0-9]/)) score++; // Sonderzeichen

  return score;
}

function renderStrength(pw) {
  const box = document.getElementById("pw-strength");
  const score = calculateStrength(pw);

  let text = "Passwort-Stärke: ";
  let color = "#666";

  switch (score) {
    case 0:
    case 1:
      text += "Sehr schwach";
      color = "#b20000";
      break;
    case 2:
      text += "Schwach";
      color = "#e67e22";
      break;
    case 3:
      text += "Mittel";
      color = "#f1c40f";
      break;
    case 4:
      text += "Gut";
      color = "#2ecc71";
      break;
    case 5:
      text += "Sehr stark";
      color = "#27ae60";
      break;
  }

  box.textContent = text;
  box.style.color = color;
}


// --------------------------------------------
// Passwort anzeigen
// --------------------------------------------
function setupPasswordToggle(inputId, toggleId) {
  const input = document.getElementById(inputId);
  const toggle = document.getElementById(toggleId);

  toggle.addEventListener("click", () => {
    const isText = input.type === "text";
    input.type = isText ? "password" : "text";
    toggle.textContent = isText ? "👁" : "🙈";
  });
}

setupPasswordToggle("newPw", "toggle-newPw");
setupPasswordToggle("newPw2", "toggle-newPw2");


// Live Stärke-Anzeige
document.getElementById("newPw").addEventListener("input", (e) => {
  renderStrength(e.target.value);
});


// --------------------------------------------
// Passwort ändern
// --------------------------------------------
document.getElementById("changePw").addEventListener("click", async () => {

  const currentPw = document.getElementById("currentPw").value;
  const newPw = document.getElementById("newPw").value;
  const newPw2 = document.getElementById("newPw2").value;

  if (!currentPw || !newPw || !newPw2) {
    showError("Bitte alle Felder ausfüllen.");
    return;
  }

  if (newPw !== newPw2) {
    showError("Neue Passwörter stimmen nicht überein.");
    return;
  }

  const res = await fetch("/api/auth/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ oldPassword: currentPw, newPassword: newPw })
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    showError(data.message || "Fehler beim Ändern des Passworts.");
    return;
  }

  showSuccess("Passwort erfolgreich geändert.");

  // Felder leeren
  document.getElementById("currentPw").value = "";
  document.getElementById("newPw").value = "";
  document.getElementById("newPw2").value = "";

  renderStrength("");
});