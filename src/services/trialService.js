import { initializeApp } from "firebase/app";
import { doc, getDoc, getFirestore, setDoc } from "firebase/firestore";

const TRIAL_KEY = "elite-subscription";
const USER_KEY = "elite-user-id";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const firebaseEnabled = Object.values(firebaseConfig).every(Boolean);
let firestore = null;

if (firebaseEnabled) {
  try {
    const app = initializeApp(firebaseConfig);
    firestore = getFirestore(app);
  } catch (error) {
    console.warn("Firebase init failed, falling back to local storage", error);
  }
}

const ensureUserId = () => {
  try {
    const existing = localStorage.getItem(USER_KEY);
    if (existing) return existing;
    const generated =
      typeof window !== "undefined" && window.crypto?.randomUUID
        ? window.crypto.randomUUID()
        : `user-${Date.now()}`;
    localStorage.setItem(USER_KEY, generated);
    return generated;
  } catch {
    return "local-device";
  }
};

const readLocal = () => {
  try {
    const raw = localStorage.getItem(TRIAL_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const writeLocal = (state) => {
  try {
    localStorage.setItem(TRIAL_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
};

export async function loadTrialState() {
  const fallback = readLocal();
  if (!firestore) return fallback;

  try {
    const uid = ensureUserId();
    const ref = doc(firestore, "trials", uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      const merged = {
        plan: data.plan ?? fallback.plan ?? "trial",
        trialStartedAt: data.trialStartedAt ?? fallback.trialStartedAt,
      };
      writeLocal(merged);
      return merged;
    }
    return fallback;
  } catch (error) {
    console.warn("Failed to load trial state from Firebase, using local", error);
    return fallback;
  }
}

export async function saveTrialState(state) {
  writeLocal(state);
  if (!firestore) return;
  try {
    const uid = ensureUserId();
    const ref = doc(firestore, "trials", uid);
    await setDoc(ref, state, { merge: true });
  } catch (error) {
    console.warn("Failed to persist trial state to Firebase", error);
  }
}
