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
import { getAdminLogs } from '../../services/adminService';
import { AdminLog } from '../../types/common.types';
import { COLORS } from '../../constants/colors';
import { showAlert } from '../../utils/alert';

const ACTION_META: Record<string, { icon: string; color: string; label: string }> = {
  approve_seller: { icon: 'checkmark-circle', color: COLORS.success, label: 'Approved Seller' },
  reject_seller: { icon: 'close-circle', color: COLORS.error, label: 'Rejected Seller' },
  block_seller: { icon: 'ban', color: COLORS.error, label: 'Blocked Seller' },
  unblock_seller: { icon: 'checkmark-circle', color: COLORS.success, label: 'Unblocked Seller' },
  approve_product: { icon: 'checkmark-circle', color: COLORS.success, label: 'Approved Product' },
  reject_product: { icon: 'close-circle', color: COLORS.error, label: 'Rejected Product' },
  delete_product: { icon: 'trash', color: COLORS.error, label: 'Deleted Product' },
  toggle_featured: { icon: 'star', color: COLORS.warning, label: 'Toggled Featured' },
  resolve_report: { icon: 'checkmark-done', color: COLORS.success, label: 'Resolved Report' },
  dismiss_report: { icon: 'eye-off', color: COLORS.textSecondary, label: 'Dismissed Report' },
  investigate_report: { icon: 'search', color: COLORS.info, label: 'Investigating Report' },
  change_user_role: { icon: 'swap-horizontal', color: COLORS.info, label: 'Changed User Role' },
  update_order_status: { icon: 'refresh', color: COLORS.info, label: 'Updated Order' },
};

const AdminLogsScreen = () => {
  const tabBarHeight = 16;
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 30;

  const loadLogs = async (offset = 0, append = false) => {
    try {
      const data = await getAdminLogs(PAGE_SIZE, offset);
      if (append) {
        setLogs(prev => [...prev, ...data]);
      } else {
        setLogs(data);
      }
      if (data.length < PAGE_SIZE) setHasMore(false);
    } catch (error) {
      console.error('Error loading logs:', error);
      showAlert('Error', 'Failed to load activity logs.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => { loadLogs(); }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(0);
    setHasMore(true);
    loadLogs(0, false);
  }, []);

  const loadMore = () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    setPage(nextPage);
    loadLogs(nextPage * PAGE_SIZE, true);
  };

  const getActionMeta = (action: string) => {
    return ACTION_META[action] || { icon: 'ellipsis-horizontal', color: COLORS.textSecondary, label: action.replace(/_/g, ' ') };
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatTime = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  // Group logs by date
  const groupedLogs = logs.reduce<Record<string, AdminLog[]>>((acc, log) => {
    const dateKey = new Date(log.createdAt).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(log);
    return acc;
  }, {});

  const sections = Object.entries(groupedLogs).map(([date, items]) => ({
    date,
    items,
  }));

  const renderLogItem = (log: AdminLog, isLast: boolean) => {
    const meta = getActionMeta(log.action);
    return (
      <View key={log.$id} style={styles.logItem}>
        {/* Timeline connector */}
        <View style={styles.timelineCol}>
          <View style={[styles.timelineDot, { backgroundColor: meta.color }]}>
            <Ionicons name={meta.icon as any} size={12} color="#FFF" />
          </View>
          {!isLast && <View style={styles.timelineLine} />}
        </View>

        {/* Content */}
        <View style={styles.logContent}>
          <View style={styles.logHeader}>
            <Text style={styles.logAction}>{meta.label}</Text>
            <Text style={styles.logTime}>{formatTime(log.createdAt)}</Text>
          </View>
          <Text style={styles.logEntity}>
            {log.entityType?.charAt(0).toUpperCase() + log.entityType?.slice(1)} · {log.entityId?.substring(0, 12)}...
          </Text>
          {log.details ? <Text style={styles.logDetails}>{log.details}</Text> : null}
          <Text style={styles.logAdmin}>
            <Ionicons name="person-outline" size={10} color={COLORS.textTertiary} /> Admin: {log.adminId?.substring(0, 10)}...
          </Text>
        </View>
      </View>
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
    <View style={styles.container}>
      {/* Header summary */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryCount}>{logs.length}</Text>
          <Text style={styles.summaryLabel}>Activities Loaded</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryCount}>{sections.length}</Text>
          <Text style={styles.summaryLabel}>Days</Text>
        </View>
      </View>

      <FlatList
        data={sections}
        keyExtractor={(item) => item.date}
        contentContainerStyle={[styles.listContent, { paddingBottom: tabBarHeight }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        renderItem={({ item: section }) => (
          <View style={styles.section}>
            <View style={styles.dateHeader}>
              <Ionicons name="calendar-outline" size={14} color={COLORS.primary} />
              <Text style={styles.dateText}> {section.date}</Text>
            </View>
            {section.items.map((log, idx) =>
              renderLogItem(log, idx === section.items.length - 1)
            )}
          </View>
        )}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator size="small" color={COLORS.primary} style={{ padding: 16 }} />
          ) : !hasMore && logs.length > 0 ? (
            <Text style={styles.endText}>— End of activity log —</Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={60} color={COLORS.textTertiary} />
            <Text style={styles.emptyTitle}>No activity logs</Text>
            <Text style={styles.emptySubtext}>Admin actions will appear here</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    margin: 16,
    marginBottom: 0,
    padding: 16,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryCount: { fontSize: 22, fontWeight: '800', color: COLORS.primary },
  summaryLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: COLORS.border, marginHorizontal: 16 },
  listContent: { padding: 16 },
  section: { marginBottom: 16 },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dateText: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  logItem: { flexDirection: 'row', marginBottom: 0 },
  timelineCol: { alignItems: 'center', width: 32 },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: COLORS.border,
    marginTop: -2,
  },
  logContent: {
    flex: 1,
    marginLeft: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logAction: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  logTime: { fontSize: 11, color: COLORS.textTertiary },
  logEntity: { fontSize: 12, color: COLORS.textSecondary, marginTop: 3 },
  logDetails: { fontSize: 12, color: COLORS.textSecondary, marginTop: 3, fontStyle: 'italic' },
  logAdmin: { fontSize: 10, color: COLORS.textTertiary, marginTop: 6 },
  endText: { textAlign: 'center', color: COLORS.textTertiary, fontSize: 12, padding: 20 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text, marginTop: 16 },
  emptySubtext: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
});

export default AdminLogsScreen;
