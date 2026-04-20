// Date, time, and scheduling helpers.

window.Utils = (function () {
  const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

  function pad(n) {
    return n < 10 ? "0" + n : "" + n;
  }

  // "YYYY-MM-DD" for a Date, in local time.
  function formatDateISO(date) {
    if (!(date instanceof Date) || isNaN(date)) return "";
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
  }

  // Parse "YYYY-MM-DD" as a local-time Date (no TZ drift).
  // Returns null for invalid input instead of an Invalid Date.
  function parseDateISO(iso) {
    if (!iso || typeof iso !== "string" || iso.length !== 10) return null;
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return null;
    const date = new Date(y, m - 1, d);
    if (isNaN(date)) return null;
    return date;
  }

  function dayKey(date) {
    if (!(date instanceof Date) || isNaN(date)) return "sun";
    return DAY_KEYS[date.getDay()];
  }

  // Converts "HH:MM" to total minutes. Returns NaN for invalid input
  // so callers can detect and skip bad records rather than crashing.
  function timeToMinutes(t) {
    if (!t || typeof t !== "string") return NaN;
    const parts = t.split(":");
    if (parts.length !== 2) return NaN;
    const h = Number(parts[0]);
    const m = Number(parts[1]);
    if (isNaN(h) || isNaN(m)) return NaN;
    return h * 60 + m;
  }

  function minutesToTime(mins) {
    if (isNaN(mins) || mins == null) return "00:00";
    return pad(Math.floor(mins / 60)) + ":" + pad(mins % 60);
  }

  function formatTime12h(t) {
    if (!t || typeof t !== "string") return "";
    const parts = t.split(":");
    if (parts.length !== 2) return t;
    const h = Number(parts[0]);
    const m = Number(parts[1]);
    if (isNaN(h) || isNaN(m)) return t;
    const period = h >= 12 ? "PM" : "AM";
    const hh = h % 12 === 0 ? 12 : h % 12;
    return hh + ":" + pad(m) + " " + period;
  }

  function formatDateLong(iso) {
    const d = parseDateISO(iso);
    if (!d) return iso || "";
    return d.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric"
    });
  }

  function formatCurrency(n) {
    const num = Number(n);
    if (isNaN(num)) return "$0.00";
    return "$" + num.toFixed(2);
  }

  // Core scheduling logic.
  // Returns an array of { start, end } strings (HH:MM) for the date, given:
  //   dateIso:        "YYYY-MM-DD"
  //   service:        { durationMinutes }
  //   availability:   { slotDurationMinutes, bufferMinutes, workingHours, blockedDates }
  //   bookingsOnDate: [{ startTime, endTime, status }]
  function generateAvailableSlots(dateIso, service, availability, bookingsOnDate) {
    // Guard: invalid or blocked date
    if (!dateIso || !availability) return [];
    if (availability.blockedDates && availability.blockedDates.includes(dateIso)) return [];

    const date = parseDateISO(dateIso);
    if (!date) return [];

    const hours = availability.workingHours && availability.workingHours[dayKey(date)];
    if (!hours || hours.closed) return [];

    const slotStep   = Math.max(1, availability.slotDurationMinutes || 60);
    const serviceDur = service && service.durationMinutes > 0 ? service.durationMinutes : 60;
    const buffer     = availability.bufferMinutes != null ? availability.bufferMinutes : 120;
    const dayStart   = timeToMinutes(hours.start);
    const dayEnd     = timeToMinutes(hours.end);

    // Guard: unparseable working hours
    if (isNaN(dayStart) || isNaN(dayEnd) || dayEnd <= dayStart) return [];

    // Don't offer slots in the past (compared against start-of-slot, with a
    // 15-minute grace window to avoid edge cases around page-load time).
    const now = new Date();
    const todayIso = formatDateISO(now);
    const isToday  = todayIso === dateIso;
    const nowMinutes = now.getHours() * 60 + now.getMinutes() + 15;

    // Each booked slot blocks: [bookingStart, bookingEnd + buffer)
    const taken = (bookingsOnDate || [])
      .filter((b) => b.status !== "cancelled")
      .map((b) => {
        const start = timeToMinutes(b.startTime);
        const end   = timeToMinutes(b.endTime);
        // Skip records with unparseable times — don't crash
        if (isNaN(start) || isNaN(end)) return null;
        return [start, end + buffer];
      })
      .filter(Boolean);

    const slots = [];
    for (let t = dayStart; t + serviceDur <= dayEnd; t += slotStep) {
      if (isToday && t < nowMinutes) continue;
      const end = t + serviceDur;
      const conflict = taken.some(([a, b]) => t < b && end > a);
      if (!conflict) {
        slots.push({ start: minutesToTime(t), end: minutesToTime(end) });
      }
    }
    return slots;
  }

  // Returns an array of ISO date strings for the next N days, starting today.
  function nextNDates(n) {
    const out = [];
    const start = new Date();
    for (let i = 0; i < n; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      out.push(formatDateISO(d));
    }
    return out;
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  return {
    DAY_KEYS,
    formatDateISO,
    parseDateISO,
    dayKey,
    timeToMinutes,
    minutesToTime,
    formatTime12h,
    formatDateLong,
    formatCurrency,
    generateAvailableSlots,
    nextNDates,
    escapeHtml
  };
})();
