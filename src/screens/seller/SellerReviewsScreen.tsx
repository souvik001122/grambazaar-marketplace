import React, { useState, useCallback } from 'react';
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
import { getSellerByUserId } from '../../services/sellerService';
import { calculateSellerRating, getSellerReviews } from '../../services/reviewService';
import { getProductsBySeller } from '../../services/productService';
import { showAlert } from '../../utils/alert';
import { getUserById } from '../../services/userService';
import { Review } from '../../types/common.types';
import { COLORS } from '../../constants/colors';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

const SellerReviewsScreen = () => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [productMap, setProductMap] = useState<Record<string, string>>({});
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ avg: 0, total: 0, dist: [0, 0, 0, 0, 0] });

  const loadData = useCallback(async () => {
    try {
      const seller = await getSellerByUserId(user!.$id);
      if (!seller) return;

      // Load reviews and products in parallel
      const [reviewsRes, sellerRating, products] = await Promise.all([
        getSellerReviews(seller.$id, 1, 100),
        calculateSellerRating(seller.$id),
        getProductsBySeller(seller.$id),
      ]);

      setReviews(reviewsRes.data);

      // Build product name map
      const pMap: Record<string, string> = {};
      products.forEach((p: any) => { pMap[p.$id] = p.name; });
      setProductMap(pMap);

      // Build reviewer name map (batch fetch unique user IDs)
      const uniqueUserIds = [...new Set(reviewsRes.data.map(r => r.userId))];
      const uMap: Record<string, string> = {};
      await Promise.all(
        uniqueUserIds.map(async (uid) => {
          try {
            const u = await getUserById(uid);
            uMap[uid] = u?.name || 'Buyer';
          } catch {
            uMap[uid] = 'Buyer';
          }
        })
      );
      setUserMap(uMap);

      // Compute stats
      if (sellerRating.totalReviews > 0) {
        const dist = [0, 0, 0, 0, 0];
        reviewsRes.data.forEach(r => {
          const idx = Math.min(Math.max(Math.round(r.rating) - 1, 0), 4);
          dist[idx]++;
        });
        setStats({ avg: sellerRating.avgRating, total: sellerRating.totalReviews, dist });
      } else {
        setStats({ avg: 0, total: 0, dist: [0, 0, 0, 0, 0] });
      }
    } catch (error) {
      console.error('Error loading reviews:', error);
      showAlert('Error', 'Failed to load reviews. Pull down to refresh.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, []);

  const renderStars = (rating: number) => {
    return (
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map(i => (
          <Ionicons
            key={i}
            name={i <= rating ? 'star' : i - 0.5 <= rating ? 'star-half' : 'star-outline'}
            size={16}
            color="#FFC107"
          />
        ))}
      </View>
    );
  };

  const renderRatingBar = (starCount: number, count: number) => {
    const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
    return (
      <View style={styles.barRow} key={starCount}>
        <Text style={styles.barLabel}>{starCount}★</Text>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${pct}%` }]} />
        </View>
        <Text style={styles.barCount}>{count}</Text>
      </View>
    );
  };

  const renderReview = ({ item }: { item: Review }) => (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewerInfo}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={16} color="#FFF" />
          </View>
          <View>
            <Text style={styles.reviewerName}>{userMap[item.userId] || 'Buyer'}</Text>
            <Text style={styles.productName} numberOfLines={1}>
              {productMap[item.productId] || 'Product'}
            </Text>
          </View>
        </View>
        <View style={styles.ratingBadge}>
          {renderStars(item.rating)}
        </View>
      </View>
      {item.comment ? (
        <Text style={styles.comment}>{item.comment}</Text>
      ) : null}
      <Text style={styles.reviewDate}>
        {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN', {
          day: 'numeric', month: 'short', year: 'numeric',
        }) : ''}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <FlatList
        data={reviews}
        keyExtractor={(item) => item.$id}
        renderItem={renderReview}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={[styles.listContent, { paddingBottom: 16 }]}
        ListHeaderComponent={() => (
          <View style={styles.summaryCard}>
            <View style={styles.summaryLeft}>
              <Text style={styles.avgRating}>{stats.avg.toFixed(1)}</Text>
              {renderStars(Math.round(stats.avg))}
              <Text style={styles.totalReviews}>{stats.total} review{stats.total !== 1 ? 's' : ''}</Text>
            </View>
            <View style={styles.summaryRight}>
              {[5, 4, 3, 2, 1].map(star => renderRatingBar(star, stats.dist[star - 1]))}
            </View>
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>No Reviews Yet</Text>
            <Text style={styles.emptySubtext}>
              Reviews from buyers will appear here
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16 },
  summaryCard: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 20,
    marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 3,
  },
  summaryLeft: { alignItems: 'center', justifyContent: 'center', marginRight: 24 },
  avgRating: { fontSize: 40, fontWeight: '700', color: '#333' },
  totalReviews: { fontSize: 12, color: '#999', marginTop: 4 },
  summaryRight: { flex: 1, justifyContent: 'center' },
  starsRow: { flexDirection: 'row', gap: 2 },
  barRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 2 },
  barLabel: { width: 28, fontSize: 12, color: '#666', textAlign: 'right', marginRight: 8 },
  barTrack: { flex: 1, height: 8, backgroundColor: '#f0f0f0', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#FFC107', borderRadius: 4 },
  barCount: { width: 24, fontSize: 12, color: '#999', textAlign: 'center', marginLeft: 8 },
  reviewCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05,
    shadowRadius: 2, elevation: 2,
  },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  reviewerInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  avatar: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  reviewerName: { fontSize: 14, fontWeight: '600', color: '#333' },
  productName: { fontSize: 12, color: '#999', maxWidth: 150 },
  ratingBadge: { marginLeft: 8 },
  comment: { fontSize: 14, color: '#444', lineHeight: 20, marginBottom: 8 },
  reviewDate: { fontSize: 12, color: '#bbb' },
  emptyContainer: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginTop: 16 },
  emptySubtext: { fontSize: 14, color: '#999', marginTop: 4 },
});

export default SellerReviewsScreen;
