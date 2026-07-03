import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { getSellerByUserId } from '../../services/sellerService';
import { getProductsBySeller } from '../../services/productService';
import { calculateSellerRating } from '../../services/reviewService';
import { showAlert } from '../../utils/alert';
import { getSellerOrders, getSellerRevenue } from '../../services/orderService';
import { COLORS } from '../../constants/colors';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { isCompletedSale } from '../../utils/salesMetrics';
import { PremiumTopBar } from '../../components/PremiumTopBar';

const SellerAnalyticsScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analytics, setAnalytics] = useState({
    totalProducts: 0,
    activeProducts: 0,
    pendingProducts: 0,
    rejectedProducts: 0,
    totalViews: 0,
    totalOrders: 0,
    totalRevenue: 0,
    avgRating: 0,
    totalReviews: 0,
    categoryBreakdown: [] as { name: string; count: number; color: string }[],
    topProducts: [] as { name: string; views: number; rating: number; orders: number }[],
    regionInterest: [] as { region: string; count: number }[],
  });

  const loadAnalytics = useCallback(async () => {
    try {
      const seller = await getSellerByUserId(user!.$id);
      if (!seller) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Load all data in parallel
      const [products, sellerRating, ordersList, revenue] = await Promise.all([
        getProductsBySeller(seller.$id),
        calculateSellerRating(seller.$id),
        getSellerOrders(seller.$id, 200),
        getSellerRevenue(seller.$id),
      ]);

      // Product stats
      const totalProducts = products.length;
      const activeProducts = products.filter((p: any) => ['active', 'approved'].includes((p.status || '').toLowerCase())).length;
      const pendingProducts = products.filter((p: any) => (p.status || '').toLowerCase() === 'pending').length;
      const rejectedProducts = products.filter((p: any) => (p.status || '').toLowerCase() === 'rejected').length;
      const totalViews = products.reduce((sum: number, p: any) => sum + (p.views || 0), 0);

      // Category breakdown
      const catMap: Record<string, number> = {};
      products.forEach((p: any) => {
        const cat = p.category || 'Uncategorized';
        catMap[cat] = (catMap[cat] || 0) + 1;
      });
      const CATEGORY_COLORS = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336', '#00BCD4', '#795548', '#607D8B'];
      const categoryBreakdown = Object.entries(catMap)
        .map(([name, count], i) => ({ name, count, color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }))
        .sort((a, b) => b.count - a.count);

      // Per-product order count derived from ordersList items
      const deliveredOrders = ordersList.filter((order: any) => isCompletedSale(order));

      // Sold units must only come from delivered orders.
      const productSoldCount: Record<string, number> = {};
      deliveredOrders.forEach((order: any) => {
        (order.items || []).forEach((item: any) => {
          if (item.productId) {
            productSoldCount[item.productId] = (productSoldCount[item.productId] || 0) + (item.quantity || 1);
          }
        });
      });

      // Composite engagement score: rating is the strongest signal when views are low
      const engagementScore = (p: any) =>
        (p.views || 0) * 1 +
        (p.rating || 0) * 20 +
        (productSoldCount[p.$id] || 0) * 15;

      const topProducts = [...products]
        .sort((a: any, b: any) => engagementScore(b) - engagementScore(a))
        .slice(0, 5)
        .map((p: any) => ({
          name: p.name,
          views: p.views || 0,
          rating: p.rating || 0,
          orders: productSoldCount[p.$id] || 0,
        }));

      // Region interest
      const regionMap: Record<string, number> = {};
      products.forEach((p: any) => {
        const region = p.region || p.state || 'Unknown';
        regionMap[region] = (regionMap[region] || 0) + (p.views || 0);
      });
      const regionInterest = Object.entries(regionMap)
        .map(([region, count]) => ({ region, count }))
        .sort((a, b) => b.count - a.count);

      // Orders & Revenue
      const totalOrders = ordersList.length;
      const totalRevenue = revenue;

      // Reviews
      const totalReviews = sellerRating.totalReviews;
      const avgRating = sellerRating.avgRating;

      setAnalytics({
        totalProducts, activeProducts, pendingProducts, rejectedProducts,
        totalViews, totalOrders, totalRevenue, avgRating, totalReviews,
        categoryBreakdown, topProducts, regionInterest,
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
      showAlert('Error', 'Failed to load analytics data. Pull down to refresh.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadAnalytics();
    }, [loadAnalytics])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadAnalytics();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
    <PremiumTopBar
      title="Analytics"
      subtitle="Sales, performance, and product insights"
      icon="analytics-outline"
      showBack={navigation?.canGoBack?.()}
      onBack={() => navigation?.goBack?.()}
      rightLabel={refreshing ? 'Refreshing' : 'Refresh'}
      onRightPress={onRefresh}
      rightDisabled={refreshing}
    />

    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Overview Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📊 Overview</Text>
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { borderLeftColor: '#4CAF50' }]}>
            <Ionicons name="cube-outline" size={24} color="#4CAF50" />
            <Text style={styles.statValue}>{analytics.totalProducts}</Text>
            <Text style={styles.statLabel}>Total Products</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#2196F3' }]}>
            <Ionicons name="eye-outline" size={24} color="#2196F3" />
            <Text style={styles.statValue}>{analytics.totalViews}</Text>
            <Text style={styles.statLabel}>Total Views</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#FF9800' }]}>
            <Ionicons name="cart-outline" size={24} color="#FF9800" />
            <Text style={styles.statValue}>{analytics.totalOrders}</Text>
            <Text style={styles.statLabel}>Orders</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#9C27B0' }]}>
            <Ionicons name="wallet-outline" size={24} color="#9C27B0" />
            <Text style={styles.statValue}>₹{Math.round(analytics.totalRevenue).toLocaleString('en-IN')}</Text>
            <Text style={styles.statLabel}>Revenue</Text>
          </View>
        </View>
      </View>

      {/* Product Status Breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📦 Product Status</Text>
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <View style={styles.statusItem}>
              <View style={[styles.statusDot, { backgroundColor: '#4CAF50' }]} />
              <Text style={styles.statusLabel}>Active</Text>
              <Text style={styles.statusValue}>{analytics.activeProducts}</Text>
            </View>
            <View style={styles.statusItem}>
              <View style={[styles.statusDot, { backgroundColor: '#FFA500' }]} />
              <Text style={styles.statusLabel}>Pending</Text>
              <Text style={styles.statusValue}>{analytics.pendingProducts}</Text>
            </View>
            <View style={styles.statusItem}>
              <View style={[styles.statusDot, { backgroundColor: '#FF4444' }]} />
              <Text style={styles.statusLabel}>Rejected</Text>
              <Text style={styles.statusValue}>{analytics.rejectedProducts}</Text>
            </View>
          </View>
          {/* Simple bar visualization */}
          <View style={styles.barChart}>
            {analytics.totalProducts > 0 && (
              <View style={styles.barChartRow}>
                <View style={[styles.barSegment, { flex: analytics.activeProducts || 0.1, backgroundColor: '#4CAF50' }]} />
                <View style={[styles.barSegment, { flex: analytics.pendingProducts || 0.1, backgroundColor: '#FFA500' }]} />
                <View style={[styles.barSegment, { flex: analytics.rejectedProducts || 0.1, backgroundColor: '#FF4444' }]} />
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Rating Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⭐ Rating Summary</Text>
        <View style={styles.card}>
          <View style={styles.ratingRow}>
            <View style={styles.ratingBig}>
              <Text style={styles.ratingValue}>{analytics.avgRating.toFixed(1)}</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map(i => (
                  <Ionicons
                    key={i}
                    name={i <= Math.round(analytics.avgRating) ? 'star' : 'star-outline'}
                    size={18}
                    color="#FFC107"
                  />
                ))}
              </View>
            </View>
            <View style={styles.ratingInfo}>
              <Text style={styles.ratingInfoText}>{analytics.totalReviews} total reviews</Text>
              <Text style={styles.ratingInfoSubtext}>
                {analytics.avgRating >= 4
                  ? '🎉 Excellent! Keep it up!'
                  : analytics.avgRating >= 3
                  ? '👍 Good, room to improve'
                  : analytics.avgRating > 0
                  ? '⚠️ Needs improvement'
                  : 'No ratings yet'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Category Breakdown */}
      {analytics.categoryBreakdown.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📂 Category Breakdown</Text>
          <View style={styles.card}>
            {analytics.categoryBreakdown.map((cat, index) => (
              <View key={index} style={styles.categoryRow}>
                <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
                <Text style={styles.categoryName}>{cat.name}</Text>
                <Text style={styles.categoryCount}>{cat.count} product{cat.count !== 1 ? 's' : ''}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Top Products */}
      {analytics.topProducts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔥 Top Products</Text>
          <View style={styles.card}>
            {analytics.topProducts.map((prod, index) => (
              <View key={index} style={styles.topProductRow}>
                <Text style={styles.topProductRank}>#{index + 1}</Text>
                <View style={styles.topProductInfo}>
                  <Text style={styles.topProductName} numberOfLines={1}>{prod.name}</Text>
                  <View style={styles.topProductMeta}>
                    <Ionicons name="eye-outline" size={12} color="#999" />
                    <Text style={styles.topProductMetaText}>{prod.views} views</Text>
                    <Ionicons name="star" size={12} color="#FFC107" />
                    <Text style={styles.topProductMetaText}>{prod.rating.toFixed(1)}</Text>
                    {prod.orders > 0 && (
                      <>
                        <Ionicons name="cart-outline" size={12} color="#4CAF50" />
                        <Text style={[styles.topProductMetaText, { color: '#4CAF50' }]}>{prod.orders} sold</Text>
                      </>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Region Interest */}
      {analytics.regionInterest.length > 0 && (
        <View style={[styles.section, { marginBottom: 32 }]}>
          <Text style={styles.sectionTitle}>📍 Region Interest</Text>
          <View style={styles.card}>
            {analytics.regionInterest.map((region, index) => (
              <View key={index} style={styles.regionRow}>
                <Ionicons name="location-outline" size={16} color={COLORS.primary} />
                <Text style={styles.regionName}>{region.region}</Text>
                <Text style={styles.regionCount}>{region.count} views</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  section: { padding: 16, paddingBottom: 0 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginBottom: 12 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statValue: { fontSize: 21, fontWeight: '800', color: COLORS.text, marginTop: 6 },
  statLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2, fontWeight: '600' },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statusRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statusItem: { alignItems: 'center' },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 6 },
  statusLabel: { fontSize: 12, color: COLORS.textSecondary },
  statusValue: { fontSize: 19, fontWeight: '800', color: COLORS.text, marginTop: 4 },
  barChart: { marginTop: 16 },
  barChartRow: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden' },
  barSegment: { height: '100%' },
  ratingRow: { flexDirection: 'row', alignItems: 'center' },
  ratingBig: { alignItems: 'center', marginRight: 24 },
  ratingValue: { fontSize: 34, fontWeight: '800', color: COLORS.text },
  starsRow: { flexDirection: 'row', gap: 2, marginTop: 4 },
  ratingInfo: { flex: 1 },
  ratingInfoText: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  ratingInfoSubtext: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  categoryDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  categoryName: { flex: 1, fontSize: 13, color: COLORS.text, fontWeight: '600' },
  categoryCount: { fontSize: 12, color: COLORS.textSecondary },
  topProductRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  topProductRank: { fontSize: 16, fontWeight: '700', color: COLORS.primary, width: 32 },
  topProductInfo: { flex: 1 },
  topProductName: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  topProductMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  topProductMetaText: { fontSize: 12, color: COLORS.textSecondary, marginRight: 8 },
  regionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 8 },
  regionName: { flex: 1, fontSize: 13, color: COLORS.text, fontWeight: '600' },
  regionCount: { fontSize: 12, color: COLORS.textSecondary },
});

export default SellerAnalyticsScreen;
