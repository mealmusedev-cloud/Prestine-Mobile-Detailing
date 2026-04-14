// Admin dashboard — tabs: Bookings, Calendar, Services, Customers, Availability.

(async function () {
  Auth.requireAdmin();
  await DB.init();

  // ---------- Tabs ----------
  const tabBtns = document.querySelectorAll("#adminTabs button");
  const tabSections = document.querySelectorAll(".tab-content");

  function switchTab(name) {
    tabBtns.forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
    tabSections.forEach((s) => s.classList.toggle("hidden", s.id !== "tab-" + name));
    const loader = tabLoaders[name];
    if (loader) loader();
  }

  tabBtns.forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.tab)));
  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await Auth.logout();
    window.location.href = "login.html";
  });

  // ---------- Modal helpers ----------
  function openModal(title, bodyHtml, actions) {
    document.getElementById("modalTitle").textContent = title;
    document.getElementById("modalBody").innerHTML = bodyHtml;
    const actEl = document.getElementById("modalActions");
    actEl.innerHTML = "";
    actions.forEach(({ label, cls, fn }) => {
      const b = document.createElement("button");
      b.className = "btn " + (cls || "");
      b.textContent = label;
      b.addEventListener("click", fn);
      actEl.appendChild(b);
    });
    document.getElementById("modal").classList.add("show");
  }

  function closeModal() {
    document.getElementById("modal").classList.remove("show");
  }

  document.getElementById("modal").addEventListener("click", (e) => {
    if (e.target.id === "modal") closeModal();
  });

  // ======================================================================
  //  BOOKINGS TAB
  // ======================================================================
  async function loadBookings() {
    const all = await DB.listBookings();
    const dateFilter = document.getElementById("fBookDate").value;
    const statusFilter = document.getElementById("fBookStatus").value;
    let list = all.sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
    if (dateFilter) list = list.filter((b) => b.date === dateFilter);
    if (statusFilter) list = list.filter((b) => b.status === statusFilter);

    const wrap = document.getElementById("bookingsTableWrap");
    if (list.length === 0) {
      wrap.innerHTML = '<div class="empty-state">No bookings found.</div>';
      return;
    }
    wrap.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Date</th><th>Time</th><th>Service</th><th>Customer</th><th>Status</th><th>Progress</th><th></th></tr></thead>
      <tbody>${list.map((b) => {
        const cl = b.checklist || [];
        const done = cl.filter((x) => x.done).length;
        const total = cl.length;
        const progress = total ? `${done}/${total}` : "—";
        return `<tr>
          <td>${Utils.escapeHtml(b.date)}</td>
          <td>${Utils.formatTime12h(b.startTime)}</td>
          <td>${Utils.escapeHtml(b.serviceName || "—")}</td>
          <td>${Utils.escapeHtml(b.customerName || "—")}<br/><small class="muted">${Utils.escapeHtml(b.customerPhone || "")}</small></td>
          <td><span class="badge badge-${b.status}">${b.status}</span></td>
          <td><small class="muted">${progress}</small></td>
          <td><button class="btn btn-sm btn-secondary" data-view-booking="${b.id}">View</button></td>
        </tr>`;
      }).join("")}</tbody></table></div>`;

    wrap.querySelectorAll("[data-view-booking]").forEach((btn) => {
      btn.addEventListener("click", () => viewBooking(btn.dataset.viewBooking));
    });
  }

  document.getElementById("fBookDate").addEventListener("change", loadBookings);
  document.getElementById("fBookStatus").addEventListener("change", loadBookings);
  document.getElementById("clearBookFilters").addEventListener("click", () => {
    document.getElementById("fBookDate").value = "";
    document.getElementById("fBookStatus").value = "";
    loadBookings();
  });

  async function viewBooking(id) {
    const b = (await DB.listBookings()).find((x) => x.id === id);
    if (!b) return;
    const checklist = b.checklist || [];

    const checklistHtml = checklist.length
      ? checklist.map((item, i) => `
          <div class="checklist-item">
            <label class="checklist-label ${item.done ? "done" : ""}">
              <input type="checkbox" class="cl-check" data-idx="${i}" ${item.done ? "checked" : ""} />
              ${Utils.escapeHtml(item.label)}
            </label>
          </div>`).join("")
      : '<span class="muted">No checklist items.</span>';

    const body = `
      <div class="form-row"><label>Service</label><p>${Utils.escapeHtml(b.serviceName)} — ${Utils.formatCurrency(b.servicePrice || 0)}</p></div>
      <div class="form-row"><label>Date &amp; Time</label><p>${Utils.formatDateLong(b.date)} at ${Utils.formatTime12h(b.startTime)} – ${Utils.formatTime12h(b.endTime)}</p></div>
      <div class="form-row"><label>Customer</label><p>${Utils.escapeHtml(b.customerName)}<br/>${Utils.escapeHtml(b.customerPhone || "")} · ${Utils.escapeHtml(b.customerEmail || "")}</p></div>
      <div class="form-row"><label>Address</label><p>${Utils.escapeHtml(b.address || "—")}</p></div>
      <div class="form-row"><label>Customer notes</label><p class="muted">${Utils.escapeHtml(b.notes || "—")}</p></div>
      <div class="form-row"><label>Status</label>
        <select id="modalBookingStatus">
          ${["pending", "confirmed", "completed", "cancelled"].map((s) =>
            `<option value="${s}" ${b.status === s ? "selected" : ""}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`
          ).join("")}
        </select>
      </div>

      <div class="form-row">
        <label>Job Checklist</label>
        <div id="modalChecklist" class="checklist-list">${checklistHtml}</div>
      </div>

      <div class="form-row">
        <label>Admin Notes</label>
        <textarea id="modalAdminNotes" placeholder="Internal notes about this job…">${Utils.escapeHtml(b.adminNotes || "")}</textarea>
      </div>

      <div class="form-row"><label>Booking ID</label><p class="muted"><code>${b.id}</code></p></div>`;

    openModal("Booking Details", body, [
      {
        label: "Save",
        fn: async () => {
          // Read updated checklist state from DOM
          const updatedChecklist = checklist.map((item, i) => {
            const el = document.querySelector(`.cl-check[data-idx="${i}"]`);
            return { ...item, done: el ? el.checked : item.done };
          });
          await DB.updateBooking(id, {
            status: document.getElementById("modalBookingStatus").value,
            checklist: updatedChecklist,
            adminNotes: document.getElementById("modalAdminNotes").value.trim()
          });
          closeModal();
          loadBookings();
        }
      },
      {
        label: "Delete",
        cls: "btn-danger btn-sm",
        fn: async () => {
          if (confirm("Delete this booking permanently?")) {
            await DB.removeBooking(id);
            closeModal();
            loadBookings();
          }
        }
      },
      { label: "Close", cls: "btn-secondary", fn: closeModal }
    ]);

    // Live strikethrough as items are checked
    document.getElementById("modalChecklist").addEventListener("change", (e) => {
      if (e.target.classList.contains("cl-check")) {
        e.target.closest(".checklist-item").querySelector(".checklist-label")
          .classList.toggle("done", e.target.checked);
      }
    });
  }

  // New booking from admin
  document.getElementById("newBookingBtn").addEventListener("click", async () => {
    const services = await DB.listActiveServices();
    const avail = await DB.getAvailability();
    const body = `
      <div class="form-row"><label>Service</label>
        <select id="nbService">${services.map((s) =>
          `<option value="${s.id}" data-dur="${s.durationMinutes}" data-price="${s.price}">${Utils.escapeHtml(s.name)} (${Utils.formatCurrency(s.price)})</option>`
        ).join("")}</select></div>
      <div class="form-row"><label>Date</label><input id="nbDate" type="date" required /></div>
      <div class="form-row"><label>Start time</label><input id="nbStart" type="time" required /></div>
      <div class="form-row"><label>Customer name</label><input id="nbName" required /></div>
      <div class="form-row"><label>Phone</label><input id="nbPhone" type="tel" /></div>
      <div class="form-row"><label>Email</label><input id="nbEmail" type="email" /></div>
      <div class="form-row"><label>Address</label><input id="nbAddress" /></div>
      <div class="form-row"><label>Notes</label><textarea id="nbNotes"></textarea></div>
      <div class="form-row"><label>Status</label>
        <select id="nbStatus"><option value="confirmed">Confirmed</option><option value="pending">Pending</option></select></div>`;
    openModal("New Booking", body, [
      {
        label: "Create Booking",
        fn: async () => {
          const sel = document.getElementById("nbService");
          const opt = sel.options[sel.selectedIndex];
          const dur = Number(opt.dataset.dur) || 60;
          const startStr = document.getElementById("nbStart").value;
          const endMin = Utils.timeToMinutes(startStr) + dur;
          const checklist = (avail.checklistTemplate || []).map((label) => ({ label, done: false }));

          const custData = {
            name: document.getElementById("nbName").value.trim(),
            phone: document.getElementById("nbPhone").value.trim(),
            email: document.getElementById("nbEmail").value.trim(),
            address: document.getElementById("nbAddress").value.trim()
          };
          let customer = await DB.findCustomerByEmail(custData.email);
          if (!customer) customer = await DB.addCustomer(custData);

          await DB.addBooking({
            serviceId: sel.value,
            serviceName: opt.textContent.split(" (")[0],
            servicePrice: Number(opt.dataset.price),
            customerId: customer.id,
            customerName: custData.name,
            customerPhone: custData.phone,
            customerEmail: custData.email,
            address: custData.address,
            notes: document.getElementById("nbNotes").value.trim(),
            date: document.getElementById("nbDate").value,
            startTime: startStr,
            endTime: Utils.minutesToTime(endMin),
            status: document.getElementById("nbStatus").value,
            checklist,
            adminNotes: ""
          });
          closeModal();
          loadBookings();
        }
      },
      { label: "Cancel", cls: "btn-secondary", fn: closeModal }
    ]);
  });

  // ======================================================================
  //  CALENDAR TAB
  // ======================================================================
  let calWeekStart = new Date();
  calWeekStart.setDate(calWeekStart.getDate() - calWeekStart.getDay() + 1); // Monday

  document.getElementById("prevWeekBtn").addEventListener("click", () => {
    calWeekStart.setDate(calWeekStart.getDate() - 7);
    loadCalendar();
  });
  document.getElementById("nextWeekBtn").addEventListener("click", () => {
    calWeekStart.setDate(calWeekStart.getDate() + 7);
    loadCalendar();
  });

  async function loadCalendar() {
    const avail = await DB.getAvailability();
    const grid = document.getElementById("weekGrid");
    const buffer = avail.bufferMinutes != null ? avail.bufferMinutes : 120;
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(calWeekStart);
      d.setDate(calWeekStart.getDate() + i);
      days.push(d);
    }

    document.getElementById("weekLabel").innerHTML =
      `<strong>${Utils.formatDateISO(days[0])} — ${Utils.formatDateISO(days[6])}</strong>`;

    const allBookings = await DB.listBookings();
    const dateSet = new Set(days.map(Utils.formatDateISO));
    const weekBookings = allBookings.filter((b) => dateSet.has(b.date) && b.status !== "cancelled");

    let earliest = 480, latest = 1020;
    for (const d of days) {
      const h = avail.workingHours[Utils.dayKey(d)];
      if (h && !h.closed) {
        earliest = Math.min(earliest, Utils.timeToMinutes(h.start));
        latest = Math.max(latest, Utils.timeToMinutes(h.end));
      }
    }

    const step = avail.slotDurationMinutes || 60;
    const times = [];
    for (let t = earliest; t < latest; t += step) times.push(t);

    let html = '<div class="wh-head"></div>';
    for (const d of days) {
      const label = d.toLocaleDateString(undefined, { weekday: "short" }) + " " + d.getDate();
      html += `<div class="wh-head">${label}</div>`;
    }

    for (const t of times) {
      html += `<div class="wh-time">${Utils.formatTime12h(Utils.minutesToTime(t))}</div>`;
      for (const d of days) {
        const iso = Utils.formatDateISO(d);
        const h = avail.workingHours[Utils.dayKey(d)];
        const closed = !h || h.closed;

        const booking = weekBookings.find((b) =>
          b.date === iso &&
          Utils.timeToMinutes(b.startTime) <= t &&
          Utils.timeToMinutes(b.endTime) > t
        );
        const inBuffer = !booking && weekBookings.some((b) =>
          b.date === iso &&
          t >= Utils.timeToMinutes(b.endTime) &&
          t < Utils.timeToMinutes(b.endTime) + buffer
        );

        if (closed) {
          html += '<div class="wh-cell closed"></div>';
        } else if (booking) {
          const cl = booking.checklist || [];
          const done = cl.filter((x) => x.done).length;
          const clText = cl.length ? ` (${done}/${cl.length})` : "";
          const cls = booking.status === "completed" ? "booked-completed" : "booked";
          html += `<div class="wh-cell ${cls}" data-view-booking="${booking.id}"
            title="${Utils.escapeHtml(booking.customerName + " — " + booking.serviceName)}">
            <small>${Utils.escapeHtml(booking.customerName || "")}</small>
            ${cl.length ? `<small class="cal-progress">${clText}</small>` : ""}
          </div>`;
        } else if (inBuffer) {
          html += '<div class="wh-cell buffer" title="Buffer time after previous job"></div>';
        } else {
          html += '<div class="wh-cell"></div>';
        }
      }
    }
    grid.innerHTML = html;
    grid.style.gridTemplateColumns = "80px repeat(7, 1fr)";
    grid.querySelectorAll("[data-view-booking]").forEach((el) => {
      el.addEventListener("click", () => viewBooking(el.dataset.viewBooking));
    });
  }

  // ======================================================================
  //  SERVICES TAB
  // ======================================================================
  async function loadServices() {
    const list = await DB.listServices();
    const wrap = document.getElementById("servicesTableWrap");
    if (list.length === 0) {
      wrap.innerHTML = '<div class="empty-state">No services. Create one above.</div>';
      return;
    }
    wrap.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Name</th><th>Price</th><th>Duration</th><th>Active</th><th></th></tr></thead>
      <tbody>${list.map((s) => `<tr>
        <td>${Utils.escapeHtml(s.name)}</td>
        <td>${Utils.formatCurrency(s.price)}</td>
        <td>${s.durationMinutes} min</td>
        <td>${s.active !== false ? '<span class="badge badge-confirmed">Yes</span>' : '<span class="badge badge-cancelled">No</span>'}</td>
        <td>
          <button class="btn btn-sm btn-secondary" data-edit-svc="${s.id}">Edit</button>
          <button class="btn btn-sm btn-danger" data-del-svc="${s.id}">Delete</button>
        </td>
      </tr>`).join("")}</tbody></table></div>`;

    wrap.querySelectorAll("[data-edit-svc]").forEach((btn) =>
      btn.addEventListener("click", () => editService(btn.dataset.editSvc))
    );
    wrap.querySelectorAll("[data-del-svc]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        if (confirm("Delete this service?")) {
          await DB.removeService(btn.dataset.delSvc);
          loadServices();
        }
      })
    );
  }

  function serviceFormHtml(s) {
    s = s || {};
    return `
      <div class="form-row"><label>Name</label><input id="sfName" value="${Utils.escapeHtml(s.name || "")}" required /></div>
      <div class="form-row"><label>Description</label><textarea id="sfDesc">${Utils.escapeHtml(s.description || "")}</textarea></div>
      <div class="form-row"><label>Price ($)</label><input id="sfPrice" type="number" step="0.01" value="${s.price || ""}" required /></div>
      <div class="form-row"><label>Duration (minutes)</label><input id="sfDur" type="number" step="15" value="${s.durationMinutes || 60}" required /></div>
      <div class="checkbox-row"><input id="sfActive" type="checkbox" ${s.active !== false ? "checked" : ""} /><label for="sfActive">Active</label></div>`;
  }

  function readServiceForm() {
    return {
      name: document.getElementById("sfName").value.trim(),
      description: document.getElementById("sfDesc").value.trim(),
      price: Number(document.getElementById("sfPrice").value),
      durationMinutes: Number(document.getElementById("sfDur").value),
      active: document.getElementById("sfActive").checked
    };
  }

  document.getElementById("newServiceBtn").addEventListener("click", () => {
    openModal("New Service", serviceFormHtml(), [
      {
        label: "Create",
        fn: async () => { await DB.addService(readServiceForm()); closeModal(); loadServices(); }
      },
      { label: "Cancel", cls: "btn-secondary", fn: closeModal }
    ]);
  });

  async function editService(id) {
    const s = await DB.getService(id);
    if (!s) return;
    openModal("Edit Service", serviceFormHtml(s), [
      {
        label: "Save",
        fn: async () => { await DB.updateService(id, readServiceForm()); closeModal(); loadServices(); }
      },
      { label: "Cancel", cls: "btn-secondary", fn: closeModal }
    ]);
  }

  // ======================================================================
  //  CUSTOMERS TAB
  // ======================================================================
  async function loadCustomers() {
    const list = (await DB.listCustomers()).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    const wrap = document.getElementById("customersTableWrap");
    if (list.length === 0) {
      wrap.innerHTML = '<div class="empty-state">No customers yet.</div>';
      return;
    }
    wrap.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Bookings</th><th>Notes</th><th></th></tr></thead>
      <tbody id="custBody"></tbody></table></div>`;

    const allBookings = await DB.listBookings();
    const body = document.getElementById("custBody");
    body.innerHTML = list.map((c) => {
      const count = allBookings.filter((b) => b.customerId === c.id).length;
      const noteCount = (c.notesLog || []).length;
      return `<tr>
        <td>${Utils.escapeHtml(c.name || "—")}</td>
        <td>${Utils.escapeHtml(c.phone || "—")}</td>
        <td>${Utils.escapeHtml(c.email || "—")}</td>
        <td>${count}</td>
        <td>${noteCount > 0 ? `<span class="badge badge-confirmed">${noteCount}</span>` : "—"}</td>
        <td><button class="btn btn-sm btn-secondary" data-view-cust="${c.id}">View</button></td>
      </tr>`;
    }).join("");

    body.querySelectorAll("[data-view-cust]").forEach((btn) =>
      btn.addEventListener("click", () => viewCustomer(btn.dataset.viewCust))
    );
  }

  function renderNotesLog(notesLog) {
    if (!notesLog || notesLog.length === 0) return '<p class="muted">No notes yet.</p>';
    return [...notesLog].reverse().map((n) =>
      `<div class="note-entry">
        <div class="note-meta">${new Date(n.createdAt).toLocaleString()}</div>
        <div class="note-text">${Utils.escapeHtml(n.text)}</div>
      </div>`
    ).join("");
  }

  async function viewCustomer(id) {
    const c = await DB.getCustomer(id);
    if (!c) return;
    const bookings = (await DB.listBookings())
      .filter((b) => b.customerId === id)
      .sort((a, b) => b.date.localeCompare(a.date));
    const history = bookings.length
      ? bookings.map((b) =>
          `<div style="margin-bottom:0.5rem">
            <span class="badge badge-${b.status}">${b.status}</span>
            ${Utils.escapeHtml(b.date)} at ${Utils.formatTime12h(b.startTime)} — ${Utils.escapeHtml(b.serviceName || "")}
            <button class="btn btn-sm btn-secondary" style="padding:0.15rem 0.5rem;margin-left:0.4rem" data-view-booking="${b.id}">View</button>
          </div>`
        ).join("")
      : '<span class="muted">No bookings yet.</span>';

    const body = `
      <div class="form-row"><label>Name</label><input id="cfName" value="${Utils.escapeHtml(c.name || "")}" /></div>
      <div class="form-row"><label>Phone</label><input id="cfPhone" value="${Utils.escapeHtml(c.phone || "")}" /></div>
      <div class="form-row"><label>Email</label><input id="cfEmail" value="${Utils.escapeHtml(c.email || "")}" /></div>
      <div class="form-row"><label>Address</label><input id="cfAddr" value="${Utils.escapeHtml(c.address || "")}" /></div>
      <div class="form-row"><label>Booking History</label>${history}</div>

      <div class="form-row">
        <label>Notes Log</label>
        <div id="notesLogList" class="notes-log">${renderNotesLog(c.notesLog)}</div>
        <div class="note-add-row">
          <textarea id="newNoteText" placeholder="Add a note…" rows="2" style="margin-top:0.5rem"></textarea>
          <button class="btn btn-sm" id="addNoteBtn" style="margin-top:0.4rem">Add Note</button>
        </div>
      </div>`;

    openModal("Customer: " + (c.name || ""), body, [
      {
        label: "Save Info",
        fn: async () => {
          await DB.updateCustomer(id, {
            name: document.getElementById("cfName").value.trim(),
            phone: document.getElementById("cfPhone").value.trim(),
            email: document.getElementById("cfEmail").value.trim(),
            address: document.getElementById("cfAddr").value.trim()
          });
          closeModal();
          loadCustomers();
        }
      },
      {
        label: "Delete Customer",
        cls: "btn-danger btn-sm",
        fn: async () => {
          if (confirm("Delete this customer? Their bookings will remain.")) {
            await DB.removeCustomer(id);
            closeModal();
            loadCustomers();
          }
        }
      },
      { label: "Close", cls: "btn-secondary", fn: closeModal }
    ]);

    // Wire up "Add Note" inside the modal
    document.getElementById("addNoteBtn").addEventListener("click", async () => {
      const text = document.getElementById("newNoteText").value.trim();
      if (!text) return;
      const fresh = await DB.getCustomer(id);
      const log = fresh.notesLog || [];
      log.push({ id: "n_" + Date.now(), text, createdAt: new Date().toISOString() });
      await DB.updateCustomer(id, { notesLog: log });
      document.getElementById("notesLogList").innerHTML = renderNotesLog(log);
      document.getElementById("newNoteText").value = "";
    });

    // Allow opening bookings from history
    document.querySelectorAll("[data-view-booking]").forEach((btn) => {
      btn.addEventListener("click", () => {
        closeModal();
        viewBooking(btn.dataset.viewBooking);
      });
    });
  }

  // ======================================================================
  //  AVAILABILITY TAB
  // ======================================================================
  let availData = null;

  async function loadAvailability() {
    availData = await DB.getAvailability();
    document.getElementById("slotDur").value = String(availData.slotDurationMinutes || 60);
    document.getElementById("bufferTime").value = String(availData.bufferMinutes != null ? availData.bufferMinutes : 120);

    const DAY_LABELS = { sun: "Sunday", mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday" };
    const grid = document.getElementById("hoursGrid");
    grid.innerHTML = Utils.DAY_KEYS.map((day) => {
      const h = (availData.workingHours && availData.workingHours[day]) || { start: "09:00", end: "17:00", closed: true };
      const isOpen = !h.closed;
      return `<div class="hours-row" id="hrow-${day}">
        <label class="toggle-switch">
          <input type="checkbox" id="hw-${day}-open" ${isOpen ? "checked" : ""} />
          <span class="toggle-slider"></span>
        </label>
        <span class="day-name">${DAY_LABELS[day]}</span>
        <div class="day-times" id="htimes-${day}" ${!isOpen ? 'style="display:none"' : ""}>
          <input type="time" id="hw-${day}-start" value="${h.start}" />
          <span>to</span>
          <input type="time" id="hw-${day}-end" value="${h.end}" />
        </div>
        <span class="day-closed-label" id="hclosed-${day}" ${isOpen ? 'style="display:none"' : ""}>Closed</span>
      </div>`;
    }).join("");

    Utils.DAY_KEYS.forEach((day) => {
      document.getElementById(`hw-${day}-open`).addEventListener("change", (e) => {
        const open = e.target.checked;
        document.getElementById(`htimes-${day}`).style.display = open ? "" : "none";
        document.getElementById(`hclosed-${day}`).style.display = open ? "none" : "";
      });
    });

    renderBlocked();
    renderChecklistTemplate();
  }

  function renderBlocked() {
    const list = (availData.blockedDates || []).sort();
    const el = document.getElementById("blockedList");
    if (list.length === 0) {
      el.innerHTML = '<span class="muted">No blocked dates.</span>';
      return;
    }
    el.innerHTML = list.map((d) =>
      `<span class="badge badge-cancelled" style="margin:0.2rem;cursor:pointer" data-unblock="${d}">${d} ×</span>`
    ).join("");
    el.querySelectorAll("[data-unblock]").forEach((b) =>
      b.addEventListener("click", () => {
        availData.blockedDates = availData.blockedDates.filter((x) => x !== b.dataset.unblock);
        renderBlocked();
      })
    );
  }

  function renderChecklistTemplate() {
    const items = availData.checklistTemplate || [];
    const el = document.getElementById("checklistTemplateList");
    if (items.length === 0) {
      el.innerHTML = '<span class="muted">No items yet.</span>';
    } else {
      el.innerHTML = items.map((item, i) =>
        `<div class="checklist-template-item">
          <span>${Utils.escapeHtml(item)}</span>
          <button class="btn btn-sm btn-danger" data-remove-cl="${i}" style="padding:0.15rem 0.5rem">×</button>
        </div>`
      ).join("");
      el.querySelectorAll("[data-remove-cl]").forEach((btn) =>
        btn.addEventListener("click", () => {
          availData.checklistTemplate.splice(Number(btn.dataset.removeCl), 1);
          renderChecklistTemplate();
        })
      );
    }
  }

  document.getElementById("addChecklistItemBtn").addEventListener("click", () => {
    const input = document.getElementById("newChecklistItem");
    const val = input.value.trim();
    if (!val) return;
    if (!availData.checklistTemplate) availData.checklistTemplate = [];
    availData.checklistTemplate.push(val);
    input.value = "";
    renderChecklistTemplate();
  });

  document.getElementById("addBlockDateBtn").addEventListener("click", () => {
    const val = document.getElementById("blockDateInput").value;
    if (!val) return;
    if (!availData.blockedDates) availData.blockedDates = [];
    if (!availData.blockedDates.includes(val)) availData.blockedDates.push(val);
    document.getElementById("blockDateInput").value = "";
    renderBlocked();
  });

  document.getElementById("saveAvailabilityBtn").addEventListener("click", async () => {
    const hours = {};
    Utils.DAY_KEYS.forEach((day) => {
      hours[day] = {
        start: document.getElementById(`hw-${day}-start`).value || "09:00",
        end: document.getElementById(`hw-${day}-end`).value || "17:00",
        closed: !document.getElementById(`hw-${day}-open`).checked
      };
    });
    availData.workingHours = hours;
    availData.slotDurationMinutes = Number(document.getElementById("slotDur").value) || 60;
    availData.bufferMinutes = Number(document.getElementById("bufferTime").value) || 0;
    await DB.setAvailability(availData);
    const msg = document.getElementById("availSaveStatus");
    msg.textContent = "Saved!";
    setTimeout(() => (msg.textContent = ""), 2000);
  });

  // ---------- Tab loaders ----------
  const tabLoaders = {
    bookings: loadBookings,
    calendar: loadCalendar,
    services: loadServices,
    customers: loadCustomers,
    availability: loadAvailability
  };

  loadBookings();
})();
