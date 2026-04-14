// Date, time, and scheduling helpers.

window.Utils = (function () {
  const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

  function pad(n) {
    return n < 10 ? "0" + n : "" + n;
  }

  // "YYYY-MM-DD" for a Date, in local time.
  function formatDateISO(date) {
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
  }

  // Parse "YYYY-MM-DD" as a local-time Date (no TZ drift).
  function parseDateISO(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function dayKey(date) {
    return DAY_KEYS[date.getDay()];
  }

  function timeToMinutes(t) {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  }

  function minutesToTime(mins) {
    return pad(Math.floor(mins / 60)) + ":" + pad(mins % 60);
  }

  function formatTime12h(t) {
    const [h, m] = t.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hh = h % 12 === 0 ? 12 : h % 12;
    return hh + ":" + pad(m) + " " + period;
  }

  function formatDateLong(iso) {
    const d = parseDateISO(iso);
    return d.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric"
    });
  }

  function formatCurrency(n) {
    return "$" + Number(n).toFixed(2);
  }

  // Core scheduling logic.
  // Returns an array of { start, end } strings (HH:MM) for the date, given:
  //   dateIso:        "YYYY-MM-DD"
  //   service:        { durationMinutes }
  //   availability:   { slotDurationMinutes, bufferMinutes, workingHours, blockedDates }
  //   bookingsOnDate: [{ startTime, endTime, status }]
  function generateAvailableSlots(dateIso, service, availability, bookingsOnDate) {
    if (availability.blockedDates && availability.blockedDates.includes(dateIso)) return [];

    const date = parseDateISO(dateIso);
    const hours = availability.workingHours[dayKey(date)];
    if (!hours || hours.closed) return [];

    const slotStep = availability.slotDurationMinutes || 60;
    const serviceDur = service.durationMinutes || 60;
    const buffer = availability.bufferMinutes != null ? availability.bufferMinutes : 120;
    const dayStart = timeToMinutes(hours.start);
    const dayEnd = timeToMinutes(hours.end);

    // Don't offer slots in the past.
    const now = new Date();
    const isToday = formatDateISO(now) === dateIso;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    // Each booked slot blocks: [bookingStart, bookingEnd + buffer)
    const taken = (bookingsOnDate || [])
      .filter((b) => b.status !== "cancelled")
      .map((b) => [timeToMinutes(b.startTime), timeToMinutes(b.endTime) + buffer]);

    const slots = [];
    for (let t = dayStart; t + serviceDur <= dayEnd; t += slotStep) {
      if (isToday && t <= nowMinutes) continue;
      const end = t + serviceDur;
      // A slot [t, end) conflicts if it overlaps any blocked range [a, b)
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
      const d = new Date(start);
      d.setDate(start.getDate() + i);
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
