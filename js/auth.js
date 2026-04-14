// Admin authentication.
// Firebase mode  : Google Sign-In, restricted to APP_CONFIG.adminEmails list.
// Local fallback : password compared against APP_CONFIG.devAdminPassword,
//                  session stored in sessionStorage.

window.Auth = (function () {
  const SESSION_KEY = "pmd_admin_session";

  // Support both adminEmails (array) and legacy adminEmail (string)
  function isAdminEmail(email) {
    try {
      const cfg = window.APP_CONFIG;
      if (Array.isArray(cfg.adminEmails)) return cfg.adminEmails.includes(email);
      if (cfg.adminEmail) return email === cfg.adminEmail;
    } catch (e) {}
    return false;
  }

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
      if (!isAdminEmail(email)) {
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
    try {
      if (window.APP_CONFIG.useLocalFallback) {
        return sessionStorage.getItem(SESSION_KEY) === "1";
      }
      const user = window.firebaseAuth && window.firebaseAuth.currentUser;
      return !!(user && isAdminEmail(user.email));
    } catch (e) {
      return false;
    }
  }

  // Call at the top of every admin page.
  // Hides the page until auth is confirmed — any error forces redirect to login.
  function requireAdmin() {
    document.body.style.visibility = "hidden";
    try {
      if (window.APP_CONFIG.useLocalFallback) {
        if (!isAuthed()) {
          window.location.replace("login.html");
        } else {
          document.body.style.visibility = "";
        }
        return;
      }
      window.firebaseAuth.onAuthStateChanged((user) => {
        try {
          if (!user || !isAdminEmail(user.email)) {
            window.location.replace("login.html");
          } else {
            document.body.style.visibility = "";
          }
        } catch (e) {
          window.location.replace("login.html");
        }
      });
    } catch (e) {
      window.location.replace("login.html");
    }
  }

  return { login, logout, isAuthed, requireAdmin };
})();
