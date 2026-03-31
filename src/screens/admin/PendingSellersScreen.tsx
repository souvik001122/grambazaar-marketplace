import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { getAllSellers, createAdminLog, blockSeller } from '../../services/adminService';
import { verifySeller } from '../../services/sellerService';
import { Seller } from '../../types/seller.types';
import { COLORS } from '../../constants/colors';
import { showAlert } from '../../utils/alert';

type FilterTab = 'pending' | 'approved' | 'rejected' | 'blocked' | 'all';

const AdminSellersScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('pending');
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const loadSellers = async () => {
    try {
      const all = await getAllSellers();
      setSellers(all as unknown as Seller[]);
      setError(false);
    } catch (error) {
      console.error('Error loading sellers:', error);
      setError(true);
      if (!refreshing) showAlert('Error', 'Failed to load sellers.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadSellers(); }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadSellers();
  }, []);

  const filteredSellers = sellers.filter(s => {
    if (activeTab === 'all') return true;
    return s.verificationStatus === activeTab;
  });

  const handleApprove = (seller: Seller) => {
    showAlert('Approve Seller', `Approve "${seller.businessName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        onPress: async () => {
          setProcessing(seller.$id);
          try {
            await verifySeller({ sellerId: seller.$id, status: 'approved', adminId: user!.$id });
            await createAdminLog(user!.$id, 'approve_seller', 'seller', seller.$id, seller.businessName);
            showAlert('Success', 'Seller approved successfully!');
            loadSellers();
          } catch {
            showAlert('Error', 'Failed to approve seller.');
          } finally {
            setProcessing(null);
          }
        },
      },
    ]);
  };

  const handleReject = (seller: Seller) => {
    showAlert('Reject Seller', `Reject "${seller.businessName}"? The seller will be notified.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          setProcessing(seller.$id);
          try {
            await verifySeller({ sellerId: seller.$id, status: 'rejected', reason: 'Does not meet requirements', adminId: user!.$id });
            await createAdminLog(user!.$id, 'reject_seller', 'seller', seller.$id, seller.businessName);
            showAlert('Done', 'Seller has been rejected.');
            loadSellers();
          } catch {
            showAlert('Error', 'Failed to reject seller.');
          } finally {
            setProcessing(null);
          }
        },
      },
    ]);
  };

  const handleBlock = (seller: Seller) => {
    const isBlocked = seller.verificationStatus === 'blocked';
    showAlert(
      isBlocked ? 'Unblock Seller' : 'Block Seller',
      isBlocked ? `Unblock "${seller.businessName}"?` : `Block "${seller.businessName}"? They won't be able to sell.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isBlocked ? 'Unblock' : 'Block',
          style: isBlocked ? 'default' : 'destructive',
          onPress: async () => {
            setProcessing(seller.$id);
            try {
              await blockSeller(seller.$id, !isBlocked, user!.$id);
              showAlert('Done', isBlocked ? 'Seller unblocked.' : 'Seller blocked.');
              loadSellers();
            } catch {
              showAlert('Error', 'Failed to update seller status.');
            } finally {
              setProcessing(null);
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return COLORS.success;
      case 'pending': return COLORS.warning;
      case 'rejected': return COLORS.error;
      case 'blocked': return '#78716C';
      default: return COLORS.textSecondary;
    }
  };

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'pending', label: 'Pending', count: sellers.filter(s => s.verificationStatus === 'pending').length },
    { key: 'approved', label: 'Approved', count: sellers.filter(s => s.verificationStatus === 'approved').length },
    { key: 'rejected', label: 'Rejected', count: sellers.filter(s => s.verificationStatus === 'rejected').length },
    { key: 'blocked', label: 'Blocked', count: sellers.filter(s => s.verificationStatus === 'blocked').length },
    { key: 'all', label: 'All', count: sellers.length },
  ];

  const renderSellerCard = ({ item }: { item: Seller }) => {
    const isProcessing = processing === item.$id;
    const locality = item.village || '';
    const district = item.district || item.city || '';
    const state = item.state || item.region || '';
    const locationLabel = [locality, district, state].filter(Boolean).join(', ');
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('AdminSellerDetail', { seller: item })}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          {item.verificationDocuments?.[0] ? (
            <Image source={{ uri: item.verificationDocuments[0] }} style={styles.shopImage} resizeMode="cover" />
          ) : (
            <View style={[styles.shopImage, styles.placeholderImage]}>
              <Ionicons name="storefront" size={24} color={COLORS.textTertiary} />
            </View>
          )}
          <View style={styles.cardInfo}>
            <Text style={styles.businessName} numberOfLines={1}>{item.businessName}</Text>
            <Text style={styles.craftType}>{item.craftType}</Text>
            <Text style={styles.location}>
              <Ionicons name="location-outline" size={12} color={COLORS.textSecondary} />
              {' '}{locationLabel || [item.city, item.state].filter(Boolean).join(', ') || 'Location not set'}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.verificationStatus) + '18' }]}>
            <Text style={[styles.statusText, { color: getStatusColor(item.verificationStatus) }]}>
              {(item.verificationStatus || 'unknown').charAt(0).toUpperCase() + (item.verificationStatus || 'unknown').slice(1)}
            </Text>
          </View>
        </View>

        <Text style={styles.addressPreview} numberOfLines={1}>
          Address line: {item.address || 'Not provided'}
        </Text>
        <Text style={styles.description} numberOfLines={2}>{item.description}</Text>

        {/* Action Buttons */}
        <View style={styles.actions}>
          {item.verificationStatus === 'pending' && (
            <>
              <TouchableOpacity
                style={[styles.actionBtn, styles.approveBtn]}
                onPress={() => handleApprove(item)}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={16} color="#FFF" />
                    <Text style={styles.actionBtnTextLight}> Approve</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.rejectBtn]}
                onPress={() => handleReject(item)}
                disabled={isProcessing}
              >
                <Ionicons name="close" size={16} color={COLORS.error} />
                <Text style={[styles.actionBtnText, { color: COLORS.error }]}> Reject</Text>
              </TouchableOpacity>
            </>
          )}
          {(item.verificationStatus === 'approved' || item.verificationStatus === 'blocked') && (
            <TouchableOpacity
              style={[styles.actionBtn, item.verificationStatus === 'blocked' ? styles.approveBtn : styles.blockBtn]}
              onPress={() => handleBlock(item)}
              disabled={isProcessing}
            >
              <Ionicons
                name={item.verificationStatus === 'blocked' ? 'lock-open' : 'ban'}
                size={16}
                color={item.verificationStatus === 'blocked' ? '#FFF' : '#78716C'}
              />
              <Text style={item.verificationStatus === 'blocked' ? styles.actionBtnTextLight : [styles.actionBtnText, { color: '#78716C' }]}>
                {' '}{item.verificationStatus === 'blocked' ? 'Unblock' : 'Block'}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionBtn, styles.detailBtn]}
            onPress={() => navigation.navigate('AdminSellerDetail', { seller: item })}
          >
            <Ionicons name="eye-outline" size={16} color={COLORS.info} />
            <Text style={[styles.actionBtnText, { color: COLORS.info }]}> Details</Text>
          </TouchableOpacity>
        </View>
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

  if (error && sellers.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="cloud-offline-outline" size={60} color={COLORS.textTertiary} />
        <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.text, marginTop: 16 }}>Failed to load sellers</Text>
        <TouchableOpacity onPress={() => { setLoading(true); setError(false); loadSellers(); }} style={{ marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: COLORS.primary, borderRadius: 8 }}>
          <Text style={{ color: '#FFF', fontWeight: '600' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.screenHeader}>
        <Ionicons name="people" size={22} color="#FFF" />
        <Text style={styles.screenHeaderTitle}>Sellers</Text>
      </View>
      {/* Filter Tabs */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
              {tab.label}
            </Text>
            {tab.count > 0 && (
              <View style={[styles.tabBadge, activeTab === tab.key && styles.activeTabBadge]}>
                <Text style={[styles.tabBadgeText, activeTab === tab.key && styles.activeTabBadgeText]}>
                  {tab.count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredSellers}
        renderItem={renderSellerCard}
        keyExtractor={(item) => item.$id}
        contentContainerStyle={[styles.listContent, { paddingBottom: 16 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={60} color={COLORS.textTertiary} />
            <Text style={styles.emptyTitle}>No {activeTab} sellers</Text>
            <Text style={styles.emptySubtext}>
              {activeTab === 'pending' ? 'No seller applications to review' : `No sellers with "${activeTab}" status`}
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  screenHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 14,
  },
  screenHeaderTitle: { fontSize: 20, fontWeight: '700', color: '#FFF' },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    marginHorizontal: 2,
  },
  activeTab: {
    backgroundColor: COLORS.primary + '15',
  },
  tabText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  activeTabText: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  tabBadge: {
    backgroundColor: COLORS.border,
    borderRadius: 8,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
    paddingHorizontal: 4,
  },
  activeTabBadge: {
    backgroundColor: COLORS.primary,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  activeTabBadgeText: {
    color: '#FFF',
  },
  listContent: {
    padding: 16,
  },
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  shopImage: {
    width: 50,
    height: 50,
    borderRadius: 12,
  },
  placeholderImage: {
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  businessName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  craftType: {
    fontSize: 13,
    color: COLORS.primary,
    marginTop: 1,
  },
  location: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  phone: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  addressPreview: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 6,
    fontWeight: '500',
  },
  description: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  approveBtn: {
    backgroundColor: COLORS.success,
  },
  rejectBtn: {
    backgroundColor: COLORS.error + '12',
    borderWidth: 1,
    borderColor: COLORS.error + '30',
  },
  blockBtn: {
    backgroundColor: '#78716C12',
    borderWidth: 1,
    borderColor: '#78716C30',
  },
  detailBtn: {
    backgroundColor: COLORS.info + '12',
    borderWidth: 1,
    borderColor: COLORS.info + '30',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  actionBtnTextLight: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
});

export default AdminSellersScreen;
