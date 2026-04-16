import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { getAllProducts, createAdminLog, adminDeleteProduct } from '../../services/adminService';
import { approveProduct, toggleFeatured } from '../../services/productService';
import { Product } from '../../types/product.types';
import { COLORS } from '../../constants/colors';
import { appwriteConfig } from '../../config/appwrite';
import { normalizeImageList, resolveImageUrl } from '../../services/storageService';
import { PremiumTopBar } from '../../components/PremiumTopBar';
import { PremiumImage } from '../../components/PremiumImage';
import { showAlert } from '../../utils/alert';

type FilterTab = 'pending' | 'active' | 'rejected' | 'all';

const AdminProductsScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('pending');
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const loadProducts = async () => {
    try {
      const all = await getAllProducts();
      setProducts(all as unknown as Product[]);
      setError(false);
    } catch (error) {
      console.error('Error loading products:', error);
      setError(true);
      if (!refreshing) showAlert('Error', 'Failed to load products.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadProducts(); }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadProducts();
  }, []);

  const filtered = products.filter(p => {
    if (activeTab === 'all') return true;
    return p.status === activeTab;
  });

  const handleApprove = (product: Product) => {
    showAlert('Approve Product', `Approve "${product.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        onPress: async () => {
          setProcessing(product.$id);
          try {
            await approveProduct({ productId: product.$id, status: 'active', adminId: user!.$id });
            await createAdminLog(user!.$id, 'approve_product', 'product', product.$id, product.name);
            showAlert('Success', 'Product approved!');
            loadProducts();
          } catch {
            showAlert('Error', 'Failed to approve product.');
          } finally {
            setProcessing(null);
          }
        },
      },
    ]);
  };

  const handleReject = (product: Product) => {
    showAlert('Reject Product', `Reject "${product.name}"? The seller will be notified.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          setProcessing(product.$id);
          try {
            await approveProduct({ productId: product.$id, status: 'rejected', reason: 'Does not meet quality requirements', adminId: user!.$id });
            await createAdminLog(user!.$id, 'reject_product', 'product', product.$id, product.name);
            showAlert('Done', 'Product rejected.');
            loadProducts();
          } catch {
            showAlert('Error', 'Failed to reject product.');
          } finally {
            setProcessing(null);
          }
        },
      },
    ]);
  };

  const handleToggleFeatured = async (product: Product) => {
    try {
      await toggleFeatured(product.$id, !product.featured);
      showAlert('Success', product.featured ? 'Removed from featured.' : 'Added to featured!');
      loadProducts();
    } catch {
      showAlert('Error', 'Failed to update featured status.');
    }
  };

  const handleDelete = (product: Product) => {
    showAlert('Delete Product', `Permanently delete "${product.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setProcessing(product.$id);
          try {
            await adminDeleteProduct(product.$id, user!.$id);
            showAlert('Done', 'Product deleted.');
            loadProducts();
          } catch {
            showAlert('Error', 'Failed to delete product.');
          } finally {
            setProcessing(null);
          }
        },
      },
    ]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return COLORS.success;
      case 'pending': return COLORS.warning;
      case 'rejected': return COLORS.error;
      default: return COLORS.textSecondary;
    }
  };

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'pending', label: 'Pending', count: products.filter(p => p.status === 'pending').length },
    { key: 'active', label: 'Active', count: products.filter(p => p.status === 'active').length },
    { key: 'rejected', label: 'Rejected', count: products.filter(p => p.status === 'rejected').length },
    { key: 'all', label: 'All', count: products.length },
  ];

  const renderProductCard = ({ item }: { item: Product }) => {
    const isProcessing = processing === item.$id;
    const imageList = normalizeImageList(item.images);
    const imageUri = resolveImageUrl(appwriteConfig.productImagesBucketId, imageList[0]);
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('AdminProductDetail', { product: item })}
        activeOpacity={0.7}
      >
        <View style={styles.cardRow}>
          <PremiumImage
            uri={imageUri}
            style={styles.productImage}
            variant="product"
          />
          <View style={styles.cardInfo}>
            <View style={styles.nameStatusRow}>
              <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '18' }]}>
                <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                  {(item.status || 'unknown').charAt(0).toUpperCase() + (item.status || 'unknown').slice(1)}
                </Text>
              </View>
            </View>
            <Text style={styles.category}>{item.category}</Text>
            <View style={styles.priceRow}>
              <Text style={styles.price}>₹{item.price}</Text>
              <Text style={styles.stock}>Stock: {item.stock}</Text>
              {item.featured && (
                <View style={styles.featuredBadge}>
                  <Ionicons name="star" size={10} color={COLORS.primaryLight} />
                  <Text style={styles.featuredText}> Featured</Text>
                </View>
              )}
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>
                <Ionicons name="star" size={11} color={COLORS.warning} /> {item.rating?.toFixed(1) || '0.0'}
              </Text>
              <Text style={styles.metaText}>
                <Ionicons name="eye" size={11} color={COLORS.textTertiary} /> {item.views || 0}
              </Text>
              <Text style={styles.metaText}>
                <Ionicons name="chatbubble" size={11} color={COLORS.textTertiary} /> {item.reviewCount || 0}
              </Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {item.status === 'pending' && (
            <>
              <TouchableOpacity
                style={[styles.actionBtn, styles.approveBtn]}
                onPress={() => handleApprove(item)}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={14} color="#FFF" />
                    <Text style={styles.actionTextLight}> Approve</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.rejectBtn]}
                onPress={() => handleReject(item)}
                disabled={isProcessing}
              >
                <Ionicons name="close" size={14} color={COLORS.error} />
                <Text style={[styles.actionText, { color: COLORS.error }]}> Reject</Text>
              </TouchableOpacity>
            </>
          )}
          {item.status === 'active' && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.featureBtn]}
              onPress={() => handleToggleFeatured(item)}
            >
              <Ionicons name={item.featured ? 'star' : 'star-outline'} size={14} color={COLORS.primaryLight} />
              <Text style={[styles.actionText, { color: COLORS.primaryLight }]}>
                {item.featured ? ' Unfeature' : ' Feature'}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionBtn, styles.deleteBtn]}
            onPress={() => handleDelete(item)}
            disabled={isProcessing}
          >
            <Ionicons name="trash-outline" size={14} color={COLORS.error} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (error && products.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="cloud-offline-outline" size={60} color={COLORS.textTertiary} />
        <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.text, marginTop: 16 }}>Failed to load products</Text>
        <TouchableOpacity onPress={() => { setLoading(true); setError(false); loadProducts(); }} style={{ marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: COLORS.primary, borderRadius: 8 }}>
          <Text style={{ color: '#FFF', fontWeight: '600' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PremiumTopBar
        title="Products"
        subtitle="Approve, reject, feature, or remove listings"
        icon="cube"
        rightLabel={refreshing ? 'Refreshing' : 'Refresh'}
        onRightPress={onRefresh}
        rightDisabled={refreshing}
      />
      {/* Tabs */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
              {tab.label}
            </Text>
            {tab.count > 0 && (
              <View style={[styles.tabBadge, activeTab === tab.key && styles.activeTabBadge]}>
                <Text style={[styles.tabBadgeText, activeTab === tab.key && styles.activeTabBadgeText]}>
                  {tab.count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        renderItem={renderProductCard}
        keyExtractor={(item) => item.$id}
        contentContainerStyle={[styles.listContent, { paddingBottom: 16 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={60} color={COLORS.textTertiary} />
            <Text style={styles.emptyTitle}>No {activeTab} products</Text>
          </View>
        }
      />
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
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  tabBar: { flexDirection: 'row', backgroundColor: COLORS.surface, paddingHorizontal: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 8, marginHorizontal: 2 },
  activeTab: { backgroundColor: COLORS.primary + '15' },
  tabText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  activeTabText: { color: COLORS.primary, fontWeight: '700' },
  tabBadge: { backgroundColor: COLORS.border, borderRadius: 8, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', marginLeft: 4, paddingHorizontal: 4 },
  activeTabBadge: { backgroundColor: COLORS.primary },
  tabBadgeText: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary },
  activeTabBadgeText: { color: '#FFF' },
  listContent: { padding: 16 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  cardRow: { flexDirection: 'row' },
  productImage: { width: 80, height: 80, borderRadius: 12, backgroundColor: COLORS.card },
  cardInfo: { flex: 1, marginLeft: 12 },
  nameStatusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  productName: { fontSize: 15, fontWeight: '700', color: COLORS.text, flex: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginLeft: 6 },
  statusText: { fontSize: 10, fontWeight: '700' },
  category: { fontSize: 12, color: COLORS.primary, marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 10 },
  price: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  stock: { fontSize: 12, color: COLORS.textSecondary },
  featuredBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primaryLight + '18', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  featuredText: { fontSize: 10, color: COLORS.primaryLight, fontWeight: '600' },
  metaRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  metaText: { fontSize: 11, color: COLORS.textSecondary },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  approveBtn: { backgroundColor: COLORS.success },
  rejectBtn: { backgroundColor: COLORS.error + '12', borderWidth: 1, borderColor: COLORS.error + '30' },
  featureBtn: { backgroundColor: COLORS.primaryLight + '12', borderWidth: 1, borderColor: COLORS.primaryLight + '30' },
  deleteBtn: { backgroundColor: COLORS.error + '10', borderWidth: 1, borderColor: COLORS.error + '20', paddingHorizontal: 10 },
  actionText: { fontSize: 12, fontWeight: '600' },
  actionTextLight: { fontSize: 12, fontWeight: '600', color: '#FFF' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text, marginTop: 16 },
});

export default AdminProductsScreen;
