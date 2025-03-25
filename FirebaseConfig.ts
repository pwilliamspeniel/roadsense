// firebase.tsx
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from 'firebase/database'; 

// Your Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAtW5-I-aYnSBGvCXSw9GUqQ-pRzyGgauQ",
    authDomain: "roadsense-backend.firebaseapp.com",
    projectId: "roadsense-backend",
    storageBucket: "roadsense-backend.firebasestorage.app",
    messagingSenderId: "63022337003",
    appId: "1:63022337003:web:67c80d183efa28bcd067ae"
  };
  
  
// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const database = getDatabase(app);

// Export the initialized instances
export { app, auth, db, database };