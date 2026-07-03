import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount,
} from '../../services/notificationService';
import { Notification } from '../../types/common.types';
import { COLORS } from '../../constants/colors';
import { showAlert } from '../../utils/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { PremiumTopBar } from '../../components/PremiumTopBar';

const SellerNotificationsScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = useCallback(async () => {
    try {
      const [result, count] = await Promise.all([
        getUserNotifications(user!.$id, 1, 50),
        getUnreadCount(user!.$id),
      ]);
      setNotifications(result.data);
      setUnreadCount(count);
    } catch (error) {
      console.error('Error loading notifications:', error);
      showAlert('Error', 'Failed to load notifications.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [loadNotifications])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadNotifications();
  }, []);

  const handleMarkAsRead = async (notification: Notification) => {
    if (notification.isRead) return;
    try {
      await markAsRead(notification.$id);
      setNotifications(prev =>
        prev.map(n => n.$id === notification.$id ? { ...n, isRead: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead(user!.$id);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      showAlert('Error', 'Failed to mark all as read');
    }
  };

  const handleDelete = async (notificationId: string) => {
    showAlert('Delete?', 'Remove this notification?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteNotification(notificationId);
            const deleted = notifications.find(n => n.$id === notificationId);
            setNotifications(prev => prev.filter(n => n.$id !== notificationId));
            if (deleted && !deleted.isRead) {
              setUnreadCount(prev => Math.max(0, prev - 1));
            }
          } catch (error) {
            showAlert('Error', 'Failed to delete notification');
          }
        },
      },
    ]);
  };

  const getNotificationIcon = (type: string): { name: string; color: string } => {
    switch (type) {
      case 'seller_application':
        return { name: 'storefront-outline', color: COLORS.primary };
      case 'verification':
        return { name: 'shield-checkmark-outline', color: '#4CAF50' };
      case 'product_approval':
      case 'product_approved':
        return { name: 'checkmark-circle-outline', color: '#4CAF50' };
      case 'product_rejected':
        return { name: 'close-circle-outline', color: '#FF4444' };
      case 'review':
      case 'new_review':
        return { name: 'star-outline', color: '#FFC107' };
      case 'order':
      case 'order_update':
      case 'order_status':
      case 'new_order':
        return { name: 'cart-outline', color: '#2196F3' };
      case 'report_update':
        return { name: 'flag-outline', color: '#FF9800' };
      case 'warning':
        return { name: 'warning-outline', color: '#FF4444' };
      default:
        return { name: 'notifications-outline', color: COLORS.primary };
    }
  };

  const formatTime = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    const icon = getNotificationIcon(item.type);
    return (
      <TouchableOpacity
        style={[styles.notifCard, !item.isRead && styles.unreadCard]}
        onPress={() => handleMarkAsRead(item)}
        onLongPress={() => handleDelete(item.$id)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconContainer, { backgroundColor: icon.color + '15' }]}>
          <Ionicons name={icon.name as any} size={24} color={icon.color} />
        </View>
        <View style={styles.notifContent}>
          <Text style={[styles.notifMessage, !item.isRead && styles.unreadText]} numberOfLines={3}>
            {item.message}
          </Text>
          <Text style={styles.notifTime}>{formatTime(item.createdAt)}</Text>
        </View>
        {!item.isRead && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <PremiumTopBar
        title="Notifications"
        subtitle="Updates for orders, reviews, and verification"
        icon="notifications-outline"
        showBack={navigation?.canGoBack?.()}
        onBack={() => navigation?.goBack?.()}
        rightLabel={refreshing ? 'Refreshing' : 'Refresh'}
        onRightPress={onRefresh}
        rightDisabled={refreshing}
      />

      {/* Header Actions */}
      {notifications.length > 0 && unreadCount > 0 && (
        <View style={styles.headerActions}>
          <Text style={styles.unreadLabel}>{unreadCount} unread</Text>
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={styles.markAllText}>Mark all as read</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.$id}
        renderItem={renderNotification}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={[styles.listContent, { paddingBottom: 16 }]}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>No Notifications</Text>
            <Text style={styles.emptySubtext}>
              You'll be notified about verifications, approvals, reviews, and orders
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerActions: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 11, backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  unreadLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  markAllText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  listContent: { padding: 14 },
  notifCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  unreadCard: { backgroundColor: `${COLORS.primary}0A`, borderLeftWidth: 3, borderLeftColor: COLORS.primary },
  iconContainer: {
    width: 42, height: 42, borderRadius: 21, alignItems: 'center',
    justifyContent: 'center', marginRight: 12,
  },
  notifContent: { flex: 1 },
  notifMessage: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  unreadText: { fontWeight: '700', color: COLORS.text },
  notifTime: { fontSize: 11, color: COLORS.textTertiary, marginTop: 4 },
  unreadDot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary,
    marginLeft: 8,
  },
  emptyContainer: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginTop: 16 },
  emptySubtext: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4, textAlign: 'center', paddingHorizontal: 40 },
});

export default SellerNotificationsScreen;
