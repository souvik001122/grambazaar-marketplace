import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { getAllReports, updateReportStatus, createAdminLog } from '../../services/adminService';
import { getOrderById } from '../../services/orderService';
import { getProductById } from '../../services/productService';
import { Report } from '../../types/common.types';
import { COLORS } from '../../constants/colors';
import { showAlert } from '../../utils/alert';

type FilterTab = 'pending' | 'investigating' | 'resolved' | 'dismissed' | 'all';

const AdminReportsScreen = ({ navigation }: any) => {
  const tabBarHeight = 16;
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('pending');
  const [showOrderOnly, setShowOrderOnly] = useState(false);
  const [showWithProofOnly, setShowWithProofOnly] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [openingEntity, setOpeningEntity] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const loadReports = async () => {
    try {
      const all = await getAllReports();
      setReports(all);
      setError(false);
    } catch (error) {
      console.error('Error loading reports:', error);
      setError(true);
      if (!refreshing) showAlert('Error', 'Failed to load reports.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadReports(); }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadReports();
  }, []);

  const scopedReports = reports.filter((r) => {
    if (showOrderOnly && (r.reportedEntity || '').toLowerCase() !== 'order') {
      return false;
    }
    if (showWithProofOnly && !(r.proofUrls && r.proofUrls.length > 0)) {
      return false;
    }
    return true;
  });

  const filtered = scopedReports.filter(r => {
    if (activeTab === 'all') return true;
    return r.status === activeTab;
  });

  const handleAction = (report: Report, action: 'investigating' | 'resolved' | 'dismissed') => {
    const actionLabels: Record<string, string> = {
      investigating: 'Investigate',
      resolved: 'Resolve',
      dismissed: 'Dismiss',
    };
    showAlert(`${actionLabels[action]} Report`, `Mark this report as "${action}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: actionLabels[action],
        style: action === 'dismissed' ? 'destructive' : 'default',
        onPress: async () => {
          setProcessing(report.$id);
          try {
            await updateReportStatus(report.$id, action, user!.$id, `Report ${action} by admin`);
            await createAdminLog(user!.$id, `${action === 'resolved' ? 'resolve' : action === 'dismissed' ? 'dismiss' : 'investigate'}_report`, 'report', report.$id);
            showAlert('Done', `Report marked as ${action}.`);
            loadReports();
          } catch {
            showAlert('Error', 'Failed to update report.');
          } finally {
            setProcessing(null);
          }
        },
      },
    ]);
  };

  const handleOpenOrder = async (report: Report) => {
    const orderId = report.orderId || report.entityId;
    if (!orderId) {
      showAlert('Order Not Found', 'This report does not have a valid order reference.');
      return;
    }

    setOpeningEntity(report.$id);
    try {
      const order = await getOrderById(orderId);
      if (!order) {
        showAlert('Order Not Found', 'Order details could not be loaded.');
        return;
      }

      navigation.navigate('OrdersTab', {
        screen: 'AdminOrderDetail',
        params: { order },
      });
    } catch {
      showAlert('Error', 'Failed to open order details.');
    } finally {
      setOpeningEntity(null);
    }
  };

  const handleOpenProduct = async (report: Report) => {
    const productId = report.entityId;
    if (!productId) {
      showAlert('Product Not Found', 'This report does not have a valid product reference.');
      return;
    }

    setOpeningEntity(report.$id);
    try {
      const product = await getProductById(productId);
      if (!product) {
        showAlert('Product Not Found', 'Product details could not be loaded.');
        return;
      }

      navigation.navigate('ProductsTab', {
        screen: 'AdminProductDetail',
        params: { product },
      });
    } catch {
      showAlert('Error', 'Failed to open product details.');
    } finally {
      setOpeningEntity(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return COLORS.warning;
      case 'investigating': return COLORS.info;
      case 'resolved': return COLORS.success;
      case 'dismissed': return COLORS.textSecondary;
      default: return COLORS.textSecondary;
    }
  };

  const getEntityIcon = (entity: string) => {
    switch (entity) {
      case 'product': return 'cube-outline';
      case 'seller': return 'storefront-outline';
      case 'user': return 'person-outline';
      case 'review': return 'chatbubble-outline';
      case 'order': return 'receipt-outline';
      default: return 'flag-outline';
    }
  };

  const openExternalLink = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        showAlert('Cannot Open Link', 'This proof link cannot be opened on this device.');
        return;
      }
      await Linking.openURL(url);
    } catch {
      showAlert('Error', 'Failed to open proof link.');
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const getCaseHistoryText = (report: Report) => {
    const submitted = `Submitted ${formatDate(report.createdAt)}`;
    const status = (report.status || '').toLowerCase();

    if (status === 'pending') return `${submitted} -> Pending review`;
    if (status === 'investigating') return `${submitted} -> Under investigation`;
    if (status === 'resolved') {
      const closed = report.resolvedAt ? ` -> Resolved ${formatDate(report.resolvedAt)}` : ' -> Resolved';
      return `${submitted}${closed}`;
    }
    if (status === 'dismissed') {
      const closed = report.resolvedAt ? ` -> Dismissed ${formatDate(report.resolvedAt)}` : ' -> Dismissed';
      return `${submitted}${closed}`;
    }
    return submitted;
  };

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'pending', label: 'Pending', count: scopedReports.filter(r => r.status === 'pending').length },
    { key: 'investigating', label: 'Investigating', count: scopedReports.filter(r => r.status === 'investigating').length },
    { key: 'resolved', label: 'Resolved', count: scopedReports.filter(r => r.status === 'resolved').length },
    { key: 'dismissed', label: 'Dismissed', count: scopedReports.filter(r => r.status === 'dismissed').length },
    { key: 'all', label: 'All', count: scopedReports.length },
  ];

  const renderReportCard = ({ item }: { item: Report }) => {
    const isProcessing = processing === item.$id;
    const isOpeningEntity = openingEntity === item.$id;
    const isOrderDispute = item.reportedEntity === 'order';
    const canQuickInvestigate = (item.status || '').toLowerCase() === 'pending';
    return (
      <View style={styles.card}>
        {isOrderDispute && (
          <View style={styles.triageBar}>
            <TouchableOpacity
              style={styles.triageBtn}
              onPress={() => handleOpenOrder(item)}
              disabled={isOpeningEntity}
            >
              {isOpeningEntity ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <>
                  <Ionicons name="receipt-outline" size={14} color={COLORS.primary} />
                  <Text style={styles.triageBtnText}>Open Order</Text>
                </>
              )}
            </TouchableOpacity>

            {canQuickInvestigate && (
              <TouchableOpacity
                style={styles.triageBtn}
                onPress={() => handleAction(item, 'investigating')}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <>
                    <Ionicons name="search-outline" size={14} color={COLORS.primary} />
                    <Text style={styles.triageBtnText}>Mark Investigating</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.cardHeader}>
          <View style={[styles.entityIcon, { backgroundColor: getStatusColor(item.status) + '15' }]}>
            <Ionicons name={getEntityIcon(item.reportedEntity) as any} size={20} color={getStatusColor(item.status)} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.reason} numberOfLines={2}>{item.reason}</Text>
            <Text style={styles.entityType}>{item.reportedEntity?.charAt(0).toUpperCase() + item.reportedEntity?.slice(1)} Report</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '18' }]}>
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {item.status?.charAt(0).toUpperCase() + item.status?.slice(1)}
            </Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>
            <Ionicons name="person-outline" size={11} color={COLORS.textTertiary} /> Reporter: {item.reportedBy?.substring(0, 10)}...
          </Text>
          <Text style={styles.metaText}>
            <Ionicons name="time-outline" size={11} color={COLORS.textTertiary} /> {formatDate(item.createdAt)}
          </Text>
        </View>

        <View style={styles.historyBox}>
          <Ionicons name="git-branch-outline" size={12} color={COLORS.textSecondary} />
          <Text style={styles.historyText}>{getCaseHistoryText(item)}</Text>
        </View>

        {!!item.orderId && (
          <View style={styles.detailBox}>
            <Text style={styles.detailRow}><Text style={styles.detailKey}>Order:</Text> #{item.orderId.slice(-8).toUpperCase()}</Text>
            {!!item.issueCategory && (
              <Text style={styles.detailRow}><Text style={styles.detailKey}>Issue Type:</Text> {item.issueCategory}</Text>
            )}
            {!!item.courierName && (
              <Text style={styles.detailRow}><Text style={styles.detailKey}>Courier:</Text> {item.courierName}</Text>
            )}
            {!!item.trackingId && (
              <Text style={styles.detailRow}><Text style={styles.detailKey}>Tracking ID:</Text> {item.trackingId}</Text>
            )}
          </View>
        )}

        {item.reportedEntity === 'product' && !!item.entityId && (
          <View style={styles.detailBox}>
            <Text style={styles.detailRow}><Text style={styles.detailKey}>Product ID:</Text> {item.entityId}</Text>
            <Text style={styles.detailRow}><Text style={styles.detailKey}>Next Step:</Text> Open product details, verify listing/status, then resolve or dismiss.</Text>
          </View>
        )}

        {item.reportedEntity === 'order' && (
          <View style={styles.detailBox}>
            <Text style={styles.detailRow}><Text style={styles.detailKey}>Order Ref:</Text> {item.orderId || item.entityId || 'N/A'}</Text>
            <Text style={styles.detailRow}><Text style={styles.detailKey}>Next Step:</Text> Open order, verify shipment/payment evidence, then investigate/resolve.</Text>
          </View>
        )}

        {!!item.details && (
          <View style={styles.detailBox}>
            <Text style={styles.detailKey}>Issue Details</Text>
            <Text style={styles.detailText}>{item.details}</Text>
          </View>
        )}

        {!!item.proofUrls?.length && (
          <View style={styles.detailBox}>
            <Text style={styles.detailKey}>Proof Attachments</Text>
            {item.proofUrls.map((url, idx) => (
              <TouchableOpacity key={`${item.$id}-${idx}`} onPress={() => openExternalLink(url)} style={styles.proofLinkRow}>
                <Ionicons name="attach-outline" size={14} color={COLORS.info} />
                <Text style={styles.proofLink} numberOfLines={1}>Proof {idx + 1}</Text>
                <Ionicons name="open-outline" size={14} color={COLORS.info} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {(item.reportedEntity === 'order' || item.reportedEntity === 'product') && (
          <View style={styles.entityActionsRow}>
            {item.reportedEntity === 'order' && (
              <TouchableOpacity
                style={styles.openEntityBtn}
                onPress={() => handleOpenOrder(item)}
                disabled={isOpeningEntity}
              >
                {isOpeningEntity ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <>
                    <Ionicons name="open-outline" size={14} color={COLORS.primary} />
                    <Text style={styles.openEntityText}>Open Order</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {item.reportedEntity === 'product' && (
              <TouchableOpacity
                style={styles.openEntityBtn}
                onPress={() => handleOpenProduct(item)}
                disabled={isOpeningEntity}
              >
                {isOpeningEntity ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <>
                    <Ionicons name="open-outline" size={14} color={COLORS.primary} />
                    <Text style={styles.openEntityText}>Open Product</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {item.resolution && (
          <View style={styles.resolutionBox}>
            <Text style={styles.resolutionLabel}>Resolution:</Text>
            <Text style={styles.resolutionText}>{item.resolution}</Text>
          </View>
        )}

        {/* Actions for non-resolved reports */}
        {item.status !== 'resolved' && item.status !== 'dismissed' && (
          <View style={styles.actions}>
            {item.status === 'pending' && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: COLORS.info + '15' }]}
                onPress={() => handleAction(item, 'investigating')}
                disabled={isProcessing}
              >
                {isProcessing ? <ActivityIndicator size="small" color={COLORS.info} /> : (
                  <>
                    <Ionicons name="search-outline" size={14} color={COLORS.info} />
                    <Text style={[styles.actionText, { color: COLORS.info }]}> Investigate</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: COLORS.success + '15' }]}
              onPress={() => handleAction(item, 'resolved')}
              disabled={isProcessing}
            >
              <Ionicons name="checkmark-circle-outline" size={14} color={COLORS.success} />
              <Text style={[styles.actionText, { color: COLORS.success }]}> Resolve</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: COLORS.textSecondary + '15' }]}
              onPress={() => handleAction(item, 'dismissed')}
              disabled={isProcessing}
            >
              <Ionicons name="trash-outline" size={14} color={COLORS.textSecondary} />
              <Text style={[styles.actionText, { color: COLORS.textSecondary }]}> Dismiss</Text>
            </TouchableOpacity>
          </View>
        )}
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

  if (error && reports.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="cloud-offline-outline" size={60} color={COLORS.textTertiary} />
        <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.text, marginTop: 16 }}>Failed to load reports</Text>
        <TouchableOpacity onPress={() => { setLoading(true); setError(false); loadReports(); }} style={{ marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: COLORS.primary, borderRadius: 8 }}>
          <Text style={{ color: '#FFF', fontWeight: '600' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        <FlatList
          data={tabs}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(t) => t.key}
          contentContainerStyle={styles.tabContent}
          renderItem={({ item: tab }) => (
            <TouchableOpacity
              style={[styles.tab, activeTab === tab.key && styles.activeTab]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
                {tab.label} ({tab.count})
              </Text>
            </TouchableOpacity>
          )}
        />

        <View style={styles.scopeFilterRow}>
          <TouchableOpacity
            style={[styles.scopeFilterChip, showOrderOnly && styles.scopeFilterChipActive]}
            onPress={() => setShowOrderOnly((prev) => !prev)}
          >
            <Ionicons
              name="receipt-outline"
              size={13}
              color={showOrderOnly ? '#FFF' : COLORS.textSecondary}
            />
            <Text style={[styles.scopeFilterText, showOrderOnly && styles.scopeFilterTextActive]}>
              Order Disputes Only
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.scopeFilterChip, showWithProofOnly && styles.scopeFilterChipActive]}
            onPress={() => setShowWithProofOnly((prev) => !prev)}
          >
            <Ionicons
              name="attach-outline"
              size={13}
              color={showWithProofOnly ? '#FFF' : COLORS.textSecondary}
            />
            <Text style={[styles.scopeFilterText, showWithProofOnly && styles.scopeFilterTextActive]}>
              With Proof Only
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={filtered}
        renderItem={renderReportCard}
        keyExtractor={(item) => item.$id}
        contentContainerStyle={[styles.listContent, { paddingBottom: tabBarHeight }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="flag-outline" size={60} color={COLORS.textTertiary} />
            <Text style={styles.emptyTitle}>No {activeTab} {showOrderOnly ? 'order dispute' : 'reports'}</Text>
            <Text style={styles.emptySubtext}>Everything looks good!</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  tabBar: { backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tabContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  scopeFilterRow: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  scopeFilterChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  scopeFilterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  scopeFilterText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  scopeFilterTextActive: {
    color: '#FFF',
  },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: COLORS.card },
  activeTab: { backgroundColor: COLORS.primary },
  tabText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  activeTabText: { color: '#FFF', fontWeight: '700' },
  listContent: { padding: 16 },
  card: {
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
  triageBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  triageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: `${COLORS.primary}35`,
    backgroundColor: `${COLORS.primary}10`,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  triageBtnText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  entityIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: { flex: 1, marginLeft: 12 },
  reason: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  entityType: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '700' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  metaText: { fontSize: 11, color: COLORS.textTertiary },
  historyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.card,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  historyText: { flex: 1, fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  resolutionBox: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  resolutionLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 2 },
  resolutionText: { fontSize: 13, color: COLORS.text },
  detailBox: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  detailRow: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 },
  detailKey: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  detailText: { fontSize: 13, color: COLORS.text, marginTop: 4, lineHeight: 18 },
  proofLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  proofLink: { flex: 1, color: COLORS.info, fontSize: 12, fontWeight: '600' },
  entityActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  openEntityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: `${COLORS.primary}35`,
    backgroundColor: `${COLORS.primary}10`,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  openEntityText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  actionText: { fontSize: 12, fontWeight: '600' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text, marginTop: 16 },
  emptySubtext: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
});

export default AdminReportsScreen;
