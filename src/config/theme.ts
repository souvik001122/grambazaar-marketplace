import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

// Custom color palette for GramBazaar
export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#8B4513', // Earthy brown for rural/artisan theme
    secondary: '#D2691E', // Chocolate brown
    tertiary: '#CD853F', // Peru/golden brown
    background: '#FFFAF0', // Floral white
    surface: '#FFFFFF',
    surfaceVariant: '#F5E6D3',
    error: '#B00020',
    onPrimary: '#FFFFFF',
    onSecondary: '#FFFFFF',
    onBackground: '#1C1B1F',
    onSurface: '#1C1B1F',
    outline: '#79747E',
    success: '#2E7D32',
    warning: '#F57C00',
    info: '#0288D1',
  },
  roundness: 8,
};

export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#D2691E',
    secondary: '#F4A460',
    tertiary: '#DEB887',
    background: '#1C1B1F',
    surface: '#2B2930',
    surfaceVariant: '#49454F',
    error: '#CF6679',
    onPrimary: '#FFFFFF',
    onSecondary: '#000000',
    onBackground: '#E6E1E5',
    onSurface: '#E6E1E5',
    outline: '#938F99',
    success: '#66BB6A',
    warning: '#FFA726',
    info: '#29B6F6',
  },
  roundness: 8,
};

// Spacing constants
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// Typography
export const typography = {
  fontFamily: {
    regular: 'System',
    medium: 'System',
    bold: 'System',
  },
  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
};
