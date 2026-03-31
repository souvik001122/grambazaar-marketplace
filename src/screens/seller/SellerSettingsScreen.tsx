import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Linking,
  TextInput,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { getSellerByUserId, toggleShopStatus, updateSeller } from '../../services/sellerService';
import { Seller } from '../../types/seller.types';
import { COLORS } from '../../constants/colors';
import { showAlert } from '../../utils/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { uploadFile } from '../../services/storageService';

type PaymentForm = {
  paymentUpiId: string;
  paymentQrImageUrl: string;
  paymentBankAccountName: string;
  paymentBankAccountNumber: string;
  paymentBankIfsc: string;
};

const SellerSettingsScreen = ({ navigation }: any) => {
  const { user, logout } = useAuth();
  const [seller, setSeller] = useState<Seller | null>(null);
  const [loading, setLoading] = useState(true);
  const [shopActive, setShopActive] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [uploadingQr, setUploadingQr] = useState(false);
  const [paymentForm, setPaymentForm] = useState<PaymentForm>({
    paymentUpiId: '',
    paymentQrImageUrl: '',
    paymentBankAccountName: '',
    paymentBankAccountNumber: '',
    paymentBankIfsc: '',
  });

  useEffect(() => {
    loadSeller();
  }, []);

  const loadSeller = async () => {
    try {
      const sellerData = await getSellerByUserId(user!.$id);
      setSeller(sellerData);
      setShopActive(sellerData?.isShopActive !== false);
      setPaymentForm({
        paymentUpiId: sellerData?.paymentUpiId || '',
        paymentQrImageUrl: sellerData?.paymentQrImageUrl || '',
        paymentBankAccountName: sellerData?.paymentBankAccountName || '',
        paymentBankAccountNumber: sellerData?.paymentBankAccountNumber || '',
        paymentBankIfsc: sellerData?.paymentBankIfsc || '',
      });
    } catch (error) {
      console.error('Error loading seller:', error);
      showAlert('Error', 'Failed to load settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleShop = async (value: boolean) => {
    showAlert(
      value ? 'Activate Shop?' : 'Pause Shop?',
      value
        ? 'Your products will be visible to buyers again.'
        : 'Your products will be temporarily hidden from buyers.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: value ? 'Activate' : 'Pause',
          onPress: async () => {
            setToggling(true);
            try {
              await toggleShopStatus(user!.$id, value);
              setShopActive(value);
              showAlert('Success', value ? 'Shop is now active!' : 'Shop is paused.');
            } catch (error) {
              showAlert('Error', 'Failed to update shop status');
            } finally {
              setToggling(false);
            }
          },
        },
      ]
    );
  };

  const handleContactSupport = () => {
    showAlert('Contact Support', 'How would you like to reach us?', [
      { text: 'Cancel', style: 'cancel' },
      { text: '📞 Call', onPress: () => Linking.openURL('tel:+911234567890') },
      { text: '💬 WhatsApp', onPress: () => Linking.openURL('https://wa.me/911234567890?text=Hi, I need help with my GramBazaar seller account') },
    ]);
  };

  const handlePickQr = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showAlert('Permission Required', 'Please allow gallery access to upload your UPI QR image.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      setUploadingQr(true);
      const fileUrl = await uploadFile(result.assets[0].uri, `payment_qr_${user?.$id}_${Date.now()}`);
      setPaymentForm((prev) => ({ ...prev, paymentQrImageUrl: fileUrl }));
      showAlert('Uploaded', 'QR image uploaded. Tap Save Payment Details to apply changes.');
    } catch (error) {
      console.error('Error uploading QR image:', error);
      showAlert('Error', 'Failed to upload QR image');
    } finally {
      setUploadingQr(false);
    }
  };

  const handleSavePaymentDetails = async () => {
    const hasAnyBankField =
      paymentForm.paymentBankAccountName.trim() ||
      paymentForm.paymentBankAccountNumber.trim() ||
      paymentForm.paymentBankIfsc.trim();

    if (hasAnyBankField) {
      if (
        !paymentForm.paymentBankAccountName.trim() ||
        !paymentForm.paymentBankAccountNumber.trim() ||
        !paymentForm.paymentBankIfsc.trim()
      ) {
        showAlert('Incomplete Bank Details', 'Please provide account holder name, account number, and IFSC together.');
        return;
      }
    }

    setSavingPayment(true);
    try {
      const payload = {
        paymentUpiId: paymentForm.paymentUpiId.trim(),
        paymentQrImageUrl: paymentForm.paymentQrImageUrl.trim(),
        paymentBankAccountName: paymentForm.paymentBankAccountName.trim(),
        paymentBankAccountNumber: paymentForm.paymentBankAccountNumber.trim(),
        paymentBankIfsc: paymentForm.paymentBankIfsc.trim().toUpperCase(),
      };

      await updateSeller(user!.$id, payload);
      setSeller((prev) => (prev ? { ...prev, ...payload } : prev));
      showAlert('Saved', 'Payment details updated successfully. Buyers can now see these details after order acceptance.');
    } catch (error) {
      console.error('Error updating payment details:', error);
      showAlert('Error', 'Failed to save payment details');
    } finally {
      setSavingPayment(false);
    }
  };

  const handleLogout = () => {
    showAlert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
          } catch (error) {
            showAlert('Error', 'Failed to logout');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 16 }}>
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {seller?.businessName?.charAt(0).toUpperCase() || user?.name?.charAt(0).toUpperCase() || 'S'}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{seller?.businessName || user?.name}</Text>
          <Text style={styles.profileEmail}>{user?.email}</Text>
          <View style={[styles.verificationBadge, {
            backgroundColor: seller?.verificationStatus === 'approved' ? '#4CAF5020' : '#FFA50020',
          }]}>
            <Ionicons
              name={seller?.verificationStatus === 'approved' ? 'shield-checkmark' : 'time'}
              size={14}
              color={seller?.verificationStatus === 'approved' ? '#4CAF50' : '#FFA500'}
            />
            <Text style={[styles.verificationText, {
              color: seller?.verificationStatus === 'approved' ? '#4CAF50' : '#FFA500',
            }]}>
              {seller?.verificationStatus === 'approved' ? 'Verified Seller' : 'Pending Verification'}
            </Text>
          </View>
        </View>
      </View>

      {/* Shop Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SHOP MANAGEMENT</Text>
        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <Ionicons name="storefront-outline" size={22} color={shopActive ? '#4CAF50' : '#FF4444'} />
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Shop Status</Text>
              <Text style={styles.settingDescription}>
                {shopActive ? 'Your shop is visible to buyers' : 'Your shop is temporarily paused'}
              </Text>
            </View>
          </View>
          <Switch
            value={shopActive}
            onValueChange={handleToggleShop}
            disabled={toggling}
            trackColor={{ false: '#ddd', true: '#4CAF5040' }}
            thumbColor={shopActive ? '#4CAF50' : '#ccc'}
          />
        </View>
      </View>

      {/* Account Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ACCOUNT</Text>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('SellerTabs', { screen: 'Profile' })}
        >
          <Ionicons name="person-outline" size={22} color={COLORS.text} />
          <Text style={styles.menuText}>Edit Profile</Text>
          <Ionicons name="chevron-forward" size={18} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('VerificationStatus')}
        >
          <Ionicons name="shield-checkmark-outline" size={22} color={COLORS.text} />
          <Text style={styles.menuText}>Verification Status</Text>
          <Ionicons name="chevron-forward" size={18} color="#ccc" />
        </TouchableOpacity>
      </View>

      {/* Payment Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>PAYMENT DETAILS</Text>
        <View style={styles.paymentCard}>
          <Text style={styles.paymentInfoText}>
            Buyers see these details only after you accept an order.
          </Text>

          <Text style={styles.inputLabel}>UPI ID</Text>
          <TextInput
            style={styles.input}
            value={paymentForm.paymentUpiId}
            onChangeText={(text) => setPaymentForm((prev) => ({ ...prev, paymentUpiId: text }))}
            placeholder="example@upi"
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.inputLabel}>UPI QR Image</Text>
          <TouchableOpacity style={styles.qrUploadButton} onPress={handlePickQr} disabled={uploadingQr}>
            {uploadingQr ? (
              <ActivityIndicator color={COLORS.primary} size="small" />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={18} color={COLORS.primary} />
                <Text style={styles.qrUploadText}>
                  {paymentForm.paymentQrImageUrl ? 'Replace QR Image' : 'Upload QR Image'}
                </Text>
              </>
            )}
          </TouchableOpacity>
          {!!paymentForm.paymentQrImageUrl && (
            <Image source={{ uri: paymentForm.paymentQrImageUrl }} style={styles.qrPreview} />
          )}

          <Text style={styles.inputLabel}>Bank Account Holder</Text>
          <TextInput
            style={styles.input}
            value={paymentForm.paymentBankAccountName}
            onChangeText={(text) => setPaymentForm((prev) => ({ ...prev, paymentBankAccountName: text }))}
            placeholder="Account holder name"
          />

          <Text style={styles.inputLabel}>Bank Account Number</Text>
          <TextInput
            style={styles.input}
            value={paymentForm.paymentBankAccountNumber}
            onChangeText={(text) => setPaymentForm((prev) => ({ ...prev, paymentBankAccountNumber: text }))}
            placeholder="Account number"
            keyboardType="number-pad"
          />

          <Text style={styles.inputLabel}>Bank IFSC</Text>
          <TextInput
            style={styles.input}
            value={paymentForm.paymentBankIfsc}
            onChangeText={(text) => setPaymentForm((prev) => ({ ...prev, paymentBankIfsc: text }))}
            placeholder="e.g. SBIN0000123"
            autoCapitalize="characters"
          />

          <TouchableOpacity
            style={[styles.savePaymentButton, savingPayment && { opacity: 0.7 }]}
            onPress={handleSavePaymentDetails}
            disabled={savingPayment}
          >
            {savingPayment ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.savePaymentButtonText}>Save Payment Details</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Support */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SUPPORT</Text>

        <TouchableOpacity style={styles.menuItem} onPress={handleContactSupport}>
          <Ionicons name="headset-outline" size={22} color={COLORS.text} />
          <Text style={styles.menuText}>Contact Support</Text>
          <Ionicons name="chevron-forward" size={18} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => showAlert('FAQs', '1. How do I add products?\n→ Go to Dashboard > Add Product\n\n2. How long does verification take?\n→ Usually 1-3 business days\n\n3. How do I get paid?\n→ Payments are processed after order delivery\n\n4. Can I pause my shop?\n→ Yes, use the Shop Status toggle above\n\n5. How to improve trust score?\n→ Maintain good ratings, complete verifications, and stay active')}
        >
          <Ionicons name="help-circle-outline" size={22} color={COLORS.text} />
          <Text style={styles.menuText}>FAQs</Text>
          <Ionicons name="chevron-forward" size={18} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => showAlert('Report Issue', 'To report an issue, contact our support team via:\n\n📞 Phone: +91 1234567890\n💬 WhatsApp: Click Contact Support above\n📧 Email: support@grambazaar.in\n\nPlease include your seller ID and a screenshot of the problem.')}
        >
          <Ionicons name="bug-outline" size={22} color={COLORS.text} />
          <Text style={styles.menuText}>Report an Issue</Text>
          <Ionicons name="chevron-forward" size={18} color="#ccc" />
        </TouchableOpacity>
      </View>

      {/* About */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ABOUT</Text>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => showAlert('About GramBazaar', 'GramBazaar v1.0\n\nA verified marketplace for Indian artisans.\n\n© 2026 GramBazaar')}
        >
          <Ionicons name="information-circle-outline" size={22} color={COLORS.text} />
          <Text style={styles.menuText}>About GramBazaar</Text>
          <Ionicons name="chevron-forward" size={18} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => showAlert('Privacy Policy', 'GramBazaar Privacy Policy\n\n• We collect only necessary personal information\n• Your data is securely stored and never sold to third parties\n• Payment details are processed through secure gateways\n• You can request data deletion by contacting support\n• We use analytics to improve our service\n\nFor the full policy, visit grambazaar.in/privacy')}
        >
          <Ionicons name="lock-closed-outline" size={22} color={COLORS.text} />
          <Text style={styles.menuText}>Privacy Policy</Text>
          <Ionicons name="chevron-forward" size={18} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => showAlert('Terms of Service', 'GramBazaar Terms of Service\n\n• All products must be authentic handcrafted items\n• Sellers must complete identity verification\n• Product descriptions must be accurate\n• Orders must be fulfilled within stated timelines\n• GramBazaar charges a platform fee on each sale\n• Violations may result in account suspension\n\nFor full terms, visit grambazaar.in/terms')}
        >
          <Ionicons name="document-text-outline" size={22} color={COLORS.text} />
          <Text style={styles.menuText}>Terms of Service</Text>
          <Ionicons name="chevron-forward" size={18} color="#ccc" />
        </TouchableOpacity>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={22} color={COLORS.error} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>GramBazaar v1.0</Text>
      </View>
    </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  profileHeader: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    padding: 20, borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  avatar: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center', marginRight: 16,
  },
  avatarText: { fontSize: 24, fontWeight: '700', color: '#fff' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '700', color: '#333' },
  profileEmail: { fontSize: 13, color: '#999', marginTop: 2 },
  verificationBadge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 4, marginTop: 6,
  },
  verificationText: { fontSize: 12, fontWeight: '600' },
  section: { marginTop: 20 },
  sectionTitle: {
    fontSize: 12, fontWeight: '600', color: '#999', letterSpacing: 1,
    paddingHorizontal: 16, marginBottom: 8,
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 14,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#eee',
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  settingText: { marginLeft: 12, flex: 1 },
  settingLabel: { fontSize: 15, fontWeight: '500', color: '#333' },
  settingDescription: { fontSize: 12, color: '#999', marginTop: 2 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  menuText: { flex: 1, marginLeft: 12, fontSize: 15, color: '#333' },
  paymentCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#eee',
  },
  paymentInfoText: { fontSize: 12, color: '#666', marginBottom: 10 },
  inputLabel: { fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 6, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fafafa',
    marginBottom: 10,
    color: '#333',
  },
  qrUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 12,
    marginBottom: 10,
    backgroundColor: `${COLORS.primary}08`,
  },
  qrUploadText: { color: COLORS.primary, fontWeight: '600' },
  qrPreview: {
    width: '100%',
    height: 170,
    borderRadius: 10,
    backgroundColor: '#f3f3f3',
    marginBottom: 10,
  },
  savePaymentButton: {
    marginTop: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  savePaymentButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  logoutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    margin: 20, padding: 14, backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.error, gap: 8,
  },
  logoutText: { fontSize: 16, fontWeight: '600', color: COLORS.error },
  footer: { alignItems: 'center', paddingBottom: 32, paddingTop: 8 },
  footerText: { fontSize: 12, color: '#ccc' },
});

export default SellerSettingsScreen;
