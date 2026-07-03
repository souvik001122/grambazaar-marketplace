import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { getUnreadCount } from '../services/notificationService';
import { getWishlistCount, subscribeWishlistChanges } from '../services/wishlistService';
import { PREMIUM_STACK_OPTIONS } from './premiumStackOptions';

// Buyer Screens
import HomeScreen from '../screens/buyer/HomeScreen';
import TopArtisansScreen from '../screens/buyer/TopArtisansScreen';
import SearchScreen from '../screens/buyer/SearchScreen';
import RegionExploreScreen from '../screens/buyer/RegionExploreScreen';
import ProductDetailScreen from '../screens/buyer/ProductDetailScreen';
import CartScreen from '../screens/buyer/CartScreen';
import CheckoutScreen from '../screens/buyer/CheckoutScreen';
import BuyerOrdersScreen from '../screens/buyer/BuyerOrdersScreen';
import BuyerOrderDetailScreen from '../screens/buyer/BuyerOrderDetailScreen';
import WishlistScreen from '../screens/buyer/WishlistScreen';
import SellerProfileScreen from '../screens/buyer/SellerProfileScreen';
import WriteReviewScreen from '../screens/buyer/WriteReviewScreen';
import ProductReviewsScreen from '../screens/buyer/ProductReviewsScreen';
import RaiseOrderIssueScreen from '../screens/buyer/RaiseOrderIssueScreen';
import BuyerNotificationsScreen from '../screens/buyer/BuyerNotificationsScreen';
import BuyerMyReviewsScreen from '../screens/buyer/BuyerMyReviewsScreen';
import BuyerSettingsScreen from '../screens/buyer/BuyerSettingsScreen';
import ProfileScreen from '../screens/shared/ProfileScreen';
import ChatScreen from '../screens/shared/ChatScreen';
import InboxScreen from '../screens/shared/InboxScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const ROOT_TAB_ROUTES: Record<string, string> = {
  Home: 'HomeMain',
  Search: 'SearchMain',
  Explore: 'ExploreMain',
  Wishlist: 'WishlistMain',
  Profile: 'ProfileMain',
};

const isNestedDetailScreen = (route: any): boolean => {
  const focusedRoute = getFocusedRouteNameFromRoute(route) || ROOT_TAB_ROUTES[route.name] || '';
  const rootRoute = ROOT_TAB_ROUTES[route.name] || '';
  return focusedRoute !== '' && rootRoute !== '' && focusedRoute !== rootRoute;
};

// ─── Shared stack screen options ────────────────────────────────

const stackScreenOptions = PREMIUM_STACK_OPTIONS;

// ─── Stack navigators for each tab ──────────────────────────────

const HomeStack = () => (
  <Stack.Navigator screenOptions={stackScreenOptions}>
    <Stack.Screen name="HomeMain" component={HomeScreen} options={{ headerShown: false }} />
    <Stack.Screen name="TopArtisans" component={TopArtisansScreen} options={{ headerShown: false }} />
    <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ headerShown: false }} />
    <Stack.Screen name="Cart" component={CartScreen} options={{ title: 'My Cart' }} />
    <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: 'Checkout' }} />
    <Stack.Screen name="SellerProfile" component={SellerProfileScreen} options={{ headerShown: false }} />
    <Stack.Screen name="WriteReview" component={WriteReviewScreen} options={{ title: 'Write Review' }} />
    <Stack.Screen name="ProductReviews" component={ProductReviewsScreen} options={{ title: 'Reviews' }} />
    <Stack.Screen name="Chat" component={ChatScreen} options={{ headerShown: false }} />
  </Stack.Navigator>
);

const SearchStack = () => (
  <Stack.Navigator screenOptions={stackScreenOptions}>
    <Stack.Screen name="SearchMain" component={SearchScreen} options={{ headerShown: false }} />
    <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ headerShown: false }} />
    <Stack.Screen name="Cart" component={CartScreen} options={{ title: 'My Cart' }} />
    <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: 'Checkout' }} />
    <Stack.Screen name="SellerProfile" component={SellerProfileScreen} options={{ headerShown: false }} />
    <Stack.Screen name="WriteReview" component={WriteReviewScreen} options={{ title: 'Write Review' }} />
    <Stack.Screen name="ProductReviews" component={ProductReviewsScreen} options={{ title: 'Reviews' }} />
    <Stack.Screen name="Chat" component={ChatScreen} options={{ headerShown: false }} />
  </Stack.Navigator>
);

const OrdersStack = () => (
  <Stack.Navigator screenOptions={stackScreenOptions}>
    <Stack.Screen name="OrdersMain" component={BuyerOrdersScreen} options={{ headerShown: false }} />
    <Stack.Screen name="OrderDetail" component={BuyerOrderDetailScreen} options={{ headerShown: false }} />
    <Stack.Screen name="RaiseOrderIssue" component={RaiseOrderIssueScreen} options={{ headerShown: false }} />
    <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ headerShown: false }} />
    <Stack.Screen name="WriteReview" component={WriteReviewScreen} options={{ title: 'Write Review' }} />
  </Stack.Navigator>
);

const ExploreStack = () => (
  <Stack.Navigator screenOptions={stackScreenOptions}>
    <Stack.Screen name="ExploreMain" component={RegionExploreScreen} options={{ headerShown: false }} />
    <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ headerShown: false }} />
    <Stack.Screen name="SellerProfile" component={SellerProfileScreen} options={{ headerShown: false }} />
    <Stack.Screen name="Cart" component={CartScreen} options={{ title: 'My Cart' }} />
    <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: 'Checkout' }} />
    <Stack.Screen name="Chat" component={ChatScreen} options={{ headerShown: false }} />
  </Stack.Navigator>
);

const WishlistStack = () => (
  <Stack.Navigator screenOptions={stackScreenOptions}>
    <Stack.Screen name="WishlistMain" component={WishlistScreen} options={{ headerShown: false }} />
    <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ headerShown: false }} />
    <Stack.Screen name="SellerProfile" component={SellerProfileScreen} options={{ headerShown: false }} />
    <Stack.Screen name="Chat" component={ChatScreen} options={{ headerShown: false }} />
  </Stack.Navigator>
);

const ProfileStack = () => (
  <Stack.Navigator screenOptions={stackScreenOptions}>
    <Stack.Screen name="ProfileMain" component={ProfileScreen} options={{ headerShown: false }} />
    <Stack.Screen name="Orders" component={BuyerOrdersScreen} options={{ headerShown: false }} />
    <Stack.Screen name="OrderDetail" component={BuyerOrderDetailScreen} options={{ headerShown: false }} />
    <Stack.Screen name="RaiseOrderIssue" component={RaiseOrderIssueScreen} options={{ headerShown: false }} />
    <Stack.Screen name="Wishlist" component={WishlistScreen} options={{ headerShown: false }} />
    <Stack.Screen name="BuyerNotifications" component={BuyerNotificationsScreen} options={{ headerShown: false }} />
    <Stack.Screen name="BuyerMyReviews" component={BuyerMyReviewsScreen} options={{ headerShown: false }} />
    <Stack.Screen name="BuyerSettings" component={BuyerSettingsScreen} options={{ headerShown: false }} />
    <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ headerShown: false }} />
    <Stack.Screen name="WriteReview" component={WriteReviewScreen} options={{ title: 'Write Review' }} />
    <Stack.Screen name="Inbox" component={InboxScreen} options={{ headerShown: false }} />
    <Stack.Screen name="Chat" component={ChatScreen} options={{ headerShown: false }} />
  </Stack.Navigator>
);

// ─── Main Tab Navigator ─────────────────────────────────────────

const WishlistTabIcon = ({ focused, color, size }: { focused: boolean; color: string; size: number }) => {
  const { user } = useAuth();
  const [wishlistBadge, setWishlistBadge] = useState<number | undefined>(undefined);

  useEffect(() => {
    let mounted = true;

    const loadWishlistBadge = async () => {
      if (!user?.$id) {
        if (mounted) {
          setWishlistBadge(undefined);
        }
        return;
      }

      try {
        const count = await getWishlistCount(user.$id);
        if (mounted) {
          setWishlistBadge(count > 0 ? count : undefined);
        }
      } catch {
        if (mounted) {
          setWishlistBadge(undefined);
        }
      }
    };

    loadWishlistBadge();
    const unsubscribe = subscribeWishlistChanges((event) => {
      if (event.userId === user?.$id) {
        loadWishlistBadge();
      }
    });
    const timer = setInterval(loadWishlistBadge, 25000);

    return () => {
      mounted = false;
      unsubscribe();
      clearInterval(timer);
    };
  }, [user?.$id]);

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Ionicons name={focused ? 'heart' : 'heart-outline'} size={size} color={color} />
      {wishlistBadge !== undefined && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{wishlistBadge}</Text>
        </View>
      )}
    </View>
  );
};

const ProfileTabIcon = ({ focused, color, size }: { focused: boolean; color: string; size: number }) => {
  const { user } = useAuth();
  const [profileUnreadBadge, setProfileUnreadBadge] = useState<number | undefined>(undefined);

  useEffect(() => {
    let mounted = true;

    const loadUnread = async () => {
      if (!user?.$id) {
        if (mounted) setProfileUnreadBadge(undefined);
        return;
      }

      try {
        const unread = await getUnreadCount(user.$id);
        if (mounted) {
          setProfileUnreadBadge(unread > 0 ? unread : undefined);
        }
      } catch {
        if (mounted) {
          setProfileUnreadBadge(undefined);
        }
      }
    };

    loadUnread();
    const timer = setInterval(loadUnread, 25000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [user?.$id]);

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
      {profileUnreadBadge !== undefined && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{profileUnreadBadge}</Text>
        </View>
      )}
    </View>
  );
};

const BuyerNavigator = () => {
  const { route } = {} as any; // mock route if needed, React Navigation injects it

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={[]}>
    <Tab.Navigator
      backBehavior="history"
      safeAreaInsets={{ bottom: 0 }}
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home-outline';

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Search') {
            iconName = focused ? 'search' : 'search-outline';
          } else if (route.name === 'Explore') {
            iconName = focused ? 'location' : 'location-outline';
          }

          if (route.name === 'Wishlist' || route.name === 'Profile') {
            // Handled by custom icon renderers below
            return null;
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          display: isNestedDetailScreen(route) ? 'none' : 'flex',
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          paddingTop: 4,
          paddingBottom: 4,
          height: 56,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="Search" component={SearchStack} />
      <Tab.Screen name="Explore" component={ExploreStack} />
      <Tab.Screen
        name="Wishlist"
        component={WishlistStack}
        options={{
          title: 'Saved',
          tabBarIcon: ({ focused, color, size }) => (
            <WishlistTabIcon focused={focused} color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={{
          tabBarIcon: ({ focused, color, size }) => (
            <ProfileTabIcon focused={focused} color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -5,
    right: -7,
    backgroundColor: COLORS.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1,
    borderColor: COLORS.surface,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default BuyerNavigator;
