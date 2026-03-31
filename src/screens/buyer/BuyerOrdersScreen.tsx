import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { getBuyerOrders } from '../../services/orderService';
import { Order } from '../../types/index';
import { formatPrice, formatRelativeTime } from '../../utils/formatting';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { StatusBadge } from '../../components/StatusBadge';
import { resolveImageUrl } from '../../services/storageService';
import { appwriteConfig } from '../../config/appwrite';
import { BUYER_LAYOUT } from '../../constants/layout';

type FilterTab = 'all' | 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'processing', label: 'Processing' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
];

const BuyerOrdersScreen = ({ navigation }: any) => {
  const tabBarHeight = 16;
  const { width: screenWidth } = useWindowDimensions();
  const isLargeScreen = screenWidth >= BUYER_LAYOUT.railBreakpoint;
  const railStyle = isLargeScreen ? styles.contentRailWide : undefined;
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    if (!user) return;
    try {
      setError(false);
      setLoading(true);
      const data = await getBuyerOrders(user.$id);
      setOrders(data);
    } catch (err) {
      console.error('Error loading orders:', err);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadOrders();
  }, [user]);

  const filteredOrders = activeTab === 'all'
    ? orders
    : orders.filter((o) => o.status === activeTab);

  const tabCounts = useMemo(() => {
    const counts: Record<FilterTab, number> = {
      all: orders.length,
      pending: 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
    };

    for (const order of orders) {
      const key = order.status as FilterTab;
      if (key in counts && key !== 'all') {
        counts[key] += 1;
      }
    }

    return counts;
  }, [orders]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return 'time-outline';
      case 'processing': return 'construct-outline';
      case 'shipped': return 'airplane-outline';
      case 'delivered': return 'checkmark-circle-outline';
      case 'cancelled': return 'close-circle-outline';
      default: return 'ellipsis-horizontal';
    }
  };

  if (loading && !refreshing) return <LoadingSpinner fullScreen />;

  if (error && !refreshing) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="cloud-offline-outline" size={64} color={COLORS.textTertiary} />
        <Text style={styles.errorText}>Failed to load orders</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadOrders}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderOrder = ({ item }: { item: Order }) => {
    const firstItem = item.items?.[0];
    const imageUrl =
      resolveImageUrl(appwriteConfig.productImagesBucketId, firstItem?.productImage) ||
      'https://via.placeholder.com/60';
    const itemCount = item.items?.reduce((sum, i) => sum + i.quantity, 0) || 0;

    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => navigation.navigate('OrderDetail', { orderId: item.$id })}
        activeOpacity={0.7}
      >
        <View style={styles.orderHeader}>
          <View style={styles.orderIdRow}>
            <Ionicons name={getStatusIcon(item.status)} size={18} color={COLORS.primary} />
            <Text style={styles.orderId}>#{item.$id.slice(-8).toUpperCase()}</Text>
          </View>
          <StatusBadge status={item.status} size="small" />
        </View>

        <View style={styles.orderBody}>
          <Image source={{ uri: imageUrl }} style={styles.orderImage} />
          <View style={styles.orderInfo}>
            <Text style={styles.orderItemName} numberOfLines={1}>
              {firstItem?.productName || 'Order'}
            </Text>
            {itemCount > 1 && (
              <Text style={styles.moreItems}>+{itemCount - 1} more items</Text>
            )}
            <Text style={styles.orderDate}>
              {item.createdAt ? formatRelativeTime(item.createdAt) : ''}
            </Text>
          </View>
          <Text style={styles.orderAmount}>{formatPrice(item.totalAmount)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.screenHeader}>
        <View style={styles.screenHeaderRow}>
          <Ionicons name="receipt" size={22} color="#FFF" />
          <Text style={styles.screenHeaderTitle}>My Orders</Text>
        </View>
        <Text style={styles.screenHeaderSubtitle}>Track every order update in one place</Text>
      </View>
      {/* Tabs */}
      <View style={styles.tabBarWrap}>
        <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.tabRow, railStyle]}
        >
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.activeTab]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.8}
            >
              <View style={styles.tabContent}>
                <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
                  {tab.label}
                </Text>
                <View style={[styles.countBadge, activeTab === tab.key && styles.countBadgeActive]}>
                  <Text style={[styles.countText, activeTab === tab.key && styles.countTextActive]}>
                    {tabCounts[tab.key]}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Orders List */}
      <FlatList
        style={styles.ordersList}
        data={filteredOrders}
        keyExtractor={(item) => item.$id}
        renderItem={renderOrder}
        contentContainerStyle={[styles.list, railStyle, { paddingBottom: tabBarHeight }]}
        ListHeaderComponent={
          orders.length > 0 ? (
            <View style={styles.ordersSummaryCard}>
              <View style={styles.ordersSummaryItem}>
                <Text style={styles.ordersSummaryValue}>{orders.length}</Text>
                <Text style={styles.ordersSummaryLabel}>Total</Text>
              </View>
              <View style={styles.ordersSummaryDivider} />
              <View style={styles.ordersSummaryItem}>
                <Text style={styles.ordersSummaryValue}>{tabCounts.pending + tabCounts.processing + tabCounts.shipped}</Text>
                <Text style={styles.ordersSummaryLabel}>Active</Text>
              </View>
              <View style={styles.ordersSummaryDivider} />
              <View style={styles.ordersSummaryItem}>
                <Text style={styles.ordersSummaryValue}>{tabCounts.delivered}</Text>
                <Text style={styles.ordersSummaryLabel}>Delivered</Text>
              </View>
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[COLORS.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={64} color={COLORS.textTertiary} />
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptySubtext}>
              {activeTab === 'all'
                ? 'Your orders will appear here'
                : `No ${activeTab} orders`}
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  screenHeader: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  screenHeaderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  screenHeaderTitle: { fontSize: 20, fontWeight: '700', color: '#FFF' },
  screenHeaderSubtitle: {
    marginTop: 3,
    marginLeft: 32,
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: COLORS.background },
  errorText: { fontSize: 16, color: COLORS.textSecondary, marginTop: 16, marginBottom: 16 },
  retryButton: { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  retryButtonText: { color: '#FFF', fontWeight: '600' },
  tabBarWrap: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    alignItems: 'center',
  },
  tab: {
    paddingHorizontal: 14,
    height: 38,
    minWidth: 86,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeTab: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  activeTabText: { color: '#FFF', fontWeight: '700' },
  countBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  countBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  countTextActive: {
    color: '#FFF',
  },
  contentRailWide: {
    width: '100%',
    maxWidth: BUYER_LAYOUT.railMaxWidth,
    alignSelf: 'center',
  },
  ordersList: {
    flex: 1,
  },
  list: { padding: 16 },
  ordersSummaryCard: {
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${COLORS.primary}22`,
    backgroundColor: `${COLORS.primary}10`,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  ordersSummaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  ordersSummaryDivider: {
    width: 1,
    height: 24,
    backgroundColor: `${COLORS.primary}33`,
  },
  ordersSummaryValue: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  ordersSummaryLabel: {
    marginTop: 2,
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  orderCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  orderIdRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  orderId: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 0.4 },
  orderBody: { flexDirection: 'row', alignItems: 'center' },
  orderImage: { width: 58, height: 58, borderRadius: 10, backgroundColor: COLORS.card },
  orderInfo: { flex: 1, marginLeft: 12 },
  orderItemName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  moreItems: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  orderDate: { fontSize: 12, color: COLORS.textTertiary, marginTop: 5 },
  orderAmount: { fontSize: 17, fontWeight: 'bold', color: COLORS.primary },
  emptyContainer: { alignItems: 'center', marginTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginTop: 16, marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: COLORS.textSecondary },
});

export default BuyerOrdersScreen;
