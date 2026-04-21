import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  BackHandler,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { getSellerByUserId } from '../../services/sellerService';
import {
  getSellerOrders,
  updateOrderStatus as updateOrder,
  updateOrderPaymentStatus,
  notifyBuyerPaymentPending,
  shipOrderWithTracking,
} from '../../services/orderService';
import { getUserNotifications } from '../../services/notificationService';
import { COLORS } from '../../constants/colors';
import { showAlert } from '../../utils/alert';
import { useFocusEffect } from '@react-navigation/native';
import { formatRelativeTime } from '../../utils/formatting';
import { PremiumTopBar } from '../../components/PremiumTopBar';
 

type CourierName = 'India Post' | 'DTDC' | 'Blue Dart' | 'Delhivery' | 'Other';
type TabKey = 'all' | 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

interface Order {
  $id: string;
  buyerId: string;
  sellerId: string;
  items: any[] | string;
  totalAmount: number;
  status: string;
  paymentStatus: string;
  deliveryAddress: string;
  trackingInfo?: string;
  courierName?: CourierName;
  trackingId?: string;
  shippingDate?: string;
  createdAt: string;
  updatedAt: string;
}

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'New' },
  { key: 'processing', label: 'Processing' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
];

const COURIER_OPTIONS: CourierName[] = ['India Post', 'DTDC', 'Blue Dart', 'Delhivery', 'Other'];

const SellerOrdersScreen = ({ navigation, route }: any) => {
  const { user } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [sellerId, setSellerId] = useState('');
  const [trackingInputs, setTrackingInputs] = useState<Record<string, string>>({});
  const [courierInputs, setCourierInputs] = useState<Record<string, CourierName>>({});
  const [buyerPaymentEvents, setBuyerPaymentEvents] = useState<Record<string, { message: string; createdAt: string }>>({});

  const loadOrders = useCallback(async (sid?: string) => {
    const id = sid || sellerId;
    if (!id || !user?.$id) return;

    try {
      const result = await getSellerOrders(id, 50);
      const loadedOrders = result as unknown as Order[];
      setOrders(loadedOrders);

      setTrackingInputs((prev) => {
        const next = { ...prev };
        loadedOrders.forEach((ord) => {
          if (!next[ord.$id]) {
            next[ord.$id] = ord.trackingId || ord.trackingInfo || '';
          }
        });
        return next;
      });

      setCourierInputs((prev) => {
        const next = { ...prev };
        loadedOrders.forEach((ord) => {
          if (!next[ord.$id]) {
            next[ord.$id] = ord.courierName || 'India Post';
          }
        });
        return next;
      });

      const notifications = await getUserNotifications(user.$id, 1, 100);
      const paymentEvents: Record<string, { message: string; createdAt: string }> = {};
      notifications.data.forEach((n) => {
        const msg = (n.message || '').toLowerCase();
        if (n.relatedEntityId && n.type === 'order_update' && msg.includes('buyer marked payment done')) {
          if (!paymentEvents[n.relatedEntityId]) {
            paymentEvents[n.relatedEntityId] = {
              message: n.message,
              createdAt: n.createdAt,
            };
          }
        }
      });
      setBuyerPaymentEvents(paymentEvents);
    } catch (error) {
      console.error('Error loading orders:', error);
      showAlert('Error', 'Failed to load orders');
    }
  }, [sellerId, user]);

  const loadSeller = useCallback(async () => {
    try {
      const seller = await getSellerByUserId(user!.$id);
      if (seller) {
        setSellerId(seller.$id);
        await loadOrders(seller.$id);
      }
    } catch (error) {
      console.error('Error loading seller:', error);
      showAlert('Error', 'Failed to load seller data.');
    } finally {
      setLoading(false);
    }
  }, [user, loadOrders]);

  useFocusEffect(
    useCallback(() => {
      loadSeller();
    }, [loadSeller])
  );

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (route?.params?.fromProfile) {
          navigation.setParams({ fromProfile: false });
          navigation.navigate('Profile');
          return true;
        }
        return false;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [navigation, route?.params?.fromProfile])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  }, [loadOrders]);

  const isPaid = useCallback((order: Order) => {
    const payment = (order.paymentStatus || '').toLowerCase();
    const status = (order.status || '').toLowerCase();
    if (status === 'shipped' || status === 'delivered') return true;
    return payment === 'paid';
  }, []);

  const updateOrderStatus = useCallback(async (orderId: string, newStatus: string) => {
    try {
      await updateOrder(orderId, newStatus);
      showAlert('Success', `Order marked as ${newStatus}`);
      await loadOrders();
    } catch (error: any) {
      showAlert('Error', error?.message || 'Failed to update order status');
    }
  }, [loadOrders]);

  const confirmPayment = useCallback(async (orderId: string) => {
    try {
      await updateOrderPaymentStatus(orderId, 'paid');
      showAlert('Success', 'Payment confirmed as paid');
      await loadOrders();
    } catch (error: any) {
      showAlert('Error', error?.message || 'Failed to confirm payment');
    }
  }, [loadOrders]);

  const notifyPaymentNotReceived = useCallback(async (orderId: string) => {
    try {
      await notifyBuyerPaymentPending(orderId);
      showAlert('Reminder Sent', 'Buyer has been notified to complete payment.');
      await loadOrders();
    } catch (error: any) {
      showAlert('Error', error?.message || 'Failed to notify buyer');
    }
  }, [loadOrders]);

  const handleTrackingChange = useCallback((orderId: string, value: string) => {
    setTrackingInputs((prev) => ({ ...prev, [orderId]: value }));
  }, []);

  const handleCourierChange = useCallback((orderId: string, courier: CourierName) => {
    setCourierInputs((prev) => ({ ...prev, [orderId]: courier }));
  }, []);

  const handleStatusChange = useCallback((order: Order) => {
    const status = (order.status || '').toLowerCase();

    if (status === 'pending') {
      showAlert('Accept Order?', 'Start processing this order?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Accept', onPress: () => updateOrderStatus(order.$id, 'processing') },
      ]);
      return;
    }

    if (status === 'processing') {
      if (!isPaid(order)) {
        showAlert('Confirm Payment?', 'Mark this order as paid after verifying in your UPI app.', [
          { text: 'Close', style: 'cancel' },
          { text: 'Confirm Paid', onPress: () => confirmPayment(order.$id) },
        ]);
        return;
      }

      const trackingId = (trackingInputs[order.$id] || '').trim();
      const courierName = courierInputs[order.$id] || 'India Post';
      if (!trackingId) {
        showAlert('Tracking Required', 'Add tracking ID before marking as shipped.');
        return;
      }

      showAlert('Mark Shipped?', `Courier: ${courierName}\nTracking ID: ${trackingId}`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Shipped',
          onPress: async () => {
            try {
              await shipOrderWithTracking(order.$id, { courierName, trackingId });
              showAlert('Success', 'Order marked as shipped with courier and tracking details.');
              await loadOrders();
            } catch (error: any) {
              showAlert('Error', error?.message || 'Failed to mark as shipped');
            }
          },
        },
      ]);
      return;
    }

    if (status === 'shipped') {
      showAlert('Delivered?', 'Confirm delivery of this order?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => updateOrderStatus(order.$id, 'delivered') },
      ]);
    }
  }, [confirmPayment, courierInputs, isPaid, loadOrders, trackingInputs, updateOrderStatus]);

  const handleCancelOrder = useCallback((order: Order) => {
    const paid = isPaid(order);
    const title = paid ? 'Cancel & Refund?' : 'Cancel Order?';
    const message = paid
      ? 'Payment is marked paid. Cancelling will mark this order as refunded.'
      : 'Are you sure you want to cancel this order?';

    showAlert(title, message, [
      { text: 'No', style: 'cancel' },
      { text: 'Yes, Cancel', style: 'destructive', onPress: () => updateOrderStatus(order.$id, 'cancelled') },
    ]);
  }, [isPaid, updateOrderStatus]);

  const parseItems = useCallback((rawItems: any[] | string) => {
    try {
      if (Array.isArray(rawItems)) return rawItems;
      if (typeof rawItems === 'string') return JSON.parse(rawItems);
      return [];
    } catch {
      return [];
    }
  }, []);

  const getStatusColor = useCallback((status: string) => {
    switch ((status || '').toLowerCase()) {
      case 'pending': return '#FFA500';
      case 'processing': return '#2196F3';
      case 'shipped': return '#9C27B0';
      case 'delivered': return '#4CAF50';
      case 'cancelled': return '#FF4444';
      case 'refunded': return '#FF9800';
      default: return '#999';
    }
  }, []);

  const getStatusIcon = useCallback((status: string) => {
    switch ((status || '').toLowerCase()) {
      case 'pending': return 'time-outline';
      case 'processing': return 'construct-outline';
      case 'shipped': return 'car-outline';
      case 'delivered': return 'checkmark-circle-outline';
      case 'cancelled': return 'close-circle-outline';
      default: return 'help-circle-outline';
    }
  }, []);

  const getNextAction = useCallback((status: string): string | null => {
    switch ((status || '').toLowerCase()) {
      case 'pending': return 'Accept Order';
      case 'processing': return 'Mark Shipped';
      case 'shipped': return 'Confirm Delivered';
      default: return null;
    }
  }, []);

  const getPaymentMeta = useCallback((order: Order) => {
    const payment = (order.paymentStatus || '').toLowerCase();
    const status = (order.status || '').toLowerCase();

    if (payment === 'refunded') return { label: 'Refunded', color: '#2196F3', icon: 'arrow-undo-circle' as const };
    if (status === 'shipped' || status === 'delivered' || payment === 'paid') {
      return { label: 'Paid', color: '#4CAF50', icon: 'checkmark-circle' as const };
    }
    return { label: 'Pending', color: '#FFA500', icon: 'time' as const };
  }, []);

  const filteredOrders = useMemo(
    () => (activeTab === 'all' ? orders : orders.filter((o) => (o.status || '').toLowerCase() === activeTab)),
    [activeTab, orders]
  );

  const tabCounts = useMemo(() => {
    const counts: Record<TabKey, number> = {
      all: orders.length,
      pending: 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
    };

    orders.forEach((order) => {
      const key = (order.status || '').toLowerCase() as TabKey;
      if (key in counts && key !== 'all') counts[key] += 1;
    });

    return counts;
  }, [orders]);

  const renderOrder = useCallback(({ item }: { item: Order }) => {
    const items = parseItems(item.items);
    const paymentDone = isPaid(item);
    const paymentMeta = getPaymentMeta(item);
    const nextAction = (item.status || '').toLowerCase() === 'processing' && !paymentDone
      ? 'Confirm Payment'
      : getNextAction(item.status);
    const canCancel = ['pending', 'processing'].includes((item.status || '').toLowerCase());
    const canRemindPayment = (item.status || '').toLowerCase() === 'processing' && !paymentDone;
    const buyerPaymentEvent = canRemindPayment ? buyerPaymentEvents[item.$id] : undefined;

    return (
      <View style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View style={styles.orderIdRow}>
            <Text style={styles.orderId}>#{item.$id.slice(-8).toUpperCase()}</Text>
            <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item.status)}20` }]}>
              <Ionicons name={getStatusIcon(item.status) as any} size={14} color={getStatusColor(item.status)} />
              <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </Text>
            </View>
          </View>
          <Text style={styles.orderDate}>
            {new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        </View>

        <View style={styles.itemsContainer}>
          {items.length > 0 ? items.map((orderItem: any, index: number) => (
            <View key={index} style={styles.itemRow}>
              <Text style={styles.itemName} numberOfLines={1}>{orderItem.productName || 'Product'}</Text>
              <Text style={styles.itemQty}>x{orderItem.quantity || 1}</Text>
              <Text style={styles.itemPrice}>₹{orderItem.price || 0}</Text>
            </View>
          )) : (
            <Text style={styles.noItems}>Order details</Text>
          )}
        </View>

        <View style={styles.orderFooter}>
          <View>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalAmount}>₹{item.totalAmount}</Text>
          </View>
          <View style={styles.paymentBadge}>
            <Ionicons name={paymentMeta.icon} size={14} color={paymentMeta.color} />
            <Text style={[styles.paymentText, { color: paymentMeta.color }]}>{paymentMeta.label}</Text>
          </View>
        </View>

        {!!item.deliveryAddress && (
          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={14} color="#999" />
            <Text style={styles.addressText} numberOfLines={2}>{item.deliveryAddress}</Text>
          </View>
        )}

        {(item.status || '').toLowerCase() === 'processing' && paymentDone && (
          <View style={styles.trackingBox}>
            <Text style={styles.trackingLabel}>Courier Service</Text>
            <View style={styles.courierRow}>
              {COURIER_OPTIONS.map((courier) => {
                const selected = (courierInputs[item.$id] || 'India Post') === courier;
                return (
                  <TouchableOpacity
                    key={`${item.$id}-${courier}`}
                    style={[styles.courierChip, selected && styles.courierChipActive]}
                    onPress={() => handleCourierChange(item.$id, courier)}
                  >
                    <Text style={[styles.courierChipText, selected && styles.courierChipTextActive]}>{courier}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.trackingLabel}>Tracking ID / Consignment Number</Text>
            <TextInput
              style={styles.trackingInput}
              value={trackingInputs[item.$id] || ''}
              onChangeText={(text) => handleTrackingChange(item.$id, text)}
              placeholder="Example: SP123456789IN"
              placeholderTextColor="#999"
            />
          </View>
        )}

        {(['shipped', 'delivered'].includes((item.status || '').toLowerCase()) && !!(item.trackingId || item.trackingInfo)) && (
          <View style={styles.addressRow}>
            <Ionicons name="navigate-outline" size={14} color={COLORS.primary} />
            <Text style={[styles.addressText, { color: COLORS.primary }]}>
              {(item.courierName || 'Courier')} • {(item.trackingId || item.trackingInfo)}
            </Text>
          </View>
        )}

        {!!buyerPaymentEvent && (
          <View style={styles.infoPill}>
            <Ionicons name="information-circle-outline" size={14} color={COLORS.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoPillText}>Buyer marked payment as done. Please verify and confirm.</Text>
              <Text style={styles.infoPillTimeText}>Updated {formatRelativeTime(buyerPaymentEvent.createdAt)}</Text>
            </View>
          </View>
        )}

        <View style={styles.actionRow}>
          {!!nextAction && (
            <TouchableOpacity style={styles.actionButton} onPress={() => handleStatusChange(item)}>
              <Ionicons name={canRemindPayment ? 'checkmark-circle-outline' : 'chevron-forward-circle-outline'} size={18} color="#FFF" />
              <Text style={styles.actionButtonText}>{nextAction}</Text>
            </TouchableOpacity>
          )}

          {canRemindPayment && (
            <TouchableOpacity style={styles.remindButton} onPress={() => notifyPaymentNotReceived(item.$id)}>
              <Ionicons name="notifications-outline" size={16} color="#B7791F" />
              <Text style={styles.remindButtonText}>Send Reminder</Text>
            </TouchableOpacity>
          )}

          {canCancel && (
            <TouchableOpacity style={styles.cancelButton} onPress={() => handleCancelOrder(item)}>
              <Ionicons name="close-circle-outline" size={16} color="#C53030" />
              <Text style={styles.cancelButtonText}>{paymentDone ? 'Cancel & Refund' : 'Cancel Order'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }, [
    buyerPaymentEvents,
    confirmPayment,
    courierInputs,
    getNextAction,
    getPaymentMeta,
    getStatusColor,
    getStatusIcon,
    handleCancelOrder,
    handleCourierChange,
    handleStatusChange,
    handleTrackingChange,
    isPaid,
    notifyPaymentNotReceived,
    parseItems,
    trackingInputs,
  ]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PremiumTopBar
        title="Orders"
        subtitle="Process payments, shipping, and delivery updates"
        icon="receipt-outline"
        showBack={navigation.canGoBack()}
        onBack={() => navigation.goBack()}
        rightLabel={refreshing ? 'Refreshing' : 'Refresh'}
        onRightPress={onRefresh}
        rightDisabled={refreshing}
      />

      <View style={styles.tabsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={styles.tabsContent}
        >
          {TABS.map((item) => {
            const count = tabCounts[item.key];
            const isActive = activeTab === item.key;

            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.tab, isActive && styles.activeTab]}
                onPress={() => setActiveTab(item.key)}
                activeOpacity={0.85}
              >
                <Text style={[styles.tabText, isActive && styles.activeTabText]} numberOfLines={1}>
                  {item.label}
                </Text>
                <View style={[styles.tabBadge, isActive && styles.activeTabBadge]}>
                  <Text style={[styles.tabBadgeText, isActive && styles.activeTabBadgeText]}>{count}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.$id}
        renderItem={renderOrder}
        removeClippedSubviews={Platform.OS === 'android'}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        updateCellsBatchingPeriod={90}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={[styles.listContent, { paddingBottom: 16 }]}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>No Orders Yet</Text>
            <Text style={styles.emptySubtext}>
              {activeTab === 'all' ? 'Orders from buyers will appear here' : `No ${activeTab} orders`}
            </Text>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabsContainer: {
    height: 58,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    justifyContent: 'center',
  },
  tabsContent: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    alignItems: 'center',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    paddingHorizontal: 14,
    paddingVertical: 0,
    marginRight: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  activeTab: { backgroundColor: `${COLORS.primary}16`, borderColor: `${COLORS.primary}55` },
  tabText: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  activeTabText: { color: COLORS.primary },
  tabBadge: {
    marginLeft: 6,
    backgroundColor: '#E7E5E4',
    borderRadius: 999,
    height: 20,
    paddingHorizontal: 6,
    minWidth: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeTabBadge: { backgroundColor: COLORS.primary },
  tabBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },
  activeTabBadgeText: { color: '#fff' },
  listContent: { padding: 16 },
  orderCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 15,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  orderHeader: { marginBottom: 12 },
  orderIdRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderId: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 12, gap: 4,
  },
  statusText: { fontSize: 12, fontWeight: '700' },
  orderDate: { fontSize: 11, color: COLORS.textTertiary, marginTop: 4 },
  itemsContainer: {
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.border,
    paddingVertical: 8, marginBottom: 12,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  itemName: { flex: 1, fontSize: 13, color: COLORS.text, fontWeight: '600' },
  itemQty: { fontSize: 12, color: COLORS.textSecondary, marginHorizontal: 12 },
  itemPrice: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  noItems: { fontSize: 12, color: COLORS.textSecondary, fontStyle: 'italic' },
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  totalLabel: { fontSize: 11, color: COLORS.textSecondary },
  totalAmount: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  paymentBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  paymentText: { fontSize: 12, fontWeight: '600' },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 6 },
  addressText: { flex: 1, fontSize: 12, color: COLORS.textSecondary },
  trackingBox: { marginBottom: 12 },
  trackingLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 6 },
  courierRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  courierChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: COLORS.card,
  },
  courierChipActive: { borderColor: COLORS.primary, backgroundColor: `${COLORS.primary}12` },
  courierChipText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '700' },
  courierChipTextActive: { color: COLORS.primary },
  trackingInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: COLORS.text,
    backgroundColor: COLORS.card,
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: `${COLORS.primary}10`,
    marginBottom: 10,
  },
  infoPillText: { flex: 1, fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  infoPillTimeText: { marginTop: 2, fontSize: 11, color: '#5C6F82' },
  actionRow: {
    flexDirection: 'column',
    gap: 8,
    width: '100%',
  },
  actionButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    width: '100%',
    backgroundColor: COLORS.primary, paddingVertical: 12, borderRadius: 10, gap: 8,
  },
  actionButtonText: { color: '#fff', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  remindButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    gap: 8,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F6AD55',
    backgroundColor: '#FFF9F0',
  },
  remindButtonText: { color: '#B7791F', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    gap: 8,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FEB2B2',
    backgroundColor: '#FFF5F5',
  },
  cancelButtonText: { color: '#C53030', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  emptyContainer: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginTop: 16 },
  emptySubtext: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
});

export default SellerOrdersScreen;
