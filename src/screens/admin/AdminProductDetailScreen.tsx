import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { appwriteConfig } from '../../config/appwrite';
import { normalizeImageList, resolveImageUrl } from '../../services/storageService';
import { PremiumImage } from '../../components/PremiumImage';

const AdminProductDetailScreen = ({ route, navigation }: any) => {
  const tabBarHeight = 16;
  const product = route?.params?.product;

  if (!product) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <Ionicons name="alert-circle-outline" size={60} color={COLORS.textTertiary} />
        <Text style={{ fontSize: 16, color: COLORS.text, marginTop: 12 }}>Product data not available</Text>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={{ marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: COLORS.primary, borderRadius: 8 }}>
          <Text style={{ color: '#FFF', fontWeight: '600' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return COLORS.success;
      case 'pending': return COLORS.warning;
      case 'rejected': return COLORS.error;
      default: return COLORS.textSecondary;
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const productImages = normalizeImageList(product.images)
    .map((img) => resolveImageUrl(appwriteConfig.productImagesBucketId, img))
    .filter(Boolean);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: tabBarHeight }}>
      {/* Image Gallery */}
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.imageCarousel}>
        {productImages.length > 0 ? (
          productImages.map((img: string, i: number) => (
            <PremiumImage
              key={i}
              uri={img}
              style={styles.productImage}
              variant="product"
            />
          ))
        ) : (
          <PremiumImage
            style={styles.productImage}
            variant="product"
          />
        )}
      </ScrollView>

      {/* Product Info */}
      <View style={styles.card}>
        <View style={styles.nameRow}>
          <Text style={styles.productName}>{product.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(product.status) + '18' }]}>
            <Text style={[styles.statusText, { color: getStatusColor(product.status) }]}>
              {product.status?.charAt(0).toUpperCase() + product.status?.slice(1)}
            </Text>
          </View>
        </View>
        <Text style={styles.category}>{product.category}</Text>
        <Text style={styles.description}>{product.description}</Text>
      </View>

      {/* Pricing & Stock */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Pricing & Stock</Text>
        <View style={styles.metricsGrid}>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>₹{product.price}</Text>
            <Text style={styles.metricLabel}>Price</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{product.stock}</Text>
            <Text style={styles.metricLabel}>Stock</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{product.featured ? 'Yes' : 'No'}</Text>
            <Text style={styles.metricLabel}>Featured</Text>
          </View>
        </View>
      </View>

      {/* Performance */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Performance</Text>
        <View style={styles.metricsGrid}>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{product.rating?.toFixed(1) || '0.0'}</Text>
            <Text style={styles.metricLabel}>Rating</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{product.reviewCount || 0}</Text>
            <Text style={styles.metricLabel}>Reviews</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{product.views || 0}</Text>
            <Text style={styles.metricLabel}>Views</Text>
          </View>
        </View>
      </View>

      {/* Location */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Location & Tags</Text>
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={16} color={COLORS.primary} />
          <Text style={styles.infoText}>{product.region || 'N/A'}{product.state ? `, ${product.state}` : ''}</Text>
        </View>
        {product.tags && product.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {product.tags.map((tag: string, i: number) => (
              <View key={i} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* System Info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>System Info</Text>
        <View style={styles.infoRow}>
          <Ionicons name="key-outline" size={16} color={COLORS.primary} />
          <Text style={styles.infoText}>Product ID: {product.$id}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="storefront-outline" size={16} color={COLORS.primary} />
          <Text style={styles.infoText}>Seller ID: {product.sellerId}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
          <Text style={styles.infoText}>Created: {formatDate(product.createdAt)}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="refresh-outline" size={16} color={COLORS.primary} />
          <Text style={styles.infoText}>Updated: {formatDate(product.updatedAt)}</Text>
        </View>
      </View>

      <View style={{ height: 30 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  imageCarousel: { height: 250 },
  productImage: { width: 360, height: 250, resizeMode: 'cover' },
  placeholderImage: { backgroundColor: COLORS.card, justifyContent: 'center', alignItems: 'center' },
  card: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  productName: { fontSize: 20, fontWeight: '700', color: COLORS.text, flex: 1 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, marginLeft: 8 },
  statusText: { fontSize: 12, fontWeight: '700' },
  category: { fontSize: 14, color: COLORS.primary, fontWeight: '600', marginBottom: 8 },
  description: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  metricsGrid: { flexDirection: 'row', alignItems: 'center' },
  metricItem: { flex: 1, alignItems: 'center' },
  metricValue: { fontSize: 22, fontWeight: '700', color: COLORS.text },
  metricLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  metricDivider: { width: 1, height: 40, backgroundColor: COLORS.border },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  infoText: { fontSize: 13, color: COLORS.text },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag: { backgroundColor: COLORS.primary + '12', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  tagText: { fontSize: 11, color: COLORS.primary, fontWeight: '600' },
});

export default AdminProductDetailScreen;
