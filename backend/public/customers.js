let customers = [];
let editingId = null;

// ---------------------------------------------------------
// Kunden laden
// ---------------------------------------------------------
async function loadCustomers() {
    const res = await fetch("/api/customers", {
        credentials: "include",
    });

    if (res.status === 401) {
        window.location.href = "/login.html";
        return;
    }

    customers = await res.json();
    renderTable();
}

// ---------------------------------------------------------
// Tabelle rendern
// ---------------------------------------------------------
function renderTable() {
    const tbody = document.querySelector("#customer-table tbody");
    tbody.innerHTML = "";

    customers.forEach(c => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${c.name}</td>
            <td>${c.street}</td>
            <td>${c.zip}</td>
            <td>${c.city}</td>
            <td>
                <button class="secondary-button small-btn" onclick="editCustomer(${c.id})">Bearbeiten</button>
                <button class="secondary-button small-btn" style="background:#ffe5e5;border-color:#ffb3b3;color:#b20000" onclick="deleteCustomer(${c.id})">Löschen</button>
            </td>
        `;

        tbody.appendChild(tr);
    });
}

// ---------------------------------------------------------
// Modal öffnen
// ---------------------------------------------------------
function openModal(edit = false) {
    document.getElementById("modal").classList.remove("hidden");
    document.getElementById("modal-title").innerText = edit ? "Kunde bearbeiten" : "Neuer Kunde";
}

// ---------------------------------------------------------
function closeModal() {
    document.getElementById("modal").classList.add("hidden");
    editingId = null;
}

// ---------------------------------------------------------
document.getElementById("btn-new").onclick = () => {
    editingId = null;

    c_name.value = "";
    c_street.value = "";
    c_zip.value = "";
    c_city.value = "";

    openModal(false);
};

document.getElementById("close-modal").onclick = closeModal;

// ---------------------------------------------------------
// Kunde speichern (NEU + BEARBEITEN)
// ---------------------------------------------------------
document.getElementById("save-customer").onclick = async () => {
    const payload = {
        name: c_name.value,
        street: c_street.value,
        zip: c_zip.value,
        city: c_city.value
    };

    let res;

    if (editingId) {
        res = await fetch(`/api/customers/${editingId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(payload),
        });
    } else {
        res = await fetch(`/api/customers`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(payload),
        });
    }

    // 401 abfangen NACHDEM res existiert
    if (res.status === 401) {
        window.location.href = "/login.html";
        return;
    }

    if (!res.ok) {
        alert("Fehler beim Speichern des Kunden.");
        return;
    }

    closeModal();
    loadCustomers();
};

// ---------------------------------------------------------
// Kunde bearbeiten
// ---------------------------------------------------------
function editCustomer(id) {
    editingId = id;
    const c = customers.find(x => x.id === id);

    c_name.value = c.name;
    c_street.value = c.street;
    c_zip.value = c.zip;
    c_city.value = c.city;

    openModal(true);
}

// ---------------------------------------------------------
// Kunde löschen
// ---------------------------------------------------------
async function deleteCustomer(id) {
    if (!confirm("Diesen Kunden wirklich löschen?")) return;

    const res = await fetch(`/api/customers/${id}`, {
        method: "DELETE",
        credentials: "include",
    });

    if (res.status === 401) {
        window.location.href = "/login.html";
        return;
    }

    loadCustomers();
}

// ---------------------------------------------------------
// START
// ---------------------------------------------------------
loadCustomers();