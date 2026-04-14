// Admin authentication.
// Firebase mode  : Google Sign-In, restricted to APP_CONFIG.adminEmails list.
// Local fallback : password compared against APP_CONFIG.devAdminPassword,
//                  session stored in sessionStorage.

window.Auth = (function () {
  const SESSION_KEY = "pmd_admin_session";

  // ── Local fallback (no Firebase) ──────────────────────────────
  async function localLogin(password) {
    if (password === window.APP_CONFIG.devAdminPassword) {
      sessionStorage.setItem(SESSION_KEY, "1");
      return { ok: true };
    }
    return { ok: false, error: "Incorrect password" };
  }

  // ── Firebase / Google Sign-In ─────────────────────────────────
  async function googleLogin() {
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await window.firebaseAuth.signInWithPopup(provider);
      const email = result.user.email;
      if (!window.APP_CONFIG.adminEmails.includes(email)) {
        await window.firebaseAuth.signOut();
        return { ok: false, error: "That Google account is not authorised." };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  // ── Public API ────────────────────────────────────────────────
  async function login(unused, password) {
    if (window.APP_CONFIG.useLocalFallback) return localLogin(password);
    return googleLogin();
  }

  async function logout() {
    if (window.APP_CONFIG.useLocalFallback) {
      sessionStorage.removeItem(SESSION_KEY);
      return;
    }
    await window.firebaseAuth.signOut();
  }

  function isAuthed() {
    if (window.APP_CONFIG.useLocalFallback) {
      return sessionStorage.getItem(SESSION_KEY) === "1";
    }
    const user = window.firebaseAuth && window.firebaseAuth.currentUser;
    return !!(user && window.APP_CONFIG.adminEmails.includes(user.email));
  }

  // Call at the top of every admin page — redirects to login if not signed in.
  function requireAdmin() {
    if (window.APP_CONFIG.useLocalFallback) {
      if (!isAuthed()) window.location.href = "login.html";
      return;
    }
    window.firebaseAuth.onAuthStateChanged((user) => {
      if (!user || !window.APP_CONFIG.adminEmails.includes(user.email)) {
        window.location.href = "login.html";
      }
    });
  }

  return { login, logout, isAuthed, requireAdmin };
})();
