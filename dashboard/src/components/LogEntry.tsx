import { format } from 'date-fns';
import type { GroupedDomainLog } from '../types';
import { useTheme } from '../context/ThemeContext';
import ColorBadge from './ColorBadge';

interface LogEntryProps {
  grouped: GroupedDomainLog;
}

export default function LogEntry({ grouped }: LogEntryProps) {
  const { fg, fgMuted, borderLight } = useTheme();
  const { log, visitCount, searchTerms } = grouped;
  const timeStr = format(log.timestamp, 'h:mm a');
  const isHeavy = visitCount > 3;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: '10px',
        padding: '3px 0',
        borderBottom: `1px solid ${borderLight}`,
        fontWeight: isHeavy ? 600 : 400,
      }}
    >
      <span style={{ color: fgMuted, fontSize: '0.85em', flexShrink: 0, width: '70px' }}>
        {timeStr}
      </span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: fg }}>
        {visitCount > 1 && (
          <span style={{ color: fgMuted, fontWeight: 400, marginRight: '4px', fontSize: '0.85em' }}>
            {visitCount}x
          </span>
        )}
        {log.domain}
      </span>
      <ColorBadge category={log.category} />
      {searchTerms.length > 0 && (
        <span style={{ color: fgMuted, fontSize: '0.85em' }}>
          [{searchTerms[0]}{searchTerms.length > 1 ? ` +${searchTerms.length - 1}` : ''}]
        </span>
      )}
    </div>
  );
}
