// Initializes Firebase if configured. Safe to include on every page.
// If APP_CONFIG.useLocalFallback is true, this is a no-op.

(function initFirebase() {
  if (window.APP_CONFIG.useLocalFallback) {
    console.info("[firebase-init] Local fallback mode — data stored in localStorage.");
    return;
  }
  if (typeof firebase === "undefined") {
    console.warn("[firebase-init] Firebase SDK not loaded; falling back to localStorage.");
    window.APP_CONFIG.useLocalFallback = true;
    return;
  }
  try {
    firebase.initializeApp(window.APP_CONFIG.firebase);
    window.firebaseDb = firebase.firestore();
    window.firebaseAuth = firebase.auth();
    console.info("[firebase-init] Firebase initialized.");
  } catch (err) {
    console.error("[firebase-init] Failed to initialize Firebase:", err);
    window.APP_CONFIG.useLocalFallback = true;
  }
})();
