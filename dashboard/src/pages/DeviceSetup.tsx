import React, { useEffect, useState, useCallback } from 'react';
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
    const expires = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes

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

  // Generate initial code
  useEffect(() => {
    createCode();
  }, [createCode]);

  // Auto-refresh every 10 minutes
  useEffect(() => {
    const interval = setInterval(createCode, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [createCode]);

  // Countdown timer
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

  const sectionStyle: React.CSSProperties = {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      {/* Header */}
      <header
        style={{
          backgroundColor: '#1e293b',
          color: '#fff',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <Link to="/settings" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.9rem' }}>
          &larr; Settings
        </Link>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Add Device</h1>
      </header>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px 16px' }}>
        {/* Pairing Code */}
        <div style={{ ...sectionStyle, textAlign: 'center' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
            Pairing Code
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '20px' }}>
            Enter this code on your child's device to link it to your account.
          </p>

          <div
            style={{
              fontSize: '3rem',
              fontWeight: 700,
              letterSpacing: '0.3em',
              color: '#1e293b',
              fontFamily: 'monospace',
              padding: '16px',
              backgroundColor: '#f1f5f9',
              borderRadius: '12px',
              display: 'inline-block',
              minWidth: '280px',
              marginBottom: '12px',
            }}
          >
            {code || '------'}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', alignItems: 'center', marginBottom: '8px' }}>
            <button
              onClick={copyCode}
              style={{
                padding: '8px 20px',
                backgroundColor: '#1e293b',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              {copied ? 'Copied!' : 'Copy Code'}
            </button>
            <button
              onClick={createCode}
              style={{
                padding: '8px 20px',
                backgroundColor: '#fff',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              New Code
            </button>
          </div>

          <p style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
            Expires in {timeLeft} - auto-refreshes every 10 minutes
          </p>
        </div>

        {/* iOS Instructions */}
        <div style={sectionStyle}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>
            iPhone / iPad (iOS)
          </h3>
          <ol style={{ paddingLeft: '20px', fontSize: '0.9rem', color: '#374151', lineHeight: 1.8 }}>
            <li>Install <strong>KnowNana</strong> from the App Store on your child's device</li>
            <li>Open the app and tap <strong>Join Family</strong></li>
            <li>
              Enter pairing code: <strong style={{ fontFamily: 'monospace', letterSpacing: '0.1em' }}>{code}</strong>
            </li>
            <li>Enter your child's name when prompted</li>
            <li>Grant the required permissions (screen time, notifications)</li>
          </ol>
        </div>

        {/* Android Instructions */}
        <div style={sectionStyle}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>
            Android
          </h3>
          <ol style={{ paddingLeft: '20px', fontSize: '0.9rem', color: '#374151', lineHeight: 1.8 }}>
            <li>Install <strong>KnowNana</strong> from Google Play on your child's device</li>
            <li>Open the app and tap <strong>Join Family</strong></li>
            <li>
              Enter pairing code: <strong style={{ fontFamily: 'monospace', letterSpacing: '0.1em' }}>{code}</strong>
            </li>
            <li>Enter your child's name when prompted</li>
            <li>Grant Accessibility Service and Usage Access permissions</li>
          </ol>
        </div>

        {/* PC Instructions */}
        <div style={sectionStyle}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>
            PC (Chrome Extension)
          </h3>
          <ol style={{ paddingLeft: '20px', fontSize: '0.9rem', color: '#374151', lineHeight: 1.8 }}>
            <li>On your child's computer, open Chrome</li>
            <li>Install the <strong>KnowNana Monitor</strong> extension from the Chrome Web Store</li>
            <li>Click the extension icon and select <strong>Pair Device</strong></li>
            <li>
              Enter pairing code: <strong style={{ fontFamily: 'monospace', letterSpacing: '0.1em' }}>{code}</strong>
            </li>
            <li>Enter your child's name when prompted</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
