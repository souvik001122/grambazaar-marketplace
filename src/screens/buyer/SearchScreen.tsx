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
import { searchMarketplaceProducts, getProducts, getProductSuggestions } from '../../services/productService';
import { getTopVerifiedSellers } from '../../services/sellerService';
import { INDIAN_STATES } from '../../constants/regions';
import { readHomeCache } from '../../utils/persistentCache';
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

const getCategoryShortName = (cat: { id: string; name: string }) => {
  switch (cat.id) {
    case 'pottery': return 'Pottery';
    case 'textiles': return 'Textiles';
    case 'handicrafts': return 'Handicrafts';
    case 'jewelry': return 'Jewelry';
    case 'woodwork': return 'Wood Work';
    case 'metalwork': return 'Metal Work';
    case 'paintings': return 'Paintings';
    case 'food': return 'Food';
    case 'leather': return 'Leather';
    case 'bamboo': return 'Bamboo';
    case 'stone': return 'Stone';
    case 'other': return 'Other';
    default: return cat.name;
  }
};

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

const parseSmartSearchIntent = (query: string) => {
  let cleanedQuery = query.toLowerCase().trim();
  const intents: {
    minPrice?: string;
    maxPrice?: string;
    minRating?: string;
    verifiedOnly?: boolean;
    topArtisansOnly?: boolean;
    deliveryOnly?: boolean;
    category?: string;
    region?: string;
    searchQuery: string;
  } = {
    searchQuery: query,
  };

  // 1. Parse verified intent
  if (/\b(verified|certified|authentic)\b/i.test(cleanedQuery)) {
    intents.verifiedOnly = true;
    cleanedQuery = cleanedQuery.replace(/\b(verified|certified|authentic)\b/gi, '').trim();
  }

  // 2. Parse top artisan intent
  if (/\b(top|best|leading|expert)\b/i.test(cleanedQuery)) {
    intents.topArtisansOnly = true;
    cleanedQuery = cleanedQuery.replace(/\b(top|best|leading|expert)\b/gi, '').trim();
  }

  // 3. Parse delivery intent
  if (/\b(delivery|shipping|home delivery|with delivery)\b/i.test(cleanedQuery)) {
    intents.deliveryOnly = true;
    cleanedQuery = cleanedQuery.replace(/\b(delivery|shipping|home delivery|with delivery)\b/gi, '').trim();
  }

  // 4. Parse price intents
  // 4.1 "between X and Y", "X to Y", "X-Y"
  const rangeMatch = cleanedQuery.match(/\b(?:between\s+)?(?:rs\.?|₹\s*)?(\d+)\s*(?:to|and|-)\s*(?:rs\.?|₹\s*)?(\d+)\b/i);
  if (rangeMatch) {
    intents.minPrice = rangeMatch[1];
    intents.maxPrice = rangeMatch[2];
    cleanedQuery = cleanedQuery.replace(rangeMatch[0], '').trim();
  } else {
    // 4.2 "under X", "below X", "less than X", "< X"
    const underMatch = cleanedQuery.match(/\b(?:under|below|less\s+than|<)\s*(?:rs\.?|₹\s*)?(\d+)\b/i);
    if (underMatch) {
      intents.maxPrice = underMatch[1];
      cleanedQuery = cleanedQuery.replace(underMatch[0], '').trim();
    } else {
      // 4.3 "above X", "greater than X", "> X"
      const aboveMatch = cleanedQuery.match(/\b(?:above|greater\s+than|>)\s*(?:rs\.?|₹\s*)?(\d+)\b/i);
      if (aboveMatch) {
        intents.minPrice = aboveMatch[1];
        cleanedQuery = cleanedQuery.replace(aboveMatch[0], '').trim();
      }
    }
  }

  // 5. Parse rating intents: "above X rating", "X star"
  const ratingMatch = cleanedQuery.match(/\b(\d+(?:\.\d+)?)\s*(?:star|rating|stars)\b/i);
  if (ratingMatch) {
    const r = parseFloat(ratingMatch[1]);
    if (r >= 0 && r <= 5) {
      intents.minRating = String(r);
    }
    cleanedQuery = cleanedQuery.replace(ratingMatch[0], '').trim();
  } else {
    const ratingWordMatch = cleanedQuery.match(/\b(?:above|greater\s+than)\s*(\d+(?:\.\d+)?)\b/i);
    if (ratingWordMatch) {
      const r = parseFloat(ratingWordMatch[1]);
      if (r >= 0 && r <= 5) {
        intents.minRating = String(r);
        cleanedQuery = cleanedQuery.replace(ratingWordMatch[0], '').trim();
      }
    }
  }

  // NOTE: Category is intentionally NOT extracted from the search query.
  // Typing a category name (e.g. "pottery", "textiles") should be treated as a
  // plain keyword search — the backend will match products by category in the
  // full-text search. The category filter should only be set manually via the
  // Category filter section, never auto-applied from the search bar.

  intents.searchQuery = cleanedQuery.replace(/\s+/g, ' ').trim();
  return intents;
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
  const [regionSource, setRegionSource] = useState<'home' | 'explicit' | ''>('');
  const [regionFocused, setRegionFocused] = useState(false);
  const [localityFocused, setLocalityFocused] = useState(false);
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
  const [locationExpanded, setLocationExpanded] = useState(true);
  const [homeSearchTrigger, setHomeSearchTrigger] = useState(0);
  const latestSearchRequestId = useRef(0);
  const blurTimeoutRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

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
    setRegionSource(routeRegion ? 'home' : '');
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
        category?: string;
        region?: string;
        minPrice?: string;
        maxPrice?: string;
        minRating?: string;
        verifiedOnly?: boolean;
        topArtisansOnly?: boolean;
        deliveryOnly?: boolean;
        isHomeRegionScope?: boolean;
      }
    ) => {
      const p = reset ? 1 : page + 1;
      const searchValue = (overrides?.hasOwnProperty('searchQuery') ? overrides.searchQuery : searchQuery) ?? '';
      const localityValue = (overrides?.hasOwnProperty('localityQuery') ? overrides.localityQuery : localityQuery) ?? '';
      
      const catValue = overrides?.hasOwnProperty('category') ? overrides.category : selectedCategory;
      const regValue = overrides?.hasOwnProperty('region') ? overrides.region : selectedRegion;

      const rawMinPrice = parsePriceInput(overrides?.hasOwnProperty('minPrice') ? (overrides.minPrice || '') : minPrice);
      const rawMaxPrice = parsePriceInput(overrides?.hasOwnProperty('maxPrice') ? (overrides.maxPrice || '') : maxPrice);
      const normalizedRatingFilter = parseRatingInput(overrides?.hasOwnProperty('minRating') ? (overrides.minRating || '') : minRating);
      
      const isVerified = overrides?.hasOwnProperty('verifiedOnly') ? overrides.verifiedOnly : verifiedOnly;
      const isTop = overrides?.hasOwnProperty('topArtisansOnly') ? overrides.topArtisansOnly : topArtisansOnly;
      const isDelivery = overrides?.hasOwnProperty('deliveryOnly') ? overrides.deliveryOnly : deliveryOnly;

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
            category: catValue || undefined,
            region: regValue || undefined,
            minPrice: effectiveMinPrice,
            maxPrice: effectiveMaxPrice,
            minRating: normalizedRatingFilter,
            sortBy: sortBy || undefined,
            verifiedSellers: isVerified || undefined,
            topArtisansOnly: isTop || undefined,
            deliveryAvailable: isDelivery || undefined,
            isHomeRegionScope: overrides?.hasOwnProperty('isHomeRegionScope')
              ? overrides.isHomeRegionScope
              : regionSource === 'home',
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
      regionSource,
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
    if (selectedRegion || localityQuery.trim()) {
      setLocationExpanded(true);
    }
  }, [
    selectedCategory,
    verifiedOnly,
    topArtisansOnly,
    deliveryOnly,
    minPrice,
    maxPrice,
    minRating,
    selectedRegion,
    localityQuery,
  ]);

  const runSearch = (overrideSearchQuery?: string) => {
    const searchValue = overrideSearchQuery ?? searchQuery;
    const cleaned = searchValue.trim();

    if (cleaned) {
      // Parse smart search intents!
      const intents = parseSmartSearchIntent(cleaned);

      // Update states so filters panel reflects the parsed intents visually!
      if (intents.verifiedOnly !== undefined) setVerifiedOnly(intents.verifiedOnly);
      if (intents.topArtisansOnly !== undefined) setTopArtisansOnly(intents.topArtisansOnly);
      if (intents.deliveryOnly !== undefined) setDeliveryOnly(intents.deliveryOnly);
      
      setMinPrice(intents.minPrice !== undefined ? intents.minPrice : '');
      setMaxPrice(intents.maxPrice !== undefined ? intents.maxPrice : '');
      setMinRating(intents.minRating !== undefined ? intents.minRating : '');
      
      // Clear home region scope when user does a keyword search
      // (region and category can only be set manually via the filter section)
      if (regionSource === 'home') {
        setSelectedRegion('');
        setRegionSource('');
      }

      // Clean the search bar text to show the parsed search keyword
      setSearchQuery(intents.searchQuery);

      setRecentQueries((prev) => {
        const deduped = [cleaned, ...prev.filter((value) => value.toLowerCase() !== cleaned.toLowerCase())];
        return deduped.slice(0, 6);
      });

      // Call performSearch — no auto-filters from search text,
      // only price/rating/badge intents are parsed (e.g. "under 500", "5 star")
      performSearch(true, {
        searchQuery: intents.searchQuery,
        category: undefined,
        region: undefined,
        minPrice: intents.minPrice,
        maxPrice: intents.maxPrice,
        minRating: intents.minRating,
        verifiedOnly: intents.verifiedOnly,
        topArtisansOnly: intents.topArtisansOnly,
        deliveryOnly: intents.deliveryOnly,
        isHomeRegionScope: false,
      });
    } else {
      performSearch(true);
    }
  };

  const handleSearch = () => {
    runSearch();
  };

  const handleClearFilters = () => {
    setSelectedCategory('');
    setSelectedRegion('');
    setRegionSource('');
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
    navigation.navigate('ProductDetail', { productId: product.$id, initialProduct: product });
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
  const locationActiveCount = (selectedRegion && regionSource === 'explicit' ? 1 : 0) + (localityQuery.trim() ? 1 : 0);

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

  const [staticSuggestionPool, setStaticSuggestionPool] = useState<string[]>([]);
  const [locationSuggestPool, setLocationSuggestPool] = useState<string[]>([]);
  const [dynamicSuggestions, setDynamicSuggestions] = useState<string[]>([]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setDynamicSuggestions([]);
      return;
    }

    const handler = setTimeout(async () => {
      const results = await getProductSuggestions(q).catch(() => []);
      setDynamicSuggestions(results);
    }, 150);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Build static pool ONCE on mount only (empty deps []).
  // recentQueries are NOT included here — they are merged instantly in useMemo below.
  // This prevents the async rebuild gap that blanked suggestions on every re-search.
  useEffect(() => {
    const buildPool = async () => {
      try {
        const poolSet = new Set<string>();
        const locSet = new Set<string>();

        // 1. Smart suggestions
        SMART_SUGGESTIONS.forEach((s) => poolSet.add(s));

        // 2. Categories
        CATEGORIES.forEach((c) => {
          poolSet.add(c.name);
        });

        // 3. Indian states
        INDIAN_STATES.forEach((s) => {
          poolSet.add(s.name);
          locSet.add(s.name);
        });

        // 4. Fetch all approved sellers to extract real business/craft/local area details
        const sellers = await getTopVerifiedSellers(300).catch(() => []);
        sellers.forEach((s) => {
          if (s.businessName) poolSet.add(s.businessName);
          if (s.craftType) poolSet.add(s.craftType);
          if (s.village) {
            poolSet.add(s.village);
            locSet.add(s.village);
          }
          if (s.city) {
            poolSet.add(s.city);
            locSet.add(s.city);
          }
          if (s.district) {
            poolSet.add(s.district);
            locSet.add(s.district);
          }
          if (s.state) {
            poolSet.add(s.state);
            locSet.add(s.state);
          }
          if (s.address) {
            poolSet.add(s.address);
            locSet.add(s.address);
            // Also extract sub-localities/landmarks from comma-separated address parts
            const parts = s.address.split(',').map((p) => p.trim()).filter((p) => p.length >= 3);
            parts.forEach((part) => {
              poolSet.add(part);
              locSet.add(part);
            });
          }
        });

        // 5. Read home cache
        const cache = await readHomeCache().catch(() => null);
        if (cache) {
          const cachedProds = [
            ...(cache.featuredProducts || []),
            ...(cache.trendingProducts || []),
            ...(cache.recentProducts || []),
          ];
          cachedProds.forEach((p) => {
            if (p.name) poolSet.add(p.name);
            if (p.category) poolSet.add(p.category);
            if (p.region) { poolSet.add(p.region); locSet.add(p.region); }
            if (p.state) { poolSet.add(p.state); locSet.add(p.state); }
            if (p.sellerLocationLabel) { poolSet.add(p.sellerLocationLabel); locSet.add(p.sellerLocationLabel); }
          });
        }

        setStaticSuggestionPool(Array.from(poolSet).filter(Boolean));
        setLocationSuggestPool(Array.from(locSet).filter(Boolean));
      } catch (err) {
        console.error('Error building suggestion pool:', err);
      }
    };

    buildPool();
  }, []); // ← EMPTY DEPS: runs once on mount, never again

  // Merge recentQueries synchronously via useMemo — instant, no async, no re-fetch.
  // When user searches, recentQueries updates → this memo recomputes in 0ms →
  // suggestions immediately reflect the new recent query without any pool rebuild.
  const suggestionPool = useMemo(
    () => [...recentQueries, ...staticSuggestionPool],
    [recentQueries, staticSuggestionPool]
  );

  const searchTypeSuggestions = useMemo(
    () => buildAutosuggestions(searchQuery, suggestionPool, 8),
    [searchQuery, suggestionPool]
  );

  const finalSuggestions = useMemo(() => {
    const combined = [...dynamicSuggestions, ...searchTypeSuggestions];
    const deduped = Array.from(new Set(combined));
    // Always fall back to recents + smart suggestions so panel is never empty
    if (deduped.length === 0) {
      return visibleSuggestions.slice(0, 8);
    }
    return deduped.slice(0, 8);
  }, [dynamicSuggestions, searchTypeSuggestions, visibleSuggestions]);

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
        setRegionSource('');
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

      <View style={[{ flex: 1, width: '100%' }, wideRailStyle]}>
        {!user && (
          <View style={styles.guestBar}>
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

        <View style={[styles.searchContainer, isCompact && styles.searchContainerCompact]}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color={COLORS.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder={'Search "Darjeeling tea", "Khurja pottery"...'}
              value={searchQuery}
              onChangeText={(text) => {
                // Typing = user is actively in the input. Always show suggestions.
                if (blurTimeoutRef.current) {
                  clearTimeout(blurTimeoutRef.current);
                  blurTimeoutRef.current = null;
                }
                setSearchFocused(true);
                setSearchQuery(text);
              }}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              onFocus={() => {
                if (blurTimeoutRef.current) {
                  clearTimeout(blurTimeoutRef.current);
                  blurTimeoutRef.current = null;
                }
                setSearchFocused(true);
              }}
              onBlur={() => {
                // Give enough time for suggestion taps to register before hiding
                blurTimeoutRef.current = setTimeout(() => {
                  blurTimeoutRef.current = null;
                  setSearchFocused(false);
                }, 400);
              }}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  // Cancel any pending blur and re-show suggestions
                  if (blurTimeoutRef.current) {
                    clearTimeout(blurTimeoutRef.current);
                    blurTimeoutRef.current = null;
                  }
                  setSearchFocused(true);
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
          <View style={styles.activeChipRowWrap}>
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

        {!showFilters && searchFocused && (
          <View style={styles.inputSuggestWrap}>
            {finalSuggestions.length > 0 ? (
              finalSuggestions.map((item) => (
                <TouchableOpacity
                  key={`search-suggest-${item}`}
                  style={styles.inputSuggestItem}
                  activeOpacity={0.85}
                  onPressIn={() => {
                    if (blurTimeoutRef.current) {
                      clearTimeout(blurTimeoutRef.current);
                      blurTimeoutRef.current = null;
                    }
                    setSearchQuery(item);
                  }}
                  onPress={() => {
                    if (blurTimeoutRef.current) {
                      clearTimeout(blurTimeoutRef.current);
                      blurTimeoutRef.current = null;
                    }
                    setSearchFocused(false);
                    runSearch(item);
                  }}
                >
                  <Ionicons name="sparkles-outline" size={15} color={COLORS.primary} />
                  <Text style={styles.inputSuggestText}>{item}</Text>
                </TouchableOpacity>
              ))
            ) : (
              visibleSuggestions.map((item) => (
                <TouchableOpacity
                  key={`search-fallback-${item}`}
                  style={styles.inputSuggestItem}
                  activeOpacity={0.85}
                  onPressIn={() => {
                    if (blurTimeoutRef.current) {
                      clearTimeout(blurTimeoutRef.current);
                      blurTimeoutRef.current = null;
                    }
                    setSearchQuery(item);
                  }}
                  onPress={() => {
                    if (blurTimeoutRef.current) {
                      clearTimeout(blurTimeoutRef.current);
                      blurTimeoutRef.current = null;
                    }
                    setSearchFocused(false);
                    runSearch(item);
                  }}
                >
                  <Ionicons name="time-outline" size={15} color={COLORS.textSecondary} />
                  <Text style={styles.inputSuggestText}>{item}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {showFilters && (
          <View style={styles.filtersOverlay}>
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
              {!!selectedRegion && regionSource === 'home' && (
                <View style={styles.scopeRegionCard}>
                  <View style={styles.scopeRegionTextWrap}>
                    <Text style={styles.scopeRegionLabel}>Home Region Scope</Text>
                    <Text style={styles.scopeRegionValue}>{selectedRegion}</Text>
                  </View>
                  <TouchableOpacity style={styles.scopeRegionClearBtn} onPress={() => {
                    setSelectedRegion('');
                    setRegionSource('');
                  }}>
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

              <View style={styles.unifiedAccordionContainer}>
                {/* Category Section */}
                <View>
                  <TouchableOpacity 
                    style={styles.modernFilterHeader} 
                    activeOpacity={0.7}
                    onPress={() => setCategoryExpanded(!categoryExpanded)}
                  >
                    <View style={styles.modernFilterTitleGroup}>
                      <Ionicons name="grid-outline" size={18} color={COLORS.primary} style={styles.modernFilterIcon} />
                      <Text style={styles.modernFilterTitle}>Category</Text>
                      {categoryCount > 0 && (
                        <View style={styles.modernBadge}>
                          <Text style={styles.modernBadgeText}>{categoryCount}</Text>
                        </View>
                      )}
                    </View>
                    <Ionicons
                      name={categoryExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                      size={16}
                      color={COLORS.textSecondary}
                    />
                  </TouchableOpacity>
                  {categoryExpanded && (
                    <View style={styles.modernFilterContent}>
                      <View style={styles.chipWrap}>
                        {CATEGORIES.map((cat) => (
                          <TouchableOpacity
                            key={cat.id}
                            style={[styles.chip, selectedCategory === cat.id && styles.chipActive]}
                            onPress={() => setSelectedCategory(selectedCategory === cat.id ? '' : cat.id)}
                          >
                            <Text style={styles.chipEmoji}>{cat.icon}</Text>
                            <Text style={[styles.chipText, selectedCategory === cat.id && styles.chipTextActive]} numberOfLines={1}>
                              {getCategoryShortName(cat)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                </View>

                <View style={styles.accordionDivider} />

                {/* Location & Scope Section */}
                <View style={{ zIndex: 10 }}>
                  <TouchableOpacity 
                    style={styles.modernFilterHeader} 
                    activeOpacity={0.7}
                    onPress={() => setLocationExpanded(!locationExpanded)}
                  >
                    <View style={styles.modernFilterTitleGroup}>
                      <Ionicons name="location-outline" size={18} color={COLORS.primary} style={styles.modernFilterIcon} />
                      <Text style={styles.modernFilterTitle}>Location</Text>
                      {locationActiveCount > 0 && (
                        <View style={styles.modernBadge}>
                          <Text style={styles.modernBadgeText}>{locationActiveCount}</Text>
                        </View>
                      )}
                    </View>
                    <Ionicons
                      name={locationExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                      size={16}
                      color={COLORS.textSecondary}
                    />
                  </TouchableOpacity>
                  {locationExpanded && (
                    <View style={styles.modernFilterContent}>
                      <View style={styles.inputWrapper}>
                        <Ionicons name="map-outline" size={16} color={COLORS.textSecondary} style={styles.inputIcon} />
                        <TextInput
                          style={styles.modernTextInput}
                          placeholder="Select State..."
                          value={selectedRegion}
                          onChangeText={(text) => {
                            setSelectedRegion(text);
                            setRegionSource('explicit');
                          }}
                          onFocus={() => setRegionFocused(true)}
                          onBlur={() => {
                            setTimeout(() => setRegionFocused(false), 350);
                          }}
                          placeholderTextColor={COLORS.textTertiary}
                        />
                        {!!selectedRegion && (
                          <TouchableOpacity 
                            style={styles.inputClearBtn} 
                            onPress={() => {
                              setSelectedRegion('');
                              if (regionSource === 'explicit') {
                                setRegionSource('');
                              }
                            }}
                          >
                            <Ionicons name="close-circle" size={16} color={COLORS.textTertiary} />
                          </TouchableOpacity>
                        )}
                      </View>
                      {regionFocused && (
                        <View style={styles.modernInlineSuggestList}>
                          {INDIAN_STATES.filter(state => 
                            state.name.toLowerCase().includes(selectedRegion.toLowerCase()) ||
                            state.id.toLowerCase().includes(selectedRegion.toLowerCase())
                          ).slice(0, 5).map(state => (
                            <TouchableOpacity
                              key={state.id}
                              style={styles.modernInlineSuggestItem}
                              onPressIn={() => {
                                setSelectedRegion(state.name);
                                setRegionSource('explicit');
                              }}
                              onPress={() => {
                                setRegionFocused(false);
                                Keyboard.dismiss();
                              }}
                            >
                              <Ionicons name="location-outline" size={14} color={COLORS.primary} />
                              <Text style={styles.modernInlineSuggestText}>{state.name}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}

                      <View style={[styles.inputWrapper, { marginTop: 10 }]}>
                        <Ionicons name="pin-outline" size={16} color={COLORS.textSecondary} style={styles.inputIcon} />
                        <TextInput
                          style={styles.modernTextInput}
                          placeholder="Village / PIN code..."
                          value={localityQuery}
                          onChangeText={setLocalityQuery}
                          onFocus={() => setLocalityFocused(true)}
                          onBlur={() => {
                            setTimeout(() => setLocalityFocused(false), 350);
                          }}
                          placeholderTextColor={COLORS.textTertiary}
                        />
                        {!!localityQuery && (
                          <TouchableOpacity 
                            style={styles.inputClearBtn} 
                            onPress={() => setLocalityQuery('')}
                          >
                            <Ionicons name="close-circle" size={16} color={COLORS.textTertiary} />
                          </TouchableOpacity>
                        )}
                      </View>
                      {localityFocused && localityQuery.trim().length >= 2 && (
                        <View style={styles.modernInlineSuggestList}>
                          {locationSuggestPool
                            .filter(item => {
                              const text = item.toLowerCase();
                              const q = localityQuery.toLowerCase();
                              return text.includes(q) && 
                                !INDIAN_STATES.some(s => s.name.toLowerCase() === text) &&
                                !CATEGORIES.some(c => c.name.toLowerCase() === text);
                            })
                            .slice(0, 5)
                            .map(item => (
                              <TouchableOpacity
                                key={item}
                                style={styles.modernInlineSuggestItem}
                                onPressIn={() => {
                                  setLocalityQuery(item);
                                }}
                                onPress={() => {
                                  setLocalityFocused(false);
                                  Keyboard.dismiss();
                                }}
                              >
                                <Ionicons name="location-outline" size={14} color={COLORS.primary} />
                                <Text style={styles.modernInlineSuggestText}>{item}</Text>
                              </TouchableOpacity>
                            ))}
                        </View>
                      )}
                    </View>
                  )}
                </View>

                <View style={styles.accordionDivider} />

                {/* Best Match Signals Section */}
                <View>
                  <TouchableOpacity 
                    style={styles.modernFilterHeader} 
                    activeOpacity={0.7}
                    onPress={() => setTrustExpanded(!trustExpanded)}
                  >
                    <View style={styles.modernFilterTitleGroup}>
                      <Ionicons name="sparkles-outline" size={18} color={COLORS.primary} style={styles.modernFilterIcon} />
                      <Text style={styles.modernFilterTitle}>Trust & Delivery</Text>
                      {trustCount > 0 && (
                        <View style={styles.modernBadge}>
                          <Text style={styles.modernBadgeText}>{trustCount}</Text>
                        </View>
                      )}
                    </View>
                    <Ionicons
                      name={trustExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                      size={16}
                      color={COLORS.textSecondary}
                    />
                  </TouchableOpacity>
                  {trustExpanded && (
                    <View style={styles.modernFilterContent}>
                      <TouchableOpacity 
                        style={[styles.toggleRow, verifiedOnly && styles.toggleRowActive]} 
                        activeOpacity={0.85}
                        onPress={() => setVerifiedOnly(!verifiedOnly)}
                      >
                        <View style={styles.toggleRowLeft}>
                          <View style={styles.toggleRowIconWrap}>
                            <Ionicons name="shield-checkmark" size={16} color={verifiedOnly ? COLORS.primary : COLORS.textSecondary} />
                          </View>
                          <Text style={[styles.toggleRowLabel, verifiedOnly && styles.toggleRowLabelActive]}>Verified Artisan</Text>
                        </View>
                        <View style={[styles.customSwitchTrack, verifiedOnly && styles.customSwitchTrackActive]}>
                          <View style={[styles.customSwitchThumb, verifiedOnly && styles.customSwitchThumbActive]} />
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={[styles.toggleRow, { marginTop: 10 }, topArtisansOnly && styles.toggleRowActive]} 
                        activeOpacity={0.85}
                        onPress={() => setTopArtisansOnly(!topArtisansOnly)}
                      >
                        <View style={styles.toggleRowLeft}>
                          <View style={styles.toggleRowIconWrap}>
                            <Ionicons name="ribbon" size={16} color={topArtisansOnly ? COLORS.primary : COLORS.textSecondary} />
                          </View>
                          <Text style={[styles.toggleRowLabel, topArtisansOnly && styles.toggleRowLabelActive]}>Top Rated</Text>
                        </View>
                        <View style={[styles.customSwitchTrack, topArtisansOnly && styles.customSwitchTrackActive]}>
                          <View style={[styles.customSwitchThumb, topArtisansOnly && styles.customSwitchThumbActive]} />
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={[styles.toggleRow, { marginTop: 10 }, deliveryOnly && styles.toggleRowActive]} 
                        activeOpacity={0.85}
                        onPress={() => setDeliveryOnly(!deliveryOnly)}
                      >
                        <View style={styles.toggleRowLeft}>
                          <View style={styles.toggleRowIconWrap}>
                            <Ionicons name="bicycle" size={16} color={deliveryOnly ? COLORS.primary : COLORS.textSecondary} />
                          </View>
                          <Text style={[styles.toggleRowLabel, deliveryOnly && styles.toggleRowLabelActive]}>Delivery Available</Text>
                        </View>
                        <View style={[styles.customSwitchTrack, deliveryOnly && styles.customSwitchTrackActive]}>
                          <View style={[styles.customSwitchThumb, deliveryOnly && styles.customSwitchThumbActive]} />
                        </View>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                <View style={styles.accordionDivider} />

                {/* Price Range Section */}
                <View>
                  <TouchableOpacity 
                    style={styles.modernFilterHeader} 
                    activeOpacity={0.7}
                    onPress={() => setPriceExpanded(!priceExpanded)}
                  >
                    <View style={styles.modernFilterTitleGroup}>
                      <Ionicons name="cash-outline" size={18} color={COLORS.primary} style={styles.modernFilterIcon} />
                      <Text style={styles.modernFilterTitle}>Price</Text>
                      {priceCount > 0 && (
                        <View style={styles.modernBadge}>
                          <Text style={styles.modernBadgeText}>{priceCount}</Text>
                        </View>
                      )}
                    </View>
                    <Ionicons
                      name={priceExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                      size={16}
                      color={COLORS.textSecondary}
                    />
                  </TouchableOpacity>
                  {priceExpanded && (
                    <View style={styles.modernFilterContent}>
                      {/* Presets row */}
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetScrollContainer}>
                        <TouchableOpacity
                          style={[styles.presetChip, minPrice === '' && maxPrice === '500' && styles.presetChipActive]}
                          onPress={() => {
                            setMinPrice('');
                            setMaxPrice('500');
                          }}
                        >
                          <Text style={[styles.presetChipText, minPrice === '' && maxPrice === '500' && styles.presetChipTextActive]}>Under ₹500</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.presetChip, minPrice === '500' && maxPrice === '2000' && styles.presetChipActive]}
                          onPress={() => {
                            setMinPrice('500');
                            setMaxPrice('2000');
                          }}
                        >
                          <Text style={[styles.presetChipText, minPrice === '500' && maxPrice === '2000' && styles.presetChipTextActive]}>₹500 - ₹2k</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.presetChip, minPrice === '2000' && maxPrice === '5000' && styles.presetChipActive]}
                          onPress={() => {
                            setMinPrice('2000');
                            setMaxPrice('5000');
                          }}
                        >
                          <Text style={[styles.presetChipText, minPrice === '2000' && maxPrice === '5000' && styles.presetChipTextActive]}>₹2k - ₹5k</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.presetChip, minPrice === '5000' && maxPrice === '' && styles.presetChipActive]}
                          onPress={() => {
                            setMinPrice('5000');
                            setMaxPrice('');
                          }}
                        >
                          <Text style={[styles.presetChipText, minPrice === '5000' && maxPrice === '' && styles.presetChipTextActive]}>Over ₹5k</Text>
                        </TouchableOpacity>
                      </ScrollView>

                      {/* Custom input fields side by side */}
                      <View style={styles.priceInputsRow}>
                        <View style={styles.priceInputBox}>
                          <Text style={styles.priceInputPrefix}>₹</Text>
                          <TextInput
                            style={styles.priceInputText}
                            value={minPrice}
                            onChangeText={(value) => handlePriceInput('min', value)}
                            onBlur={normalizePriceInputOrder}
                            placeholder="Min"
                            placeholderTextColor={COLORS.textTertiary}
                            keyboardType="number-pad"
                            returnKeyType="done"
                          />
                        </View>
                        <View style={styles.priceInputConnector} />
                        <View style={styles.priceInputBox}>
                          <Text style={styles.priceInputPrefix}>₹</Text>
                          <TextInput
                            style={styles.priceInputText}
                            value={maxPrice}
                            onChangeText={(value) => handlePriceInput('max', value)}
                            onBlur={normalizePriceInputOrder}
                            placeholder="Max"
                            placeholderTextColor={COLORS.textTertiary}
                            keyboardType="number-pad"
                            returnKeyType="done"
                          />
                        </View>
                        {hasPriceSelection && (
                          <TouchableOpacity
                            style={styles.priceResetBtn}
                            onPress={() => {
                              setMinPrice('');
                              setMaxPrice('');
                            }}
                          >
                            <Ionicons name="refresh-outline" size={16} color={COLORS.primary} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  )}
                </View>

                <View style={styles.accordionDivider} />

                {/* Rating Section */}
                <View>
                  <TouchableOpacity 
                    style={styles.modernFilterHeader} 
                    activeOpacity={0.7}
                    onPress={() => setRatingExpanded(!ratingExpanded)}
                  >
                    <View style={styles.modernFilterTitleGroup}>
                      <Ionicons name="star-outline" size={18} color={COLORS.primary} style={styles.modernFilterIcon} />
                      <Text style={styles.modernFilterTitle}>Rating</Text>
                      {ratingCount > 0 && (
                        <View style={styles.modernBadge}>
                          <Text style={styles.modernBadgeText}>{ratingCount}</Text>
                        </View>
                      )}
                    </View>
                    <Ionicons
                      name={ratingExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                      size={16}
                      color={COLORS.textSecondary}
                    />
                  </TouchableOpacity>
                  {ratingExpanded && (
                    <View style={styles.modernFilterContent}>
                      {/* Gold interactive stars */}
                      <View style={styles.visualStarsContainer}>
                        {[0, 1, 2, 3, 4].map((index) => {
                          const starVal = index + 1;
                          const fillRatio = clampNumber(ratingPreview - index, 0, 1);

                          return (
                            <TouchableOpacity
                              key={`rating-star-${starVal}`}
                              style={styles.ratingStarCell}
                              activeOpacity={0.7}
                              onPress={() => {
                                setMinRating(String(starVal));
                              }}
                            >
                              <Ionicons name="star-outline" size={30} color="#F59E0B" />
                              <View style={[styles.ratingStarFillClip, { width: `${fillRatio * 100}%` }]}>
                                <Ionicons name="star" size={30} color="#F59E0B" />
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      {/* Text Presets Row */}
                      <View style={styles.ratingPresetsRow}>
                        <TouchableOpacity
                          style={[styles.presetChip, minRating === '4' && styles.presetChipActive]}
                          onPress={() => setMinRating('4')}
                        >
                          <Text style={[styles.presetChipText, minRating === '4' && styles.presetChipTextActive]}>4.0★ & above</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.presetChip, minRating === '3' && styles.presetChipActive]}
                          onPress={() => setMinRating('3')}
                        >
                          <Text style={[styles.presetChipText, minRating === '3' && styles.presetChipTextActive]}>3.0★ & above</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.presetChip, minRating === '' && styles.presetChipActive]}
                          onPress={() => setMinRating('')}
                        >
                          <Text style={[styles.presetChipText, minRating === '' && styles.presetChipTextActive]}>Any Rating</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
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
          <View style={styles.suggestionWrap}>
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
          <View style={styles.resultBar}>
            <Text style={styles.resultText} numberOfLines={1} ellipsizeMode="tail">
              {total} result{total === 1 ? '' : 's'} found
            </Text>
          </View>
        )}

        {!showFilters && (loading && !products.length ? (
          <LoadingSpinner />
        ) : (
          <FlatList
            style={styles.list}
            data={products}
            keyExtractor={(item) => item.$id}
            numColumns={2}
            columnWrapperStyle={styles.row}
            removeClippedSubviews={Platform.OS === 'android'}
            initialNumToRender={3}
            maxToRenderPerBatch={3}
            windowSize={3}
            updateCellsBatchingPeriod={110}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            onScrollBeginDrag={Keyboard.dismiss}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.listContent,
              isCompact && styles.listContentCompact,
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
    justifyContent: 'space-between',
    rowGap: 10,
  },
  chip: {
    width: '31%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  chipActive: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}12`,
  },
  chipText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  chipTextActive: {
    color: COLORS.primaryDark,
    fontWeight: '700',
  },
  chipEmoji: {
    fontSize: 20,
  },
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
    width: 30,
    height: 30,
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
  list: {
    flex: 1,
    width: '100%',
  },
  listContent: { padding: 16 },
  listContentCompact: { paddingTop: 12, paddingHorizontal: 14 },
  loadMoreFooter: { paddingVertical: 12 },
  row: { justifyContent: 'space-between' },
  emptyContainer: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: 18, fontWeight: '600', color: COLORS.text, marginTop: 16, marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' },
  
  // Premium Accordion Filter Styles
  unifiedAccordionContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  accordionDivider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
  },
  modernFilterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  modernFilterTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  modernFilterIcon: {
    marginRight: 2,
  },
  modernFilterTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  modernBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  modernBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  modernFilterContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    paddingHorizontal: 12,
    height: 46,
  },
  inputIcon: {
    marginRight: 8,
  },
  modernTextInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '500',
    padding: 0,
  },
  inputClearBtn: {
    padding: 4,
  },
  modernInlineSuggestList: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
  },
  modernInlineSuggestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  modernInlineSuggestText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  
  // High-Fidelity Zomato/Blinkit Preset & Switch Styles
  presetScrollContainer: {
    paddingVertical: 4,
  },
  presetChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
  },
  presetChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}12`,
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  presetChipTextActive: {
    color: COLORS.primaryDark,
    fontWeight: '800',
  },
  priceInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  priceInputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    paddingHorizontal: 12,
    height: 44,
  },
  priceInputPrefix: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '700',
    marginRight: 6,
  },
  priceInputText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
    padding: 0,
  },
  priceInputConnector: {
    width: 8,
    height: 1,
    backgroundColor: COLORS.textTertiary,
  },
  priceResetBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: `${COLORS.primary}12`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  toggleRowActive: {
    borderColor: `${COLORS.primary}33`,
    backgroundColor: `${COLORS.primary}06`,
  },
  toggleRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggleRowIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  toggleRowLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  toggleRowLabelActive: {
    color: COLORS.text,
    fontWeight: '700',
  },
  customSwitchTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E7E5E4',
    padding: 2,
    justifyContent: 'center',
  },
  customSwitchTrackActive: {
    backgroundColor: COLORS.primary,
  },
  customSwitchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 1,
  },
  customSwitchThumbActive: {
    alignSelf: 'flex-end',
  },
  visualStarsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 8,
  },
  ratingPresetsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingBottom: 4,
  },
});

export default SearchScreen;
