import { Stack } from 'expo-router';

export default function MeasurementLayout() {
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
