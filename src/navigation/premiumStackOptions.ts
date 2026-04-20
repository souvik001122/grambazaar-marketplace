import { COLORS } from '../constants/colors';

export const PREMIUM_STACK_OPTIONS = {
  headerStyle: { backgroundColor: COLORS.surface },
  headerTintColor: COLORS.text,
  headerTitleStyle: {
    fontWeight: '800' as const,
    color: COLORS.text,
    fontSize: 17,
  },
  headerShadowVisible: false,
  headerBackTitleVisible: false,
  contentStyle: { backgroundColor: COLORS.background },
  animation: 'slide_from_right' as const,
};
