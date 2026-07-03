import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { PREMIUM_STACK_OPTIONS } from './premiumStackOptions';
import { PremiumTopBar } from '../components/PremiumTopBar';

// Admin Screens
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import PendingSellersScreen from '../screens/admin/PendingSellersScreen';
import AdminSellerDetailScreen from '../screens/admin/AdminSellerDetailScreen';
import AdminDocumentViewerScreen from '../screens/admin/AdminDocumentPreviewScreen';
import PendingProductsScreen from '../screens/admin/PendingProductsScreen';
import AdminProductDetailScreen from '../screens/admin/AdminProductDetailScreen';
import AdminOrdersScreen from '../screens/admin/AdminOrdersScreen';
import AdminOrderDetailScreen from '../screens/admin/AdminOrderDetailScreen';
import ReportsScreen from '../screens/admin/ReportsScreen';
import AdminUsersScreen from '../screens/admin/AdminUsersScreen';
import AdminLogsScreen from '../screens/admin/AdminLogsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// ─── Stack navigators for each tab ──────────────────────────────

const DashboardStack = () => (
  <Stack.Navigator screenOptions={stackScreenOptions}>
    <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ headerShown: false }} />
  </Stack.Navigator>
);

const SellersStack = () => (
  <Stack.Navigator screenOptions={stackScreenOptions}>
    <Stack.Screen name="AdminSellers" component={PendingSellersScreen} options={{ headerShown: false }} />
    <Stack.Screen name="AdminSellerDetail" component={AdminSellerDetailScreen} options={{ headerShown: false }} />
    <Stack.Screen name="AdminDocumentViewer" component={AdminDocumentViewerScreen} options={{ title: 'Document Preview' }} />
  </Stack.Navigator>
);

const ProductsStack = () => (
  <Stack.Navigator screenOptions={stackScreenOptions}>
    <Stack.Screen name="AdminProducts" component={PendingProductsScreen} options={{ headerShown: false }} />
    <Stack.Screen name="AdminProductDetail" component={AdminProductDetailScreen} options={{ title: 'Product Detail' }} />
  </Stack.Navigator>
);

const OrdersStack = () => (
  <Stack.Navigator screenOptions={stackScreenOptions}>
    <Stack.Screen name="AdminOrders" component={AdminOrdersScreen} options={{ headerShown: false }} />
    <Stack.Screen name="AdminOrderDetail" component={AdminOrderDetailScreen} options={{ headerShown: false }} />
  </Stack.Navigator>
);

const MoreStack = () => (
  <Stack.Navigator screenOptions={stackScreenOptions}>
    <Stack.Screen name="AdminMore" component={AdminMoreMenu} options={{ headerShown: false }} />
    <Stack.Screen name="AdminReports" component={ReportsScreen} options={{ title: 'Reports' }} />
    <Stack.Screen name="AdminUsers" component={AdminUsersScreen} options={{ title: 'Users' }} />
    <Stack.Screen name="AdminLogs" component={AdminLogsScreen} options={{ title: 'Activity Logs' }} />
  </Stack.Navigator>
);

const stackScreenOptions = PREMIUM_STACK_OPTIONS;

// ─── "More" menu screen ─────────────────────────────────────────

import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

const moreItems = [
  { key: 'AdminReports', icon: 'flag-outline', label: 'Reports', desc: 'View & manage user reports' },
  { key: 'AdminUsers', icon: 'people-outline', label: 'User Management', desc: 'Manage users & roles' },
  { key: 'AdminLogs', icon: 'document-text-outline', label: 'Activity Logs', desc: 'View all admin actions' },
];

const AdminMoreMenu = ({ navigation }: any) => {
  return (
  <View style={{ flex: 1, backgroundColor: COLORS.background }}>
    <PremiumTopBar
      title="More"
      subtitle="Admin tools, reports, and governance"
      icon="ellipsis-horizontal"
    />
    <ScrollView contentContainerStyle={[moreStyles.content, { paddingBottom: 16 }]}>
    {moreItems.map((item) => (
      <TouchableOpacity
        key={item.key}
        style={moreStyles.card}
        onPress={() => navigation.navigate(item.key)}
        activeOpacity={0.7}
      >
        <View style={moreStyles.iconBox}>
          <Ionicons name={item.icon as any} size={24} color={COLORS.primary} />
        </View>
        <View style={moreStyles.cardText}>
          <Text style={moreStyles.label}>{item.label}</Text>
          <Text style={moreStyles.desc}>{item.desc}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} />
      </TouchableOpacity>
    ))}
    </ScrollView>
  </View>
  );
};

const moreStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardText: { flex: 1, marginLeft: 14 },
  label: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  desc: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
});

// ─── Bottom Tab Navigator ───────────────────────────────────────

const AdminNavigator = () => {
  const { user } = useAuth();

  // Role guard: block non-admin access
  if (user?.role !== 'admin') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <Ionicons name="shield-outline" size={60} color={COLORS.error} />
        <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.text, marginTop: 16 }}>Access Denied</Text>
        <Text style={{ fontSize: 14, color: COLORS.textSecondary, marginTop: 4 }}>Admin privileges required</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={[]}>
    <Tab.Navigator
      safeAreaInsets={{ bottom: 0 }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
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
      }}
    >
      <Tab.Screen
        name="DashboardTab"
        component={DashboardStack}
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="SellersTab"
        component={SellersStack}
        options={{
          title: 'Sellers',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ProductsTab"
        component={ProductsStack}
        options={{
          title: 'Products',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cube-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="OrdersTab"
        component={OrdersStack}
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="MoreTab"
        component={MoreStack}
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="ellipsis-horizontal" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
    </SafeAreaView>
  );
};

export default AdminNavigator;
