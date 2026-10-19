import { router, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MiniCover } from '@/components/books';
import { Sheet } from '@/components/sheets';
import { Brut, BrutBox, Chip, Display, Icon, StatusShade, tap, Txt } from '@/components/ui';
import { Sticker } from '@/components/sticker';
import { useAccount } from '@/lib/account';
import { type Book, canCook, firstName } from '@/lib/books';
import { copyRecipeToBook } from '@/lib/cloud';
import { addedLabel, formatQty, photoOf, type Recipe } from '@/lib/data';
import { useRole, useStore } from '@/lib/store';
import { C, type Swatch, fg } from '@/lib/theme';

/** Shrinks the hero title so its longest word never breaks mid-word in the ~200 dp left of the sticker. */
function heroTitleSize(name: string): number {
  const longest = Math.max(...name.split(/\s+/).map((w) => w.length));
  const base = name.length > 22 ? 28 : 34;
  return Math.max(20, Math.min(base, Math.floor(190 / (longest * 0.62))));
}

export default function RecipeScreen() {
  const { id, color } = useLocalSearchParams<{ id: string; color?: Swatch }>();
  const insets = useSafeAreaInsets();
  const recipe = useStore((s) => s.recipes.find((r) => r.id === id));
  const serves = useStore((s) => (recipe ? s.serves[recipe.id] ?? recipe.serves : 2));
  const setServes = useStore((s) => s.setServes);
  const cooks = canCook(useRole());
  const myUid = useAccount((s) => s.account?.uid);
  const copyAction = useCopyToMyBook(recipe);
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
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 130 }}>
        <View style={styles.bar}>
          <Brut radius={12} style={styles.sq} onPress={() => router.back()} accessibilityLabel="Retour">
            <Icon name="arrow-back" />
          </Brut>
          {cooks ? (
            <Brut radius={12} style={styles.edit} onPress={() => router.push({ pathname: '/create', params: { id: recipe.id } })} accessibilityLabel="Modifier la recette">
              <Icon name="edit" size={20} />
              <Txt font="bold" size={14}>Modifier</Txt>
            </Brut>
          ) : (
            copyAction.button
          )}
        </View>

        <BrutBox color={C[sw]} radius={24} style={styles.hero}>
          <Txt font="semi" size={13} color={fg(sw)} style={{ opacity: 0.85, marginBottom: 6 }}>
            {addedLabel(recipe.addedAt)}
            {recipe.byUid && recipe.byUid !== myUid ? ` · ajoutée par ${firstName(recipe.byName)}` : ''}
          </Txt>
          <Display size={heroTitleSize(recipe.name)} color={fg(sw)} style={{ maxWidth: '58%' }} numberOfLines={5}>{recipe.name}</Display>
          <Sticker key={photoOf(recipe) ?? recipe.sticker} recipe={recipe} size={186} rotate={-12} style={{ right: -10, top: -40 }} delay={260} />
        </BrutBox>

        <Animated.View entering={FadeInDown.delay(80).duration(260)} style={styles.chips}>
          <Chip label={recipe.type} />
          {recipe.diets.map((d) => <Chip key={d} label={d} />)}
          <Chip label={`${recipe.time} min`} icon="timer" />
        </Animated.View>

        {recipe.note ? (
          <Animated.View entering={FadeInDown.delay(120).duration(260)}>
            <Txt size={16} style={{ marginHorizontal: 16, marginTop: 14, lineHeight: 23 }}>{recipe.note}</Txt>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(160).duration(260)} style={styles.block}>
          <View style={styles.blockHead}>
            <Display size={22}>Ingrédients</Display>
            <BrutBox radius={12} style={styles.stepper}>
              <Pressable onPress={() => { tap(); setServes(recipe.id, Math.max(1, serves - 1)); }} style={styles.stepBtn} accessibilityLabel="Moins de personnes">
                <Icon name="remove" />
              </Pressable>
              <Animated.View key={serves} entering={FadeIn.duration(140)} style={styles.stepVal}>
                <Txt font="bold" size={14} style={{ fontVariant: ['tabular-nums'] }}>{serves} pers.</Txt>
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
                  {done ? <Animated.View entering={FadeIn.duration(120)}><Icon name="check" size={18} /></Animated.View> : null}
                </View>
                <Animated.View key={`${serves}`} entering={FadeIn.duration(160)} style={{ width: 96 }}>
                  <Txt font="bold" size={16} style={{ opacity: done ? 0.45 : 1 }}>{formatQty(q, unit, factor)}</Txt>
                </Animated.View>
                <Txt size={16} style={{ flex: 1, opacity: done ? 0.45 : 1, textDecorationLine: done ? 'line-through' : 'none' }}>{label}</Txt>
              </Pressable>
            );
          })}
        </Animated.View>

        {recipe.tools.length ? (
          <Animated.View entering={FadeInDown.delay(200).duration(260)} style={styles.block}>
            <Display size={22} style={{ marginBottom: 12 }}>Ustensiles</Display>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {recipe.tools.map((t) => <Chip key={t} label={t} color={C.amber} />)}
            </View>
          </Animated.View>
        ) : null}

        {recipe.steps.length ? (
          <Animated.View entering={FadeInDown.delay(240).duration(260)} style={styles.block}>
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

      <StatusShade height={insets.top} />
      {recipe.steps.length ? (
        <View style={[styles.cookbar, { paddingBottom: insets.bottom + 16 }]}>
          <Brut color={C.amber} style={styles.cookBtn} onPress={() => router.push({ pathname: '/cook/[id]', params: { id: recipe.id } })}>
            <Icon name="play-arrow" size={28} />
            <Display size={19}>Cuisiner</Display>
          </Brut>
        </View>
      ) : null}
      {copyAction.sheet}
    </View>
  );
}

/** For a Commis: keep a copy of this recipe in one of my own books. The sheet goes at the screen's root. */
function useCopyToMyBook(recipe: Recipe | undefined): { button: ReactNode; sheet: ReactNode } {
  const books = useStore((s) => s.books);
  const bookId = useStore((s) => s.bookId);
  const targets = books.filter((b) => b.id !== bookId && canCook(b.role));
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [pickOpen, setPickOpen] = useState(false);
  const [doneIn, setDoneIn] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const copy = async (book: Book) => {
    if (!recipe) return;
    setPickOpen(false);
    setState('busy');
    setProblem(null);
    try {
      await copyRecipeToBook(recipe, book.id);
      setDoneIn(book.name);
      setState('done');
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
      setState('idle');
    }
  };

  const button = (
    <View style={{ alignItems: 'flex-end', flexShrink: 1, marginLeft: 12 }}>
      <Brut
        color={state === 'done' ? C.olive : C.tile}
        radius={12}
        style={styles.edit}
        disabled={state !== 'idle' || !targets.length}
        onPress={() => (targets.length === 1 ? copy(targets[0]) : setPickOpen(true))}
        accessibilityLabel="Copier dans mon livre">
        {state === 'busy' ? <ActivityIndicator color={C.ink} /> : <Icon name={state === 'done' ? 'check' : 'content-copy'} size={20} />}
        <Txt font="bold" size={14} numberOfLines={1} style={{ flexShrink: 1 }}>{state === 'done' ? `Copiée dans « ${doneIn} »` : 'Copier dans mon livre'}</Txt>
      </Brut>
      {problem ? <Txt size={12} font="semi" color={C.coral} style={{ marginTop: 6 }}>{problem}</Txt> : null}
    </View>
  );
  const sheet = (
    <Sheet visible={pickOpen} onClose={() => setPickOpen(false)} title="Copier dans…">
      <View style={{ gap: 12, paddingBottom: 8 }}>
        {targets.map((b) => (
          <Brut key={b.id} radius={16} style={styles.target} onPress={() => copy(b)}>
            <MiniCover color={b.color} width={36} height={48} />
            <Display size={19} style={{ flex: 1 }} numberOfLines={2}>{b.name}</Display>
            <Icon name="chevron-right" />
          </Brut>
        ))}
      </View>
    </Sheet>
  );
  return { button, sheet };
}

const styles = StyleSheet.create({
  target: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  bar: { height: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  edit: { height: 44, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
  sq: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  hero: { marginTop: 36, marginHorizontal: 16, minHeight: 210, padding: 18, justifyContent: 'flex-end', overflow: 'visible' },
  chips: { marginTop: 18, marginHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  block: { marginTop: 28, marginHorizontal: 16 },
  blockHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  stepper: { flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  stepBtn: { width: 40, height: 38, alignItems: 'center', justifyContent: 'center' },
  // Fixed width so − and + never move when the count goes from 9 to 10.
  stepVal: { width: 78, height: 38, alignItems: 'center', justifyContent: 'center', borderLeftWidth: 2, borderRightWidth: 2, borderColor: C.ink },
  ing: { flexDirection: 'row', alignItems: 'center', minHeight: 46, borderRadius: 10, paddingHorizontal: 2 },
  box: { width: 24, height: 24, borderWidth: 2, borderColor: C.ink, borderRadius: 6, backgroundColor: C.tile, marginRight: 10, alignItems: 'center', justifyContent: 'center' },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 14 },
  num: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  cookbar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 14, paddingHorizontal: 16, backgroundColor: 'rgba(244,239,243,0.94)' },
  cookBtn: { height: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
