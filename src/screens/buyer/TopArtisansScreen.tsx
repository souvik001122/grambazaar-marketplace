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
import { rankSellersForTopArtisans } from '../../utils/homeRanking';
import { PremiumTopBar } from '../../components/PremiumTopBar';

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
      const ranked = rankSellersForTopArtisans(rawSellers);
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
      <PremiumTopBar
        title="Top Artisans"
        subtitle={subtitle}
        icon="ribbon-outline"
        showBack={navigation.canGoBack()}
        onBack={() => navigation.goBack()}
        rightLabel={refreshing ? 'Refreshing' : 'Refresh'}
        onRightPress={handleRefresh}
        rightDisabled={refreshing}
      />

      <FlatList
        data={sellers}
        keyExtractor={(item) => item.$id}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[COLORS.primary]} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.headerCard}>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerIconBadge}>
                <Ionicons name="ribbon-outline" size={14} color="#92400E" />
              </View>
              <Text style={styles.headerTitle}>Curated Seller Ranking</Text>
            </View>
            <Text style={styles.headerSubtitle}>Ranking updates as trust, reviews, and verified performance change.</Text>
            <View style={styles.headerMetaRow}>
              <View style={styles.headerMetaPill}>
                <Ionicons name="location-outline" size={12} color={COLORS.primary} />
                <Text style={styles.headerMetaPillText}>{regionLabel}</Text>
              </View>
              <View style={styles.headerMetaPill}>
                <Ionicons name="people-outline" size={12} color={COLORS.primary} />
                <Text style={styles.headerMetaPillText}>{sellers.length} artisan{sellers.length === 1 ? '' : 's'}</Text>
              </View>
            </View>
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
    borderWidth: 1,
    borderColor: `${COLORS.primary}25`,
    backgroundColor: '#FFFCF7',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B55',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  headerSubtitle: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  headerMetaRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  headerMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: `${COLORS.primary}35`,
    backgroundColor: `${COLORS.primary}10`,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  headerMetaPillText: {
    fontSize: 11,
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
