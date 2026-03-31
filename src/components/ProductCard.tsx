import React, { useMemo, useRef } from 'react';
import { View, Text, Image, StyleSheet, Animated, TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Product } from '../types/product.types';
import { StarRating } from './StarRating';
import { StatusBadge } from './StatusBadge';
import { formatPrice } from '../utils/formatting';
import { COLORS } from '../constants/colors';
import { normalizeImageList, resolveImageUrl } from '../services/storageService';
import { appwriteConfig } from '../config/appwrite';
import { INDIAN_STATES } from '../constants/regions';

interface ProductCardProps {
  product: Product;
  onPress: () => void;
  showStatus?: boolean;
  fullWidth?: boolean;
  performanceMode?: 'default' | 'list';
  variant?: 'default' | 'premium';
  fallbackRegionLabel?: string;
}

const ProductCardComponent: React.FC<ProductCardProps> = ({
  product,
  onPress,
  showStatus = false,
  fullWidth = false,
  performanceMode = 'default',
  variant = 'default',
  fallbackRegionLabel,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isListMode = performanceMode === 'list';
  const premiumVariant = variant === 'premium';

  const imageUrl = useMemo(() => {
    const imageList = normalizeImageList((product as any).images);
    return resolveImageUrl(appwriteConfig.productImagesBucketId, imageList[0]) || 'https://via.placeholder.com/300';
  }, [product]);

  const regionLabel = useMemo(() => {
    const normalize = (value: string) => value.trim().toLowerCase();
    const genericRegionLabels = new Map<string, string>([
      ['all india', 'All India'],
      ['india', 'India'],
      ['pan india', 'Pan India'],
      ['pan-india', 'Pan India'],
      ['north india', 'North India'],
      ['south india', 'South India'],
      ['east india', 'East India'],
      ['west india', 'West India'],
      ['central india', 'Central India'],
      ['northeast india', 'Northeast India'],
      ['north east india', 'Northeast India'],
      ['north-east india', 'Northeast India'],
    ]);

    const resolveStateToken = (value: string): string | null => {
      const normalizedValue = normalize(value);
      if (!normalizedValue) {
        return null;
      }

      const byCode = INDIAN_STATES.find((state) => normalize(state.id) === normalizedValue);
      if (byCode) {
        return byCode.name;
      }

      const byName = INDIAN_STATES.find((state) => normalize(state.name) === normalizedValue);
      return byName ? byName.name : null;
    };

    const resolveRegionLabel = (value?: string): string | null => {
      if (!value) {
        return null;
      }

      const trimmed = value.toString().trim();
      if (!trimmed) {
        return null;
      }

      const normalizedValue = normalize(trimmed);
      if (genericRegionLabels.has(normalizedValue)) {
        return genericRegionLabels.get(normalizedValue) || null;
      }

      const directState = resolveStateToken(trimmed);
      if (directState) {
        return directState;
      }

      const segments = trimmed
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);

      for (let index = segments.length - 1; index >= 0; index -= 1) {
        const segmentState = resolveStateToken(segments[index]);
        if (segmentState) {
          return segmentState;
        }
      }

      return null;
    };

    const fromProductState = resolveRegionLabel((product as any).state);
    if (fromProductState) {
      return fromProductState;
    }

    const fromProductRegion = resolveRegionLabel(product.region);
    if (fromProductRegion) {
      return fromProductRegion;
    }

    const fromSellerLocation = resolveRegionLabel(((product as any).sellerLocationLabel || '').toString());
    if (fromSellerLocation) {
      return fromSellerLocation;
    }

    return resolveRegionLabel(fallbackRegionLabel);
  }, [fallbackRegionLabel, product]);

  const sellerTrustScore = typeof product.sellerTrustScore === 'number' ? product.sellerTrustScore : null;
  const showTopArtisan = !!product.topArtisan;
  const showVerifiedChip = !!(product as any).sellerVerified;
  const showTrustChip = sellerTrustScore !== null && !showVerifiedChip;

  const animateTo = (value: number) => {
    if (isListMode) {
      return;
    }
    Animated.spring(scaleAnim, {
      toValue: value,
      speed: 30,
      bounciness: 6,
      useNativeDriver: true,
    }).start();
  };

  return (
    <TouchableWithoutFeedback
      onPressIn={() => animateTo(0.97)}
      onPressOut={() => animateTo(1)}
      onPress={onPress}
    >
      <Animated.View
        style={[
          styles.container,
          premiumVariant && styles.premiumContainer,
          fullWidth && styles.fullWidthContainer,
          isListMode && !premiumVariant && styles.listModeContainer,
          isListMode && premiumVariant && styles.listModePremiumContainer,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
      <View style={styles.imageWrap}>
        <Image
          source={{ uri: imageUrl }}
          style={[
            styles.image,
            isListMode && styles.listModeImage,
            premiumVariant && styles.premiumImage,
            isListMode && premiumVariant && styles.premiumListModeImage,
          ]}
          resizeMode="cover"
          fadeDuration={0}
          resizeMethod="resize"
          progressiveRenderingEnabled
        />
      </View>
      
      {showStatus && (
        <View style={styles.statusContainer}>
          <StatusBadge status={product.status} size="small" />
        </View>
      )}

      {product.featured && (
        <View style={styles.featuredBadge}>
          <Text style={styles.featuredText}>Featured</Text>
        </View>
      )}

      {showTopArtisan && (
        <View style={styles.topArtisanBadge}>
          <Ionicons name="ribbon-outline" size={11} color="#7C2D12" />
          <Text style={styles.topArtisanText}>Top Artisan</Text>
        </View>
      )}

      <View style={[styles.content, premiumVariant && styles.premiumContent]}>
        <View>
          <Text
            style={[styles.name, premiumVariant && styles.premiumName]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {product.name}
          </Text>

          <View style={styles.metaRow}>
            <View style={[styles.regionTag, premiumVariant && styles.premiumRegionTag]}>
              <Ionicons name="location-outline" size={11} color={COLORS.primary} />
              <Text style={[styles.regionTagText, premiumVariant && styles.premiumRegionTagText]} numberOfLines={1}>
                {regionLabel || fallbackRegionLabel || 'All India'}
              </Text>
            </View>
            {showVerifiedChip && (
              <View style={styles.verifiedChip}>
                <Ionicons name="checkmark-circle" size={11} color={COLORS.verified} />
                <Text style={styles.verifiedChipText}>Verified</Text>
              </View>
            )}
            {showTrustChip && (
              <View style={[styles.trustChip, premiumVariant && styles.premiumTrustChip]}>
                <Ionicons name="shield-checkmark-outline" size={11} color={COLORS.secondaryDark} />
                <Text style={styles.trustChipText}>Trust {sellerTrustScore}</Text>
              </View>
            )}
          </View>
        </View>

        <View>
          <Text style={[styles.price, premiumVariant && styles.premiumPrice]}>{formatPrice(product.price)}</Text>

          <View style={styles.ratingContainer}>
            {product.rating > 0 ? (
              <>
                <StarRating
                  rating={product.rating}
                  size={12}
                  showNumber={false}
                />
                <Text style={styles.reviewCount}>
                  ({product.reviewCount || 0})
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="star-outline" size={12} color={COLORS.textTertiary} />
                <Text style={styles.noRatingText}>New listing</Text>
              </>
            )}
          </View>
        </View>
      </View>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

export const ProductCard = React.memo(
  ProductCardComponent,
  (prev, next) =>
    prev.product.$id === next.product.$id &&
    prev.product.updatedAt === next.product.updatedAt &&
    prev.showStatus === next.showStatus &&
    prev.fullWidth === next.fullWidth &&
    prev.performanceMode === next.performanceMode &&
    prev.variant === next.variant &&
    prev.fallbackRegionLabel === next.fallbackRegionLabel
);

const styles = StyleSheet.create({
  container: {
    width: '48%',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    overflow: 'hidden',
  },
  premiumContainer: {
    borderRadius: 18,
    borderColor: `${COLORS.primary}30`,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  fullWidthContainer: {
    width: '100%',
  },
  listModeContainer: {
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  listModePremiumContainer: {
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  imageWrap: {
    backgroundColor: COLORS.card,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 158,
    backgroundColor: COLORS.card,
  },
  listModeImage: {
    height: 148,
  },
  premiumImage: {
    height: 170,
  },
  premiumListModeImage: {
    height: 160,
  },
  statusContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  featuredBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
  },
  featuredText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  topArtisanBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  topArtisanText: {
    fontSize: 9,
    color: '#7C2D12',
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    height: 116,
    justifyContent: 'space-between',
  },
  premiumContent: {
    height: 128,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
    minHeight: 24,
    flexWrap: 'nowrap',
    overflow: 'hidden',
  },
  regionTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: `${COLORS.primary}30`,
    backgroundColor: `${COLORS.primary}10`,
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 4,
    maxWidth: '72%',
  },
  premiumRegionTag: {
    borderColor: `${COLORS.primary}40`,
    backgroundColor: `${COLORS.primary}14`,
  },
  regionTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.primaryDark,
  },
  premiumRegionTagText: {
    fontWeight: '700',
  },
  verifiedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: `${COLORS.verified}50`,
    backgroundColor: `${COLORS.verified}16`,
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  verifiedChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.verified,
  },
  trustChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: `${COLORS.secondary}50`,
    backgroundColor: `${COLORS.secondary}12`,
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  premiumTrustChip: {
    borderColor: `${COLORS.secondary}60`,
  },
  trustChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.secondaryDark,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 5,
    lineHeight: 19,
  },
  premiumName: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 21,
    marginBottom: 6,
  },
  price: {
    fontSize: 17,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 7,
  },
  premiumPrice: {
    fontSize: 21,
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 16,
  },
  reviewCount: {
    marginLeft: 4,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  noRatingText: {
    marginLeft: 4,
    fontSize: 11,
    color: COLORS.textTertiary,
    fontWeight: '600',
  },
});
