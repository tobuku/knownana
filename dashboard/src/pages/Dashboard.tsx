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
import type { DomainLog, ChildDevice } from '../types';
import LogList from '../components/LogList';

// Domains that are filtered out as CDN/analytics noise
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

const CATEGORY_COLORS: Record<string, string> = {
  RED: '#dc2626',
  YELLOW: '#f59e0b',
  GREEN: '#16a34a',
  GRAY: '#6b7280',
};

export default function Dashboard() {
  const { user, signOut } = useAuth();
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

  // Apply filters
  const filteredLogs = useMemo(() => {
    let result = logs;

    // Device filter
    if (selectedDevice !== 'all') {
      result = result.filter((l) => l.deviceId === selectedDevice);
    }

    // Hide CDN/analytics noise unless toggled
    if (!showFiltered) {
      result = result.filter((l) => !FILTERED_DOMAINS.has(l.domain));
    }

    // Category filter
    if (filter === 'SEARCHES') {
      result = result.filter((l) => l.searchTerm);
    } else if (filter !== 'ALL') {
      result = result.filter((l) => l.category === filter);
    }

    return result;
  }, [logs, selectedDevice, filter, showFiltered]);

  // Stats
  const stats = useMemo(() => {
    const visible = selectedDevice !== 'all'
      ? logs.filter((l) => l.deviceId === selectedDevice)
      : logs;
    const totalDuration = visible.reduce((s, l) => s + (l.duration || 0), 0);
    return {
      total: visible.length,
      timeOnline: totalDuration > 3600
        ? `${Math.round(totalDuration / 3600)}h ${Math.round((totalDuration % 3600) / 60)}m`
        : `${Math.round(totalDuration / 60)}m`,
      red: visible.filter((l) => l.category === 'RED').length,
      yellow: visible.filter((l) => l.category === 'YELLOW').length,
    };
  }, [logs, selectedDevice]);

  const filterButtons: { key: FilterType; label: string }[] = [
    { key: 'ALL', label: 'All' },
    { key: 'RED', label: 'Red' },
    { key: 'YELLOW', label: 'Yellow' },
    { key: 'GREEN', label: 'Green' },
    { key: 'GRAY', label: 'Gray' },
    { key: 'SEARCHES', label: 'Searches' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside
        style={{
          width: '240px',
          backgroundColor: '#1e293b',
          color: '#e2e8f0',
          padding: '24px 0',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 0,
          left: sidebarOpen ? 0 : '-240px',
          bottom: 0,
          zIndex: 100,
          transition: 'left 0.2s ease',
        }}
      >
        <div style={{ padding: '0 20px', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>KnowNana</h2>
          <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
            {user?.email}
          </p>
        </div>

        <nav style={{ flex: 1 }}>
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
                display: 'block',
                padding: '10px 24px',
                color: '#e2e8f0',
                textDecoration: 'none',
                fontSize: '0.95rem',
                borderLeft: item.to === '/dashboard' ? '3px solid #3b82f6' : '3px solid transparent',
                backgroundColor: item.to === '/dashboard' ? 'rgba(59,130,246,0.1)' : 'transparent',
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <button
          onClick={async () => {
            await signOut();
            navigate('/');
          }}
          style={{
            margin: '0 20px',
            padding: '10px',
            backgroundColor: 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: '8px',
            color: '#e2e8f0',
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          Sign Out
        </button>
      </aside>

      {/* Sidebar overlay for mobile */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            zIndex: 99,
          }}
        />
      )}

      {/* Desktop sidebar spacer */}
      <div
        style={{
          width: '240px',
          flexShrink: 0,
        }}
        className="sidebar-spacer"
      />

      {/* Main content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {/* Top bar */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 20px',
            backgroundColor: '#fff',
            borderBottom: '1px solid #e5e7eb',
            flexWrap: 'wrap',
          }}
        >
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.3rem',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            |||
          </button>

          {/* Device selector */}
          <select
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              fontSize: '0.9rem',
              backgroundColor: '#fff',
            }}
          >
            <option value="all">All Devices</option>
            {devices.map((d) => (
              <option key={d.id} value={d.deviceId}>
                {d.name} ({d.platform})
              </option>
            ))}
          </select>

          {/* Date picker */}
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              fontSize: '0.9rem',
            }}
          />

          <div style={{ flex: 1 }} />

          {/* Show filtered toggle */}
          <label style={{ fontSize: '0.8rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input
              type="checkbox"
              checked={showFiltered}
              onChange={(e) => setShowFiltered(e.target.checked)}
            />
            Show filtered domains
          </label>
        </header>

        {/* Stats bar */}
        <div
          style={{
            display: 'flex',
            gap: '16px',
            padding: '12px 20px',
            backgroundColor: '#fff',
            borderBottom: '1px solid #e5e7eb',
            flexWrap: 'wrap',
          }}
        >
          {[
            { label: 'Total', value: stats.total, color: '#374151' },
            { label: 'Time Online', value: stats.timeOnline, color: '#374151' },
            { label: 'Red', value: stats.red, color: CATEGORY_COLORS.RED },
            { label: 'Yellow', value: stats.yellow, color: CATEGORY_COLORS.YELLOW },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                padding: '8px 16px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                minWidth: '100px',
              }}
            >
              <div style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>
                {s.label}
              </div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Filter buttons */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            padding: '12px 20px',
            backgroundColor: '#fff',
            borderBottom: '1px solid #e5e7eb',
            flexWrap: 'wrap',
          }}
        >
          {filterButtons.map((fb) => {
            const isActive = filter === fb.key;
            const color = CATEGORY_COLORS[fb.key] || '#374151';
            return (
              <button
                key={fb.key}
                onClick={() => setFilter(fb.key)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '9999px',
                  border: `1px solid ${isActive ? color : '#d1d5db'}`,
                  backgroundColor: isActive ? color : '#fff',
                  color: isActive ? '#fff' : '#374151',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {fb.label}
              </button>
            );
          })}
        </div>

        {/* Log list */}
        <LogList logs={filteredLogs} />
      </main>

      {/* Responsive: show sidebar permanently on desktop via inline media query hack */}
      <style>{`
        @media (min-width: 768px) {
          aside { left: 0 !important; }
        }
        @media (max-width: 767px) {
          .sidebar-spacer { display: none !important; }
        }
      `}</style>
    </div>
  );
}
