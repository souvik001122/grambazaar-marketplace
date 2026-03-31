import { ID, Query } from 'appwrite';
import { databases, appwriteConfig } from '../config/appwrite';
import { Order, OrderItem } from '../types/index';
import { sendNotification } from './notificationService';
import { getSellerById } from './sellerService';
import { isCompletedSale } from '../utils/salesMetrics';

const PAYMENT_PENDING = 'pending';
const PAYMENT_PAID = 'paid';
const PAYMENT_REFUNDED = 'refunded';

const normalizeOrderStatus = (status?: string): string => {
  const normalized = (status || '').toLowerCase();
  switch (normalized) {
    case 'payment_pending':
      return 'processing';
    case 'payment_confirmed':
      return 'processing';
    case 'pending':
    case 'processing':
    case 'shipped':
    case 'delivered':
    case 'cancelled':
    case 'refunded':
      return normalized;
    default:
      return 'pending';
  }
};

const normalizePaymentStatus = (paymentStatus?: string, orderStatus?: string): string => {
  const normalized = (paymentStatus || '').toLowerCase();
  const status = normalizeOrderStatus(orderStatus);

  if (normalized === PAYMENT_REFUNDED) {
    return PAYMENT_REFUNDED;
  }

  if (status === 'cancelled' && (normalized === 'paid' || normalized === 'success')) {
    return PAYMENT_REFUNDED;
  }

  if (status === 'shipped' || status === 'delivered') {
    return PAYMENT_PAID;
  }

  if (normalized === 'success' || normalized === PAYMENT_PAID || normalized === 'payment_confirmed') {
    return PAYMENT_PAID;
  }

  if (normalized === 'failed') {
    return 'failed';
  }

  return PAYMENT_PENDING;
};

const canTransitionOrderStatus = (currentStatus: string, newStatus: string): boolean => {
  if (currentStatus === newStatus) return true;

  const transitions: Record<string, string[]> = {
    pending: ['processing', 'cancelled'],
    processing: ['shipped', 'cancelled'],
    shipped: ['delivered'],
    delivered: [],
    cancelled: [],
    refunded: [],
  };

  return (transitions[currentStatus] || []).includes(newStatus);
};

const syncSellerOrderCount = async (sellerId: string): Promise<void> => {
  const response = await databases.listDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.ordersCollectionId,
    [Query.equal('sellerId', sellerId), Query.limit(1)]
  );

  await databases.updateDocument(
    appwriteConfig.databaseId,
    appwriteConfig.sellersCollectionId,
    sellerId,
    {
      totalOrders: response.total,
      updatedAt: new Date().toISOString(),
    }
  ).catch(() => {});
};

/**
 * Get orders for a seller
 */
export const getSellerOrders = async (
  sellerId: string,
  limit: number = 50
): Promise<Order[]> => {
  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.ordersCollectionId,
      [
        Query.equal('sellerId', sellerId),
        Query.orderDesc('createdAt'),
        Query.limit(limit),
      ]
    );
    return response.documents.map(parseOrderDocument) as unknown as Order[];
  } catch (error) {
    console.error('Error fetching seller orders:', error);
    return [];
  }
};

/**
 * Get orders for a buyer
 */
export const getBuyerOrders = async (
  buyerId: string,
  limit: number = 50
): Promise<Order[]> => {
  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.ordersCollectionId,
      [
        Query.equal('buyerId', buyerId),
        Query.orderDesc('createdAt'),
        Query.limit(limit),
      ]
    );
    return response.documents.map(parseOrderDocument) as unknown as Order[];
  } catch (error) {
    console.error('Error fetching buyer orders:', error);
    return [];
  }
};

/**
 * Get order by ID
 */
export const getOrderById = async (orderId: string): Promise<Order | null> => {
  try {
    const doc = await databases.getDocument(
      appwriteConfig.databaseId,
      appwriteConfig.ordersCollectionId,
      orderId
    );
    return parseOrderDocument(doc) as unknown as Order;
  } catch (error) {
    console.error('Error fetching order:', error);
    return null;
  }
};

/**
 * Create a new order
 */
export const createOrder = async (data: {
  buyerId: string;
  sellerId: string;
  items: OrderItem[];
  totalAmount: number;
  deliveryAddress: string;
  paymentStatus?: string;
}): Promise<Order> => {
  try {
    const now = new Date().toISOString();
    const doc = await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.ordersCollectionId,
      ID.unique(),
      {
        buyerId: data.buyerId,
        sellerId: data.sellerId,
        items: JSON.stringify(data.items),
        totalAmount: data.totalAmount,
        status: 'pending',
        paymentStatus: data.paymentStatus || 'pending',
        deliveryAddress: data.deliveryAddress,
        createdAt: now,
        updatedAt: now,
      }
    );

    await syncSellerOrderCount(data.sellerId);

    // Notify seller (look up seller doc to get user ID)
    const seller = await getSellerById(data.sellerId);
    if (seller) {
      await sendNotification(
        seller.userId,
        `New order received! Amount: ₹${data.totalAmount}`,
        'order',
        doc.$id,
        'order'
      ).catch(() => {});
    }

    return parseOrderDocument(doc) as unknown as Order;
  } catch (error) {
    console.error('Error creating order:', error);
    throw new Error('Failed to create order');
  }
};

/**
 * Update order status
 */
export const updateOrderStatus = async (
  orderId: string,
  newStatus: string
): Promise<Order> => {
  try {
    const existing = await databases.getDocument(
      appwriteConfig.databaseId,
      appwriteConfig.ordersCollectionId,
      orderId
    );
    const currentOrder = parseOrderDocument(existing);

    const currentStatus = normalizeOrderStatus(currentOrder.status);
    const targetStatus = normalizeOrderStatus(newStatus);
    const paymentStatus = normalizePaymentStatus(currentOrder.paymentStatus, currentStatus);

    if (!canTransitionOrderStatus(currentStatus, targetStatus)) {
      throw new Error(`Invalid status transition: ${currentStatus} -> ${targetStatus}`);
    }

    if ((targetStatus === 'shipped' || targetStatus === 'delivered') && paymentStatus !== PAYMENT_PAID) {
      throw new Error('Payment must be confirmed before shipping or delivery');
    }

    const nextPaymentStatus = targetStatus === 'cancelled'
      ? (paymentStatus === PAYMENT_PAID ? PAYMENT_REFUNDED : PAYMENT_PENDING)
      : normalizePaymentStatus(paymentStatus, targetStatus);

    const doc = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.ordersCollectionId,
      orderId,
      {
        status: targetStatus,
        paymentStatus: nextPaymentStatus,
        updatedAt: new Date().toISOString(),
      }
    );

    // Notify buyer about status change
    const order = parseOrderDocument(doc);
    await syncSellerOrderCount(order.sellerId);
    await sendNotification(
      order.buyerId,
      `Your order status has been updated to: ${targetStatus}`,
      'order',
      orderId,
      'order'
    ).catch(() => {});

    return order as unknown as Order;
  } catch (error) {
    console.error('Error updating order status:', error);
    throw error instanceof Error ? error : new Error('Failed to update order status');
  }
};

/**
 * Confirm or update order payment status
 */
export const updateOrderPaymentStatus = async (
  orderId: string,
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded' = 'paid'
): Promise<Order> => {
  try {
    const existing = await databases.getDocument(
      appwriteConfig.databaseId,
      appwriteConfig.ordersCollectionId,
      orderId
    );
    const currentOrder = parseOrderDocument(existing);
    const currentStatus = normalizeOrderStatus(currentOrder.status);
    const currentPayment = normalizePaymentStatus(currentOrder.paymentStatus, currentStatus);

    if (currentStatus === 'cancelled' && paymentStatus === PAYMENT_PAID) {
      throw new Error('Cancelled orders cannot be marked as paid');
    }

    if (paymentStatus === PAYMENT_PENDING && currentPayment === PAYMENT_PAID) {
      throw new Error('Paid status cannot be reverted to pending');
    }

    if (paymentStatus === PAYMENT_PAID && currentStatus === 'pending') {
      throw new Error('Order must be accepted before confirming payment');
    }

    if (paymentStatus === PAYMENT_REFUNDED && currentStatus !== 'cancelled') {
      throw new Error('Refund can only be marked on cancelled orders');
    }

    const targetPayment = normalizePaymentStatus(paymentStatus, currentStatus);
    const doc = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.ordersCollectionId,
      orderId,
      {
        paymentStatus: targetPayment,
        updatedAt: new Date().toISOString(),
      }
    );

    const order = parseOrderDocument(doc);
    await sendNotification(
      order.buyerId,
      `Your payment has been marked as ${targetPayment}.`,
      'order_update',
      orderId,
      'order'
    ).catch(() => {});

    return order as unknown as Order;
  } catch (error) {
    console.error('Error updating order payment status:', error);
    throw error instanceof Error ? error : new Error('Failed to update payment status');
  }
};

/**
 * Buyer marks payment done (seller still needs to verify)
 */
export const notifySellerPaymentSubmitted = async (orderId: string): Promise<void> => {
  try {
    const order = await getOrderById(orderId);
    if (!order) throw new Error('Order not found');
    if (normalizeOrderStatus(order.status) !== 'processing') {
      throw new Error('Payment can be marked only for processing orders');
    }

    const seller = await getSellerById(order.sellerId);
    if (seller) {
      await sendNotification(
        seller.userId,
        `Buyer marked payment done for order #${order.$id.slice(-8).toUpperCase()}. Please verify in your UPI app.`,
        'order_update',
        order.$id,
        'order'
      );
    }
  } catch (error) {
    console.error('Error notifying seller for payment submission:', error);
    throw error instanceof Error ? error : new Error('Failed to notify seller');
  }
};

/**
 * Seller marks payment not received and reminds buyer
 */
export const notifyBuyerPaymentPending = async (orderId: string): Promise<void> => {
  try {
    const order = await getOrderById(orderId);
    if (!order) throw new Error('Order not found');
    if (normalizeOrderStatus(order.status) !== 'processing') {
      throw new Error('Payment reminder is valid only for processing orders');
    }

    await sendNotification(
      order.buyerId,
      `Payment not received for order #${order.$id.slice(-8).toUpperCase()}. Please complete payment to continue shipment.`,
      'order_update',
      order.$id,
      'order'
    );
  } catch (error) {
    console.error('Error notifying buyer for pending payment:', error);
    throw error instanceof Error ? error : new Error('Failed to notify buyer');
  }
};

/**
 * Seller ships order with mandatory tracking info
 */
export const shipOrderWithTracking = async (
  orderId: string,
  shipping: {
    courierName: 'India Post' | 'DTDC' | 'Blue Dart' | 'Delhivery' | 'Other';
    trackingId: string;
  }
): Promise<Order> => {
  try {
    const tracking = (shipping?.trackingId || '').trim();
    const courierName = (shipping?.courierName || '').trim();

    if (!courierName) {
      throw new Error('Courier service is required before shipping');
    }

    if (!tracking) {
      throw new Error('Tracking ID is required before shipping');
    }

    const existing = await databases.getDocument(
      appwriteConfig.databaseId,
      appwriteConfig.ordersCollectionId,
      orderId
    );
    const currentOrder = parseOrderDocument(existing);

    if (normalizeOrderStatus(currentOrder.status) !== 'processing') {
      throw new Error('Only processing orders can be shipped');
    }

    const paymentStatus = normalizePaymentStatus(currentOrder.paymentStatus, currentOrder.status);
    if (paymentStatus !== PAYMENT_PAID) {
      throw new Error('Payment must be confirmed before shipping');
    }

    const doc = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.ordersCollectionId,
      orderId,
      {
        status: 'shipped',
        paymentStatus: PAYMENT_PAID,
        courierName,
        trackingId: tracking,
        shippingDate: new Date().toISOString(),
        trackingInfo: tracking,
        updatedAt: new Date().toISOString(),
      }
    );

    const order = parseOrderDocument(doc);
    await sendNotification(
      order.buyerId,
      `Your order has been shipped via ${courierName}. Tracking ID: ${tracking}`,
      'order_update',
      orderId,
      'order'
    ).catch(() => {});

    return order as unknown as Order;
  } catch (error) {
    console.error('Error shipping order with tracking:', error);
    throw error instanceof Error ? error : new Error('Failed to ship order');
  }
};

/**
 * Cancel order
 */
export const cancelOrder = async (orderId: string, reason?: string): Promise<Order> => {
  try {
    const existing = await databases.getDocument(
      appwriteConfig.databaseId,
      appwriteConfig.ordersCollectionId,
      orderId
    );
    const currentOrder = parseOrderDocument(existing);
    const paymentStatus = normalizePaymentStatus(currentOrder.paymentStatus, currentOrder.status);
    const nextPaymentStatus = paymentStatus === PAYMENT_PAID ? PAYMENT_REFUNDED : PAYMENT_PENDING;

    const doc = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.ordersCollectionId,
      orderId,
      {
        status: 'cancelled',
        paymentStatus: nextPaymentStatus,
        updatedAt: new Date().toISOString(),
      }
    );
    const order = parseOrderDocument(doc);
    await syncSellerOrderCount(order.sellerId);
    return order as unknown as Order;
  } catch (error) {
    console.error('Error cancelling order:', error);
    throw new Error('Failed to cancel order');
  }
};

/**
 * Get order count for seller
 */
export const getSellerOrderCount = async (sellerId: string): Promise<number> => {
  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.ordersCollectionId,
      [
        Query.equal('sellerId', sellerId),
        Query.limit(1),
      ]
    );
    return response.total;
  } catch (error) {
    return 0;
  }
};

/**
 * Get seller revenue
 */
export const getSellerRevenue = async (sellerId: string): Promise<number> => {
  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.ordersCollectionId,
      [
        Query.equal('sellerId', sellerId),
        Query.limit(500),
      ]
    );
    return response.documents.reduce((sum: number, doc: any) => {
      const parsed = parseOrderDocument(doc);
      return sum + (isCompletedSale(parsed) ? (parsed.totalAmount || 0) : 0);
    }, 0);
  } catch (error) {
    return 0;
  }
};

/**
 * Parse order document — handles `items` being JSON string or array
 */
const parseOrderDocument = (doc: any): any => {
  let items = doc.items;
  if (typeof items === 'string') {
    try {
      items = JSON.parse(items);
    } catch {
      items = [];
    }
  }
  const status = normalizeOrderStatus(doc.status);
  const paymentStatus = normalizePaymentStatus(doc.paymentStatus, status);
  const courierName = doc.courierName || undefined;
  const trackingId = doc.trackingId || doc.trackingInfo || undefined;
  const shippingDate = doc.shippingDate || undefined;

  return {
    ...doc,
    status,
    paymentStatus,
    courierName,
    trackingId,
    shippingDate,
    trackingInfo: trackingId,
    items: items || [],
  };
};
