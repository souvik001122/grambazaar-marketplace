import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { useAuth } from '../../context/AuthContext';
import { getSellerByUserId } from '../../services/sellerService';
import { getProductsBySeller } from '../../services/productService';
import { getSellerReviews, calculateSellerRating } from '../../services/reviewService';
import { getSellerOrders } from '../../services/orderService';
import { Seller } from '../../types/seller.types';
import { Product } from '../../types/product.types';
import { COLORS } from '../../constants/colors';
import { showAlert } from '../../utils/alert';
import { calculateTrustScore } from '../../utils/trustScore';
import { PremiumTopBar } from '../../components/PremiumTopBar';

type ActivityItem = {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  text: string;
  time: string;
};

const SELLER_DASHBOARD_CACHE_TTL_MS = 3 * 60 * 1000;

type SellerDashboardSnapshot = {
  userId: string;
  seller: Seller | null;
  products: Product[];
  avgRating: number;
  totalReviews: number;
  totalOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  cachedAt: number;
};

let SELLER_DASHBOARD_CACHE: SellerDashboardSnapshot | null = null;

const SellerDashboardScreen = ({ navigation }: any) => {
  const { user } = useAuth();

  const [seller, setSeller] = useState<Seller | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [deliveredOrders, setDeliveredOrders] = useState(0);
  const [cancelledOrders, setCancelledOrders] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user?.$id || !SELLER_DASHBOARD_CACHE) {
      return;
    }

    const snapshotExpired = Date.now() - SELLER_DASHBOARD_CACHE.cachedAt > SELLER_DASHBOARD_CACHE_TTL_MS;
    const wrongUser = SELLER_DASHBOARD_CACHE.userId !== user.$id;

    if (snapshotExpired || wrongUser) {
      return;
    }

    setSeller(SELLER_DASHBOARD_CACHE.seller);
    setProducts(SELLER_DASHBOARD_CACHE.products);
    setAvgRating(SELLER_DASHBOARD_CACHE.avgRating);
    setTotalReviews(SELLER_DASHBOARD_CACHE.totalReviews);
    setTotalOrders(SELLER_DASHBOARD_CACHE.totalOrders);
    setDeliveredOrders(SELLER_DASHBOARD_CACHE.deliveredOrders);
    setCancelledOrders(SELLER_DASHBOARD_CACHE.cancelledOrders);
    setLoading(false);
  }, [user?.$id]);

  const loadDashboardData = useCallback(async ({ blocking = true }: { blocking?: boolean } = {}) => {
    if (blocking) {
      setLoading(true);
    }

    try {
      const sellerData = await getSellerByUserId(user!.$id);
      setSeller(sellerData);

      if (sellerData) {
        const [sellerProducts, sellerRating, sellerReviews, sellerOrders] = await Promise.all([
          getProductsBySeller(sellerData.$id),
          calculateSellerRating(sellerData.$id),
          getSellerReviews(sellerData.$id, 1, 200),
          getSellerOrders(sellerData.$id, 200),
        ]);

        setProducts(sellerProducts);
        setAvgRating(sellerRating.avgRating);
        setTotalReviews(sellerRating.totalReviews || sellerReviews.total || 0);
        setTotalOrders(sellerOrders.length);
        setDeliveredOrders(
          sellerOrders.filter((order) => (order.status || '').toLowerCase() === 'delivered').length
        );
        setCancelledOrders(
          sellerOrders.filter((order) => (order.status || '').toLowerCase() === 'cancelled').length
        );

        if (user?.$id) {
          SELLER_DASHBOARD_CACHE = {
            userId: user.$id,
            seller: sellerData,
            products: sellerProducts,
            avgRating: sellerRating.avgRating,
            totalReviews: sellerRating.totalReviews || sellerReviews.total || 0,
            totalOrders: sellerOrders.length,
            deliveredOrders: sellerOrders.filter((order) => (order.status || '').toLowerCase() === 'delivered').length,
            cancelledOrders: sellerOrders.filter((order) => (order.status || '').toLowerCase() === 'cancelled').length,
            cachedAt: Date.now(),
          };
        }
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
      showAlert('Error', 'Failed to load dashboard data. Pull down to refresh.');
    } finally {
      if (blocking) {
        setLoading(false);
      }
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      const canUseSnapshot =
        !!user?.$id &&
        !!SELLER_DASHBOARD_CACHE &&
        SELLER_DASHBOARD_CACHE.userId === user.$id &&
        Date.now() - SELLER_DASHBOARD_CACHE.cachedAt <= SELLER_DASHBOARD_CACHE_TTL_MS;

      loadDashboardData({ blocking: !canUseSnapshot });
    }, [loadDashboardData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData({ blocking: false });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!seller) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Seller data not found</Text>
      </View>
    );
  }

  const totalProducts = products.length;
  const activeProducts = products.filter(
    (p) => (p.status || '').toLowerCase() === 'active' || (p.status || '').toLowerCase() === 'approved'
  ).length;
  const pendingProducts = products.filter((p) => (p.status || '').toLowerCase() === 'pending').length;
  const totalViews = products.reduce((sum, p) => sum + (p.views || 0), 0);
  const isVerifiedSeller = !!seller.verifiedBadge || seller.verificationStatus === 'approved';

  const trustScore = calculateTrustScore(seller, {
    avgRating,
    totalReviews,
    totalOrders,
    deliveredOrders,
    cancelledOrders,
    totalProducts,
    activeProducts,
    totalViews,
  });

  const trustScoreClamped = Math.max(0, Math.min(100, Math.round(trustScore)));
  const fulfillmentRate = totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : 0;
  const cancellationRate = totalOrders > 0 ? Math.round((cancelledOrders / totalOrders) * 100) : 0;

  const health = (() => {
    if (trustScore >= 70) return { text: 'Good', color: '#22C55E' };
    if (trustScore >= 45) return { text: 'Warning', color: '#F59E0B' };
    return { text: 'At Risk', color: '#EF4444' };
  })();

  const verificationMeta = (() => {
    const status = (seller.verificationStatus || '').toLowerCase();
    if (status === 'approved') {
      return {
        label: 'Verified Seller',
        icon: 'checkmark-circle' as const,
        textColor: '#166534',
        bgColor: '#ECFDF3',
        borderColor: '#BBF7D0',
      };
    }
    if (status === 'rejected') {
      return {
        label: 'Verification Rejected',
        icon: 'alert-circle' as const,
        textColor: '#B91C1C',
        bgColor: '#FEF2F2',
        borderColor: '#FECACA',
      };
    }
    return {
      label: 'Verification Pending',
      icon: 'time' as const,
      textColor: '#B45309',
      bgColor: '#FFF7ED',
      borderColor: '#FED7AA',
    };
  })();

  const stats = [
    {
      key: 'products',
      label: 'Products',
      value: `${totalProducts}`,
      meta: `${activeProducts} active`,
      icon: 'cube-outline' as const,
      color: COLORS.primary,
    },
    {
      key: 'orders',
      label: 'Orders',
      value: `${totalOrders}`,
      meta: `${deliveredOrders} delivered`,
      icon: 'receipt-outline' as const,
      color: '#0EA5E9',
    },
    {
      key: 'views',
      label: 'Store Views',
      value: `${totalViews}`,
      meta: `${pendingProducts} pending`,
      icon: 'eye-outline' as const,
      color: COLORS.secondary,
    },
    {
      key: 'rating',
      label: 'Rating',
      value: avgRating > 0 ? avgRating.toFixed(1) : '0.0',
      meta: `${totalReviews} reviews`,
      icon: 'star-outline' as const,
      color: COLORS.warning,
    },
  ];

  const actions = [
    {
      key: 'add',
      title: 'Add Product',
      subtitle: 'Publish new listing',
      icon: 'add-circle-outline' as const,
      color: COLORS.primary,
      onPress: () => navigation.navigate('AddProduct'),
    },
    {
      key: 'my-products',
      title: 'My Products',
      subtitle: 'Manage inventory',
      icon: 'grid-outline' as const,
      color: COLORS.secondary,
      onPress: () => navigation.navigate('MyProducts'),
    },
    {
      key: 'orders',
      title: 'Orders',
      subtitle: 'Payment and shipping',
      icon: 'receipt-outline' as const,
      color: '#0EA5E9',
      onPress: () => navigation.navigate('Orders'),
    },
    {
      key: 'notifications',
      title: 'Notifications',
      subtitle: 'Buyer and system alerts',
      icon: 'notifications-outline' as const,
      color: '#F59E0B',
      onPress: () => navigation.navigate('SellerNotifications'),
    },
    {
      key: 'reviews',
      title: 'Reviews',
      subtitle: 'Customer feedback',
      icon: 'star-outline' as const,
      color: '#FACC15',
      onPress: () => navigation.navigate('SellerReviews'),
    },
    {
      key: 'analytics',
      title: 'Analytics',
      subtitle: 'Sales performance',
      icon: 'analytics-outline' as const,
      color: '#8B5CF6',
      onPress: () => navigation.navigate('SellerAnalytics'),
    },
  ];

  const recentActivity: ActivityItem[] = [];

  if (seller.verificationStatus === 'approved') {
    recentActivity.push({ icon: 'checkmark-circle', color: '#22C55E', text: 'Account verified', time: 'Verified' });
  } else if (seller.verificationStatus === 'pending') {
    recentActivity.push({ icon: 'time', color: '#F59E0B', text: 'Verification pending', time: 'Pending' });
  } else if (seller.verificationStatus === 'rejected') {
    recentActivity.push({ icon: 'close-circle', color: '#EF4444', text: 'Verification rejected', time: 'Action needed' });
  }

  if (totalProducts > 0) {
    recentActivity.push({
      icon: 'cube',
      color: COLORS.primary,
      text: `${totalProducts} products listed`,
      time: `${activeProducts} active`,
    });
  } else {
    recentActivity.push({
      icon: 'cube-outline',
      color: '#6B7280',
      text: 'No products added yet',
      time: 'Start now',
    });
  }

  if (totalOrders > 0) {
    recentActivity.push({
      icon: 'cart',
      color: '#22C55E',
      text: `${totalOrders} orders received`,
      time: `${deliveredOrders} delivered`,
    });
  }

  return (
    <View style={styles.container}>
      <PremiumTopBar
        title="Seller Dashboard"
        subtitle={`Welcome, ${seller.businessName || user?.name || 'Seller'}`}
        icon="grid-outline"
        rightLabel={refreshing ? 'Refreshing' : 'Refresh'}
        onRightPress={onRefresh}
        rightDisabled={refreshing}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.heroWrap}>
          <View style={styles.heroCard}>
            <View style={styles.heroGlow} />

            <View style={styles.heroTopRow}>
              <View style={styles.heroTextWrap}>
                <Text style={styles.heroOverline}>Store Command Center</Text>
                <Text style={styles.heroTitle} numberOfLines={1}>
                  {seller.businessName || user?.name || 'Seller'}
                </Text>
                <Text style={styles.heroSubtitle}>
                  Track growth, fulfillment, and trust from one premium dashboard.
                </Text>
              </View>

              <View style={styles.scoreRing}>
                <Text style={styles.scoreValue}>{trustScoreClamped}</Text>
                <Text style={styles.scoreLabel}>Trust</Text>
              </View>
            </View>

            <View style={styles.heroMetaRow}>
              <View style={[styles.statusChip, { backgroundColor: verificationMeta.bgColor, borderColor: verificationMeta.borderColor }]}>
                <Ionicons name={verificationMeta.icon} size={14} color={verificationMeta.textColor} />
                <Text style={[styles.statusChipText, { color: verificationMeta.textColor }]}>{verificationMeta.label}</Text>
              </View>

              <View style={styles.statusChipNeutral}>
                <Ionicons name="shield-checkmark-outline" size={14} color={health.color} />
                <Text style={[styles.statusChipText, { color: health.color }]}>{health.text}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Performance Snapshot</Text>
          <Text style={styles.sectionSubTitle}>Live seller metrics</Text>
          <View style={styles.statsGrid}>
            {stats.map((item) => (
              <View key={item.key} style={styles.statCard}>
                <View style={[styles.statIconWrap, { backgroundColor: `${item.color}14` }]}>
                  <Ionicons name={item.icon} size={20} color={item.color} />
                </View>
                <Text style={styles.statValue}>{item.value}</Text>
                <Text style={styles.statLabel}>{item.label}</Text>
                <Text style={styles.statMeta}>{item.meta}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Account Health</Text>
          <Text style={styles.sectionSubTitle}>Trust and fulfillment quality</Text>
          <View style={styles.healthCard}>
            <View style={styles.healthTopRow}>
              <View>
                <Text style={styles.healthTitle}>Overall Status</Text>
                <Text style={[styles.healthValue, { color: health.color }]}>{health.text}</Text>
              </View>
              <View style={styles.healthTrustWrap}>
                <Text style={styles.healthTrustLabel}>Trust Score</Text>
                <Text style={styles.healthTrustValue}>{trustScoreClamped}/100</Text>
              </View>
            </View>

            <View style={styles.healthTrack}>
              <View style={[styles.healthFill, { width: `${trustScoreClamped}%`, backgroundColor: health.color }]} />
            </View>

            <View style={styles.healthPillRow}>
              <View style={styles.healthPill}>
                <Text style={styles.healthPillLabel}>Fulfillment</Text>
                <Text style={styles.healthPillValue}>{fulfillmentRate}%</Text>
              </View>
              <View style={styles.healthPill}>
                <Text style={styles.healthPillLabel}>Cancellation</Text>
                <Text style={styles.healthPillValue}>{cancellationRate}%</Text>
              </View>
              <View style={styles.healthPill}>
                <Text style={styles.healthPillLabel}>Delivered</Text>
                <Text style={styles.healthPillValue}>{deliveredOrders}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <Text style={styles.sectionSubTitle}>Move fast through key workflows</Text>
          <View style={styles.actionsGrid}>
            {actions.map((action) => (
              <TouchableOpacity key={action.key} style={styles.actionCard} onPress={action.onPress} activeOpacity={0.9}>
                <View style={[styles.actionIconWrap, { backgroundColor: `${action.color}16` }]}>
                  <Ionicons name={action.icon} size={20} color={action.color} />
                </View>
                <View style={styles.actionTextWrap}>
                  <Text style={styles.actionText}>{action.title}</Text>
                  <Text style={styles.actionSubText}>{action.subtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <Text style={styles.sectionSubTitle}>Latest seller-side updates</Text>
          <View style={styles.activityCard}>
            {recentActivity.map((item, idx) => (
              <View key={`${item.text}-${idx}`} style={[styles.activityRow, idx === recentActivity.length - 1 && styles.activityRowLast]}>
                <View style={styles.activityIconWrap}>
                  <Ionicons name={item.icon} size={16} color={item.color} />
                </View>
                <View style={styles.activityTextWrap}>
                  <Text style={styles.activityText}>{item.text}</Text>
                  <Text style={styles.activityTime}>{item.time}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {!isVerifiedSeller && (
          <View style={styles.sectionBlock}>
            <TouchableOpacity
              style={styles.noticeCard}
              onPress={() => navigation.navigate('VerificationStatus')}
              activeOpacity={0.9}
            >
              <Ionicons name="shield-outline" size={18} color={COLORS.warning} />
              <View style={styles.noticeTextWrap}>
                <Text style={styles.noticeTitle}>Complete verification for stronger conversion</Text>
                <Text style={styles.noticeText}>Verified sellers usually gain buyer trust faster.</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: COLORS.error,
    textAlign: 'center',
    marginTop: 50,
  },
  heroWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  heroCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  heroGlow: {
    position: 'absolute',
    top: -22,
    right: -18,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: `${COLORS.primary}10`,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroTextWrap: {
    flex: 1,
  },
  heroOverline: {
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  heroTitle: {
    marginTop: 6,
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
  },
  heroSubtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.textSecondary,
  },
  scoreRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: `${COLORS.primary}60`,
    backgroundColor: `${COLORS.primary}10`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primary,
    lineHeight: 20,
  },
  scoreLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  heroMetaRow: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  statusChipNeutral: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionBlock: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
  },
  sectionSubTitle: {
    marginTop: 4,
    marginBottom: 12,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    marginTop: 10,
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
  },
  statLabel: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  statMeta: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  healthCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
  healthTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  healthTitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  healthValue: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: '800',
  },
  healthTrustWrap: {
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  healthTrustLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  healthTrustValue: {
    marginTop: 2,
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.primary,
  },
  healthTrack: {
    marginTop: 14,
    height: 8,
    borderRadius: 999,
    backgroundColor: COLORS.card,
    overflow: 'hidden',
  },
  healthFill: {
    height: '100%',
    borderRadius: 999,
  },
  healthPillRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 8,
  },
  healthPill: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 8,
    alignItems: 'center',
  },
  healthPillLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  healthPillValue: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  actionsGrid: {
    gap: 10,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  actionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextWrap: {
    flex: 1,
    marginLeft: 10,
    marginRight: 6,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  actionSubText: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  activityCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  activityRowLast: {
    borderBottomWidth: 0,
  },
  activityIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityTextWrap: {
    flex: 1,
    marginLeft: 10,
  },
  activityText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  activityTime: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textTertiary,
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  noticeTextWrap: {
    flex: 1,
  },
  noticeTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
  },
  noticeText: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    color: '#B45309',
  },
});

export default SellerDashboardScreen;
