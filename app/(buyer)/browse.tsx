import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Image } from 'react-native';
import { Text, Card, Searchbar, useTheme, Chip, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing } from '../../src/config/theme';
import { Product } from '../../src/types';
import { productService } from '../../src/services/productService';
import { useCartStore } from '../../src/stores/cartStore';
import { showAlert } from '../../src/utils/alert';

export default function BrowseScreen() {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const addToCart = useCartStore((state) => state.addToCart);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await productService.getProducts();
      setProducts(data);
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

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderProduct = ({ item }: { item: Product }) => (
    <Card style={styles.productCard}>
      <Card.Cover 
        source={{ uri: item.images[0] || 'https://picsum.photos/400/300' }}
        style={styles.productImage}
      />
      <Card.Content>
        <Text variant="titleMedium" numberOfLines={2}>{item.name}</Text>
        <Text variant="bodySmall" numberOfLines={2} style={styles.description}>
          {item.description}
        </Text>
        <View style={styles.priceRow}>
          <Text variant="titleLarge" style={{ color: theme.colors.primary }}>
            ₹{item.price}
          </Text>
          <Text variant="bodySmall">⭐ {item.rating.toFixed(1)}</Text>
        </View>
        <View style={styles.tags}>
          <Chip compact>{item.category}</Chip>
          <Chip compact style={{ marginLeft: spacing.xs }}>{item.region}</Chip>
        </View>
        <Button 
          mode="contained" 
          onPress={() => handleAddToCart(item)}
          style={{ marginTop: spacing.sm }}
        >
          Add to Cart
        </Button>
      </Card.Content>
    </Card>
  );

  return (
    <SafeAreaView edges={[]} style={[styles.container, { backgroundColor: theme.colors.background }]}> 
      <View style={styles.header}>
        <Searchbar
          placeholder="Search products..."
          onChangeText={setSearchQuery}
          value={searchQuery}
        />
      </View>
      {loading ? (
        <View style={styles.loadingContainer}>
          <Text>Loading products...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          renderItem={renderProduct}
          keyExtractor={(item) => item.$id}
          numColumns={2}
          contentContainerStyle={styles.list}
          columnWrapperStyle={styles.row}
        />
      )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: spacing.sm,
  },
  row: {
    justifyContent: 'space-between',
  },
  productCard: {
    flex: 1,
    margin: spacing.sm,
    maxWidth: '48%',
  },
  productImage: {
    height: 150,
  },
  description: {
    marginTop: spacing.xs,
    opacity: 0.7,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  tags: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
});
