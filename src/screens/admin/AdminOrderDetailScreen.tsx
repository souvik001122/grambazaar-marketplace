import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { updateOrderStatus, updateOrderPaymentStatus } from '../../services/orderService';
import { createAdminLog } from '../../services/adminService';
import { COLORS } from '../../constants/colors';
import { showAlert } from '../../utils/alert';

const STATUS_FLOW = ['pending', 'processing', 'shipped', 'delivered'];

const AdminOrderDetailScreen = ({ route, navigation }: any) => {
  const tabBarHeight = 16;
  const { user } = useAuth();
  const [order, setOrder] = useState(route?.params?.order);
  const [processing, setProcessing] = useState(false);

  if (!order) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <Ionicons name="alert-circle-outline" size={60} color={COLORS.textTertiary} />
        <Text style={{ fontSize: 16, color: COLORS.text, marginTop: 12 }}>Order data not available</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: COLORS.primary, borderRadius: 8 }}>
          <Text style={{ color: '#FFF', fontWeight: '600' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

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

  const isPaid = (ord: any) => {
    const payment = (ord?.paymentStatus || '').toLowerCase();
    const status = (ord?.status || '').toLowerCase();
    if (status === 'shipped' || status === 'delivered') return true;
    return payment === 'paid';
  };

  const getPaymentLabel = (ord: any) => {
    const payment = (ord?.paymentStatus || '').toLowerCase();
    if (payment === 'refunded') return 'Refunded';
    return isPaid(ord) ? 'Paid' : 'Pending';
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTrackingLink = (courierName?: string, trackingId?: string) => {
    const id = (trackingId || '').trim();
    if (!id) return '';

    switch ((courierName || '').toLowerCase()) {
      case 'india post':
        return 'https://www.indiapost.gov.in';
      case 'dtdc':
        return 'https://www.dtdc.com/track-your-shipment';
      case 'blue dart':
        return 'https://www.bluedart.com/tracking';
      case 'delhivery':
        return 'https://www.delhivery.com/tracking';
      default:
        return '';
    }
  };

  const statusLabel = (s: string) => (s || '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  const handleStatusChange = (newStatus: string) => {
    showAlert('Update Status', `Change order status to "${statusLabel(newStatus)}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Update',
        onPress: async () => {
          setProcessing(true);
          try {
            const updated = await updateOrderStatus(order.$id, newStatus);
            setOrder(updated);
            await createAdminLog(user!.$id, 'update_order_status', 'order', order.$id, `Status → ${statusLabel(newStatus)}`);
            showAlert('Success', `Order status updated to ${statusLabel(newStatus)}.`);
          } catch {
            showAlert('Error', 'Failed to update order status.');
          } finally {
            setProcessing(false);
          }
        },
      },
    ]);
  };

  const handleCancel = () => {
    showAlert('Cancel Order', 'Are you sure you want to cancel this order?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cancel Order',
        style: 'destructive',
        onPress: async () => {
          setProcessing(true);
          try {
            const updated = await updateOrderStatus(order.$id, 'cancelled');
            setOrder(updated);
            await createAdminLog(user!.$id, 'cancel_order', 'order', order.$id, 'Order cancelled by admin');
            showAlert('Done', 'Order has been cancelled.');
          } catch {
            showAlert('Error', 'Failed to cancel order.');
          } finally {
            setProcessing(false);
          }
        },
      },
    ]);
  };

  const handleConfirmPayment = () => {
    showAlert('Confirm Payment', 'Mark this order payment as paid?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm Paid',
        onPress: async () => {
          setProcessing(true);
          try {
            const updated = await updateOrderPaymentStatus(order.$id, 'paid');
            setOrder(updated);
            await createAdminLog(user!.$id, 'confirm_payment', 'order', order.$id, 'Payment -> Paid');
            showAlert('Success', 'Payment marked as paid.');
          } catch {
            showAlert('Error', 'Failed to update payment status.');
          } finally {
            setProcessing(false);
          }
        },
      },
    ]);
  };

  const handleMarkRefunded = () => {
    showAlert('Mark Refunded', 'Confirm manual UPI refund has been completed?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark Refunded',
        onPress: async () => {
          setProcessing(true);
          try {
            const updated = await updateOrderPaymentStatus(order.$id, 'refunded');
            setOrder(updated);
            await createAdminLog(user!.$id, 'mark_refunded', 'order', order.$id, 'Payment -> Refunded');
            showAlert('Success', 'Payment marked as refunded.');
          } catch {
            showAlert('Error', 'Failed to update refund status.');
          } finally {
            setProcessing(false);
          }
        },
      },
    ]);
  };

  const currentStatusIdx = STATUS_FLOW.indexOf(order.status);
  const paymentDone = isPaid(order);
  const paymentRefunded = (order.paymentStatus || '').toLowerCase() === 'refunded';
  const items = Array.isArray(order.items) ? order.items : [];
  const trackingId = order.trackingId || order.trackingInfo;
  const trackingLink = getTrackingLink(order.courierName, trackingId);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: tabBarHeight }}>
      {/* Order Header */}
      <View style={styles.headerCard}>
        <Text style={styles.orderId}>Order #{(order.$id || '').substring(0, 10).toUpperCase()}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) + '18' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
            {statusLabel(order.status)}
          </Text>
        </View>
        <Text style={styles.orderDate}>{formatDate(order.createdAt)}</Text>
      </View>

      {/* Status Timeline */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Order Progress</Text>
        <View style={styles.timeline}>
          {STATUS_FLOW.map((status, idx) => {
            const isCompleted = idx <= currentStatusIdx;
            const isCurrent = idx === currentStatusIdx;
            return (
              <View key={status} style={styles.timelineStep}>
                <View style={styles.timelineLeft}>
                  <View style={[
                    styles.timelineDot,
                    isCompleted && styles.timelineDotCompleted,
                    isCurrent && styles.timelineDotCurrent,
                  ]}>
                    {isCompleted && <Ionicons name="checkmark" size={12} color="#FFF" />}
                  </View>
                  {idx < STATUS_FLOW.length - 1 && (
                    <View style={[styles.timelineLine, isCompleted && styles.timelineLineCompleted]} />
                  )}
                </View>
                <Text style={[
                  styles.timelineLabel,
                  isCompleted && styles.timelineLabelCompleted,
                  isCurrent && styles.timelineLabelCurrent,
                ]}>
                  {statusLabel(status)}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Items */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Items ({items.length})</Text>
        {items.map((item: any, idx: number) => (
          <View key={idx} style={styles.itemRow}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.productName || 'Product'}</Text>
              <Text style={styles.itemMeta}>Qty: {item.quantity} × ₹{item.price}</Text>
            </View>
            <Text style={styles.itemTotal}>₹{(item.quantity * item.price).toLocaleString('en-IN')}</Text>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total Amount</Text>
          <Text style={styles.totalValue}>₹{order.totalAmount?.toLocaleString('en-IN')}</Text>
        </View>
      </View>

      {/* Payment Info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Payment</Text>
        <View style={styles.infoRow}>
          <Ionicons name="card-outline" size={16} color={COLORS.primary} />
          <Text style={styles.infoText}>Status: {getPaymentLabel(order)}</Text>
        </View>
        {order.paymentId && (
          <View style={styles.infoRow}>
            <Ionicons name="key-outline" size={16} color={COLORS.primary} />
            <Text style={styles.infoText}>Payment ID: {order.paymentId}</Text>
          </View>
        )}
      </View>

      {/* Delivery */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Delivery</Text>
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={16} color={COLORS.primary} />
          <Text style={styles.infoText}>{order.deliveryAddress || 'No address provided'}</Text>
        </View>
        {!!trackingId && (
          <View style={styles.infoRow}>
            <Ionicons name="navigate-outline" size={16} color={COLORS.primary} />
            <Text style={styles.infoText}>Tracking: {trackingId}</Text>
          </View>
        )}
        {!!order.courierName && (
          <View style={styles.infoRow}>
            <Ionicons name="cube-outline" size={16} color={COLORS.primary} />
            <Text style={styles.infoText}>Courier: {order.courierName}</Text>
          </View>
        )}
        {!!order.shippingDate && (
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={16} color={COLORS.primary} />
            <Text style={styles.infoText}>Shipping Date: {formatDate(order.shippingDate)}</Text>
          </View>
        )}
        {!!trackingLink && (
          <TouchableOpacity style={styles.trackButton} onPress={() => Linking.openURL(trackingLink)}>
            <Ionicons name="open-outline" size={16} color="#FFF" />
            <Text style={styles.trackButtonText}>Track Shipment</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* IDs */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Parties</Text>
        <View style={styles.infoRow}>
          <Ionicons name="person-outline" size={16} color={COLORS.primary} />
          <Text style={styles.infoText}>Buyer ID: {order.buyerId}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="storefront-outline" size={16} color={COLORS.primary} />
          <Text style={styles.infoText}>Seller ID: {order.sellerId}</Text>
        </View>
      </View>

      {/* Admin Actions */}
      {order.status !== 'delivered' && order.status !== 'refunded' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Admin Actions</Text>
          {processing ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <View style={styles.adminActions}>
              {order.status === 'processing' && !paymentDone && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.nextBtn]}
                  onPress={handleConfirmPayment}
                >
                  <Ionicons name="card-outline" size={16} color="#FFF" />
                  <Text style={styles.actionBtnTextLight}> Confirm Payment</Text>
                </TouchableOpacity>
              )}
              {order.status === 'cancelled' && !paymentRefunded && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.nextBtn]}
                  onPress={handleMarkRefunded}
                >
                  <Ionicons name="arrow-undo-outline" size={16} color="#FFF" />
                  <Text style={styles.actionBtnTextLight}> Mark Refunded</Text>
                </TouchableOpacity>
              )}
              {order.status !== 'cancelled' && currentStatusIdx < STATUS_FLOW.length - 1 && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.nextBtn]}
                  onPress={() => handleStatusChange(STATUS_FLOW[currentStatusIdx + 1])}
                >
                  <Ionicons name="arrow-forward" size={16} color="#FFF" />
                  <Text style={styles.actionBtnTextLight}> Move to {statusLabel(STATUS_FLOW[currentStatusIdx + 1])}</Text>
                </TouchableOpacity>
              )}
              {order.status !== 'cancelled' && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.cancelBtn]}
                  onPress={handleCancel}
                >
                  <Ionicons name="close-circle-outline" size={16} color={COLORS.error} />
                  <Text style={[styles.actionBtnText, { color: COLORS.error }]}> Cancel Order</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}

      <View style={{ height: 30 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerCard: {
    backgroundColor: COLORS.primary,
    padding: 20,
    alignItems: 'center',
  },
  orderId: { fontSize: 18, fontWeight: '700', color: '#FFF', marginBottom: 8 },
  statusBadge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 12, marginBottom: 8 },
  statusText: { fontSize: 14, fontWeight: '700' },
  orderDate: { fontSize: 12, color: '#FFF', opacity: 0.8 },
  card: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  timeline: { paddingLeft: 4 },
  timelineStep: { flexDirection: 'row', alignItems: 'flex-start', minHeight: 36 },
  timelineLeft: { alignItems: 'center', width: 24 },
  timelineDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineDotCompleted: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  timelineDotCurrent: {
    borderColor: COLORS.primary,
    borderWidth: 3,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: COLORS.border,
    minHeight: 16,
  },
  timelineLineCompleted: {
    backgroundColor: COLORS.success,
  },
  timelineLabel: {
    fontSize: 13,
    color: COLORS.textTertiary,
    marginLeft: 12,
    paddingTop: 2,
  },
  timelineLabelCompleted: {
    color: COLORS.text,
  },
  timelineLabelCurrent: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  itemMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  itemTotal: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    marginTop: 4,
  },
  totalLabel: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  totalValue: { fontSize: 18, fontWeight: '700', color: COLORS.primary },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  infoText: { fontSize: 13, color: COLORS.text, flex: 1 },
  adminActions: { gap: 10 },
  trackButton: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 11,
  },
  trackButtonText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  nextBtn: { backgroundColor: COLORS.primary },
  cancelBtn: { backgroundColor: COLORS.error + '12', borderWidth: 1, borderColor: COLORS.error + '30' },
  actionBtnText: { fontSize: 14, fontWeight: '600' },
  actionBtnTextLight: { fontSize: 14, fontWeight: '600', color: '#FFF' },
});

export default AdminOrderDetailScreen;
