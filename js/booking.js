// Customer booking flow: service → date → time → contact → confirm.

(async function () {
  document.getElementById("year").textContent = new Date().getFullYear();
  await DB.init();

  const state = { service: null, date: null, slot: null, availability: null };
  state.availability = await DB.getAvailability();

  const sectionIds = ["step1", "step2", "step3", "step4", "step5"];

  function show(step) {
    sectionIds.forEach((id, i) => {
      document.getElementById(id).classList.toggle("hidden", i !== step - 1);
    });
    document.querySelectorAll(".step-item").forEach((el) => {
      const n = Number(el.dataset.step);
      el.classList.toggle("active", n === step);
      el.classList.toggle("done", n < step);
      // Update dot: show checkmark when done
      const dot = el.querySelector(".step-dot");
      if (n < step) dot.textContent = "✓";
      else dot.textContent = n;
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  document.querySelectorAll("[data-back]").forEach((btn) => {
    btn.addEventListener("click", () => show(Number(btn.dataset.back)));
  });

  // ---------- Step 1: services ----------
  const services = await DB.listActiveServices();
  const servicesList = document.getElementById("servicesList");
  if (services.length === 0) {
    servicesList.innerHTML = '<div class="muted">No services available right now. Please call us.</div>';
  } else {
    servicesList.innerHTML = services.map(s => `
      <div class="service-choice" data-svc="${s.id}">
        <div class="service-choice-info">
          <div class="service-choice-name">${Utils.escapeHtml(s.name)}</div>
          <div class="service-choice-desc">${Utils.escapeHtml(s.description || "")}</div>
        </div>
        <div class="service-choice-meta">
          <div class="service-choice-price">${Utils.formatCurrency(s.price)}</div>
          <div class="service-choice-dur">${s.durationMinutes} min</div>
        </div>
      </div>
    `).join("");
    servicesList.querySelectorAll("[data-svc]").forEach((el) => {
      el.addEventListener("click", () => selectService(el.dataset.svc));
    });
  }

  async function selectService(id) {
    state.service = services.find((s) => s.id === id);
    if (!state.service) return;
    const lbl = document.getElementById("selectedServiceLabel");
    lbl.innerHTML = `<strong>${Utils.escapeHtml(state.service.name)}</strong> &nbsp;·&nbsp; ${state.service.durationMinutes} min &nbsp;·&nbsp; ${Utils.formatCurrency(state.service.price)}`;
    lbl.style.display = "flex";
    renderDateGrid();
    show(2);
  }

  // Pre-select from ?service= query param — skip step 1 if a service was passed.
  const params = new URLSearchParams(location.search);
  const presel = params.get("service");
  const preselected = !!(presel && services.find((s) => s.id === presel));
  if (preselected) selectService(presel);

  // ---------- Step 2: dates ----------
  function renderDateGrid() {
    const grid = document.getElementById("dateGrid");
    const dates = Utils.nextNDates(21);
    grid.innerHTML = dates.map((iso) => {
      const d = Utils.parseDateISO(iso);
      const dow = d.toLocaleDateString(undefined, { weekday: "short" });
      const mon = d.toLocaleDateString(undefined, { month: "short" });
      const dnum = d.getDate();
      const hours = state.availability.workingHours[Utils.dayKey(d)];
      const blocked = (state.availability.blockedDates || []).includes(iso);
      const disabled = blocked || !hours || hours.closed;
      return `<div class="date-btn ${disabled ? "disabled" : ""}" data-date="${iso}">
        <div class="dow">${dow}</div>
        <div class="dnum">${dnum}</div>
        <div class="mon">${mon}</div>
      </div>`;
    }).join("");
    grid.querySelectorAll(".date-btn:not(.disabled)").forEach((el) => {
      el.addEventListener("click", () => selectDate(el.dataset.date));
    });
  }

  async function selectDate(iso) {
    state.date = iso;
    document.querySelectorAll(".date-btn").forEach((el) =>
      el.classList.toggle("selected", el.dataset.date === iso)
    );
    const lbl = document.getElementById("selectedDateLabel");
    lbl.innerHTML = `<strong>${Utils.escapeHtml(state.service.name)}</strong> &nbsp;·&nbsp; ${Utils.formatDateLong(iso)}`;
    lbl.style.display = "flex";
    await renderSlots();
    show(3);
  }

  // ---------- Step 3: slots ----------
  async function renderSlots() {
    const slotGrid = document.getElementById("slotGrid");
    slotGrid.innerHTML = '<div class="muted" style="padding:1rem 0">Finding available times…</div>';
    let bookings = [];
    try {
      bookings = await DB.listBookingsByDate(state.date);
    } catch (e) {
      // If we can't read existing bookings (e.g. permission denied), proceed with no conflicts.
      console.warn("Could not load bookings for conflict check:", e.message);
    }
    const slots = Utils.generateAvailableSlots(state.date, state.service, state.availability, bookings);
    if (slots.length === 0) {
      slotGrid.innerHTML = '<div class="muted" style="padding:1rem 0">No available times on this day — please pick another date.</div>';
      return;
    }
    slotGrid.innerHTML = slots.map((s) =>
      `<div class="slot" data-start="${s.start}" data-end="${s.end}">${Utils.formatTime12h(s.start)}</div>`
    ).join("");
    slotGrid.querySelectorAll(".slot").forEach((el) => {
      el.addEventListener("click", () => {
        slotGrid.querySelectorAll(".slot").forEach((x) => x.classList.remove("selected"));
        el.classList.add("selected");
        state.slot = { start: el.dataset.start, end: el.dataset.end };
        updateSummary();
        show(4);
      });
    });
  }

  // ---------- Step 4: contact ----------
  function updateSummary() {
    const el = document.getElementById("bookingSummary");
    el.innerHTML =
      `<strong>${Utils.escapeHtml(state.service.name)}</strong> &nbsp;·&nbsp; ` +
      `${Utils.formatDateLong(state.date)} at <strong>${Utils.formatTime12h(state.slot.start)}</strong> &nbsp;·&nbsp; ` +
      `${Utils.formatCurrency(state.service.price)}`;
    el.style.display = "flex";
  }

  document.getElementById("contactForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errEl = document.getElementById("formError");
    errEl.textContent = "";
    const btn = document.getElementById("submitBtn");
    btn.disabled = true;
    btn.innerHTML = '<span class="loading"></span> Booking…';

    try {
      const custData = {
        name: document.getElementById("custName").value.trim(),
        phone: document.getElementById("custPhone").value.trim(),
        email: document.getElementById("custEmail").value.trim().toLowerCase(),
        address: document.getElementById("custAddress").value.trim(),
        notes: document.getElementById("custNotes").value.trim()
      };

      // Client-side validation — mirrors Firestore server-side rules.
      if (!custData.name || custData.name.length < 2) {
        throw new Error("Please enter your full name (at least 2 characters).");
      }
      if (custData.name.length > 100) {
        throw new Error("Name must be 100 characters or fewer.");
      }
      if (!custData.email || custData.email.length < 5 || !custData.email.includes("@") || !custData.email.includes(".")) {
        throw new Error("Please enter a valid email address.");
      }
      if (!custData.address) {
        throw new Error("Please enter your service address so we know where to come.");
      }

      let customer = await DB.findCustomerByEmail(custData.email);
      if (customer) {
        await DB.updateCustomer(customer.id, {
          name: custData.name,
          phone: custData.phone,
          address: custData.address
        });
      } else {
        customer = await DB.addCustomer(custData);
      }

      const checklist = (state.availability.checklistTemplate || []).map((label) => ({ label, done: false }));

      const booking = await DB.addBooking({
        serviceId: state.service.id,
        serviceName: state.service.name,
        servicePrice: state.service.price,
        customerId: customer.id,
        // Always use custData (fresh form values) — not the stale DB record.
        customerName: custData.name,
        customerPhone: custData.phone,
        customerEmail: custData.email,
        address: custData.address,
        notes: custData.notes,
        date: state.date,
        startTime: state.slot.start,
        endTime: state.slot.end,
        status: "pending",
        checklist,
        adminNotes: ""
      });

      document.getElementById("confirmText").innerHTML =
        `Your <strong>${Utils.escapeHtml(state.service.name)}</strong> is scheduled for ` +
        `<strong>${Utils.formatDateLong(state.date)}</strong> at ` +
        `<strong>${Utils.formatTime12h(state.slot.start)}</strong>.<br/><br/>` +
        `Confirmation: <code>${booking.id}</code>`;
      show(5);
    } catch (err) {
      console.error("[booking] submit error:", err);
      errEl.textContent = err.message || "Something went wrong. Please try again.";
      btn.disabled = false;
      btn.textContent = "Confirm Booking →";
    }
  });

  if (!preselected) show(1);
})();
