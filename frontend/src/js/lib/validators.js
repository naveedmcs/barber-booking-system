/**
 * Input Validation and Normalization Utilities
 */

export const SAUDI_PHONE_REGEX = /^05[0-9]{8}$/;

/**
 * Normalizes user-entered phone number into Saudi format 05XXXXXXXX
 */
export function normalizeSaudiPhone(val) {
  if (!val) return "";
  let clean = String(val).replace(/[\s\-\(\)]+/g, "");
  if (clean.startsWith("+966")) {
    clean = "0" + clean.slice(4);
  } else if (clean.startsWith("00966")) {
    clean = "0" + clean.slice(5);
  } else if (clean.startsWith("966") && clean.length > 9) {
    clean = "0" + clean.slice(3);
  }
  return clean;
}

/**
 * Validates whether string is a 10-digit Saudi phone starting with 05
 */
export function isValidSaudiPhone(phone) {
  const normalized = normalizeSaudiPhone(phone);
  return SAUDI_PHONE_REGEX.test(normalized);
}

/**
 * Validates email format
 */
export function isValidEmail(email) {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

/**
 * HTML entities escaper for secure dynamic DOM interpolation
 */
export function escapeHtml(text = "") {
  if (text === null || text === undefined) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
