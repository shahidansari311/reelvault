export const COLORS = {
  primary: '#FFC107',        // Sunflower Amber
  primaryDark: '#E6A800',    // Pressed/shadow state
  primaryLight: '#FFD54F',   // Light amber
  secondary: '#FFB300',
  background: '#0D0D0F',     // Near-black
  surface: '#161618',        // Card background
  surfaceLight: '#1E1E22',   // Elevated surface
  surfaceElevated: '#242428', // Higher elevation
  glass: 'rgba(255,255,255,0.05)',
  glassBorder: 'rgba(255,255,255,0.10)',
  amberGlass: 'rgba(255,193,7,0.08)',
  amberBorder: 'rgba(255,193,7,0.25)',
  text: '#FFFFFF',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  error: '#EF4444',
  errorSurface: 'rgba(239,68,68,0.08)',
  success: '#22C55E',
  successSurface: 'rgba(34,197,94,0.08)',
  border: '#252528',
  divider: 'rgba(255,255,255,0.06)',
};

export const FONTS = {
  xs: 11,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 26,
  hero: 30,  // Was 44px — reduced to fix zoom-in problem
};

export const RADII = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 28,
  card: 24,
  chip: 50,
  input: 16,
  button: 50,
};

export const SPACING = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  xxl: 36,
  screen: 18,  // Horizontal screen padding
};

export const SHADOWS = {
  primary: {
    shadowColor: '#FFC107',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
};

export default {
  COLORS,
  FONTS,
  RADII,
  SPACING,
  SHADOWS,
};
