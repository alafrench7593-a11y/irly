import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        animationDuration: 280,
        contentStyle: { backgroundColor: '#08080C' },
      }}
    />
  );
}
