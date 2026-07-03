import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Seller } from '../types/seller.types';
import { TrustBadge } from './TrustBadge';
import { StatusBadge } from './StatusBadge';
import { PremiumImage } from './PremiumImage';
import { COLORS } from '../constants/colors';
import { getStateName } from '../constants/regions';
import { calculateTrustScore, isTopArtisan } from '../utils/trustScore';
import { appwriteConfig } from '../config/appwrite';
import { normalizeImageList, resolveImageUrl } from '../services/storageService';

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
  const verificationDocs = normalizeImageList(seller.verificationDocuments);
  const imageUrl = resolveImageUrl(appwriteConfig.documentsBucketId, verificationDocs[0]);
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
        <PremiumImage
          uri={imageUrl}
          style={[styles.image, premiumVariant && styles.premiumImage]}
          resizeMode="contain"
          variant="shop"
          performanceMode="list"
          previewWidth={240}
          previewHeight={320}
        />
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
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  premiumContainer: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: `${COLORS.primary}24`,
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  image: {
    width: 96,
    height: 120,
    backgroundColor: COLORS.card,
    borderRadius: 11,
  },
  premiumImage: {
    width: 104,
    height: 128,
  },
  imageWrap: {
    width: 110,
    height: 136,
    padding: 7,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  premiumImageWrap: {
    width: 116,
    height: 140,
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.border,
  },
  content: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  premiumContent: {
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 7,
  },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
    flex: 1,
  },
  premiumName: {
    fontSize: 17,
    letterSpacing: 0.1,
  },
  verifiedIcon: {
    marginLeft: 6,
  },
  skills: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 9,
    lineHeight: 18,
  },
  premiumSkills: {
    fontSize: 13,
    lineHeight: 18,
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
    fontWeight: '600',
  },
  premiumLocationText: {
    fontSize: 13,
    fontWeight: '600',
  },
  trustMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 9,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    paddingHorizontal: 8,
    paddingVertical: 3,
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
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#F59E0B',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
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
