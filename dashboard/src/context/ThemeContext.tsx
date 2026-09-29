import { createContext, useContext, useState, useEffect } from 'react';

interface ThemeContextType {
  dark: boolean;
  toggle: () => void;
  // resolved colors
  bg: string;
  fg: string;
  fgMuted: string;
  border: string;
  borderLight: string;
}

const ThemeContext = createContext<ThemeContextType>({
  dark: false,
  toggle: () => {},
  bg: '#fff',
  fg: '#000',
  fgMuted: '#444',
  border: '#bbb',
  borderLight: '#ddd',
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('kn-theme') === 'dark'; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem('kn-theme', dark ? 'dark' : 'light'); } catch {}
  }, [dark]);

  const theme: ThemeContextType = dark
    ? { dark, toggle: () => setDark(false), bg: '#111', fg: '#eee', fgMuted: '#aaa', border: '#444', borderLight: '#333' }
    : { dark, toggle: () => setDark(true), bg: '#fff', fg: '#000', fgMuted: '#444', border: '#bbb', borderLight: '#ddd' };

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme() { return useContext(ThemeContext); }
