import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  // Your Firebase configuration object will go here
  // You'll need to replace these with your actual Firebase project credentials
  apiKey: "AIzaSyAX5rJnGLLnTiJtdZQiIAtR0hH4jik_ciY",
  authDomain: "dsa-2-89e0f.firebaseapp.com",
  projectId: "dsa-2-89e0f",
  storageBucket: "dsa-2-89e0f.firebasestorage.app",
  messagingSenderId: "572708039939",
  appId: "1:572708039939:web:4a89a35eb476e0d9ae0d36",
  measurementId: "G-7N06Q466K9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
