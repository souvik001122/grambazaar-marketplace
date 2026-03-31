import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { getUnreadCount } from '../services/notificationService';
import { getWishlistCount, subscribeWishlistChanges } from '../services/wishlistService';

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

const stackScreenOptions = {
  headerStyle: { backgroundColor: COLORS.primary },
  headerTintColor: '#FFF',
  headerTitleStyle: { fontWeight: '700' as const },
};

// ─── Stack navigators for each tab ──────────────────────────────

const HomeStack = () => (
  <Stack.Navigator screenOptions={stackScreenOptions}>
    <Stack.Screen name="HomeMain" component={HomeScreen} options={{ headerShown: false }} />
    <Stack.Screen name="TopArtisans" component={TopArtisansScreen} options={{ title: 'Top Artisans' }} />
    <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ headerShown: false }} />
    <Stack.Screen name="Cart" component={CartScreen} options={{ title: 'My Cart' }} />
    <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: 'Checkout' }} />
    <Stack.Screen name="SellerProfile" component={SellerProfileScreen} options={{ title: 'Seller' }} />
    <Stack.Screen name="WriteReview" component={WriteReviewScreen} options={{ title: 'Write Review' }} />
    <Stack.Screen name="ProductReviews" component={ProductReviewsScreen} options={{ title: 'Reviews' }} />
  </Stack.Navigator>
);

const SearchStack = () => (
  <Stack.Navigator screenOptions={stackScreenOptions}>
    <Stack.Screen name="SearchMain" component={SearchScreen} options={{ headerShown: false }} />
    <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ headerShown: false }} />
    <Stack.Screen name="Cart" component={CartScreen} options={{ title: 'My Cart' }} />
    <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: 'Checkout' }} />
    <Stack.Screen name="SellerProfile" component={SellerProfileScreen} options={{ title: 'Seller' }} />
    <Stack.Screen name="WriteReview" component={WriteReviewScreen} options={{ title: 'Write Review' }} />
    <Stack.Screen name="ProductReviews" component={ProductReviewsScreen} options={{ title: 'Reviews' }} />
  </Stack.Navigator>
);

const OrdersStack = () => (
  <Stack.Navigator screenOptions={stackScreenOptions}>
    <Stack.Screen name="OrdersMain" component={BuyerOrdersScreen} options={{ headerShown: false }} />
    <Stack.Screen name="OrderDetail" component={BuyerOrderDetailScreen} options={{ title: 'Order Detail' }} />
    <Stack.Screen name="RaiseOrderIssue" component={RaiseOrderIssueScreen} options={{ title: 'Raise Issue' }} />
    <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ headerShown: false }} />
    <Stack.Screen name="WriteReview" component={WriteReviewScreen} options={{ title: 'Write Review' }} />
  </Stack.Navigator>
);

const ExploreStack = () => (
  <Stack.Navigator screenOptions={stackScreenOptions}>
    <Stack.Screen name="ExploreMain" component={RegionExploreScreen} options={{ headerShown: false }} />
    <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ headerShown: false }} />
    <Stack.Screen name="SellerProfile" component={SellerProfileScreen} options={{ title: 'Seller' }} />
    <Stack.Screen name="Cart" component={CartScreen} options={{ title: 'My Cart' }} />
    <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: 'Checkout' }} />
  </Stack.Navigator>
);

const WishlistStack = () => (
  <Stack.Navigator screenOptions={stackScreenOptions}>
    <Stack.Screen name="WishlistMain" component={WishlistScreen} options={{ headerShown: false }} />
    <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ headerShown: false }} />
    <Stack.Screen name="SellerProfile" component={SellerProfileScreen} options={{ title: 'Seller' }} />
  </Stack.Navigator>
);

const ProfileStack = () => (
  <Stack.Navigator screenOptions={stackScreenOptions}>
    <Stack.Screen name="ProfileMain" component={ProfileScreen} options={{ headerShown: false }} />
    <Stack.Screen name="Orders" component={BuyerOrdersScreen} options={{ title: 'My Orders' }} />
    <Stack.Screen name="OrderDetail" component={BuyerOrderDetailScreen} options={{ title: 'Order Detail' }} />
    <Stack.Screen name="RaiseOrderIssue" component={RaiseOrderIssueScreen} options={{ title: 'Raise Issue' }} />
    <Stack.Screen name="Wishlist" component={WishlistScreen} options={{ title: 'My Wishlist' }} />
    <Stack.Screen name="BuyerNotifications" component={BuyerNotificationsScreen} options={{ title: 'Notifications' }} />
    <Stack.Screen name="BuyerMyReviews" component={BuyerMyReviewsScreen} options={{ title: 'My Reviews' }} />
    <Stack.Screen name="BuyerSettings" component={BuyerSettingsScreen} options={{ title: 'Settings' }} />
    <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ headerShown: false }} />
    <Stack.Screen name="WriteReview" component={WriteReviewScreen} options={{ title: 'Write Review' }} />
  </Stack.Navigator>
);

// ─── Main Tab Navigator ─────────────────────────────────────────

const BuyerNavigator = () => {
  const { user } = useAuth();
  const [profileUnreadBadge, setProfileUnreadBadge] = React.useState<number | undefined>(undefined);
  const [wishlistBadge, setWishlistBadge] = React.useState<number | undefined>(undefined);

  React.useEffect(() => {
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

  React.useEffect(() => {
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
          } else if (route.name === 'Wishlist') {
            iconName = focused ? 'heart' : 'heart-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
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
        options={{ title: 'Saved', tabBarBadge: wishlistBadge }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={{ tabBarBadge: profileUnreadBadge }}
      />
    </Tab.Navigator>
    </SafeAreaView>
  );
};

export default BuyerNavigator;
