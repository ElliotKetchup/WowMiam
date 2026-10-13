import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, SlideInRight, SlideOutLeft } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brut, BrutBox, Display, Icon, STICKER_LAG, Sticker, Txt } from '@/components/ui';
import { useStore } from '@/lib/store';
import { C, hardShadow } from '@/lib/theme';

export default function CookScreen() {
  useKeepAwake();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const recipe = useStore((s) => s.recipes.find((r) => r.id === id));
  const [i, setI] = useState(0);
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    if (left === null || left <= 0) return undefined;
    const t = setTimeout(() => setLeft((v) => (v === null ? null : v - 1)), 1000);
    return () => clearTimeout(t);
  }, [left]);

  useEffect(() => {
    if (left === 0) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
  }, [left]);

  if (!recipe) return null;
  const steps = recipe.steps;
  const done = i >= steps.length;
  const [text, minutes] = done ? ['', 0] : steps[i];

  const next = () => {
    setLeft(null);
    setI((v) => v + 1);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.aubergine, paddingTop: insets.top }}>
      <StatusBar style="light" />
      <View style={styles.bar}>
        <Brut color="transparent" radius={12} shadow="transparent" style={[styles.sq, { borderColor: C.paper }]} onPress={() => router.back()} accessibilityLabel="Fermer">
          <Icon name="close" color={C.paper} />
        </Brut>
        <View style={styles.prog}>
          {steps.map((_, k) => (
            <View key={k} style={styles.seg}>
              {k <= i ? <Animated.View entering={SlideInRight.duration(240)} style={styles.segFill} /> : null}
            </View>
          ))}
        </View>
        <Display size={16} color={C.paper}>{Math.min(i + 1, steps.length)}/{steps.length}</Display>
      </View>

      <View style={styles.stage}>
        <Animated.View key={i} entering={SlideInRight.duration(280)} exiting={SlideOutLeft.duration(240)} style={StyleSheet.absoluteFill}>
          <BrutBox color={C.paper} radius={26} offset={6} style={[styles.card, { boxShadow: hardShadow(6, C.teal) }]}>
            {done ? (
              <>
                <Display size={18} color={C.pink}>C’est prêt</Display>
                <Display size={50} style={{ marginTop: 10 }}>Bon appétit !</Display>
                <Sticker recipe={recipe} size={240} rotate={-10} style={{ right: -26, bottom: -40 }} delay={STICKER_LAG} />
              </>
            ) : (
              <>
                <Display size={18} color={C.pink}>Étape {i + 1}</Display>
                <Display size={32} style={{ marginTop: 14, lineHeight: 37 }}>{text}</Display>
                {minutes ? (
                  <Brut
                    color={left !== null ? C.pink : C.amber}
                    radius={14}
                    style={styles.timer}
                    onPress={() => setLeft((v) => (v === null ? minutes * 60 : null))}>
                    <Icon name="timer" color={left !== null ? C.onDark : C.ink} />
                    <Display size={20} color={left !== null ? C.onDark : C.ink}>
                      {left === null ? `${minutes}:00` : left === 0 ? 'C’est l’heure !' : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`}
                    </Display>
                  </Brut>
                ) : null}
                <Sticker recipe={recipe} size={150} rotate={9} style={{ right: -18, bottom: -26 }} delay={STICKER_LAG} />
              </>
            )}
          </BrutBox>
        </Animated.View>
      </View>

      <View style={[styles.foot, { paddingBottom: insets.bottom + 20 }]}>
        <Brut color={C.amber} shadow={C.paper} style={styles.next} onPress={done ? () => router.back() : next}>
          <Animated.View key={done ? 'end' : i === steps.length - 1 ? 'last' : 'next'} entering={FadeIn.duration(160)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Display size={19}>{done ? 'Fermer' : i === steps.length - 1 ? 'Terminer' : 'Étape suivante'}</Display>
            <Icon name="arrow-forward" />
          </Animated.View>
        </Brut>
        <Txt size={13} color={C.paper} style={{ textAlign: 'center', marginTop: 12, opacity: 0.7 }}>L’écran reste allumé pendant que tu cuisines.</Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 64, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  sq: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  prog: { flex: 1, flexDirection: 'row', gap: 6 },
  seg: { flex: 1, height: 8, borderRadius: 4, backgroundColor: 'rgba(244,239,243,0.22)', overflow: 'hidden' },
  segFill: { flex: 1, backgroundColor: C.amber },
  stage: { flex: 1, marginHorizontal: 16, marginTop: 24, marginBottom: 20 },
  card: { flex: 1, padding: 24, overflow: 'visible' },
  timer: { alignSelf: 'flex-start', marginTop: 22, height: 56, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 8 },
  foot: { paddingHorizontal: 16 },
  next: { height: 64, alignItems: 'center', justifyContent: 'center', borderColor: C.paper },
});
