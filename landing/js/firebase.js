/**
 * Filfilu Firebase Auth (client).
 * Email/password reset only — never send the password itself.
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBMW8DVVu9B_ulILGrirYvDrQAGI7KDKj4",
  authDomain: "filfilu-a108a.firebaseapp.com",
  projectId: "filfilu-a108a",
  storageBucket: "filfilu-a108a.firebasestorage.app",
  messagingSenderId: "74546652357",
  appId: "1:74546652357:web:b98d1fe3f0cd2344be3cac",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

if (typeof window !== "undefined") {
  window.FilfiluFirebase = { app, auth };
}
