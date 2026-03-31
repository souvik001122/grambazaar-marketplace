import { create } from 'zustand';
import { CartItem, Product } from '../types';

interface CartState {
  items: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getTotalAmount: () => number;
  getTotalItems: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  
  addToCart: (product, quantity = 1) => {
    set((state) => {
      const existingItem = state.items.find(item => item.product.$id === product.$id);
      
      if (existingItem) {
        return {
          items: state.items.map(item =>
            item.product.$id === product.$id
              ? { ...item, quantity: item.quantity + quantity }
              : item
          ),
        };
      }
      
      return {
        items: [...state.items, { product, quantity }],
      };
    });
  },
  
  removeFromCart: (productId) => {
    set((state) => ({
      items: state.items.filter(item => item.product.$id !== productId),
    }));
  },
  
  updateQuantity: (productId, quantity) => {
    if (quantity <= 0) {
      get().removeFromCart(productId);
      return;
    }
    
    set((state) => ({
      items: state.items.map(item =>
        item.product.$id === productId
          ? { ...item, quantity }
          : item
      ),
    }));
  },
  
  clearCart: () => set({ items: [] }),
  
  getTotalAmount: () => {
    return get().items.reduce(
      (total, item) => total + item.product.price * item.quantity,
      0
    );
  },
  
  getTotalItems: () => {
    return get().items.reduce((total, item) => total + item.quantity, 0);
  },
}));
