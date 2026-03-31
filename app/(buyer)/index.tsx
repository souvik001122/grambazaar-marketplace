import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, FlatList, Image } from 'react-native';
import { Text, Card, Chip, Searchbar, Button, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { spacing } from '../../src/config/theme';
import { useAuthStore } from '../../src/stores/authStore';
import { useCartStore } from '../../src/stores/cartStore';
import { Product } from '../../src/types';
import { productService } from '../../src/services/productService';
import { showAlert } from '../../src/utils/alert';

export default function BuyerHomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const addToCart = useCartStore((state) => state.addToCart);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const regions = ['All India', 'North', 'South', 'East', 'West', 'Central', 'Northeast'];
  const [selectedRegion, setSelectedRegion] = useState('All India');

  useEffect(() => {
    loadFeaturedProducts();
  }, []);

  const loadFeaturedProducts = async () => {
    try {
      setLoading(true);
      const products = await productService.getProducts();
      setFeaturedProducts(products.slice(0, 10)); // Get first 10 products
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (product: Product) => {
    addToCart(product);
    showAlert('Success', 'Product added to cart!');
  };

  const renderProductCard = ({ item }: { item: Product }) => (
    <Card style={styles.productCard}>
      <Card.Cover 
        source={{ uri: item.images[0] || 'https://picsum.photos/400/300' }}
        style={styles.productImage}
      />
      <Card.Content style={styles.productContent}>
        <Text variant="titleMedium" numberOfLines={2}>{item.name}</Text>
        <Text variant="bodySmall" style={styles.region}>{item.region}</Text>
        <View style={styles.priceRow}>
          <Text variant="titleLarge" style={{ color: theme.colors.primary }}>
            ₹{item.price}
          </Text>
          <View style={styles.rating}>
            <Text variant="bodySmall">⭐ {item.rating.toFixed(1)}</Text>
          </View>
        </View>
        <Button 
          mode="contained" 
          onPress={() => handleAddToCart(item)}
          style={{ marginTop: spacing.sm }}
          compact
        >
          Add to Cart
        </Button>
      </Card.Content>
    </Card>
  );

  return (
    <SafeAreaView edges={[]} style={[styles.container, { backgroundColor: theme.colors.background }]}> 
      <ScrollView>
        {/* Header */}
        <View style={styles.header}>
          <Text variant="headlineMedium" style={{ color: theme.colors.primary }}>
            Welcome, {user?.name}!
          </Text>
          <Text variant="bodyMedium" style={styles.headerSubtitle}>
            Discover authentic handmade products
          </Text>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Searchbar
            placeholder="Search products, artisans, regions..."
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={styles.searchBar}
          />
        </View>

        {/* Region Filter */}
        <View style={styles.regionContainer}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Browse by Region
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {regions.map((region) => (
              <Chip
                key={region}
                selected={selectedRegion === region}
                onPress={() => setSelectedRegion(region)}
                style={styles.regionChip}
                mode={selectedRegion === region ? 'flat' : 'outlined'}
              >
                {region}
              </Chip>
            ))}
          </ScrollView>
        </View>

        {/* Featured Products */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant="titleLarge" style={styles.sectionTitle}>
              Featured Products
            </Text>
            <Button mode="text" onPress={() => router.push('/(buyer)/browse')}>
              View All
            </Button>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <Text>Loading products...</Text>
            </View>
          ) : (
            <FlatList
              data={featuredProducts}
              renderItem={renderProductCard}
              keyExtractor={(item) => item.$id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.productList}
            />
          )}
        </View>

        {/* Categories */}
        <View style={styles.section}>
          <Text variant="titleLarge" style={styles.sectionTitle}>
            Popular Categories
          </Text>
          <View style={styles.categoriesGrid}>
            {['Textiles', 'Pottery', 'Jewelry', 'Woodwork', 'Paintings', 'Handicrafts'].map((category) => (
              <Card key={category} style={styles.categoryCard} onPress={() => router.push('/(buyer)/browse')}>
                <Card.Content style={styles.categoryContent}>
                  <Text variant="titleMedium">{category}</Text>
                </Card.Content>
              </Card>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: spacing.md,
  },
  headerSubtitle: {
    opacity: 0.7,
    marginTop: spacing.xs,
  },
  searchContainer: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  searchBar: {
    elevation: 2,
  },
  regionContainer: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  regionChip: {
    marginLeft: spacing.sm,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  productList: {
    paddingHorizontal: spacing.md,
  },
  productCard: {
    width: 200,
    marginRight: spacing.md,
  },
  productImage: {
    height: 150,
  },
  productContent: {
    paddingTop: spacing.sm,
  },
  region: {
    opacity: 0.6,
    marginTop: spacing.xs,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  categoryCard: {
    width: '48%',
    marginBottom: spacing.sm,
  },
  categoryContent: {
    alignItems: 'center',
    padding: spacing.lg,
  },
});
