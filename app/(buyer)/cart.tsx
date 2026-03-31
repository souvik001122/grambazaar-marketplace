import React from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Text, Card, Button, useTheme, IconButton } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCartStore } from '../../src/stores/cartStore';
import { spacing } from '../../src/config/theme';

export default function CartScreen() {
  const theme = useTheme();
  const { items, removeFromCart, updateQuantity, getTotalAmount } = useCartStore();

  const renderCartItem = ({ item }: any) => (
    <Card style={styles.cartItem}>
      <Card.Content>
        <View style={styles.itemRow}>
          <View style={styles.itemDetails}>
            <Text variant="titleMedium">{item.product.name}</Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.primary }}>
              ₹{item.product.price}
            </Text>
          </View>
          <View style={styles.quantityControl}>
            <IconButton
              icon="minus"
              size={20}
              onPress={() => updateQuantity(item.product.$id, item.quantity - 1)}
            />
            <Text variant="bodyLarge">{item.quantity}</Text>
            <IconButton
              icon="plus"
              size={20}
              onPress={() => updateQuantity(item.product.$id, item.quantity + 1)}
            />
          </View>
          <IconButton
            icon="delete"
            size={20}
            onPress={() => removeFromCart(item.product.$id)}
          />
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <SafeAreaView edges={[]} style={[styles.container, { backgroundColor: theme.colors.background }]}> 
      {items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text variant="titleLarge">Your cart is empty</Text>
          <Text variant="bodyMedium" style={styles.emptyText}>
            Start shopping to add items to your cart
          </Text>
        </View>
      ) : (
        <>
          <FlatList
            data={items}
            renderItem={renderCartItem}
            keyExtractor={(item) => item.product.$id}
            contentContainerStyle={styles.list}
          />
          <View style={styles.footer}>
            <View style={styles.totalRow}>
              <Text variant="titleLarge">Total:</Text>
              <Text variant="titleLarge" style={{ color: theme.colors.primary }}>
                ₹{getTotalAmount()}
              </Text>
            </View>
            <Button mode="contained" style={styles.checkoutButton}>
              Proceed to Checkout
            </Button>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    marginTop: spacing.sm,
    opacity: 0.7,
  },
  list: {
    padding: spacing.md,
  },
  cartItem: {
    marginBottom: spacing.md,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemDetails: {
    flex: 1,
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  checkoutButton: {
    paddingVertical: spacing.xs,
  },
});
