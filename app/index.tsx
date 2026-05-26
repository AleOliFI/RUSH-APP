import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/stores/auth';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  const { session, profile, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <View className="flex-1 bg-bg-primary items-center justify-center">
        <ActivityIndicator color="#22C55E" size="large" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (session && profile && !profile.onboarding_completed) {
    return <Redirect href="/(auth)/onboarding/profile" />;
  }

  return <Redirect href="/(tabs)" />;
}
