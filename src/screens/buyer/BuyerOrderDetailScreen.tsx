import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Linking,
  useWindowDimensions,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { getOrderById, cancelOrder, notifySellerPaymentSubmitted } from '../../services/orderService';
import { getSellerById } from '../../services/sellerService';
import { getUserById } from '../../services/userService';
import { hasUserReviewedProduct } from '../../services/reviewService';
import { Order } from '../../types/index';
import { formatPrice, formatDateTime, formatRelativeTime } from '../../utils/formatting';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { StatusBadge } from '../../components/StatusBadge';
import { getImageUrl } from '../../services/storageService';
import { appwriteConfig } from '../../config/appwrite';
import { showAlert } from '../../utils/alert';
import { useFocusEffect } from '@react-navigation/native';
import { getUserNotifications } from '../../services/notificationService';
import { getReportsByOrder } from '../../services/adminService';
import { Report } from '../../types/common.types';
import { BUYER_LAYOUT } from '../../constants/layout';

const ORDER_TIMELINE = [
  { key: 'pending', label: 'Order Placed', icon: 'receipt-outline' },
  { key: 'processing', label: 'Processing', icon: 'construct-outline' },
  { key: 'shipped', label: 'Shipped', icon: 'airplane-outline' },
  { key: 'delivered', label: 'Delivered', icon: 'checkmark-circle-outline' },
];

const BuyerOrderDetailScreen = ({ route, navigation }: any) => {
  const tabBarHeight = 16;
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const isCompact = screenHeight < 760;
  const isLargeScreen = screenWidth >= BUYER_LAYOUT.railBreakpoint;
  const wideRailStyle = isLargeScreen ? styles.contentRailWide : undefined;
  const orderId = route?.params?.orderId;
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [sellerPaymentContact, setSellerPaymentContact] = useState<{
    shopName: string;
    phone: string;
    paymentUpiId: string;
    paymentQrImageUrl: string;
    paymentBankAccountName: string;
    paymentBankAccountNumber: string;
    paymentBankIfsc: string;
  }>({
    shopName: '',
    phone: '',
    paymentUpiId: '',
    paymentQrImageUrl: '',
    paymentBankAccountName: '',
    paymentBankAccountNumber: '',
    paymentBankIfsc: '',
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [paymentReminderMeta, setPaymentReminderMeta] = useState<{ message: string; createdAt: string } | null>(null);
  const [hasOpenIssue, setHasOpenIssue] = useState(false);
  const [openIssueReport, setOpenIssueReport] = useState<Report | null>(null);
  const [latestIssueReport, setLatestIssueReport] = useState<Report | null>(null);

  const loadOrder = useCallback(async (showLoader: boolean = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      }
      const data = await getOrderById(orderId);
      setOrder(data);

      if (data?.sellerId) {
        const seller = await getSellerById(data.sellerId);
        if (seller) {
          const sellerUser = await getUserById(seller.userId);
          setSellerPaymentContact({
            shopName: seller.businessName || 'Seller',
            phone: sellerUser?.phone || '',
            paymentUpiId: seller.paymentUpiId || '',
            paymentQrImageUrl: seller.paymentQrImageUrl || '',
            paymentBankAccountName: seller.paymentBankAccountName || '',
            paymentBankAccountNumber: seller.paymentBankAccountNumber || '',
            paymentBankIfsc: seller.paymentBankIfsc || '',
          });
        }
      }

      if (user?.$id && data?.$id) {
        const reports = await getReportsByOrder(data.$id, user.$id);
        const activeReport = reports.find((r) => ['pending', 'investigating'].includes((r.status || '').toLowerCase())) || null;
        const latestReport = reports[0] || null;
        const openIssue = !!activeReport;
        setHasOpenIssue(openIssue);
        setOpenIssueReport(activeReport);
        setLatestIssueReport(latestReport);

        const notificationResult = await getUserNotifications(user.$id, 1, 50);
        const relevant = notificationResult.data.find((n) =>
          n.relatedEntityId === data.$id &&
          n.type === 'order_update' &&
          (n.message || '').toLowerCase().includes('payment not received')
        );

        if (relevant?.message && relevant?.createdAt) {
          setPaymentReminderMeta({ message: relevant.message, createdAt: relevant.createdAt });
        } else {
          setPaymentReminderMeta(null);
        }
      }
    } catch (err) {
      console.error('Error loading order:', err);
      showAlert('Error', 'Failed to load order details');
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, [orderId]);

  useEffect(() => {
    if (orderId) loadOrder();
  }, [orderId, loadOrder]);

  useFocusEffect(
    useCallback(() => {
      if (orderId) {
        loadOrder(false);
      }
    }, [orderId, loadOrder])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadOrder(false);
    } finally {
      setRefreshing(false);
    }
  };

  const handleCancelOrder = () => {
    if (!order) return;
    showAlert('Cancel Order', 'Are you sure you want to cancel this order?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          try {
            await cancelOrder(order.$id);
            await loadOrder();
            showAlert('Cancelled', 'Your order has been cancelled');
          } catch {
            showAlert('Error', 'Failed to cancel order');
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };

  const handleWriteReview = (productId: string, productName: string) => {
    navigation.navigate('WriteReview', { productId, productName });
  };

  const handlePaymentSubmitted = () => {
    if (!order) return;
    showAlert('Confirm Payment Sent', 'Have you completed UPI payment for this order?', [
      { text: 'Not Yet', style: 'cancel' },
      {
        text: 'I Have Paid',
        onPress: async () => {
          try {
            await notifySellerPaymentSubmitted(order.$id);
            showAlert('Notified', 'Seller has been notified to verify your payment.');
          } catch (error: any) {
            showAlert('Error', error?.message || 'Failed to notify seller');
          }
        },
      },
    ]);
  };

  const getTimelineIndex = (status: string) => {
    const idx = ORDER_TIMELINE.findIndex((t) => t.key === status);
    return idx >= 0 ? idx : -1;
  };

  const maskAccountNumber = (value: string) => {
    const trimmed = value.replace(/\s+/g, '');
    if (trimmed.length <= 4) return trimmed;
    return `${'*'.repeat(Math.max(0, trimmed.length - 4))}${trimmed.slice(-4)}`;
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

  if (!orderId) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={COLORS.textTertiary} />
        <Text style={styles.errorText}>Invalid order</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) return <LoadingSpinner fullScreen />;

  if (!order) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="receipt-outline" size={64} color={COLORS.textTertiary} />
        <Text style={styles.errorText}>Order not found</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentStep = getTimelineIndex(order.status);
  const isCancelled = order.status === 'cancelled';
  const isDelivered = order.status === 'delivered';
  const paymentDone =
    order.status === 'shipped' ||
    order.status === 'delivered' ||
    order.paymentStatus === 'paid';
  const paymentRefunded = order.paymentStatus === 'refunded';
  const paymentStageOpen = order.status === 'processing' && !paymentDone && !paymentRefunded;
  const trackingId = order.trackingId || order.trackingInfo;
  const trackingLink = getTrackingLink(order.courierName, trackingId);
  const paymentBadgeStatus = paymentRefunded ? 'refunded' : paymentDone ? 'paid' : 'pending';
  const canMarkPaid = paymentStageOpen;
  const canCancel = ['pending', 'processing'].includes(order.status) && !paymentDone && !paymentRefunded;
  const canRaiseIssue = order.status === 'delivered' && !hasOpenIssue;

  const getIssueStatusMeta = (status?: string) => {
    switch ((status || '').toLowerCase()) {
      case 'pending':
        return { label: 'Pending Review', color: '#A87722', bg: '#FFF8E8', border: '#F6E1B3', icon: 'time-outline' as const };
      case 'investigating':
        return { label: 'Under Investigation', color: '#1E4B7A', bg: '#F5F9FF', border: '#D7E4F2', icon: 'search-outline' as const };
      case 'resolved':
        return { label: 'Resolved', color: '#1C7C54', bg: '#EBF8F2', border: '#BEE8D5', icon: 'checkmark-circle-outline' as const };
      case 'dismissed':
        return { label: 'Closed', color: '#5F6B7A', bg: '#F2F4F7', border: '#D9DEE5', icon: 'close-circle-outline' as const };
      default:
        return { label: 'Submitted', color: '#5F6B7A', bg: '#F2F4F7', border: '#D9DEE5', icon: 'document-text-outline' as const };
    }
  };

  const handleViewExistingIssue = () => {
    const report = openIssueReport || latestIssueReport;
    if (!report) return;
    navigation.navigate('RaiseOrderIssue', {
      order,
      existingReport: report,
      readOnly: true,
    });
  };

  const issueMeta = latestIssueReport ? getIssueStatusMeta(latestIssueReport.status) : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        isCompact && styles.contentCompact,
        { paddingBottom: tabBarHeight },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={COLORS.primary}
          colors={[COLORS.primary]}
        />
      }
    >
      {/* Order ID & Status */}
      <View style={[styles.headerCard, isCompact && styles.cardCompact, wideRailStyle]}>
        <View style={styles.headerTop}>
          <Text style={styles.orderIdLabel}>Order ID</Text>
          <StatusBadge status={order.status} />
        </View>
        <Text style={styles.orderId}>#{order.$id.slice(-8).toUpperCase()}</Text>
        <Text style={styles.orderDate}>
          Placed on {order.createdAt ? formatDateTime(order.createdAt) : 'N/A'}
        </Text>
      </View>

      {!!latestIssueReport && !!issueMeta && (
        <View
          style={[
            styles.issueCard,
            isCompact && styles.cardCompact,
            wideRailStyle,
            { backgroundColor: issueMeta.bg, borderColor: issueMeta.border },
          ]}
        >
          <View style={styles.issueCardTop}>
            <View style={styles.issueStatusRow}>
              <Ionicons name={issueMeta.icon} size={16} color={issueMeta.color} />
              <Text style={[styles.issueStatusTitle, { color: issueMeta.color }]}>{issueMeta.label}</Text>
            </View>
            <TouchableOpacity onPress={handleViewExistingIssue}>
              <Text style={styles.issueCardAction}>View Details</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.issueReason} numberOfLines={2}>{latestIssueReport.reason || 'Delivery issue submitted'}</Text>
          {!!(latestIssueReport.resolvedAt || latestIssueReport.createdAt) && (
            <Text style={styles.issueMetaText}>
              Last updated {formatRelativeTime(latestIssueReport.resolvedAt || latestIssueReport.createdAt)}
            </Text>
          )}
          {!!latestIssueReport.resolution && (
            <Text style={styles.issueResolution} numberOfLines={2}>Admin note: {latestIssueReport.resolution}</Text>
          )}
        </View>
      )}

      {/* Timeline */}
      {!isCancelled && (
        <View style={[styles.timelineCard, isCompact && styles.cardCompact, wideRailStyle]}>
          <Text style={styles.sectionTitle}>Order Status</Text>
          {ORDER_TIMELINE.map((step, idx) => {
            const isCompleted = idx <= currentStep;
            const isCurrent = idx === currentStep;
            return (
              <View key={step.key} style={styles.timelineStep}>
                <View style={styles.timelineLeft}>
                  <View style={[
                    styles.timelineDot,
                    isCompleted && styles.timelineDotCompleted,
                    isCurrent && styles.timelineDotCurrent,
                  ]}>
                    <Ionicons
                      name={step.icon as any}
                      size={16}
                      color={isCompleted ? '#FFF' : COLORS.textTertiary}
                    />
                  </View>
                  {idx < ORDER_TIMELINE.length - 1 && (
                    <View style={[styles.timelineLine, isCompleted && styles.timelineLineCompleted]} />
                  )}
                </View>
                <Text style={[styles.timelineLabel, isCompleted && styles.timelineLabelCompleted]}>
                  {step.label}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {isCancelled && (
        <View style={[styles.cancelledCard, isCompact && styles.cardCompact, wideRailStyle]}>
          <Ionicons name="close-circle" size={32} color={COLORS.error} />
          <Text style={styles.cancelledText}>This order has been cancelled</Text>
        </View>
      )}

      {/* Items */}
      <View style={[styles.sectionCard, isCompact && styles.cardCompact, wideRailStyle]}>
        <Text style={styles.sectionTitle}>Items</Text>
        {(order.items || []).map((item, idx) => {
          const imageUrl = item.productImage
            ? getImageUrl(appwriteConfig.productImagesBucketId, item.productImage)
            : 'https://via.placeholder.com/60';

          return (
            <View key={`${item.productId}-${idx}`} style={styles.itemRow}>
              <Image source={{ uri: imageUrl }} style={styles.itemImage} />
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={1}>{item.productName}</Text>
                <Text style={styles.itemQty}>Qty: {item.quantity} × {formatPrice(item.price)}</Text>
              </View>
              <Text style={styles.itemTotal}>{formatPrice(item.price * item.quantity)}</Text>
            </View>
          );
        })}
        <View style={styles.divider} />
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatPrice(order.totalAmount)}</Text>
        </View>
      </View>

      {/* Delivery Address */}
      <View style={[styles.sectionCard, isCompact && styles.cardCompact, wideRailStyle]}>
        <Text style={styles.sectionTitle}>Delivery Address</Text>
        <Text style={styles.addressText}>{order.deliveryAddress || 'Not provided'}</Text>
      </View>

      {/* Payment */}
      <View style={[styles.sectionCard, isCompact && styles.cardCompact, wideRailStyle]}>
        <Text style={styles.sectionTitle}>Payment</Text>
        <View style={styles.paymentRow}>
          <Ionicons name="cash-outline" size={20} color={COLORS.success} />
          <Text style={styles.paymentMethod}>UPI Payment</Text>
          <StatusBadge status={paymentBadgeStatus} size="small" />
        </View>

        {order.status === 'pending' && !paymentDone && !paymentRefunded && (
          <View style={styles.paymentInfoCard}>
            <Text style={styles.paymentHintStrong}>Waiting for seller acceptance</Text>
            <Text style={styles.paymentHint}>Payment details will appear here after seller accepts your order.</Text>
          </View>
        )}

        {paymentStageOpen && (
          <View style={styles.paymentInfoCard}>
            <Text style={styles.paymentHintStrong}>Order accepted: complete payment now</Text>
            {!!paymentReminderMeta && (
              <View style={styles.paymentAlertBox}>
                <Ionicons name="alert-circle-outline" size={16} color="#B7791F" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.paymentAlertText}>{paymentReminderMeta.message}</Text>
                  <Text style={styles.paymentAlertTimeText}>Updated {formatRelativeTime(paymentReminderMeta.createdAt)}</Text>
                </View>
              </View>
            )}
            <Text style={styles.paymentHint}>Seller: {sellerPaymentContact.shopName || 'Seller'}</Text>

            {!!sellerPaymentContact.paymentUpiId && (
              <Text style={styles.paymentHint}>UPI ID: {sellerPaymentContact.paymentUpiId}</Text>
            )}

            {!!sellerPaymentContact.paymentQrImageUrl && (
              <View style={styles.paymentQrFrame}>
                <Image
                  source={{ uri: sellerPaymentContact.paymentQrImageUrl }}
                  style={styles.paymentQrImage}
                  resizeMode="contain"
                />
              </View>
            )}

            {!!sellerPaymentContact.paymentQrImageUrl && (
              <Text style={styles.paymentHint}>Scan this QR using any UPI app to pay.</Text>
            )}

            {!!sellerPaymentContact.paymentBankAccountName && !!sellerPaymentContact.paymentBankAccountNumber && !!sellerPaymentContact.paymentBankIfsc && (
              <>
                <Text style={styles.paymentHint}>Bank Holder: {sellerPaymentContact.paymentBankAccountName}</Text>
                <Text style={styles.paymentHint}>A/C: {maskAccountNumber(sellerPaymentContact.paymentBankAccountNumber)}</Text>
                <Text style={styles.paymentHint}>IFSC: {sellerPaymentContact.paymentBankIfsc}</Text>
              </>
            )}

            {!sellerPaymentContact.paymentUpiId && !sellerPaymentContact.paymentQrImageUrl && !sellerPaymentContact.paymentBankAccountNumber && (
              <Text style={styles.paymentHint}>Seller has not added payment details yet. Please contact the seller before paying.</Text>
            )}

            {!!sellerPaymentContact.phone && (
              <Text style={styles.paymentHint}>Contact seller: {sellerPaymentContact.phone}</Text>
            )}
          </View>
        )}

        {paymentDone && !paymentRefunded && (
          <View style={styles.paymentInfoCard}>
            <Text style={styles.paymentHintStrong}>Payment confirmed</Text>
            <Text style={styles.paymentHint}>Your order will move to shipping once seller dispatches it.</Text>
          </View>
        )}

        {paymentRefunded && (
          <View style={styles.paymentInfoCard}>
            <Text style={styles.paymentHintStrong}>Payment refunded</Text>
            <Text style={styles.paymentHint}>This order was cancelled and payment has been marked as refunded.</Text>
          </View>
        )}
      </View>

      {(order.status === 'shipped' || order.status === 'delivered') && !!trackingId && (
        <View style={[styles.sectionCard, isCompact && styles.cardCompact, wideRailStyle]}>
          <Text style={styles.sectionTitle}>Shipment Tracking</Text>
          <View style={styles.paymentInfoCard}>
            <Text style={styles.paymentHint}><Text style={styles.paymentHintStrong}>Courier:</Text> {order.courierName || 'Courier'}</Text>
            <View style={styles.trackingIdRow}>
              <Text style={[styles.paymentHint, { flex: 1 }]}>
                <Text style={styles.paymentHintStrong}>Tracking ID:</Text> {trackingId}
              </Text>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={async () => {
                  await Clipboard.setStringAsync(trackingId || '');
                  showAlert('Copied', 'Tracking ID copied to clipboard.');
                }}
              >
                <Ionicons name="copy-outline" size={14} color={COLORS.primary} />
                <Text style={styles.copyButtonText}>Copy</Text>
              </TouchableOpacity>
            </View>
            {!!order.shippingDate && (
              <Text style={styles.paymentHint}><Text style={styles.paymentHintStrong}>Shipped:</Text> {formatDateTime(order.shippingDate)}</Text>
            )}

            {!!trackingLink && (
              <>
                <TouchableOpacity style={styles.trackButton} onPress={() => Linking.openURL(trackingLink)}>
                  <Ionicons name="open-outline" size={16} color="#fff" />
                  <Text style={styles.trackButtonText}>Track Package</Text>
                </TouchableOpacity>

                <View style={styles.trackGuideBox}>
                  <Text style={styles.trackGuideTitle}>How to track</Text>
                  <Text style={styles.trackGuideStep}>1. Tap "Track Package" to open the official {(order.courierName || 'courier')} tracking page.</Text>
                  <Text style={styles.trackGuideStep}>2. Enter Tracking ID: {trackingId}</Text>
                  <Text style={styles.trackGuideStep}>3. Check live shipment updates: booked, in transit, out for delivery, or delivered.</Text>
                </View>
              </>
            )}
          </View>
        </View>
      )}

      {/* Actions */}
      <View style={[styles.actions, isCompact && styles.actionsCompact]}>
        {canMarkPaid && (
          <TouchableOpacity style={styles.reviewButton} onPress={handlePaymentSubmitted}>
            <Ionicons name="card-outline" size={18} color={COLORS.primary} />
            <Text style={styles.reviewButtonText}>I Have Paid</Text>
          </TouchableOpacity>
        )}

        {canCancel && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancelOrder}
            disabled={cancelling}
          >
            {cancelling ? (
              <ActivityIndicator color={COLORS.error} size="small" />
            ) : (
              <>
                <Ionicons name="close-circle-outline" size={20} color={COLORS.error} />
                <Text style={styles.cancelButtonText}>Cancel Order</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {isDelivered && (order.items || []).map((item) => (
          <TouchableOpacity
            key={item.productId}
            style={styles.reviewButton}
            onPress={() => handleWriteReview(item.productId, item.productName)}
          >
            <Ionicons name="star-outline" size={18} color={COLORS.primary} />
            <Text style={styles.reviewButtonText}>Review "{item.productName}"</Text>
          </TouchableOpacity>
        ))}

        {canRaiseIssue && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.navigate('RaiseOrderIssue', { order })}
          >
            <Ionicons name="flag-outline" size={20} color={COLORS.error} />
            <Text style={styles.cancelButtonText}>Raise Delivery Issue</Text>
          </TouchableOpacity>
        )}

        {hasOpenIssue && (
          <>
            <View style={styles.paymentAlertBox}>
              <Ionicons name="information-circle-outline" size={16} color="#A87722" />
              <Text style={styles.paymentAlertText}>Your issue is already submitted and under review by admin.</Text>
            </View>

            <TouchableOpacity style={styles.reviewButton} onPress={handleViewExistingIssue}>
              <Ionicons name="document-text-outline" size={18} color={COLORS.primary} />
              <Text style={styles.reviewButtonText}>View Existing Issue</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16 },
  contentCompact: { paddingHorizontal: 14, paddingVertical: 12 },
  contentRailWide: {
    width: '100%',
    maxWidth: BUYER_LAYOUT.railMaxWidth,
    alignSelf: 'center',
  },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: COLORS.background },
  errorText: { fontSize: 16, color: COLORS.textSecondary, marginTop: 16, marginBottom: 16 },
  retryButton: { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  retryButtonText: { color: '#FFF', fontWeight: '600' },
  headerCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  cardCompact: {
    padding: 14,
    marginBottom: 10,
    borderRadius: 14,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  orderIdLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  orderId: { fontSize: 22, fontWeight: 'bold', color: COLORS.text, marginBottom: 4 },
  orderDate: { fontSize: 13, color: COLORS.textTertiary },
  timelineCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  timelineStep: { flexDirection: 'row', alignItems: 'flex-start', minHeight: 48 },
  timelineLeft: { alignItems: 'center', width: 36 },
  timelineDot: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.background,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.border,
  },
  timelineDotCompleted: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  timelineDotCurrent: { borderColor: COLORS.primary, borderWidth: 3 },
  timelineLine: { width: 2, flex: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  timelineLineCompleted: { backgroundColor: COLORS.success },
  timelineLabel: { fontSize: 14, color: COLORS.textTertiary, marginLeft: 12, marginTop: 6 },
  timelineLabelCompleted: { color: COLORS.text, fontWeight: '600' },
  cancelledCard: {
    backgroundColor: `${COLORS.error}10`, borderRadius: 16, padding: 20, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  cancelledText: { fontSize: 15, fontWeight: '600', color: COLORS.error },
  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  itemImage: { width: 56, height: 56, borderRadius: 10, backgroundColor: COLORS.card },
  itemInfo: { flex: 1, marginLeft: 12 },
  itemName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  itemQty: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  itemTotal: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
  totalValue: { fontSize: 19, fontWeight: 'bold', color: COLORS.primaryDark },
  addressText: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 22 },
  paymentRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  paymentMethod: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.text },
  paymentHintStrong: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  paymentHint: { fontSize: 12, color: COLORS.textSecondary, marginTop: 3 },
  paymentInfoCard: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 12,
    backgroundColor: '#FAFBFC',
    padding: 12,
  },
  paymentAlertBox: {
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#FFF8E8',
    borderWidth: 1,
    borderColor: '#F6E1B3',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  paymentAlertText: { flex: 1, fontSize: 12, color: '#8A5A00' },
  paymentAlertTimeText: { marginTop: 3, fontSize: 11, color: '#A87722', fontWeight: '600' },
  paymentQrFrame: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 8,
    backgroundColor: '#FFFFFF',
  },
  paymentQrImage: {
    width: '100%',
    height: 240,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  trackButton: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 11,
  },
  trackButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  trackingIdRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: `${COLORS.primary}40`,
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: `${COLORS.primary}08`,
  },
  copyButtonText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  trackGuideBox: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#D7E4F2',
    borderRadius: 10,
    backgroundColor: '#F5F9FF',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  trackGuideTitle: { fontSize: 12, fontWeight: '700', color: '#1E4B7A', marginBottom: 6 },
  trackGuideStep: { fontSize: 12, color: '#355C86', lineHeight: 18, marginBottom: 2 },
  issueCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  issueCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  issueStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  issueStatusTitle: { fontSize: 13, fontWeight: '700' },
  issueCardAction: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  issueReason: { marginTop: 8, fontSize: 13, color: COLORS.text, fontWeight: '600' },
  issueMetaText: { marginTop: 4, fontSize: 12, color: COLORS.textSecondary },
  issueResolution: { marginTop: 6, fontSize: 12, color: COLORS.textSecondary, lineHeight: 18 },
  actions: { gap: 12, marginTop: 4 },
  actionsCompact: { gap: 10 },
  cancelButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.error,
    backgroundColor: `${COLORS.error}08`,
  },
  cancelButtonText: { fontSize: 15, fontWeight: '600', color: COLORS.error },
  reviewButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}08`,
  },
  reviewButtonText: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
});

export default BuyerOrderDetailScreen;
