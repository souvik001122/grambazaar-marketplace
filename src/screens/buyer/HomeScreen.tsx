import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
  Modal,
  Pressable,
  InteractionManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { ProductCard } from '../../components/ProductCard';
import { SellerCard } from '../../components/SellerCard';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { Product } from '../../types/product.types';
import { Seller } from '../../types/seller.types';
import { getProducts } from '../../services/productService';
import { getSellersByRegion, getTopVerifiedSellers } from '../../services/sellerService';
import { COLORS } from '../../constants/colors';
import { CATEGORIES } from '../../constants/categories';
import { INDIAN_STATES } from '../../constants/regions';
import { BUYER_LAYOUT } from '../../constants/layout';
import * as Location from 'expo-location';
import { useAuth } from '../../context/AuthContext';
import { useCartStore } from '../../stores/cartStore';
import {
  rankProductsByBestRated,
  rankProductsByFreshArrivals,
  rankProductsByTrending,
  rankSellersForTopArtisans,
} from '../../utils/homeRanking';
import { normalizeImageList, resolveImageUrl } from '../../services/storageService';
import { appwriteConfig } from '../../config/appwrite';

const FRESH_PAGE_SIZE = 6;
const DEFAULT_REGION = 'Haryana';
const ALL_INDIA_REGION = 'All India';
const REGION_BOOTSTRAP_TIMEOUT_MS = 1200;
const CURATED_TOP_RATED_FETCH_SIZE = 60;
const CURATED_TRENDING_FETCH_SIZE = 80;
const HOME_PREFETCH_COUNT = 8;
const HOME_CURATED_PREFETCH_COUNT = 4;
const HOME_SELLER_PREFETCH_COUNT = 4;
const HOME_SNAPSHOT_TTL_MS = 5 * 60 * 1000;

type HomeSnapshot = {
  userId: string;
  selectedRegion: string;
  autoRegionLabel: string;
  featuredProducts: Product[];
  trendingProducts: Product[];
  topSellers: Seller[];
  recentProducts: Product[];
  curatedMode: 'top-rated' | 'trending';
  freshPage: number;
  freshHasMore: boolean;
  productsFallbackActive: boolean;
  cachedAt: number;
};

let HOME_SNAPSHOT_CACHE: HomeSnapshot | null = null;

const toHomePreviewUri = (rawUri: string): string => {
  if (!rawUri || !/^https?:\/\//i.test(rawUri)) {
    return rawUri;
  }

  if (!rawUri.includes('/storage/buckets/') || !rawUri.includes('/files/')) {
    return rawUri;
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUri);
  } catch {
    return rawUri;
  }

  if (!parsed.pathname.endsWith('/view') && !parsed.pathname.endsWith('/preview')) {
    return rawUri;
  }

  parsed.pathname = parsed.pathname.replace(/\/(view|preview)$/i, '/preview');
  parsed.searchParams.set('quality', '58');
  parsed.searchParams.set('output', 'webp');
  parsed.searchParams.set('width', '420');
  return parsed.toString();
};

const HomeScreen = ({ navigation }: any) => {
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const isCompact = screenHeight < 760;
  const isLargeScreen = screenWidth >= BUYER_LAYOUT.railBreakpoint;
  const { user } = useAuth();
  const cacheUserKey = user?.$id || 'guest';
  const cartCount = useCartStore((s) => s.items.reduce((t, i) => t + i.quantity, 0));
  const [selectedRegion, setSelectedRegion] = useState(DEFAULT_REGION);
  const [autoRegionLabel, setAutoRegionLabel] = useState('');
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [trendingProducts, setTrendingProducts] = useState<Product[]>([]);
  const [topSellers, setTopSellers] = useState<Seller[]>([]);
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);
  const [curatedMode, setCuratedMode] = useState<'top-rated' | 'trending'>('top-rated');
  const [regionPickerVisible, setRegionPickerVisible] = useState(false);
  const [freshPage, setFreshPage] = useState(1);
  const [freshHasMore, setFreshHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [productsFallbackActive, setProductsFallbackActive] = useState(false);
  const [startupRegionResolved, setStartupRegionResolved] = useState(Platform.OS === 'web');
  const contentRailStyle = isLargeScreen ? styles.contentRailWide : undefined;
  const initialLoadDoneRef = useRef(false);
  const prefetchedUrisRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!HOME_SNAPSHOT_CACHE) {
      return;
    }

    const snapshotExpired = Date.now() - HOME_SNAPSHOT_CACHE.cachedAt > HOME_SNAPSHOT_TTL_MS;
    const wrongUser = HOME_SNAPSHOT_CACHE.userId !== cacheUserKey;

    if (snapshotExpired || wrongUser) {
      return;
    }

    setSelectedRegion(HOME_SNAPSHOT_CACHE.selectedRegion);
    setAutoRegionLabel(HOME_SNAPSHOT_CACHE.autoRegionLabel);
    setFeaturedProducts(HOME_SNAPSHOT_CACHE.featuredProducts);
    setTrendingProducts(HOME_SNAPSHOT_CACHE.trendingProducts);
    setTopSellers(HOME_SNAPSHOT_CACHE.topSellers);
    setRecentProducts(HOME_SNAPSHOT_CACHE.recentProducts);
    setCuratedMode(HOME_SNAPSHOT_CACHE.curatedMode);
    setFreshPage(HOME_SNAPSHOT_CACHE.freshPage);
    setFreshHasMore(HOME_SNAPSHOT_CACHE.freshHasMore);
    setProductsFallbackActive(HOME_SNAPSHOT_CACHE.productsFallbackActive);
    initialLoadDoneRef.current = true;
    setLoading(false);
  }, [cacheUserKey]);

  const navigateToBuyerTab = useCallback(
    (tabName: string, params?: any) => {
      const parent = navigation.getParent?.();
      if (parent?.navigate) {
        parent.navigate(tabName, params);
        return;
      }
      navigation.navigate(tabName, params);
    },
    [navigation]
  );

  const navigateToAuth = useCallback(
    (screen: 'Login' | 'Register') => {
      const lvl1 = navigation.getParent?.();
      const lvl2 = lvl1?.getParent?.();
      const lvl3 = lvl2?.getParent?.();
      const root = lvl3 || lvl2 || lvl1;

      if (root?.navigate) {
        root.navigate(screen);
        return;
      }

      navigation.navigate(screen);
    },
    [navigation]
  );

  const loadInitialData = useCallback(async ({ blocking = true }: { blocking?: boolean } = {}) => {
    try {
      if (blocking) {
        setLoading(true);
      }
      setError(false);

      const effectiveRegionFilter = selectedRegion === ALL_INDIA_REGION ? undefined : selectedRegion;

      const [featured, recent, sellers, trending] = await Promise.all([
        getProducts({ sortBy: 'rating', region: effectiveRegionFilter }, 1, CURATED_TOP_RATED_FETCH_SIZE),
        getProducts({ sortBy: 'newest', region: effectiveRegionFilter }, 1, FRESH_PAGE_SIZE),
        effectiveRegionFilter ? getSellersByRegion(effectiveRegionFilter) : getTopVerifiedSellers(200),
        getProducts({ sortBy: 'trending', region: effectiveRegionFilter }, 1, CURATED_TRENDING_FETCH_SIZE),
      ]);

      const noRegionProducts =
        !!effectiveRegionFilter && !featured.data.length && !recent.data.length && !trending.data.length;

      const [featuredResolved, recentResolved, trendingResolved] =
        noRegionProducts
          ? await Promise.all([
              getProducts({ sortBy: 'rating' }, 1, CURATED_TOP_RATED_FETCH_SIZE).catch(() => featured),
              getProducts({ sortBy: 'newest' }, 1, FRESH_PAGE_SIZE).catch(() => recent),
              getProducts({ sortBy: 'trending' }, 1, CURATED_TRENDING_FETCH_SIZE).catch(() => trending),
            ])
          : [featured, recent, trending];

      const rankedFeaturedProducts = rankProductsByBestRated(featuredResolved.data).slice(0, 4);
      const rankedTrendingProducts = rankProductsByTrending(trendingResolved.data).slice(0, 4);
      const rankedFreshProducts = rankProductsByFreshArrivals(recentResolved.data);
      const rankedSellers = rankSellersForTopArtisans(sellers).slice(0, 4);

      setProductsFallbackActive(noRegionProducts);
      setFeaturedProducts(rankedFeaturedProducts);
      setRecentProducts(rankedFreshProducts);
      setTrendingProducts(rankedTrendingProducts.length ? rankedTrendingProducts : rankedFeaturedProducts);
      setTopSellers(rankedSellers);
      setFreshPage(1);
      setFreshHasMore(recentResolved.hasMore);
      initialLoadDoneRef.current = true;

      HOME_SNAPSHOT_CACHE = {
        userId: cacheUserKey,
        selectedRegion,
        autoRegionLabel,
        featuredProducts: rankedFeaturedProducts,
        trendingProducts: rankedTrendingProducts.length ? rankedTrendingProducts : rankedFeaturedProducts,
        topSellers: rankedSellers,
        recentProducts: rankedFreshProducts,
        curatedMode,
        freshPage: 1,
        freshHasMore: recentResolved.hasMore,
        productsFallbackActive: noRegionProducts,
        cachedAt: Date.now(),
      };
    } catch (err) {
      console.error('Error loading home data:', err);
      setProductsFallbackActive(false);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [autoRegionLabel, cacheUserKey, curatedMode, selectedRegion]);

  useEffect(() => {
    if (!startupRegionResolved) {
      return;
    }

    loadInitialData({ blocking: !initialLoadDoneRef.current });
  }, [loadInitialData, startupRegionResolved]);

  useEffect(() => {
    const freshUris = recentProducts
      .slice(0, HOME_PREFETCH_COUNT)
      .map((product) => {
        const imageList = normalizeImageList((product as any).images);
        const raw = resolveImageUrl(appwriteConfig.productImagesBucketId, imageList[0]);
        return toHomePreviewUri(raw);
      })
      .filter(Boolean);

    const curatedSeed = (curatedMode === 'top-rated' ? featuredProducts : trendingProducts)
      .slice(0, HOME_CURATED_PREFETCH_COUNT)
      .map((product) => {
        const imageList = normalizeImageList((product as any).images);
        const raw = resolveImageUrl(appwriteConfig.productImagesBucketId, imageList[0]);
        return toHomePreviewUri(raw);
      })
      .filter(Boolean);

    const sellerUris = topSellers
      .slice(0, HOME_SELLER_PREFETCH_COUNT)
      .map((seller) => {
        const docs = normalizeImageList((seller as any).verificationDocuments);
        const raw = resolveImageUrl(appwriteConfig.documentsBucketId, docs[0]);
        return toHomePreviewUri(raw);
      })
      .filter(Boolean);

    const candidateUris = Array.from(new Set([...freshUris, ...curatedSeed, ...sellerUris]));

    const newUris = candidateUris.filter((uri) => !prefetchedUrisRef.current.has(uri));

    if (newUris.length === 0) {
      return;
    }

    newUris.forEach((uri) => prefetchedUrisRef.current.add(uri));

    const task = InteractionManager.runAfterInteractions(() => {
      ExpoImage.prefetch(newUris, 'memory-disk').catch(() => {
        // Prefetch is best-effort; ignore failures to keep feed responsive.
      });
    });

    return () => task.cancel();
  }, [curatedMode, featuredProducts, recentProducts, topSellers, trendingProducts]);

  useEffect(() => {
    let active = true;

    const detectRegion = async (): Promise<string | null> => {
      if (Platform.OS === 'web') return null;

      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
          return null;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const geo = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        const regionName = geo[0]?.region?.trim();
        if (!regionName) {
          return null;
        }

        const matched = INDIAN_STATES.find(
          (state) => state.name.toLowerCase() === regionName.toLowerCase()
        );

        return matched?.name || null;
      } catch {
        return null;
      }
    };

    const bootstrapRegion = async () => {
      if (Platform.OS === 'web') {
        setStartupRegionResolved(true);
        return;
      }

      try {
        const detectedRegion = await Promise.race<string | null>([
          detectRegion(),
          new Promise<string | null>((resolve) => {
            setTimeout(() => resolve(null), REGION_BOOTSTRAP_TIMEOUT_MS);
          }),
        ]);

        if (!active) {
          return;
        }

        if (detectedRegion && detectedRegion !== DEFAULT_REGION) {
          setSelectedRegion(detectedRegion);
          setAutoRegionLabel(`${detectedRegion} (Auto)`);
        }
      } finally {
        if (active) {
          setStartupRegionResolved(true);
        }
      }
    };

    bootstrapRegion();

    return () => {
      active = false;
    };
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadInitialData({ blocking: false });
  }, [loadInitialData]);

  const loadMoreFreshProducts = useCallback(async () => {
    if (loading || refreshing || loadingMore || !freshHasMore) {
      return;
    }

    setLoadingMore(true);
    try {
      const nextPage = freshPage + 1;
      const effectiveRegionFilter = selectedRegion === ALL_INDIA_REGION ? undefined : selectedRegion;
      const nextBatch = await getProducts(
        productsFallbackActive ? { sortBy: 'newest' } : { sortBy: 'newest', region: effectiveRegionFilter },
        nextPage,
        FRESH_PAGE_SIZE
      );

      setRecentProducts((prev) => {
        const existingIds = new Set(prev.map((p) => p.$id));
        const merged = [...prev];

        for (const product of nextBatch.data) {
          if (!existingIds.has(product.$id)) {
            existingIds.add(product.$id);
            merged.push(product);
          }
        }

        return rankProductsByFreshArrivals(merged);
      });

      setFreshPage(nextPage);
      setFreshHasMore(nextBatch.hasMore);
    } catch (err) {
      console.error('Error loading more home products:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [freshHasMore, freshPage, loading, loadingMore, productsFallbackActive, refreshing, selectedRegion]);

  const handleProductPress = useCallback((product: Product) => {
    navigation.navigate('ProductDetail', { productId: product.$id });
  }, [navigation]);

  const handleCategoryPress = (categoryId: string) => {
    openSearchWithParams({ category: categoryId, region: effectiveRegionFilter });
  };

  const openSearchWithParams = useCallback(
    (params?: Record<string, any>) => {
      navigateToBuyerTab('Search', {
        screen: 'SearchMain',
        params: {
          ...(params || {}),
          _fromHomeTs: Date.now(),
        },
      });
    },
    [navigateToBuyerTab]
  );

  const sortedStates = useMemo(
    () => [
      ALL_INDIA_REGION,
      ...[...INDIAN_STATES.map((state) => state.name)].sort((a, b) =>
        a.localeCompare(b, 'en-IN', { sensitivity: 'base' })
      ),
    ],
    []
  );

  const handleSelectHomeRegion = useCallback((regionName: string) => {
    setSelectedRegion(regionName);
    setAutoRegionLabel('');
    setRegionPickerVisible(false);
  }, []);

  const featuredCardWidth = isLargeScreen ? 300 : screenWidth * (isCompact ? 0.51 : 0.49);
  const activeRegionLabel = (autoRegionLabel || selectedRegion).replace(' (Auto)', '');
  const effectiveRegionFilter = selectedRegion === ALL_INDIA_REGION ? undefined : selectedRegion;
  const productScopeLabel = activeRegionLabel || selectedRegion || 'your selected region';
  const noArtisansTitle =
    selectedRegion === ALL_INDIA_REGION
      ? 'No artisans found across India yet'
      : `No artisans found in ${productScopeLabel} yet`;
  const featuredCaption = productsFallbackActive
    ? 'Showing results across India'
    : curatedMode === 'top-rated'
      ? `Top-rated in ${productScopeLabel}`
      : `Trending in ${productScopeLabel}`;
  const freshCaption = productsFallbackActive
    ? 'Showing results across India'
    : `Latest products in ${productScopeLabel}`;
  const fallbackNoticeText = `No products found in ${productScopeLabel}. Showing results from across India.`;

  const curatedProducts = useMemo(
    () => (curatedMode === 'top-rated' ? featuredProducts : trendingProducts),
    [curatedMode, featuredProducts, trendingProducts]
  );

  const uniqueFeaturedProductCount = useMemo(() => {
    const uniqueIds = new Set<string>();
    [...featuredProducts, ...trendingProducts].forEach((product) => {
      if (product?.$id) {
        uniqueIds.add(product.$id);
      }
    });
    return uniqueIds.size;
  }, [featuredProducts, trendingProducts]);

  const premiumStats = useMemo(
    () => [
      { label: 'Featured items', value: `${uniqueFeaturedProductCount}` },
      { label: 'Top artisans', value: `${topSellers.length}` },
      { label: 'Region', value: activeRegionLabel || 'All India' },
    ],
    [activeRegionLabel, topSellers.length, uniqueFeaturedProductCount]
  );

  const renderFreshProductCard = useCallback(
    ({ item }: { item: Product }) => (
      <View style={styles.freshGridItem}>
        <ProductCard
          product={item}
          performanceMode="list"
          fullWidth
          variant="default"
          fallbackRegionLabel={activeRegionLabel}
          onPress={() => handleProductPress(item)}
        />
      </View>
    ),
    [activeRegionLabel, handleProductPress]
  );

  const renderCuratedProductCard = useCallback(
    ({ item }: { item: Product }) => (
      <View
        style={[
          styles.horizontalCard,
          isCompact && styles.horizontalCardCompact,
          { width: featuredCardWidth },
        ]}
      >
        <ProductCard
          product={item}
          performanceMode="list"
          fullWidth
          variant="premium"
          fallbackRegionLabel={activeRegionLabel}
          onPress={() => handleProductPress(item)}
        />
      </View>
    ),
    [activeRegionLabel, featuredCardWidth, handleProductPress, isCompact]
  );

  if (loading && !refreshing) {
    return <LoadingSpinner fullScreen />;
  }

  if (error && !refreshing) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="cloud-offline-outline" size={64} color={COLORS.textTertiary} />
        <Text style={styles.errorText}>Failed to load products</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadInitialData({ blocking: true })}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.pageAura} pointerEvents="none" />
      <FlatList
        data={recentProducts}
        keyExtractor={(item) => item.$id}
        renderItem={renderFreshProductCard}
        numColumns={2}
        columnWrapperStyle={styles.freshGridRow}
        removeClippedSubviews={Platform.OS === 'android'}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={3}
        updateCellsBatchingPeriod={140}
        showsVerticalScrollIndicator={false}
        onEndReached={loadMoreFreshProducts}
        onEndReachedThreshold={0.2}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[COLORS.primary]}
          />
        }
        ListHeaderComponent={
          <>
            <View
              style={[
                styles.banner,
                isCompact && styles.bannerCompact,
                contentRailStyle,
              ]}
            >
              <View style={styles.heroGlowOne} pointerEvents="none" />
              <View style={styles.heroGlowTwo} pointerEvents="none" />
              <View style={styles.bannerContent}>
                <Text style={styles.bannerEyebrow}>Explore Authentic Regions</Text>
                <Text style={styles.bannerTitle}>
                  Namaste{user?.name ? `, ${user.name.split(' ')[0]}` : ''}! 🙏
                </Text>
                <Text style={styles.bannerSubtitle}>
                  Discover authentic regional crafts from verified local artisans
                </Text>
                <View style={styles.heroChipRow}>
                  <View style={styles.heroChip}>
                    <Ionicons name="shield-checkmark-outline" size={11} color={COLORS.secondaryDark} />
                    <Text style={styles.heroChipText}>Verified Sellers</Text>
                  </View>
                  <View style={styles.heroChip}>
                    <Ionicons name="card-outline" size={11} color={COLORS.primaryDark} />
                    <Text style={styles.heroChipText}>Secure Checkout</Text>
                  </View>
                </View>
                {!!autoRegionLabel && <Text style={styles.bannerRegionHint}>Home feed region: {autoRegionLabel}</Text>}
              </View>
              <TouchableOpacity
                style={styles.cartButton}
                onPress={() => navigation.navigate('Cart')}
              >
                <Ionicons name="cart-outline" size={26} color={COLORS.primary} />
                {cartCount > 0 && (
                  <View style={styles.cartBadge}>
                    <Text style={styles.cartBadgeText}>
                      {cartCount > 9 ? '9+' : cartCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <View style={[styles.platformTrustBanner, contentRailStyle]}>
              <View style={styles.platformTrustIconWrap}>
                <Ionicons name="shield-checkmark" size={18} color={COLORS.secondaryDark} />
              </View>
              <View style={styles.platformTrustContent}>
                <Text style={styles.platformTrustTitle}>GramBazaar Trust Promise</Text>
                <Text style={styles.platformTrustText}>
                  Discover verified artisans, transparent trust scores, and safer ordering with in-app support.
                </Text>
              </View>
            </View>

            <View style={[styles.metricsPanel, contentRailStyle]}>
              {premiumStats.map((metric) => {
                const isRegionMetric = metric.label === 'Region';
                if (isRegionMetric) {
                  return (
                    <TouchableOpacity
                      key={metric.label}
                      style={[styles.metricCard, styles.metricCardAction]}
                      activeOpacity={0.82}
                      onPress={() => setRegionPickerVisible(true)}
                    >
                      <Text style={styles.metricLabel}>{metric.label}</Text>
                      <View style={styles.metricValueRow}>
                        <Text style={[styles.metricValue, styles.metricValueRegion]} numberOfLines={1}>
                          {metric.value}
                        </Text>
                        <Ionicons name="chevron-down" size={14} color={COLORS.primary} />
                      </View>
                    </TouchableOpacity>
                  );
                }

                return (
                  <View key={metric.label} style={styles.metricCard}>
                    <Text style={styles.metricLabel}>{metric.label}</Text>
                    <Text style={styles.metricValue} numberOfLines={1}>
                      {metric.value}
                    </Text>
                  </View>
                );
              })}
            </View>

            {!user && (
              <View style={[styles.guestCtaCard, contentRailStyle]}>
                <View style={styles.guestCtaTextWrap}>
                  <Text style={styles.guestCtaTitle}>Browse as Guest</Text>
                  <Text style={styles.guestCtaSubtitle}>
                    Login to place orders, save products, and get notifications.
                  </Text>
                </View>
                <View style={styles.guestCtaActions}>
                  <TouchableOpacity style={styles.guestSecondaryBtn} onPress={() => navigateToAuth('Login')}>
                    <Text style={styles.guestSecondaryText}>Login</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.guestPrimaryBtn} onPress={() => navigateToAuth('Register')}>
                    <Text style={styles.guestPrimaryText}>Register</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View>
              <TouchableOpacity
                style={[styles.searchBar, isCompact && styles.searchBarCompact, contentRailStyle]}
                onPress={() => openSearchWithParams()}
                activeOpacity={0.7}
              >
                <View style={styles.searchIconWrap}>
                  <Ionicons name="search" size={17} color={COLORS.primaryDark} />
                </View>
                <Text style={styles.searchPlaceholder}>Search by product, shop, village or place...</Text>
                <Ionicons name="arrow-forward-circle" size={24} color={COLORS.primary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.regionActionButton, contentRailStyle]}
                onPress={() =>
                  navigateToBuyerTab('Explore', {
                    screen: 'ExploreMain',
                  })
                }
                activeOpacity={0.82}
              >
                <View style={styles.regionActionLeft}>
                  <Ionicons name="navigate-outline" size={16} color={COLORS.primaryDark} />
                  <Text style={styles.regionActionText}>Refine by region, district and village</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
              </TouchableOpacity>

              {productsFallbackActive && (
                <View style={[styles.fallbackNoticeBar, contentRailStyle]}>
                  <Ionicons name="information-circle-outline" size={15} color={COLORS.primaryDark} />
                  <Text style={styles.fallbackNoticeText}>{fallbackNoticeText}</Text>
                </View>
              )}
            </View>

            <View style={[styles.sectionPanel, isCompact && styles.sectionCompact, contentRailStyle]}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeadingWrap}>
                  <Text style={styles.sectionTitle}>Shop by Category</Text>
                  <Text style={styles.sectionCaption}>Explore craft lanes by product type</Text>
                </View>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoriesRow}
              >
                {CATEGORIES.slice(0, 8).map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={styles.categoryChip}
                    onPress={() => handleCategoryPress(cat.id)}
                  >
                    <Text style={styles.categoryIcon}>{cat.icon}</Text>
                    <Text style={styles.categoryName} numberOfLines={1}>
                      {cat.name.split(' ')[0]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {curatedProducts.length > 0 && (
              <View style={[styles.sectionPanel, isCompact && styles.sectionCompact, contentRailStyle]}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionHeadingWrap}>
                    <Text style={styles.sectionTitle}>Featured For You</Text>
                    <Text style={styles.sectionCaption}>{featuredCaption}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() =>
                      openSearchWithParams(
                        curatedMode === 'top-rated'
                          ? { sortBy: 'rating', region: effectiveRegionFilter }
                          : { sortBy: 'trending', region: effectiveRegionFilter }
                      )
                    }
                  >
                    <Text style={styles.seeAll}>See All</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.modeChipRow}>
                  <TouchableOpacity
                    style={[styles.modeChip, curatedMode === 'top-rated' && styles.modeChipActive]}
                    onPress={() => setCuratedMode('top-rated')}
                  >
                    <Text style={[styles.modeChipText, curatedMode === 'top-rated' && styles.modeChipTextActive]}>
                      Best Rated
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modeChip, curatedMode === 'trending' && styles.modeChipActive]}
                    onPress={() => setCuratedMode('trending')}
                  >
                    <Text style={[styles.modeChipText, curatedMode === 'trending' && styles.modeChipTextActive]}>
                      Trending Now
                    </Text>
                  </TouchableOpacity>
                </View>

                <FlatList
                  horizontal
                  data={curatedProducts}
                  keyExtractor={(item) => item.$id}
                  showsHorizontalScrollIndicator={false}
                  removeClippedSubviews={Platform.OS === 'android'}
                  initialNumToRender={2}
                  maxToRenderPerBatch={2}
                  windowSize={3}
                  updateCellsBatchingPeriod={120}
                  contentContainerStyle={styles.horizontalList}
                  renderItem={renderCuratedProductCard}
                />
              </View>
            )}

            <View style={[styles.sectionPanel, isCompact && styles.sectionCompact, contentRailStyle]}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeadingWrap}>
                  <Text style={styles.sectionTitle}>Top Artisans</Text>
                  <Text style={styles.sectionCaption}>Verified creators ranked by trust score</Text>
                </View>
                <TouchableOpacity
                  onPress={() =>
                    navigation.navigate('TopArtisans', {
                      region: effectiveRegionFilter,
                      regionLabel: productScopeLabel,
                    })
                  }
                >
                  <Text style={styles.seeAll}>See All</Text>
                </TouchableOpacity>
              </View>

              {topSellers.length > 0 ? (
                topSellers.slice(0, 4).map((seller) => (
                  <SellerCard
                    key={seller.$id}
                    seller={seller}
                    variant="premium"
                    onPress={() => navigation.navigate('SellerProfile', { sellerId: seller.$id })}
                  />
                ))
              ) : (
                <View style={styles.topArtisansEmptyWrap}>
                  <Ionicons name="people-outline" size={22} color={COLORS.textTertiary} />
                  <Text style={styles.topArtisansEmptyTitle}>{noArtisansTitle}</Text>
                  <Text style={styles.topArtisansEmptySubtitle}>
                    Try another region or continue with products available now.
                  </Text>
                  <View style={styles.topArtisansEmptyActions}>
                    <TouchableOpacity style={styles.topArtisansEmptyButton} onPress={() => setRegionPickerVisible(true)}>
                      <Text style={styles.topArtisansEmptyButtonText}>Change Region</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.topArtisansEmptyButton, styles.topArtisansEmptyButtonPrimary]}
                      onPress={() => openSearchWithParams({ sortBy: 'newest', region: effectiveRegionFilter })}
                    >
                      <Text style={[styles.topArtisansEmptyButtonText, styles.topArtisansEmptyButtonTextPrimary]}>
                        Explore Products
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            <View
              style={[
                styles.sectionPanel,
                isCompact && styles.sectionCompact,
                contentRailStyle,
              ]}
            >
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeadingWrap}>
                  <Text style={styles.sectionTitle}>Fresh Arrivals</Text>
                  <Text style={styles.sectionCaption}>{freshCaption}</Text>
                </View>
                <TouchableOpacity
                  onPress={() =>
                    openSearchWithParams({ sortBy: 'newest', region: effectiveRegionFilter })
                  }
                >
                  <Text style={styles.seeAll}>See All</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={[styles.sectionPanel, isCompact && styles.sectionCompact, contentRailStyle]}>
            <View style={styles.freshEmptyWrap}>
              <Ionicons name="leaf-outline" size={28} color={COLORS.textTertiary} />
              <Text style={styles.emptySubtext}>No fresh products available yet.</Text>
            </View>
          </View>
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.loadMoreFooter}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          ) : freshHasMore ? (
            <TouchableOpacity style={styles.freshLoadMoreButton} onPress={loadMoreFreshProducts}>
              <Text style={styles.freshLoadMoreText}>Load More</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.freshListBottomSpace} />
          )
        }
        contentContainerStyle={[
          styles.listContent,
          isLargeScreen && styles.listContentWide,
          { paddingBottom: 12 },
        ]}
      />

      <Modal
        visible={regionPickerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setRegionPickerVisible(false)}
        
      >
        <View style={styles.regionModalRoot}>
          <Pressable style={styles.regionModalBackdrop} onPress={() => setRegionPickerVisible(false)} />
          <View style={styles.regionModalSheet}>
            <View style={styles.regionModalHeader}>
              <Text style={styles.regionModalTitle}>Select Home Region</Text>
              <TouchableOpacity style={styles.regionModalClose} onPress={() => setRegionPickerVisible(false)}>
                <Ionicons name="close" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={sortedStates}
              keyExtractor={(item) => `home-region-${item}`}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.regionModalListContent}
              renderItem={({ item }) => {
                const selected = item === selectedRegion;
                return (
                  <TouchableOpacity
                    style={[styles.regionModalItem, selected && styles.regionModalItemSelected]}
                    onPress={() => handleSelectHomeRegion(item)}
                  >
                    <Text style={[styles.regionModalItemText, selected && styles.regionModalItemTextSelected]}>{item}</Text>
                    {selected ? <Ionicons name="checkmark" size={16} color={COLORS.primary} /> : null}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  pageAura: {
    position: 'absolute',
    top: -140,
    right: -90,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: `${COLORS.primary}10`,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 16,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFF',
    fontWeight: '600',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginHorizontal: 0,
    marginTop: 14,
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    overflow: 'hidden',
  },
  bannerCompact: {
    marginTop: 10,
    paddingVertical: 14,
  },
  bannerContent: {
    flex: 1,
    zIndex: 2,
  },
  heroGlowOne: {
    position: 'absolute',
    right: -26,
    top: -14,
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: `${COLORS.primary}12`,
  },
  heroGlowTwo: {
    position: 'absolute',
    left: -20,
    bottom: -34,
    width: 98,
    height: 98,
    borderRadius: 49,
    backgroundColor: `${COLORS.secondary}10`,
  },
  bannerEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: COLORS.primaryDark,
    marginBottom: 6,
  },
  bannerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 5,
  },
  bannerSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  heroChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 7,
  },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: `${COLORS.surface}E6`,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  heroChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  bannerRegionHint: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textTertiary,
  },
  cartButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${COLORS.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  cartBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: COLORS.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  platformTrustBanner: {
    marginHorizontal: 0,
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${COLORS.secondary}35`,
    backgroundColor: `${COLORS.secondary}10`,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  platformTrustIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: `${COLORS.secondary}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  platformTrustContent: {
    flex: 1,
  },
  platformTrustTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.secondaryDark,
    marginBottom: 2,
  },
  platformTrustText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
    fontWeight: '600',
  },
  metricsPanel: {
    marginHorizontal: 0,
    marginTop: 10,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${COLORS.primary}20`,
    backgroundColor: `${COLORS.primary}08`,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    gap: 8,
  },
  metricCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.background,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  metricCardAction: {
    borderColor: `${COLORS.primary}35`,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    minWidth: 0,
  },
  metricLabel: {
    fontSize: 10,
    color: COLORS.textTertiary,
    fontWeight: '700',
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metricValue: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '800',
  },
  metricValueRegion: {
    flex: 1,
    marginRight: 6,
  },
  guestCtaCard: {
    marginHorizontal: 0,
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${COLORS.primary}40`,
    backgroundColor: `${COLORS.primary}10`,
    padding: 12,
    gap: 10,
  },
  guestCtaTextWrap: {
    gap: 4,
  },
  guestCtaTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  guestCtaSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  guestCtaActions: {
    flexDirection: 'row',
    gap: 8,
  },
  guestSecondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  guestSecondaryText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  guestPrimaryBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: COLORS.primary,
  },
  guestPrimaryText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 0,
    marginTop: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  searchBarCompact: {
    marginTop: 10,
    paddingVertical: 11,
  },
  regionActionButton: {
    marginHorizontal: 0,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${COLORS.primary}20`,
    backgroundColor: `${COLORS.primary}10`,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  regionActionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  regionActionText: {
    color: COLORS.primaryDark,
    fontSize: 12,
    fontWeight: '700',
  },
  fallbackNoticeBar: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${COLORS.primary}30`,
    backgroundColor: `${COLORS.primary}14`,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  fallbackNoticeText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.primaryDark,
    fontWeight: '600',
  },
  searchIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: `${COLORS.primary}1C`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchPlaceholder: {
    fontSize: 15,
    color: COLORS.textTertiary,
    flex: 1,
  },
  section: {
    marginTop: 10,
    paddingHorizontal: 8,
  },
  sectionPanel: {
    marginTop: 10,
    marginHorizontal: 0,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${COLORS.primary}20`,
    backgroundColor: `${COLORS.primary}08`,
    paddingHorizontal: 6,
    paddingTop: 10,
    paddingBottom: 4,
  },
  contentRailWide: {
    width: '100%',
    maxWidth: BUYER_LAYOUT.railMaxWidth,
    alignSelf: 'center',
  },
  sectionCompact: {
    marginTop: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  sectionHeadingWrap: {
    flex: 1,
    paddingRight: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 0,
  },
  sectionCaption: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  topArtisansEmptyWrap: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${COLORS.primary}25`,
    backgroundColor: `${COLORS.surface}CC`,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: 'flex-start',
    gap: 6,
  },
  topArtisansEmptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  topArtisansEmptySubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
    lineHeight: 18,
  },
  topArtisansEmptyActions: {
    marginTop: 2,
    flexDirection: 'row',
    gap: 8,
  },
  topArtisansEmptyButton: {
    borderWidth: 1,
    borderColor: `${COLORS.primary}40`,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  topArtisansEmptyButtonPrimary: {
    backgroundColor: `${COLORS.primary}12`,
  },
  topArtisansEmptyButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
  },
  topArtisansEmptyButtonTextPrimary: {
    color: COLORS.primaryDark,
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    marginTop: 4,
  },
  modeChipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  modeChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  modeChipActive: {
    borderColor: `${COLORS.primary}55`,
    backgroundColor: `${COLORS.primary}12`,
  },
  modeChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  modeChipTextActive: {
    color: COLORS.primaryDark,
  },
  categoriesRow: {
    gap: 10,
    paddingBottom: 10,
  },
  categoryChip: {
    alignItems: 'center',
    width: 82,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.background,
    paddingVertical: 8,
  },
  categoryIcon: {
    fontSize: 26,
    marginBottom: 6,
    width: 52,
    height: 52,
    lineHeight: 52,
    textAlign: 'center',
    backgroundColor: `${COLORS.primary}14`,
    borderRadius: 26,
    overflow: 'hidden',
  },
  categoryName: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  horizontalList: {
    gap: 8,
    paddingHorizontal: 0,
  },
  horizontalCard: {
    width: 1,
  },
  horizontalCardCompact: {
    width: 1,
  },
  freshGridList: {
    marginTop: 2,
  },
  freshGridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  freshGridItem: {
    width: '49.2%',
  },
  freshEmptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  freshLoadMoreButton: {
    alignSelf: 'center',
    marginTop: 2,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: `${COLORS.primary}44`,
    backgroundColor: `${COLORS.primary}10`,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  freshLoadMoreText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  row: {
    justifyContent: 'space-between',
  },
  gridItem: {
    width: '49%',
  },
  loadMoreFooter: {
    paddingVertical: 12,
  },
  freshListBottomSpace: {
    height: 6,
  },
  listContent: {
    paddingHorizontal: 8,
  },
  listContentWide: {
    width: '100%',
    maxWidth: BUYER_LAYOUT.railMaxWidth,
    alignSelf: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  emptySection: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  regionModalRoot: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  regionModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  regionModalSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: '52%',
    maxHeight: '80%',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
  },
  regionModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  regionModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  regionModalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  regionModalListContent: {
    paddingBottom: 4,
  },
  regionModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 8,
  },
  regionModalItemSelected: {
    borderColor: `${COLORS.primary}50`,
    backgroundColor: `${COLORS.primary}10`,
  },
  regionModalItemText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
  },
  regionModalItemTextSelected: {
    color: COLORS.primary,
  },
});

export default HomeScreen;
