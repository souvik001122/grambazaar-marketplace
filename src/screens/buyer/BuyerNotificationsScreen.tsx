import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import {
  getUserNotifications,
  markAllAsRead,
  markAsRead,
} from '../../services/notificationService';
import { Notification } from '../../types/common.types';
import { formatRelativeTime } from '../../utils/formatting';
import { BUYER_LAYOUT } from '../../constants/layout';
import { PremiumTopBar } from '../../components/PremiumTopBar';

const BuyerNotificationsScreen = ({ navigation }: any) => {
  const tabBarHeight = 16;
  const { width: screenWidth } = useWindowDimensions();
  const isLargeScreen = screenWidth >= BUYER_LAYOUT.railBreakpoint;
  const railStyle = isLargeScreen ? styles.contentRailWide : undefined;
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!user) return;

    try {
      const response = await getUserNotifications(user.$id, 1, 50);
      setNotifications(response.data);
    } catch (error) {
      console.error('Failed to load buyer notifications:', error);
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const handleMarkRead = async (item: Notification) => {
    if (item.isRead) return;

    try {
      await markAsRead(item.$id);
      setNotifications((prev) =>
        prev.map((n) => (n.$id === item.$id ? { ...n, isRead: true } : n))
      );
    } catch {
      // ignore to keep screen responsive
    }
  };

  const navigateFromNotification = (item: Notification) => {
    const relatedId = item.relatedEntityId || '';

    if (!relatedId) return;

    if (item.type === 'order_created' || item.type === 'order_update' || item.type === 'order_status') {
      navigation.navigate('OrderDetail', { orderId: relatedId });
      return;
    }

    if (item.type === 'new_review' || item.type === 'review' || item.type === 'product_approval') {
      navigation.navigate('ProductDetail', { productId: relatedId });
      return;
    }

    if (item.type === 'verification') {
      navigation.navigate('SellerProfile', { sellerId: relatedId });
    }
  };

  const handleMarkAllRead = async () => {
    if (!user) return;

    try {
      setMarkingAll(true);
      await markAllAsRead(user.$id);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      // ignore to keep screen responsive
    } finally {
      setMarkingAll(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  const unreadCount = notifications.filter((item) => !item.isRead).length;

  return (
    <View style={styles.container}>
      <PremiumTopBar
        title="Notification Center"
        subtitle="Order updates, trust events, and important activity"
        icon="notifications"
        showBack={navigation.canGoBack()}
        onBack={() => navigation.goBack()}
        rightLabel={markingAll ? 'Updating' : 'Mark all read'}
        onRightPress={handleMarkAllRead}
        rightDisabled={markingAll || unreadCount === 0}
      />

      <View style={[styles.headerActionsWrap, railStyle]}>
        <View style={styles.unreadPill}>
          <Text style={styles.unreadPillText}>{unreadCount} unread</Text>
        </View>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.$id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        contentContainerStyle={[styles.listContent, railStyle, { paddingBottom: tabBarHeight }]}
        ListHeaderComponent={
          notifications.length > 0 ? (
            <View style={styles.summaryCard}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{notifications.length}</Text>
                <Text style={styles.summaryLabel}>Total</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{unreadCount}</Text>
                <Text style={styles.summaryLabel}>Unread</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{notifications.length - unreadCount}</Text>
                <Text style={styles.summaryLabel}>Read</Text>
              </View>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="notifications-off-outline" size={42} color={COLORS.textTertiary} />
            <Text style={styles.emptyText}>No notifications yet</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, !item.isRead && styles.cardUnread]}
            onPress={() => {
              handleMarkRead(item);
              navigateFromNotification(item);
            }}
            activeOpacity={0.85}
          >
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle}>{item.title || 'Update'}</Text>
              {!item.isRead && <View style={styles.unreadDot} />}
            </View>
            <Text style={styles.cardMessage}>{item.message}</Text>
            <Text style={styles.cardTime}>{formatRelativeTime(item.createdAt)}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  contentRailWide: {
    width: '100%',
    maxWidth: BUYER_LAYOUT.railMaxWidth,
    alignSelf: 'center',
  },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRow: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitleWrap: {
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  headerActionsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  unreadPill: {
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: `${COLORS.primary}44`,
    backgroundColor: `${COLORS.primary}12`,
    paddingHorizontal: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  markAllButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
  },
  markAllDisabled: {
    opacity: 0.55,
  },
  markAllText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    padding: 12,
    paddingBottom: 32,
  },
  summaryCard: {
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${COLORS.primary}22`,
    backgroundColor: `${COLORS.primary}10`,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 24,
    backgroundColor: `${COLORS.primary}33`,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  summaryLabel: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 13,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardUnread: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}08`,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  cardMessage: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  cardTime: {
    fontSize: 12,
    color: COLORS.textTertiary,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
});

export default BuyerNotificationsScreen;
