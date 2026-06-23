import '../global.css';
import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { StripeProvider } from '@stripe/stripe-react-native';
import { useAuthListener } from '../src/hooks/useAuth';
import { useSubscriptionSync } from '../src/hooks/useSubscription';
import { initRevenueCat } from '../src/lib/revenuecat';

const queryClient = new QueryClient();

const STRIPE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

function AppProviders({ children }: { children: React.ReactNode }) {
  useAuthListener();
  useSubscriptionSync();

  useEffect(() => {
    initRevenueCat();
  }, []);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StripeProvider
        publishableKey={STRIPE_PUBLISHABLE_KEY}
        merchantIdentifier="merchant.com.rushapp.hrv"
        urlScheme="rushapp"
      >
        <QueryClientProvider client={queryClient}>
          <AppProviders>
            <StatusBar style="light" />
            <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="measurement" options={{ presentation: 'modal' }} />
              <Stack.Screen name="subscription" options={{ presentation: 'modal' }} />
              <Stack.Screen name="wearables" options={{ presentation: 'modal' }} />
            </Stack>
          </AppProviders>
        </QueryClientProvider>
      </StripeProvider>
    </GestureHandlerRootView>
  );
}
