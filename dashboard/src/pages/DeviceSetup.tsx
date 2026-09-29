import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default function DeviceSetup() {
  const { user } = useAuth();
  const { bg, fg, fgMuted, borderLight } = useTheme();
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
    <div style={{ maxWidth: '540px', margin: '0 auto', padding: '16px', background: bg, color: fg }}>
      <div style={{ marginBottom: '20px' }}>
        <Link to="/settings" style={{ fontSize: '0.9em', color: fgMuted }}>&larr; Settings</Link>
        <h1 style={{ fontSize: '1.1em', marginTop: '8px' }}>Add Device</h1>
      </div>

      {/* One-click install link */}
      <section style={{ marginBottom: '28px', padding: '12px', border: `1px solid ${borderLight}` }}>
        <p style={{ fontSize: '0.9em', marginBottom: '8px' }}>
          On the child's device right now?
        </p>
        <Link
          to="/install"
          style={{ fontSize: '1.05em', fontWeight: 700, color: fg, textDecoration: 'underline' }}
        >
          INSTALL ON THIS DEVICE
        </Link>
        <p style={{ fontSize: '0.8em', color: fgMuted, marginTop: '6px' }}>
          Auto-detects platform, generates device ID, configures DNS in one click.
        </p>
      </section>

      {/* Pairing Code for mobile apps */}
      <section style={{ marginBottom: '28px' }}>
        <h3 style={{ fontSize: '1em', borderBottom: `1px solid ${borderLight}`, paddingBottom: '4px', marginBottom: '10px' }}>
          Mobile App (Pairing Code)
        </h3>
        <p style={{ fontSize: '0.85em', color: fgMuted, marginBottom: '12px' }}>
          For iOS/Android apps - enter this code on the child's device.
        </p>

        <div style={{ textAlign: 'center', marginBottom: '10px' }}>
          <div style={{ fontSize: '2.5em', fontWeight: 700, letterSpacing: '0.25em', marginBottom: '8px' }}>
            {code || '------'}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '6px' }}>
            <a href="#" onClick={(e) => { e.preventDefault(); copyCode(); }} style={{ fontSize: '0.9em', color: fg }}>
              {copied ? 'Copied' : '[Copy]'}
            </a>
            <a href="#" onClick={(e) => { e.preventDefault(); createCode(); }} style={{ fontSize: '0.9em', color: fg }}>
              [New Code]
            </a>
          </div>

          <p style={{ fontSize: '0.8em', color: fgMuted }}>
            Expires in {timeLeft}
          </p>
        </div>

        <ol style={{ paddingLeft: '20px', fontSize: '0.85em', lineHeight: 1.8, color: fgMuted }}>
          <li>Install KnowNana on child's device (App Store / Google Play)</li>
          <li>Open the app, tap Join Family</li>
          <li>Enter code: <strong style={{ color: fg }}>{code}</strong></li>
          <li>Enter child's name, grant permissions</li>
        </ol>
      </section>
    </div>
  );
}
