import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../src/stores/authStore';

export default function Index() {
  const router = useRouter();
  const { isAuthenticated, user, isLoading } = useAuthStore();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!isAuthenticated) {
      router.replace('/(auth)/login');
    } else {
      // Redirect based on user role
      if (user?.role === 'seller') {
        router.replace('/(seller)');
      } else if (user?.role === 'admin') {
        router.replace('/(admin)');
      } else {
        router.replace('/(buyer)');
      }
    }
  }, [isAuthenticated, user, isLoading]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" />
    </View>
  );
}
