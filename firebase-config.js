import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCvCbf85meEAYghfaQUROOTZmPKTR0xIKE",
  authDomain: "ks-dsc-exam.firebaseapp.com",
  projectId: "ks-dsc-exam",
  storageBucket: "ks-dsc-exam.firebasestorage.app",
  messagingSenderId: "309331856835",
  appId: "1:309331856835:web:c7cd2abb88d1f4934f8176"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
