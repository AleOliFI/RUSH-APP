import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '../../src/stores/auth';

export default function MeasurementLayout() {
  const { session, isLoading } = useAuthStore();
  if (isLoading) return null;
  if (!session) return <Redirect href="/(auth)/sign-in" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0A0A0A' },
        animation: 'slide_from_bottom',
      }}
    />
  );
}
