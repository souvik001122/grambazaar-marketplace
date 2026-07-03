import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { appwriteConfig } from '../../config/appwrite';
import { normalizeImageList, resolveImageUrl } from '../../services/storageService';
import { PremiumImage } from '../../components/PremiumImage';

const AdminSellerDetailScreen = ({ route, navigation }: any) => {
  const tabBarHeight = 16;
  const seller = route?.params?.seller;

  if (!seller) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <Ionicons name="alert-circle-outline" size={60} color={COLORS.textTertiary} />
        <Text style={{ fontSize: 16, color: COLORS.text, marginTop: 12 }}>Seller data not available</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: COLORS.primary, borderRadius: 8 }}>
          <Text style={{ color: '#FFF', fontWeight: '600' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return COLORS.success;
      case 'pending': return COLORS.warning;
      case 'rejected': return COLORS.error;
      case 'blocked': return '#78716C';
      default: return COLORS.textSecondary;
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const InfoRow = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
    <View style={styles.infoRow}>
      <Ionicons name={icon as any} size={18} color={COLORS.primary} style={styles.infoIcon} />
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || 'N/A'}</Text>
      </View>
    </View>
  );

  const verificationDocs = normalizeImageList(seller.verificationDocuments);
  const shopPhotoUrl = resolveImageUrl(appwriteConfig.documentsBucketId, verificationDocs[0]);
  const idProofUrl = resolveImageUrl(appwriteConfig.documentsBucketId, verificationDocs[1]);
  const locality = seller.village || '';
  const district = seller.district || seller.city || '';
  const state = seller.state || seller.region || '';
  const locationHierarchy = [locality, district, state].filter(Boolean).join(', ');
  const locationLine = locationHierarchy || [seller.city, seller.state].filter(Boolean).join(', ') || 'N/A';

  const openDocumentPreview = (url: string, type: 'pdf' | 'image', title: string) => {
    if (!url) return;
    navigation.navigate('AdminDocumentViewer', { url, type, title });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: tabBarHeight }}>
      {/* Header with shop photo */}
      <View style={styles.header}>
        <PremiumImage
          uri={shopPhotoUrl}
          style={styles.shopPhoto}
          resizeMode="cover"
          variant="shop"
        />
        <View style={styles.headerOverlay}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Business Info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Submitted Seller Application</Text>
        <View style={styles.nameRow}>
          <Text style={styles.businessName}>{seller.businessName}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(seller.verificationStatus) + '18' }]}>
            <Text style={[styles.statusText, { color: getStatusColor(seller.verificationStatus) }]}>
              {(seller.verificationStatus || 'unknown').charAt(0).toUpperCase() + (seller.verificationStatus || 'unknown').slice(1)}
            </Text>
          </View>
        </View>
        <Text style={styles.craftLabel}>{seller.craftType || 'Craft type not provided'}</Text>
        <Text style={styles.description}>{seller.description}</Text>
        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={14} color={COLORS.textTertiary} />
          <Text style={styles.metaText}>Submitted on {formatDate(seller.createdAt)}</Text>
        </View>
      </View>

      {/* Contact & Location */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Contact and Location Submitted</Text>
        <InfoRow icon="call-outline" label="Phone" value={seller.phone} />
        <InfoRow icon="map-outline" label="Service Location" value={locationLine} />
        <InfoRow icon="pin-outline" label="Address Line" value={seller.address} />
        {!!seller.region && seller.region !== seller.state && (
          <InfoRow icon="globe-outline" label="Region" value={seller.region} />
        )}
        {seller.phone && (
          <TouchableOpacity
            style={styles.callBtn}
            onPress={() => Linking.openURL(`tel:${seller.phone}`)}
          >
            <Ionicons name="call" size={18} color="#FFF" />
            <Text style={styles.callBtnText}> Call Seller</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Metrics */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Performance</Text>
        <View style={styles.metricsGrid}>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{seller.rating?.toFixed(1) || '0.0'}</Text>
            <Text style={styles.metricLabel}>Rating</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{seller.totalOrders || 0}</Text>
            <Text style={styles.metricLabel}>Total Orders</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{seller.verifiedBadge ? 'Yes' : 'No'}</Text>
            <Text style={styles.metricLabel}>Verified Badge</Text>
          </View>
        </View>
      </View>

      {/* Shop Status */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Shop Status</Text>
        <InfoRow icon="toggle-outline" label="Shop Active" value={seller.isShopActive !== false ? 'Yes' : 'No'} />
        <InfoRow icon="calendar-outline" label="Joined" value={formatDate(seller.createdAt)} />
        <InfoRow icon="refresh-outline" label="Last Updated" value={formatDate(seller.updatedAt)} />
      </View>

      {/* Verification Documents */}
      {(shopPhotoUrl || idProofUrl) && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Verification Documents</Text>
          <Text style={styles.docsHint}>Review each file directly inside the app before taking action.</Text>
          <View style={styles.docsGrid}>
            <View style={styles.docItem}>
              <Text style={styles.docLabel}>Shop Photo (Image)</Text>
              <TouchableOpacity onPress={() => openDocumentPreview(shopPhotoUrl, 'image', 'Shop Photo')} disabled={!shopPhotoUrl}>
                <PremiumImage
                  uri={shopPhotoUrl}
                  style={styles.docImage}
                  resizeMode="cover"
                  variant="document"
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.docActionBtn}
                onPress={() => openDocumentPreview(shopPhotoUrl, 'image', 'Shop Photo')}
                disabled={!shopPhotoUrl}
              >
                <Ionicons name="eye-outline" size={16} color={shopPhotoUrl ? COLORS.primary : COLORS.textTertiary} />
                <Text style={[styles.docActionText, !shopPhotoUrl && styles.docActionTextDisabled]}>View Image</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.docItem}>
              <Text style={styles.docLabel}>ID Proof (PDF)</Text>
              <View style={[styles.docImage, styles.docPlaceholder]}>
                <Ionicons name="document-text-outline" size={34} color={COLORS.primary} />
                <Text style={styles.pdfText}>PDF document</Text>
              </View>
              <TouchableOpacity
                style={styles.docActionBtn}
                onPress={() => openDocumentPreview(idProofUrl, 'pdf', 'ID Proof')}
                disabled={!idProofUrl}
              >
                <Ionicons name="scan-outline" size={16} color={idProofUrl ? COLORS.primary : COLORS.textTertiary} />
                <Text style={[styles.docActionText, !idProofUrl && styles.docActionTextDisabled]}>View PDF</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* IDs */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>System Info</Text>
        <InfoRow icon="key-outline" label="Seller ID" value={seller.$id} />
        <InfoRow icon="person-outline" label="User ID" value={seller.userId} />
      </View>

      <View style={{ height: 30 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    height: 220,
    position: 'relative',
  },
  shopPhoto: {
    width: '100%',
    height: 220,
    resizeMode: 'cover',
  },
  placeholderPhoto: {
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  businessName: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  craftLabel: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  metaRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: COLORS.textTertiary,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  infoIcon: {
    marginTop: 2,
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: COLORS.textTertiary,
  },
  infoValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
    marginTop: 1,
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.success,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  callBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  metricsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
  },
  metricLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.border,
  },
  docsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  docItem: {
    flex: 1,
  },
  docImage: {
    width: '100%',
    height: 130,
    borderRadius: 10,
    backgroundColor: COLORS.card,
  },
  docPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#FAFAFA',
    gap: 6,
  },
  docLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 6,
    fontWeight: '600',
    textAlign: 'left',
  },
  docsHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 10,
    lineHeight: 18,
  },
  pdfText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  docActionBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.primary + '50',
    backgroundColor: COLORS.primary + '12',
  },
  docActionText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '700',
  },
  docActionTextDisabled: {
    color: COLORS.textTertiary,
  },
});

export default AdminSellerDetailScreen;
