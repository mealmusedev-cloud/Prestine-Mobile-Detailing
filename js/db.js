// Data layer — abstracts Firestore vs localStorage so the rest of the code never cares.
// Exposes window.DB with async methods that return plain objects.

(function () {
  const LS_PREFIX = "pmd_";
  const COLLECTIONS = ["services", "bookings", "customers", "availability"];

  // ---------- localStorage backend ----------
  const local = {
    _read(col) {
      try {
        return JSON.parse(localStorage.getItem(LS_PREFIX + col) || "[]");
      } catch {
        return [];
      }
    },
    _write(col, arr) {
      localStorage.setItem(LS_PREFIX + col, JSON.stringify(arr));
    },
    async list(col) {
      return this._read(col);
    },
    async get(col, id) {
      return this._read(col).find((x) => x.id === id) || null;
    },
    async add(col, data) {
      const arr = this._read(col);
      const id = data.id || "id_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
      const item = { ...data, id, createdAt: data.createdAt || new Date().toISOString() };
      arr.push(item);
      this._write(col, arr);
      return item;
    },
    async update(col, id, patch) {
      const arr = this._read(col);
      const i = arr.findIndex((x) => x.id === id);
      if (i === -1) throw new Error("Not found: " + col + "/" + id);
      arr[i] = { ...arr[i], ...patch };
      this._write(col, arr);
      return arr[i];
    },
    async remove(col, id) {
      const arr = this._read(col).filter((x) => x.id !== id);
      this._write(col, arr);
    },
    async getSingleton(key) {
      try {
        return JSON.parse(localStorage.getItem(LS_PREFIX + "singleton_" + key) || "null");
      } catch {
        return null;
      }
    },
    async setSingleton(key, value) {
      localStorage.setItem(LS_PREFIX + "singleton_" + key, JSON.stringify(value));
      return value;
    }
  };

  // ---------- Firestore backend ----------
  const fire = {
    async list(col) {
      const snap = await window.firebaseDb.collection(col).get();
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },
    async get(col, id) {
      const doc = await window.firebaseDb.collection(col).doc(id).get();
      return doc.exists ? { id: doc.id, ...doc.data() } : null;
    },
    async add(col, data) {
      const payload = { ...data, createdAt: data.createdAt || new Date().toISOString() };
      const ref = await window.firebaseDb.collection(col).add(payload);
      return { id: ref.id, ...payload };
    },
    async update(col, id, patch) {
      await window.firebaseDb.collection(col).doc(id).update(patch);
      return await this.get(col, id);
    },
    async remove(col, id) {
      await window.firebaseDb.collection(col).doc(id).delete();
    },
    async getSingleton(key) {
      const doc = await window.firebaseDb.collection("singletons").doc(key).get();
      return doc.exists ? doc.data() : null;
    },
    async setSingleton(key, value) {
      await window.firebaseDb.collection("singletons").doc(key).set(value);
      return value;
    }
  };

  const backend = () => (window.APP_CONFIG.useLocalFallback ? local : fire);

  // ---------- Default seed data ----------
  const DEFAULT_SERVICES = [
    {
      id: "svc_truck_ext",
      name: "Exterior Wash — Trucks & SUVs",
      description: "Full exterior hand wash, wheels, tires, and window clean for trucks and SUVs.",
      price: 30,
      durationMinutes: 60,
      vehicleType: "truck-suv",
      serviceType: "exterior",
      active: true
    },
    {
      id: "svc_truck_int",
      name: "Interior Detail — Trucks & SUVs",
      description: "Deep interior detail including vacuum, shampoo, wipe-down, and dressings for trucks and SUVs.",
      price: 170,
      durationMinutes: 150,
      vehicleType: "truck-suv",
      serviceType: "interior",
      active: true
    },
    {
      id: "svc_sedan_ext",
      name: "Exterior Wash — Sedans",
      description: "Full exterior hand wash, wheels, tires, and window clean for cars and sedans.",
      price: 25,
      durationMinutes: 45,
      vehicleType: "sedan",
      serviceType: "exterior",
      active: true
    },
    {
      id: "svc_sedan_int",
      name: "Interior Detail — Sedans",
      description: "Deep interior detail including vacuum, shampoo, wipe-down, and dressings for cars and sedans.",
      price: 80,
      durationMinutes: 120,
      vehicleType: "sedan",
      serviceType: "interior",
      active: true
    }
  ];

  const DEFAULT_AVAILABILITY = {
    slotDurationMinutes: 60,
    bufferMinutes: 120,
    workingHours: {
      mon: { start: "09:00", end: "17:00", closed: false },
      tue: { start: "09:00", end: "17:00", closed: false },
      wed: { start: "09:00", end: "17:00", closed: false },
      thu: { start: "09:00", end: "17:00", closed: false },
      fri: { start: "09:00", end: "17:00", closed: false },
      sat: { start: "10:00", end: "16:00", closed: false },
      sun: { start: "10:00", end: "16:00", closed: true }
    },
    blockedDates: [],
    checklistTemplate: [
      "Exterior hand wash",
      "Wheels & tires",
      "Windows & glass",
      "Interior vacuum",
      "Dashboard & console wipe",
      "Door jambs",
      "Wax / sealant",
      "Final walk-around inspection"
    ]
  };

  // ---------- Public API ----------
  const DB = {
    async init() {
      // Seed defaults the first time the app runs.
      // In Firebase mode, writes require admin auth — seed is skipped if not authorised.
      // The admin can add services manually via the admin panel.
      try {
        const services = await backend().list("services");
        if (services.length === 0 && window.APP_CONFIG.useLocalFallback) {
          for (const s of DEFAULT_SERVICES) await backend().add("services", s);
        }
      } catch (e) {
        console.warn("[DB.init] Could not seed services:", e.message);
      }
      try {
        const avail = await backend().getSingleton("availability");
        if (!avail) await backend().setSingleton("availability", DEFAULT_AVAILABILITY);
      } catch (e) {
        console.warn("[DB.init] Could not seed availability:", e.message);
      }
    },

    // services
    listServices: () => backend().list("services"),
    listActiveServices: async () =>
      (await backend().list("services")).filter((s) => s.active !== false),
    getService: (id) => backend().get("services", id),
    addService: (data) => backend().add("services", data),
    updateService: (id, patch) => backend().update("services", id, patch),
    removeService: (id) => backend().remove("services", id),

    // bookings
    listBookings: () => backend().list("bookings"),
    listBookingsByDate: async (date) =>
      (await backend().list("bookings")).filter((b) => b.date === date),
    addBooking: (data) => backend().add("bookings", data),
    updateBooking: (id, patch) => backend().update("bookings", id, patch),
    removeBooking: (id) => backend().remove("bookings", id),

    // customers
    listCustomers: () => backend().list("customers"),
    getCustomer: (id) => backend().get("customers", id),
    findCustomerByEmail: async (email) => {
      if (!email) return null;
      const all = await backend().list("customers");
      return all.find((c) => (c.email || "").toLowerCase() === email.toLowerCase()) || null;
    },
    addCustomer: (data) => backend().add("customers", data),
    updateCustomer: (id, patch) => backend().update("customers", id, patch),
    removeCustomer: (id) => backend().remove("customers", id),

    // availability — always merge with defaults so new fields appear after upgrades
    getAvailability: async () => {
      const stored = await backend().getSingleton("availability");
      if (!stored) return { ...DEFAULT_AVAILABILITY };
      return {
        bufferMinutes: DEFAULT_AVAILABILITY.bufferMinutes,
        checklistTemplate: DEFAULT_AVAILABILITY.checklistTemplate,
        ...stored
      };
    },
    setAvailability: (data) => backend().setSingleton("availability", data),

    // utility
    _resetAll() {
      COLLECTIONS.forEach((c) => localStorage.removeItem(LS_PREFIX + c));
      localStorage.removeItem(LS_PREFIX + "singleton_availability");
    }
  };

  window.DB = DB;
})();
