import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text, Card, Button, useTheme, Chip, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing } from '../../src/config/theme';
import { sellerService, Seller } from '../../src/services/sellerService';
import { showAlert } from '../../src/utils/alert';

export default function AdminSellersScreen() {
  const theme = useTheme();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadSellers = async () => {
    try {
      const pendingSellers = await sellerService.getPendingSellers();
      setSellers(pendingSellers);
    } catch (error) {
      console.error('Error loading sellers:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadSellers();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadSellers();
  };

  const handleApprove = async (sellerId: string) => {
    showAlert(
      'Approve Seller',
      'Are you sure you want to approve this seller?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            setProcessingId(sellerId);
            const success = await sellerService.approveSeller(sellerId);
            setProcessingId(null);
            
            if (success) {
              showAlert('Success', 'Seller approved successfully');
              loadSellers();
            } else {
              showAlert('Error', 'Failed to approve seller');
            }
          },
        },
      ]
    );
  };

  const handleReject = async (sellerId: string) => {
    showAlert(
      'Reject Seller',
      'Are you sure you want to reject this seller?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setProcessingId(sellerId);
            const success = await sellerService.rejectSeller(sellerId);
            setProcessingId(null);
            
            if (success) {
              showAlert('Success', 'Seller rejected');
              loadSellers();
            } else {
              showAlert('Error', 'Failed to reject seller');
            }
          },
        },
      ]
    );
  };

  const renderSellerCard = ({ item }: { item: Seller }) => {
    const isProcessing = processingId === item.$id;

    return (
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <Text variant="titleMedium" style={styles.businessName}>
              {item.businessName}
            </Text>
            <Chip mode="outlined" style={styles.statusChip}>
              {item.verificationStatus}
            </Chip>
          </View>

          <Text variant="bodyMedium" style={styles.description}>
            {item.description}
          </Text>

          <View style={styles.infoRow}>
            <Text variant="bodySmall" style={styles.label}>Craft Type:</Text>
            <Text variant="bodySmall">{item.craftType}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text variant="bodySmall" style={styles.label}>Location:</Text>
            <Text variant="bodySmall">{item.city}, {item.state}, {item.region}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text variant="bodySmall" style={styles.label}>Address:</Text>
            <Text variant="bodySmall">{item.address}</Text>
          </View>

          <View style={styles.buttonRow}>
            <Button
              mode="contained"
              onPress={() => handleApprove(item.$id)}
              disabled={isProcessing}
              style={styles.approveButton}
              buttonColor={theme.colors.primary}
            >
              {isProcessing ? 'Processing...' : 'Approve'}
            </Button>
            <Button
              mode="outlined"
              onPress={() => handleReject(item.$id)}
              disabled={isProcessing}
              style={styles.rejectButton}
              textColor={theme.colors.error}
            >
              Reject
            </Button>
          </View>
        </Card.Content>
      </Card>
    );
  };

  if (loading) {
    return (
      <SafeAreaView edges={[]} style={[styles.container, { backgroundColor: theme.colors.background }]}> 
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={[]} style={[styles.container, { backgroundColor: theme.colors.background }]}> 
      <View style={styles.header}>
        <Text variant="headlineMedium">Seller Verifications</Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          {sellers.length} pending verification{sellers.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <FlatList
        data={sellers}
        renderItem={renderSellerCard}
        keyExtractor={(item) => item.$id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text variant="bodyLarge" style={styles.emptyText}>
              No pending seller verifications
            </Text>
            <Text variant="bodyMedium" style={styles.emptySubtext}>
              All sellers have been verified
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  subtitle: {
    marginTop: spacing.xs,
    opacity: 0.7,
  },
  listContent: {
    padding: spacing.md,
  },
  card: {
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  businessName: {
    flex: 1,
    fontWeight: 'bold',
  },
  statusChip: {
    marginLeft: spacing.sm,
  },
  description: {
    marginBottom: spacing.md,
    color: '#666',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  label: {
    fontWeight: 'bold',
    marginRight: spacing.xs,
    minWidth: 80,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  approveButton: {
    flex: 1,
  },
  rejectButton: {
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyText: {
    fontWeight: 'bold',
    marginBottom: spacing.xs,
  },
  emptySubtext: {
    opacity: 0.6,
  },
});
