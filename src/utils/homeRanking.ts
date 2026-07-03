import { Product } from '../types/product.types';
import { Seller } from '../types/seller.types';
import { calculateTrustScore, isTopArtisan } from './trustScore';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PRODUCT_PRIOR = 4.0;
const DEFAULT_SELLER_PRIOR = 4.0;
const PRODUCT_BAYES_MIN_VOTES = 20;
const SELLER_BAYES_MIN_VOTES = 25;

const toFiniteNumber = (value: unknown, fallback: number = 0): number => {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const safeParseTime = (value?: string): number => {
  if (!value) return 0;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
};

const getProductReviewCount = (product: Product): number =>
  Math.max(0, Math.floor(toFiniteNumber(product.reviewCount)));

const getProductViews = (product: Product): number =>
  Math.max(0, Math.floor(toFiniteNumber(product.views)));

const getProductRating = (product: Product): number =>
  clamp(toFiniteNumber(product.rating), 0, 5);

const getProductRecencyTimestamp = (product: Product): number => {
  const createdAtMs = safeParseTime(product.createdAt);
  const updatedAtMs = safeParseTime(product.updatedAt);
  return Math.max(createdAtMs, updatedAtMs);
};

const getSellerRating = (seller: Seller): number =>
  clamp(toFiniteNumber(seller.rating), 0, 5);

const getSellerOrderCount = (seller: Seller): number =>
  Math.max(0, Math.floor(toFiniteNumber(seller.totalOrders)));

const getSellerRecencyTimestamp = (seller: Seller): number => {
  const createdAtMs = safeParseTime(seller.createdAt);
  const updatedAtMs = safeParseTime(seller.updatedAt);
  return Math.max(createdAtMs, updatedAtMs);
};

const getWeightedProductPrior = (products: Product[]): number => {
  let weightedTotal = 0;
  let voteTotal = 0;

  for (const product of products) {
    const votes = getProductReviewCount(product);
    if (votes <= 0) continue;

    weightedTotal += getProductRating(product) * votes;
    voteTotal += votes;
  }

  if (voteTotal > 0) {
    return clamp(weightedTotal / voteTotal, 1, 5);
  }

  const fallbackCandidates = products
    .map(getProductRating)
    .filter((rating) => rating > 0);

  if (fallbackCandidates.length > 0) {
    const avg = fallbackCandidates.reduce((sum, value) => sum + value, 0) / fallbackCandidates.length;
    return clamp(avg, 1, 5);
  }

  return DEFAULT_PRODUCT_PRIOR;
};

const getWeightedSellerPrior = (sellers: Seller[]): number => {
  let weightedTotal = 0;
  let voteTotal = 0;

  for (const seller of sellers) {
    const votes = getSellerOrderCount(seller);
    if (votes <= 0) continue;

    weightedTotal += getSellerRating(seller) * votes;
    voteTotal += votes;
  }

  if (voteTotal > 0) {
    return clamp(weightedTotal / voteTotal, 1, 5);
  }

  const fallbackCandidates = sellers
    .map(getSellerRating)
    .filter((rating) => rating > 0);

  if (fallbackCandidates.length > 0) {
    const avg = fallbackCandidates.reduce((sum, value) => sum + value, 0) / fallbackCandidates.length;
    return clamp(avg, 1, 5);
  }

  return DEFAULT_SELLER_PRIOR;
};

const computeBayesianAverage = (
  rating: number,
  votes: number,
  prior: number,
  minimumVotes: number
): number => {
  const safeVotes = Math.max(0, votes);
  const safePriorVotes = Math.max(1, minimumVotes);
  return ((rating * safeVotes) + (prior * safePriorVotes)) / (safeVotes + safePriorVotes);
};

const compareProductsByQuality = (a: Product, b: Product): number => {
  const reviewDiff = getProductReviewCount(b) - getProductReviewCount(a);
  if (reviewDiff !== 0) return reviewDiff;

  const ratingDiff = getProductRating(b) - getProductRating(a);
  if (ratingDiff !== 0) return ratingDiff;

  const viewDiff = getProductViews(b) - getProductViews(a);
  if (viewDiff !== 0) return viewDiff;

  const recencyDiff = getProductRecencyTimestamp(b) - getProductRecencyTimestamp(a);
  if (recencyDiff !== 0) return recencyDiff;

  return a.$id.localeCompare(b.$id);
};

const compareProductsByRecency = (a: Product, b: Product): number => {
  const recencyDiff = getProductRecencyTimestamp(b) - getProductRecencyTimestamp(a);
  if (recencyDiff !== 0) return recencyDiff;

  const ratingDiff = getProductRating(b) - getProductRating(a);
  if (ratingDiff !== 0) return ratingDiff;

  const viewDiff = getProductViews(b) - getProductViews(a);
  if (viewDiff !== 0) return viewDiff;

  return a.$id.localeCompare(b.$id);
};

export const rankProductsByBestRated = (products: Product[]): Product[] => {
  if (!Array.isArray(products) || products.length === 0) {
    return [];
  }

  const priorRating = getWeightedProductPrior(products);

  const scored = products.map((product) => {
    const reviewCount = getProductReviewCount(product);
    const rating = getProductRating(product);
    const views = getProductViews(product);
    const trustScore = clamp(toFiniteNumber((product as any).sellerTrustScore, 50), 0, 100);
    const bayesianRating = computeBayesianAverage(
      rating,
      reviewCount,
      priorRating,
      PRODUCT_BAYES_MIN_VOTES
    );

    const confidenceBoost = (1 - Math.exp(-reviewCount / 28)) * 0.12;
    const trustBoost = ((trustScore - 50) / 50) * 0.12;
    const engagementBoost = Math.min(0.08, Math.log1p(views) / 120);

    const score = bayesianRating + confidenceBoost + trustBoost + engagementBoost;
    return { product, score };
  });

  scored.sort((left, right) => {
    const scoreDiff = right.score - left.score;
    if (scoreDiff !== 0) return scoreDiff;
    return compareProductsByQuality(left.product, right.product);
  });

  return scored.map((entry) => entry.product);
};

export const rankProductsByTrending = (
  products: Product[],
  nowMs: number = Date.now()
): Product[] => {
  if (!Array.isArray(products) || products.length === 0) {
    return [];
  }

  const priorRating = getWeightedProductPrior(products);

  const scored = products.map((product) => {
    const reviewCount = getProductReviewCount(product);
    const views = getProductViews(product);
    const rating = getProductRating(product);
    const bayesianRating = computeBayesianAverage(
      rating,
      reviewCount,
      priorRating,
      Math.max(8, Math.floor(PRODUCT_BAYES_MIN_VOTES / 2))
    );

    const eventMs = getProductRecencyTimestamp(product) || (nowMs - DAY_MS * 30);
    const ageDays = Math.max(0, (nowMs - eventMs) / DAY_MS);

    const engagement = Math.log1p(views + reviewCount * 45);
    const recencyDecay = Math.exp(-ageDays / 18);
    const confidence = 1 - Math.exp(-reviewCount / 22);
    const qualityMultiplier = 0.65 + (bayesianRating / 5) * 0.55 + confidence * 0.2;
    const freshnessLift = ageDays <= 3 ? 0.25 : ageDays <= 7 ? 0.12 : 0;

    const score = engagement * recencyDecay * qualityMultiplier + freshnessLift;
    return { product, score };
  });

  scored.sort((left, right) => {
    const scoreDiff = right.score - left.score;
    if (scoreDiff !== 0) return scoreDiff;

    const viewDiff = getProductViews(right.product) - getProductViews(left.product);
    if (viewDiff !== 0) return viewDiff;

    return compareProductsByRecency(left.product, right.product);
  });

  return scored.map((entry) => entry.product);
};

export const rankProductsByFreshArrivals = (products: Product[]): Product[] => {
  if (!Array.isArray(products) || products.length === 0) {
    return [];
  }

  return [...products].sort(compareProductsByRecency);
};

export const rankSellersForTopArtisans = (sellers: Seller[]): Seller[] => {
  if (!Array.isArray(sellers) || sellers.length === 0) {
    return [];
  }

  const priorRating = getWeightedSellerPrior(sellers);

  const scored = sellers.map((seller) => {
    const trustScore = calculateTrustScore(seller);
    const rating = getSellerRating(seller);
    const totalOrders = getSellerOrderCount(seller);
    const bayesianRating = computeBayesianAverage(
      rating,
      totalOrders,
      priorRating,
      SELLER_BAYES_MIN_VOTES
    );

    const orderConfidence = 1 - Math.exp(-totalOrders / 35);
    const qualityPoints = (bayesianRating / 5) * 20;
    const volumeBonus = Math.min(12, Math.log1p(totalOrders) * 2.1);
    const verificationBonus =
      seller.verificationStatus === 'approved'
        ? 8
        : seller.verificationStatus === 'pending'
        ? -4
        : seller.verificationStatus === 'blocked'
        ? -30
        : -10;
    const topArtisanBonus = isTopArtisan(seller) ? 4 : 0;
    const activityBonus = seller.isShopActive ? 2 : -4;

    const score =
      trustScore * 0.62 +
      qualityPoints +
      volumeBonus +
      verificationBonus +
      topArtisanBonus +
      activityBonus +
      orderConfidence * 4;

    return { seller, score, trustScore };
  });

  scored.sort((left, right) => {
    const scoreDiff = right.score - left.score;
    if (scoreDiff !== 0) return scoreDiff;

    const trustDiff = right.trustScore - left.trustScore;
    if (trustDiff !== 0) return trustDiff;

    const ordersDiff = getSellerOrderCount(right.seller) - getSellerOrderCount(left.seller);
    if (ordersDiff !== 0) return ordersDiff;

    const ratingDiff = getSellerRating(right.seller) - getSellerRating(left.seller);
    if (ratingDiff !== 0) return ratingDiff;

    const recencyDiff = getSellerRecencyTimestamp(right.seller) - getSellerRecencyTimestamp(left.seller);
    if (recencyDiff !== 0) return recencyDiff;

    return left.seller.$id.localeCompare(right.seller.$id);
  });

  return scored.map((entry) => entry.seller);
};
