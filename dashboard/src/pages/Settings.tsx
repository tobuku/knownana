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
  arrayRemove,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
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
  const { bg, fg, fgMuted, border, borderLight } = useTheme();
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
  const [showArchived, setShowArchived] = useState(false);
  const [editingDevice, setEditingDevice] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

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
          active: data.active !== false,
          archived: data.archived || false,
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

  async function toggleActive(device: ChildDevice) {
    await updateDoc(doc(db, 'devices', device.id), { active: !device.active });
  }

  async function archiveDevice(device: ChildDevice) {
    await updateDoc(doc(db, 'devices', device.id), { archived: true, active: false });
  }

  async function unarchiveDevice(device: ChildDevice) {
    await updateDoc(doc(db, 'devices', device.id), { archived: false });
  }

  async function deleteDevice(device: ChildDevice) {
    await deleteDoc(doc(db, 'devices', device.id));
    // Remove from family's deviceIds array
    if (familyId) {
      await updateDoc(doc(db, 'families', familyId), {
        deviceIds: arrayRemove(device.deviceId),
      });
    }
    setConfirmDelete(null);
  }

  async function renameDevice(device: ChildDevice) {
    if (!editName.trim()) return;
    await updateDoc(doc(db, 'devices', device.id), { deviceName: editName.trim() });
    setEditingDevice(null);
    setEditName('');
  }

  const activeDevices = devices.filter((d) => !d.archived);
  const archivedDevices = devices.filter((d) => d.archived);

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '16px', background: bg, color: fg }}>
      <div style={{ marginBottom: '20px' }}>
        <Link to="/dashboard" style={{ fontSize: '0.9em', color: fgMuted }}>&larr; Dashboard</Link>
        <h1 style={{ fontSize: '1.1em', marginTop: '8px', color: fg }}>Settings</h1>
      </div>

      {/* Devices */}
      <section style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: `1px solid ${border}`, paddingBottom: '4px', marginBottom: '8px' }}>
          <h2 style={{ fontSize: '1em', color: fg }}>Devices</h2>
          <Link to="/install" style={{ fontSize: '0.85em', color: fg }}>+ Add Device</Link>
        </div>

        {activeDevices.length === 0 ? (
          <p style={{ color: fgMuted, fontSize: '0.9em' }}>No devices paired yet.</p>
        ) : (
          activeDevices.map((d) => {
            const recent = isHeartbeatRecent(d.lastHeartbeat);
            return (
              <div key={d.id} style={{ padding: '8px 0', borderBottom: `1px solid ${borderLight}` }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ color: !d.active ? fgMuted : recent ? '#228b22' : '#cc0000', fontWeight: 600 }}>
                    {!d.active ? 'PAUSED' : recent ? 'ON' : 'OFF'}
                  </span>
                  {editingDevice === d.id ? (
                    <span style={{ flex: 1, display: 'flex', gap: '4px' }}>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') renameDevice(d); if (e.key === 'Escape') setEditingDevice(null); }}
                        style={{ flex: 1, padding: '2px 4px', border: `1px solid ${border}`, background: bg, color: fg, fontSize: '0.9em' }}
                        autoFocus
                      />
                      <a href="#" onClick={(e) => { e.preventDefault(); renameDevice(d); }} style={{ color: fg, fontSize: '0.85em' }}>[ok]</a>
                      <a href="#" onClick={(e) => { e.preventDefault(); setEditingDevice(null); }} style={{ color: fgMuted, fontSize: '0.85em' }}>[x]</a>
                    </span>
                  ) : (
                    <span style={{ flex: 1, color: fg }}>{d.name}</span>
                  )}
                  <span style={{ color: fgMuted, fontSize: '0.85em' }}>{d.platform}</span>
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '4px', paddingLeft: '48px', fontSize: '0.85em' }}>
                  <a href="#" onClick={(e) => { e.preventDefault(); setEditingDevice(d.id); setEditName(d.name); }} style={{ color: fgMuted }}>rename</a>
                  <a href="#" onClick={(e) => { e.preventDefault(); toggleActive(d); }} style={{ color: fgMuted }}>
                    {d.active ? 'pause' : 'resume'}
                  </a>
                  <a href="#" onClick={(e) => { e.preventDefault(); archiveDevice(d); }} style={{ color: fgMuted }}>archive</a>
                  {confirmDelete === d.id ? (
                    <span>
                      <span style={{ color: '#cc0000' }}>delete? </span>
                      <a href="#" onClick={(e) => { e.preventDefault(); deleteDevice(d); }} style={{ color: '#cc0000' }}>yes</a>
                      {' / '}
                      <a href="#" onClick={(e) => { e.preventDefault(); setConfirmDelete(null); }} style={{ color: fgMuted }}>no</a>
                    </span>
                  ) : (
                    <a href="#" onClick={(e) => { e.preventDefault(); setConfirmDelete(d.id); }} style={{ color: '#cc0000' }}>delete</a>
                  )}
                </div>
                <div style={{ fontSize: '0.8em', color: fgMuted, marginTop: '2px', paddingLeft: '48px' }}>
                  Last seen: {d.lastHeartbeat.toLocaleString()}
                </div>
              </div>
            );
          })
        )}

        {/* Archived devices */}
        {archivedDevices.length > 0 && (
          <div style={{ marginTop: '12px' }}>
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); setShowArchived(!showArchived); }}
              style={{ fontSize: '0.85em', color: fgMuted }}
            >
              {showArchived ? 'Hide' : 'Show'} archived ({archivedDevices.length})
            </a>
            {showArchived && archivedDevices.map((d) => (
              <div key={d.id} style={{ padding: '6px 0', borderBottom: `1px solid ${borderLight}`, opacity: 0.6 }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ color: fgMuted, fontWeight: 600 }}>ARCHIVED</span>
                  <span style={{ flex: 1, color: fgMuted }}>{d.name}</span>
                  <span style={{ color: fgMuted, fontSize: '0.85em' }}>{d.platform}</span>
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '4px', paddingLeft: '72px', fontSize: '0.85em' }}>
                  <a href="#" onClick={(e) => { e.preventDefault(); unarchiveDevice(d); }} style={{ color: fgMuted }}>restore</a>
                  {confirmDelete === d.id ? (
                    <span>
                      <span style={{ color: '#cc0000' }}>delete permanently? </span>
                      <a href="#" onClick={(e) => { e.preventDefault(); deleteDevice(d); }} style={{ color: '#cc0000' }}>yes</a>
                      {' / '}
                      <a href="#" onClick={(e) => { e.preventDefault(); setConfirmDelete(null); }} style={{ color: fgMuted }}>no</a>
                    </span>
                  ) : (
                    <a href="#" onClick={(e) => { e.preventDefault(); setConfirmDelete(d.id); }} style={{ color: '#cc0000' }}>delete</a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* General */}
      <section style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '1em', borderBottom: `1px solid ${border}`, paddingBottom: '4px', marginBottom: '8px', color: fg }}>General</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label>Digest time:</label>
            <input
              type="time"
              value={settings.digestTime}
              onChange={(e) => setSettings({ ...settings, digestTime: e.target.value })}
              style={{ padding: '4px 6px', border: `1px solid ${border}`, background: bg, color: fg }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label>Timezone:</label>
            <select
              value={settings.timezone}
              onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
              style={{ padding: '4px 6px', border: `1px solid ${border}`, background: bg, color: fg }}
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
              style={{ color: saving ? fgMuted : fg, fontSize: '0.9em' }}
            >
              {saving ? 'Saving...' : '[Save Settings]'}
            </a>
          </div>
        </div>
      </section>

      {/* Domain Overrides */}
      <section style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '1em', borderBottom: `1px solid ${border}`, paddingBottom: '4px', marginBottom: '8px', color: fg }}>Domain Overrides</h2>
        <p style={{ fontSize: '0.85em', color: fgMuted, marginBottom: '10px' }}>
          Manually assign a category. Overrides take priority over automatic classification.
        </p>

        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="example.com"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            style={{ padding: '4px 6px', border: `1px solid ${border}`, background: bg, color: fg, flex: 1, minWidth: '160px' }}
          />
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            style={{ padding: '4px 6px', border: `1px solid ${border}`, background: bg, color: fg }}
          >
            <option value="RED">RED</option>
            <option value="YELLOW">YELLOW</option>
            <option value="GREEN">GREEN</option>
            <option value="GRAY">GRAY</option>
          </select>
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); addOverride(); }}
            style={{ padding: '4px 0', fontSize: '0.9em', color: fg }}
          >
            [Add]
          </a>
        </div>

        {overrides.length === 0 ? (
          <p style={{ color: fgMuted, fontSize: '0.85em' }}>No overrides set.</p>
        ) : (
          overrides.map((o) => (
            <div key={o.domain} style={{ display: 'flex', gap: '10px', padding: '3px 0', borderBottom: `1px solid ${borderLight}`, alignItems: 'baseline' }}>
              <span style={{ flex: 1, color: fg }}>{o.domain}</span>
              <span style={{ color: CATEGORY_COLORS[o.category] || fgMuted, fontWeight: 600, fontSize: '0.85em', textDecoration: 'underline' }}>
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
