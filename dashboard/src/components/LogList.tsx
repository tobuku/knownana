import { format, isSameHour } from 'date-fns';
import type { DomainLog } from '../types';
import LogEntry from './LogEntry';

interface LogListProps {
  logs: DomainLog[];
}

export default function LogList({ logs }: LogListProps) {
  if (logs.length === 0) {
    return (
      <div style={{ padding: '40px 0', color: '#999', textAlign: 'center' }}>
        No activity logged for this date.
      </div>
    );
  }

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
    <div>
      {groups.map((group, gi) => (
        <div key={gi} style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '0.8em', color: '#999', borderBottom: '1px solid #ddd', paddingBottom: '2px', marginBottom: '4px' }}>
            {group.label} ({group.logs.length})
          </div>
          {group.logs.map((log) => (
            <LogEntry key={log.id} log={log} />
          ))}
        </div>
      ))}
    </div>
  );
}
