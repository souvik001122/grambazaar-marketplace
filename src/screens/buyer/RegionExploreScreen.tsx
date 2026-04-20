import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Linking,
  Pressable,
  Platform,
  Keyboard,
  BackHandler,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProductCard } from '../../components/ProductCard';
import { Product } from '../../types/product.types';
import { Seller } from '../../types/seller.types';
import { INDIAN_STATES } from '../../constants/regions';
import { COLORS } from '../../constants/colors';
import { searchMarketplaceProducts } from '../../services/productService';
import { getSellersByRegion } from '../../services/sellerService';
import * as Location from 'expo-location';
import { calculateTrustScore, isTopArtisan } from '../../utils/trustScore';
import { buildAutosuggestions } from '../../utils/autosuggest';
import {
  getRealDistrictsByState,
  getRealIndianStates,
  searchRealLocalitiesByDistrictQuery,
  type RealLocalityOption,
} from '../../services/locationDataService';
import { PremiumTopBar } from '../../components/PremiumTopBar';

type NearbySeller = {
  seller: Seller;
  distanceKm: number | null;
  trustScore: number;
  topArtisan: boolean;
  locationMatched: boolean;
};

const LOCALITY_PIN_LENGTH = 6;
const LOCALITY_MIN_TEXT_QUERY = 3;
const LOCALITY_RESULT_LIMIT = 220;
const EXPLORE_PAGE_SIZE = 12;

const toRadians = (value: number) => (value * Math.PI) / 180;

const calculateDistanceKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) => {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

const normalizeLoose = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

type PickerMode = 'state' | 'district' | 'locality' | null;

const RegionExploreScreen = ({ navigation, route }: any) => {
  const fallbackStates = useMemo(
    () =>
      [...INDIAN_STATES.map((item) => item.name)].sort((a, b) =>
        a.localeCompare(b, 'en-IN', { sensitivity: 'base' })
      ),
    []
  );

  const [selectedState, setSelectedState] = useState('');
  const [district, setDistrict] = useState('');
  const [village, setVillage] = useState('');
  const [landmarkQuery, setLandmarkQuery] = useState('');
  const [landmarkFocused, setLandmarkFocused] = useState(false);
  const [selectedLocalityPincode, setSelectedLocalityPincode] = useState('');
  const [stateOptions, setStateOptions] = useState<string[]>(fallbackStates);
  const [districtOptions, setDistrictOptions] = useState<string[]>([]);
  const [localityOptions, setLocalityOptions] = useState<RealLocalityOption[]>([]);
  const [regionalSellers, setRegionalSellers] = useState<Seller[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingLocalities, setLoadingLocalities] = useState(false);
  const [searched, setSearched] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [nearbySellers, setNearbySellers] = useState<NearbySeller[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const [nearbyExpanded, setNearbyExpanded] = useState(true);
  const [productsExpanded, setProductsExpanded] = useState(true);
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [pickerSearchQuery, setPickerSearchQuery] = useState('');
  const [pickerKeyboardHeight, setPickerKeyboardHeight] = useState(0);
  const [pickerContainerHeight, setPickerContainerHeight] = useState(0);
  const [locationDataError, setLocationDataError] = useState('');
  const [realStatesLoaded, setRealStatesLoaded] = useState(false);
  const localityRequestRef = useRef(0);
  const { height: windowHeight } = useWindowDimensions();

  const localityQuery = useMemo(() => {
    const villageValue = village.trim();
    if (villageValue) {
      return villageValue;
    }

    return district.trim();
  }, [district, village]);

  const normalizedSelectedVillage = useMemo(() => normalizeLoose(village), [village]);

  const normalizedLandmarkQuery = useMemo(() => normalizeLoose(landmarkQuery), [landmarkQuery]);

  const districtMatchesKnownOption = useMemo(
    () => districtOptions.some((item) => item.toLowerCase() === district.trim().toLowerCase()),
    [district, districtOptions]
  );

  const statePickerOptions = useMemo(() => {
    if (!pickerSearchQuery.trim()) {
      return stateOptions;
    }

    return buildAutosuggestions(pickerSearchQuery, stateOptions, 100);
  }, [pickerSearchQuery, stateOptions]);

  const districtPickerOptions = useMemo(() => {
    if (!pickerSearchQuery.trim()) {
      return districtOptions;
    }

    return buildAutosuggestions(pickerSearchQuery, districtOptions, 140);
  }, [districtOptions, pickerSearchQuery]);

  const localityPickerOptions = useMemo(() => {
    const query = pickerSearchQuery.trim();
    if (!query) {
      return [];
    }

    const isNumericQuery = /^\d+$/.test(query);

    if (isNumericQuery) {
      if (query.length !== LOCALITY_PIN_LENGTH) {
        return [];
      }

      return localityOptions
        .filter((item) => item.pincode === query)
        .slice(0, LOCALITY_RESULT_LIMIT);
    }

    const q = normalizeLoose(query);
    if (q.length < LOCALITY_MIN_TEXT_QUERY) {
      return [];
    }

    return localityOptions
      .filter((item) => {
        const localityMatch = normalizeLoose(item.name).includes(q);
        const divisionMatch = normalizeLoose(item.division).includes(q);
        return localityMatch || divisionMatch;
      })
      .slice(0, LOCALITY_RESULT_LIMIT);
  }, [localityOptions, pickerSearchQuery]);

  const localityPickerEmptyText = useMemo(() => {
    if (pickerMode !== 'locality') {
      return 'No locality found for this search.';
    }

    const query = pickerSearchQuery.trim();
    if (!query) {
      return `Type village name (${LOCALITY_MIN_TEXT_QUERY}+ letters) or enter ${LOCALITY_PIN_LENGTH}-digit PIN.`;
    }

    if (/^\d+$/.test(query)) {
      if (query.length < LOCALITY_PIN_LENGTH) {
        return `Enter full ${LOCALITY_PIN_LENGTH}-digit PIN to load villages.`;
      }

      if (query.length > LOCALITY_PIN_LENGTH) {
        return `PIN must be exactly ${LOCALITY_PIN_LENGTH} digits.`;
      }
    }

    if (normalizeLoose(query).length < LOCALITY_MIN_TEXT_QUERY) {
      return `Type at least ${LOCALITY_MIN_TEXT_QUERY} letters of village name.`;
    }

    return 'No locality found for this search.';
  }, [pickerMode, pickerSearchQuery]);

  const landmarkSuggestionPool = useMemo(() => {
    const normalizedVillage = normalizeLoose(village);
    if (!normalizedVillage) {
      return [];
    }

    const normalizedDistrict = normalizeLoose(district);
    const suggestions: string[] = [];
    const seen = new Set<string>();

    const pushSuggestion = (rawValue?: string) => {
      const value = (rawValue || '').replace(/\s+/g, ' ').trim();
      if (!value) {
        return;
      }

      const normalized = normalizeLoose(value);
      if (!normalized || seen.has(normalized)) {
        return;
      }

      seen.add(normalized);
      suggestions.push(value);
    };

    for (const seller of regionalSellers) {
      const locationText = normalizeLoose([seller.village, seller.district, seller.city, seller.address].filter(Boolean).join(' '));
      const villageMatch = locationText.includes(normalizedVillage);
      const districtMatch = !normalizedDistrict || locationText.includes(normalizedDistrict);

      if (!villageMatch || !districtMatch) {
        continue;
      }

      const address = (seller.address || '').replace(/\s+/g, ' ').trim();
      if (!address) {
        continue;
      }

      pushSuggestion(address);

      const primaryAddressChunk = address.split(',')[0]?.trim();
      if (primaryAddressChunk && primaryAddressChunk.length >= 3 && primaryAddressChunk.length < address.length) {
        pushSuggestion(primaryAddressChunk);
      }

      if (suggestions.length >= 80) {
        break;
      }
    }

    return suggestions;
  }, [district, regionalSellers, village]);

  const landmarkSuggestions = useMemo(() => {
    if (!village.trim()) {
      return [];
    }

    const query = landmarkQuery.trim();
    if (!query) {
      return landmarkSuggestionPool.slice(0, 8);
    }

    return buildAutosuggestions(query, landmarkSuggestionPool, 8);
  }, [landmarkQuery, landmarkSuggestionPool, village]);

  const ensureRealStatesLoaded = useCallback(async () => {
    if (realStatesLoaded) {
      return;
    }

    setLoadingStates(true);
    setLocationDataError('');

    try {
      const states = await getRealIndianStates();
      setStateOptions(states.length > 0 ? states : fallbackStates);
    } catch (error) {
      console.error('State data load error:', error);
      setStateOptions(fallbackStates);
      setLocationDataError('Unable to load complete India Post dataset. Using fallback state list.');
    } finally {
      setLoadingStates(false);
      setRealStatesLoaded(true);
    }
  }, [fallbackStates, realStatesLoaded]);

  useEffect(() => {
    let active = true;

    const loadDistrictOptions = async () => {
      if (!selectedState) {
        localityRequestRef.current += 1;
        setDistrictOptions([]);
        setLocalityOptions([]);
        return;
      }

      setLoadingDistricts(true);
      setLocationDataError('');

      try {
        const districts = await getRealDistrictsByState(selectedState);
        if (!active) {
          return;
        }

        setDistrictOptions(districts);
        if (district && !districts.some((item) => item.toLowerCase() === district.toLowerCase())) {
          setDistrict('');
          setVillage('');
          localityRequestRef.current += 1;
          setLocalityOptions([]);
        }
      } catch (error) {
        console.error('District data load error:', error);
        if (active) {
          setDistrictOptions([]);
          localityRequestRef.current += 1;
          setLocalityOptions([]);
          setLocationDataError('Unable to load districts for selected state right now.');
        }
      } finally {
        if (active) {
          setLoadingDistricts(false);
        }
      }
    };

    loadDistrictOptions();

    return () => {
      active = false;
    };
  }, [selectedState]);

  useEffect(() => {
    if (pickerMode !== 'locality') {
      setLoadingLocalities(false);
      return;
    }

    if (!selectedState || !districtMatchesKnownOption) {
      setLocalityOptions([]);
      setLoadingLocalities(false);
      return;
    }

    const query = pickerSearchQuery.trim();
    const isNumericQuery = /^\d+$/.test(query);
    const textQuery = normalizeLoose(query);

    if (!query) {
      setLocalityOptions([]);
      setLoadingLocalities(false);
      return;
    }

    if (isNumericQuery && query.length !== LOCALITY_PIN_LENGTH) {
      setLocalityOptions([]);
      setLoadingLocalities(false);
      return;
    }

    if (!isNumericQuery && textQuery.length < LOCALITY_MIN_TEXT_QUERY) {
      setLocalityOptions([]);
      setLoadingLocalities(false);
      return;
    }

    const requestId = localityRequestRef.current + 1;
    localityRequestRef.current = requestId;
    setLoadingLocalities(true);
    setLocationDataError('');

    const timer = setTimeout(async () => {
      try {
        // Fast path: query-scoped API search returns quickly for immediate feedback.
        const fastResults = await searchRealLocalitiesByDistrictQuery(
          selectedState,
          district,
          query,
          LOCALITY_RESULT_LIMIT
        );

        if (localityRequestRef.current !== requestId) {
          return;
        }

        setLocalityOptions(fastResults);
        setLoadingLocalities(false);
      } catch (error) {
        console.error('Locality data load error:', error);
        if (localityRequestRef.current !== requestId) {
          return;
        }

        setLocalityOptions([]);
        setLocationDataError('Unable to load localities for selected district right now.');
      } finally {
        if (localityRequestRef.current === requestId) {
          setLoadingLocalities(false);
        }
      }
    }, 220);

    return () => {
      clearTimeout(timer);
    };
  }, [district, districtMatchesKnownOption, pickerMode, pickerSearchQuery, selectedState]);

  useEffect(() => {
    const loadUserLocation = async () => {
      if (Platform.OS === 'web') {
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

        setUserCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationEnabled(true);
      } catch {
        // Keep explore working even without distance mode.
      }
    };

    loadUserLocation();
  }, []);

  useEffect(() => {
    const loadRegionalSellers = async () => {
      if (!selectedState) {
        setRegionalSellers([]);
        setNearbySellers([]);
        setLoadingNearby(false);
        return;
      }

      try {
        setLoadingNearby(true);
        const sellers = await getSellersByRegion(selectedState);
        setRegionalSellers(sellers);
      } catch (error) {
        console.error('Regional sellers load error:', error);
        setRegionalSellers([]);
      } finally {
        setLoadingNearby(false);
      }
    };

    loadRegionalSellers();
  }, [selectedState]);

  useEffect(() => {
    const loadNearbySellers = async () => {
      if (!selectedState || regionalSellers.length === 0) {
        setNearbySellers([]);
        return;
      }

      try {
        const normalizedDistrict = normalizeLoose(district);
        const normalizedVillage = normalizeLoose(village);
        const hasLocationFilter = Boolean(normalizedDistrict || normalizedVillage || normalizedLandmarkQuery);

        const withDistance = regionalSellers
          .map((seller) => {
            const sellerLocationText = normalizeLoose(
              [seller.village, seller.district, seller.city, seller.address]
                .filter(Boolean)
                .join(' ')
            );
            const sellerAddressText = normalizeLoose(seller.address || '');
            const districtMatch = !normalizedDistrict || sellerLocationText.includes(normalizedDistrict);
            const villageMatch = !normalizedVillage || sellerLocationText.includes(normalizedVillage);
            const landmarkMatch = !normalizedLandmarkQuery || sellerAddressText.includes(normalizedLandmarkQuery);

            return {
              seller,
              distanceKm:
                userCoords &&
                typeof seller.latitude === 'number' &&
                typeof seller.longitude === 'number' &&
                !Number.isNaN(seller.latitude) &&
                !Number.isNaN(seller.longitude)
                  ? calculateDistanceKm(
                      userCoords.latitude,
                      userCoords.longitude,
                      seller.latitude,
                      seller.longitude
                    )
                  : null,
              trustScore: calculateTrustScore(seller),
              topArtisan: isTopArtisan(seller),
              locationMatched: hasLocationFilter ? districtMatch && villageMatch && landmarkMatch : false,
            };
          })
          .filter((entry) => {
            if (!hasLocationFilter) {
              return true;
            }
            return entry.locationMatched;
          })
          .sort((a, b) => {
            const aTop = a.topArtisan ? 1 : 0;
            const bTop = b.topArtisan ? 1 : 0;

            if (hasLocationFilter && a.locationMatched !== b.locationMatched) {
              return (b.locationMatched ? 1 : 0) - (a.locationMatched ? 1 : 0);
            }

            if (bTop !== aTop) {
              return bTop - aTop;
            }

            const trustGap = b.trustScore - a.trustScore;
            if (trustGap !== 0) {
              return trustGap;
            }

            const aDistance = a.distanceKm ?? Number.POSITIVE_INFINITY;
            const bDistance = b.distanceKm ?? Number.POSITIVE_INFINITY;
            if (aDistance !== bDistance) {
              return aDistance - bDistance;
            }

            return (b.seller.rating || 0) - (a.seller.rating || 0);
          })
          .slice(0, 6);

        setNearbySellers(withDistance);
      } catch (error) {
        console.error('Nearby sellers error:', error);
        setNearbySellers([]);
      }
    };

    loadNearbySellers();
  }, [district, normalizedLandmarkQuery, regionalSellers, selectedState, userCoords, village]);

  useEffect(() => {
    if (selectedState) {
      setNearbyExpanded(true);
    }
  }, [selectedState]);

  useEffect(() => {
    const routeState = (route?.params?.state || '').toString();
    const routeDistrict = (route?.params?.district || '').toString();
    const routeVillage = (route?.params?.village || '').toString();
    const shouldAutoExplore = !!route?.params?.autoExplore;

    if (!routeState && !routeDistrict && !routeVillage) {
      return;
    }

    setSelectedState(routeState);
    setDistrict(routeDistrict);
    setVillage(routeVillage);
    setLandmarkQuery('');
    setLandmarkFocused(false);
    setSelectedLocalityPincode('');

    if (!shouldAutoExplore) {
      return;
    }

    const triggerExplore = async () => {
      try {
        setLoading(true);
        setSearched(true);
        setProductsExpanded(true);

        const routeLocality = routeVillage.trim() || routeDistrict.trim();
        const response = await searchMarketplaceProducts(
          {
            region: routeState || undefined,
            localityQuery: routeLocality || undefined,
            searchQuery: undefined,
            sortBy: 'trust_high',
          },
          1,
          EXPLORE_PAGE_SIZE
        );

        setProducts(response.data);
        setPage(1);
        setHasMore(response.hasMore);
        setTotal(response.total);
      } catch (error) {
        console.error('Route explore search error:', error);
        setProducts([]);
        setHasMore(false);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    };

    triggerExplore();
  }, [route?.params?.state, route?.params?.district, route?.params?.village, route?.params?.autoExplore]);

  const handleExplore = async () => {
    try {
      setLoading(true);
      setSearched(true);
      setProductsExpanded(true);

      const response = await searchMarketplaceProducts(
        {
          region: selectedState || undefined,
          localityQuery: localityQuery || undefined,
          searchQuery: landmarkQuery.trim() || undefined,
          sortBy: 'trust_high',
        },
        1,
        EXPLORE_PAGE_SIZE
      );

      setProducts(response.data);
      setPage(1);
      setHasMore(response.hasMore);
      setTotal(response.total);
    } catch (error) {
      console.error('Explore search error:', error);
      setProducts([]);
      setHasMore(false);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreProducts = useCallback(async () => {
    if (loading || loadingMore || !hasMore || !productsExpanded) {
      return;
    }

    try {
      setLoadingMore(true);
      const nextPage = page + 1;
      const response = await searchMarketplaceProducts(
        {
          region: selectedState || undefined,
          localityQuery: localityQuery || undefined,
          searchQuery: landmarkQuery.trim() || undefined,
          sortBy: 'trust_high',
        },
        nextPage,
        EXPLORE_PAGE_SIZE
      );

      setProducts((prev) => {
        const known = new Set(prev.map((item) => item.$id));
        const merged = [...prev];
        for (const item of response.data) {
          if (!known.has(item.$id)) {
            known.add(item.$id);
            merged.push(item);
          }
        }
        return merged;
      });

      setPage(nextPage);
      setHasMore(response.hasMore);
      setTotal(response.total);
    } catch (error) {
      console.error('Explore load more error:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, landmarkQuery, loading, loadingMore, localityQuery, page, productsExpanded, selectedState]);

  const clearAll = () => {
    setSelectedState('');
    setDistrict('');
    setVillage('');
    setLandmarkQuery('');
    setLandmarkFocused(false);
    setSelectedLocalityPincode('');
    setDistrictOptions([]);
    setLocalityOptions([]);
    setRegionalSellers([]);
    setProducts([]);
    setSearched(false);
    setPage(1);
    setHasMore(false);
    setTotal(0);
    setFiltersExpanded(true);
    setNearbyExpanded(true);
    setProductsExpanded(true);
    setPickerMode(null);
    setPickerSearchQuery('');
  };

  const handleStateSelection = (stateName: string) => {
    setSelectedState(stateName);
    setDistrict('');
    setVillage('');
    setLandmarkQuery('');
    setLandmarkFocused(false);
    setSelectedLocalityPincode('');
    setDistrictOptions([]);
    localityRequestRef.current += 1;
    setLocalityOptions([]);
  };

  const openPicker = (mode: Exclude<PickerMode, null>) => {
    if (mode === 'district' && !selectedState) {
      return;
    }

    if (mode === 'locality' && !districtMatchesKnownOption) {
      return;
    }

    setPickerMode(mode);

    if (mode === 'state') {
      void ensureRealStatesLoaded();
      setPickerSearchQuery(selectedState);
      return;
    }

    if (mode === 'district') {
      setPickerSearchQuery(district);
      return;
    }

    // Start blank so tapping locality never triggers an expensive immediate search.
    setPickerSearchQuery('');
  };

  const closePicker = () => {
    Keyboard.dismiss();
    setPickerKeyboardHeight(0);
    setPickerContainerHeight(0);
    setPickerMode(null);
  };

  useEffect(() => {
    if (pickerMode === null) {
      return;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      closePicker();
      return true;
    });

    return () => {
      subscription.remove();
    };
  }, [pickerMode]);

  useEffect(() => {
    if (pickerMode === null) {
      setPickerKeyboardHeight(0);
      setPickerContainerHeight(0);
      return;
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, (event: any) => {
      const height = event?.endCoordinates?.height;
      setPickerKeyboardHeight(typeof height === 'number' && Number.isFinite(height) ? Math.max(height, 0) : 0);
    });

    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setPickerKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [pickerMode]);

  const handlePickerSelectState = (stateName: string) => {
    handleStateSelection(stateName);
    closePicker();
  };

  const handlePickerSelectDistrict = (districtName: string) => {
    setDistrict(districtName);
    setVillage('');
    setLandmarkQuery('');
    setLandmarkFocused(false);
    setSelectedLocalityPincode('');
    localityRequestRef.current += 1;
    setLocalityOptions([]);
    closePicker();
  };

  const handlePickerSelectLocality = (locality: RealLocalityOption) => {
    setVillage(locality.name);
    setLandmarkQuery('');
    setLandmarkFocused(false);
    setSelectedLocalityPincode(locality.pincode);
    closePicker();
  };

  const renderProductCardInline = useCallback(
    ({ item }: { item: Product }) => (
      <View style={styles.productsGridItem}>
        <ProductCard
          product={item}
          fullWidth
          performanceMode="list"
          onPress={() => navigation.navigate('ProductDetail', { productId: item.$id })}
        />
      </View>
    ),
    [navigation]
  );

  const openNearbyRouteMap = async () => {
    if (nearbySellers.length === 0) {
      return;
    }

    const points = nearbySellers
      .map((entry) => ({ latitude: entry.seller.latitude as number, longitude: entry.seller.longitude as number }))
      .filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude))
      .slice(0, 5);

    if (points.length === 0) {
      return;
    }

    const destination = `${points[0].latitude},${points[0].longitude}`;
    const waypoints = points.slice(1).map((point) => `${point.latitude},${point.longitude}`).join('|');
    const origin = userCoords ? `&origin=${userCoords.latitude},${userCoords.longitude}` : '';
    const waypointsParam = waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : '';
    const mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}${origin}${waypointsParam}&travelmode=driving`;

    const canOpen = await Linking.canOpenURL(mapUrl);
    if (!canOpen) {
      return;
    }

    await Linking.openURL(mapUrl);
  };

  const pickerTitle =
    pickerMode === 'state'
      ? 'Select State'
      : pickerMode === 'district'
        ? 'Select District'
        : pickerMode === 'locality'
          ? 'Select Village or Locality'
          : '';

  const pickerLoading =
    pickerMode === 'state'
      ? loadingStates
      : pickerMode === 'district'
        ? loadingDistricts
        : pickerMode === 'locality'
          ? loadingLocalities
          : false;

  const pickerMetaText =
    pickerMode === 'state'
      ? `${stateOptions.length} states available`
      : pickerMode === 'district'
        ? `${districtOptions.length} districts available`
        : pickerMode === 'locality'
          ? `Type ${LOCALITY_PIN_LENGTH}-digit PIN or ${LOCALITY_MIN_TEXT_QUERY}+ letters to load localities.`
          : '';

  const pickerSearchPlaceholder =
    pickerMode === 'state'
      ? 'Search state'
      : pickerMode === 'district'
        ? 'Search district'
        : 'Search locality or pincode';

  const pickerResizeCompensation = Math.max(windowHeight - pickerContainerHeight, 0);
  const pickerKeyboardLift = Math.max(pickerKeyboardHeight - pickerResizeCompensation, 0);

  const listHeaderComponent = (
    <>
      <View style={styles.filtersWrap}>
        <View style={styles.filtersTitleRow}>
          <View style={styles.filtersTitleWrap}>
            <Text style={styles.filtersTitle}>Discover Local Craft Clusters</Text>
            <Text style={styles.filtersSubtitle}>Filter by place and uncover nearby trusted artisans</Text>
          </View>
          <View style={styles.sectionHeaderActions}>
            {selectedState ? (
              <View style={styles.activeStatePill}>
                <Text style={styles.activeStatePillText}>{selectedState}</Text>
              </View>
            ) : null}
            <TouchableOpacity
              style={styles.nearbyToggleButton}
              onPress={() => setFiltersExpanded((value) => !value)}
              activeOpacity={0.8}
            >
              <Text style={styles.nearbyToggleText}>{filtersExpanded ? 'Hide' : 'Show'}</Text>
              <Ionicons
                name={filtersExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                size={16}
                color={COLORS.primary}
              />
            </TouchableOpacity>
          </View>
        </View>

        {filtersExpanded ? (
          <>
            <View style={styles.filterCard}>
              <Text style={styles.label}>State</Text>
              <TouchableOpacity
                style={styles.selectTrigger}
                activeOpacity={0.82}
                onPress={() => openPicker('state')}
              >
                <Text style={[styles.selectTriggerText, !selectedState && styles.selectPlaceholderText]}>
                  {selectedState || 'Tap to select state'}
                </Text>
                {loadingStates ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <Ionicons name="chevron-down-outline" size={18} color={COLORS.primary} />
                )}
              </TouchableOpacity>
              <Text style={styles.fieldHint}>
                {selectedState
                  ? `${selectedState} selected`
                  : 'Searchable state picker with complete data'}
              </Text>
              {locationDataError ? <Text style={styles.fieldError}>{locationDataError}</Text> : null}
            </View>

            <View style={styles.filterCard}>
              <Text style={styles.label}>District</Text>
              <TouchableOpacity
                style={[styles.selectTrigger, !selectedState && styles.inputDisabled]}
                activeOpacity={selectedState ? 0.82 : 1}
                onPress={() => openPicker('district')}
                disabled={!selectedState}
              >
                <Text style={[styles.selectTriggerText, !district && styles.selectPlaceholderText, !selectedState && styles.disabledText]}>
                  {district || (selectedState ? 'Tap to select district' : 'Select state first')}
                </Text>
                {loadingDistricts ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <Ionicons name="chevron-down-outline" size={18} color={selectedState ? COLORS.primary : COLORS.textTertiary} />
                )}
              </TouchableOpacity>
              <Text style={styles.fieldHint}>
                {!selectedState
                  ? 'District list appears after selecting state'
                  : loadingDistricts
                    ? 'Loading districts for selected state...'
                    : `${districtOptions.length} districts available`}
              </Text>
            </View>

            <View style={styles.filterCard}>
              <Text style={styles.label}>Village / Locality</Text>
              <TouchableOpacity
                style={[styles.selectTrigger, !districtMatchesKnownOption && styles.inputDisabled]}
                activeOpacity={districtMatchesKnownOption ? 0.82 : 1}
                onPress={() => openPicker('locality')}
                disabled={!districtMatchesKnownOption}
              >
                <Text
                  style={[
                    styles.selectTriggerText,
                    !village && styles.selectPlaceholderText,
                    !districtMatchesKnownOption && styles.disabledText,
                  ]}
                >
                  {village || (districtMatchesKnownOption ? 'Tap to select village or locality' : 'Select district first')}
                </Text>
                {loadingLocalities ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <Ionicons name="chevron-down-outline" size={18} color={districtMatchesKnownOption ? COLORS.primary : COLORS.textTertiary} />
                )}
              </TouchableOpacity>
              <Text style={styles.fieldHint}>
                {!districtMatchesKnownOption
                  ? 'Localities unlock after selecting a valid district'
                  : loadingLocalities
                    ? 'Searching India Post records...'
                    : `Type ${LOCALITY_PIN_LENGTH}-digit PIN or ${LOCALITY_MIN_TEXT_QUERY}+ village letters to load matching localities.`}
              </Text>
              <Text style={styles.fieldFootnote}>Real dataset source: India Post pincode records.</Text>
            </View>

            <View style={styles.filterCard}>
              <Text style={styles.label}>Landmark / Address Line</Text>
              <TextInput
                style={[
                  styles.textInputField,
                  !village.trim() && styles.inputDisabled,
                  !village.trim() && styles.disabledText,
                ]}
                value={landmarkQuery}
                onChangeText={setLandmarkQuery}
                placeholder={village.trim() ? 'E.g. Near temple road, market chowk' : 'Select village first'}
                editable={!!village.trim()}
                returnKeyType="search"
                onFocus={() => {
                  if (village.trim()) {
                    setLandmarkFocused(true);
                  }
                }}
                onBlur={() => {
                  setTimeout(() => setLandmarkFocused(false), 200);
                }}
                onSubmitEditing={handleExplore}
              />
              <Text style={styles.fieldHint}>
                {!village.trim()
                  ? 'Landmark suggestions become available after village selection'
                  : landmarkSuggestionPool.length > 0
                    ? 'Suggestions are sourced from seller-uploaded addresses in this village'
                    : 'No saved seller landmark lines found for this village yet'}
              </Text>

              {landmarkFocused && village.trim() && landmarkSuggestions.length > 0 ? (
                <View style={styles.landmarkSuggestList}>
                  {landmarkSuggestions.map((item) => (
                    <TouchableOpacity
                      key={`landmark-suggest-${item}`}
                      style={styles.landmarkSuggestItem}
                      activeOpacity={0.82}
                      onPressIn={() => {
                        setLandmarkQuery(item);
                      }}
                      onPress={() => {
                        setLandmarkQuery(item);
                        setLandmarkFocused(false);
                      }}
                    >
                      <Ionicons name="location-outline" size={14} color={COLORS.primaryDark} />
                      <Text style={styles.landmarkSuggestText} numberOfLines={1}>{item}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.clearButton} onPress={clearAll}>
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.exploreButton} onPress={handleExplore}>
                <Ionicons name="search" size={17} color="#FFF" />
                <Text style={styles.exploreText}>Explore</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.filtersBottomSpace}>
              <Text style={styles.filtersBottomHint}>Tip: Use state + village for the most relevant craft matches.</Text>
            </View>

            {locationEnabled && selectedState ? (
              <TouchableOpacity style={styles.mapRouteButton} onPress={openNearbyRouteMap}>
                <Ionicons name="map-outline" size={16} color={COLORS.primary} />
                <Text style={styles.mapRouteText}>Map View: Nearby artisans route</Text>
              </TouchableOpacity>
            ) : null}
          </>
        ) : (
          <Text style={styles.sectionCollapsedHint}>Expand to update state, district, village, and landmark filters.</Text>
        )}
      </View>

      {!searched ? (
        <View style={styles.preExploreCard}>
          <View style={styles.preExploreIconWrap}>
            <Ionicons name="search-outline" size={18} color={COLORS.primary} />
          </View>
          <Text style={styles.preExploreTitle}>Results Appear After Explore</Text>
          <Text style={styles.preExploreText}>Choose state, district, village, and optional landmark, then tap Explore.</Text>
        </View>
      ) : (
        <>
          {selectedState ? (
            <View style={styles.nearbyWrap}>
              <View style={styles.nearbyHeaderRow}>
                <View style={styles.nearbyHeaderLeft}>
                  <Text style={styles.nearbyTitle}>Nearby Artisans</Text>
                  <Text style={styles.nearbyCountLabel}>{nearbySellers.length} shown</Text>
                </View>
                <TouchableOpacity
                  style={styles.nearbyToggleButton}
                  onPress={() => setNearbyExpanded((value) => !value)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.nearbyToggleText}>{nearbyExpanded ? 'Hide' : 'Show'}</Text>
                  <Ionicons
                    name={nearbyExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                    size={16}
                    color={COLORS.primary}
                  />
                </TouchableOpacity>
              </View>
              {nearbyExpanded ? (
                loadingNearby ? (
                  <View style={styles.nearbyLoader}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  </View>
                ) : nearbySellers.length === 0 ? (
                  <Text style={styles.nearbyEmpty}>No artisans found for this selected location yet.</Text>
                ) : (
                  nearbySellers.map((entry) => (
                    <TouchableOpacity
                      key={entry.seller.$id}
                      style={styles.nearbySellerCard}
                      onPress={() => navigation.navigate('SellerProfile', { sellerId: entry.seller.$id })}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.nearbySellerName}>{entry.seller.businessName}</Text>
                        <Text style={styles.nearbySellerLoc}>
                          {[entry.seller.village, entry.seller.district, entry.seller.city].filter(Boolean).join(', ') || entry.seller.address}
                        </Text>
                        <View style={styles.nearbyTrustRow}>
                          <View style={styles.nearbyTrustChip}>
                            <Ionicons name="shield-checkmark-outline" size={11} color={COLORS.secondaryDark} />
                            <Text style={styles.nearbyTrustText}>Trust {entry.trustScore}</Text>
                          </View>
                          {entry.topArtisan && (
                            <View style={styles.nearbyTopChip}>
                              <Ionicons name="ribbon-outline" size={11} color="#92400E" />
                              <Text style={styles.nearbyTopText}>Top Artisan</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <Text style={styles.nearbyDistance}>
                        {entry.distanceKm !== null
                          ? `${entry.distanceKm.toFixed(1)} km`
                          : entry.locationMatched
                            ? 'Local match'
                            : 'Distance N/A'}
                      </Text>
                    </TouchableOpacity>
                  ))
                )
              ) : (
                <Text style={styles.nearbyCollapsedHint}>Expand to view nearby artisans and distance details.</Text>
              )}
            </View>
          ) : null}

          <View style={styles.productsWrap}>
            <View style={styles.productsHeaderRow}>
              <View style={styles.productsHeaderLeft}>
                <Text style={styles.productsTitle}>Nearby Artisan Products</Text>
                <Text style={styles.productsCountLabel}>{`${total} trust-ranked product${total === 1 ? '' : 's'}`}</Text>
              </View>
              <TouchableOpacity
                style={styles.nearbyToggleButton}
                onPress={() => setProductsExpanded((value) => !value)}
                activeOpacity={0.8}
              >
                <Text style={styles.nearbyToggleText}>{productsExpanded ? 'Hide' : 'Show'}</Text>
                <Ionicons
                  name={productsExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                  size={16}
                  color={COLORS.primary}
                />
              </TouchableOpacity>
            </View>

            {!productsExpanded ? (
              <Text style={styles.sectionCollapsedHint}>Expand to view product matches for this route.</Text>
            ) : loading ? (
              <View style={styles.listLoaderWrap}>
                <ActivityIndicator size="large" color={COLORS.primary} />
              </View>
            ) : products.length > 0 ? (
              <>
                <FlatList
                  data={products}
                  keyExtractor={(item) => item.$id}
                  numColumns={2}
                  scrollEnabled={false}
                  removeClippedSubviews={Platform.OS === 'android'}
                  initialNumToRender={6}
                  maxToRenderPerBatch={6}
                  windowSize={5}
                  updateCellsBatchingPeriod={90}
                  contentContainerStyle={styles.productsGridList}
                  columnWrapperStyle={styles.productsGridRow}
                  renderItem={renderProductCardInline}
                />
                {loadingMore ? (
                  <View style={styles.loadMoreFooter}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  </View>
                ) : hasMore ? (
                  <TouchableOpacity style={styles.loadMoreButton} onPress={loadMoreProducts}>
                    <Text style={styles.loadMoreButtonText}>Load More Products</Text>
                  </TouchableOpacity>
                ) : null}
              </>
            ) : (
              <View style={styles.productsEmptyWrap}>
                <Ionicons name="location-outline" size={34} color={COLORS.textTertiary} />
                <Text style={styles.emptyText}>No products found for this region path.</Text>
              </View>
            )}
          </View>
        </>
      )}
    </>
  );

  return (
    <View style={styles.container}>
      <PremiumTopBar
        title="Explore by Region"
        subtitle="Use state, district, locality, and landmarks"
        icon="compass-outline"
        rightLabel="Reset"
        onRightPress={clearAll}
      />

      {pickerMode !== null ? (
        <View style={styles.pickerOverlayRoot}>
          <View
            style={[
              styles.pickerModalRoot,
              pickerKeyboardLift > 0 ? { paddingBottom: pickerKeyboardLift } : null,
            ]}
            onLayout={(event) => {
              const height = event.nativeEvent.layout.height;
              setPickerContainerHeight(height);
            }}
          >
            <Pressable style={styles.pickerModalBackdrop} onPress={closePicker} />
            <View style={styles.pickerSheet}>
              <View style={styles.pickerHeaderRow}>
                <Text style={styles.pickerTitle}>{pickerTitle}</Text>
                <TouchableOpacity style={styles.pickerCloseBtn} onPress={closePicker}>
                  <Ionicons name="close" size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              {!!pickerMetaText && <Text style={styles.pickerMetaText}>{pickerMetaText}</Text>}

              {pickerMode === 'locality' && (
                <View style={styles.pickerRuleBox}>
                  <Ionicons name="flash-outline" size={14} color="#9A3412" />
                  <Text style={styles.pickerRuleText}>
                    Enter exact {LOCALITY_PIN_LENGTH}-digit PIN or at least {LOCALITY_MIN_TEXT_QUERY} village letters.
                  </Text>
                </View>
              )}

              <View style={styles.pickerSearchWrap}>
                <Ionicons name="search-outline" size={16} color={COLORS.textSecondary} />
                <TextInput
                  style={styles.pickerSearchInput}
                  value={pickerSearchQuery}
                  onChangeText={setPickerSearchQuery}
                  placeholder={pickerSearchPlaceholder}
                  autoFocus
                  returnKeyType="search"
                />
              </View>

              {pickerLoading ? (
                <View style={styles.pickerLoadingWrap}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                  <Text style={styles.pickerLoadingText}>Loading options...</Text>
                </View>
              ) : pickerMode === 'state' ? (
                <FlatList
                  data={statePickerOptions}
                  keyExtractor={(item) => `state-${item}`}
                  style={styles.pickerList}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.pickerListContent}
                  initialNumToRender={18}
                  maxToRenderPerBatch={20}
                  windowSize={7}
                  renderItem={({ item }) => {
                    const isSelected = item === selectedState;
                    return (
                    <TouchableOpacity
                      style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
                      onPress={() => handlePickerSelectState(item)}
                    >
                      <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextSelected]}>{item}</Text>
                      {isSelected ? <Ionicons name="checkmark" size={16} color={COLORS.primary} /> : null}
                    </TouchableOpacity>
                    );
                  }}
                  ListEmptyComponent={
                    <Text style={styles.pickerEmptyText}>No state found for this search.</Text>
                  }
                />
              ) : pickerMode === 'district' ? (
                <FlatList
                  data={districtPickerOptions}
                  keyExtractor={(item) => `district-${item}`}
                  style={styles.pickerList}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.pickerListContent}
                  initialNumToRender={18}
                  maxToRenderPerBatch={20}
                  windowSize={7}
                  renderItem={({ item }) => {
                    const isSelected = item === district;
                    return (
                    <TouchableOpacity
                      style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
                      onPress={() => handlePickerSelectDistrict(item)}
                    >
                      <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextSelected]}>{item}</Text>
                      {isSelected ? <Ionicons name="checkmark" size={16} color={COLORS.primary} /> : null}
                    </TouchableOpacity>
                    );
                  }}
                  ListEmptyComponent={
                    <Text style={styles.pickerEmptyText}>No district found for this search.</Text>
                  }
                />
              ) : (
                <FlatList
                  data={localityPickerOptions}
                  keyExtractor={(item) => `locality-${item.name}-${item.pincode}`}
                  style={styles.pickerList}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.pickerListContent}
                  initialNumToRender={22}
                  maxToRenderPerBatch={24}
                  windowSize={8}
                  renderItem={({ item }) => {
                    const localityNameMatch = normalizeLoose(item.name) === normalizedSelectedVillage;
                    const isSelected = selectedLocalityPincode
                      ? localityNameMatch && item.pincode === selectedLocalityPincode
                      : localityNameMatch;

                    return (
                    <TouchableOpacity
                      style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
                      onPress={() => handlePickerSelectLocality(item)}
                    >
                      <View style={styles.localitySuggestionTextWrap}>
                        <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextSelected]}>{item.name}</Text>
                        <Text style={styles.localityMetaText}>{item.pincode} • {item.division}</Text>
                      </View>
                      {isSelected ? <Ionicons name="checkmark" size={16} color={COLORS.primary} /> : null}
                    </TouchableOpacity>
                    );
                  }}
                  ListEmptyComponent={
                    <Text style={styles.pickerEmptyText}>{localityPickerEmptyText}</Text>
                  }
                />
              )}
            </View>
          </View>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScrollBeginDrag={Keyboard.dismiss}
      >
        {listHeaderComponent}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  filtersWrap: {
    margin: 12,
    borderRadius: 16,
    padding: 12,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  filtersTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  sectionHeaderActions: {
    alignItems: 'flex-end',
    gap: 6,
  },
  filtersTitleWrap: {
    flex: 1,
  },
  filtersTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
  },
  filtersSubtitle: {
    marginTop: 2,
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  activeStatePill: {
    borderWidth: 1,
    borderColor: `${COLORS.primary}40`,
    backgroundColor: `${COLORS.primary}12`,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 120,
  },
  activeStatePillText: {
    color: COLORS.primaryDark,
    fontSize: 11,
    fontWeight: '800',
  },
  filterCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  label: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 8, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
  selectTrigger: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
    backgroundColor: COLORS.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  textInputField: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
    backgroundColor: COLORS.background,
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '600',
  },
  selectTriggerText: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '600',
  },
  selectPlaceholderText: {
    color: COLORS.textTertiary,
    fontWeight: '500',
  },
  disabledText: {
    color: COLORS.textTertiary,
  },
  inputDisabled: {
    backgroundColor: '#F8FAFC',
    color: COLORS.textTertiary,
  },
  pickerModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.36)',
  },
  pickerOverlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 80,
    elevation: 80,
  },
  pickerModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  pickerSheet: {
    alignSelf: 'stretch',
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
    height: '78%',
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 0,
  },
  pickerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  pickerMetaText: {
    marginBottom: 8,
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '600',
  },
  pickerRuleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#FDBA74',
    backgroundColor: '#FFF7ED',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  pickerRuleText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: '#9A3412',
    fontWeight: '600',
  },
  pickerCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pickerSearchWrap: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
    marginBottom: 10,
  },
  pickerSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },
  pickerLoadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  pickerLoadingText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
  },
  pickerList: {
    flex: 1,
  },
  pickerListContent: {
    paddingBottom: 4,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    marginBottom: 8,
  },
  pickerItemSelected: {
    borderColor: `${COLORS.primary}50`,
    backgroundColor: `${COLORS.primary}10`,
  },
  pickerItemText: {
    flex: 1,
    color: '#111827',
    fontSize: 13,
    fontWeight: '700',
  },
  pickerItemTextSelected: {
    color: COLORS.primary,
  },
  pickerEmptyText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 14,
  },
  localitySuggestionTextWrap: {
    flex: 1,
  },
  localityMetaText: {
    marginTop: 2,
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '600',
  },
  fieldHint: {
    marginTop: 6,
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  fieldError: {
    marginTop: 5,
    fontSize: 11,
    color: '#B91C1C',
    fontWeight: '700',
  },
  fieldFootnote: {
    marginTop: 4,
    fontSize: 10,
    color: COLORS.textTertiary,
    fontWeight: '600',
  },
  landmarkSuggestList: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
  },
  landmarkSuggestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  landmarkSuggestText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2, gap: 10 },
  mapRouteButton: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: `${COLORS.primary}45`,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: `${COLORS.primary}10`,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mapRouteText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  clearButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
  },
  clearText: { color: COLORS.textSecondary, fontWeight: '700' },
  exploreButton: {
    flex: 1.6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.24,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  exploreText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  filtersBottomSpace: {
    marginTop: 10,
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  filtersBottomHint: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  preExploreCard: {
    marginHorizontal: 12,
    marginTop: 2,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  preExploreIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: `${COLORS.primary}44`,
    backgroundColor: `${COLORS.primary}10`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  preExploreTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  preExploreText: {
    marginTop: 6,
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  nearbyWrap: {
    marginHorizontal: 12,
    marginTop: 2,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  nearbyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 10,
  },
  nearbyHeaderLeft: {
    flex: 1,
  },
  nearbyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  nearbyCountLabel: {
    marginTop: 2,
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  nearbyToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: `${COLORS.primary}44`,
    backgroundColor: `${COLORS.primary}12`,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  nearbyToggleText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  nearbyLoader: {
    paddingVertical: 8,
  },
  nearbyEmpty: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  nearbyCollapsedHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  sectionCollapsedHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  nearbySellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: COLORS.background,
    marginBottom: 8,
  },
  nearbySellerName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  nearbySellerLoc: {
    marginTop: 2,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  nearbyTrustRow: {
    marginTop: 6,
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  nearbyTrustChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: `${COLORS.secondary}45`,
    backgroundColor: `${COLORS.secondary}12`,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  nearbyTrustText: {
    fontSize: 10,
    color: COLORS.secondaryDark,
    fontWeight: '700',
  },
  nearbyTopChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#F59E0B',
    backgroundColor: '#FEF3C7',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  nearbyTopText: {
    fontSize: 10,
    color: '#92400E',
    fontWeight: '700',
  },
  nearbyDistance: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  listLoaderWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  productsGridList: {
    marginTop: 10,
  },
  productsGridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  productsGridItem: {
    width: '48%',
  },
  productsEmptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  productsWrap: {
    marginHorizontal: 12,
    marginTop: 2,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  productsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 2,
  },
  productsHeaderLeft: {
    flex: 1,
  },
  productsTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  productsCountLabel: {
    marginTop: 2,
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  loadMoreButton: {
    marginTop: 4,
    marginBottom: 2,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: `${COLORS.primary}44`,
    backgroundColor: `${COLORS.primary}10`,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  loadMoreButtonText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  resultBar: {
    marginHorizontal: 12,
    marginBottom: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  resultText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  row: {
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  listContent: { paddingBottom: 100 },
  loadMoreFooter: {
    paddingVertical: 14,
  },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 28 },
  emptyText: { marginTop: 8, color: COLORS.textSecondary, fontSize: 13 },
});

export default RegionExploreScreen;
