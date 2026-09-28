import { format } from 'date-fns';
import type { DomainLog } from '../types';
import ColorBadge from './ColorBadge';

interface LogEntryProps {
  log: DomainLog;
}

export default function LogEntry({ log }: LogEntryProps) {
  const timeStr = format(log.timestamp, 'h:mm a');

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: '10px',
        padding: '3px 0',
        borderBottom: '1px solid #eee',
      }}
    >
      <span style={{ color: '#999', fontSize: '0.85em', flexShrink: 0, width: '70px' }}>
        {timeStr}
      </span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {log.domain}
      </span>
      <ColorBadge category={log.category} />
      {log.searchTerm && (
        <span style={{ color: '#555', fontSize: '0.85em' }}>
          [{log.searchTerm}]
        </span>
      )}
    </div>
  );
}
