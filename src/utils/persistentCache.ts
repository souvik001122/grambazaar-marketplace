import * as FileSystem from 'expo-file-system/legacy';

const AUTH_CACHE_FILE = `${FileSystem.documentDirectory}auth_cache.json`;
const HOME_CACHE_FILE = `${FileSystem.documentDirectory}home_cache.json`;

export const writeAuthCache = async (user: any): Promise<void> => {
  try {
    await FileSystem.writeAsStringAsync(AUTH_CACHE_FILE, JSON.stringify(user));
  } catch (e) {
    console.error('Error writing auth cache:', e);
  }
};

export const readAuthCache = async (): Promise<any | null> => {
  try {
    const info = await FileSystem.getInfoAsync(AUTH_CACHE_FILE);
    if (info.exists) {
      const content = await FileSystem.readAsStringAsync(AUTH_CACHE_FILE);
      return JSON.parse(content);
    }
  } catch (e) {
    console.error('Error reading auth cache:', e);
  }
  return null;
};

export const clearAuthCache = async (): Promise<void> => {
  try {
    const info = await FileSystem.getInfoAsync(AUTH_CACHE_FILE);
    if (info.exists) {
      await FileSystem.deleteAsync(AUTH_CACHE_FILE);
    }
  } catch (e) {
    console.error('Error clearing auth cache:', e);
  }
};

export const writeHomeCache = async (data: any): Promise<void> => {
  try {
    await FileSystem.writeAsStringAsync(HOME_CACHE_FILE, JSON.stringify(data));
  } catch (e) {
    console.error('Error writing home cache:', e);
  }
};

export const readHomeCache = async (): Promise<any | null> => {
  try {
    const info = await FileSystem.getInfoAsync(HOME_CACHE_FILE);
    if (info.exists) {
      const content = await FileSystem.readAsStringAsync(HOME_CACHE_FILE);
      return JSON.parse(content);
    }
  } catch (e) {
    console.error('Error reading home cache:', e);
  }
  return null;
};
