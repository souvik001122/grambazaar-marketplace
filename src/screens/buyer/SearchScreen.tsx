import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
  Keyboard,
  Platform,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Ionicons } from '@expo/vector-icons';
import { ProductCard } from '../../components/ProductCard';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { Product } from '../../types/product.types';
import { searchMarketplaceProducts } from '../../services/productService';
import { COLORS } from '../../constants/colors';
import { CATEGORIES } from '../../constants/categories';
import { BUYER_LAYOUT } from '../../constants/layout';
import { useAuth } from '../../context/AuthContext';
import { buildAutosuggestions } from '../../utils/autosuggest';
import { PremiumTopBar } from '../../components/PremiumTopBar';

type SortOption = 'newest' | 'rating' | 'trending' | 'trust_high';
const SORT_OPTIONS: { key: SortOption; label: string }[] = [
  { key: 'newest', label: 'Newest' },
  { key: 'rating', label: 'Top Rated' },
  { key: 'trending', label: 'Trending' },
  { key: 'trust_high', label: 'Most Trusted' },
];

const isSortOption = (value: string): value is SortOption =>
  SORT_OPTIONS.some((option) => option.key === value);

const SMART_SUGGESTIONS = [
  'Kashmiri shawl',
  'Pottery in Khurja',
  'Tea in Darjeeling',
  'Wood carving Saharanpur',
  'Jaipur block print',
  'Brass art Moradabad',
];

const PRICE_VISUAL_MIN = 0;
const PRICE_VISUAL_MAX = 20000;
const SEARCH_PAGE_SIZE = 12;

const clampNumber = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const parsePriceInput = (value: string): number | undefined => {
  const cleaned = value.trim();
  if (!cleaned) {
    return undefined;
  }

  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return clampNumber(parsed, PRICE_VISUAL_MIN, PRICE_VISUAL_MAX);
};

const parseRatingInput = (value: string): number | undefined => {
  const cleaned = value.trim();
  if (!cleaned) {
    return undefined;
  }

  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return clampNumber(parsed, 0, 5);
};

const SearchScreen = ({ navigation, route }: any) => {
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const isCompact = screenHeight < 760;
  const isLargeScreen = screenWidth >= BUYER_LAYOUT.railBreakpoint;
  const wideRailStyle = isLargeScreen ? styles.contentRailWide : undefined;
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [localityQuery, setLocalityQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [sortBy, setSortBy] = useState<SortOption | ''>('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minRating, setMinRating] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [topArtisansOnly, setTopArtisansOnly] = useState(false);
  const [deliveryOnly, setDeliveryOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [searchFocused, setSearchFocused] = useState(false);
  const [categoryExpanded, setCategoryExpanded] = useState(true);
  const [trustExpanded, setTrustExpanded] = useState(true);
  const [priceExpanded, setPriceExpanded] = useState(true);
  const [ratingExpanded, setRatingExpanded] = useState(true);
  const [homeSearchTrigger, setHomeSearchTrigger] = useState(0);
  const latestSearchRequestId = useRef(0);

  useEffect(() => {
    const routeParams = route?.params || {};
    const routeCategory = route?.params?.category || '';
    const routeSort = route?.params?.sortBy || '';
    const routeRegion = route?.params?.region || '';
    const routeLocality = route?.params?.localityQuery || '';
    const routeFromHomeTs = route?.params?._fromHomeTs || 0;
    const hasSearchQueryParam = Object.prototype.hasOwnProperty.call(routeParams, 'searchQuery');
    const routeSearchQuery = route?.params?.searchQuery || '';
    const hasTopArtisansParam = Object.prototype.hasOwnProperty.call(route?.params || {}, 'topArtisansOnly');
    const routeTopArtisansOnly = !!route?.params?.topArtisansOnly;
    const hasVerifiedParam = Object.prototype.hasOwnProperty.call(route?.params || {}, 'verifiedSellers');
    const routeVerifiedOnly = !!route?.params?.verifiedSellers;
    const hasDeliveryParam = Object.prototype.hasOwnProperty.call(route?.params || {}, 'deliveryAvailable');
    const routeDeliveryOnly = !!route?.params?.deliveryAvailable;

    if (!routeFromHomeTs && !routeCategory && !routeSort && !routeRegion && !routeLocality && !hasTopArtisansParam && !hasVerifiedParam && !hasDeliveryParam) {
      return;
    }

    // Home navigation should reset stale filter context before applying incoming params.
    setSelectedCategory(routeCategory || '');
    setSortBy(isSortOption(routeSort) ? routeSort : '');
    setSelectedRegion(routeRegion || '');
    setLocalityQuery(routeLocality || '');
    setSearchQuery(hasSearchQueryParam ? routeSearchQuery : '');
    setTopArtisansOnly(hasTopArtisansParam ? routeTopArtisansOnly : false);
    setVerifiedOnly(hasVerifiedParam ? routeVerifiedOnly : false);
    setDeliveryOnly(hasDeliveryParam ? routeDeliveryOnly : false);
    setMinPrice('');
    setMaxPrice('');
    setMinRating('');
    setPage(1);
    setHasMore(false);

    const hasAnyIncomingFilter =
      !!routeCategory ||
      !!routeSort ||
      !!routeRegion ||
      !!routeLocality ||
      (hasSearchQueryParam && !!routeSearchQuery) ||
      (hasTopArtisansParam && routeTopArtisansOnly) ||
      (hasVerifiedParam && routeVerifiedOnly) ||
      (hasDeliveryParam && routeDeliveryOnly);

    if (hasAnyIncomingFilter) {
      setShowFilters(false);
      setSearched(true);
      setHomeSearchTrigger(routeFromHomeTs || Date.now());
      return;
    }

    if (routeFromHomeTs) {
      setShowFilters(false);
      setProducts([]);
      setSearched(false);
      setHomeSearchTrigger(routeFromHomeTs);
    }
  }, [
    route?.params?.category,
    route?.params?.sortBy,
    route?.params?.region,
    route?.params?.localityQuery,
    route?.params?.searchQuery,
    route?.params?.topArtisansOnly,
    route?.params?.verifiedSellers,
    route?.params?.deliveryAvailable,
    route?.params?._fromHomeTs,
  ]);

  const hasAutoSearchContext = useMemo(
    () =>
      !!selectedCategory ||
      !!sortBy ||
      !!selectedRegion ||
      !!localityQuery.trim() ||
      verifiedOnly ||
      topArtisansOnly ||
      deliveryOnly ||
      !!minPrice.trim() ||
      !!maxPrice.trim() ||
      !!minRating.trim(),
    [
      deliveryOnly,
      localityQuery,
      maxPrice,
      minPrice,
      minRating,
      selectedCategory,
      selectedRegion,
      sortBy,
      topArtisansOnly,
      verifiedOnly,
    ]
  );

  const filterLiveSignature = useMemo(
    () =>
      [
        selectedCategory,
        sortBy,
        selectedRegion,
        localityQuery.trim(),
        minPrice.trim(),
        maxPrice.trim(),
        minRating.trim(),
        verifiedOnly ? '1' : '0',
        topArtisansOnly ? '1' : '0',
        deliveryOnly ? '1' : '0',
      ].join('|'),
    [
      deliveryOnly,
      localityQuery,
      maxPrice,
      minPrice,
      minRating,
      selectedCategory,
      selectedRegion,
      sortBy,
      topArtisansOnly,
      verifiedOnly,
    ]
  );

  const performSearch = useCallback(
    async (
      reset: boolean = true,
      overrides?: {
        searchQuery?: string;
        localityQuery?: string;
      }
    ) => {
      const p = reset ? 1 : page + 1;
      const searchValue = (overrides?.searchQuery ?? searchQuery).trim();
      const localityValue = (overrides?.localityQuery ?? localityQuery).trim();
      const rawMinPrice = parsePriceInput(minPrice);
      const rawMaxPrice = parsePriceInput(maxPrice);
      const normalizedRatingFilter = parseRatingInput(minRating);
      const normalizedMinPrice =
        rawMinPrice !== undefined && rawMaxPrice !== undefined
          ? Math.min(rawMinPrice, rawMaxPrice)
          : rawMinPrice;
      const normalizedMaxPrice =
        rawMinPrice !== undefined && rawMaxPrice !== undefined
          ? Math.max(rawMinPrice, rawMaxPrice)
          : rawMaxPrice;
      const effectiveMinPrice =
        normalizedMinPrice !== undefined && normalizedMinPrice > PRICE_VISUAL_MIN
          ? normalizedMinPrice
          : undefined;
      const effectiveMaxPrice =
        normalizedMaxPrice !== undefined && normalizedMaxPrice < PRICE_VISUAL_MAX
          ? normalizedMaxPrice
          : undefined;
      const requestId = ++latestSearchRequestId.current;

      try {
        if (reset) {
          setLoading(true);
        } else {
          setLoadingMore(true);
        }
        setSearched(true);

        const response = await searchMarketplaceProducts(
          {
            searchQuery: searchValue || undefined,
            localityQuery: localityValue || undefined,
            category: selectedCategory || undefined,
            region: selectedRegion || undefined,
            minPrice: effectiveMinPrice,
            maxPrice: effectiveMaxPrice,
            minRating: normalizedRatingFilter,
            sortBy: sortBy || undefined,
            verifiedSellers: verifiedOnly || undefined,
            topArtisansOnly: topArtisansOnly || undefined,
            deliveryAvailable: deliveryOnly || undefined,
          },
          p,
          SEARCH_PAGE_SIZE
        );

        if (requestId !== latestSearchRequestId.current) {
          return;
        }

        if (reset) {
          setProducts(response.data);
        } else {
          setProducts((prev) => {
            const existingIds = new Set(prev.map((product) => product.$id));
            const merged = [...prev];

            for (const product of response.data) {
              if (!existingIds.has(product.$id)) {
                existingIds.add(product.$id);
                merged.push(product);
              }
            }

            return merged;
          });
        }
        setHasMore(response.hasMore);
        setTotal(response.total);
        setPage(p);
      } catch (error) {
        if (requestId !== latestSearchRequestId.current) {
          return;
        }
        console.error('Search error:', error);
      } finally {
        if (requestId === latestSearchRequestId.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [
      localityQuery,
      page,
      searchQuery,
      selectedCategory,
      selectedRegion,
      minPrice,
      maxPrice,
      minRating,
      sortBy,
      verifiedOnly,
      topArtisansOnly,
      deliveryOnly,
    ]
  );

  useEffect(() => {
    if (!showFilters && searched && hasAutoSearchContext) {
      performSearch(true);
    }
  }, [searched, hasAutoSearchContext, homeSearchTrigger, performSearch, showFilters]);

  useEffect(() => {
    if (!showFilters) {
      return;
    }

    if (!hasAutoSearchContext && !searched) {
      return;
    }

    const timeoutId = setTimeout(() => {
      performSearch(true);
    }, 180);

    return () => clearTimeout(timeoutId);
  }, [showFilters, filterLiveSignature, hasAutoSearchContext, searched, performSearch]);

  useEffect(() => {
    if (selectedCategory) {
      setCategoryExpanded(true);
    }
    if (verifiedOnly || topArtisansOnly || deliveryOnly) {
      setTrustExpanded(true);
    }
    if (minPrice.trim() || maxPrice.trim()) {
      setPriceExpanded(true);
    }
    if (minRating.trim()) {
      setRatingExpanded(true);
    }
  }, [
    selectedCategory,
    verifiedOnly,
    topArtisansOnly,
    deliveryOnly,
    minPrice,
    maxPrice,
    minRating,
  ]);

  const runSearch = (overrideSearchQuery?: string) => {
    const searchValue = overrideSearchQuery ?? searchQuery;
    const cleaned = searchValue.trim();

    if (typeof overrideSearchQuery === 'string') {
      setSearchQuery(overrideSearchQuery);
    }

    if (cleaned) {
      setRecentQueries((prev) => {
        const deduped = [cleaned, ...prev.filter((value) => value.toLowerCase() !== cleaned.toLowerCase())];
        return deduped.slice(0, 6);
      });
    }
    performSearch(true, typeof overrideSearchQuery === 'string' ? { searchQuery: overrideSearchQuery } : undefined);
  };

  const handleSearch = () => {
    runSearch();
  };

  const handleClearFilters = () => {
    setSelectedCategory('');
    setSelectedRegion('');
    setSortBy('');
    setLocalityQuery('');
    setMinPrice('');
    setMaxPrice('');
    setMinRating('');
    setVerifiedOnly(false);
    setTopArtisansOnly(false);
    setDeliveryOnly(false);

    // Keep the filter panel open and preserve search context; live update effect will refresh totals.
    if (!searched) {
      setSearched(true);
    }
  };

  const handleProductPress = useCallback((product: Product) => {
    navigation.navigate('ProductDetail', { productId: product.$id });
  }, [navigation]);

  const navigateToAuth = (screen: 'Login' | 'Register') => {
    const lvl1 = navigation.getParent?.();
    const lvl2 = lvl1?.getParent?.();
    const lvl3 = lvl2?.getParent?.();
    const root = lvl3 || lvl2 || lvl1;

    if (root?.navigate) {
      root.navigate(screen);
      return;
    }

    navigation.navigate(screen);
  };

  const renderProduct = useCallback(
    ({ item }: { item: Product }) => (
      <ProductCard product={item} performanceMode="list" onPress={() => handleProductPress(item)} />
    ),
    [handleProductPress]
  );

  const handleLoadMore = () => {
    if (hasMore && !loading && !loadingMore) {
      performSearch(false);
    }
  };

  const sortCount = sortBy ? 1 : 0;
  const categoryCount = selectedCategory ? 1 : 0;
  const trustCount = [verifiedOnly, topArtisansOnly, deliveryOnly].filter(Boolean).length;
  const rawMinPrice = parsePriceInput(minPrice);
  const rawMaxPrice = parsePriceInput(maxPrice);
  const normalizedMinPrice =
    rawMinPrice !== undefined && rawMaxPrice !== undefined
      ? Math.min(rawMinPrice, rawMaxPrice)
      : rawMinPrice;
  const normalizedMaxPrice =
    rawMinPrice !== undefined && rawMaxPrice !== undefined
      ? Math.max(rawMinPrice, rawMaxPrice)
      : rawMaxPrice;
  const hasPriceSelection =
    (normalizedMinPrice !== undefined && normalizedMinPrice > PRICE_VISUAL_MIN) ||
    (normalizedMaxPrice !== undefined && normalizedMaxPrice < PRICE_VISUAL_MAX);
  const priceCount = hasPriceSelection ? 1 : 0;
  const ratingCount = minRating.trim() ? 1 : 0;
  const ratingPreview = parseRatingInput(minRating) ?? 0;

  const activeFilterCount = [
    selectedCategory,
    sortBy,
    selectedRegion,
    localityQuery,
    hasPriceSelection,
    minRating,
    verifiedOnly,
    topArtisansOnly,
    deliveryOnly,
  ]
    .filter(Boolean).length;

  const safeMinPrice = normalizedMinPrice ?? PRICE_VISUAL_MIN;
  const safeMaxPrice = normalizedMaxPrice ?? PRICE_VISUAL_MAX;
  const sliderRange = PRICE_VISUAL_MAX - PRICE_VISUAL_MIN;
  const priceVisualLeftPct = sliderRange > 0 ? ((safeMinPrice - PRICE_VISUAL_MIN) / sliderRange) * 100 : 0;
  const priceVisualWidthPct = sliderRange > 0 ? ((safeMaxPrice - safeMinPrice) / sliderRange) * 100 : 0;

  const visibleSuggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const pool = [...recentQueries, ...SMART_SUGGESTIONS];
    const deduped = Array.from(new Set(pool));

    const scored = deduped
      .map((item) => {
        const normalized = item.toLowerCase();
        let score = 0;

        if (!q) {
          score = 1;
        } else if (normalized.startsWith(q)) {
          score = 3;
        } else if (normalized.includes(q)) {
          score = 2;
        }

        return { item, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, 6).map((entry) => entry.item);
  }, [recentQueries, searchQuery]);

  const searchTypeSuggestionPool = useMemo(
    () => [
      ...recentQueries,
      ...SMART_SUGGESTIONS,
      ...CATEGORIES.map((item) => item.name),
      ...products.slice(0, 80).map((item) => item.name),
    ],
    [products, recentQueries]
  );

  const searchTypeSuggestions = useMemo(
    () => buildAutosuggestions(searchQuery, searchTypeSuggestionPool, 6),
    [searchQuery, searchTypeSuggestionPool]
  );

  const sortLabelMap: Record<string, string> = {
    newest: 'Newest',
    rating: 'Top Rated',
    trending: 'Trending',
    trust_high: 'Most Trusted',
  };

  const selectedCategoryLabel =
    CATEGORIES.find((item) => item.id === selectedCategory)?.name || selectedCategory;

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string }> = [];

    if (selectedCategory) {
      chips.push({ key: 'category', label: selectedCategoryLabel });
    }
    if (sortBy) {
      chips.push({ key: 'sort', label: `Sort: ${sortLabelMap[sortBy] || sortBy}` });
    }
    if (selectedRegion) {
      chips.push({ key: 'region', label: selectedRegion });
    }
    if (localityQuery.trim()) {
      chips.push({ key: 'locality', label: localityQuery.trim() });
    }
    if (verifiedOnly) {
      chips.push({ key: 'verified', label: 'Verified only' });
    }
    if (topArtisansOnly) {
      chips.push({ key: 'top', label: 'Top artisans' });
    }
    if (deliveryOnly) {
      chips.push({ key: 'delivery', label: 'Delivery' });
    }
    if (hasPriceSelection) {
      const labelMin =
        normalizedMinPrice !== undefined && normalizedMinPrice > PRICE_VISUAL_MIN
          ? normalizedMinPrice
          : PRICE_VISUAL_MIN;
      const labelMax =
        normalizedMaxPrice !== undefined && normalizedMaxPrice < PRICE_VISUAL_MAX
          ? normalizedMaxPrice
          : PRICE_VISUAL_MAX;
      chips.push({
        key: 'price',
        label: `Price ${labelMin}-${labelMax}`,
      });
    }
    if (minRating.trim()) {
      chips.push({ key: 'rating', label: `Rating >= ${ratingPreview || minRating.trim()}` });
    }

    return chips;
  }, [
    deliveryOnly,
    localityQuery,
    maxPrice,
    minPrice,
    minRating,
    normalizedMaxPrice,
    normalizedMinPrice,
    selectedCategory,
    selectedCategoryLabel,
    selectedRegion,
    sortBy,
    topArtisansOnly,
    verifiedOnly,
  ]);

  const clearSingleFilter = (key: string) => {
    switch (key) {
      case 'category':
        setSelectedCategory('');
        break;
      case 'sort':
        setSortBy('');
        break;
      case 'region':
        setSelectedRegion('');
        break;
      case 'locality':
        setLocalityQuery('');
        break;
      case 'verified':
        setVerifiedOnly(false);
        break;
      case 'top':
        setTopArtisansOnly(false);
        break;
      case 'delivery':
        setDeliveryOnly(false);
        break;
      case 'price':
        setMinPrice('');
        setMaxPrice('');
        break;
      case 'rating':
        setMinRating('');
        break;
      default:
        break;
    }
  };

  const formatRupees = (value: number) => `₹${Math.round(value).toLocaleString('en-IN')}`;

  const hasActiveFilters = activeFilterCount > 0;
  const resultCtaLabel = !hasActiveFilters
    ? 'Show All Results'
    : loading || !searched
      ? 'Checking results...'
      : `Show ${total} Result${total === 1 ? '' : 's'}`;

  const handlePriceInput = (field: 'min' | 'max', value: string) => {
    const cleaned = value.replace(/\D/g, '');

    if (!cleaned) {
      if (field === 'min') {
        setMinPrice('');
      } else {
        setMaxPrice('');
      }
      return;
    }

    const clamped = clampNumber(Number(cleaned), PRICE_VISUAL_MIN, PRICE_VISUAL_MAX);

    if (field === 'min') {
      setMinPrice(String(clamped));
      return;
    }

    setMaxPrice(String(clamped));
  };

  const normalizePriceInputOrder = () => {
    const parsedMin = parsePriceInput(minPrice);
    const parsedMax = parsePriceInput(maxPrice);

    if (parsedMin === undefined || parsedMax === undefined || parsedMin <= parsedMax) {
      return;
    }

    setMinPrice(String(parsedMax));
    setMaxPrice(String(parsedMin));
  };

  return (
    <View style={styles.container}>
      <PremiumTopBar
        title="Search"
        subtitle="Find products, artisans, and locations"
        icon="search"
        rightLabel={showFilters ? 'Hide Filters' : hasActiveFilters ? `Filters ${activeFilterCount}` : 'Filters'}
        onRightPress={() => setShowFilters((prev) => !prev)}
      />

      {!user && (
        <View style={[styles.guestBar, wideRailStyle]}>
          <Text style={styles.guestBarText}>Login to save products and place orders</Text>
          <View style={styles.guestBarActions}>
            <TouchableOpacity style={styles.guestBarSecondary} onPress={() => navigateToAuth('Login')}>
              <Text style={styles.guestBarSecondaryText}>Login</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.guestBarPrimary} onPress={() => navigateToAuth('Register')}>
              <Text style={styles.guestBarPrimaryText}>Register</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={[styles.searchContainer, isCompact && styles.searchContainerCompact, wideRailStyle]}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={COLORS.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={'Search "Darjeeling tea", "Khurja pottery"...'}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => {
              setTimeout(() => setSearchFocused(false), 220);
            }}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
              }}
            >
              <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <Ionicons name="search" size={20} color="#FFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterToggle, activeFilterCount > 0 && styles.filterToggleActive]}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Ionicons name="options-outline" size={20} color={activeFilterCount > 0 ? '#FFF' : COLORS.text} />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {activeFilterChips.length > 0 && (
        <View style={[styles.activeChipRowWrap, wideRailStyle]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeChipRow}>
            {activeFilterChips.map((chip) => (
              <TouchableOpacity
                key={`active-chip-${chip.key}`}
                style={styles.activeFilterChip}
                onPress={() => clearSingleFilter(chip.key)}
              >
                <Text style={styles.activeFilterChipText} numberOfLines={1}>{chip.label}</Text>
                <Ionicons name="close" size={13} color={COLORS.primary} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {!showFilters && searchFocused && searchTypeSuggestions.length > 0 && (
        <View style={[styles.inputSuggestWrap, wideRailStyle]}>
          {searchTypeSuggestions.map((item) => (
            <TouchableOpacity
              key={`search-suggest-${item}`}
              style={styles.inputSuggestItem}
              activeOpacity={0.85}
              onPressIn={() => {
                setSearchQuery(item);
              }}
              onPress={() => {
                setSearchFocused(false);
                setTimeout(() => runSearch(item), 0);
              }}
            >
              <Ionicons name="sparkles-outline" size={15} color={COLORS.primary} />
              <Text style={styles.inputSuggestText}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {showFilters && (
        <View style={[styles.filtersOverlay, wideRailStyle]}>
        <KeyboardAwareScrollView
          style={[styles.filtersPanel, isCompact && styles.filtersPanelCompact]}
          contentContainerStyle={styles.filtersPanelContent}
          keyboardShouldPersistTaps="handled"
          enableOnAndroid
          extraScrollHeight={24}
          extraHeight={120}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.filtersHeaderTop}>
            <View style={styles.filtersHeadingWrap}>
              <Text style={styles.filtersHeading}>Refine Results</Text>
              <Text style={styles.filtersSubheading}>Dial in quality, craft type, and local trust</Text>
            </View>
            <View style={styles.filtersHeaderActions}>
              {activeFilterCount > 0 && (
                <View style={styles.activeFiltersPill}>
                  <Text style={styles.activeFiltersPillText}>{activeFilterCount} active</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.filtersCloseButton}
                onPress={() => {
                  Keyboard.dismiss();
                  setShowFilters(false);
                }}
              >
                <Ionicons name="close" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {!!selectedRegion && (
            <View style={styles.scopeRegionCard}>
              <View style={styles.scopeRegionTextWrap}>
                <Text style={styles.scopeRegionLabel}>Home Region Scope</Text>
                <Text style={styles.scopeRegionValue}>{selectedRegion}</Text>
              </View>
              <TouchableOpacity style={styles.scopeRegionClearBtn} onPress={() => setSelectedRegion('')}>
                <Text style={styles.scopeRegionClearText}>Clear</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.quickSortCard}>
            <View style={styles.filterLabelRow}>
              <View style={styles.filterLabelGroup}>
                <Text style={styles.filterLabel}>Quick Sort</Text>
                {sortCount > 0 && <Text style={styles.filterCountBadge}>{sortCount}</Text>}
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickSortRow}>
              {SORT_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.quickSortChip, sortBy === opt.key && styles.quickSortChipActive]}
                  onPress={() => setSortBy(sortBy === opt.key ? '' : opt.key)}
                >
                  <Text style={[styles.quickSortChipText, sortBy === opt.key && styles.quickSortChipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.filterSectionCard}>
            <View style={styles.filterLabelRow}>
              <View style={styles.filterLabelGroup}>
                <Text style={styles.filterLabel}>Category</Text>
                {categoryCount > 0 && <Text style={styles.filterCountBadge}>{categoryCount}</Text>}
              </View>
              <TouchableOpacity style={styles.filterSectionToggle} onPress={() => setCategoryExpanded((value) => !value)}>
                <Text style={styles.filterSectionToggleText}>{categoryExpanded ? 'Hide' : 'Show'}</Text>
                <Ionicons
                  name={categoryExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                  size={16}
                  color={COLORS.primary}
                />
              </TouchableOpacity>
            </View>
            {categoryExpanded && (
              <View style={styles.chipWrap}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.chip, selectedCategory === cat.id && styles.chipActive]}
                    onPress={() => setSelectedCategory(selectedCategory === cat.id ? '' : cat.id)}
                  >
                    <Text style={[styles.chipText, selectedCategory === cat.id && styles.chipTextActive]}>
                      {cat.icon} {cat.name.split(' ')[0]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={styles.filterSectionCard}>
            <View style={styles.filterLabelRow}>
              <View style={styles.filterLabelGroup}>
                <Text style={styles.filterLabel}>Best Match Signals</Text>
                {trustCount > 0 && <Text style={styles.filterCountBadge}>{trustCount}</Text>}
              </View>
              <TouchableOpacity style={styles.filterSectionToggle} onPress={() => setTrustExpanded((value) => !value)}>
                <Text style={styles.filterSectionToggleText}>{trustExpanded ? 'Hide' : 'Show'}</Text>
                <Ionicons
                  name={trustExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                  size={16}
                  color={COLORS.primary}
                />
              </TouchableOpacity>
            </View>
            {trustExpanded && (
              <View style={styles.trustRow}>
                <TouchableOpacity
                  style={[styles.chip, verifiedOnly && styles.chipActive]}
                  onPress={() => setVerifiedOnly((value) => !value)}
                >
                  <Text style={[styles.chipText, verifiedOnly && styles.chipTextActive]}>Verified artisans only</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, topArtisansOnly && styles.chipActive]}
                  onPress={() => setTopArtisansOnly((value) => !value)}
                >
                  <Text style={[styles.chipText, topArtisansOnly && styles.chipTextActive]}>Top artisans only</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, deliveryOnly && styles.chipActive]}
                  onPress={() => setDeliveryOnly((value) => !value)}
                >
                  <Text style={[styles.chipText, deliveryOnly && styles.chipTextActive]}>Delivery available</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.filterSectionCard}>
            <View style={styles.filterLabelRow}>
              <View style={styles.filterLabelGroup}>
                <Text style={styles.filterLabel}>Price Range</Text>
                {priceCount > 0 && <Text style={styles.filterCountBadge}>{priceCount}</Text>}
              </View>
              <TouchableOpacity style={styles.filterSectionToggle} onPress={() => setPriceExpanded((value) => !value)}>
                <Text style={styles.filterSectionToggleText}>{priceExpanded ? 'Hide' : 'Show'}</Text>
                <Ionicons
                  name={priceExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                  size={16}
                  color={COLORS.primary}
                />
              </TouchableOpacity>
            </View>
            {priceExpanded && (
              <>
                <View style={styles.priceRangeVisualCard}>
                  <View style={styles.priceRangeTrack}>
                    <View style={styles.priceRangeTrackBase} />
                    <View
                      style={[
                        styles.priceRangeFill,
                        {
                          left: `${priceVisualLeftPct}%`,
                          width: `${hasPriceSelection ? Math.max(2, priceVisualWidthPct) : 0}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.priceRangeText}>
                    {safeMinPrice > PRICE_VISUAL_MIN || safeMaxPrice < PRICE_VISUAL_MAX
                      ? `${formatRupees(safeMinPrice)} to ${formatRupees(safeMaxPrice)}`
                      : 'No price bound selected'}
                  </Text>
                </View>

                <View style={styles.numericRow}>
                  <TextInput
                    style={[styles.localityInput, styles.numericInput]}
                    value={minPrice}
                    onChangeText={(value) => handlePriceInput('min', value)}
                    onBlur={normalizePriceInputOrder}
                    placeholder="Min ₹"
                    keyboardType="number-pad"
                    returnKeyType="done"
                  />
                  <TextInput
                    style={[styles.localityInput, styles.numericInput]}
                    value={maxPrice}
                    onChangeText={(value) => handlePriceInput('max', value)}
                    onBlur={normalizePriceInputOrder}
                    placeholder="Max ₹"
                    keyboardType="number-pad"
                    returnKeyType="done"
                  />
                </View>

                <View style={styles.priceMetaRow}>
                  <Text style={styles.priceHelperText}>Allowed range: ₹0 to ₹20,000. Higher values auto-capped. If Min is above Max, values auto-correct.</Text>
                  {hasPriceSelection ? (
                    <TouchableOpacity
                      style={styles.priceResetInlineButton}
                      onPress={() => {
                        setMinPrice('');
                        setMaxPrice('');
                      }}
                    >
                      <Text style={styles.priceResetInlineText}>Reset</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </>
            )}
          </View>

          <View style={styles.filterSectionCard}>
            <View style={styles.filterLabelRow}>
              <View style={styles.filterLabelGroup}>
                <Text style={styles.filterLabel}>Rating</Text>
                {ratingCount > 0 && <Text style={styles.filterCountBadge}>{ratingCount}</Text>}
              </View>
              <TouchableOpacity style={styles.filterSectionToggle} onPress={() => setRatingExpanded((value) => !value)}>
                <Text style={styles.filterSectionToggleText}>{ratingExpanded ? 'Hide' : 'Show'}</Text>
                <Ionicons
                  name={ratingExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                  size={16}
                  color={COLORS.primary}
                />
              </TouchableOpacity>
            </View>
            {ratingExpanded && (
              <>
                <View style={styles.ratingVisualCard}>
                  <View style={styles.ratingStarRow}>
                    {[0, 1, 2, 3, 4].map((index) => {
                      const fillRatio = clampNumber(ratingPreview - index, 0, 1);

                      return (
                        <View key={`rating-star-${index + 1}`} style={styles.ratingStarCell}>
                          <Ionicons name="star-outline" size={16} color="#F59E0B" />
                          <View style={[styles.ratingStarFillClip, { width: `${fillRatio * 100}%` }]}>
                            <Ionicons name="star" size={16} color="#F59E0B" />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                  <Text style={styles.ratingVisualText}>
                    {minRating.trim() ? `Minimum ${minRating.trim()} and above` : 'No minimum rating selected'}
                  </Text>
                </View>

                <TextInput
                  style={styles.localityInput}
                  value={minRating}
                  onChangeText={(value) => {
                    const cleaned = value.replace(/[^0-9.]/g, '');
                    const singleDot = cleaned.replace(/(\..*)\./g, '$1');

                    if (!singleDot) {
                      setMinRating('');
                      return;
                    }

                    if (singleDot.endsWith('.')) {
                      const intPart = Number(singleDot.slice(0, -1));
                      if (Number.isFinite(intPart)) {
                        setMinRating(`${clampNumber(intPart, 0, 5)}.`);
                        return;
                      }
                    }

                    const parsed = Number(singleDot);
                    if (!Number.isFinite(parsed)) {
                      setMinRating(singleDot);
                      return;
                    }

                    setMinRating(String(clampNumber(parsed, 0, 5)));
                  }}
                  placeholder="Custom minimum rating (0 to 5)"
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  blurOnSubmit
                />

                <View style={styles.ratingMetaRow}>
                  <Text style={styles.ratingHelperText}>Allowed range: 0 to 5 rating.</Text>
                  {minRating.trim() ? (
                    <TouchableOpacity style={styles.ratingResetInlineButton} onPress={() => setMinRating('')}>
                      <Text style={styles.ratingResetInlineText}>Reset</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </>
            )}
          </View>
        </KeyboardAwareScrollView>

        <View style={styles.filterActionsBar}>
          <View style={styles.filterActionsButtonsRow}>
            <TouchableOpacity style={styles.clearButtonGhost} onPress={handleClearFilters}>
              <Text style={styles.clearFilters}>Clear All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.applyButton, loading && styles.applyButtonDisabled]}
              disabled={loading}
              onPress={() => {
                Keyboard.dismiss();
                setShowFilters(false);
                performSearch(true);
              }}
            >
              <Text style={styles.applyButtonText}>{resultCtaLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
        </View>
      )}

      {!showFilters && !searched && (
        <View style={[styles.suggestionWrap, wideRailStyle]}>
          <Text style={styles.suggestionTitle}>Smart Suggestions</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionRow} keyboardShouldPersistTaps="handled">
            {visibleSuggestions.map((suggestion) => (
              <TouchableOpacity
                key={suggestion}
                style={styles.suggestionChip}
                onPress={() => {
                  setSearchQuery(suggestion);
                  setTimeout(() => performSearch(true), 0);
                }}
              >
                <Ionicons name="sparkles-outline" size={14} color={COLORS.primary} />
                <Text style={styles.suggestionText}>{suggestion}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {searched && !loading && !showFilters && total > 0 && (
        <View style={[styles.resultBar, wideRailStyle]}>
          <Text style={styles.resultText} numberOfLines={1} ellipsizeMode="tail">
            {total} result{total === 1 ? '' : 's'} found
          </Text>
        </View>
      )}

      {!showFilters && (loading && !products.length ? (
        <LoadingSpinner />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.$id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          removeClippedSubviews={Platform.OS === 'android'}
          initialNumToRender={3}
          maxToRenderPerBatch={3}
          windowSize={4}
          updateCellsBatchingPeriod={110}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={Keyboard.dismiss}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            isCompact && styles.listContentCompact,
            wideRailStyle,
            { paddingBottom: 12 },
          ]}
          renderItem={renderProduct}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.2}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.loadMoreFooter}>
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            searched ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="search" size={64} color={COLORS.textTertiary} />
                <Text style={styles.emptyText}>No results found</Text>
                <Text style={styles.emptySubtext}>
                  Try product name, artisan shop name, or village/locality keywords
                </Text>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="search" size={64} color={COLORS.textTertiary} />
                <Text style={styles.emptyText}>Search for authentic products</Text>
                <Text style={styles.emptySubtext}>
                  Discover by product, artisan shop, locality, or village
                </Text>
              </View>
            )
          }
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  screenHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 14,
  },
  screenHeaderTitle: { fontSize: 20, fontWeight: '700', color: '#FFF' },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: COLORS.background,
    gap: 8,
  },
  searchContainerCompact: {
    paddingTop: 10,
    paddingBottom: 8,
  },
  inputSuggestWrap: {
    marginTop: -2,
    marginHorizontal: 16,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
  },
  inputSuggestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  inputSuggestText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '600',
  },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    borderRadius: 18,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: 46, fontSize: 15, color: COLORS.text },
  searchButton: {
    width: 46, height: 46, borderRadius: 15, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOpacity: 0.26,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  filterToggle: {
    width: 46, height: 46, borderRadius: 15, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface,
  },
  filterToggleActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterBadge: {
    position: 'absolute', top: -4, right: -4, backgroundColor: COLORS.error,
    borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center',
  },
  filterBadgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  activeChipRowWrap: {
    marginTop: -2,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  activeChipRow: {
    gap: 8,
    paddingRight: 4,
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: `${COLORS.primary}40`,
    backgroundColor: `${COLORS.primary}12`,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    maxWidth: 230,
  },
  activeFilterChipText: {
    color: COLORS.primaryDark,
    fontSize: 12,
    fontWeight: '700',
  },
  filtersPanel: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  filtersOverlay: {
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flex: 1,
  },
  filtersPanelContent: {
    paddingBottom: 64,
    flexGrow: 1,
  },
  filtersHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 10,
  },
  filtersHeadingWrap: {
    flex: 1,
  },
  filtersHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filtersHeading: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },
  filtersSubheading: {
    marginTop: 2,
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  scopeRegionCard: {
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${COLORS.primary}35`,
    backgroundColor: `${COLORS.primary}10`,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  scopeRegionTextWrap: {
    flex: 1,
  },
  scopeRegionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  scopeRegionValue: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  scopeRegionClearBtn: {
    borderWidth: 1,
    borderColor: `${COLORS.primary}44`,
    backgroundColor: COLORS.surface,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  scopeRegionClearText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  activeFiltersPill: {
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${COLORS.primary}16`,
    borderWidth: 1,
    borderColor: `${COLORS.primary}40`,
  },
  activeFiltersPillText: {
    color: COLORS.primaryDark,
    fontWeight: '800',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filtersCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filtersPanelCompact: {
    paddingTop: 10,
    paddingBottom: 12,
  },
  contentRailWide: {
    width: '100%',
    maxWidth: BUYER_LAYOUT.railMaxWidth,
    alignSelf: 'center',
  },
  quickSortCard: {
    marginBottom: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: `${COLORS.primary}33`,
    backgroundColor: `${COLORS.primary}08`,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  quickSortRow: {
    gap: 8,
    paddingBottom: 2,
  },
  quickSortChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  quickSortChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  quickSortChipText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  quickSortChipTextActive: {
    color: '#FFF',
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterSectionCard: {
    marginBottom: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  filterLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  filterLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  filterSectionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: `${COLORS.primary}44`,
    backgroundColor: `${COLORS.primary}12`,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  filterSectionToggleText: {
    fontSize: 10,
    color: COLORS.primary,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  filterCountBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    textAlign: 'center',
    textAlignVertical: 'center',
    overflow: 'hidden',
    backgroundColor: `${COLORS.primary}18`,
    color: COLORS.primaryDark,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 10,
    marginBottom: 6,
  },
  chipRow: { gap: 8, paddingBottom: 4 },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 2,
  },
  chip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 22,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.background,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  chipTextActive: { color: '#FFF', fontWeight: '600' },
  localityInput: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    color: COLORS.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  inlineSuggestList: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
  },
  inlineSuggestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  inlineSuggestText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  trustRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  priceRangeVisualCard: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  priceRangeTrack: {
    position: 'relative',
    height: 16,
    justifyContent: 'center',
  },
  priceRangeTrackBase: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 8,
    borderRadius: 999,
    backgroundColor: `${COLORS.primary}16`,
  },
  priceRangeFill: {
    position: 'absolute',
    height: 8,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
  },
  priceRangeText: {
    marginTop: 7,
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  priceMetaRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  priceHelperText: {
    flex: 1,
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  priceResetInlineButton: {
    borderWidth: 1,
    borderColor: `${COLORS.primary}44`,
    borderRadius: 999,
    backgroundColor: `${COLORS.primary}10`,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  priceResetInlineText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '800',
  },
  trustPriceDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 10,
  },
  ratingVisualCard: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  ratingStarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingStarCell: {
    width: 16,
    height: 16,
    position: 'relative',
  },
  ratingStarFillClip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  ratingVisualText: {
    marginTop: 7,
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  ratingMetaRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  ratingHelperText: {
    flex: 1,
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  ratingResetInlineButton: {
    borderWidth: 1,
    borderColor: `${COLORS.primary}44`,
    borderRadius: 999,
    backgroundColor: `${COLORS.primary}10`,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  ratingResetInlineText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '800',
  },
  numericRow: {
    flexDirection: 'row',
    gap: 10,
  },
  numericInput: {
    flex: 1,
  },
  filterActionsBar: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  filterActionsButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 0,
  },
  clearButtonGhost: {
    height: 48,
    minWidth: 110,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
  },
  clearFilters: { fontSize: 15, color: COLORS.error, fontWeight: '700' },
  applyButton: {
    flex: 1,
    height: 48,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOpacity: 0.24,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  applyButtonDisabled: {
    opacity: 0.8,
  },
  applyButtonText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  resultBar: {
    marginHorizontal: 16,
    marginTop: 2,
    marginBottom: 8,
  },
  resultText: {
    textAlign: 'left',
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  guestBar: {
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${COLORS.primary}40`,
    backgroundColor: `${COLORS.primary}10`,
    padding: 10,
    gap: 8,
  },
  guestBarText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  guestBarActions: {
    flexDirection: 'row',
    gap: 8,
  },
  guestBarSecondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  guestBarSecondaryText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  guestBarPrimary: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: COLORS.primary,
  },
  guestBarPrimaryText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  suggestionWrap: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: COLORS.background,
  },
  suggestionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  suggestionRow: {
    gap: 8,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: `${COLORS.primary}10`,
    borderWidth: 1,
    borderColor: `${COLORS.primary}22`,
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  suggestionText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primaryDark,
  },
  listContent: { padding: 16 },
  listContentCompact: { paddingTop: 12, paddingHorizontal: 14 },
  loadMoreFooter: { paddingVertical: 12 },
  row: { justifyContent: 'space-between' },
  emptyContainer: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: 18, fontWeight: '600', color: COLORS.text, marginTop: 16, marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' },
});

export default SearchScreen;
