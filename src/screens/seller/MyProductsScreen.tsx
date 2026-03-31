import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { getSellerByUserId } from '../../services/sellerService';
import { getProductsBySeller, deleteProduct } from '../../services/productService';
import { Product } from '../../types/product.types';
import { showAlert } from '../../utils/alert';
import { COLORS } from '../../constants/colors';
import { useFocusEffect } from '@react-navigation/native';

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

    return (
      <View style={styles.productCard}>
        <Image 
          source={{ uri: item.images?.[0] || 'https://via.placeholder.com/100' }} 
          style={styles.productImage} 
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
      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {['all', 'active', 'pending', 'rejected'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab as any)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
            <View style={[styles.tabBadge, activeTab === tab && styles.tabBadgeActive]}>
              <Text style={[styles.tabBadgeText, activeTab === tab && styles.tabBadgeTextActive]}>
                {getTabCount(tab)}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

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
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  tabActive: {
    borderBottomWidth: 3,
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  tabTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  tabBadge: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
  },
  tabBadgeActive: {
    backgroundColor: COLORS.primary,
  },
  tabBadgeText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  tabBadgeTextActive: {
    color: '#fff',
  },
  listContainer: {
    padding: 16,
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  productImage: {
    width: 120,
    height: 150,
  },
  productInfo: {
    flex: 1,
    padding: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 8,
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
    color: '#666',
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
    width: 40,
    height: 40,
    borderRadius: 20,
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
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
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
