import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brut, BrutBox, Chip, Display, Icon, Sticker, tap, Txt } from '@/components/ui';
import { addedLabel, formatQty } from '@/lib/data';
import { useStore } from '@/lib/store';
import { C, type Swatch, fg } from '@/lib/theme';

export default function RecipeScreen() {
  const { id, color } = useLocalSearchParams<{ id: string; color?: Swatch }>();
  const insets = useSafeAreaInsets();
  const recipe = useStore((s) => s.recipes.find((r) => r.id === id));
  const serves = useStore((s) => (recipe ? s.serves[recipe.id] ?? recipe.serves : 2));
  const setServes = useStore((s) => s.setServes);
  const [checked, setChecked] = useState<ReadonlySet<number>>(new Set());

  if (!recipe) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Display size={22}>Recette introuvable</Display>
        <Brut style={{ marginTop: 16, paddingHorizontal: 16, height: 44, justifyContent: 'center' }} onPress={() => router.back()}>
          <Txt font="bold">Retour</Txt>
        </Brut>
      </View>
    );
  }

  const sw: Swatch = color ?? 'teal';
  const factor = serves / recipe.serves;
  const toggle = (i: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 140 }}>
        <View style={styles.bar}>
          <Brut radius={12} style={styles.sq} onPress={() => router.back()} accessibilityLabel="Retour">
            <Icon name="arrow-back" />
          </Brut>
        </View>

        <BrutBox color={C[sw]} radius={24} style={styles.hero}>
          <Txt font="semi" size={13} color={fg(sw)} style={{ opacity: 0.85, marginBottom: 6 }}>{addedLabel(recipe.addedAt)}</Txt>
          <Display size={36} color={fg(sw)} style={{ maxWidth: '64%' }}>{recipe.name}</Display>
          <Sticker recipe={recipe} size={226} rotate={-12} style={{ right: -30, top: -66 }} delay={120} />
        </BrutBox>

        <Animated.View entering={FadeInDown.delay(120).springify()} style={styles.chips}>
          <Chip label={recipe.type} />
          {recipe.diets.map((d) => <Chip key={d} label={d} />)}
          <Chip label={`${recipe.time} min`} icon="timer" />
        </Animated.View>

        {recipe.note ? (
          <Animated.View entering={FadeInDown.delay(180).springify()}>
            <Txt size={16} style={{ marginHorizontal: 16, marginTop: 14, lineHeight: 23 }}>{recipe.note}</Txt>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(240).springify()} style={styles.block}>
          <View style={styles.blockHead}>
            <Display size={22}>Ingrédients</Display>
            <BrutBox radius={12} style={styles.stepper}>
              <Pressable onPress={() => { tap(); setServes(recipe.id, Math.max(1, serves - 1)); }} style={styles.stepBtn} accessibilityLabel="Moins de personnes">
                <Icon name="remove" />
              </Pressable>
              <Animated.View key={serves} entering={ZoomIn.springify()} style={styles.stepVal}>
                <Txt font="bold" size={14}>{serves} pers.</Txt>
              </Animated.View>
              <Pressable onPress={() => { tap(); setServes(recipe.id, Math.min(12, serves + 1)); }} style={styles.stepBtn} accessibilityLabel="Plus de personnes">
                <Icon name="add" />
              </Pressable>
            </BrutBox>
          </View>
          {recipe.ingredients.map(([q, unit, label], i) => {
            const done = checked.has(i);
            return (
              <Pressable key={`${label}-${i}`} onPress={() => { tap(); toggle(i); }} style={({ pressed }) => [styles.ing, pressed && { backgroundColor: 'rgba(42,21,48,0.06)' }]}>
                <View style={[styles.box, done && { backgroundColor: C.olive }]}>
                  {done ? <Animated.View entering={ZoomIn.springify()}><Icon name="check" size={18} /></Animated.View> : null}
                </View>
                <Animated.View key={`${serves}`} entering={FadeInDown.springify()} style={{ width: 96 }}>
                  <Txt font="bold" size={16} style={{ opacity: done ? 0.45 : 1 }}>{formatQty(q, unit, factor)}</Txt>
                </Animated.View>
                <Txt size={16} style={{ flex: 1, opacity: done ? 0.45 : 1, textDecorationLine: done ? 'line-through' : 'none' }}>{label}</Txt>
              </Pressable>
            );
          })}
        </Animated.View>

        {recipe.tools.length ? (
          <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.block}>
            <Display size={22} style={{ marginBottom: 12 }}>Ustensiles</Display>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {recipe.tools.map((t) => <Chip key={t} label={t} color={C.amber} />)}
            </View>
          </Animated.View>
        ) : null}

        {recipe.steps.length ? (
          <Animated.View entering={FadeInDown.delay(360).springify()} style={styles.block}>
            <Display size={22} style={{ marginBottom: 12 }}>Étapes</Display>
            {recipe.steps.map(([text], i) => (
              <View key={`${i}-${text}`} style={styles.step}>
                <BrutBox radius={10} offset={2} style={styles.num}>
                  <Display size={17}>{i + 1}</Display>
                </BrutBox>
                <Txt size={16} style={{ flex: 1, lineHeight: 23 }}>{text}</Txt>
              </View>
            ))}
          </Animated.View>
        ) : null}
      </ScrollView>

      {recipe.steps.length ? (
        <View style={[styles.cookbar, { paddingBottom: insets.bottom + 16 }]}>
          <Brut color={C.amber} style={styles.cookBtn} onPress={() => router.push({ pathname: '/cook/[id]', params: { id: recipe.id } })}>
            <Icon name="play-arrow" size={28} />
            <Display size={19}>Cuisiner</Display>
          </Brut>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  sq: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  hero: { marginTop: 36, marginHorizontal: 16, minHeight: 210, padding: 18, justifyContent: 'flex-end', overflow: 'visible' },
  chips: { marginTop: 18, marginHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  block: { marginTop: 28, marginHorizontal: 16 },
  blockHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  stepper: { flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  stepBtn: { width: 40, height: 38, alignItems: 'center', justifyContent: 'center' },
  stepVal: { height: 38, paddingHorizontal: 10, justifyContent: 'center', borderLeftWidth: 2, borderRightWidth: 2, borderColor: C.ink },
  ing: { flexDirection: 'row', alignItems: 'center', minHeight: 46, borderRadius: 10, paddingHorizontal: 2 },
  box: { width: 24, height: 24, borderWidth: 2, borderColor: C.ink, borderRadius: 6, backgroundColor: C.tile, marginRight: 10, alignItems: 'center', justifyContent: 'center' },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 14 },
  num: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  cookbar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 14, paddingHorizontal: 16, backgroundColor: 'rgba(244,239,243,0.94)' },
  cookBtn: { height: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
