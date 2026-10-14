/**
 * Formatting and Localization Utilities
 */

/**
 * Format currency amount in Saudi Riyals (SAR)
 */
export function formatSar(amount = 0) {
  const num = Number(amount) || 0;
  return `${num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} SAR`;
}

/**
 * Formats ISO date string to readable format
 */
export function formatDate(isoDate, locale = "en-US") {
  if (!isoDate) return "";
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return String(isoDate);
    return d.toLocaleDateString(locale, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  } catch {
    return String(isoDate);
  }
}

/**
 * Formats ISO date time string to localized string
 */
export function formatDateTime(isoString) {
  if (!isoString) return "-";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
  } catch {
    return isoString;
  }
}

/**
 * Converts date string ("YYYY-MM-DD") and slot ("HH:MM" or "HH:MM AM/PM") into an ISO timestamp
 */
export function convertSlotToIso(dateStr, timeStr) {
  if (!dateStr) dateStr = new Date().toISOString().split("T")[0];
  if (!timeStr) return `${dateStr}T10:00:00`;

  let hour = 10;
  let min = 0;

  if (timeStr.includes("AM") || timeStr.includes("PM")) {
    const parts = timeStr.trim().split(" ");
    const [h, m] = parts[0].split(":").map(Number);
    hour = h;
    min = m || 0;
    if (parts[1].toUpperCase() === "PM" && hour < 12) hour += 12;
    if (parts[1].toUpperCase() === "AM" && hour === 12) hour = 0;
  } else if (timeStr.includes(":")) {
    const [h, m] = timeStr.trim().split(":").map(Number);
    hour = h;
    min = m || 0;
  }

  const pad = (n) => String(n).padStart(2, "0");
  return `${dateStr}T${pad(hour)}:${pad(min)}:00`;
}
