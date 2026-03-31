import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { getAllUsers, createAdminLog } from '../../services/adminService';
import { updateUserRole } from '../../services/userService';
import { User, UserRole } from '../../types/index';
import { COLORS } from '../../constants/colors';
import { showAlert } from '../../utils/alert';

type FilterTab = 'all' | 'buyer' | 'seller' | 'admin';

const AdminUsersScreen = () => {
  const tabBarHeight = 16;
  const { user: adminUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const loadUsers = async () => {
    try {
      const all = await getAllUsers();
      setUsers(all as unknown as User[]);
      setError(false);
    } catch (error) {
      console.error('Error loading users:', error);
      setError(true);
      if (!refreshing) showAlert('Error', 'Failed to load users.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadUsers();
  }, []);

  const filtered = users.filter(u => {
    if (activeTab !== 'all' && u.role !== activeTab) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.phone?.includes(q)
      );
    }
    return true;
  });

  const executeRoleChange = async (targetUser: User, role: UserRole) => {
    setProcessing(targetUser.$id);
    try {
      await updateUserRole(targetUser.$id, role);
      await createAdminLog(adminUser!.$id, 'change_user_role', 'user', targetUser.$id, `Changed role to ${role}`);
      showAlert('Done', `${targetUser.name || 'User'} is now a ${role}.`);
      loadUsers();
    } catch {
      showAlert('Error', 'Failed to change role.');
    } finally {
      setProcessing(null);
    }
  };

  const handleChangeRole = (targetUser: User) => {
    if (targetUser.$id === adminUser?.$id) {
      showAlert('Error', 'You cannot change your own role.');
      return;
    }
    const roles: UserRole[] = ['buyer', 'seller', 'admin'];
    const available = roles.filter(r => r !== targetUser.role);
    showAlert('Change Role', `Change ${targetUser.name || 'this user'}'s role from "${targetUser.role}"?`, [
      { text: 'Cancel', style: 'cancel' },
      ...available.map(role => ({
        text: role.charAt(0).toUpperCase() + role.slice(1),
        style: role === 'admin' ? ('destructive' as const) : ('default' as const),
        onPress: async () => {
          // Extra confirmation for admin escalation
          if (role === 'admin') {
            showAlert(
              'Confirm Admin Access',
              `Granting admin privileges to ${targetUser.name || 'this user'} is irreversible from their account. Continue?`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Grant Admin',
                  style: 'destructive',
                  onPress: () => executeRoleChange(targetUser, role),
                },
              ]
            );
            return;
          }
          executeRoleChange(targetUser, role);
        },
      })),
    ]);
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return COLORS.error;
      case 'seller': return COLORS.info;
      case 'buyer': return COLORS.success;
      default: return COLORS.textSecondary;
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return 'shield-checkmark';
      case 'seller': return 'storefront';
      case 'buyer': return 'person';
      default: return 'person-outline';
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const tabs: { key: FilterTab; label: string; count: number; icon: string }[] = [
    { key: 'all', label: 'All', count: users.length, icon: 'people' },
    { key: 'buyer', label: 'Buyers', count: users.filter(u => u.role === 'buyer').length, icon: 'person' },
    { key: 'seller', label: 'Sellers', count: users.filter(u => u.role === 'seller').length, icon: 'storefront' },
    { key: 'admin', label: 'Admins', count: users.filter(u => u.role === 'admin').length, icon: 'shield-checkmark' },
  ];

  const renderUserCard = ({ item }: { item: User }) => {
    const isProcessing = processing === item.$id;
    const isSelf = item.$id === adminUser?.$id;
    return (
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <View style={[styles.avatar, { backgroundColor: getRoleColor(item.role) + '18' }]}>
            <Ionicons name={getRoleIcon(item.role) as any} size={22} color={getRoleColor(item.role)} />
          </View>
          <View style={styles.cardInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
              {isSelf && <Text style={styles.youBadge}>You</Text>}
            </View>
            <Text style={styles.email} numberOfLines={1}>{item.email}</Text>
            {item.phone ? <Text style={styles.phone}>{item.phone}</Text> : null}
          </View>
          <View style={[styles.roleBadge, { backgroundColor: getRoleColor(item.role) + '15' }]}>
            <Text style={[styles.roleText, { color: getRoleColor(item.role) }]}>
              {item.role?.charAt(0).toUpperCase() + item.role?.slice(1)}
            </Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>
            <Ionicons name="calendar-outline" size={11} color={COLORS.textTertiary} /> Joined {formatDate(item.createdAt)}
          </Text>
          <Text style={styles.metaText}>ID: {item.$id?.substring(0, 10)}...</Text>
        </View>

        {!isSelf && (
          <TouchableOpacity
            style={styles.changeRoleBtn}
            onPress={() => handleChangeRole(item)}
            disabled={isProcessing}
          >
            {isProcessing ? <ActivityIndicator size="small" color={COLORS.primary} /> : (
              <>
                <Ionicons name="swap-horizontal-outline" size={14} color={COLORS.primary} />
                <Text style={styles.changeRoleBtnText}> Change Role</Text>
              </>
            )}
          </TouchableOpacity>
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

  if (error && users.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="cloud-offline-outline" size={60} color={COLORS.textTertiary} />
        <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.text, marginTop: 16 }}>Failed to load users</Text>
        <TouchableOpacity onPress={() => { setLoading(true); setError(false); loadUsers(); }} style={{ marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: COLORS.primary, borderRadius: 8 }}>
          <Text style={{ color: '#FFF', fontWeight: '600' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={COLORS.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, email, phone..."
          placeholderTextColor={COLORS.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={COLORS.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons
              name={tab.icon as any}
              size={14}
              color={activeTab === tab.key ? '#FFF' : COLORS.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
              {' '}{tab.label} ({tab.count})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        renderItem={renderUserCard}
        keyExtractor={(item) => item.$id}
        contentContainerStyle={[styles.listContent, { paddingBottom: tabBarHeight }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={60} color={COLORS.textTertiary} />
            <Text style={styles.emptyTitle}>No users found</Text>
            <Text style={styles.emptySubtext}>
              {search ? 'Try a different search term' : 'No users in this category'}
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    margin: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: COLORS.text },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 6,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: COLORS.card,
  },
  activeTab: { backgroundColor: COLORS.primary },
  tabText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '500' },
  activeTabText: { color: '#FFF', fontWeight: '700' },
  listContent: { padding: 16, paddingTop: 8 },
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
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: { flex: 1, marginLeft: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  youBadge: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.primary,
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  email: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  phone: { fontSize: 12, color: COLORS.textTertiary, marginTop: 1 },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  roleText: { fontSize: 11, fontWeight: '700' },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  metaText: { fontSize: 11, color: COLORS.textTertiary },
  changeRoleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.primary + '10',
  },
  changeRoleBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text, marginTop: 16 },
  emptySubtext: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
});

export default AdminUsersScreen;
