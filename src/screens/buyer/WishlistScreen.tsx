import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { getWishlistProducts, removeFromWishlist, subscribeWishlistChanges } from '../../services/wishlistService';
import { getProductById } from '../../services/productService';
import { Product } from '../../types/product.types';
import { SavedProduct } from '../../types/common.types';
import { ProductCard } from '../../components/ProductCard';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { showAlert } from '../../utils/alert';
import { BUYER_LAYOUT } from '../../constants/layout';

const WishlistScreen = ({ navigation }: any) => {
  const { width: screenWidth } = useWindowDimensions();
  const isLargeScreen = screenWidth >= BUYER_LAYOUT.railBreakpoint;
  const railStyle = isLargeScreen ? styles.contentRailWide : undefined;

  const navigateToBuyerTab = (tabName: string, params?: any) => {
    const parent = navigation.getParent?.();
    if (parent?.navigate) {
      parent.navigate(tabName, params);
      return;
    }
    navigation.navigate(tabName, params);
  };

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

  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [hydratedOnce, setHydratedOnce] = useState(false);

  const loadWishlist = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!user?.$id) {
        setProducts([]);
        setError(false);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      const silent = !!options?.silent;

      try {
        setError(false);
        if (!silent) {
          setLoading(true);
        }
        const savedItems = await getWishlistProducts(user.$id);

        // Fetch actual product details
        const productPromises = savedItems.map((item: SavedProduct) =>
          getProductById(item.productId).catch(() => null)
        );
        const productResults = await Promise.all(productPromises);
        setProducts(productResults.filter(Boolean) as Product[]);
        setHydratedOnce(true);
      } catch (err) {
        console.error('Error loading wishlist:', err);
        setError(true);
      } finally {
        if (!silent) {
          setLoading(false);
        }
        setRefreshing(false);
      }
    },
    [user?.$id]
  );

  useEffect(() => {
    loadWishlist();
  }, [loadWishlist]);

  useFocusEffect(
    useCallback(() => {
      if (hydratedOnce) {
        loadWishlist({ silent: true });
      }
    }, [hydratedOnce, loadWishlist])
  );

  useEffect(() => {
    if (!user?.$id) return;

    const unsubscribe = subscribeWishlistChanges((event) => {
      if (event.userId === user.$id) {
        loadWishlist({ silent: true });
      }
    });

    return unsubscribe;
  }, [loadWishlist, user?.$id]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadWishlist();
  }, [loadWishlist]);

  const handleRemove = useCallback((product: Product) => {
    if (!user) return;
    showAlert('Remove from Wishlist', `Remove "${product.name}" from wishlist?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeFromWishlist(user.$id, product.$id);
            setProducts((prev) => prev.filter((p) => p.$id !== product.$id));
          } catch {
            showAlert('Error', 'Failed to remove item');
          }
        },
      },
    ]);
  }, [user]);

  const renderWishlistItem = useCallback(
    ({ item }: { item: Product }) => (
      <View style={[styles.wishlistItem, styles.wishlistGridItem]}>
        <ProductCard
          product={item}
          performanceMode="list"
          fullWidth
          variant="premium"
          onPress={() => navigation.navigate('ProductDetail', { productId: item.$id })}
        />
        <TouchableOpacity
          style={styles.removeBtn}
          onPress={() => handleRemove(item)}
        >
          <Ionicons name="heart-dislike-outline" size={16} color={COLORS.error} />
        </TouchableOpacity>
      </View>
    ),
    [handleRemove, navigation]
  );

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.screenHeader}>
          <View style={styles.screenHeaderRow}>
            <Ionicons name="heart" size={22} color="#FFF" />
            <Text style={styles.screenHeaderTitle}>My Wishlist</Text>
          </View>
          <Text style={styles.screenHeaderSubtitle}>Login to save and manage your picks</Text>
        </View>

        <View style={[styles.guestWrap, railStyle]}>
          <Ionicons name="lock-closed-outline" size={64} color={COLORS.textTertiary} />
          <Text style={styles.guestTitle}>Saved Items Need Login</Text>
          <Text style={styles.guestSubtext}>Create an account to save products and access them from any device.</Text>
          <View style={styles.guestActionsRow}>
            <TouchableOpacity style={styles.guestSecondaryBtn} onPress={() => navigateToAuth('Login')}>
              <Text style={styles.guestSecondaryText}>Login</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.guestPrimaryBtn} onPress={() => navigateToAuth('Register')}>
              <Text style={styles.guestPrimaryText}>Register</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.browseButton}
            onPress={() =>
              navigateToBuyerTab('Home', {
                screen: 'HomeMain',
              })
            }
          >
            <Text style={styles.browseButtonText}>Browse Products</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading && !refreshing) return <LoadingSpinner fullScreen />;

  if (error && !refreshing) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="cloud-offline-outline" size={64} color={COLORS.textTertiary} />
        <Text style={styles.errorText}>Failed to load wishlist</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadWishlist()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.screenHeader}>
        <View style={styles.screenHeaderRow}>
          <Ionicons name="heart" size={22} color="#FFF" />
          <Text style={styles.screenHeaderTitle}>My Wishlist</Text>
        </View>
        <Text style={styles.screenHeaderSubtitle}>Products you saved for later</Text>
      </View>
      <FlatList
        data={products}
        keyExtractor={(item) => item.$id}
        numColumns={2}
        columnWrapperStyle={styles.wishlistRow}
        removeClippedSubviews
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={5}
        updateCellsBatchingPeriod={80}
        contentContainerStyle={[styles.list, railStyle, { paddingBottom: 12 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[COLORS.primary]} />
        }
        ListHeaderComponent={
          products.length > 0 ? (
            <View style={styles.savedSummaryCard}>
              <View style={styles.savedSummaryIconWrap}>
                <Ionicons name="sparkles-outline" size={16} color={COLORS.primary} />
              </View>
              <View style={styles.savedSummaryTextWrap}>
                <Text style={styles.savedSummaryTitle}>{products.length} saved item{products.length === 1 ? '' : 's'}</Text>
                <Text style={styles.savedSummarySubtext}>Keep tracking these picks and checkout when ready.</Text>
              </View>
            </View>
          ) : null
        }
        renderItem={renderWishlistItem}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="heart-outline" size={80} color={COLORS.textTertiary} />
            <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
            <Text style={styles.emptySubtext}>
              Tap the heart icon on products you love to save them here
            </Text>
            <TouchableOpacity
              style={styles.browseButton}
              onPress={() =>
                navigateToBuyerTab('Home', {
                  screen: 'HomeMain',
                })
              }
            >
              <Text style={styles.browseButtonText}>Browse Products</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  screenHeader: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  screenHeaderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  screenHeaderTitle: { fontSize: 20, fontWeight: '700', color: '#FFF' },
  screenHeaderSubtitle: {
    marginTop: 3,
    marginLeft: 32,
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: COLORS.background },
  errorText: { fontSize: 16, color: COLORS.textSecondary, marginTop: 16, marginBottom: 16 },
  retryButton: { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  retryButtonText: { color: '#FFF', fontWeight: '600' },
  contentRailWide: {
    width: '100%',
    maxWidth: BUYER_LAYOUT.railMaxWidth,
    alignSelf: 'center',
  },
  list: { padding: 16 },
  savedSummaryCard: {
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${COLORS.primary}22`,
    backgroundColor: `${COLORS.primary}10`,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  savedSummaryIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${COLORS.primary}20`,
  },
  savedSummaryTextWrap: {
    flex: 1,
  },
  savedSummaryTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  savedSummarySubtext: {
    marginTop: 2,
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  wishlistRow: {
    justifyContent: 'space-between',
  },
  wishlistItem: { position: 'relative', marginBottom: 8 },
  wishlistGridItem: {
    width: '49%',
  },
  removeBtn: {
    position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center',
    zIndex: 10, elevation: 3,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.16, shadowRadius: 4,
  },
  emptyContainer: { alignItems: 'center', marginTop: 80 },
  guestWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  guestTitle: {
    marginTop: 8,
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },
  guestSubtext: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 10,
  },
  guestActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  guestSecondaryBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 10,
  },
  guestSecondaryText: {
    color: COLORS.text,
    fontWeight: '700',
  },
  guestPrimaryBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 10,
  },
  guestPrimaryText: {
    color: '#FFF',
    fontWeight: '700',
  },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.text, marginTop: 16, marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 24, paddingHorizontal: 32 },
  browseButton: { backgroundColor: COLORS.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
  browseButtonText: { color: '#FFF', fontWeight: '600', fontSize: 16 },
});

export default WishlistScreen;
