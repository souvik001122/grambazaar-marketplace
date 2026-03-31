import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  BackHandler,
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

  const isPaid = (order: Order) => {
    const payment = (order.paymentStatus || '').toLowerCase();
    const status = (order.status || '').toLowerCase();
    if (status === 'shipped' || status === 'delivered') return true;
    return payment === 'paid';
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await updateOrder(orderId, newStatus);
      showAlert('Success', `Order marked as ${newStatus}`);
      await loadOrders();
    } catch (error: any) {
      showAlert('Error', error?.message || 'Failed to update order status');
    }
  };

  const confirmPayment = async (orderId: string) => {
    try {
      await updateOrderPaymentStatus(orderId, 'paid');
      showAlert('Success', 'Payment confirmed as paid');
      await loadOrders();
    } catch (error: any) {
      showAlert('Error', error?.message || 'Failed to confirm payment');
    }
  };

  const notifyPaymentNotReceived = async (orderId: string) => {
    try {
      await notifyBuyerPaymentPending(orderId);
      showAlert('Reminder Sent', 'Buyer has been notified to complete payment.');
      await loadOrders();
    } catch (error: any) {
      showAlert('Error', error?.message || 'Failed to notify buyer');
    }
  };

  const handleTrackingChange = (orderId: string, value: string) => {
    setTrackingInputs((prev) => ({ ...prev, [orderId]: value }));
  };

  const handleCourierChange = (orderId: string, courier: CourierName) => {
    setCourierInputs((prev) => ({ ...prev, [orderId]: courier }));
  };

  const handleStatusChange = (order: Order) => {
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
  };

  const handleCancelOrder = (order: Order) => {
    const paid = isPaid(order);
    const title = paid ? 'Cancel & Refund?' : 'Cancel Order?';
    const message = paid
      ? 'Payment is marked paid. Cancelling will mark this order as refunded.'
      : 'Are you sure you want to cancel this order?';

    showAlert(title, message, [
      { text: 'No', style: 'cancel' },
      { text: 'Yes, Cancel', style: 'destructive', onPress: () => updateOrderStatus(order.$id, 'cancelled') },
    ]);
  };

  const parseItems = (rawItems: any[] | string) => {
    try {
      if (Array.isArray(rawItems)) return rawItems;
      if (typeof rawItems === 'string') return JSON.parse(rawItems);
      return [];
    } catch {
      return [];
    }
  };

  const getStatusColor = (status: string) => {
    switch ((status || '').toLowerCase()) {
      case 'pending': return '#FFA500';
      case 'processing': return '#2196F3';
      case 'shipped': return '#9C27B0';
      case 'delivered': return '#4CAF50';
      case 'cancelled': return '#FF4444';
      case 'refunded': return '#FF9800';
      default: return '#999';
    }
  };

  const getStatusIcon = (status: string) => {
    switch ((status || '').toLowerCase()) {
      case 'pending': return 'time-outline';
      case 'processing': return 'construct-outline';
      case 'shipped': return 'car-outline';
      case 'delivered': return 'checkmark-circle-outline';
      case 'cancelled': return 'close-circle-outline';
      default: return 'help-circle-outline';
    }
  };

  const getNextAction = (status: string): string | null => {
    switch ((status || '').toLowerCase()) {
      case 'pending': return 'Accept Order';
      case 'processing': return 'Mark Shipped';
      case 'shipped': return 'Confirm Delivered';
      default: return null;
    }
  };

  const getPaymentMeta = (order: Order) => {
    const payment = (order.paymentStatus || '').toLowerCase();
    const status = (order.status || '').toLowerCase();

    if (payment === 'refunded') return { label: 'Refunded', color: '#2196F3', icon: 'arrow-undo-circle' as const };
    if (status === 'shipped' || status === 'delivered' || payment === 'paid') {
      return { label: 'Paid', color: '#4CAF50', icon: 'checkmark-circle' as const };
    }
    return { label: 'Pending', color: '#FFA500', icon: 'time' as const };
  };

  const filteredOrders = activeTab === 'all'
    ? orders
    : orders.filter((o) => (o.status || '').toLowerCase() === activeTab);

  const renderOrder = ({ item }: { item: Order }) => {
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
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        horizontal
        data={TABS}
        keyExtractor={(item) => item.key}
        showsHorizontalScrollIndicator={false}
        bounces={false}
        style={styles.tabsContainer}
        contentContainerStyle={styles.tabsContent}
        renderItem={({ item }) => {
          const count = item.key === 'all'
            ? orders.length
            : orders.filter((o) => (o.status || '').toLowerCase() === item.key).length;
          return (
            <TouchableOpacity
              style={[styles.tab, activeTab === item.key && styles.activeTab]}
              onPress={() => setActiveTab(item.key)}
            >
              <Text style={[styles.tabText, activeTab === item.key && styles.activeTabText]} numberOfLines={1}>
                {item.label}
              </Text>
              {count > 0 && (
                <View style={[styles.tabBadge, activeTab === item.key && styles.activeTabBadge]}>
                  <Text style={[styles.tabBadgeText, activeTab === item.key && styles.activeTabBadgeText]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />

      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.$id}
        renderItem={renderOrder}
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
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabsContainer: { maxHeight: 52, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  tabsContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  activeTab: { backgroundColor: COLORS.primary },
  tabText: { fontSize: 13, fontWeight: '500', color: '#666' },
  activeTabText: { color: '#fff' },
  tabBadge: {
    marginLeft: 6,
    backgroundColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: 'center',
  },
  activeTabBadge: { backgroundColor: 'rgba(255,255,255,0.3)' },
  tabBadgeText: { fontSize: 11, fontWeight: '600', color: '#666' },
  activeTabBadgeText: { color: '#fff' },
  listContent: { padding: 16 },
  orderCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08,
    shadowRadius: 4, elevation: 3,
  },
  orderHeader: { marginBottom: 12 },
  orderIdRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderId: { fontSize: 15, fontWeight: '700', color: '#333' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 12, gap: 4,
  },
  statusText: { fontSize: 12, fontWeight: '600' },
  orderDate: { fontSize: 12, color: '#999', marginTop: 4 },
  itemsContainer: {
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#f0f0f0',
    paddingVertical: 8, marginBottom: 12,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  itemName: { flex: 1, fontSize: 14, color: '#333' },
  itemQty: { fontSize: 13, color: '#999', marginHorizontal: 12 },
  itemPrice: { fontSize: 14, fontWeight: '600', color: '#333' },
  noItems: { fontSize: 13, color: '#999', fontStyle: 'italic' },
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  totalLabel: { fontSize: 12, color: '#999' },
  totalAmount: { fontSize: 18, fontWeight: '700', color: '#333' },
  paymentBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  paymentText: { fontSize: 12, fontWeight: '600' },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 6 },
  addressText: { flex: 1, fontSize: 12, color: '#999' },
  trackingBox: { marginBottom: 12 },
  trackingLabel: { fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 6 },
  courierRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  courierChip: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#F8FAFC',
  },
  courierChipActive: { borderColor: COLORS.primary, backgroundColor: `${COLORS.primary}12` },
  courierChipText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  courierChipTextActive: { color: COLORS.primary },
  trackingInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#333',
    backgroundColor: '#fafafa',
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
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginTop: 16 },
  emptySubtext: { fontSize: 14, color: '#999', marginTop: 4 },
});

export default SellerOrdersScreen;
