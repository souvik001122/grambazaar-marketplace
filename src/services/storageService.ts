import { ID, Query } from 'appwrite';
import { databases, storage, appwriteConfig, account, client } from '../config/appwrite';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

/**
 * Upload image to Appwrite storage
 */
export const uploadImage = async (
  uri: string,
  bucketId: string,
  compress: boolean = true
): Promise<string> => {
  try {
    // Compress image if needed (skip on web for now)
    let finalUri = uri;
    if (compress && Platform.OS !== 'web') {
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1024 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      finalUri = manipResult.uri;
    }

    // Get file info only on native platforms
    if (Platform.OS !== 'web') {
      const fileInfo = await FileSystem.getInfoAsync(finalUri);
      if (!fileInfo.exists) {
        throw new Error('File does not exist');
      }
    }
    
    // Generate unique file ID
    const fileId = ID.unique();
    const fileName = `${fileId}.jpg`;
    
    // Create FormData and append file
    const formData = new FormData();
    formData.append('fileId', fileId);
    
    // Handle file differently for web vs native
    if (Platform.OS === 'web') {
      // On web, fetch the blob and create a File object
      const response = await fetch(finalUri);
      const blob = await response.blob();
      const file = new File([blob], fileName, { type: 'image/jpeg' });
      formData.append('file', file);
    } else {
      // On native, use URI format
      formData.append('file', {
        uri: finalUri,
        name: fileName,
        type: 'image/jpeg',
      } as any);
    }
    
    // Append permissions as individual array items
    formData.append('permissions[]', 'read("any")');
    
    // Upload using fetch with FormData
    const response = await fetch(
      `${appwriteConfig.endpoint}/storage/buckets/${bucketId}/files`,
      {
        method: 'POST',
        headers: {
          'X-Appwrite-Project': appwriteConfig.projectId,
        },
        body: formData,
        credentials: 'include', // Important for session cookies
      }
    );
    
    const result = await response.json();
    
    if (!response.ok) {
      console.error('Upload error:', result);
      throw new Error(result.message || 'Upload failed');
    }
    
      return result.$id;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw new Error('Failed to upload image');
  }
};

/**
 * Upload multiple images
 */
export const uploadMultipleImages = async (
  uris: string[],
  bucketId: string
): Promise<string[]> => {
  try {
    const uploadPromises = uris.map(uri => uploadImage(uri, bucketId));
    return await Promise.all(uploadPromises);
  } catch (error) {
    console.error('Error uploading multiple images:', error);
    throw new Error('Failed to upload images');
  }
};

/**
 * Get image URL
 */
export const getImageUrl = (bucketId: string, fileId: string): string => {
  return `${appwriteConfig.endpoint}/storage/buckets/${bucketId}/files/${fileId}/view?project=${appwriteConfig.projectId}`;
};

/**
 * Normalize unknown image field to a string array.
 * Handles Appwrite docs where array fields may come as a JSON string or plain string.
 */
export const normalizeImageList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map((v) => (typeof v === 'string' ? v.trim() : ''))
            .filter(Boolean);
        }
      } catch {
        // Fall through to plain string handling.
      }
    }

    return [trimmed];
  }

  return [];
};

/**
 * Resolve image string to usable URL.
 * If already an absolute URL, return it; otherwise treat as Appwrite file ID.
 */
export const resolveImageUrl = (bucketId: string, imageValue: string | undefined | null): string => {
  const value = (imageValue || '').trim();
  if (!value) return '';

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return getImageUrl(bucketId, value);
};

/**
 * Get file URL (generic for any file type)
 */
export const getFileUrl = (fileId: string): string => {
  return `${appwriteConfig.endpoint}/storage/buckets/${appwriteConfig.profileImagesBucketId}/files/${fileId}/view?project=${appwriteConfig.projectId}`;
};

/**
 * Upload a file to storage (generic for any file type)
 * Works with React Native file URIs
 */
export const uploadFile = async (fileUri: string, fileName: string): Promise<string> => {
  try {
    // Get file info only on native platforms
    if (Platform.OS !== 'web') {
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (!fileInfo.exists) {
        throw new Error('File does not exist');
      }
    }
    
    // Get file extension from URI or default to jpg
    const extension = fileUri.split('.').pop()?.toLowerCase() || 'jpg';
    const mimeType = extension === 'pdf' ? 'application/pdf' : `image/${extension}`;
    
    // Generate unique file ID and name
    const fileId = ID.unique();
    const fullFileName = `${fileName}.${extension}`;
    
    // Create FormData and append file
    const formData = new FormData();
    formData.append('fileId', fileId);
    
    // Handle file differently for web vs native
    if (Platform.OS === 'web') {
      // On web, fetch the blob and create a File object
      const response = await fetch(fileUri);
      const blob = await response.blob();
      const file = new File([blob], fullFileName, { type: mimeType });
      formData.append('file', file);
    } else {
      // On native, use URI format
      formData.append('file', {
        uri: fileUri,
        name: fullFileName,
        type: mimeType,
      } as any);
    }
    
    // Append permissions as individual array items
    formData.append('permissions[]', 'read("any")');
    
    // Upload using fetch with FormData
    const response = await fetch(
      `${appwriteConfig.endpoint}/storage/buckets/${appwriteConfig.profileImagesBucketId}/files`,
      {
        method: 'POST',
        headers: {
          'X-Appwrite-Project': appwriteConfig.projectId,
        },
        body: formData,
        credentials: 'include', // Important for session cookies
      }
    );
    
    const result = await response.json();
    
    if (!response.ok) {
      console.error('Upload error:', result);
      throw new Error(result.message || 'Upload failed');
    }
    
    const uploadedFile = result;

    return getFileUrl(uploadedFile.$id);
  } catch (error) {
    console.error('Error uploading file:', error);
    throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Delete image from storage
 */
export const deleteImage = async (bucketId: string, fileId: string): Promise<void> => {
  try {
    await storage.deleteFile(bucketId, fileId);
  } catch (error) {
    console.error('Error deleting image:', error);
    throw new Error('Failed to delete image');
  }
};

/**
 * Delete multiple images
 */
export const deleteMultipleImages = async (
  bucketId: string,
  fileIds: string[]
): Promise<void> => {
  try {
    const deletePromises = fileIds.map(fileId => deleteImage(bucketId, fileId));
    await Promise.all(deletePromises);
  } catch (error) {
    console.error('Error deleting multiple images:', error);
    throw new Error('Failed to delete images');
  }
};

/**
 * Get file size
 */
export const getFileSize = async (uri: string): Promise<number> => {
  try {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    return fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;
  } catch (error) {
    console.error('Error getting file size:', error);
    return 0;
  }
};

/**
 * Validate image size (max 5MB)
 */
export const validateImageSize = async (uri: string, maxSizeMB: number = 5): Promise<boolean> => {
  const size = await getFileSize(uri);
  return size <= maxSizeMB * 1024 * 1024;
};
