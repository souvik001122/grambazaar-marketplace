import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAllOrders } from '../../services/adminService';
import { Order } from '../../types/index';
import { COLORS } from '../../constants/colors';
import { showAlert } from '../../utils/alert';
import { isCompletedSale } from '../../utils/salesMetrics';

type FilterTab = 'all' | 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

const AdminOrdersScreen = ({ navigation }: any) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [error, setError] = useState(false);

  const loadOrders = async () => {
    try {
      const all = await getAllOrders();
      setOrders(all as unknown as Order[]);
      setError(false);
    } catch (error) {
      console.error('Error loading orders:', error);
      setError(true);
      if (!refreshing) showAlert('Error', 'Failed to load orders.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadOrders(); }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadOrders();
  }, []);

  const filtered = orders.filter(o => {
    if (activeTab === 'all') return true;
    return o.status === activeTab;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return COLORS.success;
      case 'shipped': return COLORS.info;
      case 'processing': return COLORS.primary;
      case 'pending': return COLORS.warning;
      case 'cancelled': case 'refunded': return COLORS.error;
      case 'paid': return COLORS.success;
      default: return COLORS.textSecondary;
    }
  };

  const isPaid = (order: Order) => {
    const payment = (order.paymentStatus || '').toLowerCase();
    const status = (order.status || '').toLowerCase();
    if (status === 'shipped' || status === 'delivered') return true;
    return payment === 'paid';
  };

  const getPaymentLabel = (order: Order) => {
    const payment = (order.paymentStatus || '').toLowerCase();
    if (payment === 'refunded') return 'Refunded';
    return isPaid(order) ? 'Paid' : 'Pending';
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const totalRevenue = orders
    .filter(o => isCompletedSale(o))
    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'processing', label: 'Processing' },
    { key: 'shipped', label: 'Shipped' },
    { key: 'delivered', label: 'Delivered' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  const renderOrderCard = ({ item }: { item: Order }) => {
    const itemCount = Array.isArray(item.items) ? item.items.length : 0;
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('AdminOrderDetail', { order: item })}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.orderId}>#{(item.$id || '').substring(0, 10).toUpperCase()}</Text>
            <Text style={styles.orderDate}>{formatDate(item.createdAt)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '18' }]}>
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {item.status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </Text>
          </View>
        </View>

        <View style={styles.orderDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="cube-outline" size={14} color={COLORS.textSecondary} />
            <Text style={styles.detailText}>{itemCount} item{itemCount !== 1 ? 's' : ''}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="cash-outline" size={14} color={COLORS.textSecondary} />
            <Text style={styles.detailText}>₹{item.totalAmount}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="card-outline" size={14} color={COLORS.textSecondary} />
            <Text style={styles.detailText}>
              Payment: {getPaymentLabel(item)}
            </Text>
          </View>
        </View>

        <View style={styles.idsRow}>
          <Text style={styles.idLabel}>Buyer: <Text style={styles.idValue}>{item.buyerId?.substring(0, 10)}...</Text></Text>
          <Text style={styles.idLabel}>Seller: <Text style={styles.idValue}>{item.sellerId?.substring(0, 10)}...</Text></Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (error && orders.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="cloud-offline-outline" size={60} color={COLORS.textTertiary} />
        <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.text, marginTop: 16 }}>Failed to load orders</Text>
        <TouchableOpacity onPress={() => { setLoading(true); setError(false); loadOrders(); }} style={{ marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: COLORS.primary, borderRadius: 8 }}>
          <Text style={{ color: '#FFF', fontWeight: '600' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.screenHeader}>
        <Ionicons name="receipt" size={22} color="#FFF" />
        <Text style={styles.screenHeaderTitle}>Orders</Text>
      </View>
      {/* Revenue Summary */}
      <View style={styles.revenueBanner}>
        <View>
          <Text style={styles.revenueLabel}>Delivered Revenue</Text>
          <Text style={styles.revenueValue}>₹{totalRevenue.toLocaleString('en-IN')}</Text>
        </View>
        <View style={styles.revenueStats}>
          <Text style={styles.revenueStat}>{orders.length} orders</Text>
          <Text style={styles.revenueStat}>{orders.filter(o => o.status === 'delivered').length} delivered</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabScroll}>
        <FlatList
          data={tabs}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.tabBar}
          renderItem={({ item: tab }) => {
            const count = tab.key === 'all' ? orders.length : orders.filter(o => o.status === tab.key).length;
            return (
              <TouchableOpacity
                style={[styles.tab, activeTab === tab.key && styles.activeTab]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
                  {tab.label} ({count})
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <FlatList
        data={filtered}
        renderItem={renderOrderCard}
        keyExtractor={(item) => item.$id}
        contentContainerStyle={[styles.listContent, { paddingBottom: 16 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={60} color={COLORS.textTertiary} />
            <Text style={styles.emptyTitle}>No {activeTab === 'all' ? '' : activeTab} orders</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  screenHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 14,
  },
  screenHeaderTitle: { fontSize: 20, fontWeight: '700', color: '#FFF' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  revenueBanner: {
    backgroundColor: COLORS.primary,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  revenueLabel: { fontSize: 13, color: '#FFF', opacity: 0.85 },
  revenueValue: { fontSize: 26, fontWeight: '700', color: '#FFF', marginTop: 2 },
  revenueStats: { alignItems: 'flex-end' },
  revenueStat: { fontSize: 12, color: '#FFF', opacity: 0.8, marginBottom: 2 },
  tabScroll: { backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tabBar: { paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: COLORS.card },
  activeTab: { backgroundColor: COLORS.primary },
  tabText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  activeTabText: { color: '#FFF', fontWeight: '700' },
  listContent: { padding: 16 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  orderId: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  orderDate: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700' },
  orderDetails: { marginBottom: 10 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  detailText: { fontSize: 13, color: COLORS.textSecondary },
  idsRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10 },
  idLabel: { fontSize: 11, color: COLORS.textTertiary },
  idValue: { color: COLORS.textSecondary, fontWeight: '500' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text, marginTop: 16 },
});

export default AdminOrdersScreen;
