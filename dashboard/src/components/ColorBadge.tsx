import React from 'react';
import type { CategoryColor } from '../types';
import { useTheme } from '../context/ThemeContext';

const COLORS_LIGHT: Record<CategoryColor, string> = {
  RED: '#cc0000',
  YELLOW: '#b8860b',
  GREEN: '#228b22',
  GRAY: '#555',
};

const COLORS_DARK: Record<CategoryColor, string> = {
  RED: '#ff4444',
  YELLOW: '#daa520',
  GREEN: '#44bb44',
  GRAY: '#999',
};

interface ColorBadgeProps {
  category: CategoryColor;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export default function ColorBadge({ category, onClick, style }: ColorBadgeProps) {
  const { dark } = useTheme();
  const colors = dark ? COLORS_DARK : COLORS_LIGHT;
  return (
    <span
      onClick={onClick}
      style={{
        color: colors[category],
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
