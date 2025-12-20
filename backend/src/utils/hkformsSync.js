import { getHkformsSettings } from "./hkformsSettings.js";

const HKFORMS_BASE = "https://app.bistrottelegraph.de/api";

const normalizeBaseUrl = (value) => {
  const trimmed = (value || "").trim();
  if (!trimmed) return HKFORMS_BASE;
  return trimmed.replace(/\/+$/, "");
};

/**
 * Sendet Status-Updates an HKForms, wenn Reservation-ID + Token vorliegen.
 * Fehler werden nur geloggt und blockieren den lokalen Status nicht.
 */
export async function sendHkformsStatus({ reservationId, payload, endpoint = "invoice-status" }) {
  const settings = await getHkformsSettings().catch((err) => {
    console.warn("[hkforms] Einstellungen nicht ladbar, nutze Fallback.", err?.message || err);
    return null;
  });

  const token = (settings?.api_key || process.env.HKFORMS_SYNC_TOKEN || "").trim();
  const baseUrl = normalizeBaseUrl(settings?.base_url || process.env.HKFORMS_BASE_URL || HKFORMS_BASE);
  const organization = (settings?.organization || process.env.HKFORMS_ORGANIZATION || "").trim();

  if (!reservationId) {
    console.warn("[hkforms] Keine reservation_request_id, überspringe Sync.");
    return;
  }

  if (!token) {
    console.warn("[hkforms] HKFORMS_SYNC_TOKEN fehlt, überspringe Sync.");
    return;
  }

  const url = `${baseUrl}/reservations/${encodeURIComponent(reservationId)}/${endpoint}`;

  try {
    const headers = {
      "Content-Type": "application/json",
      "X-HKFORMS-CRM-TOKEN": token,
    };
    if (organization) {
      headers["X-HKFORMS-ORG"] = organization;
    }

    const res = await fetch(url, {
      method: "POST",
      headers,
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
