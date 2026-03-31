import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Seller } from '../types/seller.types';
import { TrustBadge } from './TrustBadge';
import { StatusBadge } from './StatusBadge';
import { COLORS } from '../constants/colors';
import { getStateName } from '../constants/regions';
import { calculateTrustScore, isTopArtisan } from '../utils/trustScore';

interface SellerCardProps {
  seller: Seller;
  onPress: () => void;
  showStatus?: boolean;
  variant?: 'default' | 'premium';
}

const SellerCardComponent: React.FC<SellerCardProps> = ({
  seller,
  onPress,
  showStatus = false,
  variant = 'default',
}) => {
  const imageUrl = seller.verificationDocuments?.[0] || null;
  const trustScore = calculateTrustScore(seller);
  const topArtisan = isTopArtisan(seller);
  const premiumVariant = variant === 'premium';
  const isVerifiedSeller = !!seller.verifiedBadge || seller.verificationStatus === 'approved';
  const hasPinnedLocation =
    typeof seller.latitude === 'number' &&
    typeof seller.longitude === 'number' &&
    !Number.isNaN(seller.latitude) &&
    !Number.isNaN(seller.longitude);

  return (
    <TouchableOpacity
      style={[styles.container, premiumVariant && styles.premiumContainer]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <View style={[styles.imageWrap, premiumVariant && styles.premiumImageWrap]}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={[styles.image, premiumVariant && styles.premiumImage]} resizeMode="contain" />
        ) : (
          <View style={[styles.image, premiumVariant && styles.premiumImage, styles.imagePlaceholder]}>
            <Ionicons name="storefront-outline" size={32} color={COLORS.textTertiary} />
          </View>
        )}
      </View>
      
      <View style={[styles.content, premiumVariant && styles.premiumContent]}>
        <View style={styles.header}>
          <View style={styles.info}>
            <Text style={[styles.name, premiumVariant && styles.premiumName]} numberOfLines={1}>
              {seller.businessName}
            </Text>
            
            {isVerifiedSeller && (
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={COLORS.verified}
                style={styles.verifiedIcon}
              />
            )}
          </View>

          {showStatus && (
            <StatusBadge status={seller.verificationStatus} size="small" />
          )}
        </View>

        <Text style={[styles.skills, premiumVariant && styles.premiumSkills]} numberOfLines={2}>
          {seller.description}
        </Text>

        <View style={styles.footer}>
          <View style={[styles.location, premiumVariant && styles.premiumLocation]}>
            <Ionicons name="location-outline" size={14} color={COLORS.textSecondary} />
            <Text style={[styles.locationText, premiumVariant && styles.premiumLocationText]}>
              {seller.city ? `${seller.city}, ` : ''}{getStateName(seller.state)}
            </Text>
          </View>

          <TrustBadge score={trustScore} showLabel={false} size="small" />
        </View>

        <View style={styles.trustMetaRow}>
          {isVerifiedSeller && (
            <View style={styles.metaChip}>
              <Ionicons name="checkmark-circle" size={11} color={COLORS.verified} />
              <Text style={styles.metaChipText}>Verified Seller</Text>
            </View>
          )}
          {topArtisan && (
            <View style={styles.topArtisanChip}>
              <Ionicons name="ribbon-outline" size={11} color="#92400E" />
              <Text style={styles.topArtisanChipText}>Top Artisan</Text>
            </View>
          )}
          {hasPinnedLocation && (
            <View style={styles.metaChip}>
              <Ionicons name="navigate-circle-outline" size={11} color={COLORS.secondaryDark} />
              <Text style={styles.metaChipText}>Verified Location</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

export const SellerCard = React.memo(
  SellerCardComponent,
  (prev, next) =>
    prev.seller.$id === next.seller.$id &&
    prev.seller.updatedAt === next.seller.updatedAt &&
    prev.showStatus === next.showStatus &&
    prev.variant === next.variant
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  premiumContainer: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: `${COLORS.primary}22`,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  image: {
    width: 100,
    height: 120,
    backgroundColor: COLORS.card,
    borderRadius: 10,
  },
  premiumImage: {
    width: 108,
    height: 132,
  },
  imageWrap: {
    width: 112,
    height: 132,
    padding: 6,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  premiumImageWrap: {
    width: 120,
    height: 144,
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.border,
  },
  content: {
    flex: 1,
    padding: 12,
  },
  premiumContent: {
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    flex: 1,
  },
  premiumName: {
    fontSize: 18,
    letterSpacing: 0.1,
  },
  verifiedIcon: {
    marginLeft: 4,
  },
  skills: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 8,
    lineHeight: 18,
  },
  premiumSkills: {
    fontSize: 14,
    lineHeight: 19,
    marginBottom: 10,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  location: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  premiumLocation: {
    paddingRight: 8,
  },
  locationText: {
    marginLeft: 4,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  premiumLocationText: {
    fontSize: 13,
    fontWeight: '600',
  },
  trustMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  metaChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  topArtisanChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  topArtisanChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
  },
  products: {
    marginTop: 6,
    fontSize: 11,
    color: COLORS.textTertiary,
  },
});
