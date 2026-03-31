import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { getProductReviews } from '../../services/reviewService';
import { Review } from '../../types/common.types';
import { StarRating } from '../../components/StarRating';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { formatRelativeTime } from '../../utils/formatting';

const getReviewContextTag = (comment?: string): string | null => {
  const text = (comment || '').toLowerCase();
  if (!text) return null;

  const visitedSignals = ['visited', 'visit', 'shop', 'store', 'in person', 'offline'];
  const deliverySignals = ['delivery', 'delivered', 'online order', 'courier', 'shipping'];

  if (visitedSignals.some((word) => text.includes(word))) {
    return 'Visited shop';
  }

  if (deliverySignals.some((word) => text.includes(word))) {
    return 'Online delivery';
  }

  return null;
};

const ProductReviewsScreen = ({ route, navigation }: any) => {
  const tabBarHeight = 16;
  const productId = route?.params?.productId;
  const productName = route?.params?.productName || 'Product';

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    if (productId) loadReviews(1, true);
  }, [productId]);

  const loadReviews = async (p: number, reset: boolean = false) => {
    try {
      if (reset) setLoading(true);
      const data = await getProductReviews(productId, p, 20);
      if (reset) {
        setReviews(data.data);
      } else {
        setReviews((prev) => [...prev, ...data.data]);
      }
      setHasMore(data.hasMore);
      setPage(p);
    } catch (err) {
      console.error('Error loading reviews:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadReviews(1, true);
  }, [productId]);

  const handleLoadMore = () => {
    if (hasMore && !loading) {
      loadReviews(page + 1);
    }
  };

  if (!productId) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Invalid product</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading && !refreshing) return <LoadingSpinner fullScreen />;

  const renderReview = ({ item }: { item: Review }) => (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <StarRating rating={item.rating} size={16} showNumber={false} />
        <Text style={styles.reviewDate}>
          {item.createdAt ? formatRelativeTime(item.createdAt) : ''}
        </Text>
      </View>
      {getReviewContextTag(item.comment) && (
        <View style={styles.contextTag}>
          <Text style={styles.contextTagText}>{getReviewContextTag(item.comment)}</Text>
        </View>
      )}
      {item.comment ? (
        <Text style={styles.reviewComment}>{item.comment}</Text>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={reviews}
        keyExtractor={(item) => item.$id}
        renderItem={renderReview}
        contentContainerStyle={[styles.list, { paddingBottom: tabBarHeight }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[COLORS.primary]} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubble-outline" size={64} color={COLORS.textTertiary} />
            <Text style={styles.emptyTitle}>No reviews yet</Text>
            <Text style={styles.emptySubtext}>Be the first to review this product</Text>
          </View>
        }
        ListHeaderComponent={
          <View style={styles.trustHintCard}>
            <Ionicons name="shield-checkmark" size={16} color={COLORS.secondaryDark} />
            <Text style={styles.trustHintText}>
              Trust note: review tags indicate buyer context like visited shop or online delivery experience.
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: COLORS.background },
  errorText: { fontSize: 16, color: COLORS.textSecondary, marginTop: 16, marginBottom: 16 },
  retryButton: { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  retryButtonText: { color: '#FFF', fontWeight: '600' },
  list: { padding: 16 },
  reviewCard: {
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  reviewDate: { fontSize: 12, color: COLORS.textTertiary },
  contextTag: {
    alignSelf: 'flex-start',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: `${COLORS.info}44`,
    backgroundColor: `${COLORS.info}12`,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  contextTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.info,
  },
  reviewComment: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20 },
  trustHintCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderColor: `${COLORS.secondary}30`,
    backgroundColor: `${COLORS.secondary}10`,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  trustHintText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.secondaryDark,
    fontWeight: '600',
  },
  emptyContainer: { alignItems: 'center', marginTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginTop: 16, marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: COLORS.textSecondary },
});

export default ProductReviewsScreen;
