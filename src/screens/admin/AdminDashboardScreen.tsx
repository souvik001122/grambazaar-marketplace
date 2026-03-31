import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { getAnalytics, getRecentActivity } from '../../services/adminService';
import { AdminLog } from '../../types/common.types';
import { COLORS } from '../../constants/colors';
import { showAlert } from '../../utils/alert';

// Map screen names to tab-based navigation
const SCREEN_TAB_MAP: Record<string, { tab: string; screen: string }> = {
  AdminSellers: { tab: 'SellersTab', screen: 'AdminSellers' },
  AdminProducts: { tab: 'ProductsTab', screen: 'AdminProducts' },
  AdminOrders: { tab: 'OrdersTab', screen: 'AdminOrders' },
  AdminReports: { tab: 'MoreTab', screen: 'AdminReports' },
  AdminUsers: { tab: 'MoreTab', screen: 'AdminUsers' },
  AdminLogs: { tab: 'MoreTab', screen: 'AdminLogs' },
};

const navigateToScreen = (navigation: any, screenKey: string | null) => {
  if (!screenKey) return;
  const mapping = SCREEN_TAB_MAP[screenKey];
  if (mapping) {
    navigation.navigate(mapping.tab, { screen: mapping.screen });
  }
};

interface DashboardStats {
  totalUsers: number;
  totalSellers: number;
  pendingSellers: number;
  approvedSellers: number;
  totalProducts: number;
  activeProducts: number;
  pendingProducts: number;
  totalReviews: number;
  pendingReports: number;
}

const AdminDashboardScreen = ({ navigation }: any) => {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentLogs, setRecentLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const loadData = async () => {
    try {
      const [analyticsData, logs] = await Promise.all([
        getAnalytics(),
        getRecentActivity(8),
      ]);
      setStats(analyticsData);
      setRecentLogs(logs);
      setError(false);
    } catch (error) {
      console.error('Error loading dashboard:', error);
      setError(true);
      if (!refreshing) showAlert('Error', 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (error && !stats) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="cloud-offline-outline" size={60} color={COLORS.textTertiary} />
        <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.text, marginTop: 16 }}>Failed to load data</Text>
        <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginTop: 4 }}>Check your connection and try again</Text>
        <TouchableOpacity onPress={() => { setLoading(true); setError(false); loadData(); }} style={{ marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: COLORS.primary, borderRadius: 8 }}>
          <Text style={{ color: '#FFF', fontWeight: '600' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statCards = [
    { label: 'Total Users', value: stats?.totalUsers || 0, icon: 'people', color: COLORS.info, screen: 'AdminUsers' },
    { label: 'Total Sellers', value: stats?.totalSellers || 0, icon: 'storefront', color: COLORS.secondary, screen: 'AdminSellers' },
    { label: 'Pending Sellers', value: stats?.pendingSellers || 0, icon: 'hourglass', color: COLORS.warning, screen: 'AdminSellers' },
    { label: 'Approved Sellers', value: stats?.approvedSellers || 0, icon: 'checkmark-circle', color: COLORS.success, screen: 'AdminSellers' },
    { label: 'Total Products', value: stats?.totalProducts || 0, icon: 'cube', color: COLORS.primaryDark, screen: 'AdminProducts' },
    { label: 'Pending Products', value: stats?.pendingProducts || 0, icon: 'time', color: COLORS.warning, screen: 'AdminProducts' },
    { label: 'Active Products', value: stats?.activeProducts || 0, icon: 'checkmark-done', color: COLORS.success, screen: 'AdminProducts' },
    { label: 'Total Reviews', value: stats?.totalReviews || 0, icon: 'star', color: COLORS.primaryLight, screen: null },
    { label: 'Pending Reports', value: stats?.pendingReports || 0, icon: 'flag', color: COLORS.error, screen: 'AdminReports' },
  ];

  const quickActions = [
    { label: 'Pending Sellers', icon: 'people-circle', color: COLORS.warning, screen: 'AdminSellers', badge: stats?.pendingSellers },
    { label: 'Pending Products', icon: 'cube-outline', color: COLORS.primary, screen: 'AdminProducts', badge: stats?.pendingProducts },
    { label: 'Reports', icon: 'flag-outline', color: COLORS.error, screen: 'AdminReports', badge: stats?.pendingReports },
    { label: 'All Orders', icon: 'receipt-outline', color: COLORS.info, screen: 'AdminOrders', badge: null },
    { label: 'Users', icon: 'people-outline', color: COLORS.secondary, screen: 'AdminUsers', badge: null },
    { label: 'Activity Log', icon: 'list-outline', color: COLORS.textSecondary, screen: 'AdminLogs', badge: null },
  ];

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      approve_seller: 'Approved seller',
      reject_seller: 'Rejected seller',
      block_seller: 'Blocked seller',
      unblock_seller: 'Unblocked seller',
      approve_product: 'Approved product',
      reject_product: 'Rejected product',
      delete_product: 'Deleted product',
      resolve_report: 'Resolved report',
      dismiss_report: 'Dismissed report',
    };
    return labels[action] || action;
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.adminName}>{user?.name || 'Admin'}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={() => {
          showAlert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Logout', style: 'destructive', onPress: logout },
          ]);
        }}>
          <Ionicons name="log-out-outline" size={24} color={COLORS.error} />
        </TouchableOpacity>
      </View>

      {/* Stats Grid */}
      <Text style={styles.sectionTitle}>Platform Overview</Text>
      <View style={styles.statsGrid}>
        {statCards.map((card, index) => (
          <TouchableOpacity
            key={index}
            style={styles.statCard}
            onPress={() => navigateToScreen(navigation, card.screen)}
            activeOpacity={card.screen ? 0.7 : 1}
          >
            <View style={[styles.statIconContainer, { backgroundColor: card.color + '15' }]}>
              <Ionicons name={card.icon as any} size={22} color={card.color} />
            </View>
            <Text style={styles.statValue}>{card.value}</Text>
            <Text style={styles.statLabel}>{card.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsGrid}>
        {quickActions.map((action, index) => (
          <TouchableOpacity
            key={index}
            style={styles.actionCard}
            onPress={() => navigateToScreen(navigation, action.screen)}
          >
            <View style={[styles.actionIcon, { backgroundColor: action.color + '15' }]}>
              <Ionicons name={action.icon as any} size={28} color={action.color} />
              {action.badge != null && action.badge > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{action.badge > 99 ? '99+' : action.badge}</Text>
                </View>
              )}
            </View>
            <Text style={styles.actionLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Recent Activity */}
      <Text style={styles.sectionTitle}>Recent Activity</Text>
      <View style={styles.activityContainer}>
        {recentLogs.length === 0 ? (
          <View style={styles.emptyActivity}>
            <Ionicons name="time-outline" size={40} color={COLORS.textTertiary} />
            <Text style={styles.emptyText}>No recent activity</Text>
          </View>
        ) : (
          recentLogs.map((log, index) => (
            <View key={log.$id || index} style={styles.activityItem}>
              <View style={styles.activityDot} />
              <View style={styles.activityContent}>
                <Text style={styles.activityAction}>{getActionLabel(log.action)}</Text>
                <Text style={styles.activityDetail}>{log.details || `ID: ${(log.entityId || '').substring(0, 12)}...`}</Text>
                <Text style={styles.activityTime}>{formatTime(log.createdAt)}</Text>
              </View>
            </View>
          ))
        )}
      </View>

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 16,
    backgroundColor: COLORS.primary,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  greeting: {
    fontSize: 14,
    color: '#FFF',
    opacity: 0.85,
  },
  adminName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 2,
  },
  logoutBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
  },
  statCard: {
    width: '33.33%',
    paddingHorizontal: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  statIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
  },
  actionCard: {
    width: '33.33%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: COLORS.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  actionLabel: {
    fontSize: 12,
    color: COLORS.text,
    marginTop: 6,
    textAlign: 'center',
  },
  activityContainer: {
    marginHorizontal: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  emptyActivity: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    color: COLORS.textTertiary,
    marginTop: 8,
    fontSize: 14,
  },
  activityItem: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginTop: 6,
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityAction: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  activityDetail: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  activityTime: {
    fontSize: 11,
    color: COLORS.textTertiary,
    marginTop: 2,
  },
});

export default AdminDashboardScreen;
