/* ============================================
   Gold Mitra — IST date boundaries
   Single source of truth for "today / this week / this month" maths.

   The shop is in Tumkur, so every period boundary is drawn in IST
   (UTC+05:30) rather than UTC. Using UTC would file every application
   logged between midnight and 5:30am under the previous day, and would
   start weeks on Sunday.
   ============================================ */

const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/* Midnight IST for the day `ref` falls in, as a UTC instant. */
function istStartOfDay(ref = new Date()) {
  const shifted = new Date(ref.getTime() + IST_OFFSET_MS);
  return new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) -
      IST_OFFSET_MS
  );
}

/* Start of the IST day after `ref`'s day. */
function istEndOfDay(ref = new Date()) {
  return new Date(istStartOfDay(ref).getTime() + DAY_MS);
}

/* Monday 00:00 IST of the week containing `ref`. */
function istStartOfWeek(ref = new Date()) {
  const dayStart = istStartOfDay(ref);
  const shifted = new Date(dayStart.getTime() + IST_OFFSET_MS);
  const isoDow = (shifted.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(dayStart.getTime() - isoDow * DAY_MS);
}

function istStartOfMonth(ref = new Date()) {
  const shifted = new Date(ref.getTime() + IST_OFFSET_MS);
  return new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1) - IST_OFFSET_MS
  );
}

function istStartOfYear(ref = new Date()) {
  const shifted = new Date(ref.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), 0, 1) - IST_OFFSET_MS);
}

/* YYYY-MM-DD for the given date, read in IST (not UTC). */
function istDateKey(d) {
  const shifted = new Date(d.getTime() + IST_OFFSET_MS);
  const pad = (n) => String(n).padStart(2, '0');
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

/* Parse a YYYY-MM-DD key into the IST day range it names.
   Returns null when the key is not a real calendar date. */
function istDayRange(key) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || '').trim());
  if (!m) return null;

  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);

  // Reject impossible dates (e.g. 2026-02-30) by round-tripping.
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (
    probe.getUTCFullYear() !== y ||
    probe.getUTCMonth() !== mo - 1 ||
    probe.getUTCDate() !== d
  ) {
    return null;
  }

  const start = new Date(Date.UTC(y, mo - 1, d) - IST_OFFSET_MS);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

/* Parse a YYYY-MM key into the IST month range it names. */
function istMonthRange(key) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(key || '').trim());
  if (!m) return null;

  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;

  const start = new Date(Date.UTC(y, mo - 1, 1) - IST_OFFSET_MS);
  const end = new Date(Date.UTC(y, mo, 1) - IST_OFFSET_MS);
  return { start, end };
}

/* YYYY-MM for the given date, read in IST. */
function istMonthKey(d) {
  const shifted = new Date(d.getTime() + IST_OFFSET_MS);
  const pad = (n) => String(n).padStart(2, '0');
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}`;
}

module.exports = {
  DAY_MS,
  IST_OFFSET_MS,
  istStartOfDay,
  istEndOfDay,
  istStartOfWeek,
  istStartOfMonth,
  istStartOfYear,
  istDateKey,
  istMonthKey,
  istDayRange,
  istMonthRange
};
