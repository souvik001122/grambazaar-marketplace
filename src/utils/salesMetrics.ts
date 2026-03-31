export const normalizeOrderStatusForMetrics = (status?: string): string => {
  const normalized = (status || '').toLowerCase();

  switch (normalized) {
    case 'payment_pending':
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

export const normalizePaymentStatusForMetrics = (
  paymentStatus?: string,
  orderStatus?: string
): string => {
  const normalized = (paymentStatus || '').toLowerCase();
  const status = normalizeOrderStatusForMetrics(orderStatus);

  if (normalized === 'refunded') {
    return 'refunded';
  }

  if (status === 'cancelled' && (normalized === 'paid' || normalized === 'success')) {
    return 'refunded';
  }

  if (status === 'shipped' || status === 'delivered') {
    return 'paid';
  }

  if (normalized === 'success' || normalized === 'paid' || normalized === 'payment_confirmed') {
    return 'paid';
  }

  if (normalized === 'failed') {
    return 'failed';
  }

  return 'pending';
};

export const isCompletedSale = (order: { status?: string; paymentStatus?: string }): boolean => {
  const status = normalizeOrderStatusForMetrics(order.status);
  const payment = normalizePaymentStatusForMetrics(order.paymentStatus, status);
  return status === 'delivered' && payment === 'paid';
};
