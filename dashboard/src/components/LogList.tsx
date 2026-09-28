import { format, isSameHour } from 'date-fns';
import type { DomainLog } from '../types';
import LogEntry from './LogEntry';

interface LogListProps {
  logs: DomainLog[];
}

export default function LogList({ logs }: LogListProps) {
  if (logs.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: '#9ca3af',
          fontSize: '1rem',
        }}
      >
        <div style={{ fontSize: '2rem', marginBottom: '12px' }}>No activity</div>
        <p>No activity logged yet. Set up a child device to start monitoring.</p>
      </div>
    );
  }

  // Group logs by hour
  const groups: { label: string; logs: DomainLog[] }[] = [];
  let currentGroup: { label: string; logs: DomainLog[] } | null = null;

  for (const log of logs) {
    if (!currentGroup || !isSameHour(log.timestamp, currentGroup.logs[0].timestamp)) {
      currentGroup = {
        label: format(log.timestamp, 'h:00 a'),
        logs: [log],
      };
      groups.push(currentGroup);
    } else {
      currentGroup.logs.push(log);
    }
  }

  return (
    <div style={{ overflowY: 'auto', flex: 1 }}>
      {groups.map((group, gi) => (
        <div key={gi}>
          {/* Hour divider */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '8px 16px',
              backgroundColor: '#f9fafb',
              borderBottom: '1px solid #e5e7eb',
            }}
          >
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#6b7280',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {group.label}
            </span>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb' }} />
            <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
              {group.logs.length} {group.logs.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>
          {/* Entries */}
          {group.logs.map((log) => (
            <LogEntry key={log.id} log={log} />
          ))}
        </div>
      ))}
    </div>
  );
}
