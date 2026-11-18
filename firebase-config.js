/*
 * StudySprint — Firebase configuration
 * ============================================================================
 * HOW TO CONNECT A REAL FIREBASE PROJECT (takes ~3 minutes, free):
 *
 *   1. Go to https://console.firebase.google.com and create a project
 *      (Google Analytics is NOT required).
 *   2. In the console: Build → AI Logic → "Get started" and choose the
 *      **Gemini Developer API** provider (free tier) when prompted.
 *      The guided flow enables the required APIs and enforces App Check.
 *   3. Register a Web app in the project (Project settings → "Add app" → Web)
 *      and copy the firebaseConfig object it shows you into the object below,
 *      replacing every "YOUR_..." value.
 *   4. App Check (required by AI Logic): for local development, this app sets
 *      a debug token automatically (see hybrid.js). Run the app once, copy the
 *      "AppCheck debug token" printed in the browser devtools console, then in
 *      the Firebase console go to App Check → Apps → your web app →
 *      "Manage debug tokens" and safelist it. For production, configure the
 *      reCAPTCHA Enterprise / reCAPTCHA v3 provider instead.
 *   5. Reload the app — the status pill will switch to "Firebase connected"
 *      and cloud fallback becomes live.
 *
 * Until every field below is filled in, StudySprint runs in DEMO MODE:
 * on-device inference (Gemini Nano via Chrome's Prompt API — the same engine
 * Firebase AI Logic uses under the hood) still works fully, and cloud-bound
 * tasks explain that a Firebase config is needed. No fake AI answers are
 * ever presented as real ones.
 * ============================================================================
 */

export const firebaseConfig = {
  apiKey: "AIzaSyC2PVun0dCQ2uSDK4p5GBfUrsiS6BHMhmo",
  authDomain: "studysprint-50c6f.firebaseapp.com",
  projectId: "studysprint-50c6f",
  storageBucket: "studysprint-50c6f.firebasestorage.app",
  messagingSenderId: "86704486845",
  appId: "1:86704486845:web:d6be9a949214811a357ad4",
};

/** Cloud model used when a task is escalated to Gemini in the cloud. */
export const CLOUD_MODEL = "gemini-2.5-flash";

/** True only when the placeholder config above has been fully replaced. */
export function isFirebaseConfigured() {
  return Object.values(firebaseConfig).every(
    (v) => typeof v === "string" && v.length > 0 && !v.startsWith("YOUR_")
  );
}
