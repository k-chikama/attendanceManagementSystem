// lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDkYHCSNTxH2tmn4umdg9J9lIot1pwMA40",
  authDomain: "shift-management-system-5624a.firebaseapp.com",
  projectId: "shift-management-system-5624a",
  storageBucket: "shift-management-system-5624a.firebasestorage.app",
  messagingSenderId: "478086334629",
  appId: "1:478086334629:web:061df688e9f6db4c8f654c",
  measurementId: "G-PTJLDB4VTZ",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
