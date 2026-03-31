import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/colors';

// Seller Screens
import SellerDashboardScreen from '../screens/seller/SellerDashboardScreen';
import MyProductsScreen from '../screens/seller/MyProductsScreen';
import AddProductScreen from '../screens/seller/AddProductScreen';
import EditProductScreen from '../screens/seller/EditProductScreen';
import SellerOrdersScreen from '../screens/seller/SellerOrdersScreen';
import SellerReviewsScreen from '../screens/seller/SellerReviewsScreen';
import SellerAnalyticsScreen from '../screens/seller/SellerAnalyticsScreen';
import SellerNotificationsScreen from '../screens/seller/SellerNotificationsScreen';
import SellerSettingsScreen from '../screens/seller/SellerSettingsScreen';
import { SellerVerificationStatusScreen } from '../screens/seller/SellerVerificationStatusScreen';
import ProfileScreen from '../screens/shared/ProfileScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const SellerTabs = () => {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={[]}>
    <Tab.Navigator
      backBehavior="history"
      safeAreaInsets={{ bottom: 0 }}
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: any;

          if (route.name === 'Dashboard') {
            iconName = focused ? 'grid' : 'grid-outline';
          } else if (route.name === 'MyProducts') {
            iconName = focused ? 'cube' : 'cube-outline';
          } else if (route.name === 'Orders') {
            iconName = focused ? 'receipt' : 'receipt-outline';
          } else if (route.name === 'AddProduct') {
            iconName = focused ? 'add-circle' : 'add-circle-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          paddingTop: 4,
          paddingBottom: 4,
          height: 56,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Dashboard" component={SellerDashboardScreen} />
      <Tab.Screen name="MyProducts" component={MyProductsScreen} options={{ title: 'My Products' }} />
      <Tab.Screen name="Orders" component={SellerOrdersScreen} options={{ title: 'Orders' }} />
      <Tab.Screen name="AddProduct" component={AddProductScreen} options={{ title: 'Add Product' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
    </SafeAreaView>
  );
};

const SellerNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SellerTabs" component={SellerTabs} />
      <Stack.Screen
        name="EditProduct"
        component={EditProductScreen}
      />
      <Stack.Screen
        name="SellerOrders"
        component={SellerOrdersScreen}
        options={{ headerShown: true, title: 'Orders', headerStyle: { backgroundColor: COLORS.primary }, headerTintColor: '#fff' }}
      />
      <Stack.Screen
        name="SellerMyProducts"
        component={MyProductsScreen}
        options={{ headerShown: true, title: 'My Products', headerStyle: { backgroundColor: COLORS.primary }, headerTintColor: '#fff' }}
      />
      <Stack.Screen
        name="SellerReviews"
        component={SellerReviewsScreen}
        options={{ headerShown: true, title: 'Reviews', headerStyle: { backgroundColor: COLORS.primary }, headerTintColor: '#fff' }}
      />
      <Stack.Screen
        name="SellerAnalytics"
        component={SellerAnalyticsScreen}
        options={{ headerShown: true, title: 'Analytics', headerStyle: { backgroundColor: COLORS.primary }, headerTintColor: '#fff' }}
      />
      <Stack.Screen
        name="SellerNotifications"
        component={SellerNotificationsScreen}
        options={{ headerShown: true, title: 'Notifications', headerStyle: { backgroundColor: COLORS.primary }, headerTintColor: '#fff' }}
      />
      <Stack.Screen
        name="SellerSettings"
        component={SellerSettingsScreen}
        options={{ headerShown: true, title: 'Settings', headerStyle: { backgroundColor: COLORS.primary }, headerTintColor: '#fff' }}
      />
      <Stack.Screen
        name="VerificationStatus"
        component={SellerVerificationStatusScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};

export default SellerNavigator;
