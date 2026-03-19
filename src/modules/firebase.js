import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';
import { getAnalytics } from "firebase/analytics";

// ┌──────────────────────────────────────────────────────────────────┐
// │  REPLACE these values with your Firebase project config.        │
// │  Firebase Console → Project Settings → Your Apps → Config       │
// └──────────────────────────────────────────────────────────────────┘
const firebaseConfig = {
  apiKey: "AIzaSyDf5IJo2ILwUHRWfcjFuUXzW54lRJvkHDo",
  authDomain: "lovesite-1540e.firebaseapp.com",
  projectId: "lovesite-1540e",
  storageBucket: "lovesite-1540e.firebasestorage.app",
  messagingSenderId: "470326334985",
  appId: "1:470326334985:web:bcb3b06f01adaa139e4ad8",
  measurementId: "G-NLQWFFMMQ1"
};


const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
const analytics = getAnalytics(app);
