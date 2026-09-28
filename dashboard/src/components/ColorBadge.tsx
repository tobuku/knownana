import React from 'react';
import type { CategoryColor } from '../types';

const COLORS: Record<CategoryColor, string> = {
  RED: '#cc0000',
  YELLOW: '#b8860b',
  GREEN: '#228b22',
  GRAY: '#888',
};

interface ColorBadgeProps {
  category: CategoryColor;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export default function ColorBadge({ category, onClick, style }: ColorBadgeProps) {
  return (
    <span
      onClick={onClick}
      style={{
        color: COLORS[category],
        fontSize: '0.8em',
        fontWeight: 600,
        textDecoration: 'underline',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {category}
    </span>
  );
}
