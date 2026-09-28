import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  onSnapshot,
  Timestamp,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import type { ChildDevice, FamilySettings, CategoryOverride } from '../types';

const TIMEZONES = [
  'Pacific/Honolulu',
  'America/Anchorage',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Puerto_Rico',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Australia/Sydney',
];

export default function Settings() {
  const { user } = useAuth();
  const familyId = user?.uid || '';

  const [settings, setSettings] = useState<FamilySettings>({
    digestTime: '20:00',
    timezone: 'Pacific/Honolulu',
    alertsEnabled: true,
  });
  const [devices, setDevices] = useState<ChildDevice[]>([]);
  const [overrides, setOverrides] = useState<CategoryOverride[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [newCategory, setNewCategory] = useState('RED');
  const [saving, setSaving] = useState(false);

  // Load settings
  useEffect(() => {
    if (!familyId) return;
    getDoc(doc(db, 'families', familyId)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.settings) {
          setSettings(data.settings);
        }
      }
    });
  }, [familyId]);

  // Load devices
  useEffect(() => {
    if (!familyId) return;
    const unsub = onSnapshot(collection(db, 'families', familyId, 'devices'), (snap) => {
      const devs: ChildDevice[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name,
          deviceId: data.deviceId,
          platform: data.platform,
          lastHeartbeat:
            data.lastHeartbeat instanceof Timestamp
              ? data.lastHeartbeat.toDate()
              : new Date(data.lastHeartbeat),
        };
      });
      setDevices(devs);
    });
    return unsub;
  }, [familyId]);

  // Load overrides
  useEffect(() => {
    if (!familyId) return;
    const unsub = onSnapshot(collection(db, 'families', familyId, 'overrides'), (snap) => {
      const items: CategoryOverride[] = snap.docs.map((d) => ({
        domain: d.id,
        category: d.data().category,
      }));
      setOverrides(items);
    });
    return unsub;
  }, [familyId]);

  async function saveSettings() {
    if (!familyId) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'families', familyId), { settings });
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  }

  async function addOverride() {
    if (!familyId || !newDomain.trim()) return;
    const domain = newDomain.trim().toLowerCase();
    await setDoc(doc(db, 'families', familyId, 'overrides', domain), {
      category: newCategory,
    });
    setNewDomain('');
  }

  async function removeOverride(domain: string) {
    if (!familyId) return;
    await deleteDoc(doc(db, 'families', familyId, 'overrides', domain));
  }

  function isHeartbeatRecent(date: Date): boolean {
    return Date.now() - date.getTime() < 10 * 60 * 1000; // 10 minutes
  }

  const sectionStyle: React.CSSProperties = {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.85rem',
    fontWeight: 500,
    color: '#374151',
    display: 'block',
    marginBottom: '4px',
  };

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '0.9rem',
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
        <Link to="/dashboard" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.9rem' }}>
          &larr; Dashboard
        </Link>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Settings</h1>
      </header>

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '24px 16px' }}>
        {/* Child Devices */}
        <div style={sectionStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Child Devices</h2>
            <Link
              to="/device-setup"
              style={{
                padding: '8px 16px',
                backgroundColor: '#1e293b',
                color: '#fff',
                borderRadius: '8px',
                textDecoration: 'none',
                fontSize: '0.85rem',
                fontWeight: 500,
              }}
            >
              + Add Device
            </Link>
          </div>

          {devices.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>
              No devices paired yet. Add a device to start monitoring.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {devices.map((d) => {
                const recent = isHeartbeatRecent(d.lastHeartbeat);
                return (
                  <div
                    key={d.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      backgroundColor: '#f9fafb',
                      borderRadius: '8px',
                    }}
                  >
                    <span
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: recent ? '#16a34a' : '#dc2626',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{d.name}</div>
                      <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                        {d.platform.toUpperCase()} - Last seen:{' '}
                        {d.lastHeartbeat.toLocaleString()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* General Settings */}
        <div style={sectionStyle}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px' }}>General</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Daily Digest Time</label>
              <input
                type="time"
                value={settings.digestTime}
                onChange={(e) => setSettings({ ...settings, digestTime: e.target.value })}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Timezone</label>
              <select
                value={settings.timezone}
                onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                style={{ ...inputStyle, minWidth: '220px' }}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id="alertsEnabled"
                checked={settings.alertsEnabled}
                onChange={(e) => setSettings({ ...settings, alertsEnabled: e.target.checked })}
              />
              <label htmlFor="alertsEnabled" style={{ fontSize: '0.9rem', color: '#374151' }}>
                Enable RED domain alerts
              </label>
            </div>

            <button
              onClick={saveSettings}
              disabled={saving}
              style={{
                alignSelf: 'flex-start',
                padding: '10px 24px',
                backgroundColor: saving ? '#94a3b8' : '#1e293b',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>

        {/* Domain Overrides */}
        <div style={sectionStyle}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px' }}>
            Domain Overrides
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '16px' }}>
            Manually assign a category to specific domains. Overrides take priority over automatic classification.
          </p>

          {/* Add new override */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="example.com"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              style={{ ...inputStyle, flex: 1, minWidth: '180px' }}
            />
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              style={inputStyle}
            >
              <option value="RED">RED</option>
              <option value="YELLOW">YELLOW</option>
              <option value="GREEN">GREEN</option>
              <option value="GRAY">GRAY</option>
            </select>
            <button
              onClick={addOverride}
              style={{
                padding: '8px 16px',
                backgroundColor: '#1e293b',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              Add
            </button>
          </div>

          {/* Override table */}
          {overrides.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>No overrides set.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '8px 0', fontSize: '0.8rem', color: '#6b7280' }}>
                    Domain
                  </th>
                  <th style={{ textAlign: 'left', padding: '8px 0', fontSize: '0.8rem', color: '#6b7280' }}>
                    Category
                  </th>
                  <th style={{ width: '60px' }} />
                </tr>
              </thead>
              <tbody>
                {overrides.map((o) => (
                  <tr key={o.domain} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '8px 0', fontSize: '0.9rem' }}>{o.domain}</td>
                    <td style={{ padding: '8px 0' }}>
                      <span
                        style={{
                          padding: '2px 10px',
                          borderRadius: '9999px',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          color: '#fff',
                          backgroundColor:
                            o.category === 'RED'
                              ? '#dc2626'
                              : o.category === 'YELLOW'
                              ? '#f59e0b'
                              : o.category === 'GREEN'
                              ? '#16a34a'
                              : '#6b7280',
                        }}
                      >
                        {o.category}
                      </span>
                    </td>
                    <td style={{ padding: '8px 0', textAlign: 'right' }}>
                      <button
                        onClick={() => removeOverride(o.domain)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#dc2626',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
