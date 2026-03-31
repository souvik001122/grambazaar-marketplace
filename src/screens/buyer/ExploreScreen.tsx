import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  ScrollView,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProductCard } from '../../components/ProductCard';
import { Product } from '../../types/product.types';
import { INDIAN_STATES } from '../../constants/regions';
import { COLORS } from '../../constants/colors';
import { searchMarketplaceProducts } from '../../services/productService';
import { buildAutosuggestions } from '../../utils/autosuggest';

const POPULAR_DISTRICTS = [
  'Jaipur',
  'Darjeeling',
  'Kutch',
  'Moradabad',
  'Saharanpur',
  'Kolkata',
  'Bastar',
  'Mysuru',
];

const POPULAR_VILLAGES = [
  'Raghurajpur',
  'Channapatna',
  'Khurja',
  'Kutch craft village',
  'Sualkuchi',
  'Pipili',
  'Shilpgram',
];

const ExploreScreen = ({ navigation }: any) => {
  const [selectedState, setSelectedState] = useState('');
  const [district, setDistrict] = useState('');
  const [village, setVillage] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [districtFocused, setDistrictFocused] = useState(false);
  const [villageFocused, setVillageFocused] = useState(false);

  const districtSuggestionPool = useMemo(
    () => [...POPULAR_DISTRICTS, ...INDIAN_STATES.map((item) => item.name)],
    []
  );

  const villageSuggestionPool = useMemo(
    () => [...POPULAR_VILLAGES, ...POPULAR_DISTRICTS],
    []
  );

  const districtSuggestions = useMemo(
    () => buildAutosuggestions(district, districtSuggestionPool, 6),
    [district, districtSuggestionPool]
  );

  const villageSuggestions = useMemo(
    () => buildAutosuggestions(village, villageSuggestionPool, 6),
    [village, villageSuggestionPool]
  );

  const localityQuery = useMemo(() => {
    return [village.trim(), district.trim()].filter(Boolean).join(' ');
  }, [district, village]);

  const handleExplore = async () => {
    try {
      setLoading(true);
      setSearched(true);

      const response = await searchMarketplaceProducts(
        {
          region: selectedState || undefined,
          localityQuery: localityQuery || undefined,
          sortBy: 'rating',
        },
        1,
        50
      );

      setProducts(response.data);
    } catch (error) {
      console.error('Explore search error:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const clearAll = () => {
    setSelectedState('');
    setDistrict('');
    setVillage('');
    setProducts([]);
    setSearched(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="compass-outline" size={22} color="#FFF" />
        <Text style={styles.headerTitle}>Explore by Region</Text>
      </View>

      <View style={styles.filtersWrap}>
        <Text style={styles.label}>State</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {INDIAN_STATES.map((state) => (
            <TouchableOpacity
              key={state.id}
              style={[styles.chip, selectedState === state.name && styles.chipActive]}
              onPress={() => setSelectedState(selectedState === state.name ? '' : state.name)}
            >
              <Text style={[styles.chipText, selectedState === state.name && styles.chipTextActive]}>{state.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.label}>District</Text>
        <TextInput
          style={styles.input}
          value={district}
          onChangeText={setDistrict}
          placeholder="Enter district"
          returnKeyType="next"
          onFocus={() => setDistrictFocused(true)}
          onBlur={() => {
            setTimeout(() => setDistrictFocused(false), 220);
          }}
        />
        {districtFocused && districtSuggestions.length > 0 && (
          <View style={styles.autoSuggestList}>
            {districtSuggestions.map((item) => (
              <TouchableOpacity
                key={`district-suggest-${item}`}
                style={styles.autoSuggestItem}
                activeOpacity={0.85}
                onPressIn={() => {
                  setDistrict(item);
                }}
                onPress={() => {
                  setDistrict(item);
                  setDistrictFocused(false);
                }}
              >
                <Ionicons name="location-outline" size={14} color={COLORS.primaryDark} />
                <Text style={styles.autoSuggestText}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.label}>Village / Locality</Text>
        <TextInput
          style={styles.input}
          value={village}
          onChangeText={setVillage}
          placeholder="Enter village or locality"
          returnKeyType="search"
          onSubmitEditing={handleExplore}
          blurOnSubmit
          onFocus={() => setVillageFocused(true)}
          onBlur={() => {
            setTimeout(() => setVillageFocused(false), 220);
          }}
        />
        {villageFocused && villageSuggestions.length > 0 && (
          <View style={styles.autoSuggestList}>
            {villageSuggestions.map((item) => (
              <TouchableOpacity
                key={`village-suggest-${item}`}
                style={styles.autoSuggestItem}
                activeOpacity={0.85}
                onPressIn={() => {
                  setVillage(item);
                }}
                onPress={() => {
                  setVillage(item);
                  setVillageFocused(false);
                }}
              >
                <Ionicons name="navigate-outline" size={14} color={COLORS.primaryDark} />
                <Text style={styles.autoSuggestText}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.clearButton} onPress={clearAll}>
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.exploreButton} onPress={handleExplore}>
            <Ionicons name="search" size={16} color="#FFF" />
            <Text style={styles.exploreText}>Explore</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.$id}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={Keyboard.dismiss}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              performanceMode="list"
              onPress={() => navigation.navigate('ProductDetail', { productId: item.$id })}
            />
          )}
          ListEmptyComponent={
            searched ? (
              <View style={styles.emptyWrap}>
                <Ionicons name="location-outline" size={34} color={COLORS.textTertiary} />
                <Text style={styles.emptyText}>No products found for this region path.</Text>
              </View>
            ) : (
              <View style={styles.emptyWrap}>
                <Ionicons name="trail-sign-outline" size={34} color={COLORS.textTertiary} />
                <Text style={styles.emptyText}>Select state, district, village and tap Explore.</Text>
              </View>
            )
          }
        />
      )}
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
    borderRadius: 12,
    padding: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  label: { color: COLORS.text, fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 6 },
  chipRow: { gap: 8, paddingBottom: 2 },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: COLORS.background,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { color: COLORS.text, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#FFF' },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.background,
  },
  autoSuggestList: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
  },
  autoSuggestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  autoSuggestText: {
    flex: 1,
    color: COLORS.text,
    fontWeight: '600',
  },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  clearButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.background,
  },
  clearText: { color: COLORS.textSecondary, fontWeight: '600' },
  exploreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  exploreText: { color: '#FFF', fontWeight: '700' },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 12, paddingBottom: 100 },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 28 },
  emptyText: { marginTop: 8, color: COLORS.textSecondary, fontSize: 13 },
});

export default ExploreScreen;
