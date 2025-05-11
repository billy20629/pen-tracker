// src/firebaseConfig.js

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// 您的 Firebase 專案設定
const firebaseConfig = {
  apiKey: "AIzaSyB_MAtZPqcZzeTFT-ZgZdGduOekAShkHvM",
  authDomain: "tabletpentracker.firebaseapp.com",
  projectId: "tabletpentracker",
  storageBucket: "tabletpentracker.firebasestorage.app",
  messagingSenderId: "121253877589",
  appId: "1:121253877589:web:4f20b8e074bbcb481a01dc"
};

// 初始化 Firebase App
const app = initializeApp(firebaseConfig);

// 初始化並匯出 Firestore 與 Auth
export const db = getFirestore(app);
export const auth = getAuth(app);
