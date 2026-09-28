import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default function DeviceSetup() {
  const { user } = useAuth();
  const familyId = user?.uid || '';
  const [code, setCode] = useState('');
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [copied, setCopied] = useState(false);

  const createCode = useCallback(async () => {
    if (!familyId) return;
    const newCode = generateCode();
    const now = new Date();
    const expires = new Date(now.getTime() + 10 * 60 * 1000);

    await setDoc(doc(db, 'pairingCodes', newCode), {
      code: newCode,
      familyId,
      createdAt: Timestamp.fromDate(now),
      expiresAt: Timestamp.fromDate(expires),
    });

    setCode(newCode);
    setExpiresAt(expires);
    setCopied(false);
  }, [familyId]);

  useEffect(() => { createCode(); }, [createCode]);
  useEffect(() => {
    const interval = setInterval(createCode, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [createCode]);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const diff = expiresAt.getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('Expired');
        createCode();
        return;
      }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${m}:${s.toString().padStart(2, '0')}`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, createCode]);

  function copyCode() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div style={{ maxWidth: '540px', margin: '0 auto', padding: '16px' }}>
      <div style={{ marginBottom: '20px' }}>
        <Link to="/settings" style={{ fontSize: '0.9em', color: '#888' }}>&larr; Settings</Link>
        <h1 style={{ fontSize: '1.1em', marginTop: '8px' }}>Add Device</h1>
      </div>

      {/* Pairing Code */}
      <section style={{ marginBottom: '28px', textAlign: 'center' }}>
        <p style={{ fontSize: '0.9em', color: '#888', marginBottom: '12px' }}>
          Enter this code on your child's device.
        </p>

        <div style={{ fontSize: '2.5em', fontWeight: 700, letterSpacing: '0.25em', marginBottom: '8px' }}>
          {code || '------'}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '6px' }}>
          <a href="#" onClick={(e) => { e.preventDefault(); copyCode(); }} style={{ fontSize: '0.9em' }}>
            {copied ? 'Copied' : '[Copy]'}
          </a>
          <a href="#" onClick={(e) => { e.preventDefault(); createCode(); }} style={{ fontSize: '0.9em' }}>
            [New Code]
          </a>
        </div>

        <p style={{ fontSize: '0.8em', color: '#999' }}>
          Expires in {timeLeft}
        </p>
      </section>

      {/* Instructions */}
      <section style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '1em', borderBottom: '1px solid #ddd', paddingBottom: '4px', marginBottom: '8px' }}>
          iPhone / iPad
        </h3>
        <ol style={{ paddingLeft: '20px', fontSize: '0.9em', lineHeight: 1.8 }}>
          <li>Install KnowNana from the App Store</li>
          <li>Open the app, tap Join Family</li>
          <li>Enter code: <strong>{code}</strong></li>
          <li>Enter child's name, grant permissions</li>
        </ol>
      </section>

      <section style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '1em', borderBottom: '1px solid #ddd', paddingBottom: '4px', marginBottom: '8px' }}>
          Android
        </h3>
        <ol style={{ paddingLeft: '20px', fontSize: '0.9em', lineHeight: 1.8 }}>
          <li>Install KnowNana from Google Play</li>
          <li>Open the app, tap Join Family</li>
          <li>Enter code: <strong>{code}</strong></li>
          <li>Grant Accessibility Service and Usage Access</li>
        </ol>
      </section>

      <section style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '1em', borderBottom: '1px solid #ddd', paddingBottom: '4px', marginBottom: '8px' }}>
          PC (Browser)
        </h3>
        <ol style={{ paddingLeft: '20px', fontSize: '0.9em', lineHeight: 1.8 }}>
          <li>Open browser Settings &gt; Security &gt; DNS</li>
          <li>Enable secure DNS, select Custom</li>
          <li>Enter: <strong>https://dns.knownana.com/dns-query/DEVICE_ID</strong></li>
        </ol>
      </section>
    </div>
  );
}
