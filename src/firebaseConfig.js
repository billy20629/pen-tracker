// firebaseConfig.js (優化過版本)
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// 你的 Firebase 專案設定
const firebaseConfig = {
  apiKey: "AIzaSyB_MAtZPqcZzeTFT-ZgZdGduOekAShkHvM",
  authDomain: "tabletpentracker.firebaseapp.com",
  projectId: "tabletpentracker",
  storageBucket: "tabletpentracker.firebasestorage.app",
  messagingSenderId: "121253877589",
  appId: "1:121253877589:web:4f20b8e074bbcb481a01dc"
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);

// 初始化 Firestore 資料庫
const db = getFirestore(app);

// 將db輸出供其他元件使用
export { db };
