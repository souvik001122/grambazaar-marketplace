import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { getSellerByUserId, deleteSellerProfile } from '../../services/sellerService';
import { Seller } from '../../types/seller.types';
import { COLORS } from '../../constants/colors';
import { showAlert } from '../../utils/alert';
import { PremiumTopBar } from '../../components/PremiumTopBar';

export const SellerVerificationStatusScreen = ({ navigation, onRecheck }: any) => {
  const { user, logout } = useAuth();
  const [seller, setSeller] = useState<Seller | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSellerData();
  }, []);

  const loadSellerData = async () => {
    try {
      setLoading(true);
      const sellerData = await getSellerByUserId(user!.$id);
      setSeller(sellerData);
    } catch (error) {
      console.error('Error loading seller:', error);
      showAlert('Error', 'Failed to load verification status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleContactAdmin = () => {
    Linking.openURL('tel:+911234567890'); // Replace with actual admin number
  };

  const handleReapply = () => {
    showAlert(
      'Reapply?',
      'This will delete your current application so you can submit a new one.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reapply',
          onPress: async () => {
            try {
              setLoading(true);
              if (seller?.$id) {
                await deleteSellerProfile(seller.$id);
              }
              // Trigger AppNavigator to recheck — no profile means BecomeSellerScreen
              if (onRecheck) {
                onRecheck();
              }
            } catch (error) {
              showAlert('Error', 'Failed to reset application. Try again.');
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!seller) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Seller data not found</Text>
      </View>
    );
  }

  const getStatusInfo = () => {
    switch (seller.verificationStatus) {
      case 'pending':
        return {
          icon: 'time-outline',
          title: 'Application Under Review',
          color: '#FFA500',
          message: 'Your seller application is being reviewed by our admin team. You will be notified once the review is complete.',
        };
      case 'rejected':
        return {
          icon: 'close-circle-outline',
          title: 'Application Rejected',
          color: '#FF4444',
          message: 'Your application was not approved. Please contact admin for details.',
        };
      case 'blocked':
        return {
          icon: 'ban-outline',
          title: 'Account Blocked',
          color: '#FF0000',
          message: 'Your seller account has been blocked due to policy violations. Please contact admin for more information.',
        };
      default:
        return {
          icon: 'checkmark-circle-outline',
          title: 'Verified',
          color: '#4CAF50',
          message: 'Your seller account is active.',
        };
    }
  };

  const statusInfo = getStatusInfo();
  const locality = seller.village || '';
  const district = seller.district || seller.city || '';
  const locationLine = [locality, district, seller.state].filter(Boolean).join(', ');
  const submittedOn = seller.createdAt ? new Date(seller.createdAt).toLocaleDateString('en-IN') : 'N/A';

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <PremiumTopBar
        title="Verification Status"
        subtitle="Track your seller application review"
        icon="shield-checkmark-outline"
        showBack={navigation?.canGoBack?.()}
        onBack={() => navigation?.goBack?.()}
      />
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.contentContainer}>
      <View style={[styles.statusCard, { borderLeftColor: statusInfo.color }]}>
        <View style={[styles.statusIconWrap, { backgroundColor: statusInfo.color + '15' }]}>
          <Ionicons name={statusInfo.icon as any} size={40} color={statusInfo.color} />
        </View>
        <Text style={[styles.title, { color: statusInfo.color }]}>{statusInfo.title}</Text>
        <Text style={styles.message}>{statusInfo.message}</Text>
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>Submitted Information</Text>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Shop Name:</Text>
          <Text style={styles.infoValue}>{seller.businessName}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Craft Type:</Text>
          <Text style={styles.infoValue}>{seller.craftType}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Description:</Text>
          <Text style={styles.infoValue}>{seller.description}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Service Location:</Text>
          <Text style={styles.infoValue}>{locationLine || 'Not provided'}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Address Line:</Text>
          <Text style={styles.infoValue}>{seller.address}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Submitted:</Text>
          <Text style={styles.infoValue}>{submittedOn}</Text>
        </View>

        {seller.verificationStatus === 'rejected' && (
          <View style={styles.rejectionBox}>
            <Text style={styles.rejectionTitle}>Rejection Reason:</Text>
            <Text style={styles.rejectionReason}>Please contact admin for details.</Text>
          </View>
        )}
      </View>

      <View style={styles.actionsSection}>
        {onRecheck && (
          <TouchableOpacity
            style={[styles.contactButton, { backgroundColor: COLORS.primary }]}
            onPress={() => {
              setLoading(true);
              onRecheck();
            }}
          >
            <Ionicons name="refresh-outline" size={18} color="#fff" />
            <Text style={[styles.contactButtonText, { color: '#fff' }]}>Check Status</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.contactButton} onPress={handleContactAdmin}>
          <Ionicons name="call-outline" size={18} color="#fff" />
          <Text style={styles.contactButtonText}>Contact Admin</Text>
        </TouchableOpacity>

        {seller.verificationStatus === 'rejected' && (
          <TouchableOpacity style={styles.reapplyButton} onPress={handleReapply}>
            <Text style={styles.reapplyButtonText}>Reapply</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.reapplyButton, { borderColor: COLORS.error }]}
          onPress={() => {
            showAlert('Logout', 'Are you sure?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Logout', style: 'destructive', onPress: () => logout() },
            ]);
          }}
        >
          <Text style={[styles.reapplyButtonText, { color: COLORS.error }]}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.noteBox}>
        <Text style={styles.noteTitle}>Note:</Text>
        <Text style={styles.noteText}>
          {seller.verificationStatus === 'pending'
            ? 'Product uploads are disabled until your account is verified. This usually takes 24-48 hours.'
            : 'For any queries, please contact our admin team using the contact button above.'}
        </Text>
      </View>
    </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  screenHeaderTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  statusCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 22,
    alignItems: 'center',
    borderLeftWidth: 4,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  statusIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 30 / 1.3,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  infoSection: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'column',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '700',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
    fontWeight: '600',
  },
  rejectionBox: {
    backgroundColor: '#FFF3F3',
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#FF4444',
  },
  rejectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF4444',
    marginBottom: 8,
  },
  rejectionReason: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  actionsSection: {
    marginBottom: 20,
  },
  contactButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  contactButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  reapplyButton: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: `${COLORS.primary}55`,
  },
  reapplyButtonText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  noteBox: {
    backgroundColor: '#FFF9E6',
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#FFA500',
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFA500',
    marginBottom: 8,
  },
  noteText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.error,
    textAlign: 'center',
    marginTop: 50,
  },
});
