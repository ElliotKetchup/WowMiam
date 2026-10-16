/** A small pill that appears once an over-the-air update has downloaded, to apply it right away. */
import * as Updates from 'expo-updates';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, tap, Txt } from '@/components/ui';
import { C, hardShadow } from '@/lib/theme';

export function UpdateBanner() {
  const { isUpdatePending } = Updates.useUpdates();
  const insets = useSafeAreaInsets();
  if (!Updates.isEnabled || !isUpdatePending) return null;
  return (
    <Animated.View entering={FadeInDown.duration(240)} style={[styles.wrap, { top: insets.top + 8 }]} pointerEvents="box-none">
      <Pressable
        onPress={() => { tap(); Updates.reloadAsync().catch(() => undefined); }}
        style={styles.pill}
        accessibilityRole="button"
        accessibilityLabel="Nouvelle version prête, relancer l’app">
        <Icon name="auto-awesome" size={18} color={C.amber} />
        <Txt font="bold" size={13} color={C.paper}>Nouvelle version prête · Relancer</Txt>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, paddingHorizontal: 16, borderRadius: 999, backgroundColor: C.ink, borderWidth: 2, borderColor: C.ink, boxShadow: hardShadow(3, C.pink) },
});
