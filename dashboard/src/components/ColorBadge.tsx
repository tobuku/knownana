import React from 'react';
import type { CategoryColor } from '../types';

const COLORS: Record<CategoryColor, { bg: string; text: string }> = {
  RED: { bg: '#dc2626', text: '#fff' },
  YELLOW: { bg: '#f59e0b', text: '#000' },
  GREEN: { bg: '#16a34a', text: '#fff' },
  GRAY: { bg: '#6b7280', text: '#fff' },
};

interface ColorBadgeProps {
  category: CategoryColor;
  style?: React.CSSProperties;
}

export default function ColorBadge({ category, style }: ColorBadgeProps) {
  const color = COLORS[category];
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: '9999px',
        fontSize: '0.7rem',
        fontWeight: 600,
        letterSpacing: '0.03em',
        textTransform: 'uppercase',
        backgroundColor: color.bg,
        color: color.text,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {category}
    </span>
  );
}
