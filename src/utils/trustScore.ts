import { Seller } from '../types/seller.types';

export interface SellerTrustMetrics {
  avgRating?: number;
  totalReviews?: number;
  totalOrders?: number;
  deliveredOrders?: number;
  cancelledOrders?: number;
  totalProducts?: number;
  activeProducts?: number;
  totalViews?: number;
}

export interface TrustScoreBreakdownItem {
  key: 'verification' | 'reviews' | 'complaints' | 'activity';
  label: string;
  points: number;
  maxPoints: number;
  kind: 'positive' | 'negative';
  note: string;
}

export interface TrustScoreBreakdown {
  total: number;
  items: TrustScoreBreakdownItem[];
}

const buildTrustBreakdown = (
  seller: Seller,
  metrics: SellerTrustMetrics = {}
): TrustScoreBreakdown => {
  const avgRating = metrics.avgRating ?? seller.rating ?? 0;
  const totalReviews = metrics.totalReviews ?? 0;
  const totalOrders = metrics.totalOrders ?? seller.totalOrders ?? 0;
  const deliveredOrders = metrics.deliveredOrders ?? totalOrders;
  const cancelledOrders = metrics.cancelledOrders ?? 0;
  const totalProducts = metrics.totalProducts ?? 0;
  const activeProducts = metrics.activeProducts ?? totalProducts;
  const totalViews = metrics.totalViews ?? 0;

  let verificationPoints = 0;
  if (seller.verificationStatus === 'approved') {
    verificationPoints = 25;
  } else if (seller.verificationStatus === 'pending') {
    verificationPoints = 12;
  } else if (seller.verificationStatus === 'blocked') {
    verificationPoints = 2;
  }

  const baselineRating = 3.5;
  const confidenceFloor = 5;
  const weightedRating =
    totalReviews > 0
      ? ((avgRating * totalReviews) + (baselineRating * confidenceFloor)) /
        (totalReviews + confidenceFloor)
      : baselineRating;

  const ratingQualityPoints = Math.max(0, Math.min(25, ((weightedRating - 1) / 4) * 25));
  const reviewConfidencePoints = Math.min(8, (totalReviews / 20) * 8);
  const reviewPoints = Math.min(33, ratingQualityPoints + reviewConfidencePoints);

  const complaintRate =
    totalOrders > 0 ? Math.max(0, Math.min(1, cancelledOrders / totalOrders)) : 0;
  const complaintPenalty = complaintRate * 16 + (seller.verificationStatus === 'blocked' ? 4 : 0);

  const catalogPoints =
    totalProducts > 0
      ? Math.min(10, Math.min(1, totalProducts / 6) * 10) +
        Math.min(8, Math.max(0, Math.min(1, activeProducts / totalProducts)) * 8)
      : 3;
  const deliveryPoints =
    totalOrders > 0
      ? Math.max(0, Math.min(4, Math.max(0, Math.min(1, deliveredOrders / totalOrders)) * 4))
      : 2;
  const engagementPoints = Math.min(4, (totalViews / 250) * 4);
  const activityPoints = Math.min(22, catalogPoints + deliveryPoints + engagementPoints);

  const total = Math.max(
    0,
    Math.min(100, Math.round(verificationPoints + reviewPoints + activityPoints - complaintPenalty))
  );

  return {
    total,
    items: [
      {
        key: 'verification',
        label: 'Verification',
        points: Math.round(verificationPoints),
        maxPoints: 25,
        kind: 'positive',
        note:
          seller.verificationStatus === 'approved'
            ? 'KYC and seller profile approved'
            : seller.verificationStatus === 'pending'
            ? 'Verification in progress'
            : 'Verification still weak',
      },
      {
        key: 'reviews',
        label: 'Reviews',
        points: Math.round(reviewPoints),
        maxPoints: 33,
        kind: 'positive',
        note: `${Math.max(0, avgRating).toFixed(1)} rating with ${totalReviews} review${totalReviews === 1 ? '' : 's'}`,
      },
      {
        key: 'complaints',
        label: 'Complaints',
        points: Math.round(complaintPenalty),
        maxPoints: 20,
        kind: 'negative',
        note:
          complaintPenalty > 0
            ? `${Math.round(complaintRate * 100)}% cancellation/issue risk impact`
            : 'No complaint penalty detected',
      },
      {
        key: 'activity',
        label: 'Activity',
        points: Math.round(activityPoints),
        maxPoints: 22,
        kind: 'positive',
        note: `${totalProducts} product${totalProducts === 1 ? '' : 's'}, ${totalOrders} order${totalOrders === 1 ? '' : 's'}`,
      },
    ],
  };
};

/**
 * Calculate trust score for a seller using verification, fulfillment,
 * rating confidence, catalog health, and buyer engagement.
 */
export const calculateTrustScore = (
  seller: Seller,
  metrics: SellerTrustMetrics = {}
): number => {
  return buildTrustBreakdown(seller, metrics).total;
};

export const getTrustScoreBreakdown = (
  seller: Seller,
  metrics: SellerTrustMetrics = {}
): TrustScoreBreakdown => {
  return buildTrustBreakdown(seller, metrics);
};

export const isTopArtisan = (
  seller: Seller,
  metrics: SellerTrustMetrics = {}
): boolean => {
  const score = calculateTrustScore(seller, metrics);
  const avgRating = metrics.avgRating ?? seller.rating ?? 0;
  const totalOrders = metrics.totalOrders ?? seller.totalOrders ?? 0;

  return (
    seller.verificationStatus === 'approved' &&
    score >= 85 &&
    avgRating >= 4.4 &&
    totalOrders >= 15
  );
};

/**
 * Get trust score label
 */
export const getTrustLabel = (score: number): string => {
  if (score >= 80) return 'Excellent';
  if (score >= 50) return 'High';
  return 'Low';
};

/**
 * Get trust score description
 */
export const getTrustDescription = (score: number): string => {
  if (score >= 80) return 'Highly trusted seller with strong performance and fulfillment';
  if (score >= 50) return 'Trusted seller with growing reputation';
  return 'Seller needs stronger ratings, activity, or fulfillment history';
};

/**
 * Check if seller can list products
 */
export const canSellerListProducts = (seller: Seller): boolean => {
  return seller.verificationStatus === 'approved';
};

/**
 * Check if seller is in good standing
 */
export const isSellerInGoodStanding = (seller: Seller): boolean => {
  return (
    seller.verificationStatus === 'approved' &&
    (seller.rating || 0) >= 2.0
  );
};
