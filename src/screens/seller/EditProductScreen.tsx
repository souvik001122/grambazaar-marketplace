import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { updateProduct } from '../../services/productService';
import { uploadFile } from '../../services/storageService';
import { getSellerById } from '../../services/sellerService';
import { CATEGORIES } from '../../constants/categories';
import { COLORS } from '../../constants/colors';
import { showAlert } from '../../utils/alert';
import { Product } from '../../types/product.types';
import {
  validateDescription,
  validateImageCount,
  validatePrice,
  validateProductName,
  validateStock,
} from '../../utils/validation';
import { PremiumImage } from '../../components/PremiumImage';
import { PremiumTopBar } from '../../components/PremiumTopBar';

const EditProductScreen = ({ route, navigation }: any) => {
  const product: Product = route.params.product;
  const [loading, setLoading] = useState(false);
  const [loadingSeller, setLoadingSeller] = useState(true);
  const [resolvedState, setResolvedState] = useState(product.state || product.region || '');
  const [resolvedLocation, setResolvedLocation] = useState(product.state || product.region || '');

  const [formData, setFormData] = useState({
    name: product.name || '',
    category: product.category || '',
    price: product.price?.toString() || '',
    description: product.description || '',
    stock: product.stock?.toString() || '0',
  });

  const [existingImages, setExistingImages] = useState<string[]>(product.images || []);
  const [newImages, setNewImages] = useState<string[]>([]);

  const totalImages = existingImages.length + newImages.length;

  useEffect(() => {
    let active = true;

    const loadSellerLocation = async () => {
      try {
        const seller = await getSellerById(product.sellerId);
        if (!active || !seller) {
          return;
        }

        const sellerState = (seller.state || '').trim();
        if (sellerState) {
          setResolvedState(sellerState);
        }

        const locationLabel = [seller.village, seller.district, seller.state].filter(Boolean).join(', ');
        if (locationLabel) {
          setResolvedLocation(locationLabel);
        }
      } catch {
        // Keep existing product state fallback.
      } finally {
        if (active) {
          setLoadingSeller(false);
        }
      }
    };

    loadSellerLocation();

    return () => {
      active = false;
    };
  }, [product.sellerId]);

  const locationLabel = useMemo(() => {
    return resolvedLocation || resolvedState || 'Location unavailable';
  }, [resolvedLocation, resolvedState]);

  const handlePickImages = async () => {
    if (totalImages >= 5) {
      showAlert('Limit Reached', 'You can upload maximum 5 images');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsMultipleSelection: true,
      });

      if (!result.canceled) {
        const picked = result.assets.map((asset) => asset.uri);
        const allowed = 5 - totalImages;
        setNewImages([...newImages, ...picked.slice(0, allowed)]);
      }
    } catch {
      showAlert('Error', 'Failed to pick images');
    }
  };

  const handleRemoveExistingImage = (index: number) => {
    setExistingImages(existingImages.filter((_, i) => i !== index));
  };

  const handleRemoveNewImage = (index: number) => {
    setNewImages(newImages.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const trimmedName = formData.name.trim();
    const trimmedDescription = formData.description.trim();
    const parsedPrice = Number(formData.price);
    const parsedStock = Number(formData.stock);

    if (!resolvedState) {
      showAlert('Error', 'Seller location missing. Please update seller profile first.');
      return;
    }

    if (!validateProductName(trimmedName)) {
      showAlert('Error', 'Product name must be 3-100 characters.');
      return;
    }

    if (!formData.category.trim()) {
      showAlert('Error', 'Please select category');
      return;
    }

    if (!validatePrice(parsedPrice)) {
      showAlert('Error', 'Price must be between ₹10 and ₹1,00,000.');
      return;
    }

    if (!validateDescription(trimmedDescription, 20, 1200)) {
      showAlert('Error', 'Description must be 20-1200 characters.');
      return;
    }

    if (!validateStock(parsedStock, 0, 100000)) {
      showAlert('Error', 'Stock must be a whole number between 0 and 1,00,000.');
      return;
    }

    const allCandidateImages = [...existingImages, ...newImages];
    if (!validateImageCount(allCandidateImages, 5)) {
      showAlert('Error', 'Please keep 1 to 5 product images');
      return;
    }

    try {
      setLoading(true);

      const uploadedNewUrls: string[] = [];
      for (let i = 0; i < newImages.length; i += 1) {
        const imageUrl = await uploadFile(newImages[i], `products/${product.sellerId}_${Date.now()}_edit_${i}`);
        uploadedNewUrls.push(imageUrl);
      }

      const allImages = [...existingImages, ...uploadedNewUrls];

      await updateProduct(product.$id, {
        name: trimmedName,
        category: formData.category,
        price: parsedPrice,
        description: trimmedDescription,
        images: allImages,
        stock: parsedStock,
        region: resolvedState,
        state: resolvedState,
        status: 'pending',
      });

      showAlert('Updated!', 'Your product has been updated and re-submitted for review.', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to update product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <KeyboardAwareScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        extraScrollHeight={24}
        extraHeight={120}
      >
          <PremiumTopBar
            title="Edit Product"
            subtitle="Update details and re-submit for review"
            icon="create-outline"
            showBack={navigation.canGoBack()}
            onBack={() => navigation.goBack()}
          />

        <View style={styles.form}>
          <View style={styles.locationBox}>
            <Ionicons name="location-outline" size={18} color={COLORS.primary} />
            <View style={styles.locationBoxTextWrap}>
              <Text style={styles.locationLabel}>Product Location (Locked from seller profile)</Text>
              <Text style={styles.locationValue}>{loadingSeller ? 'Loading seller location...' : locationLabel}</Text>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Product Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter product name"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Category *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryChip,
                    formData.category === cat.id && styles.categoryChipSelected,
                  ]}
                  onPress={() => setFormData({ ...formData, category: cat.id })}
                >
                  <Text style={styles.categoryIcon}>{cat.icon}</Text>
                  <Text
                    style={[
                      styles.categoryText,
                      formData.category === cat.id && styles.categoryTextSelected,
                    ]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Price (₹) *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter price"
              value={formData.price}
              onChangeText={(text) => setFormData({ ...formData, price: text })}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe your product..."
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              multiline
              numberOfLines={5}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Stock Quantity *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter available stock"
              value={formData.stock}
              onChangeText={(text) => setFormData({ ...formData, stock: text })}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Product Images * (Max 5) - {totalImages}/5</Text>

            {existingImages.length > 0 && (
              <View style={styles.imageSectionLabel}>
                <Text style={styles.imageSectionText}>Current Images</Text>
              </View>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesScroll}>
              {existingImages.map((uri, index) => (
                <View key={`existing-${index}`} style={styles.imageContainer}>
                  <PremiumImage
                    uri={uri}
                    style={styles.productImage}
                    variant="product"
                  />
                  <TouchableOpacity style={styles.removeImageButton} onPress={() => handleRemoveExistingImage(index)}>
                    <Text style={styles.removeImageText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            {newImages.length > 0 && (
              <View style={styles.imageSectionLabel}>
                <Text style={styles.imageSectionText}>New Images</Text>
              </View>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesScroll}>
              {newImages.map((uri, index) => (
                <View key={`new-${index}`} style={styles.imageContainer}>
                  <PremiumImage
                    uri={uri}
                    style={styles.productImage}
                    variant="product"
                  />
                  <TouchableOpacity style={styles.removeImageButton} onPress={() => handleRemoveNewImage(index)}>
                    <Text style={styles.removeImageText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {totalImages < 5 && (
                <TouchableOpacity style={styles.addImageButton} onPress={handlePickImages}>
                  <Text style={styles.addImageIcon}>📷</Text>
                  <Text style={styles.addImageText}>Add Image</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.submitButtonText}>Update Product</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.noteBox}>
            <Ionicons name="information-circle" size={20} color={COLORS.secondary} />
            <Text style={styles.noteText}>
              Edits reset product status to pending. Admin review is required before it goes live again.
            </Text>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  form: {
    padding: 16,
  },
  locationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAF4FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CFE4FF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 18,
    gap: 8,
  },
  locationBoxTextWrap: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    color: '#5A6D80',
  },
  locationValue: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: '700',
    color: '#1F3B5B',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.text,
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  categoryScroll: {
    flexDirection: 'row',
  },
  categoryChip: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginRight: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  categoryText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  categoryTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  imageSectionLabel: {
    marginTop: 8,
    marginBottom: 6,
  },
  imageSectionText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  imagesScroll: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  imageContainer: {
    position: 'relative',
    marginRight: 10,
  },
  productImage: {
    width: 100,
    height: 100,
    borderRadius: 10,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FF4444',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeImageText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  addImageButton: {
    width: 100,
    height: 100,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addImageIcon: {
    fontSize: 32,
    marginBottom: 4,
  },
  addImageText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  noteBox: {
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
    marginBottom: 30,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.secondary,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
});

export default EditProductScreen;
