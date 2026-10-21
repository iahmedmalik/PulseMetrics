// Rule P-1: an event is a fixed name chosen in the host app's code plus a random browser id.
// Nothing that could carry a page address, token, name, phone number, email or health data fits.

/** Lowercase words joined by underscores, starting with a letter, 2 to 40 characters. */
export const EVENT_NAME_PATTERN = /^[a-z][a-z0-9_]{1,39}$/;
/** What the snippet generates: lowercase letters and digits only. */
export const ANON_ID_PATTERN = /^[a-z0-9]{16,32}$/;
/** What a site key looks like (24 hex characters). */
export const SITE_KEY_PATTERN = /^[a-f0-9]{24}$/;

const LONGEST_WORD = 15;

/**
 * A second layer on top of the pattern: a random token written in lowercase letters and digits
 * would still fit the pattern, so we also refuse long unbroken words and runs of three or more digits.
 * Real event names are short verbs and nouns ("payment_recorded"). This is defence in depth, not proof:
 * the real guarantee is that the host app passes fixed names and never reads the page address.
 */
export function isValidEventName(value: unknown): value is string {
  if (typeof value !== "string" || !EVENT_NAME_PATTERN.test(value)) return false;
  if (/\d{3,}/.test(value)) return false;
  if (value.endsWith("_") || value.includes("__")) return false;
  return value.split("_").every((word) => word.length <= LONGEST_WORD);
}

export function isValidAnonId(value: unknown): value is string {
  return typeof value === "string" && ANON_ID_PATTERN.test(value);
}

export function isValidSiteKey(value: unknown): value is string {
  return typeof value === "string" && SITE_KEY_PATTERN.test(value);
}
