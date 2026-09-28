import { format } from 'date-fns';
import type { DomainLog } from '../types';
import ColorBadge from './ColorBadge';

const BORDER_COLORS = {
  RED: '#dc2626',
  YELLOW: '#f59e0b',
  GREEN: '#16a34a',
  GRAY: '#6b7280',
};

const BG_TINTS = {
  RED: 'rgba(220, 38, 38, 0.06)',
  YELLOW: 'rgba(245, 158, 11, 0.04)',
  GREEN: 'transparent',
  GRAY: 'transparent',
};

const PLATFORM_ICONS: Record<string, string> = {
  ios: '\u{1F4F1}',      // phone
  android: '\u{1F4F1}',  // phone
  pc: '\u{1F4BB}',       // laptop
};

interface LogEntryProps {
  log: DomainLog;
}

export default function LogEntry({ log }: LogEntryProps) {
  const timeStr = format(log.timestamp, 'h:mm a');

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '12px 16px',
        borderLeft: `4px solid ${BORDER_COLORS[log.category]}`,
        backgroundColor: BG_TINTS[log.category],
        borderBottom: '1px solid #e5e7eb',
      }}
    >
      {/* Platform icon */}
      <span style={{ fontSize: '1.2rem', marginTop: '2px', flexShrink: 0 }}>
        {PLATFORM_ICONS[log.platform] || ''}
      </span>

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{log.domain}</span>
          <ColorBadge category={log.category} />
          {log.searchTerm && (
            <span
              style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: 500,
                backgroundColor: '#e0e7ff',
                color: '#3730a3',
              }}
            >
              Search: {log.searchTerm}
            </span>
          )}
        </div>

        {log.fullUrl && (
          <div
            style={{
              fontSize: '0.8rem',
              color: '#6b7280',
              marginTop: '2px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {log.fullUrl}
          </div>
        )}

        {log.pageTitle && (
          <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '1px' }}>
            {log.pageTitle}
          </div>
        )}
      </div>

      {/* Time + duration */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 500 }}>{timeStr}</div>
        {log.duration != null && log.duration > 0 && (
          <div
            style={{
              fontSize: '0.7rem',
              color: '#9ca3af',
              marginTop: '2px',
              padding: '1px 6px',
              backgroundColor: '#f3f4f6',
              borderRadius: '4px',
              display: 'inline-block',
            }}
          >
            {log.duration < 60
              ? `${log.duration}s`
              : `${Math.round(log.duration / 60)}m`}
          </div>
        )}
      </div>
    </div>
  );
}
