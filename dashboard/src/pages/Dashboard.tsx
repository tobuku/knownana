import { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { format, startOfDay, endOfDay } from 'date-fns';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import type { DomainLog, ChildDevice } from '../types';
import LogList from '../components/LogList';

const FILTERED_DOMAINS = new Set([
  'google-analytics.com',
  'googletagmanager.com',
  'doubleclick.net',
  'facebook.net',
  'cdn.jsdelivr.net',
  'cloudflare.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'ajax.googleapis.com',
  'cdn.cloudflare.com',
  'connect.facebook.net',
  'pagead2.googlesyndication.com',
]);

type FilterType = 'ALL' | 'RED' | 'YELLOW' | 'GREEN' | 'GRAY' | 'SEARCHES';

const CATEGORY_COLORS_LIGHT: Record<string, string> = {
  RED: '#cc0000',
  YELLOW: '#b8860b',
  GREEN: '#228b22',
  GRAY: '#555',
};

const CATEGORY_COLORS_DARK: Record<string, string> = {
  RED: '#ff4444',
  YELLOW: '#daa520',
  GREEN: '#44bb44',
  GRAY: '#999',
};

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const { bg, fg, fgMuted, border, borderLight, dark, toggle } = useTheme();
  const CATEGORY_COLORS = dark ? CATEGORY_COLORS_DARK : CATEGORY_COLORS_LIGHT;
  const navigate = useNavigate();
  const familyId = user?.uid || '';

  const [logs, setLogs] = useState<DomainLog[]>([]);
  const [devices, setDevices] = useState<ChildDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [showFiltered, setShowFiltered] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Fetch devices
  useEffect(() => {
    if (!familyId) return;
    const devRef = collection(db, 'families', familyId, 'devices');
    const unsub = onSnapshot(devRef, (snap) => {
      const devs: ChildDevice[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name,
          deviceId: data.deviceId,
          platform: data.platform,
          lastHeartbeat: data.lastHeartbeat instanceof Timestamp
            ? data.lastHeartbeat.toDate()
            : new Date(data.lastHeartbeat),
        };
      });
      setDevices(devs);
    });
    return unsub;
  }, [familyId]);

  // Fetch logs for selected date (real-time)
  useEffect(() => {
    if (!familyId) return;
    const dateObj = new Date(selectedDate + 'T00:00:00');
    const dayStart = Timestamp.fromDate(startOfDay(dateObj));
    const dayEnd = Timestamp.fromDate(endOfDay(dateObj));

    const logsRef = collection(db, 'families', familyId, 'logs');
    const constraints = [
      where('timestamp', '>=', dayStart),
      where('timestamp', '<=', dayEnd),
      orderBy('timestamp', 'desc'),
    ];

    const q = query(logsRef, ...constraints);
    const unsub = onSnapshot(q, (snap) => {
      const items: DomainLog[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          domain: data.domain,
          fullUrl: data.fullUrl,
          pageTitle: data.pageTitle,
          category: data.category,
          categorySource: data.categorySource,
          timestamp: data.timestamp instanceof Timestamp
            ? data.timestamp.toDate()
            : new Date(data.timestamp),
          duration: data.duration,
          sourceApp: data.sourceApp,
          platform: data.platform,
          searchTerm: data.searchTerm,
          deviceId: data.deviceId,
        };
      });
      setLogs(items);
    });
    return unsub;
  }, [familyId, selectedDate]);

  const filteredLogs = useMemo(() => {
    let result = logs;
    if (selectedDevice !== 'all') {
      result = result.filter((l) => l.deviceId === selectedDevice);
    }
    if (!showFiltered) {
      result = result.filter((l) => !FILTERED_DOMAINS.has(l.domain));
    }
    if (filter === 'SEARCHES') {
      result = result.filter((l) => l.searchTerm);
    } else if (filter !== 'ALL') {
      result = result.filter((l) => l.category === filter);
    }
    return result;
  }, [logs, selectedDevice, filter, showFiltered]);

  const stats = useMemo(() => {
    const visible = selectedDevice !== 'all'
      ? logs.filter((l) => l.deviceId === selectedDevice)
      : logs;
    return {
      total: visible.length,
      red: visible.filter((l) => l.category === 'RED').length,
      yellow: visible.filter((l) => l.category === 'YELLOW').length,
    };
  }, [logs, selectedDevice]);

  const filterOptions: { key: FilterType; label: string }[] = [
    { key: 'ALL', label: 'All' },
    { key: 'RED', label: 'Red' },
    { key: 'YELLOW', label: 'Yellow' },
    { key: 'GREEN', label: 'Green' },
    { key: 'GRAY', label: 'Gray' },
    { key: 'SEARCHES', label: 'Searches' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: bg, color: fg }}>
      {/* Sidebar */}
      <aside
        style={{
          width: '180px',
          borderRight: `1px solid ${border}`,
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 0,
          left: sidebarOpen ? 0 : '-180px',
          bottom: 0,
          background: bg,
          zIndex: 100,
          transition: 'left 0.15s ease',
          overflow: 'hidden',
        }}
      >
        <div style={{ marginBottom: '24px' }}>
          <img src="/logo.png" alt="KnowNana" style={{ width: '80px', marginBottom: '6px', filter: dark ? 'invert(1)' : 'none' }} />
          <br />
          <strong>KnowNana</strong>
          <div style={{
            fontSize: '0.75em',
            color: fgMuted,
            marginTop: '2px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '148px',
          }}>
            {user?.email}
          </div>
        </div>

        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {[
            { to: '/dashboard', label: 'Dashboard' },
            { to: '/settings', label: 'Settings' },
            { to: '/device-setup', label: 'Add Device' },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              style={{
                textDecoration: 'none',
                color: fg,
                padding: '4px 0',
                borderBottom: item.to === '/dashboard' ? `1px solid ${fg}` : 'none',
                fontSize: '0.95em',
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); toggle(); }}
            style={{ fontSize: '0.85em', color: fgMuted, textDecoration: 'none' }}
          >
            [{dark ? 'Light' : 'Dark'}]
          </a>
          <a
            href="#"
            onClick={async (e) => {
              e.preventDefault();
              await signOut();
              navigate('/');
            }}
            style={{ fontSize: '0.85em', color: fgMuted, textDecoration: 'none' }}
          >
            Sign out
          </a>
        </div>
      </aside>

      {/* Sidebar overlay for mobile */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.3)',
            zIndex: 99,
          }}
        />
      )}

      {/* Desktop sidebar spacer */}
      <div style={{ width: '180px', flexShrink: 0 }} className="sidebar-spacer" />

      {/* Main content */}
      <main style={{ flex: 1, padding: '16px 20px', maxWidth: '900px' }}>
        {/* Top controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); setSidebarOpen(!sidebarOpen); }}
            className="sidebar-toggle"
            style={{ textDecoration: 'none', color: fg, fontSize: '1.1em' }}
          >
            [=]
          </a>

          <select
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            style={{ padding: '4px 6px', border: `1px solid ${border}`, background: bg, color: fg }}
          >
            <option value="all">All Devices</option>
            {devices.map((d) => (
              <option key={d.id} value={d.deviceId}>
                {d.name} ({d.platform})
              </option>
            ))}
          </select>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ padding: '4px 6px', border: `1px solid ${border}`, background: bg, color: fg }}
          />

          <label style={{ fontSize: '0.85em', color: fgMuted, display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
            <input
              type="checkbox"
              checked={showFiltered}
              onChange={(e) => setShowFiltered(e.target.checked)}
            />
            Show CDN noise
          </label>
        </div>

        {/* Stats line */}
        <div style={{ fontSize: '0.9em', color: fg, marginBottom: '10px' }}>
          {stats.total} domains
          {stats.red > 0 && <> - <span style={{ color: CATEGORY_COLORS.RED, fontWeight: 600 }}>{stats.red} red</span></>}
          {stats.yellow > 0 && <> - <span style={{ color: CATEGORY_COLORS.YELLOW, fontWeight: 600 }}>{stats.yellow} yellow</span></>}
        </div>

        {/* Filter links */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', borderBottom: `1px solid ${borderLight}`, paddingBottom: '8px' }}>
          {filterOptions.map((fb) => {
            const isActive = filter === fb.key;
            const color = CATEGORY_COLORS[fb.key] || fg;
            return (
              <a
                key={fb.key}
                href="#"
                onClick={(e) => { e.preventDefault(); setFilter(fb.key); }}
                style={{
                  textDecoration: isActive ? 'underline' : 'none',
                  color: isActive ? color : fgMuted,
                  fontWeight: isActive ? 600 : 400,
                  fontSize: '0.9em',
                }}
              >
                {fb.label}
              </a>
            );
          })}
        </div>

        {/* Log list */}
        <LogList logs={filteredLogs} />
      </main>

      <style>{`
        @media (min-width: 768px) {
          aside { left: 0 !important; }
          .sidebar-toggle { display: none !important; }
        }
        @media (max-width: 767px) {
          .sidebar-spacer { display: none !important; }
        }
      `}</style>
    </div>
  );
}
