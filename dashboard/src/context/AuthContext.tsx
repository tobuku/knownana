import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    // Fallback: if onAuthStateChanged never fires (blocked cookies in incognito),
    // stop loading after 4 seconds so the login page still renders
    const timeout = setTimeout(() => setLoading(false), 4000);
    return () => { unsubscribe(); clearTimeout(timeout); };
  }, []);

  async function signIn(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function signUp(email: string, password: string) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    // Create a family document for the new user
    // Create the family document (uid = familyId for simplicity)
    await setDoc(doc(db, 'families', cred.user.uid), {
      parentUid: cred.user.uid,
      parentEmail: cred.user.email,
      createdAt: new Date(),
      alertsEnabled: true,
      digestEnabled: true,
      digestHourUTC: 7, // 9 PM HST
      childName: '',
      deviceIds: [],
    });
    // Create the user lookup document
    await setDoc(doc(db, 'users', cred.user.uid), {
      familyId: cred.user.uid,
      email: cred.user.email,
    });
  }

  async function signOut() {
    await firebaseSignOut(auth);
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
