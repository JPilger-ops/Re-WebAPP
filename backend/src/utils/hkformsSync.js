const HKFORMS_BASE = "https://app.bistrottelegraph.de/api";

/**
 * Sendet Status-Updates an HKForms, wenn Reservation-ID + Token vorliegen.
 * Fehler werden nur geloggt und blockieren den lokalen Status nicht.
 */
export async function sendHkformsStatus({ reservationId, payload }) {
  const token = (process.env.HKFORMS_SYNC_TOKEN || "").trim();

  if (!reservationId) {
    console.warn("[hkforms] Keine reservation_request_id, überspringe Sync.");
    return;
  }

  if (!token) {
    console.warn("[hkforms] HKFORMS_SYNC_TOKEN fehlt, überspringe Sync.");
    return;
  }

  const url = `${HKFORMS_BASE}/reservations/${encodeURIComponent(reservationId)}/invoice-status`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-HKFORMS-CRM-TOKEN": token,
      },
      body: JSON.stringify(payload || {}),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn("[hkforms] Sync fehlgeschlagen:", res.status, text);
    }
  } catch (err) {
    console.warn("[hkforms] Sync-Request Fehler:", err?.message || err);
  }
}
