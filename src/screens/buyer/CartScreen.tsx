import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { useCartStore } from '../../stores/cartStore';
import { formatPrice } from '../../utils/formatting';
import { normalizeImageList, resolveImageUrl } from '../../services/storageService';
import { appwriteConfig } from '../../config/appwrite';
import { showAlert } from '../../utils/alert';
import { useAuth } from '../../context/AuthContext';

const CartScreen = ({ navigation }: any) => {
  const tabBarHeight = 16;
  const { user } = useAuth();
  const { items, updateQuantity, removeFromCart, getTotalAmount, getTotalItems } = useCartStore();

  const navigateToBuyerTab = (tabName: string, params?: any) => {
    const parent = navigation.getParent?.();
    if (parent?.navigate) {
      parent.navigate(tabName, params);
      return;
    }
    navigation.navigate(tabName, params);
  };

  const handleRemove = (productId: string, name: string) => {
    showAlert('Remove Item', `Remove "${name}" from cart?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => removeFromCart(productId),
      },
    ]);
  };

  const handleCheckout = () => {
    if (items.length === 0) return;

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

    navigation.navigate('Checkout');
  };

  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="cart-outline" size={80} color={COLORS.textTertiary} />
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.emptySubtext}>
          Browse handcrafted products and add them to your cart
        </Text>
        <TouchableOpacity
          style={styles.browseButton}
          onPress={() =>
            navigateToBuyerTab('Home', {
              screen: 'HomeMain',
            })
          }
        >
          <Text style={styles.browseButtonText}>Browse Products</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderItem = ({ item }: any) => {
    const imageList = normalizeImageList(item?.product?.images);
    const imageUrl =
      resolveImageUrl(appwriteConfig.productImagesBucketId, imageList[0]) ||
      'https://via.placeholder.com/100';

    return (
      <View style={styles.cartItem}>
        <Image source={{ uri: imageUrl }} style={styles.itemImage} />
        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={2}>
            {item.product.name}
          </Text>
          <Text style={styles.itemPrice}>{formatPrice(item.product.price)}</Text>

          <View style={styles.quantityRow}>
            <View style={styles.quantityControl}>
              <TouchableOpacity
                style={styles.qtyButton}
                onPress={() => updateQuantity(item.product.$id, item.quantity - 1)}
              >
                <Ionicons name="remove" size={18} color={COLORS.text} />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{item.quantity}</Text>
              <TouchableOpacity
                style={styles.qtyButton}
                onPress={() => updateQuantity(item.product.$id, item.quantity + 1)}
              >
                <Ionicons name="add" size={18} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.itemTotal}>
              {formatPrice(item.product.price * item.quantity)}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemove(item.product.$id, item.product.name)}
        >
          <Ionicons name="trash-outline" size={18} color={COLORS.error} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.product.$id}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, { paddingBottom: tabBarHeight }]}
        ListFooterComponent={
          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Items</Text>
              <Text style={styles.summaryValue}>{getTotalItems()}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>{formatPrice(getTotalAmount())}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Delivery</Text>
              <Text style={[styles.summaryValue, { color: COLORS.success }]}>Free</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatPrice(getTotalAmount())}</Text>
            </View>
          </View>
        }
      />

      {/* Checkout Button */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomTotal}>
          <Text style={styles.bottomTotalLabel}>Total</Text>
          <Text style={styles.bottomTotalValue}>{formatPrice(getTotalAmount())}</Text>
        </View>
        <TouchableOpacity style={styles.checkoutButton} onPress={handleCheckout}>
          <Text style={styles.checkoutText}>Proceed to Checkout</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: COLORS.background },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.text, marginTop: 16, marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 24 },
  browseButton: { backgroundColor: COLORS.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
  browseButtonText: { color: '#FFF', fontWeight: '600', fontSize: 16 },
  list: { padding: 16 },
  cartItem: {
    flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: 12, padding: 12,
    marginBottom: 12, borderWidth: 1, borderColor: COLORS.border,
  },
  itemImage: { width: 80, height: 80, borderRadius: 8, backgroundColor: COLORS.card },
  itemInfo: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  itemName: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 4 },
  itemPrice: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 8 },
  quantityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  quantityControl: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 6, overflow: 'hidden',
  },
  qtyButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  qtyText: { width: 30, textAlign: 'center', fontSize: 14, fontWeight: '600', color: COLORS.text },
  itemTotal: { fontSize: 15, fontWeight: 'bold', color: COLORS.primary },
  removeButton: { padding: 8, alignSelf: 'flex-start' },
  summary: { backgroundColor: COLORS.surface, borderRadius: 12, padding: 16, marginTop: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryLabel: { fontSize: 14, color: COLORS.textSecondary },
  summaryValue: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 10 },
  totalLabel: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
  totalValue: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary },
  bottomBar: {
    flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: COLORS.surface,
    borderTopWidth: 1, borderTopColor: COLORS.border, gap: 16,
  },
  bottomTotal: { flex: 1 },
  bottomTotalLabel: { fontSize: 12, color: COLORS.textSecondary },
  bottomTotalValue: { fontSize: 20, fontWeight: 'bold', color: COLORS.primary },
  checkoutButton: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.primary,
    paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12,
  },
  checkoutText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
});

export default CartScreen;
