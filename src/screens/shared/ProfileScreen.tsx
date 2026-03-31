import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Image,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/colors';
import { showAlert } from '../../utils/alert';
import { getUserByPhone, updateUser } from '../../services/userService';
import { getBuyerOrders, getSellerOrders } from '../../services/orderService';
import { getWishlistCount } from '../../services/wishlistService';
import { getSellerByUserId, updateSeller } from '../../services/sellerService';
import { uploadFile } from '../../services/storageService';
import { getProductsBySeller } from '../../services/productService';
import { getUnreadCount } from '../../services/notificationService';

const UPI_ID_REGEX = /^[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}$/;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

const ProfileScreen = ({ navigation }: any) => {
  const { user, logout } = useAuth();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [sellerLoading, setSellerLoading] = useState(false);
  const [sellerSaving, setSellerSaving] = useState(false);
  const [uploadingQr, setUploadingQr] = useState(false);
  const [orderCount, setOrderCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [paymentUpiId, setPaymentUpiId] = useState('');
  const [paymentQrImageUrl, setPaymentQrImageUrl] = useState('');
  const [paymentBankAccountName, setPaymentBankAccountName] = useState('');
  const [paymentBankAccountNumber, setPaymentBankAccountNumber] = useState('');
  const [paymentBankIfsc, setPaymentBankIfsc] = useState('');
  const [initialPaymentSnapshot, setInitialPaymentSnapshot] = useState({
    paymentUpiId: '',
    paymentQrImageUrl: '',
    paymentBankAccountName: '',
    paymentBankAccountNumber: '',
    paymentBankIfsc: '',
  });
  const [paymentExpanded, setPaymentExpanded] = useState(false);
  const [uploadingProfileImage, setUploadingProfileImage] = useState(false);
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileImageUri, setProfileImageUri] = useState('');

  const navigateToBuyerTab = (tabName: string, params?: any) => {
    const parent = navigation.getParent?.();
    if (parent?.navigate) {
      parent.navigate(tabName, params);
      return;
    }
    navigation.navigate(tabName, params);
  };

  const navigateToAuth = (screen: 'Login' | 'Register') => {
    const lvl1 = navigation.getParent?.();
    const lvl2 = lvl1?.getParent?.();
    const lvl3 = lvl2?.getParent?.();
    const root = lvl3 || lvl2 || lvl1;

    if (root?.navigate) {
      root.navigate(screen);
      return;
    }

    navigation.navigate(screen);
  };

  const maskAccountNumber = (value: string) => {
    const normalized = value.replace(/\s+/g, '');
    if (normalized.length <= 4) return normalized;
    return `${'*'.repeat(Math.max(0, normalized.length - 4))}${normalized.slice(-4)}`;
  };

  useEffect(() => {
    if (user) {
      setProfileName(user.name || '');
      setProfilePhone(user.phone || '');
      setProfileImageUri(user.profileImage || '');
      loadStats();
      loadUnreadNotifications();
      if (user.role === 'seller') {
        loadSellerPaymentDetails();
      }
    }
  }, [user]);

  useEffect(() => {
    const unsubscribe = navigation.addListener?.('focus', () => {
      loadUnreadNotifications();
    });

    return unsubscribe;
  }, [navigation, user?.$id]);

  const loadUnreadNotifications = async () => {
    if (!user) return;
    try {
      const count = await getUnreadCount(user.$id);
      setUnreadNotificationCount(count);
    } catch {
      setUnreadNotificationCount(0);
    }
  };

  const loadSellerPaymentDetails = async () => {
    if (!user || user.role !== 'seller') return;
    try {
      setSellerLoading(true);
      const seller = await getSellerByUserId(user.$id);
      const snapshot = {
        paymentUpiId: seller?.paymentUpiId || '',
        paymentQrImageUrl: seller?.paymentQrImageUrl || '',
        paymentBankAccountName: seller?.paymentBankAccountName || '',
        paymentBankAccountNumber: seller?.paymentBankAccountNumber || '',
        paymentBankIfsc: seller?.paymentBankIfsc || '',
      };

      setPaymentUpiId(snapshot.paymentUpiId);
      setPaymentQrImageUrl(snapshot.paymentQrImageUrl);
      setPaymentBankAccountName(snapshot.paymentBankAccountName);
      setPaymentBankAccountNumber(snapshot.paymentBankAccountNumber);
      setPaymentBankIfsc(snapshot.paymentBankIfsc);
      setInitialPaymentSnapshot(snapshot);
    } catch {
      showAlert('Error', 'Failed to load seller payment details');
    } finally {
      setSellerLoading(false);
    }
  };

  const handleUploadQr = async () => {
    if (!user || user.role !== 'seller') return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showAlert('Permission Required', 'Please allow gallery access to upload QR code.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;

      setUploadingQr(true);
      const url = await uploadFile(result.assets[0].uri, `payment_qr_${user.$id}_${Date.now()}`);
      setPaymentQrImageUrl(url);
      showAlert('Uploaded', 'QR image uploaded. Save to apply changes.');
    } catch {
      showAlert('Error', 'Failed to upload QR image');
    } finally {
      setUploadingQr(false);
    }
  };

  const handleSavePaymentDetails = async () => {
    if (!user || user.role !== 'seller') return;

    const currentData = {
      paymentUpiId: paymentUpiId.trim(),
      paymentQrImageUrl: paymentQrImageUrl.trim(),
      paymentBankAccountName: paymentBankAccountName.trim(),
      paymentBankAccountNumber: paymentBankAccountNumber.trim(),
      paymentBankIfsc: paymentBankIfsc.trim().toUpperCase(),
    };

    const initialData = {
      paymentUpiId: initialPaymentSnapshot.paymentUpiId.trim(),
      paymentQrImageUrl: initialPaymentSnapshot.paymentQrImageUrl.trim(),
      paymentBankAccountName: initialPaymentSnapshot.paymentBankAccountName.trim(),
      paymentBankAccountNumber: initialPaymentSnapshot.paymentBankAccountNumber.trim(),
      paymentBankIfsc: initialPaymentSnapshot.paymentBankIfsc.trim().toUpperCase(),
    };

    if (JSON.stringify(currentData) === JSON.stringify(initialData)) {
      showAlert('No Changes', 'Update at least one payment field before saving.');
      return;
    }

    if (currentData.paymentUpiId && !UPI_ID_REGEX.test(currentData.paymentUpiId)) {
      showAlert('Invalid UPI ID', 'Please enter a valid UPI ID (example: name@bank).');
      return;
    }

    const hasAnyBankField =
      paymentBankAccountName.trim() ||
      paymentBankAccountNumber.trim() ||
      paymentBankIfsc.trim();

    if (hasAnyBankField) {
      if (!paymentBankAccountName.trim() || !paymentBankAccountNumber.trim() || !paymentBankIfsc.trim()) {
        showAlert('Incomplete Bank Details', 'Please fill account holder, account number, and IFSC together.');
        return;
      }

      const normalizedAccount = currentData.paymentBankAccountNumber.replace(/\s+/g, '');
      if (!/^\d{9,18}$/.test(normalizedAccount)) {
        showAlert('Invalid Account Number', 'Bank account number should be 9 to 18 digits.');
        return;
      }

      if (!IFSC_REGEX.test(currentData.paymentBankIfsc)) {
        showAlert('Invalid IFSC', 'Please enter a valid IFSC code (example: SBIN0000123).');
        return;
      }

      currentData.paymentBankAccountNumber = normalizedAccount;
    }

    setSellerSaving(true);
    try {
      await updateSeller(user.$id, currentData);
      showAlert('Success', 'Payment details saved');
      await loadSellerPaymentDetails();
      setPaymentExpanded(false);
    } catch {
      showAlert('Error', 'Failed to save payment details');
    } finally {
      setSellerSaving(false);
    }
  };

  const loadStats = async () => {
    if (!user) return;
    try {
      if (user.role === 'seller') {
        const seller = await getSellerByUserId(user.$id);
        if (!seller) {
          setOrderCount(0);
          setWishlistCount(0);
          return;
        }

        const [orders, products] = await Promise.all([
          getSellerOrders(seller.$id, 200).catch(() => []),
          getProductsBySeller(seller.$id).catch(() => []),
        ]);
        setOrderCount(Array.isArray(orders) ? orders.length : 0);
        setWishlistCount(Array.isArray(products) ? products.length : 0);
        return;
      }

      const [orders, wishCount] = await Promise.all([
        getBuyerOrders(user.$id, 200).catch(() => []),
        getWishlistCount(user.$id).catch(() => 0),
      ]);
      setOrderCount(Array.isArray(orders) ? orders.length : 0);
      setWishlistCount(wishCount);
    } catch {
      // silently fail
    }
  };

  const handleUploadProfileImage = async () => {
    if (!user) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showAlert('Permission Required', 'Please allow gallery access to upload profile image.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;

      setUploadingProfileImage(true);
      const url = await uploadFile(result.assets[0].uri, `profile_${user.$id}_${Date.now()}`);
      await updateUser(user.$id, { profileImage: url });
      setProfileImageUri(url);
      showAlert('Updated', 'Profile image updated successfully.');
    } catch {
      showAlert('Error', 'Failed to update profile image.');
    } finally {
      setUploadingProfileImage(false);
    }
  };

  const openOrders = () => {
    if (!user) return;
    if (user.role === 'seller') {
      navigation.navigate('Orders', { fromProfile: true });
      return;
    }
    navigation.navigate('Orders');
  };

  const openSecondaryStat = () => {
    if (!user) return;
    if (user.role === 'seller') {
      navigation.navigate('MyProducts', { fromProfile: true });
      return;
    }
    navigation.navigate('Wishlist');
  };

  const handleOpenProfileImage = () => {
    if (profileImageUri) {
      setImagePreviewVisible(true);
      return;
    }
    handleUploadProfileImage();
  };

  const handleEditProfile = () => {
    if (!user) return;
    setEditName(profileName || user.name || '');
    setEditPhone(profilePhone || user.phone || '');
    setEditing(true);
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    const nextName = editName.trim();
    const phoneDigits = editPhone.replace(/\D/g, '');
    const prevName = (profileName || user.name || '').trim();
    const prevPhone = (profilePhone || user.phone || '').replace(/\D/g, '');

    if (!nextName || nextName.length < 2 || nextName.length > 60) {
      showAlert('Invalid Name', 'Please enter your full name (minimum 2 characters).');
      return;
    }

    if (!/^[a-zA-Z][a-zA-Z\s'.-]*$/.test(nextName)) {
      showAlert('Invalid Name', 'Name can contain letters, spaces, apostrophe, dot, and hyphen only.');
      return;
    }

    if (phoneDigits && !/^[6-9]\d{9}$/.test(phoneDigits)) {
      showAlert('Invalid Phone', 'Enter a valid 10-digit Indian mobile number.');
      return;
    }

    if (nextName === prevName && phoneDigits === prevPhone) {
      showAlert('No Changes', 'Update at least one profile field before saving.');
      return;
    }

    setSaving(true);
    try {
      const phoneChanged = phoneDigits !== (user.phone || '').replace(/\D/g, '');
      if (phoneChanged && phoneDigits) {
        const existingPhoneUser = await getUserByPhone(phoneDigits);
        if (existingPhoneUser && existingPhoneUser.$id !== user.$id) {
          showAlert('Phone In Use', 'This phone number is already linked to another account.');
          setSaving(false);
          return;
        }
      }

      await updateUser(user.$id, {
        name: nextName,
        phone: phoneDigits,
      });
      setProfileName(nextName);
      setProfilePhone(phoneDigits);
      setEditing(false);
      showAlert('Success', 'Profile updated successfully');
    } catch {
      showAlert('Error', 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    showAlert(
      'Logout',
      'Are you sure you want to logout?',
      [
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
      ]
    );
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.guestHeader}>
          <View style={styles.guestAvatarStub}>
            <Ionicons name="person-outline" size={42} color={COLORS.primary} />
          </View>
          <Text style={styles.guestHeaderTitle}>Guest Profile</Text>
          <Text style={styles.guestHeaderSubtitle}>Login to access saved items, orders, and account settings.</Text>
        </View>

        <View style={styles.guestBody}>
          <View style={styles.guestCtaCard}>
            <Text style={styles.guestCtaTitle}>Unlock Full Experience</Text>
            <Text style={styles.guestCtaSubtitle}>
              Track orders, manage wishlist, receive notifications, and personalize your profile.
            </Text>
            <View style={styles.guestActionRow}>
              <TouchableOpacity style={styles.guestSecondaryButton} onPress={() => navigateToAuth('Login')}>
                <Text style={styles.guestSecondaryButtonText}>Login</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.guestPrimaryButton} onPress={() => navigateToAuth('Register')}>
                <Text style={styles.guestPrimaryButtonText}>Register</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={styles.guestBrowseButton}
            onPress={() =>
              navigateToBuyerTab('Home', {
                screen: 'HomeMain',
              })
            }
          >
            <Ionicons name="compass-outline" size={18} color={COLORS.primary} />
            <Text style={styles.guestBrowseButtonText}>Continue Browsing as Guest</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 16 }}
      keyboardShouldPersistTaps="handled"
      enableOnAndroid
      extraScrollHeight={24}
      extraHeight={120}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatarWrap}>
          <TouchableOpacity style={styles.avatarContainer} onPress={handleOpenProfileImage} activeOpacity={0.9}>
            {profileImageUri ? (
              <Image source={{ uri: profileImageUri }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>
                {(profileName || user.name || 'U').charAt(0).toUpperCase()}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.avatarCameraBtn} onPress={handleUploadProfileImage} disabled={uploadingProfileImage}>
            {uploadingProfileImage ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="camera-outline" size={14} color="#FFF" />
            )}
          </TouchableOpacity>
        </View>
        <Text style={styles.name}>{profileName || user.name || 'User'}</Text>
        <Text style={styles.email}>{user.email || ''}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>
            {user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Buyer'}
          </Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <TouchableOpacity style={styles.stat} onPress={openOrders}>
          <Text style={styles.statValue}>{orderCount}</Text>
          <Text style={styles.statLabel}>Orders</Text>
        </TouchableOpacity>
        <View style={styles.statDivider} />
        <TouchableOpacity style={styles.stat} onPress={openSecondaryStat}>
          <Text style={styles.statValue}>{wishlistCount}</Text>
          <Text style={styles.statLabel}>{user.role === 'seller' ? 'Products' : 'Wishlist'}</Text>
        </TouchableOpacity>
      </View>

      {/* Personal Info */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Personal Info</Text>
          {!editing && (
            <TouchableOpacity onPress={handleEditProfile} style={styles.editButtonTouch} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.editLink}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        {editing ? (
          <View style={styles.editForm}>
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="Your name"
            />
            <Text style={styles.inputLabel}>Phone</Text>
            <TextInput
              style={styles.input}
              value={editPhone}
              onChangeText={setEditPhone}
              placeholder="Phone number"
              keyboardType="phone-pad"
              maxLength={10}
            />
            <Text style={styles.noteText}>Phone updates are validated for unique account linkage and recovery safety.</Text>
            <View style={styles.infoItemInline}>
              <Ionicons name="mail-outline" size={16} color={COLORS.textSecondary} />
              <Text style={styles.inlineInfoText}>Email change is restricted in-app and requires secure re-verification.</Text>
            </View>
            <View style={styles.editActions}>
              <TouchableOpacity
                style={styles.cancelEditButton}
                onPress={() => setEditing(false)}
              >
                <Text style={styles.cancelEditText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, saving && styles.disabledButton]}
                onPress={handleSaveProfile}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.infoItem}>
              <Ionicons name="person-outline" size={20} color={COLORS.textSecondary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Name</Text>
                <Text style={styles.infoValue}>{profileName || 'Not set'}</Text>
              </View>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="mail-outline" size={20} color={COLORS.textSecondary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{user.email || 'Not set'}</Text>
              </View>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="call-outline" size={20} color={COLORS.textSecondary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Phone</Text>
                <Text style={styles.infoValue}>{profilePhone || 'Not provided'}</Text>
              </View>
            </View>
          </>
        )}
      </View>

      {/* Menu Items */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={openOrders}
        >
          <Ionicons name="receipt-outline" size={24} color={COLORS.text} />
          <Text style={styles.menuText}>My Orders</Text>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>

        {user.role === 'seller' ? (
          <>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('SellerAnalytics')}
            >
              <Ionicons name="analytics-outline" size={24} color={COLORS.text} />
              <Text style={styles.menuText}>Seller Analytics</Text>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('SellerNotifications')}
            >
              <Ionicons name="notifications-outline" size={24} color={COLORS.text} />
              <Text style={styles.menuText}>Seller Notifications</Text>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('SellerSettings')}
            >
              <Ionicons name="settings-outline" size={24} color={COLORS.text} />
              <Text style={styles.menuText}>Settings</Text>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('Wishlist')}
            >
              <Ionicons name="heart-outline" size={24} color={COLORS.text} />
              <Text style={styles.menuText}>My Wishlist</Text>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('BuyerNotifications')}
            >
              <Ionicons name="notifications-outline" size={24} color={COLORS.text} />
              <View style={styles.menuTextWrap}>
                <Text style={styles.menuText}>Notifications</Text>
                {unreadNotificationCount > 0 && (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>
                      {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                    </Text>
                  </View>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('BuyerMyReviews')}
            >
              <Ionicons name="star-outline" size={24} color={COLORS.text} />
              <Text style={styles.menuText}>My Reviews</Text>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('BuyerSettings')}
            >
              <Ionicons name="settings-outline" size={24} color={COLORS.text} />
              <Text style={styles.menuText}>Settings</Text>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => showAlert('Help & Support', 'For any queries, contact us at:\n\nsupport@grambazaar.app\n\nOr call: +91 1800-XXX-XXXX')}
        >
          <Ionicons name="help-circle-outline" size={24} color={COLORS.text} />
          <Text style={styles.menuText}>Help & Support</Text>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => showAlert('About GramBazaar', 'GramBazaar v1.0\n\nA verified marketplace for Indian artisans.\nEmpowering rural craftspeople across India.\n\n© 2026 GramBazaar')}
        >
          <Ionicons name="information-circle-outline" size={24} color={COLORS.text} />
          <Text style={styles.menuText}>About</Text>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      {user.role === 'seller' && (
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.paymentHeader}
            onPress={() => setPaymentExpanded((prev) => !prev)}
            activeOpacity={0.8}
          >
            <View style={styles.paymentHeaderLeft}>
              <Ionicons name="card-outline" size={22} color={COLORS.text} />
              <View style={{ flex: 1 }}>
                <Text style={styles.menuText}>Payment Details</Text>
                {!paymentExpanded && (
                  <Text style={styles.paymentMetaText}>
                    {paymentUpiId
                      ? 'UPI set'
                      : 'UPI not set'}
                    {paymentBankAccountNumber
                      ? ` • A/C ${maskAccountNumber(paymentBankAccountNumber)}`
                      : ''}
                  </Text>
                )}
              </View>
            </View>
            <Ionicons
              name={paymentExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={COLORS.textSecondary}
            />
          </TouchableOpacity>

          {paymentExpanded && sellerLoading ? (
            <View style={{ padding: 16 }}>
              <ActivityIndicator color={COLORS.primary} size="small" />
            </View>
          ) : paymentExpanded ? (
            <View style={styles.paymentFormWrap}>
              <View style={styles.editForm}>
              <Text style={styles.inputLabel}>UPI ID</Text>
              <TextInput
                style={styles.input}
                value={paymentUpiId}
                onChangeText={setPaymentUpiId}
                placeholder="example@upi"
                autoCapitalize="none"
              />

              <TouchableOpacity
                style={styles.uploadButton}
                onPress={handleUploadQr}
                disabled={uploadingQr}
              >
                {uploadingQr ? (
                  <ActivityIndicator color={COLORS.primary} size="small" />
                ) : (
                  <Text style={styles.uploadButtonText}>
                    {paymentQrImageUrl ? 'Replace UPI QR' : 'Upload UPI QR'}
                  </Text>
                )}
              </TouchableOpacity>

              {!!paymentQrImageUrl && (
                <Image
                  source={{ uri: paymentQrImageUrl }}
                  style={styles.qrPreview}
                  resizeMode="contain"
                />
              )}

              <Text style={styles.inputLabel}>Bank Account Holder</Text>
              <TextInput
                style={styles.input}
                value={paymentBankAccountName}
                onChangeText={setPaymentBankAccountName}
                placeholder="Account holder name"
              />

              <Text style={styles.inputLabel}>Bank Account Number</Text>
              <TextInput
                style={styles.input}
                value={paymentBankAccountNumber}
                onChangeText={setPaymentBankAccountNumber}
                placeholder="Account number"
                keyboardType="number-pad"
              />

              <Text style={styles.inputLabel}>IFSC</Text>
              <TextInput
                style={styles.input}
                value={paymentBankIfsc}
                onChangeText={setPaymentBankIfsc}
                placeholder="e.g. SBIN0000123"
                autoCapitalize="characters"
              />

              <Text style={styles.noteText}>If adding bank details, fill all 3 bank fields.</Text>

              <TouchableOpacity
                style={[styles.saveButton, sellerSaving && styles.disabledButton]}
                onPress={handleSavePaymentDetails}
                disabled={sellerSaving}
              >
                {sellerSaving ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Payment Details</Text>
                )}
              </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>
      )}

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={24} color={COLORS.error} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <View style={{ height: 32 }} />

      <Modal
        visible={imagePreviewVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImagePreviewVisible(false)}
      >
        <View style={styles.previewOverlay}>
          <TouchableOpacity style={styles.previewClose} onPress={() => setImagePreviewVisible(false)}>
            <Ionicons name="close" size={24} color="#FFF" />
          </TouchableOpacity>
          {!!profileImageUri && (
            <Image source={{ uri: profileImageUri }} style={styles.previewImage} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </KeyboardAwareScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  guestHeader: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 22,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  guestAvatarStub: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${COLORS.primary}12`,
    borderWidth: 1,
    borderColor: `${COLORS.primary}30`,
    marginBottom: 12,
  },
  guestHeaderTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
  },
  guestHeaderSubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontWeight: '500',
  },
  guestBody: {
    flex: 1,
    padding: 16,
    gap: 14,
  },
  guestCtaCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    padding: 16,
  },
  guestCtaTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  guestCtaSubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
    fontWeight: '500',
  },
  guestActionRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
  },
  guestSecondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    paddingVertical: 11,
    alignItems: 'center',
  },
  guestSecondaryButtonText: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: 14,
  },
  guestPrimaryButton: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    paddingVertical: 11,
    alignItems: 'center',
  },
  guestPrimaryButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  guestBrowseButton: {
    borderWidth: 1,
    borderColor: `${COLORS.primary}35`,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: `${COLORS.primary}10`,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  guestBrowseButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  header: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  avatarWrap: {
    position: 'relative',
    width: 92,
    height: 92,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarCameraBtn: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 2,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  roleBadge: {
    backgroundColor: `${COLORS.primary}15`,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    padding: 16,
    marginTop: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.border,
  },
  section: {
    backgroundColor: COLORS.surface,
    marginTop: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  editLink: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  editButtonTouch: {
    minHeight: 34,
    minWidth: 54,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  editForm: {
    padding: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: COLORS.text,
    backgroundColor: COLORS.background,
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelEditButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  cancelEditText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  saveButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  disabledButton: {
    opacity: 0.6,
  },
  uploadButton: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${COLORS.primary}10`,
    marginBottom: 12,
  },
  paymentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  paymentHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  paymentFormWrap: {
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  paymentMetaText: {
    marginLeft: 16,
    marginTop: 2,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  uploadButtonText: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  qrPreview: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: COLORS.background,
  },
  noteText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  infoItemInline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 8,
  },
  inlineInfoText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  previewClose: {
    position: 'absolute',
    top: 48,
    right: 20,
    zIndex: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '78%',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  infoContent: {
    marginLeft: 16,
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuText: {
    flex: 1,
    marginLeft: 16,
    fontSize: 16,
    color: COLORS.text,
  },
  menuTextWrap: {
    flex: 1,
    marginLeft: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notificationBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.error,
  },
  notificationBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    margin: 16,
    backgroundColor: `${COLORS.error}10`,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  logoutText: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.error,
  },
});

export default ProfileScreen;
