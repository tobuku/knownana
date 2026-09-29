import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
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

const CATEGORY_COLORS: Record<string, string> = {
  RED: '#cc0000',
  YELLOW: '#b8860b',
  GREEN: '#228b22',
  GRAY: '#888',
};

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

  useEffect(() => {
    if (!familyId) return;
    getDoc(doc(db, 'families', familyId)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.settings) setSettings(data.settings);
      }
    });
  }, [familyId]);

  useEffect(() => {
    if (!familyId) return;
    const devQuery = query(collection(db, 'devices'), where('familyId', '==', familyId));
    const unsub = onSnapshot(devQuery, (snap) => {
      const devs: ChildDevice[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.deviceName || data.name,
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
    return Date.now() - date.getTime() < 10 * 60 * 1000;
  }

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '16px' }}>
      <div style={{ marginBottom: '20px' }}>
        <Link to="/dashboard" style={{ fontSize: '0.9em', color: '#888' }}>&larr; Dashboard</Link>
        <h1 style={{ fontSize: '1.1em', marginTop: '8px' }}>Settings</h1>
      </div>

      {/* Devices */}
      <section style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid #ddd', paddingBottom: '4px', marginBottom: '8px' }}>
          <h2 style={{ fontSize: '1em' }}>Devices</h2>
          <Link to="/device-setup" style={{ fontSize: '0.85em' }}>+ Add Device</Link>
        </div>

        {devices.length === 0 ? (
          <p style={{ color: '#888', fontSize: '0.9em' }}>No devices paired yet.</p>
        ) : (
          devices.map((d) => {
            const recent = isHeartbeatRecent(d.lastHeartbeat);
            return (
              <div key={d.id} style={{ display: 'flex', gap: '8px', padding: '4px 0', borderBottom: '1px solid #eee' }}>
                <span style={{ color: recent ? '#228b22' : '#cc0000' }}>{recent ? 'ON' : 'OFF'}</span>
                <span style={{ flex: 1 }}>{d.name}</span>
                <span style={{ color: '#888', fontSize: '0.85em' }}>{d.platform} - {d.lastHeartbeat.toLocaleString()}</span>
              </div>
            );
          })
        )}
      </section>

      {/* General */}
      <section style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '1em', borderBottom: '1px solid #ddd', paddingBottom: '4px', marginBottom: '8px' }}>General</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label>Digest time:</label>
            <input
              type="time"
              value={settings.digestTime}
              onChange={(e) => setSettings({ ...settings, digestTime: e.target.value })}
              style={{ padding: '4px 6px', border: '1px solid #ccc' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label>Timezone:</label>
            <select
              value={settings.timezone}
              onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
              style={{ padding: '4px 6px', border: '1px solid #ccc' }}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="checkbox"
              checked={settings.alertsEnabled}
              onChange={(e) => setSettings({ ...settings, alertsEnabled: e.target.checked })}
            />
            RED domain alerts
          </label>

          <div>
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); saveSettings(); }}
              style={{ color: saving ? '#888' : '#111', fontSize: '0.9em' }}
            >
              {saving ? 'Saving...' : '[Save Settings]'}
            </a>
          </div>
        </div>
      </section>

      {/* Domain Overrides */}
      <section style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '1em', borderBottom: '1px solid #ddd', paddingBottom: '4px', marginBottom: '8px' }}>Domain Overrides</h2>
        <p style={{ fontSize: '0.85em', color: '#888', marginBottom: '10px' }}>
          Manually assign a category. Overrides take priority over automatic classification.
        </p>

        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="example.com"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            style={{ padding: '4px 6px', border: '1px solid #ccc', flex: 1, minWidth: '160px' }}
          />
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            style={{ padding: '4px 6px', border: '1px solid #ccc' }}
          >
            <option value="RED">RED</option>
            <option value="YELLOW">YELLOW</option>
            <option value="GREEN">GREEN</option>
            <option value="GRAY">GRAY</option>
          </select>
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); addOverride(); }}
            style={{ padding: '4px 0', fontSize: '0.9em' }}
          >
            [Add]
          </a>
        </div>

        {overrides.length === 0 ? (
          <p style={{ color: '#888', fontSize: '0.85em' }}>No overrides set.</p>
        ) : (
          overrides.map((o) => (
            <div key={o.domain} style={{ display: 'flex', gap: '10px', padding: '3px 0', borderBottom: '1px solid #eee', alignItems: 'baseline' }}>
              <span style={{ flex: 1 }}>{o.domain}</span>
              <span style={{ color: CATEGORY_COLORS[o.category] || '#888', fontWeight: 600, fontSize: '0.85em', textDecoration: 'underline' }}>
                {o.category}
              </span>
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); removeOverride(o.domain); }}
                style={{ color: '#cc0000', fontSize: '0.85em' }}
              >
                remove
              </a>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
