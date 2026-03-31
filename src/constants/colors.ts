// Earthy tones for artisan marketplace
export const COLORS = {
  // Primary
  primary: '#D97706', // Amber - represents traditional craftsmanship
  primaryDark: '#B45309',
  primaryLight: '#F59E0B',
  
  // Secondary
  secondary: '#059669', // Emerald - represents growth and nature
  secondaryDark: '#047857',
  secondaryLight: '#10B981',
  
  // Accent
  accent: '#DC2626', // Red - for alerts and important actions
  accentLight: '#EF4444',
  
  // Neutral
  background: '#FAFAF9',
  surface: '#FFFFFF',
  card: '#F5F5F4',
  
  // Text
  text: '#1C1917',
  textSecondary: '#57534E',
  textTertiary: '#A8A29E',
  
  // Status
  success: '#059669',
  warning: '#F59E0B',
  error: '#DC2626',
  info: '#3B82F6',
  
  // Trust Score Colors
  trustLow: '#EF4444',      // Red - <50
  trustMedium: '#FACC15',   // Yellow - 50-79
  trustHigh: '#16A34A',     // Green - 80+
  trustExcellent: '#15803D', // Strong Green - 90+
  
  // Verification
  verified: '#059669',
  pending: '#F59E0B',
  rejected: '#DC2626',
  
  // Borders
  border: '#E7E5E4',
  borderLight: '#F5F5F4',
  
  // Overlays
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.25)',
  
  // Shadows
  shadow: '#000000',
};

export const getTrustColor = (score: number) => {
  if (score >= 90) return COLORS.trustExcellent;
  if (score >= 80) return COLORS.trustHigh;
  if (score >= 50) return COLORS.trustMedium;
  return COLORS.trustLow;
};

export const getStatusColor = (status: string) => {
  const normalized = (status || '').toLowerCase();
  switch (normalized) {
    case 'verified':
    case 'active':
    case 'approved':
    case 'paid':
    case 'success':
    case 'delivered':
      return COLORS.success;
    case 'processing':
      return COLORS.primary;
    case 'shipped':
      return COLORS.info;
    case 'pending':
      return COLORS.warning;
    case 'rejected':
    case 'blocked':
    case 'cancelled':
    case 'failed':
      return COLORS.error;
    case 'refunded':
      return COLORS.info;
    default:
      return COLORS.textSecondary;
  }
};
