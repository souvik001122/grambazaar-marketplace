import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { getUserReviews } from '../../services/reviewService';
import { getProductById } from '../../services/productService';
import { Review } from '../../types/common.types';
import { formatRelativeTime } from '../../utils/formatting';
import { StarRating } from '../../components/StarRating';
import { BUYER_LAYOUT } from '../../constants/layout';
import { PremiumTopBar } from '../../components/PremiumTopBar';

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

type ReviewWithProduct = Review & { productName?: string; productId?: string };

const BuyerMyReviewsScreen = ({ navigation }: any) => {
  const tabBarHeight = 16;
  const { width: screenWidth } = useWindowDimensions();
  const isLargeScreen = screenWidth >= BUYER_LAYOUT.railBreakpoint;
  const railStyle = isLargeScreen ? styles.contentRailWide : undefined;
  const { user } = useAuth();
  const [reviews, setReviews] = useState<ReviewWithProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadReviews = useCallback(async () => {
    if (!user) return;

    try {
      const response = await getUserReviews(user.$id, 1, 50);

      const withProducts = await Promise.all(
        response.data.map(async (review) => {
          const product = await getProductById(review.productId).catch(() => null);
          return {
            ...review,
            productName: product?.name || 'Product',
          };
        })
      );

      setReviews(withProducts);
    } catch (error) {
      console.error('Failed to load my reviews:', error);
      setReviews([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  const onRefresh = () => {
    setRefreshing(true);
    loadReviews();
  };

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PremiumTopBar
        title="My Reviews"
        subtitle="Your ratings help buyers trust local artisans"
        icon="star"
        showBack={navigation.canGoBack()}
        onBack={() => navigation.goBack()}
      />

      <FlatList
        data={reviews}
        keyExtractor={(item) => item.$id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        contentContainerStyle={[styles.listContent, railStyle, { paddingBottom: tabBarHeight }]}
        ListHeaderComponent={
          <>
            <View style={styles.summaryCard}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{reviews.length}</Text>
                <Text style={styles.summaryLabel}>Total</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{reviews.filter((item) => item.rating >= 4).length}</Text>
                <Text style={styles.summaryLabel}>Positive</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{reviews.filter((item) => !!getReviewContextTag(item.comment)).length}</Text>
                <Text style={styles.summaryLabel}>With Context</Text>
              </View>
            </View>

            <View style={styles.trustHintCard}>
              <Ionicons name="shield-checkmark" size={16} color={COLORS.secondaryDark} />
              <Text style={styles.trustHintText}>
                Trust transparency: review context shows whether feedback is from a shop visit or online delivery.
              </Text>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="star-outline" size={44} color={COLORS.textTertiary} />
            <Text style={styles.emptyText}>You have not reviewed any product yet.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('ProductDetail', { productId: item.productId })}
            activeOpacity={0.85}
          >
            <Text style={styles.productName}>{item.productName || 'Product'}</Text>
            <View style={styles.ratingRow}>
              <StarRating rating={item.rating} size={15} showNumber={false} />
              <Text style={styles.timeText}>{item.createdAt ? formatRelativeTime(item.createdAt) : ''}</Text>
            </View>
            {getReviewContextTag(item.comment) && (
              <View style={styles.contextTag}>
                <Text style={styles.contextTagText}>{getReviewContextTag(item.comment)}</Text>
              </View>
            )}
            {!!item.comment && <Text style={styles.comment}>{item.comment}</Text>}
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  contentRailWide: {
    width: '100%',
    maxWidth: BUYER_LAYOUT.railMaxWidth,
    alignSelf: 'center',
  },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: 12, paddingBottom: 28 },
  headerCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.text,
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  summaryCard: {
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${COLORS.primary}22`,
    backgroundColor: `${COLORS.primary}10`,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 24,
    backgroundColor: `${COLORS.primary}33`,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  summaryLabel: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 13,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timeText: {
    fontSize: 12,
    color: COLORS.textTertiary,
  },
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
  comment: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  trustHintCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderColor: `${COLORS.secondary}30`,
    backgroundColor: `${COLORS.secondary}10`,
    borderRadius: 12,
    padding: 11,
    marginBottom: 10,
  },
  trustHintText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.secondaryDark,
    lineHeight: 17,
    fontWeight: '600',
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
});

export default BuyerMyReviewsScreen;
