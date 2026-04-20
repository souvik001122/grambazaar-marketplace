import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  useWindowDimensions,
  Modal,
} from 'react-native';
import { PinchGestureHandler, PanGestureHandler, State, GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { useCartStore } from '../../stores/cartStore';
import { getProductById, incrementProductViews } from '../../services/productService';
import { getProductReviews, getSellerReviews } from '../../services/reviewService';
import { getSellerById } from '../../services/sellerService';
import { addToWishlist, removeFromWishlist, isInWishlist } from '../../services/wishlistService';
import { Product } from '../../types/product.types';
import { Review } from '../../types/common.types';
import { Seller } from '../../types/seller.types';
import { StarRating } from '../../components/StarRating';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { PremiumImage } from '../../components/PremiumImage';
import { formatPrice, formatRelativeTime } from '../../utils/formatting';
import { getStateName } from '../../constants/regions';
import { normalizeImageList, resolveImageUrl } from '../../services/storageService';
import { appwriteConfig } from '../../config/appwrite';
import { showAlert } from '../../utils/alert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { calculateTrustScore, isTopArtisan } from '../../utils/trustScore';
import { BUYER_LAYOUT } from '../../constants/layout';

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

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
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

const toTitleCaseLabel = (value?: string): string => {
  const normalized = sanitizeLocationLabel(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return '';

  return normalized
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const pushUniqueLabel = (parts: string[], value?: string) => {
  const trimmed = sanitizeLocationLabel(value);
  if (!trimmed) return;

  const exists = parts.some((part) => part.toLowerCase() === trimmed.toLowerCase());
  if (!exists) {
    parts.push(trimmed);
  }
};

const getStandardProductAddress = (
  product: Product,
  seller: Seller | null,
  fallbackState: string
): string => {
  const detailedParts: string[] = [];

  if (seller) {
    pushUniqueLabel(detailedParts, seller.address);
    pushUniqueLabel(detailedParts, seller.village);
    pushUniqueLabel(detailedParts, seller.city);
    pushUniqueLabel(detailedParts, seller.district);
    pushUniqueLabel(detailedParts, getStateName(seller.state));
  }

  if (detailedParts.length === 0) {
    pushUniqueLabel(detailedParts, product.sellerLocationLabel);
  }

  const detailedAddress = detailedParts.join(', ');
  if (detailedAddress && detailedAddress.length <= 64) {
    return detailedAddress;
  }

  const shortParts: string[] = [];
  if (seller) {
    pushUniqueLabel(shortParts, seller.city || seller.district || seller.village);
    pushUniqueLabel(shortParts, getStateName(seller.state));
  }

  if (shortParts.length > 0) {
    return shortParts.join(', ');
  }

  return fallbackState || 'India';
};

const ProductDetailScreen = ({ route, navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const isLargeScreen = screenWidth >= BUYER_LAYOUT.railBreakpoint;
  const contentRailStyle = isLargeScreen ? styles.contentRailWide : undefined;
  const galleryWidth = isLargeScreen
    ? Math.min(screenWidth - 36, BUYER_LAYOUT.railMaxWidth)
    : screenWidth - 24;
  const galleryHeight = isLargeScreen ? Math.round(galleryWidth * 0.62) : Math.round(galleryWidth * 0.76);
  const productId = route?.params?.productId;
  const { user } = useAuth();
  const { addToCart, items: cartItems } = useCartStore();

  const [product, setProduct] = useState<Product | null>(null);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [wishlisted, setWishlisted] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerImageIndex, setViewerImageIndex] = useState(0);
  const [viewerScale, setViewerScale] = useState(1);
  const [viewerOffset, setViewerOffset] = useState({ x: 0, y: 0 });
  const [sellerDistanceKm, setSellerDistanceKm] = useState<number | null>(null);
  const [sellerReviewTotal, setSellerReviewTotal] = useState(0);

  const pinchRef = React.useRef<any>(null);
  const panRef = React.useRef<any>(null);
  const baseScaleRef = React.useRef(1);
  const panOffsetRef = React.useRef({ x: 0, y: 0 });
  const panStartOffsetRef = React.useRef({ x: 0, y: 0 });

  const clampZoomScale = (value: number) => Math.max(1, Math.min(3, value));

  const setViewerTransformScale = (nextScale: number) => {
    const clamped = clampZoomScale(nextScale);
    setViewerScale(clamped);
    baseScaleRef.current = clamped;
    if (clamped <= 1.01) {
      setViewerOffset({ x: 0, y: 0 });
      panOffsetRef.current = { x: 0, y: 0 };
    }
  };

  const resetViewerTransform = () => {
    setViewerScale(1);
    setViewerOffset({ x: 0, y: 0 });
    baseScaleRef.current = 1;
    panOffsetRef.current = { x: 0, y: 0 };
    panStartOffsetRef.current = { x: 0, y: 0 };
  };

  const handlePinchGestureEvent = (event: any) => {
    const nextScale = clampZoomScale(baseScaleRef.current * event.nativeEvent.scale);
    setViewerScale(nextScale);

    if (nextScale <= 1.01) {
      setViewerOffset({ x: 0, y: 0 });
      panOffsetRef.current = { x: 0, y: 0 };
    }
  };

  const handlePinchStateChange = (event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      const finalScale = clampZoomScale(baseScaleRef.current * event.nativeEvent.scale);
      baseScaleRef.current = finalScale;
      setViewerScale(finalScale);

      if (finalScale <= 1.01) {
        setViewerOffset({ x: 0, y: 0 });
        panOffsetRef.current = { x: 0, y: 0 };
      }
    }
  };

  const handlePanGestureEvent = (event: any) => {
    if (baseScaleRef.current <= 1.01) {
      return;
    }

    setViewerOffset({
      x: panStartOffsetRef.current.x + event.nativeEvent.translationX,
      y: panStartOffsetRef.current.y + event.nativeEvent.translationY,
    });
  };

  const handlePanStateChange = (event: any) => {
    if (event.nativeEvent.state === State.BEGAN) {
      panStartOffsetRef.current = panOffsetRef.current;
      return;
    }

    if (event.nativeEvent.oldState === State.ACTIVE) {
      if (baseScaleRef.current <= 1.01) {
        setViewerOffset({ x: 0, y: 0 });
        panOffsetRef.current = { x: 0, y: 0 };
        return;
      }

      const nextOffset = {
        x: panStartOffsetRef.current.x + event.nativeEvent.translationX,
        y: panStartOffsetRef.current.y + event.nativeEvent.translationY,
      };
      setViewerOffset(nextOffset);
      panOffsetRef.current = nextOffset;
    }
  };

  useEffect(() => {
    navigation.setOptions?.({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    if (productId) loadProduct();
  }, [productId]);

  const loadProduct = async () => {
    try {
      setLoading(true);
      const prod = await getProductById(productId);
      if (!prod) {
        showAlert('Error', 'Product not found');
        navigation.goBack();
        return;
      }
      setProduct(prod);
      incrementProductViews(prod.$id).catch(() => {});

      // Load seller, reviews, wishlist status in parallel
      const [sellerData, reviewsData, wishStatus, sellerReviewSummary] = await Promise.all([
        getSellerById(prod.sellerId).catch(() => null),
        getProductReviews(prod.$id, 1, 5).catch(() => ({ data: [] as Review[], total: 0, page: 1, perPage: 5, hasMore: false })),
        user ? isInWishlist(user.$id, prod.$id).catch(() => false) : Promise.resolve(false),
        getSellerReviews(prod.sellerId, 1, 1).catch(() => ({ data: [] as Review[], total: 0, page: 1, perPage: 1, hasMore: false })),
      ]);

      setSeller(sellerData);
      setReviews(reviewsData.data);
      setWishlisted(wishStatus);
      setSellerReviewTotal(sellerReviewSummary.total || 0);
    } catch (err) {
      console.error('Error loading product:', err);
      showAlert('Error', 'Failed to load product details');
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

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const km = getDistanceKm(
          position.coords.latitude,
          position.coords.longitude,
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

  const handleAddToCart = () => {
    if (!product) return;
    if (product.stock !== undefined && product.stock < 1) {
      showAlert('Out of Stock', 'This product is currently out of stock.');
      return;
    }

    const existingItem = cartItems.find((i: any) => i.product.$id === product.$id);
    const currentQty = existingItem ? existingItem.quantity : 0;
    if (product.stock !== undefined && currentQty + quantity > product.stock) {
      showAlert('Stock Limit', `Only ${product.stock} items available.`);
      return;
    }

    addToCart(product, quantity);

    const currentRoutes = navigation.getState?.()?.routeNames || [];
    const hasLocalCartRoute = Array.isArray(currentRoutes) && currentRoutes.includes('Cart');

    showAlert('Added to Cart', `${product.name} (x${quantity}) added to cart`, [
      { text: 'Continue Shopping', style: 'cancel' },
      {
        text: 'Go to Cart',
        onPress: () => {
          if (hasLocalCartRoute) {
            navigation.navigate('Cart');
            return;
          }

          const parent = navigation.getParent?.();
          if (parent?.navigate) {
            parent.navigate('Home', { screen: 'Cart' });
            return;
          }

          navigation.navigate('Cart');
        },
      },
    ]);
  };

  const handleToggleWishlist = async () => {
    if (!user || !product) return;
    setWishlistLoading(true);
    try {
      if (wishlisted) {
        await removeFromWishlist(user.$id, product.$id);
        setWishlisted(false);
      } else {
        await addToWishlist(user.$id, product.$id);
        setWishlisted(true);
      }
    } catch (err) {
      console.error('Wishlist error:', err);
    } finally {
      setWishlistLoading(false);
    }
  };

  if (!productId) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={COLORS.textTertiary} />
        <Text style={styles.errorText}>Invalid product</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) return <LoadingSpinner fullScreen />;

  if (!product) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="cube-outline" size={64} color={COLORS.textTertiary} />
        <Text style={styles.errorText}>Product not found</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const normalizedImages = normalizeImageList((product as any).images);
  const resolvedImages = normalizedImages.length
    ? normalizedImages
        .map((id) => resolveImageUrl(appwriteConfig.productImagesBucketId, id))
        .filter(Boolean)
    : [];
  const images: Array<string | null> = resolvedImages.length > 0 ? resolvedImages : [null];

  const isOutOfStock = product.stock !== undefined && product.stock < 1;
  const sellerTrustScore = seller ? calculateTrustScore(seller, { totalReviews: sellerReviewTotal }) : 0;
  const topArtisan = seller ? isTopArtisan(seller, { totalReviews: sellerReviewTotal }) : false;
  const isSellerVerified = !!seller?.verifiedBadge || seller?.verificationStatus === 'approved';
  const locationStateLabel = getStateName((product as any).state || product.region || seller?.state || '');
  const productAddressLabel = getStandardProductAddress(product, seller, locationStateLabel);
  const categoryTagLabel = toTitleCaseLabel(product.category) || 'Handmade';
  const trustTagLabel = isSellerVerified
    ? 'Verified seller'
    : sellerTrustScore >= 80
      ? 'Trusted seller'
      : 'Buyer protection';
  const sellerAddressLabel = getStandardProductAddress(product, seller, locationStateLabel);

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 128 }}
      >
        {/* Image Gallery */}
        <View style={[styles.imageContainer, { width: galleryWidth }]}>
          <FlatList
            data={images}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_, i) => i.toString()}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / galleryWidth);
              setActiveImage(idx);
            }}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                activeOpacity={0.96}
                disabled={!item}
                onPress={() => {
                  if (!item) return;
                  setViewerImageIndex(index);
                  resetViewerTransform();
                  setViewerVisible(true);
                }}
              >
                <View style={[styles.imageFrame, { width: galleryWidth, height: galleryHeight }]}>
                  <PremiumImage
                    uri={item || undefined}
                    style={[styles.image, { width: galleryWidth, height: galleryHeight }]}
                    resizeMode="cover"
                    variant="product"
                  />
                </View>
              </TouchableOpacity>
            )}
          />

          <View style={styles.zoomHintChip}>
            <Ionicons name="expand-outline" size={12} color="#FFF" />
            <Text style={styles.zoomHintText}>Tap image to zoom</Text>
          </View>

          {images.length > 1 && (
            <View style={styles.dots}>
              {images.map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, activeImage === i && styles.activeDot]}
                />
              ))}
            </View>
          )}

          {/* Back + Wishlist overlay */}
          <TouchableOpacity
            style={[styles.backButton, { top: insets.top + 12 }]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.wishlistButton, { top: insets.top + 12 }]}
            onPress={handleToggleWishlist}
            disabled={wishlistLoading}
          >
            {wishlistLoading ? (
              <ActivityIndicator size="small" color={COLORS.error} />
            ) : (
              <Ionicons
                name={wishlisted ? 'heart' : 'heart-outline'}
                size={24}
                color={wishlisted ? COLORS.error : COLORS.text}
              />
            )}
          </TouchableOpacity>
        </View>

        {/* Product Info */}
        <View style={[styles.infoSection, contentRailStyle]}>
          <Text style={styles.productName}>{product.name}</Text>
          <Text style={styles.price}>{formatPrice(product.price)}</Text>

          <View style={styles.metaRow}>
            {product.rating > 0 && (
              <View style={styles.ratingRow}>
                <StarRating rating={product.rating} size={16} />
                <Text style={styles.reviewCount}>({product.reviewCount || 0} reviews)</Text>
              </View>
            )}
            {isOutOfStock && (
              <View style={styles.outOfStockBadge}>
                <Text style={styles.outOfStockText}>Out of Stock</Text>
              </View>
            )}
            {!isOutOfStock && product.stock !== undefined && product.stock <= 5 && (
              <Text style={styles.lowStock}>Only {product.stock} left!</Text>
            )}
          </View>

          <View style={styles.tagRow}>
            <View style={[styles.tag, styles.addressTag]}>
              <Ionicons name="location-outline" size={14} color={COLORS.primary} />
              <Text style={[styles.tagText, styles.addressTagText]}>
                {productAddressLabel || 'India'}
              </Text>
            </View>
            <View style={styles.tag}>
              <Ionicons name="pricetag-outline" size={14} color={COLORS.primary} />
              <Text style={styles.tagText}>{categoryTagLabel}</Text>
            </View>
            {!!product.deliveryOption && (
              <View style={styles.tag}>
                <Ionicons name="cube-outline" size={14} color={COLORS.primary} />
                <Text style={styles.tagText}>
                  {product.deliveryOption === 'pickup'
                    ? 'Shop pickup'
                    : product.deliveryOption === 'delivery'
                    ? 'Online delivery'
                    : 'Pickup + delivery'}
                </Text>
              </View>
            )}
            <View style={[styles.tag, styles.trustTag]}>
              <Ionicons
                name={isSellerVerified ? 'shield-checkmark-outline' : 'shield-outline'}
                size={14}
                color={COLORS.secondaryDark}
              />
              <Text style={[styles.tagText, styles.trustTagText]}>{trustTagLabel}</Text>
            </View>
          </View>
        </View>

        {/* Description */}
        <View style={[styles.section, contentRailStyle]}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{product.description}</Text>
        </View>

        {/* Seller Info */}
        {seller && (
          <View style={[styles.sellerCard, contentRailStyle]}>
            <TouchableOpacity
              style={styles.sellerCardHeader}
              onPress={() => navigation.navigate('SellerProfile', { sellerId: seller.$id })}
              activeOpacity={0.7}
            >
              <View style={styles.sellerLeft}>
                <View style={styles.sellerAvatar}>
                  <Text style={styles.sellerAvatarText}>
                    {(seller.businessName || 'S').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.sellerInfo}>
                  <View style={styles.sellerNameRow}>
                    <Text style={styles.sellerName}>
                      {seller.businessName}
                    </Text>
                    {isSellerVerified && (
                      <Ionicons name="checkmark-circle" size={16} color={COLORS.verified} />
                    )}
                  </View>
                  <View style={styles.sellerHeaderBadgeRow}>
                    <View style={styles.sellerCraftChip}>
                      <Ionicons name="hammer-outline" size={12} color={COLORS.primaryDark} />
                      <Text style={styles.sellerCraftChipText}>{toTitleCaseLabel(seller.craftType) || 'Artisan'}</Text>
                    </View>
                    {topArtisan && (
                      <View style={styles.topArtisanInlineChip}>
                        <Ionicons name="ribbon-outline" size={12} color="#92400E" />
                        <Text style={styles.topArtisanInlineText}>Top Artisan</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.sellerHeaderTagRow}>
                    <View style={[styles.sellerHeaderTag, styles.sellerHeaderAddressTag]}>
                      <Ionicons name="location-outline" size={12} color={COLORS.primary} />
                      <Text style={[styles.sellerHeaderTagText, styles.sellerHeaderAddressText]}>
                        {sellerAddressLabel}
                      </Text>
                    </View>
                    <View style={[styles.sellerHeaderTag, styles.sellerHeaderTrustTag]}>
                      <Ionicons
                        name={isSellerVerified ? 'shield-checkmark-outline' : 'shield-outline'}
                        size={12}
                        color={COLORS.secondaryDark}
                      />
                      <Text style={[styles.sellerHeaderTagText, styles.sellerHeaderTrustText]}>{trustTagLabel}</Text>
                    </View>
                  </View>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>

            <View style={styles.sellerMetaPills}>
              <View style={styles.sellerMetaPill}>
                <Ionicons name="receipt-outline" size={13} color={COLORS.primaryDark} />
                <Text style={styles.sellerMetaText}>Orders {Math.max(0, seller.totalOrders || 0)}</Text>
              </View>
              <View style={styles.sellerMetaPill}>
                <Ionicons name="star-outline" size={13} color={COLORS.warning} />
                <Text style={styles.sellerMetaText}>
                  {Math.max(0, seller.rating || 0).toFixed(1)} ({sellerReviewTotal})
                </Text>
              </View>
              <View style={styles.sellerMetaPill}>
                <Ionicons name="location-outline" size={13} color={COLORS.primary} />
                <Text style={styles.sellerMetaText}>
                  {sellerDistanceKm !== null ? `${sellerDistanceKm} km` : 'Verified location'}
                </Text>
              </View>
            </View>

            <Text style={styles.sellerHintText}>
              View full seller profile for complete store details and support policies.
            </Text>

            <View style={styles.sellerHighlights}>
              <View style={styles.sellerHighlightItem}>
                <Ionicons
                  name={seller.verificationStatus === 'approved' ? 'checkmark-circle' : 'time-outline'}
                  size={14}
                  color={seller.verificationStatus === 'approved' ? COLORS.verified : COLORS.warning}
                />
                <Text style={styles.sellerHighlightText}>
                  {seller.verificationStatus === 'approved' ? 'Government ID verified' : 'ID verification in progress'}
                </Text>
              </View>
              <View style={styles.sellerHighlightItem}>
                <Ionicons name="location-outline" size={14} color={COLORS.primary} />
                <Text style={styles.sellerHighlightText}>Verified shop location</Text>
              </View>
              <View style={styles.sellerHighlightItem}>
                <Ionicons name="lock-closed-outline" size={14} color={COLORS.secondaryDark} />
                <Text style={styles.sellerHighlightText}>Safe in-app ordering</Text>
              </View>
            </View>

            <View style={styles.sellerQuickActions}>
              <TouchableOpacity
                style={styles.sellerPrimaryAction}
                onPress={() => navigation.navigate('SellerProfile', { sellerId: seller.$id })}
              >
                <Ionicons name="person-circle-outline" size={16} color="#FFF" />
                <Text style={styles.sellerPrimaryActionText}>View Seller Profile</Text>
              </TouchableOpacity>
              <Text style={styles.sellerActionHint}>
                Map, directions, call, and WhatsApp are available inside the seller profile.
              </Text>
            </View>
          </View>
        )}

        {/* Reviews */}
        <View style={[styles.section, contentRailStyle]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Reviews</Text>
            {reviews.length > 0 && (
              <TouchableOpacity onPress={() => navigation.navigate('ProductReviews', { productId: product.$id, productName: product.name })}>
                <Text style={styles.seeAll}>See All</Text>
              </TouchableOpacity>
            )}
          </View>
          {reviews.length === 0 ? (
            <Text style={styles.noReviews}>No reviews yet. Be the first to review!</Text>
          ) : (
            reviews.slice(0, 3).map((review) => (
              <View key={review.$id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <StarRating rating={review.rating} size={14} showNumber={false} />
                  <Text style={styles.reviewDate}>
                    {review.createdAt ? formatRelativeTime(review.createdAt) : ''}
                  </Text>
                </View>
                {getReviewContextTag(review.comment) && (
                  <View style={styles.reviewContextChip}>
                    <Text style={styles.reviewContextChipText}>{getReviewContextTag(review.comment)}</Text>
                  </View>
                )}
                {review.comment ? (
                  <Text style={styles.reviewComment}>{review.comment}</Text>
                ) : null}
              </View>
            ))
          )}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      <Modal
        visible={viewerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setViewerVisible(false);
          resetViewerTransform();
        }}
      >
        <GestureHandlerRootView style={styles.viewerGestureRoot}>
          <View
            style={[
              styles.viewerBackdrop,
              {
                marginTop: Math.max(insets.top, 8),
                marginBottom: Math.max(insets.bottom, 8),
              },
            ]}
          >
            <View style={[styles.viewerSheet, { paddingBottom: 18 }]}>
            <View style={styles.viewerHeaderRow}>
              <Text style={styles.viewerHeaderTitle}>Image Preview</Text>
              <TouchableOpacity
                style={styles.viewerCloseButton}
                onPress={() => {
                  setViewerVisible(false);
                  resetViewerTransform();
                }}
              >
                <Ionicons name="close" size={20} color="#E6EDF8" />
              </TouchableOpacity>
            </View>

            <PinchGestureHandler
              ref={pinchRef}
              onGestureEvent={handlePinchGestureEvent}
              onHandlerStateChange={handlePinchStateChange}
              minPointers={2}
              shouldCancelWhenOutside={false}
              simultaneousHandlers={panRef}
            >
              <View style={styles.viewerImageWrap}>
                <PanGestureHandler
                  ref={panRef}
                  onGestureEvent={handlePanGestureEvent}
                  onHandlerStateChange={handlePanStateChange}
                  simultaneousHandlers={pinchRef}
                  minDist={2}
                  maxPointers={1}
                  shouldCancelWhenOutside={false}
                >
                  <View style={styles.viewerImageCard} collapsable={false}>
                    <PremiumImage
                      uri={images[viewerImageIndex] || undefined}
                      style={[
                        styles.viewerImage,
                        {
                          transform: [
                            { translateX: viewerOffset.x },
                            { translateY: viewerOffset.y },
                            { scale: viewerScale },
                          ],
                        },
                      ]}
                      resizeMode="contain"
                      variant="product"
                    />
                  </View>
                </PanGestureHandler>
              </View>
            </PinchGestureHandler>

            <View style={styles.viewerZoomRow}>
              <TouchableOpacity
                style={[styles.viewerZoomButton, viewerScale <= 1 && styles.viewerNavButtonDisabled]}
                onPress={() => setViewerTransformScale(Number((viewerScale - 0.25).toFixed(2)))}
                disabled={viewerScale <= 1}
              >
                <Ionicons name="remove" size={18} color="#F8FAFC" />
              </TouchableOpacity>
              <Text style={styles.viewerZoomText}>{Math.round(viewerScale * 100)}%</Text>
              <TouchableOpacity
                style={[styles.viewerZoomButton, viewerScale >= 3 && styles.viewerNavButtonDisabled]}
                onPress={() => setViewerTransformScale(Number((viewerScale + 0.25).toFixed(2)))}
                disabled={viewerScale >= 3}
              >
                <Ionicons name="add" size={18} color="#F8FAFC" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.viewerResetButton}
                onPress={resetViewerTransform}
              >
                <Text style={styles.viewerResetText}>Reset</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.viewerHintText}>Pinch with two fingers to zoom, drag to pan</Text>

            <View style={styles.viewerBottomBar}>
              <TouchableOpacity
                style={[styles.viewerNavButton, viewerImageIndex === 0 && styles.viewerNavButtonDisabled]}
                onPress={() => {
                  setViewerImageIndex((idx) => Math.max(0, idx - 1));
                  resetViewerTransform();
                }}
                disabled={viewerImageIndex === 0}
              >
                <Ionicons name="chevron-back" size={22} color="#FFF" />
              </TouchableOpacity>

              <Text style={styles.viewerCounterText}>{viewerImageIndex + 1} / {images.length}</Text>

              <TouchableOpacity
                style={[styles.viewerNavButton, viewerImageIndex === images.length - 1 && styles.viewerNavButtonDisabled]}
                onPress={() => {
                  setViewerImageIndex((idx) => Math.min(images.length - 1, idx + 1));
                  resetViewerTransform();
                }}
                disabled={viewerImageIndex === images.length - 1}
              >
                <Ionicons name="chevron-forward" size={22} color="#FFF" />
              </TouchableOpacity>
            </View>
            </View>
          </View>
        </GestureHandlerRootView>
      </Modal>

      {/* Bottom Bar — Add to Cart */}
      <View
        style={[
          styles.bottomBar,
          {
            bottom: 0,
          },
        ]}
      >
        <View style={[styles.bottomBarInner, contentRailStyle]}>
          <View style={styles.quantityControl}>
            <TouchableOpacity
              style={styles.qtyButton}
              onPress={() => setQuantity((q) => Math.max(1, q - 1))}
            >
              <Ionicons name="remove" size={20} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.qtyText}>{quantity}</Text>
            <TouchableOpacity
              style={styles.qtyButton}
              onPress={() => setQuantity((q) => q + 1)}
            >
              <Ionicons name="add" size={20} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.addToCartButton, isOutOfStock && styles.disabledButton]}
            onPress={handleAddToCart}
            disabled={isOutOfStock}
          >
            <Ionicons name="cart-outline" size={19} color="#FFF" />
            <Text style={styles.addToCartText}>
              {isOutOfStock ? 'Out of Stock' : `Add to Cart • ${formatPrice(product.price * quantity)}`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: COLORS.background },
  errorText: { fontSize: 16, color: COLORS.textSecondary, marginTop: 16, marginBottom: 16 },
  retryButton: { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  retryButtonText: { color: '#FFF', fontWeight: '600' },
  imageContainer: {
    position: 'relative',
    alignSelf: 'center',
    marginTop: 12,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  imageFrame: {
    backgroundColor: COLORS.card,
  },
  image: { backgroundColor: COLORS.card },
  contentRailWide: {
    width: '100%',
    maxWidth: BUYER_LAYOUT.railMaxWidth,
    alignSelf: 'center',
  },
  dots: { flexDirection: 'row', position: 'absolute', bottom: 14, alignSelf: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.45)' },
  activeDot: { backgroundColor: '#FFF', width: 18 },
  zoomHintChip: {
    position: 'absolute',
    right: 12,
    bottom: 40,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.38)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  zoomHintText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  backButton: {
    position: 'absolute', top: 48, left: 16, width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center',
  },
  wishlistButton: {
    position: 'absolute', top: 48, right: 16, width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center',
  },
  infoSection: {
    padding: 20,
    backgroundColor: COLORS.surface,
    marginTop: 10,
    marginHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  productName: { fontSize: 24, fontWeight: '700', color: COLORS.text, marginBottom: 8, lineHeight: 30 },
  price: { fontSize: 26, fontWeight: '800', color: COLORS.primaryDark, marginBottom: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reviewCount: { fontSize: 13, color: COLORS.textSecondary },
  outOfStockBadge: { backgroundColor: `${COLORS.error}15`, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  outOfStockText: { fontSize: 12, fontWeight: '600', color: COLORS.error },
  lowStock: { fontSize: 13, fontWeight: '600', color: COLORS.warning },
  tagRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: `${COLORS.primary}10`, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
  addressTag: {
    width: '100%',
    borderRadius: 12,
    alignItems: 'flex-start',
    paddingVertical: 7,
  },
  tagText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  addressTagText: {
    flex: 1,
    flexShrink: 1,
    lineHeight: 17,
    color: COLORS.primaryDark,
  },
  trustTag: {
    backgroundColor: `${COLORS.secondary}10`,
  },
  trustTagText: {
    color: COLORS.secondaryDark,
  },
  section: {
    padding: 20,
    backgroundColor: COLORS.surface,
    marginTop: 10,
    marginHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginBottom: 10 },
  seeAll: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  description: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 21 },
  sellerCard: {
    padding: 16, backgroundColor: '#FFFCF7',
    marginTop: 10, marginHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: `${COLORS.primary}25`,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  sellerCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  sellerLeft: { flex: 1, flexDirection: 'row', alignItems: 'flex-start' },
  sellerAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: `${COLORS.primary}50`,
  },
  sellerAvatarText: { fontSize: 18, fontWeight: 'bold', color: '#FFF' },
  sellerInfo: { marginLeft: 12, flex: 1 },
  sellerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 6 },
  sellerName: { fontSize: 17, fontWeight: '800', color: COLORS.text, flexShrink: 1, lineHeight: 22 },
  sellerHeaderBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  sellerCraftChip: {
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
  sellerCraftChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  sellerHeaderTagRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    alignItems: 'stretch',
  },
  sellerHeaderTag: {
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
  sellerHeaderTagText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '700',
    flexShrink: 1,
  },
  sellerHeaderAddressTag: {
    width: '100%',
  },
  sellerHeaderAddressText: {
    flex: 1,
    lineHeight: 17,
    color: COLORS.primaryDark,
  },
  sellerHeaderTrustTag: {
    borderColor: `${COLORS.secondary}35`,
    backgroundColor: `${COLORS.secondary}10`,
  },
  sellerHeaderTrustText: {
    color: COLORS.secondaryDark,
  },
  topArtisanInlineChip: {
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
  topArtisanInlineText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
  },
  sellerMetaPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    alignItems: 'stretch',
  },
  sellerMetaPill: {
    flex: 1,
    minWidth: '31%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    paddingHorizontal: 8,
    paddingVertical: 7,
    minHeight: 36,
  },
  sellerMetaText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    flexShrink: 1,
    textAlign: 'center',
    lineHeight: 15,
  },
  sellerHintText: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textSecondary,
  },
  sellerHighlights: {
    marginTop: 10,
    gap: 6,
  },
  sellerHighlightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sellerHighlightText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  sellerQuickActions: {
    marginTop: 12,
    gap: 10,
  },
  sellerPrimaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    paddingVertical: 11,
  },
  sellerPrimaryActionText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  sellerActionHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 17,
    textAlign: 'center',
  },
  noReviews: { fontSize: 13, color: COLORS.textTertiary, fontStyle: 'italic' },
  reviewCard: {
    padding: 12,
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 8,
  },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  reviewDate: { fontSize: 11, color: COLORS.textTertiary },
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
  reviewComment: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },
  viewerGestureRoot: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  viewerBackdrop: {
    flex: 1,
    width: '100%',
    borderRadius: 36,
    padding: 6,
    backgroundColor: '#0F2038',
    shadowColor: '#000',
    shadowOpacity: 0.38,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
    overflow: 'hidden',
  },
  viewerSheet: {
    width: '100%',
    flex: 1,
    borderRadius: 30,
    backgroundColor: '#182A44',
    paddingTop: 14,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOpacity: 0.42,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
  },
  viewerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  viewerHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F4F8FF',
  },
  viewerCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(180,198,224,0.34)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerImageWrap: {
    flex: 1,
    paddingHorizontal: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerImageCard: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    backgroundColor: '#0E1A2D',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerImage: {
    width: '100%',
    height: '100%',
  },
  viewerZoomRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  viewerZoomButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(180,198,224,0.34)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerZoomText: {
    minWidth: 56,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: '#E6EDF8',
  },
  viewerResetButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(180,198,224,0.34)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  viewerResetText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E6EDF8',
  },
  viewerHintText: {
    marginTop: 6,
    textAlign: 'center',
    color: '#B3C4DD',
    fontSize: 11,
    fontWeight: '600',
  },
  viewerBottomBar: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  viewerNavButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(180,198,224,0.32)',
  },
  viewerNavButtonDisabled: {
    opacity: 0.35,
  },
  viewerCounterText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    minWidth: 56,
    textAlign: 'center',
  },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 10,
    backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },
  bottomBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  quantityControl: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, overflow: 'hidden' },
  qtyButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  qtyText: { width: 34, textAlign: 'center', fontSize: 15, fontWeight: '600', color: COLORS.text },
  addToCartButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary,
    minHeight: 50,
    paddingVertical: 10,
    borderRadius: 12,
  },
  addToCartText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  disabledButton: { backgroundColor: COLORS.textTertiary },
});

export default ProductDetailScreen;
