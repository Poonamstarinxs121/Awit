import { createContext, useState, useEffect, useCallback, type ReactNode } from 'react';

export type ThemeId = 'dark' | 'midnight' | 'nord' | 'warm-light';

export interface ThemeDefinition {
  id: ThemeId;
  label: string;
  preview: { bg: string; surface: string; accent: string; text: string };
}

export const THEMES: ThemeDefinition[] = [
  { id: 'dark', label: 'Dark (Default)', preview: { bg: '#0C0C0C', surface: '#1A1A1A', accent: '#FF3B30', text: '#FFFFFF' } },
  { id: 'midnight', label: 'Midnight Blue', preview: { bg: '#0B1120', surface: '#111B2E', accent: '#3B82F6', text: '#E2E8F0' } },
  { id: 'nord', label: 'Nord', preview: { bg: '#2E3440', surface: '#3B4252', accent: '#88C0D0', text: '#ECEFF4' } },
  { id: 'warm-light', label: 'Warm Light', preview: { bg: '#FAF8F5', surface: '#FFFFFF', accent: '#E5484D', text: '#1C1C1C' } },
];

const themeVars: Record<ThemeId, Record<string, string>> = {
  dark: {
    '--bg': '#0C0C0C', '--background': '#0C0C0C', '--foreground': '#FFFFFF',
    '--surface': '#1A1A1A', '--surface-elevated': '#242424', '--surface-hover': '#2E2E2E',
    '--card': '#1A1A1A', '--card-elevated': '#242424',
    '--border': '#2A2A2A', '--border-strong': '#3A3A3A',
    '--accent': '#FF3B30', '--accent-soft': 'rgba(255,59,48,0.125)', '--accent-hover': '#FF524A', '--accent-muted': 'rgba(255,59,48,0.1)',
    '--text-primary': '#FFFFFF', '--text-secondary': '#8A8A8A', '--text-muted': '#525252',
    '--positive': '#32D74B', '--negative': '#FF453A', '--warning': '#FFD60A', '--info': '#0A84FF',
    '--shadow-sm': '0 1px 2px rgba(0,0,0,0.4)', '--shadow-md': '0 4px 6px rgba(0,0,0,0.5)',
  },
  midnight: {
    '--bg': '#0B1120', '--background': '#0B1120', '--foreground': '#E2E8F0',
    '--surface': '#111B2E', '--surface-elevated': '#172032', '--surface-hover': '#1E293B',
    '--card': '#111B2E', '--card-elevated': '#172032',
    '--border': '#1E293B', '--border-strong': '#334155',
    '--accent': '#3B82F6', '--accent-soft': 'rgba(59,130,246,0.125)', '--accent-hover': '#60A5FA', '--accent-muted': 'rgba(59,130,246,0.1)',
    '--text-primary': '#E2E8F0', '--text-secondary': '#94A3B8', '--text-muted': '#475569',
    '--positive': '#34D399', '--negative': '#F87171', '--warning': '#FBBF24', '--info': '#60A5FA',
    '--shadow-sm': '0 1px 2px rgba(0,0,0,0.5)', '--shadow-md': '0 4px 6px rgba(0,0,0,0.6)',
  },
  nord: {
    '--bg': '#2E3440', '--background': '#2E3440', '--foreground': '#ECEFF4',
    '--surface': '#3B4252', '--surface-elevated': '#434C5E', '--surface-hover': '#4C566A',
    '--card': '#3B4252', '--card-elevated': '#434C5E',
    '--border': '#4C566A', '--border-strong': '#5E6779',
    '--accent': '#88C0D0', '--accent-soft': 'rgba(136,192,208,0.15)', '--accent-hover': '#8FBCBB', '--accent-muted': 'rgba(136,192,208,0.1)',
    '--text-primary': '#ECEFF4', '--text-secondary': '#D8DEE9', '--text-muted': '#7B88A1',
    '--positive': '#A3BE8C', '--negative': '#BF616A', '--warning': '#EBCB8B', '--info': '#81A1C1',
    '--shadow-sm': '0 1px 2px rgba(0,0,0,0.3)', '--shadow-md': '0 4px 6px rgba(0,0,0,0.4)',
  },
  'warm-light': {
    '--bg': '#FAF8F5', '--background': '#FAF8F5', '--foreground': '#1C1C1C',
    '--surface': '#FFFFFF', '--surface-elevated': '#F5F3F0', '--surface-hover': '#EBE8E4',
    '--card': '#FFFFFF', '--card-elevated': '#F5F3F0',
    '--border': '#E5E2DD', '--border-strong': '#D5D2CD',
    '--accent': '#E5484D', '--accent-soft': 'rgba(229,72,77,0.1)', '--accent-hover': '#DC3D43', '--accent-muted': 'rgba(229,72,77,0.08)',
    '--text-primary': '#1C1C1C', '--text-secondary': '#6B6B6B', '--text-muted': '#A0A0A0',
    '--positive': '#30A46C', '--negative': '#E5484D', '--warning': '#F5A623', '--info': '#0091FF',
    '--shadow-sm': '0 1px 2px rgba(0,0,0,0.06)', '--shadow-md': '0 4px 6px rgba(0,0,0,0.08)',
  },
};

interface ThemeContextType {
  theme: ThemeId;
  setTheme: (id: ThemeId) => void;
}

export const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    const stored = localStorage.getItem('squidjob_theme');
    if (stored && themeVars[stored as ThemeId]) return stored as ThemeId;
    return 'dark';
  });

  const applyTheme = useCallback((id: ThemeId) => {
    const vars = themeVars[id];
    if (!vars) return;
    const root = document.documentElement;
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }
  }, []);

  const setTheme = useCallback((id: ThemeId) => {
    setThemeState(id);
    localStorage.setItem('squidjob_theme', id);
    applyTheme(id);
  }, [applyTheme]);

  useEffect(() => {
    applyTheme(theme);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
