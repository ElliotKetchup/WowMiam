import { BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import { Onest_400Regular, Onest_500Medium, Onest_600SemiBold, Onest_700Bold } from '@expo-google-fonts/onest';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { UpdateBanner } from '@/components/update-banner';
import { initCloud } from '@/lib/cloud';
import { C } from '@/lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [loaded] = useFonts({
    BricolageGrotesque_800ExtraBold,
    Onest_400Regular,
    Onest_500Medium,
    Onest_600SemiBold,
    Onest_700Bold,
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => undefined);
  }, [loaded]);

  useEffect(() => initCloud(), []);

  if (!loaded) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.paper }, animation: 'slide_from_right' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="recipe/[id]" options={{ animation: 'fade_from_bottom' }} />
        <Stack.Screen name="cook/[id]" options={{ animation: 'slide_from_bottom', contentStyle: { backgroundColor: C.aubergine } }} />
        <Stack.Screen name="folder/[id]" options={{ animation: 'fade_from_bottom' }} />
        <Stack.Screen name="create" options={{ animation: 'slide_from_bottom' }} />
      </Stack>
      <UpdateBanner />
    </>
  );
}
