import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  BackHandler,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { getSellerByUserId } from '../../services/sellerService';
import { getProductsBySeller, deleteProduct } from '../../services/productService';
import { Product } from '../../types/product.types';
import { showAlert } from '../../utils/alert';
import { COLORS } from '../../constants/colors';
import { useFocusEffect } from '@react-navigation/native';
import { appwriteConfig } from '../../config/appwrite';
import { normalizeImageList, resolveImageUrl } from '../../services/storageService';
import { PremiumImage } from '../../components/PremiumImage';
import { PremiumTopBar } from '../../components/PremiumTopBar';

const PRODUCT_FILTER_TABS: Array<{ key: 'all' | 'active' | 'pending' | 'rejected'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'pending', label: 'Pending' },
  { key: 'rejected', label: 'Rejected' },
];

const MyProductsScreen = ({ navigation, route }: any) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'pending' | 'rejected'>('all');
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    filterProducts();
  }, [activeTab, products]);

  const loadProducts = useCallback(async () => {
    try {
      const seller = await getSellerByUserId(user!.$id);
      if (!seller) return;

      const productsData = await getProductsBySeller(seller.$id);
      setProducts(productsData);
    } catch (error) {
      console.error('Error loading products:', error);
      showAlert('Error', 'Failed to load products. Pull down to refresh.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [loadProducts])
  );

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (route?.params?.fromProfile) {
          navigation.setParams({ fromProfile: false });
          navigation.navigate('Profile');
          return true;
        }
        return false;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [navigation, route?.params?.fromProfile])
  );

  const filterProducts = () => {
    let filtered = products;
    
    switch (activeTab) {
      case 'active':
        filtered = products.filter(p => ['active', 'approved'].includes((p.status || 'pending').toLowerCase()));
        break;
      case 'pending':
        filtered = products.filter(p => (p.status || 'pending') === 'pending');
        break;
      case 'rejected':
        filtered = products.filter(p => (p.status || 'pending') === 'rejected');
        break;
      default:
        filtered = products;
    }

    setFilteredProducts(filtered);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadProducts();
  };

  const handleEdit = (product: Product) => {
    navigation.navigate('EditProduct', { product });
  };

  const handleDelete = (product: Product) => {
    showAlert(
      'Delete Product',
      `Are you sure you want to delete "${product.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteProduct(product.$id);
              setProducts(products.filter(p => p.$id !== product.$id));
              showAlert('Success', 'Product deleted successfully');
            } catch (error: any) {
              showAlert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'approved':
        return { color: '#4CAF50', text: 'Active', icon: 'checkmark-circle' };
      case 'pending':
      case 'review':
      case 'under_review':
        return { color: '#FFA500', text: 'Pending Review', icon: 'time' };
      case 'rejected':
      case 'declined':
        return { color: '#FF4444', text: 'Rejected', icon: 'close-circle' };
      default:
        return { color: '#FFA500', text: 'Pending Review', icon: 'time' };
    }
  };

  const getTabCount = (tab: string) => {
    switch (tab) {
      case 'active':
        return products.filter(p => ['active', 'approved'].includes((p.status || 'pending').toLowerCase())).length;
      case 'pending':
        return products.filter(p => (p.status || 'pending') === 'pending').length;
      case 'rejected':
        return products.filter(p => (p.status || 'pending') === 'rejected').length;
      default:
        return products.length;
    }
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const statusBadge = getStatusBadge(item.status || 'pending');
    const imageList = normalizeImageList(item.images);
    const imageUrl = resolveImageUrl(appwriteConfig.productImagesBucketId, imageList[0]);

    return (
      <View style={styles.productCard}>
        <PremiumImage
          uri={imageUrl}
          style={styles.productImage}
          variant="product"
        />
        
        <View style={styles.productInfo}>
          <View style={[styles.statusBadge, { backgroundColor: `${statusBadge.color}20` }]}>
            <Ionicons name={statusBadge.icon as any} size={14} color={statusBadge.color} />
            <Text style={[styles.statusText, { color: statusBadge.color }]}>
              {statusBadge.text}
            </Text>
          </View>

          <Text style={styles.productName} numberOfLines={2}>
            {item.name}
          </Text>

          <Text style={styles.productPrice}>₹{item.price.toLocaleString()}</Text>

          <View style={styles.productStats}>
            <View style={styles.statItem}>
              <Ionicons name="eye-outline" size={16} color="#666" />
              <Text style={styles.statText}>{item.views || 0} views</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="cube-outline" size={16} color="#666" />
              <Text style={styles.statText}>Stock: {item.stock || 0}</Text>
            </View>
          </View>

          {item.status === 'rejected' && (item as any).rejectionReason && (
            <View style={styles.rejectionBox}>
              <Text style={styles.rejectionLabel}>Reason:</Text>
              <Text style={styles.rejectionText} numberOfLines={2}>
                {(item as any).rejectionReason}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.productActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={() => handleEdit(item)}
          >
            <Ionicons name="pencil-outline" size={20} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDelete(item)}
          >
            <Ionicons name="trash-outline" size={20} color="#FF4444" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PremiumTopBar
        title="My Products"
        subtitle="Manage listings, stock, and status"
        icon="cube-outline"
        showBack={navigation.canGoBack()}
        onBack={() => navigation.goBack()}
        rightLabel={refreshing ? 'Refreshing' : 'Refresh'}
        onRightPress={onRefresh}
        rightDisabled={refreshing}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}
        contentContainerStyle={styles.tabsContent}
      >
        {PRODUCT_FILTER_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
            <View style={[styles.tabBadge, activeTab === tab.key && styles.tabBadgeActive]}>
              <Text style={[styles.tabBadgeText, activeTab === tab.key && styles.tabBadgeTextActive]}>
                {getTabCount(tab.key)}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Products List */}
      {filteredProducts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyTitle}>No Products Found</Text>
          <Text style={styles.emptyText}>
            {activeTab === 'all'
              ? 'Start adding products to your inventory'
              : `No ${activeTab} products at the moment`}
          </Text>
          {activeTab === 'all' && (
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => navigation.navigate('AddProduct')}
            >
              <Ionicons name="add-circle-outline" size={20} color="#fff" />
              <Text style={styles.addButtonText}>Add Product</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          renderItem={renderProduct}
          keyExtractor={(item) => item.$id}
          contentContainerStyle={[styles.listContainer, { paddingBottom: 16 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabsContainer: {
    maxHeight: 58,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabsContent: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    gap: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  tabActive: {
    backgroundColor: `${COLORS.primary}16`,
    borderColor: `${COLORS.primary}55`,
  },
  tabText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  tabTextActive: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  tabBadge: {
    backgroundColor: '#E7E5E4',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    minWidth: 24,
    alignItems: 'center',
  },
  tabBadgeActive: {
    backgroundColor: COLORS.primary,
  },
  tabBadgeText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  tabBadgeTextActive: {
    color: '#fff',
  },
  listContainer: {
    padding: 14,
  },
  productCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
    overflow: 'hidden',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  productImage: {
    width: 112,
    height: 146,
  },
  productInfo: {
    flex: 1,
    padding: 14,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 8,
    gap: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  productName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: 9,
  },
  productStats: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  rejectionBox: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#FFF3F3',
    borderRadius: 6,
    borderLeftWidth: 2,
    borderLeftColor: '#FF4444',
  },
  rejectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FF4444',
    marginBottom: 2,
  },
  rejectionText: {
    fontSize: 11,
    color: '#666',
  },
  productActions: {
    justifyContent: 'center',
    paddingHorizontal: 12,
    gap: 12,
  },
  actionButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  editButton: {
    backgroundColor: `${COLORS.primary}10`,
    borderColor: COLORS.primary,
  },
  deleteButton: {
    backgroundColor: '#FFF3F3',
    borderColor: '#FF4444',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 80,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  addButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: 'center',
    gap: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default MyProductsScreen;
