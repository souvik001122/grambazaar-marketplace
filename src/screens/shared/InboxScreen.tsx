import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { getInbox, Conversation } from '../../services/chatService';
import { COLORS } from '../../constants/colors';
import { PremiumTopBar } from '../../components/PremiumTopBar';

const InboxScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadInbox = async (showLoadingIndicator = true) => {
    if (!user?.$id) return;
    if (showLoadingIndicator) setLoading(true);
    
    try {
      const inboxList = await getInbox(user.$id);
      setConversations(inboxList);
    } catch (error) {
      console.error('Error fetching inbox conversations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadInbox();
    
    // Refresh inbox periodically or on focus
    const unsubscribe = navigation.addListener?.('focus', () => {
      loadInbox(false);
    });

    return unsubscribe;
  }, [navigation, user?.$id]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadInbox(false);
  }, [user?.$id]);

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      
      // If today, show time
      if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      
      // If yesterday, show 'Yesterday'
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
      }
      
      // Otherwise show date
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const handleConversationPress = (conv: Conversation) => {
    navigation.navigate('Chat', {
      otherParticipantId: conv.otherParticipantId,
      otherParticipantName: conv.otherParticipantName,
      otherParticipantRole: conv.otherParticipantRole,
      productId: conv.productId,
    });
  };

  const renderConversationItem = ({ item }: { item: Conversation }) => {
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handleConversationPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.otherParticipantName.charAt(0).toUpperCase()}
          </Text>
        </View>

        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={styles.name} numberOfLines={1}>
              {item.otherParticipantName}
            </Text>
            <Text style={styles.time}>
              {formatTime(item.lastMessageTime)}
            </Text>
          </View>

          <View style={styles.cardBody}>
            <Text style={styles.lastMessage} numberOfLines={1}>
              {item.lastMessage}
            </Text>
            <View style={[styles.roleBadge, item.otherParticipantRole === 'seller' ? styles.roleBadgeSeller : styles.roleBadgeBuyer]}>
              <Text style={styles.roleBadgeText}>
                {item.otherParticipantRole === 'seller' ? 'Artisan' : 'Buyer'}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <PremiumTopBar
        title="Messages"
        subtitle="Chat directly with buyers and sellers"
        icon="chatbubbles-outline"
        showBack={navigation?.canGoBack?.()}
        onBack={() => navigation?.goBack?.()}
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderConversationItem}
          keyExtractor={(item) => item.otherParticipantId}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubble-ellipses-outline" size={60} color={COLORS.textTertiary} />
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptySubtitle}>
                Conversations will appear here when you message a seller or receive inquiries.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
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
  },
  listContainer: {
    padding: 16,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  cardContent: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
    marginRight: 8,
  },
  time: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 13,
    color: COLORS.textSecondary,
    flex: 1,
    marginRight: 12,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleBadgeSeller: {
    backgroundColor: COLORS.primary + '12',
  },
  roleBadgeBuyer: {
    backgroundColor: COLORS.secondary + '12',
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
});

export default InboxScreen;
