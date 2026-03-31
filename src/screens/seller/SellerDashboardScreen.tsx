import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
import { useFocusEffect } from '@react-navigation/native';

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

  const loadDashboardData = useCallback(async () => {
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
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
      showAlert('Error', 'Failed to load dashboard data. Pull down to refresh.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [loadDashboardData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
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

  // Compute real stats from products
  const totalProducts = products.length;
  const activeProducts = products.filter(p => (p.status || '').toLowerCase() === 'active' || (p.status || '').toLowerCase() === 'approved').length;
  const pendingProducts = products.filter(p => (p.status || '').toLowerCase() === 'pending').length;
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

  const getHealthStatus = () => {
    if (trustScore >= 70) return { text: 'GOOD', color: '#4CAF50' };
    if (trustScore >= 45) return { text: 'WARNING', color: '#FFA500' };
    return { text: 'AT RISK', color: '#FF4444' };
  };

  const health = getHealthStatus();

  // Build dynamic recent activity
  const recentActivity: { icon: string; color: string; text: string; time: string }[] = [];

  if (seller.verificationStatus === 'approved') {
    recentActivity.push({ icon: 'checkmark-circle', color: '#4CAF50', text: 'Account verified', time: 'Verified' });
  } else if (seller.verificationStatus === 'pending') {
    recentActivity.push({ icon: 'time', color: '#FFA500', text: 'Verification pending', time: 'Pending' });
  } else if (seller.verificationStatus === 'rejected') {
    recentActivity.push({ icon: 'close-circle', color: '#FF4444', text: 'Verification rejected', time: 'Action needed' });
  }

  if (totalProducts > 0) {
    recentActivity.push({ icon: 'cube', color: COLORS.primary, text: `${totalProducts} product(s) added`, time: `${activeProducts} active` });
  } else {
    recentActivity.push({ icon: 'cube-outline', color: '#999', text: 'No products yet', time: 'Add one!' });
  }

  if (pendingProducts > 0) {
    recentActivity.push({ icon: 'time-outline', color: '#FFA500', text: `${pendingProducts} product(s) pending review`, time: 'Awaiting' });
  }

  if (totalOrders > 0) {
    recentActivity.push({ icon: 'cart', color: '#4CAF50', text: `${totalOrders} total order(s)`, time: `${deliveredOrders} delivered` });
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 0 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.title}>Welcome, {seller.businessName || user?.name || 'Seller'}!</Text>
            <Text style={styles.subtitle}>Your Seller Dashboard</Text>
          </View>
          {isVerifiedSeller && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          )}
        </View>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Ionicons name="cube-outline" size={32} color={COLORS.primary} />
          <Text style={styles.statValue}>{totalProducts}</Text>
          <Text style={styles.statLabel}>Total Products</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="checkmark-circle-outline" size={32} color="#4CAF50" />
          <Text style={styles.statValue}>{activeProducts}</Text>
          <Text style={styles.statLabel}>Active Products</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="eye-outline" size={32} color={COLORS.secondary} />
          <Text style={styles.statValue}>{totalViews}</Text>
          <Text style={styles.statLabel}>Views</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="star-outline" size={32} color={COLORS.warning} />
          <Text style={styles.statValue}>{avgRating.toFixed(1)}</Text>
          <Text style={styles.statLabel}>Rating</Text>
        </View>
      </View>

      {/* Account Health */}
      <View style={[styles.healthCard, { borderLeftColor: health.color }]}>
        <View style={styles.healthContent}>
          <Ionicons name="shield-checkmark-outline" size={24} color={health.color} />
          <View style={styles.healthText}>
            <Text style={styles.healthTitle}>Account Health</Text>
            <Text style={[styles.healthStatus, { color: health.color }]}>
              {health.text}
            </Text>
          </View>
          <View style={styles.trustScoreContainer}>
            <Text style={styles.trustScoreLabel}>Trust Score</Text>
            <Text style={styles.trustScoreValue}>{trustScore}/100</Text>
          </View>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚡ Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('AddProduct')}
          >
            <Ionicons name="add-circle-outline" size={32} color={COLORS.primary} />
            <Text style={styles.actionText}>Add Product</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('MyProducts')}
          >
            <Ionicons name="grid-outline" size={32} color={COLORS.secondary} />
            <Text style={styles.actionText}>My Products</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Orders')}
          >
            <Ionicons name="receipt-outline" size={32} color="#2196F3" />
            <Text style={styles.actionText}>Orders</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('SellerNotifications')}
          >
            <Ionicons name="notifications-outline" size={32} color="#FF9800" />
            <Text style={styles.actionText}>Notifications</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('SellerReviews')}
          >
            <Ionicons name="star-outline" size={32} color="#FFC107" />
            <Text style={styles.actionText}>Reviews</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('SellerAnalytics')}
          >
            <Ionicons name="analytics-outline" size={32} color="#9C27B0" />
            <Text style={styles.actionText}>Analytics</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Activity Feed */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📰 Recent Activity</Text>
        <View style={styles.activityCard}>
          {recentActivity.map((item, index) => (
            <View key={index} style={[styles.activityItem, index === recentActivity.length - 1 && { borderBottomWidth: 0 }]}>
              <Ionicons name={item.icon as any} size={20} color={item.color} />
              <Text style={styles.activityText}>{item.text}</Text>
              <Text style={styles.activityTime}>{item.time}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: COLORS.primary,
    padding: 20,
    paddingTop: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  verifiedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  healthCard: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
  },
  healthContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  healthText: {
    flex: 1,
    marginLeft: 12,
  },
  healthTitle: {
    fontSize: 14,
    color: '#666',
  },
  healthStatus: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 2,
  },
  trustScoreContainer: {
    alignItems: 'center',
  },
  trustScoreLabel: {
    fontSize: 10,
    color: '#666',
  },
  trustScoreValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  section: {
    padding: 16,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginTop: 8,
  },
  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  activityText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
  },
  activityTime: {
    fontSize: 12,
    color: '#999',
  },
  errorText: {
    fontSize: 16,
    color: '#FF4444',
    textAlign: 'center',
    marginTop: 50,
  },
});

export default SellerDashboardScreen;
