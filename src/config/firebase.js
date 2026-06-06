
// firebase config page for username and email storage//
import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyAxgZe1natenCoz9I37anJ65Nn15MxLKd4",
  authDomain: "mechtek-141fb.firebaseapp.com",
  projectId: "mechtek-141fb",
  storageBucket: "mechtek-141fb.firebasestorage.app",
  messagingSenderId: "306281237744",
  appId: "1:306281237744:android:6c8d05019303c69f418635",
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});

export const db = getFirestore(app);
export const storage = getStorage(app);
