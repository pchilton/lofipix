export const colors = {
  background: '#f8fafc',
  surface: '#ffffff',
  surfaceMuted: '#f1f5f9',
  text: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
  primary: '#0369a1',
  primaryText: '#f8fafc',
  danger: '#b91c1c',
  dangerSurface: '#fef2f2',
  warning: '#b45309',
  warningSurface: '#fffbeb',
  success: '#15803d',
  successSurface: '#f0fdf4',
  overlay: 'rgba(15, 23, 42, 0.55)',
  camera: '#020617',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  pill: 999,
} as const;

export const typography = {
  title: 28,
  heading: 20,
  body: 15,
  small: 13,
  tiny: 11,
} as const;
