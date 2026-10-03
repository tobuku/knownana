import { format, isSameHour } from 'date-fns';
import type { DomainLog, GroupedDomainLog } from '../types';
import { useTheme } from '../context/ThemeContext';
import LogEntry from './LogEntry';

interface LogListProps {
  logs: DomainLog[];
}

function deduplicateHourGroup(logs: DomainLog[]): GroupedDomainLog[] {
  const map = new Map<string, GroupedDomainLog>();
  const order: string[] = [];

  for (const log of logs) {
    const existing = map.get(log.domain);
    if (existing) {
      existing.visitCount++;
      if (log.searchTerm && !existing.searchTerms.includes(log.searchTerm)) {
        existing.searchTerms.push(log.searchTerm);
      }
    } else {
      order.push(log.domain);
      map.set(log.domain, {
        log,
        visitCount: 1,
        searchTerms: log.searchTerm ? [log.searchTerm] : [],
      });
    }
  }

  return order.map((domain) => map.get(domain)!);
}

export default function LogList({ logs }: LogListProps) {
  const { fgMuted, borderLight } = useTheme();

  if (logs.length === 0) {
    return (
      <div style={{ padding: '40px 0', color: fgMuted, textAlign: 'center' }}>
        No activity logged for this date.
      </div>
    );
  }

  const groups: { label: string; logs: DomainLog[]; queryCount: number }[] = [];
  let currentGroup: { label: string; logs: DomainLog[]; queryCount: number } | null = null;

  for (const log of logs) {
    if (!currentGroup || !isSameHour(log.timestamp, currentGroup.logs[0].timestamp)) {
      currentGroup = {
        label: format(log.timestamp, 'h:00 a'),
        logs: [log],
        queryCount: 0,
      };
      groups.push(currentGroup);
    } else {
      currentGroup.logs.push(log);
    }
  }

  return (
    <div>
      {groups.map((group, gi) => {
        const deduped = deduplicateHourGroup(group.logs);
        return (
          <div key={gi} style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '0.8em', color: fgMuted, borderBottom: `1px solid ${borderLight}`, paddingBottom: '2px', marginBottom: '4px' }}>
              {group.label} ({deduped.length} sites, {group.logs.length} queries)
            </div>
            {deduped.map((grouped) => (
              <LogEntry key={grouped.log.id} grouped={grouped} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
