import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBOav0R9-Xvx7fo2SiTtTAazM8N_bpn-lI',
  authDomain: 'knownana-c49d3.firebaseapp.com',
  projectId: 'knownana-c49d3',
  storageBucket: 'knownana-c49d3.firebasestorage.app',
  messagingSenderId: '635120697261',
  appId: '1:635120697261:web:86a3e6972b3b9a2fb96b24',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
