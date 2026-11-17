/**
 * Ledger paper, not dashboard neon. The audience is doing arithmetic on a
 * phone at a thrift store; contrast and tabular numbers matter more than
 * decoration.
 */
export const colors = {
  bg: '#F5F2EA',
  card: '#FFFFFF',
  ink: '#16181A',
  inkMuted: '#6B6F73',
  hairline: '#E2DCCE',
  accent: '#1F6F5C',
  accentSoft: '#E4EFEA',
  good: '#2A7A4B',
  goodSoft: '#E6F2EA',
  warn: '#9A6212',
  warnSoft: '#F8EEDC',
  danger: '#A33A2E',
  dangerSoft: '#F7E7E4',
  onAccent: '#FFFFFF',
};

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
};

export const type = {
  h1: { fontSize: 30, fontWeight: '700' as const, letterSpacing: -0.6 },
  h2: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: '400' as const },
  label: { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.7 },
  mono: { fontVariant: ['tabular-nums' as const] },
};
