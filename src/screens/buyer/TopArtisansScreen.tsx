import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SellerCard } from '../../components/SellerCard';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { Seller } from '../../types/seller.types';
import { COLORS } from '../../constants/colors';
import { getSellersByRegion, getTopVerifiedSellers } from '../../services/sellerService';
import { calculateTrustScore, isTopArtisan } from '../../utils/trustScore';

const TopArtisansScreen = ({ navigation, route }: any) => {
  const regionParam = route?.params?.region;
  const regionLabelParam = route?.params?.regionLabel;
  const regionFilter = typeof regionParam === 'string' && regionParam.trim() ? regionParam.trim() : undefined;
  const regionLabel =
    typeof regionLabelParam === 'string' && regionLabelParam.trim()
      ? regionLabelParam.trim()
      : regionFilter || 'All India';

  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const subtitle = useMemo(
    () => (regionFilter ? `Verified artisans ranked for ${regionLabel}` : 'Verified artisans ranked across India'),
    [regionFilter, regionLabel]
  );

  const loadSellers = useCallback(async () => {
    try {
      setLoading(true);
      const rawSellers = regionFilter ? await getSellersByRegion(regionFilter) : await getTopVerifiedSellers(300);
      const ranked = [...rawSellers].sort((a, b) => {
        const aTop = isTopArtisan(a) ? 1 : 0;
        const bTop = isTopArtisan(b) ? 1 : 0;
        if (bTop !== aTop) {
          return bTop - aTop;
        }
        return calculateTrustScore(b) - calculateTrustScore(a);
      });
      setSellers(ranked);
    } catch (error) {
      console.error('Error loading top artisans list:', error);
      setSellers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [regionFilter]);

  useEffect(() => {
    loadSellers();
  }, [loadSellers]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadSellers();
  }, [loadSellers]);

  if (loading && !refreshing) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={sellers}
        keyExtractor={(item) => item.$id}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[COLORS.primary]} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.headerCard}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="ribbon-outline" size={16} color={COLORS.primaryDark} />
              <Text style={styles.headerTitle}>Top Artisans</Text>
            </View>
            <Text style={styles.headerSubtitle}>{subtitle}</Text>
            <Text style={styles.headerCount}>{sellers.length} artisan{sellers.length === 1 ? '' : 's'} found</Text>
          </View>
        }
        renderItem={({ item }) => (
          <SellerCard
            seller={item}
            variant="premium"
            onPress={() => navigation.navigate('SellerProfile', { sellerId: item.$id })}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="people-outline" size={34} color={COLORS.textTertiary} />
            <Text style={styles.emptyTitle}>No artisans found</Text>
            <Text style={styles.emptySubtitle}>
              {regionFilter
                ? `No verified artisans found in ${regionLabel} yet.`
                : 'No verified artisans available across India yet.'}
            </Text>
            <TouchableOpacity style={styles.emptyAction} onPress={() => navigation.goBack()}>
              <Text style={styles.emptyActionText}>Back to Home</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 24,
  },
  headerCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${COLORS.primary}28`,
    backgroundColor: `${COLORS.primary}10`,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  headerCount: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    paddingHorizontal: 18,
  },
  emptyTitle: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  emptySubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '600',
  },
  emptyAction: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: `${COLORS.primary}45`,
    backgroundColor: `${COLORS.primary}12`,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  emptyActionText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
  },
});

export default TopArtisansScreen;
