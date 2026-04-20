import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { showAlert } from '../../utils/alert';
import { PremiumTopBar } from '../../components/PremiumTopBar';

const BuyerSettingsScreen = ({ navigation }: any) => {
  const [orderUpdates, setOrderUpdates] = useState(true);
  const [offerAlerts, setOfferAlerts] = useState(true);
  const [locationDiscovery, setLocationDiscovery] = useState(true);
  const enabledCount = [orderUpdates, offerAlerts, locationDiscovery].filter(Boolean).length;

  return (
    <View style={styles.container}>
      <PremiumTopBar
        title="Settings"
        subtitle="Control notifications, discovery, and privacy"
        icon="settings-outline"
        showBack={navigation?.canGoBack?.()}
        onBack={() => navigation?.goBack?.()}
      />

      <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>Preferences Overview</Text>
        <Text style={styles.heroSubtitle}>Tune how GramBazaar alerts and discovery work for you</Text>
        <View style={styles.heroPill}>
          <Text style={styles.heroPillText}>{enabledCount} of 3 options enabled</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>

        <View style={styles.row}>
          <View style={styles.rowLabelWrap}>
            <Text style={styles.rowTitle}>Order updates</Text>
            <Text style={styles.rowSubtitle}>Get status updates for your orders</Text>
          </View>
          <Switch value={orderUpdates} onValueChange={setOrderUpdates} trackColor={{ true: COLORS.primary }} />
        </View>

        <View style={styles.row}>
          <View style={styles.rowLabelWrap}>
            <Text style={styles.rowTitle}>Offers and new arrivals</Text>
            <Text style={styles.rowSubtitle}>Regional deals and new artisan products</Text>
          </View>
          <Switch value={offerAlerts} onValueChange={setOfferAlerts} trackColor={{ true: COLORS.primary }} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Discovery</Text>
        <View style={styles.row}>
          <View style={styles.rowLabelWrap}>
            <Text style={styles.rowTitle}>Auto region discovery</Text>
            <Text style={styles.rowSubtitle}>Use location for nearby artisan discovery</Text>
          </View>
          <Switch value={locationDiscovery} onValueChange={setLocationDiscovery} trackColor={{ true: COLORS.primary }} />
        </View>
      </View>

      <View style={styles.section}>
        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => showAlert('Help & Support', 'Contact support@grambazaar.app for account help.')}
        >
          <Ionicons name="help-circle-outline" size={20} color={COLORS.textSecondary} />
          <Text style={styles.actionText}>Help & Support</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => showAlert('Privacy', 'Privacy controls will be available in a future update.')}
        >
          <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.textSecondary} />
          <Text style={styles.actionText}>Privacy</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} />
        </TouchableOpacity>
      </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 12, paddingBottom: 28 },
  heroCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${COLORS.primary}24`,
    backgroundColor: `${COLORS.primary}10`,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },
  heroSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  heroPill: {
    marginTop: 8,
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: `${COLORS.primary}44`,
    backgroundColor: `${COLORS.primary}18`,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  section: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
    paddingHorizontal: 12,
    paddingTop: 13,
    paddingBottom: 8,
  },
  row: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  rowLabelWrap: {
    flex: 1,
    paddingRight: 10,
  },
  rowTitle: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '700',
  },
  rowSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  actionRow: {
    paddingHorizontal: 12,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
  },
});

export default BuyerSettingsScreen;
