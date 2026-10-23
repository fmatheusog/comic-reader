import { useColorScheme } from 'react-native';

import { useSettings } from '@/state/settings';

export type ThemeName = 'light' | 'sepia' | 'dark';

export type Theme = {
  name: ThemeName;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  accent: string;
  border: string;
  statusBar: 'light' | 'dark';
};

export const themes: Record<ThemeName, Theme> = {
  light: {
    name: 'light',
    background: '#FFFFFF',
    surface: '#F2F2F5',
    text: '#1B1B1F',
    textMuted: '#5F6368',
    accent: '#3B6EF5',
    border: '#D9D9DE',
    statusBar: 'dark',
  },
  sepia: {
    name: 'sepia',
    background: '#F4ECD8',
    surface: '#EADFC4',
    text: '#433422',
    textMuted: '#7A6A53',
    accent: '#A0522D',
    border: '#D8C9A6',
    statusBar: 'dark',
  },
  dark: {
    name: 'dark',
    background: '#1B1B1F',
    surface: '#26262B',
    text: '#E6E6EA',
    textMuted: '#9A9AA2',
    accent: '#8AB4F8',
    border: '#3A3A41',
    statusBar: 'light',
  },
};

export function useAppTheme(): Theme {
  const scheme = useColorScheme();
  const { theme } = useSettings();
  if (theme === 'system') return scheme === 'dark' ? themes.dark : themes.light;
  return themes[theme];
}
