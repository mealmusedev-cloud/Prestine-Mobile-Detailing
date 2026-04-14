// Firebase configuration
// Replace the values below with your own Firebase project config.
// Get them from: https://console.firebase.google.com/ -> Project Settings -> Your apps -> Web app
//
// Leave as-is to use the local-only mode (data stored in your browser's localStorage).
// This lets you try the site immediately without creating a Firebase project.

window.APP_CONFIG = {
  firebase: {
    apiKey: "AIzaSyDsJvyaGryZ7emc0J52-f1c20e3RScFcXI",
    authDomain: "prestinemobiledetailing.firebaseapp.com",
    projectId: "prestinemobiledetailing",
    storageBucket: "prestinemobiledetailing.firebasestorage.app",
    messagingSenderId: "137997410739",
    appId: "1:137997410739:web:c801d77af05e0434706bc6",
    measurementId: "G-4RTJLNG6LP"
  },

  // Google accounts allowed to access the admin panel.
  adminEmails: [
    "pristin3mobil3d3tailing2026@gmail.com",
    "haydenfuhrer2@gmail.com"
  ],

  // Dev password — only used in local fallback mode (when Firebase is not configured).
  devAdminPassword: "admin123",

  business: {
    name: "Prestine Mobile Detailing",
    phone: "(360) 580-4840",
    email: "",
    tagline: "Premium mobile detailing that comes to you"
  }
};

// True when the Firebase config above has not been filled in.
window.APP_CONFIG.useLocalFallback =
  !window.APP_CONFIG.firebase.apiKey ||
  window.APP_CONFIG.firebase.apiKey === "YOUR_API_KEY";
