/**
 * firebase.ts — Single Firebase App Initialization
 *
 * This is the ONLY place initializeApp() is called. Both firebaseAuth.ts and
 * firebaseDb.ts import { app } from here to guarantee:
 *  - initializeApp() runs exactly once
 *  - Both Auth and Firestore use the same app instance and config
 *  - No circular dependency between auth ↔ db modules
 */
import { initializeApp, getApp, getApps, FirebaseApp } from "firebase/app";
import { initializeFirestore, Firestore } from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json" assert { type: "json" };

// ── Validate required config fields before initializing ──────────────────────
const REQUIRED = ["apiKey", "authDomain", "projectId", "appId", "messagingSenderId"] as const;
for (const field of REQUIRED) {
  const value = (firebaseConfig as Record<string, string>)[field];
  if (!value || value.startsWith("REPLACE_WITH")) {
    console.error(`[Firebase] ❌ Missing required config field: "${field}". Check firebase-applet-config.json.`);
  }
}

// ── Initialize once ──────────────────────────────────────────────────────────
export const app: FirebaseApp = getApps().length > 0
  ? getApp()
  : initializeApp({
      apiKey:            firebaseConfig.apiKey,
      authDomain:        firebaseConfig.authDomain,
      projectId:         firebaseConfig.projectId,
      storageBucket:     firebaseConfig.storageBucket,
      messagingSenderId: firebaseConfig.messagingSenderId,
      appId:             firebaseConfig.appId,
      measurementId:     firebaseConfig.measurementId || undefined,
    });

// ── Shared service instances (lazy singletons) ───────────────────────────────
export const auth: Auth = getAuth(app);
export const db: Firestore = initializeFirestore(app, {
  experimentalForceLongPolling: true
});

console.log(
  "[Firebase] ✅ Initialized. Project:", firebaseConfig.projectId,
  "| Auth domain:", firebaseConfig.authDomain,
  "| Apps:", getApps().length
);
