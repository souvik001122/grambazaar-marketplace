import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  Linking,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { getSellerById } from '../../services/sellerService';
import { getProductsBySeller } from '../../services/productService';
import { getSellerReviews } from '../../services/reviewService';
import { Seller } from '../../types/seller.types';
import { Product } from '../../types/product.types';
import { Review } from '../../types/common.types';
import { ProductCard } from '../../components/ProductCard';
import { StarRating } from '../../components/StarRating';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { PremiumImage } from '../../components/PremiumImage';
import { getStateName } from '../../constants/regions';
import { calculateTrustScore, getTrustDescription, getTrustScoreBreakdown, isTopArtisan } from '../../utils/trustScore';
import { normalizeImageList, resolveImageUrl } from '../../services/storageService';
import { appwriteConfig } from '../../config/appwrite';
import { BUYER_LAYOUT } from '../../constants/layout';
import { formatRelativeTime } from '../../utils/formatting';

const toRadians = (value: number) => (value * Math.PI) / 180;

const getDistanceKm = (
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): number => {
  const earthRadiusKm = 6371;
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(fromLat)) *
      Math.cos(toRadians(toLat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  return earthRadiusKm * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const getReviewContextTag = (comment?: string): string | null => {
  const text = (comment || '').toLowerCase();
  if (!text) return null;

  const visitedSignals = ['visited', 'visit', 'shop', 'store', 'in person', 'offline'];
  const deliverySignals = ['delivery', 'delivered', 'online order', 'courier', 'shipping'];

  if (visitedSignals.some((word) => text.includes(word))) {
    return 'Visited shop';
  }

  if (deliverySignals.some((word) => text.includes(word))) {
    return 'Online delivery';
  }

  return null;
};

const INVALID_LOCATION_LABELS = new Set([
  'na',
  'n/a',
  'none',
  'null',
  'undefined',
  'unknown',
  'not available',
  '-',
]);

const sanitizeLocationLabel = (value?: string): string => {
  const normalized = (value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (INVALID_LOCATION_LABELS.has(normalized.toLowerCase())) {
    return '';
  }
  return normalized;
};

const addUniqueLocationPart = (parts: string[], value?: string) => {
  const trimmed = sanitizeLocationLabel(value);
  if (!trimmed) return;

  const alreadyExists = parts.some((part) => part.toLowerCase() === trimmed.toLowerCase());
  if (!alreadyExists) {
    parts.push(trimmed);
  }
};

const getSellerStandardAddressLabel = (seller: Seller): string => {
  const fullParts: string[] = [];
  addUniqueLocationPart(fullParts, seller.address);
  addUniqueLocationPart(fullParts, seller.village);
  addUniqueLocationPart(fullParts, seller.city);
  addUniqueLocationPart(fullParts, seller.district);
  addUniqueLocationPart(fullParts, getStateName(seller.state));

  const fullLabel = fullParts.join(', ');
  if (fullLabel && fullLabel.length <= 76) {
    return fullLabel;
  }

  const compactParts: string[] = [];
  addUniqueLocationPart(compactParts, seller.city || seller.district || seller.village);
  addUniqueLocationPart(compactParts, getStateName(seller.state));
  return compactParts.join(', ') || 'India';
};

const SellerProfileScreen = ({ route, navigation }: any) => {
  const tabBarHeight = 16;
  const { width: screenWidth } = useWindowDimensions();
  const isLargeScreen = screenWidth >= BUYER_LAYOUT.railBreakpoint;
  const railStyle = isLargeScreen ? styles.contentRailWide : undefined;
  const sellerId = route?.params?.sellerId;
  const [seller, setSeller] = useState<Seller | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [sellerReviewTotal, setSellerReviewTotal] = useState(0);
  const [sellerDistanceKm, setSellerDistanceKm] = useState<number | null>(null);

  useEffect(() => {
    if (sellerId) loadSeller();
  }, [sellerId]);

  const loadSeller = async () => {
    try {
      setLoading(true);
      const [sellerData, sellerProducts, sellerReviews] = await Promise.all([
        getSellerById(sellerId),
        getProductsBySeller(sellerId, 'active'),
        getSellerReviews(sellerId, 1, 6).catch(() => ({ data: [] as Review[], total: 0, page: 1, perPage: 6, hasMore: false })),
      ]);
      setSeller(sellerData);
      setProducts(sellerProducts);
      setReviews(sellerReviews.data);
      setSellerReviewTotal(sellerReviews.total || 0);
    } catch (err) {
      console.error('Error loading seller:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const resolveSellerDistance = async () => {
      setSellerDistanceKm(null);

      if (
        !seller ||
        typeof seller.latitude !== 'number' ||
        typeof seller.longitude !== 'number' ||
        Number.isNaN(seller.latitude) ||
        Number.isNaN(seller.longitude)
      ) {
        return;
      }

      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
          return;
        }

        const currentPosition = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const km = getDistanceKm(
          currentPosition.coords.latitude,
          currentPosition.coords.longitude,
          seller.latitude,
          seller.longitude
        );

        setSellerDistanceKm(Number.isFinite(km) ? Number(km.toFixed(1)) : null);
      } catch {
        setSellerDistanceKm(null);
      }
    };

    resolveSellerDistance();
  }, [seller]);

  const navigateToBuyerTab = (tabName: string, params?: any) => {
    const parent = navigation.getParent?.();
    if (parent?.navigate) {
      parent.navigate(tabName, params);
      return;
    }
    navigation.navigate(tabName, params);
  };

  const openSellerMap = async () => {
    if (!seller) return;

    const hasCoordinates =
      typeof seller.latitude === 'number' &&
      typeof seller.longitude === 'number' &&
      !Number.isNaN(seller.latitude) &&
      !Number.isNaN(seller.longitude);

    const placeText = [seller.businessName, seller.address, seller.city, seller.district, seller.state]
      .filter(Boolean)
      .join(', ');

    const mapUrl = hasCoordinates
      ? `https://www.google.com/maps?q=${seller.latitude},${seller.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeText)}`;

    const canOpen = await Linking.canOpenURL(mapUrl);
    if (!canOpen) {
      return;
    }

    await Linking.openURL(mapUrl);
  };

  const openSellerDirections = async () => {
    if (!seller) return;

    const hasCoordinates =
      typeof seller.latitude === 'number' &&
      typeof seller.longitude === 'number' &&
      !Number.isNaN(seller.latitude) &&
      !Number.isNaN(seller.longitude);

    const destination = hasCoordinates
      ? `${seller.latitude},${seller.longitude}`
      : encodeURIComponent([seller.businessName, seller.address, seller.city, seller.district, seller.state]
          .filter(Boolean)
          .join(', '));

    const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
    const canOpen = await Linking.canOpenURL(directionsUrl);
    if (!canOpen) {
      return;
    }

    await Linking.openURL(directionsUrl);
  };

  const callSeller = async () => {
    if (!seller?.phone) {
      return;
    }

    const phoneUrl = `tel:${seller.phone}`;
    const canOpen = await Linking.canOpenURL(phoneUrl);
    if (!canOpen) {
      return;
    }

    await Linking.openURL(phoneUrl);
  };

  const whatsappSeller = async () => {
    if (!seller?.phone) {
      return;
    }

    const digits = seller.phone.replace(/\D/g, '');
    const intl = digits.length === 10 ? `91${digits}` : digits;
    const message = encodeURIComponent(`Hi ${seller.businessName}, I want to know more about your products.`);
    const waUrl = `https://wa.me/${intl}?text=${message}`;

    const canOpen = await Linking.canOpenURL(waUrl);
    if (!canOpen) {
      return;
    }

    await Linking.openURL(waUrl);
  };

  if (!sellerId) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={COLORS.textTertiary} />
        <Text style={styles.errorText}>Invalid seller</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) return <LoadingSpinner fullScreen />;

  if (!seller) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="storefront-outline" size={64} color={COLORS.textTertiary} />
        <Text style={styles.errorText}>Seller not found</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const trustScore = calculateTrustScore(seller, { totalReviews: sellerReviewTotal });
  const trustDescription = getTrustDescription(trustScore);
  const trustBreakdown = getTrustScoreBreakdown(seller, { totalReviews: sellerReviewTotal });
  const topArtisan = isTopArtisan(seller, { totalReviews: sellerReviewTotal });
  const isVerifiedSeller = !!seller.verifiedBadge || seller.verificationStatus === 'approved';
  const sellerAddressLabel = getSellerStandardAddressLabel(seller);
  const sellerTrustTagLabel = isVerifiedSeller
    ? 'Verified seller'
    : trustScore >= 80
      ? 'Trusted seller'
      : 'Buyer protection';
  const sellerPreviewImage = resolveImageUrl(
    appwriteConfig.documentsBucketId,
    normalizeImageList(seller.verificationDocuments)[0]
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: tabBarHeight }} showsVerticalScrollIndicator={false}>
      {/* Shop Header */}
      <View style={[styles.header, railStyle]}>
        {navigation.canGoBack() && (
          <TouchableOpacity style={styles.headerBackButton} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={20} color="#FFF" />
          </TouchableOpacity>
        )}

        <PremiumImage
          uri={sellerPreviewImage}
          style={styles.shopImage}
          resizeMode="cover"
          variant="shop"
        />
        <View style={styles.headerInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.shopName}>{seller.businessName}</Text>
            {isVerifiedSeller && (
              <Ionicons name="checkmark-circle" size={20} color={COLORS.verified} />
            )}
          </View>
          <View style={styles.headerBadgeRow}>
            <View style={styles.craftTypeChip}>
              <Ionicons name="hammer-outline" size={12} color={COLORS.primaryDark} />
              <Text style={styles.craftTypeChipText}>{seller.craftType}</Text>
            </View>
            {topArtisan && (
              <View style={styles.topArtisanChip}>
                <Ionicons name="ribbon-outline" size={12} color="#92400E" />
                <Text style={styles.topArtisanChipText}>Top Artisan</Text>
              </View>
            )}
          </View>
          <View style={styles.headerTagRow}>
            <View style={[styles.headerTag, styles.headerAddressTag]}>
              <Ionicons name="location-outline" size={12} color={COLORS.primary} />
              <Text style={[styles.headerTagText, styles.headerAddressText]}>
                {sellerAddressLabel}
              </Text>
            </View>
            <View style={[styles.headerTag, styles.headerTrustTag]}>
              <Ionicons
                name={isVerifiedSeller ? 'shield-checkmark-outline' : 'shield-outline'}
                size={12}
                color={COLORS.secondaryDark}
              />
              <Text style={[styles.headerTagText, styles.headerTrustTagText]}>{sellerTrustTagLabel}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={[styles.trustInsightCard, railStyle]}>
        <View style={styles.trustInsightTop}>
          <Text style={styles.trustInsightHeaderTitle}>Why you can trust this seller</Text>
        </View>
        <View style={styles.trustHero}>
          <Text style={styles.trustHeroLabel}>Trust Score</Text>
          <Text style={styles.trustHeroScore}>{trustScore} / 100</Text>
          <Text style={styles.trustHeroHint}>Powered by verification, buyer reviews, and seller activity</Text>
        </View>
        <Text style={styles.trustInsightText}>{trustDescription}</Text>

        <View style={styles.trustReasonRow}>
          <Ionicons name="checkmark-circle" size={15} color={COLORS.verified} />
          <Text style={styles.trustReasonText}>Government ID verified</Text>
        </View>
        <View style={styles.trustReasonRow}>
          <Ionicons name="location-outline" size={15} color={COLORS.primary} />
          <Text style={styles.trustReasonText}>
            Shop location verified
            {sellerDistanceKm !== null ? ` (${sellerDistanceKm} km away)` : ''}
          </Text>
        </View>
        <View style={styles.trustReasonRow}>
          <Ionicons name="star-outline" size={15} color={COLORS.warning} />
          <Text style={styles.trustReasonText}>
            {Math.max(0, seller.rating || 0).toFixed(1)} star rating from real buyer{sellerReviewTotal === 1 ? '' : 's'}
          </Text>
        </View>
        <View style={styles.trustReasonRow}>
          <Ionicons name="lock-closed-outline" size={15} color={COLORS.secondaryDark} />
          <Text style={styles.trustReasonText}>Safe in-app ordering available</Text>
        </View>

        <View style={styles.breakdownCard}>
          <Text style={styles.breakdownTitle}>Trust score breakdown</Text>
          {trustBreakdown.items.map((item) => (
            <View key={item.key} style={styles.breakdownRow}>
              <View style={styles.breakdownLabelWrap}>
                <View style={styles.breakdownTitleRow}>
                  <Text style={styles.breakdownLabel}>{item.label}</Text>
                  <Text
                    style={[
                      styles.breakdownValue,
                      item.kind === 'negative' ? styles.breakdownNegative : styles.breakdownPositive,
                    ]}
                  >
                    {Math.round((Math.max(0, Math.min(item.maxPoints, item.points)) / item.maxPoints) * 100)}%
                  </Text>
                </View>
                <View style={styles.breakdownBarTrack}>
                  <View
                    style={[
                      styles.breakdownBarFill,
                      item.kind === 'negative' ? styles.breakdownBarNegative : styles.breakdownBarPositive,
                      { width: `${Math.round((Math.max(0, Math.min(item.maxPoints, item.points)) / item.maxPoints) * 100)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.breakdownNote}>{item.note}</Text>
              </View>
            </View>
          ))}
          <Text style={styles.breakdownTotal}>Total trust score: {trustBreakdown.total}/100</Text>
        </View>

        <TouchableOpacity
          style={styles.localityButton}
          onPress={() =>
            navigateToBuyerTab('Explore', {
              screen: 'ExploreMain',
              params: {
                state: seller.state,
                district: seller.district || seller.city || '',
                village: seller.village || '',
                autoExplore: true,
              },
            })
          }
        >
          <Ionicons name="compass-outline" size={16} color="#FFF" />
          <Text style={styles.localityButtonText}>Browse Nearby Artisans</Text>
        </TouchableOpacity>

        <View style={styles.mapActionsRow}>
          <TouchableOpacity style={styles.mapActionButton} onPress={openSellerMap}>
            <Ionicons name="map-outline" size={15} color={COLORS.primary} />
            <Text style={styles.mapActionText}>View on Map</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mapActionButton} onPress={openSellerDirections}>
            <Ionicons name="navigate-outline" size={15} color={COLORS.primary} />
            <Text style={styles.mapActionText}>Get Directions</Text>
          </TouchableOpacity>
          {!!seller.phone && (
            <TouchableOpacity style={styles.mapActionButton} onPress={callSeller}>
              <Ionicons name="call-outline" size={15} color={COLORS.primary} />
              <Text style={styles.mapActionText}>Call</Text>
            </TouchableOpacity>
          )}
          {!!seller.phone && (
            <TouchableOpacity style={styles.mapActionButton} onPress={whatsappSeller}>
              <Ionicons name="logo-whatsapp" size={15} color={COLORS.primary} />
              <Text style={styles.mapActionText}>WhatsApp</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Stats */}
      <View style={[styles.statsRow, railStyle]}>
        <View style={styles.statCard}>
          <View style={styles.statIconWrap}>
            <Ionicons name="cube-outline" size={14} color={COLORS.primaryDark} />
          </View>
          <Text style={styles.statValue}>{products.length}</Text>
          <Text style={styles.statLabel}>Products</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIconWrap}>
            <Ionicons name="receipt-outline" size={14} color={COLORS.primaryDark} />
          </View>
          <Text style={styles.statValue}>{seller.totalOrders || 0}</Text>
          <Text style={styles.statLabel}>Orders</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIconWrap}>
            <Ionicons name="star" size={14} color={COLORS.warning} />
          </View>
          <View style={styles.ratingRow}>
            <Text style={styles.statValue}>{seller.rating?.toFixed(1) || '0.0'}</Text>
          </View>
          <Text style={styles.statLabel}>Rating</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIconWrap}>
            <Ionicons name="chatbubble-ellipses-outline" size={14} color={COLORS.primaryDark} />
          </View>
          <Text style={styles.statValue}>{sellerReviewTotal}</Text>
          <Text style={styles.statLabel}>Reviews</Text>
        </View>
      </View>

      {/* Description */}
      {seller.description ? (
        <View style={[styles.section, railStyle]}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.description}>{seller.description}</Text>
        </View>
      ) : null}

      {/* Products */}
      <View style={[styles.section, railStyle]}>
        <Text style={styles.sectionTitle}>Products ({products.length})</Text>
        {products.length === 0 ? (
          <View style={styles.emptyProducts}>
            <Ionicons name="cube-outline" size={48} color={COLORS.textTertiary} />
            <Text style={styles.emptyText}>No products available</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {products.map((product) => (
              <ProductCard
                key={product.$id}
                product={product}
                variant="premium"
                onPress={() => navigation.navigate('ProductDetail', { productId: product.$id })}
              />
            ))}
          </View>
        )}
      </View>

      <View style={[styles.section, railStyle]}>
        <Text style={styles.sectionTitle}>Reviews</Text>
        {reviews.length === 0 ? (
          <Text style={styles.emptyText}>No buyer reviews yet</Text>
        ) : (
          reviews.slice(0, 4).map((review) => (
            <View key={review.$id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <StarRating rating={review.rating} size={14} showNumber={false} />
                <Text style={styles.reviewTime}>{review.createdAt ? formatRelativeTime(review.createdAt) : ''}</Text>
              </View>
              {getReviewContextTag(review.comment) && (
                <View style={styles.reviewContextChip}>
                  <Text style={styles.reviewContextChipText}>{getReviewContextTag(review.comment)}</Text>
                </View>
              )}
              {!!review.comment && <Text style={styles.reviewComment}>{review.comment}</Text>}
            </View>
          ))
        )}
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: COLORS.background },
  errorText: { fontSize: 16, color: COLORS.textSecondary, marginTop: 16, marginBottom: 16 },
  retryButton: { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  retryButtonText: { color: '#FFF', fontWeight: '600' },
  contentRailWide: {
    width: '100%',
    maxWidth: BUYER_LAYOUT.railMaxWidth,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    padding: 18,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 18,
    backgroundColor: '#FFFCF7',
    borderWidth: 1,
    borderColor: `${COLORS.primary}25`,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    alignItems: 'flex-start',
    position: 'relative',
  },
  headerBackButton: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 3,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopImage: {
    width: 86,
    height: 86,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: `${COLORS.primary}28`,
  },
  shopImagePlaceholder: {
    width: 86, height: 86, borderRadius: 14, backgroundColor: COLORS.card,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
    borderColor: `${COLORS.primary}28`,
  },
  headerInfo: { flex: 1, marginLeft: 14, justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' },
  shopName: { fontSize: 21, fontWeight: '800', color: COLORS.text, lineHeight: 27, flexShrink: 1 },
  headerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  craftTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: `${COLORS.primary}38`,
    backgroundColor: `${COLORS.primary}12`,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  craftTypeChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  headerTagRow: {
    marginTop: 2,
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    alignItems: 'stretch',
  },
  headerTag: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${COLORS.primary}30`,
    backgroundColor: `${COLORS.primary}10`,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  headerTagText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '700',
    flexShrink: 1,
  },
  headerAddressTag: {
    width: '100%',
  },
  headerAddressText: {
    flex: 1,
    lineHeight: 17,
    color: COLORS.primaryDark,
  },
  headerTrustTag: {
    borderColor: `${COLORS.secondary}35`,
    backgroundColor: `${COLORS.secondary}10`,
  },
  headerTrustTagText: {
    color: COLORS.secondaryDark,
  },
  topArtisanChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  topArtisanChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    padding: 8,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${COLORS.primary}22`,
    backgroundColor: `${COLORS.primary}08`,
    paddingVertical: 11,
    paddingHorizontal: 6,
    minHeight: 78,
  },
  statIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${COLORS.primary}22`,
    marginBottom: 5,
  },
  statValue: { fontSize: 19, fontWeight: '800', color: COLORS.text },
  statLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 4, fontWeight: '700' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  section: {
    padding: 16,
    marginTop: 10,
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginBottom: 10 },
  trustInsightCard: {
    marginTop: 10,
    marginHorizontal: 16,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  trustInsightTop: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  trustInsightHeaderTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
  },
  trustInsightText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  trustHero: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${COLORS.primary}30`,
    backgroundColor: `${COLORS.primary}10`,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  trustHeroLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  trustHeroScore: {
    marginTop: 2,
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.text,
  },
  trustHeroHint: {
    marginTop: 2,
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  trustReasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 9,
  },
  trustReasonText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 17,
  },
  breakdownCard: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    padding: 12,
    gap: 8,
  },
  breakdownTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
  },
  breakdownRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  breakdownTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  breakdownLabelWrap: {
    flex: 1,
  },
  breakdownLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  breakdownNote: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  breakdownBarTrack: {
    marginTop: 5,
    height: 7,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: COLORS.border,
  },
  breakdownBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  breakdownBarPositive: {
    backgroundColor: COLORS.success,
  },
  breakdownBarNegative: {
    backgroundColor: COLORS.error,
  },
  breakdownValue: {
    fontSize: 12,
    fontWeight: '800',
  },
  breakdownPositive: {
    color: COLORS.success,
  },
  breakdownNegative: {
    color: COLORS.error,
  },
  breakdownTotal: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  localityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 4,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.22,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  localityButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  mapActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 12,
  },
  mapActionButton: {
    flexBasis: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: `${COLORS.primary}0A`,
  },
  mapActionText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  description: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 21 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  emptyProducts: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14, color: COLORS.textTertiary, marginTop: 8 },
  reviewCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    backgroundColor: COLORS.card,
    marginBottom: 8,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  reviewTime: {
    fontSize: 11,
    color: COLORS.textTertiary,
  },
  reviewContextChip: {
    alignSelf: 'flex-start',
    marginBottom: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: `${COLORS.info}44`,
    backgroundColor: `${COLORS.info}12`,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  reviewContextChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.info,
  },
  reviewComment: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
  },
});

export default SellerProfileScreen;
