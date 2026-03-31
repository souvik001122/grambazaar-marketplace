import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { COLORS } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { useCartStore } from '../../stores/cartStore';
import { createOrder } from '../../services/orderService';
import { formatPrice } from '../../utils/formatting';
import { showAlert } from '../../utils/alert';
import { INDIAN_STATES } from '../../constants/regions';
import { BUYER_LAYOUT } from '../../constants/layout';

const CheckoutScreen = ({ navigation }: any) => {
  const tabBarHeight = 16;
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const isCompact = screenHeight < 760;
  const isLargeScreen = screenWidth >= BUYER_LAYOUT.railBreakpoint;
  const wideRailStyle = isLargeScreen ? styles.contentRailWide : undefined;
  const { user } = useAuth();
  const { items, getTotalAmount, clearCart } = useCartStore();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [placing, setPlacing] = useState(false);

  const navigateToBuyerTab = (tabName: string, params?: any) => {
    const parent = navigation.getParent?.();
    if (parent?.navigate) {
      parent.navigate(tabName, params);
      return;
    }
    navigation.navigate(tabName, params);
  };

  const validateForm = (): boolean => {
    if (!name.trim()) { showAlert('Error', 'Please enter your name'); return false; }
    if (!phone.trim() || phone.replace(/\D/g, '').length < 10) { showAlert('Error', 'Please enter a valid 10-digit phone number'); return false; }
    if (!addressLine1.trim()) { showAlert('Error', 'Please enter your address'); return false; }
    if (!city.trim()) { showAlert('Error', 'Please enter your city'); return false; }
    if (!state.trim()) { showAlert('Error', 'Please select your state'); return false; }
    if (!pincode.trim() || pincode.replace(/\D/g, '').length !== 6) { showAlert('Error', 'Please enter a valid 6-digit pincode'); return false; }
    return true;
  };

  const handlePlaceOrder = async () => {
    if (!user) {
      showAlert('Login Required', 'Please login or register to place an order.', [
        { text: 'Not Now', style: 'cancel' },
        {
          text: 'Login',
          onPress: () => {
            const rootStack = navigation.getParent?.()?.getParent?.()?.getParent?.();
            if (rootStack?.navigate) {
              rootStack.navigate('Login');
              return;
            }
            navigation.navigate('Login');
          },
        },
      ]);
      return;
    }

    if (!validateForm()) return;

    const fullAddress = `${name}\n${phone}\n${addressLine1}${addressLine2 ? ', ' + addressLine2 : ''}\n${city}, ${state} - ${pincode}`;

    // Group items by seller
    const sellerGroups: Record<string, typeof items> = {};
    items.forEach((item: any) => {
      const sid = item.product.sellerId;
      if (!sellerGroups[sid]) sellerGroups[sid] = [];
      sellerGroups[sid].push(item);
    });

    setPlacing(true);
    try {
      const orderPromises = Object.entries(sellerGroups).map(([sellerId, sellerItems]) => {
        const orderItems = sellerItems.map((item: any) => ({
          productId: item.product.$id,
          productName: item.product.name,
          productImage: item.product.images?.[0] || '',
          quantity: item.quantity,
          price: item.product.price,
          sellerId: item.product.sellerId,
        }));
        const total = sellerItems.reduce((sum: number, item: any) => sum + item.product.price * item.quantity, 0);

        return createOrder({
          buyerId: user.$id,
          sellerId,
          items: orderItems,
          totalAmount: total,
          deliveryAddress: fullAddress,
          paymentStatus: 'pending',
        });
      });

      await Promise.all(orderPromises);
      clearCart();

      showAlert(
        'Order Placed! 🎉',
        `Your order has been placed successfully. ${Object.keys(sellerGroups).length > 1 ? `${Object.keys(sellerGroups).length} orders created for different sellers.` : ''}\n\nYou can track your orders in Profile > My Orders.`,
        [
          {
            text: 'View Orders',
            onPress: () =>
              navigateToBuyerTab('Profile', {
                screen: 'Orders',
              }),
          },
        ]
      );
    } catch (err) {
      console.error('Order error:', err);
      showAlert('Error', 'Failed to place order. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="cart-outline" size={64} color={COLORS.textTertiary} />
        <Text style={styles.emptyText}>Your cart is empty</Text>
        <TouchableOpacity style={styles.browseButton} onPress={() => navigation.goBack()}>
          <Text style={styles.browseButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <KeyboardAwareScrollView
        contentContainerStyle={[
          styles.content,
          isCompact && styles.contentCompact,
          { paddingBottom: tabBarHeight },
        ]}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        extraScrollHeight={24}
        extraHeight={120}
        showsVerticalScrollIndicator={false}
      >
        {/* Order Summary */}
        <View style={[styles.section, isCompact && styles.sectionCompact, wideRailStyle]}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          {items.map((item: any) => (
            <View key={item.product.$id} style={styles.orderItem}>
              <Text style={styles.orderItemName} numberOfLines={1}>{item.product.name}</Text>
              <Text style={styles.orderItemQty}>x{item.quantity}</Text>
              <Text style={styles.orderItemPrice}>{formatPrice(item.product.price * item.quantity)}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatPrice(getTotalAmount())}</Text>
          </View>
        </View>

        {/* Delivery Address */}
        <View style={[styles.section, isCompact && styles.sectionCompact, wideRailStyle]}>
          <Text style={styles.sectionTitle}>Delivery Address</Text>

          <Text style={styles.label}>Full Name *</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your full name" />

          <Text style={styles.label}>Phone *</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={(value) => setPhone(value.replace(/\D/g, '').slice(0, 10))}
            placeholder="10-digit mobile number"
            keyboardType="phone-pad"
            maxLength={10}
          />

          <Text style={styles.label}>Address Line 1 *</Text>
          <TextInput style={styles.input} value={addressLine1} onChangeText={setAddressLine1} placeholder="House no., Street, Area" />

          <Text style={styles.label}>Address Line 2</Text>
          <TextInput style={styles.input} value={addressLine2} onChangeText={setAddressLine2} placeholder="Landmark (optional)" />

          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.label}>City *</Text>
              <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="City" />
            </View>
            <View style={styles.half}>
              <Text style={styles.label}>Pincode *</Text>
              <TextInput
                style={styles.input}
                value={pincode}
                onChangeText={(value) => setPincode(value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit pincode"
                keyboardType="numeric"
                maxLength={6}
              />
            </View>
          </View>

          <Text style={styles.label}>State *</Text>
          <View style={styles.stateSelector}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stateList}>
              {INDIAN_STATES.slice(0, 36).map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.stateChip, state === s.name && styles.stateChipActive]}
                  onPress={() => setState(s.name)}
                >
                  <Text style={[styles.stateChipText, state === s.name && styles.stateChipTextActive]}>
                    {s.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* Payment Note */}
        <View style={[styles.section, isCompact && styles.sectionCompact, wideRailStyle]}>
          <Text style={styles.sectionTitle}>Payment</Text>
          <View style={styles.paymentNote}>
            <Ionicons name="card-outline" size={22} color={COLORS.primary} />
            <Text style={styles.paymentText}>UPI / Bank Transfer (No COD)</Text>
          </View>
          <Text style={styles.paymentSubtext}>
            Seller will share payment details after accepting your order. You can then mark "I have paid" in Order Details.
          </Text>
        </View>

        <View style={{ height: 100 }} />
      </KeyboardAwareScrollView>

      {/* Place Order */}
      <View style={[styles.bottomBar, isCompact && styles.bottomBarCompact]}>
        <View style={styles.bottomTotal}>
          <Text style={styles.bottomTotalLabel}>Total</Text>
          <Text style={styles.bottomTotalValue}>{formatPrice(getTotalAmount())}</Text>
        </View>
        <TouchableOpacity
          style={[
            styles.placeOrderButton,
            isCompact && styles.placeOrderButtonCompact,
            placing && styles.disabledButton,
          ]}
          onPress={handlePlaceOrder}
          disabled={placing}
        >
          {placing ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <>
              <Text style={styles.placeOrderText}>Place Order</Text>
              <Ionicons name="checkmark-circle" size={20} color="#FFF" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: COLORS.background },
  emptyText: { fontSize: 16, color: COLORS.textSecondary, marginTop: 16, marginBottom: 16 },
  browseButton: { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  browseButtonText: { color: '#FFF', fontWeight: '600' },
  content: { padding: 16 },
  contentCompact: { paddingHorizontal: 14, paddingVertical: 12 },
  contentRailWide: {
    width: '100%',
    maxWidth: BUYER_LAYOUT.railMaxWidth,
    alignSelf: 'center',
  },
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  sectionCompact: {
    marginBottom: 12,
    padding: 14,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 16 },
  orderItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  orderItemName: { flex: 1, fontSize: 14, color: COLORS.text, fontWeight: '600' },
  orderItemQty: { fontSize: 13, color: COLORS.textSecondary, marginHorizontal: 12 },
  orderItemPrice: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
  totalValue: { fontSize: 19, fontWeight: 'bold', color: COLORS.primaryDark },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 6,
    marginTop: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15, color: COLORS.text, backgroundColor: COLORS.background,
  },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  stateSelector: { marginTop: 4 },
  stateList: { gap: 8, paddingVertical: 4 },
  stateChip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 22,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.background,
  },
  stateChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  stateChipText: { fontSize: 13, color: COLORS.textSecondary },
  stateChipTextActive: { color: '#FFF', fontWeight: '600' },
  paymentNote: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  paymentText: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  paymentSubtext: { fontSize: 13, color: COLORS.textSecondary, marginTop: 8, lineHeight: 20 },
  bottomBar: {
    flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: COLORS.surface,
    borderTopWidth: 1, borderTopColor: COLORS.border, gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },
  bottomBarCompact: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  bottomTotal: { flex: 1 },
  bottomTotalLabel: { fontSize: 12, color: COLORS.textSecondary },
  bottomTotalValue: { fontSize: 22, fontWeight: 'bold', color: COLORS.primaryDark },
  placeOrderButton: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.success,
    paddingVertical: 14, paddingHorizontal: 28, borderRadius: 14,
  },
  placeOrderButtonCompact: {
    paddingVertical: 12,
    paddingHorizontal: 22,
  },
  placeOrderText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  disabledButton: { opacity: 0.6 },
});

export default CheckoutScreen;
