import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  FlatList,
  Pressable,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '../../context/AuthContext';
import { createSeller, getSellerByUserId } from '../../services/sellerService';
import { uploadFile } from '../../services/storageService';
import { CRAFT_TYPES } from '../../constants/categories';
import { INDIAN_STATES } from '../../constants/regions';
import { COLORS } from '../../constants/colors';
import { showAlert } from '../../utils/alert';
import {
  getRealDistrictsByState,
  getRealIndianStates,
  searchRealLocalitiesByDistrictQuery,
  type RealLocalityOption,
} from '../../services/locationDataService';
import {
  normalizePhone,
  validateAddress,
  validateLatitude,
  validateLocation,
  validateLongitude,
  validatePhone,
  validateShopName,
  validateSkills,
} from '../../utils/validation';

type PickedDocument = {
  uri: string;
  name?: string;
  mimeType?: string;
};

type SelectorMode = 'craft' | 'state' | 'district' | 'locality' | null;

type SelectorItem = {
  key: string;
  label: string;
  value: string;
  subtitle?: string;
  pincode?: string;
};

const FALLBACK_STATES = INDIAN_STATES.map((state) => state.name).sort((a, b) =>
  a.localeCompare(b, 'en-IN', { sensitivity: 'base' })
);

const LOCALITY_RESULT_LIMIT = 200;
const LOCALITY_PIN_LENGTH = 6;
const LOCALITY_MIN_TEXT_QUERY = 3;

const normalizeLoose = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

type PickerOptionRowProps = {
  item: SelectorItem;
  isSelected: boolean;
  onPress: (item: SelectorItem) => void;
};

const PickerOptionRow = memo(({ item, isSelected, onPress }: PickerOptionRowProps) => {
  return (
    <TouchableOpacity
      style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
      onPress={() => onPress(item)}
      activeOpacity={0.82}
    >
      <View style={styles.localitySuggestionTextWrap}>
        <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextSelected]} numberOfLines={1}>
          {item.label}
        </Text>
        {!!item.subtitle && <Text style={styles.localityMetaText}>{item.subtitle}</Text>}
      </View>
      {isSelected ? <Ionicons name="checkmark" size={16} color={COLORS.primary} /> : null}
    </TouchableOpacity>
  );
});

PickerOptionRow.displayName = 'PickerOptionRow';

export const BecomeSellerScreen = ({ onProfileCreated }: any) => {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingLocalities, setLoadingLocalities] = useState(false);
  const [realStatesLoaded, setRealStatesLoaded] = useState(false);

  const [selectorMode, setSelectorMode] = useState<SelectorMode>(null);
  const [selectorQuery, setSelectorQuery] = useState('');

  const [formData, setFormData] = useState({
    shopName: '',
    craftType: '',
    skills: '',
    phone: user?.phone || '',
    address: '',
    state: '',
    district: '',
    locality: '',
    localityPincode: '',
    latitude: '',
    longitude: '',
  });

  const [stateOptions, setStateOptions] = useState<string[]>(FALLBACK_STATES);
  const [districtOptions, setDistrictOptions] = useState<string[]>([]);
  const [localityOptions, setLocalityOptions] = useState<RealLocalityOption[]>([]);
  const localityRequestRef = useRef(0);

  const [shopPhoto, setShopPhoto] = useState<string | null>(null);
  const [idProof, setIdProof] = useState<PickedDocument | null>(null);
  const verificationReady = !!shopPhoto && !!idProof;
  const verificationCount = (shopPhoto ? 1 : 0) + (idProof ? 1 : 0);

  const normalizedAccountPhone = normalizePhone(user?.phone || '');
  const lockPhoneField = validatePhone(normalizedAccountPhone);

  const selectedLocalityLabel = useMemo(() => {
    if (!formData.locality) {
      return '';
    }

    if (!formData.localityPincode) {
      return formData.locality;
    }

    return `${formData.locality} (${formData.localityPincode})`;
  }, [formData.locality, formData.localityPincode]);

  const selectorTitle = useMemo(() => {
    switch (selectorMode) {
      case 'craft':
        return 'Select Craft Type';
      case 'state':
        return 'Select State';
      case 'district':
        return 'Select District';
      case 'locality':
        return 'Select Village / Locality';
      default:
        return '';
    }
  }, [selectorMode]);

  const selectorPlaceholder = useMemo(() => {
    switch (selectorMode) {
      case 'craft':
        return 'Search craft type';
      case 'state':
        return 'Search state';
      case 'district':
        return 'Search district';
      case 'locality':
        return 'Search locality or pincode';
      default:
        return 'Search';
    }
  }, [selectorMode]);

  const selectorMetaText = useMemo(() => {
    if (selectorMode === 'locality') {
      return loadingLocalities
        ? 'Searching India Post records...'
        : `Type ${LOCALITY_PIN_LENGTH}-digit PIN or ${LOCALITY_MIN_TEXT_QUERY}+ letters to load localities.`;
    }

    if (selectorMode === 'district') {
      return `${districtOptions.length} districts available`;
    }

    if (selectorMode === 'state') {
      return `${stateOptions.length} states available`;
    }

    if (selectorMode === 'craft') {
      return `${CRAFT_TYPES.length} craft categories available`;
    }

    return '';
  }, [districtOptions.length, loadingLocalities, selectorMode, stateOptions.length]);

  const selectorItems = useMemo((): SelectorItem[] => {
    const query = selectorQuery.trim();
    const queryNorm = normalizeLoose(query);

    if (selectorMode === 'craft') {
      const base = CRAFT_TYPES.map((item) => ({ key: item, label: item, value: item }));
      if (!queryNorm) {
        return base;
      }
      return base.filter((item) => normalizeLoose(item.label).includes(queryNorm));
    }

    if (selectorMode === 'state') {
      const base = stateOptions.map((item) => ({ key: item, label: item, value: item }));
      if (!queryNorm) {
        return base;
      }
      return base.filter((item) => normalizeLoose(item.label).includes(queryNorm));
    }

    if (selectorMode === 'district') {
      const base = districtOptions.map((item) => ({ key: item, label: item, value: item }));
      if (!queryNorm) {
        return base;
      }
      return base.filter((item) => normalizeLoose(item.label).includes(queryNorm));
    }

    if (selectorMode === 'locality') {
      if (!query) {
        return [];
      }

      const isNumericQuery = /^\d+$/.test(query);
      if (isNumericQuery && query.length !== LOCALITY_PIN_LENGTH) {
        return [];
      }

      if (!isNumericQuery && queryNorm.length < LOCALITY_MIN_TEXT_QUERY) {
        return [];
      }

      return localityOptions.slice(0, LOCALITY_RESULT_LIMIT).map((item) => ({
        key: `${item.name}-${item.pincode}`,
        label: `${item.name} (${item.pincode})`,
        value: item.name,
        subtitle: item.division,
        pincode: item.pincode,
      }));
    }

    return [];
  }, [districtOptions, localityOptions, selectorMode, selectorQuery, stateOptions]);

  const localityEmptyMessage = useMemo(() => {
    if (selectorMode !== 'locality') {
      return 'No result found. Try a different search.';
    }

    const query = selectorQuery.trim();
    if (!query) {
      return `Type village name (${LOCALITY_MIN_TEXT_QUERY}+ letters) or enter ${LOCALITY_PIN_LENGTH}-digit PIN.`;
    }

    if (/^\d+$/.test(query)) {
      if (query.length < LOCALITY_PIN_LENGTH) {
        return `Enter full ${LOCALITY_PIN_LENGTH}-digit PIN to load villages.`;
      }

      if (query.length > LOCALITY_PIN_LENGTH) {
        return `PIN must be exactly ${LOCALITY_PIN_LENGTH} digits.`;
      }
    }

    if (normalizeLoose(query).length < LOCALITY_MIN_TEXT_QUERY) {
      return `Type at least ${LOCALITY_MIN_TEXT_QUERY} letters of village/locality.`;
    }

    return 'No matching locality found. Try another PIN or village name.';
  }, [selectorMode, selectorQuery]);

  const ensureRealStatesLoaded = useCallback(async () => {
    if (realStatesLoaded) {
      return;
    }

    setLoadingStates(true);
    try {
      const realStates = await getRealIndianStates();
      if (realStates.length > 0) {
        setStateOptions(realStates);
      }
    } catch {
      setStateOptions(FALLBACK_STATES);
    } finally {
      setLoadingStates(false);
      setRealStatesLoaded(true);
    }
  }, [realStatesLoaded]);

  useEffect(() => {
    let active = true;

    const loadDistricts = async () => {
      if (!formData.state) {
        localityRequestRef.current += 1;
        setDistrictOptions([]);
        setLocalityOptions([]);
        return;
      }

      setLoadingDistricts(true);
      try {
        const districts = await getRealDistrictsByState(formData.state);
        if (!active) {
          return;
        }

        setDistrictOptions(districts);
      } catch {
        if (active) {
          localityRequestRef.current += 1;
          setDistrictOptions([]);
          setLocalityOptions([]);
        }
      } finally {
        if (active) {
          setLoadingDistricts(false);
        }
      }
    };

    loadDistricts();

    return () => {
      active = false;
    };
  }, [formData.state]);

  useEffect(() => {
    if (selectorMode !== 'locality') {
      setLoadingLocalities(false);
      return;
    }

    if (!formData.state || !formData.district) {
      setLocalityOptions([]);
      setLoadingLocalities(false);
      return;
    }

    const query = selectorQuery.trim();
    const isNumericQuery = /^\d+$/.test(query);
    const queryNorm = normalizeLoose(query);

    if (!query) {
      setLocalityOptions([]);
      setLoadingLocalities(false);
      return;
    }

    if (isNumericQuery && query.length !== LOCALITY_PIN_LENGTH) {
      setLocalityOptions([]);
      setLoadingLocalities(false);
      return;
    }

    if (!isNumericQuery && queryNorm.length < LOCALITY_MIN_TEXT_QUERY) {
      setLocalityOptions([]);
      setLoadingLocalities(false);
      return;
    }

    const requestId = localityRequestRef.current + 1;
    localityRequestRef.current = requestId;
    setLoadingLocalities(true);

    const timer = setTimeout(async () => {
      try {
        const localities = await searchRealLocalitiesByDistrictQuery(
          formData.state,
          formData.district,
          query,
          LOCALITY_RESULT_LIMIT
        );

        if (localityRequestRef.current !== requestId) {
          return;
        }

        setLocalityOptions(localities);
      } catch {
        if (localityRequestRef.current !== requestId) {
          return;
        }

        setLocalityOptions([]);
      } finally {
        if (localityRequestRef.current === requestId) {
          setLoadingLocalities(false);
        }
      }
    }, 220);

    return () => {
      clearTimeout(timer);
    };
  }, [formData.district, formData.state, selectorMode, selectorQuery]);

  const closeSelector = useCallback(() => {
    setSelectorMode(null);
    setSelectorQuery('');
  }, []);

  const openSelector = useCallback((mode: Exclude<SelectorMode, null>) => {
    if (mode === 'district' && !formData.state) {
      showAlert('Select State', 'Please select state first.');
      return;
    }

    if (mode === 'locality' && !formData.district) {
      showAlert('Select District', 'Please select district first.');
      return;
    }

    setSelectorMode(mode);
    setSelectorQuery('');

    if (mode === 'state') {
      void ensureRealStatesLoaded();
      return;
    }
  }, [ensureRealStatesLoaded, formData.district, formData.state]);

  const handleSelectItem = useCallback((item: SelectorItem) => {
    if (selectorMode === 'craft') {
      setFormData((prev) => ({ ...prev, craftType: item.value }));
      closeSelector();
      return;
    }

    if (selectorMode === 'state') {
      setFormData((prev) => ({
        ...prev,
        state: item.value,
        district: '',
        locality: '',
        localityPincode: '',
      }));
      localityRequestRef.current += 1;
      setDistrictOptions([]);
      setLocalityOptions([]);
      closeSelector();
      return;
    }

    if (selectorMode === 'district') {
      setFormData((prev) => ({
        ...prev,
        district: item.value,
        locality: '',
        localityPincode: '',
      }));
      localityRequestRef.current += 1;
      setLocalityOptions([]);
      closeSelector();
      return;
    }

    if (selectorMode === 'locality') {
      setFormData((prev) => ({
        ...prev,
        locality: item.value,
        localityPincode: item.pincode || '',
      }));
      closeSelector();
    }
  }, [closeSelector, selectorMode]);

  const selectedPickerKey = useMemo(() => {
    if (selectorMode === 'locality') {
      return `${formData.locality}-${formData.localityPincode || ''}`;
    }

    if (selectorMode === 'district') {
      return formData.district;
    }

    if (selectorMode === 'state') {
      return formData.state;
    }

    if (selectorMode === 'craft') {
      return formData.craftType;
    }

    return '';
  }, [formData.craftType, formData.district, formData.locality, formData.localityPincode, formData.state, selectorMode]);

  const renderPickerItem = useCallback(
    ({ item }: { item: SelectorItem }) => (
      <PickerOptionRow item={item} isSelected={item.key === selectedPickerKey} onPress={handleSelectItem} />
    ),
    [handleSelectItem, selectedPickerKey]
  );

  const handlePickShopPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
        allowsMultipleSelection: false,
      });
      if (!result.canceled) {
        setShopPhoto(result.assets[0].uri);
      }
    } catch {
      showAlert('Error', 'Failed to pick shop photo');
    }
  };

  const handlePickIdProof = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const asset = result.assets[0];
      const mime = (asset.mimeType || '').toLowerCase();
      if (mime !== 'application/pdf') {
        showAlert('Invalid Document', 'Only one PDF document is allowed for ID proof.');
        return;
      }

      setIdProof({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType,
      });
    } catch {
      showAlert('Error', 'Failed to pick ID proof PDF');
    }
  };

  const sanitizeCoordinateInput = (value: string) => value.replace(/[^0-9.-]/g, '').replace(/(?!^)-/g, '');

  const handleSubmit = async () => {
    const phone = lockPhoneField ? normalizedAccountPhone : normalizePhone(formData.phone);
    const latitude = formData.latitude.trim() ? Number(formData.latitude) : undefined;
    const longitude = formData.longitude.trim() ? Number(formData.longitude) : undefined;
    const skillsLength = formData.skills.trim().length;

    if (!validateShopName(formData.shopName)) {
      showAlert('Error', 'Shop name must be 3-50 characters.');
      return;
    }

    if (!formData.craftType.trim()) {
      showAlert('Error', 'Please select craft type');
      return;
    }

    if (!validateSkills(formData.skills) || skillsLength < 25) {
      showAlert('Error', 'Skills & description should be 25-200 characters and buyer-friendly.');
      return;
    }

    if (!validatePhone(phone)) {
      showAlert('Error', 'Please enter a valid 10-digit Indian phone number');
      return;
    }

    if (!validateAddress(formData.address)) {
      showAlert('Error', 'Address must be 10-300 characters.');
      return;
    }

    if (!validateLocation(formData.state)) {
      showAlert('Error', 'Please select a valid state');
      return;
    }

    if (!validateLocation(formData.district)) {
      showAlert('Error', 'Please select a valid district');
      return;
    }

    if (!validateLocation(formData.locality)) {
      showAlert('Error', 'Please select a valid village/locality');
      return;
    }

    if (formData.latitude.trim() && (Number.isNaN(latitude) || !validateLatitude(latitude!))) {
      showAlert('Error', 'Latitude must be between -90 and 90');
      return;
    }

    if (formData.longitude.trim() && (Number.isNaN(longitude) || !validateLongitude(longitude!))) {
      showAlert('Error', 'Longitude must be between -180 and 180');
      return;
    }

    if (!shopPhoto) {
      showAlert('Error', 'Please upload exactly one shop photo image');
      return;
    }

    if (!idProof) {
      showAlert('Error', 'Please upload exactly one ID proof PDF');
      return;
    }

    if ((idProof.mimeType || '').toLowerCase() !== 'application/pdf') {
      showAlert('Error', 'ID proof must be a PDF document');
      return;
    }

    try {
      setLoading(true);

      const existingSeller = await getSellerByUserId(user!.$id);
      if (existingSeller) {
        showAlert('Already Applied', 'You already submitted a seller application. Please wait for admin review.');
        return;
      }

      const shopPhotoUrl = await uploadFile(shopPhoto, `shops/${user?.$id}_shop`);
      const idProofUrl = await uploadFile(idProof.uri, `documents/${user?.$id}_id`);

      await createSeller({
        userId: user!.$id,
        shopName: formData.shopName,
        craftType: formData.craftType,
        skills: formData.skills,
        phone,
        address: formData.address,
        district: formData.district,
        locality: formData.locality,
        village: formData.locality,
        state: formData.state,
        latitude,
        longitude,
        documents: [shopPhotoUrl, idProofUrl],
      });

      setFormData({
        shopName: '',
        craftType: '',
        skills: '',
        phone: lockPhoneField ? normalizedAccountPhone : '',
        address: '',
        state: '',
        district: '',
        locality: '',
        localityPincode: '',
        latitude: '',
        longitude: '',
      });
      setDistrictOptions([]);
      setLocalityOptions([]);
      setShopPhoto(null);
      setIdProof(null);

      showAlert(
        'Success!',
        'Your seller application has been submitted. You will be notified once it is reviewed.',
        [
          {
            text: 'OK',
            onPress: () => {
              if (onProfileCreated) {
                onProfileCreated();
              }
            },
          },
        ]
      );
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to submit application');
    } finally {
      setLoading(false);
    }
  };

  const getSelectorFieldIcon = (mode: Exclude<SelectorMode, null>) => {
    switch (mode) {
      case 'state':
        return 'map-outline';
      case 'district':
        return 'business-outline';
      case 'locality':
        return 'pin-outline';
      case 'craft':
      default:
        return 'color-palette-outline';
    }
  };

  const renderSelectorField = (
    label: string,
    value: string,
    placeholder: string,
    mode: Exclude<SelectorMode, null>,
    fieldLoading: boolean,
    helperText?: string
  ) => (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      {(() => {
        const disabledByHierarchy =
          (mode === 'district' && !formData.state) ||
          (mode === 'locality' && !formData.district);

        return (
      <TouchableOpacity
        style={[styles.selectTrigger, disabledByHierarchy && styles.selectTriggerDisabled]}
        onPress={() => openSelector(mode)}
        activeOpacity={disabledByHierarchy ? 1 : 0.82}
        disabled={disabledByHierarchy}
      >
        <Text
          style={[
            styles.selectTriggerText,
            !value && styles.selectPlaceholderText,
            disabledByHierarchy && styles.selectDisabledText,
          ]}
          numberOfLines={1}
        >
            {value || placeholder}
        </Text>
        <View style={styles.selectTriggerRight}>
          {fieldLoading ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Ionicons
              name="chevron-down-outline"
              size={18}
              color={disabledByHierarchy ? '#9CA3AF' : COLORS.primary}
            />
          )}
        </View>
      </TouchableOpacity>
        );
      })()}
      {!!helperText && <Text style={styles.helperText}>{helperText}</Text>}
    </View>
  );

  const renderSectionHeader = (icon: keyof typeof Ionicons.glyphMap, title: string, subtitle: string) => (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIconWrap}>
        <Ionicons name={icon} size={16} color={COLORS.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <View style={styles.screenHeader}>
        <Ionicons name="storefront-outline" size={24} color="#fff" />
        <Text style={[styles.screenHeaderTitle, { flex: 1 }]}>Become a Seller</Text>
        <TouchableOpacity
          onPress={() => {
            showAlert('Logout', 'Are you sure you want to logout?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Logout', style: 'destructive', onPress: () => logout() },
            ]);
          }}
        >
          <Ionicons name="log-out-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        extraScrollHeight={24}
        extraHeight={120}
      >
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Create your verified shop profile</Text>
          <Text style={styles.heroSubtitle}>
            Buyers will see your craft details, location credibility and verification status before ordering.
          </Text>
        </View>

        <View style={styles.formCard}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Shop Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your shop name"
              value={formData.shopName}
              onChangeText={(text) => setFormData({ ...formData, shopName: text })}
            />
          </View>

          {renderSelectorField(
            'Craft Type *',
            formData.craftType,
            'Tap to search and select craft type',
            'craft',
            false
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Skills & Description *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Write clearly about your craft process, quality and specialization..."
              value={formData.skills}
              onChangeText={(text) => setFormData({ ...formData, skills: text.slice(0, 200) })}
              multiline
              numberOfLines={5}
            />
            <Text style={styles.warningText}>
              This is visible to buyers. Keep it professional and accurate.
            </Text>
            <Text style={styles.counterText}>{formData.skills.trim().length}/200</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number *</Text>
            <View style={[styles.phoneWrap, lockPhoneField && styles.phoneWrapLocked]}>
              <TextInput
                style={[styles.phoneInput, lockPhoneField && styles.inputDisabled]}
                placeholder="Enter contact number"
                value={lockPhoneField ? normalizedAccountPhone : formData.phone}
                onChangeText={(text) => {
                  if (!lockPhoneField) {
                    setFormData({ ...formData, phone: text });
                  }
                }}
                editable={!lockPhoneField}
                keyboardType="phone-pad"
              />
              <Ionicons
                name={lockPhoneField ? 'lock-closed-outline' : 'call-outline'}
                size={18}
                color={lockPhoneField ? '#6B7280' : '#9CA3AF'}
              />
            </View>
            {lockPhoneField && (
              <Text style={styles.helperText}>
                Mobile number is locked from account registration for trust and verification integrity.
              </Text>
            )}
          </View>

          <View style={styles.sectionCard}>
            {renderSectionHeader(
              'location-outline',
              'Location Details',
              'Select hierarchy in order: State -> District -> Village/Locality -> Address line.'
            )}

            {renderSelectorField(
              'State *',
              formData.state,
              loadingStates ? 'Loading states...' : 'Tap to search state',
              'state',
              loadingStates
            )}

            {renderSelectorField(
              'District *',
              formData.district,
              !formData.state
                ? 'Select state first'
                : loadingDistricts
                ? 'Loading districts...'
                : 'Tap to search district',
              'district',
              loadingDistricts,
              formData.state ? undefined : 'Choose state first to unlock districts.'
            )}

            {renderSelectorField(
              'Village / Locality *',
              selectedLocalityLabel,
              !formData.district
                ? 'Select district first'
                : loadingLocalities
                ? 'Loading localities...'
                : 'Tap to search locality or pincode',
              'locality',
              loadingLocalities,
              formData.district
                ? `Search rule: enter exact ${LOCALITY_PIN_LENGTH}-digit PIN or at least ${LOCALITY_MIN_TEXT_QUERY} letters.`
                : undefined
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Address Line *</Text>
              <TextInput
                style={[styles.input, styles.addressArea]}
                placeholder="House / street / landmark only"
                value={formData.address}
                onChangeText={(text) => setFormData({ ...formData, address: text })}
                multiline
                numberOfLines={3}
              />
              <Text style={styles.helperText}>
                Add only street/house details here. State, district and locality are already selected above.
              </Text>
            </View>
          </View>

          <View style={styles.sectionCard}>
            {renderSectionHeader(
              'navigate-outline',
              'Map Coordinates (Optional)',
              'Use only if you know exact GPS values. You can skip this section.'
            )}

            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Latitude (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="28.6139"
                  value={formData.latitude}
                  onChangeText={(text) =>
                    setFormData({
                      ...formData,
                      latitude: sanitizeCoordinateInput(text),
                    })
                  }
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Longitude (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="77.2090"
                  value={formData.longitude}
                  onChangeText={(text) =>
                    setFormData({
                      ...formData,
                      longitude: sanitizeCoordinateInput(text),
                    })
                  }
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <Text style={styles.helperText}>Coordinates are optional. Leave blank if you do not know exact values.</Text>
          </View>

          <View style={[styles.sectionCard, styles.verifyCard]}>
            {renderSectionHeader(
              'shield-checkmark-outline',
              'Verification Documents',
              'Required for authenticity review before your seller profile goes live.'
            )}

            <View style={styles.verifySummaryRow}>
              <View style={styles.verifySummaryPill}>
                <Ionicons name="shield-checkmark-outline" size={14} color="#9A3412" />
                <Text style={styles.verifySummaryPillText}>Verification files: {verificationCount}/2</Text>
              </View>
              <Text style={styles.verifySummaryText}>Require 1 shop image + 1 PDF ID proof</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Shop Photo * (Exactly 1 image)</Text>
              <TouchableOpacity style={styles.uploadButton} onPress={handlePickShopPhoto}>
                {shopPhoto ? (
                  <View style={styles.uploadedPreview}>
                    <Image source={{ uri: shopPhoto }} style={styles.uploadedImage} resizeMode="cover" />
                    <View style={styles.uploadedFooter}>
                      <Text style={styles.uploadedFooterText}>1/1 shop image selected. Tap to replace.</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.uploadPlaceholder}>
                    <Ionicons name="image-outline" size={34} color={COLORS.primary} />
                    <Text style={styles.uploadText}>Upload one clear photo of your shop/workspace</Text>
                  </View>
                )}
              </TouchableOpacity>
              {!!shopPhoto && (
                <TouchableOpacity style={styles.removeUploadBtn} onPress={() => setShopPhoto(null)}>
                  <Ionicons name="trash-outline" size={14} color="#B91C1C" />
                  <Text style={styles.removeUploadText}>Remove selected shop image</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>ID Proof PDF * (Exactly 1 document)</Text>
              <TouchableOpacity style={styles.uploadButton} onPress={handlePickIdProof}>
                {idProof ? (
                  <View style={styles.uploadedPreview}>
                    <View style={styles.docPreviewBox}>
                      <Ionicons name="document-text-outline" size={42} color={COLORS.primary} />
                      <Text style={styles.docNameText} numberOfLines={2}>
                        {idProof.name || 'ID proof document'}
                      </Text>
                    </View>
                    <View style={styles.uploadedFooter}>
                      <Text style={styles.uploadedFooterText}>1/1 ID document selected. Tap to replace.</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.uploadPlaceholder}>
                    <Ionicons name="document-attach-outline" size={34} color={COLORS.primary} />
                    <Text style={styles.uploadText}>Upload one PDF: Aadhaar, PAN, Voter ID, or similar</Text>
                  </View>
                )}
              </TouchableOpacity>
              {!!idProof && (
                <TouchableOpacity style={styles.removeUploadBtn} onPress={() => setIdProof(null)}>
                  <Ionicons name="trash-outline" size={14} color="#B91C1C" />
                  <Text style={styles.removeUploadText}>Remove selected ID proof</Text>
                </TouchableOpacity>
              )}
              <Text style={styles.helperText}>Strict verification: exactly 1 shop image + 1 PDF ID proof is required.</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, (!verificationReady || loading) && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading || !verificationReady}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="shield-checkmark-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.submitButtonText}>Submit for Verification</Text>
              </>
            )}
          </TouchableOpacity>
          {!verificationReady && (
            <Text style={styles.pendingVerifyHint}>Upload both required verification files to enable submission.</Text>
          )}
        </View>
      </KeyboardAwareScrollView>

      <Modal
        animationType="slide"
        visible={selectorMode !== null}
        onRequestClose={closeSelector}
        transparent
      >
        <View style={styles.pickerModalRoot}>
          <Pressable style={styles.pickerModalBackdrop} onPress={closeSelector} />
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeaderRow}>
              <Text style={styles.pickerTitle}>{selectorTitle}</Text>
              <TouchableOpacity style={styles.pickerCloseBtn} onPress={closeSelector}>
                <Ionicons name="close" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {!!selectorMetaText && <Text style={styles.pickerMetaText}>{selectorMetaText}</Text>}

            {selectorMode === 'locality' && (
              <View style={styles.pickerRuleBox}>
                <Ionicons name="flash-outline" size={14} color="#9A3412" />
                <Text style={styles.pickerRuleText}>
                  Enter exact {LOCALITY_PIN_LENGTH}-digit PIN or at least {LOCALITY_MIN_TEXT_QUERY} village letters.
                </Text>
              </View>
            )}

            <View style={styles.pickerSearchWrap}>
              <Ionicons name="search-outline" size={16} color={COLORS.textSecondary} />
              <TextInput
                style={styles.pickerSearchInput}
                value={selectorQuery}
                onChangeText={setSelectorQuery}
                placeholder={selectorPlaceholder}
                autoFocus
              />
            </View>

            <FlatList
              data={selectorItems}
              keyExtractor={(item) => item.key}
              extraData={selectedPickerKey}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              removeClippedSubviews={Platform.OS === 'android'}
              contentContainerStyle={styles.pickerListContent}
              initialNumToRender={12}
              maxToRenderPerBatch={12}
              windowSize={6}
              updateCellsBatchingPeriod={65}
              ListEmptyComponent={<Text style={styles.pickerEmptyText}>{localityEmptyMessage}</Text>}
              renderItem={renderPickerItem}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  scroll: {
    flex: 1,
  },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  screenHeaderTitle: {
    fontSize: 30 / 1.5,
    fontWeight: '700',
    color: '#fff',
  },
  heroCard: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 10,
    borderRadius: 14,
    backgroundColor: '#1F2937',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  heroSubtitle: {
    color: '#D1D5DB',
    fontSize: 13,
    lineHeight: 19,
  },
  formCard: {
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 14,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  halfWidth: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 16,
  },
  sectionCard: {
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  sectionIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#374151',
  },
  sectionSubtitle: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
    color: '#6B7280',
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    color: '#111827',
  },
  addressArea: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  textArea: {
    minHeight: 116,
    textAlignVertical: 'top',
  },
  selectorField: {
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  selectorFieldEmpty: {
    borderColor: '#CBD5E1',
  },
  selectTrigger: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
    backgroundColor: '#F9FAFB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  selectTriggerText: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    fontWeight: '600',
  },
  selectPlaceholderText: {
    color: '#9CA3AF',
    fontWeight: '500',
  },
  selectDisabledText: {
    color: '#9CA3AF',
  },
  selectTriggerDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  selectTriggerRight: {
    width: 20,
    alignItems: 'flex-end',
  },
  selectorLeftWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectorIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorIconWrapActive: {
    borderColor: `${COLORS.primary}55`,
    backgroundColor: `${COLORS.primary}12`,
  },
  selectorRightWrap: {
    width: 26,
    alignItems: 'flex-end',
  },
  selectorValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  selectorPlaceholder: {
    color: '#9CA3AF',
  },
  helperText: {
    marginTop: 7,
    fontSize: 12,
    lineHeight: 18,
    color: '#6B7280',
  },
  warningText: {
    marginTop: 8,
    fontSize: 12,
    color: '#B45309',
    lineHeight: 18,
    fontWeight: '600',
  },
  counterText: {
    marginTop: 6,
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'right',
  },
  phoneWrap: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  phoneWrapLocked: {
    backgroundColor: '#F9FAFB',
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    paddingVertical: 13,
  },
  inputDisabled: {
    color: '#6B7280',
  },
  uploadButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    overflow: 'hidden',
  },
  uploadPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    paddingHorizontal: 14,
    gap: 8,
  },
  uploadText: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
  },
  uploadedPreview: {
    backgroundColor: '#F8FAFC',
  },
  uploadedImage: {
    width: '100%',
    height: 220,
    backgroundColor: '#F8FAFC',
  },
  docPreviewBox: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  docNameText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    textAlign: 'center',
  },
  uploadedFooter: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  uploadedFooterText: {
    fontSize: 13,
    color: '#4B5563',
  },
  removeUploadBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  removeUploadText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B91C1C',
  },
  verifySummaryRow: {
    marginTop: -2,
    marginBottom: 12,
    gap: 8,
  },
  verifySummaryPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF7ED',
    borderColor: '#FDBA74',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  verifySummaryPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9A3412',
  },
  verifySummaryText: {
    fontSize: 12,
    color: '#6B7280',
  },
  verifyCard: {
    marginBottom: 18,
  },
  submitButton: {
    marginTop: 6,
    marginBottom: 18,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  submitButtonDisabled: {
    opacity: 0.7,
    backgroundColor: '#9CA3AF',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  pendingVerifyHint: {
    marginTop: -8,
    marginBottom: 14,
    fontSize: 12,
    color: '#9A3412',
    fontWeight: '600',
  },
  modalScreen: {
    flex: 1,
    backgroundColor: '#fff',
  },
  pickerModalRoot: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.36)',
  },
  pickerModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  pickerSheet: {
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
    minHeight: '58%',
    maxHeight: '78%',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 0,
  },
  pickerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  pickerCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pickerMetaText: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  pickerRuleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#FDBA74',
    backgroundColor: '#FFF7ED',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  pickerRuleText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: '#9A3412',
    fontWeight: '600',
  },
  pickerSearchWrap: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
    marginBottom: 10,
  },
  pickerSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },
  pickerListContent: {
    paddingBottom: 4,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    marginBottom: 8,
  },
  pickerItemSelected: {
    borderColor: `${COLORS.primary}50`,
    backgroundColor: `${COLORS.primary}10`,
  },
  pickerItemText: {
    flex: 1,
    color: '#111827',
    fontSize: 13,
    fontWeight: '700',
  },
  pickerItemTextSelected: {
    color: COLORS.primary,
  },
  pickerEmptyText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 14,
  },
  localitySuggestionTextWrap: {
    flex: 1,
  },
  localityMetaText: {
    marginTop: 2,
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '600',
  },
  modalKeyboardWrap: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 16,
  },
  modalGrabber: {
    width: 46,
    height: 4,
    borderRadius: 999,
    alignSelf: 'center',
    backgroundColor: '#D1D5DB',
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  modalHeaderTextWrap: {
    flex: 1,
    paddingRight: 8,
  },
  modalEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  modalTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#111827',
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalMetaText: {
    marginTop: 4,
    marginBottom: 8,
    fontSize: 12,
    color: '#6B7280',
  },
  modalRuleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#FDBA74',
    backgroundColor: '#FFF7ED',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  modalRuleText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: '#9A3412',
    fontWeight: '600',
  },
  searchBox: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    marginTop: 4,
    marginBottom: 8,
    backgroundColor: '#F8FAFC',
  },
  searchIconWrapModern: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${COLORS.primary}12`,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
    color: '#111827',
  },
  modalList: {
    flex: 1,
  },
  optionRow: {
    minHeight: 58,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
  },
  optionIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconWrapSelected: {
    borderColor: `${COLORS.primary}66`,
    backgroundColor: `${COLORS.primary}14`,
  },
  optionRowSelected: {
    borderColor: `${COLORS.primary}55`,
    backgroundColor: '#FFF7ED',
  },
  optionLabel: {
    fontSize: 15,
    color: '#111827',
  },
  optionLabelSelected: {
    color: '#9A3412',
    fontWeight: '700',
  },
  optionSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: '#6B7280',
  },
  emptyWrap: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 14,
  },
});
