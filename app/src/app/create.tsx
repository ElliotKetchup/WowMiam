import { Directory, File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brut, BrutBox, Chip, Display, Icon, type IconName, stampIn, tap, Txt } from '@/components/ui';
import { Sticker } from '@/components/sticker';
import { CATALOG, ingredientLine, type Kind, parseIngredient, photoOf, type Recipe, type Step } from '@/lib/data';
import { useStore } from '@/lib/store';
import { C, F } from '@/lib/theme';

const newId = (): string => `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

async function keepPhoto(uri: string, id: string): Promise<string> {
  const dir = new Directory(Paths.document, 'photos');
  dir.create({ idempotent: true });
  const ext = uri.split('?')[0].split('.').pop() || 'jpg';
  // Unique name: re-picking a photo while editing must not collide with (or be cached as) the old one.
  const dest = new File(dir, `${id}-${Date.now().toString(36)}.${ext}`);
  await new File(uri).copy(dest);
  return dest.uri;
}

/** "Écris 10 min" gives a timer; otherwise an unchanged step keeps the timer it had. */
function toSteps(lines: readonly string[], previous: readonly Step[]): Step[] {
  const known = new Map(previous);
  return lines
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => [s, Number(s.match(/(\d+)\s*min/)?.[1] ?? known.get(s) ?? 0)]);
}

/** Creates a recipe, or edits one when opened with `?id=`. */
export default function EditorScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const existing = useStore((s) => (params.id ? s.recipes.find((r) => r.id === params.id) : undefined));
  const folders = useStore((s) => s.folders);
  const saveRecipe = useStore((s) => s.saveRecipe);
  const deleteRecipe = useStore((s) => s.deleteRecipe);
  const editing = !!existing;
  const [id] = useState(() => existing?.id ?? newId());
  const [photo, setPhoto] = useState<string | null>(existing ? photoOf(existing) ?? null : null);
  const [freshPhoto, setFreshPhoto] = useState(false);
  const [name, setName] = useState(existing?.name ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [type, setType] = useState(existing?.type ?? 'Plat');
  const [picked, setPicked] = useState<Record<Exclude<Kind, 'type'>, string[]>>({ diet: existing?.diets ?? [], tool: existing?.tools ?? [] });
  const [folderIds, setFolderIds] = useState<string[]>(() => folders.filter((f) => existing && f.ids.includes(existing.id)).map((f) => f.id));
  const [time, setTime] = useState(String(existing?.time ?? 20));
  const [ings, setIngs] = useState<string[]>(() => (existing?.ingredients.length ? existing.ingredients.map(ingredientLine) : ['']));
  const [steps, setSteps] = useState<string[]>(() => (existing?.steps.length ? existing.steps.map(([t]) => t) : ['']));
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const shakeX = useSharedValue(0);
  const shake = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));

  const pick = async (camera: boolean) => {
    tap();
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [1, 1] };
    if (camera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return;
    }
    const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets[0]) return;
    try {
      setPhoto(await keepPhoto(res.assets[0].uri, id));
    } catch {
      setPhoto(res.assets[0].uri);
    }
    setFreshPhoto(true);
  };

  const toggle = (kind: 'diet' | 'tool', label: string) =>
    setPicked((p) => ({ ...p, [kind]: p[kind].includes(label) ? p[kind].filter((t) => t !== label) : [...p[kind], label] }));

  const save = () => {
    if (!name.trim()) {
      setError(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      shakeX.value = withSequence(withTiming(-10, { duration: 50 }), withTiming(9, { duration: 60 }), withTiming(-6, { duration: 60 }), withTiming(0, { duration: 60 }));
      scroll.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    const recipe: Recipe = {
      id,
      name: name.trim(),
      sticker: existing?.sticker,
      // A synced photo shown as-is stays remote; a newly picked one becomes the local file (and is uploaded again).
      photoUri: photo && photo !== existing?.photoUrl ? photo : existing?.photoUri,
      photoUrl: existing?.photoUrl,
      photoKey: existing?.photoKey,
      type,
      diets: picked.diet,
      tools: picked.tool,
      time: Math.max(1, Number.parseInt(time, 10) || 20),
      serves: existing?.serves ?? 2,
      addedAt: existing?.addedAt ?? Date.now(),
      note: note.trim(),
      ingredients: ings.map((l) => l.trim()).filter(Boolean).map(parseIngredient),
      steps: toSteps(steps, existing?.steps ?? []),
    };
    saveRecipe(recipe, folderIds);
    setSaved(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    setTimeout(() => router.back(), 900);
  };

  const remove = () => {
    Alert.alert('Supprimer cette recette ?', 'Elle sera retirée de tous ses dossiers. C’est définitif.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          router.dismissAll();
          setTimeout(() => deleteRecipe(id), 400);
        },
      },
    ]);
  };

  const blocks: { label: string; icon: IconName; color: string; textColor?: string; onPress: () => void }[] = [
    { label: 'Ingrédient', icon: 'local-grocery-store', color: C.olive, onPress: () => { setIngs((v) => [...v, '']); setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 80); } },
    { label: 'Étape', icon: 'format-list-numbered', color: C.amber, onPress: () => { setSteps((v) => [...v, '']); setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 80); } },
    { label: 'Galerie', icon: 'image', color: C.tile, onPress: () => pick(false) },
    { label: 'Photo', icon: 'add-a-photo', color: C.pink, textColor: C.onDark, onPress: () => pick(true) },
  ];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.paper }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.bar, { marginTop: insets.top }]}>
        <Brut radius={12} style={styles.sq} onPress={() => router.back()} accessibilityLabel="Fermer">
          <Icon name="close" />
        </Brut>
        <Txt font="semi" color={C.muted}>{editing ? 'Modifier la recette' : 'Nouvelle recette'}</Txt>
        <Brut color={C.ink} shadow={C.pink} radius={12} style={styles.save} onPress={save}>
          <Txt font="bold" color={C.paper}>Enregistrer</Txt>
        </Brut>
      </View>

      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <BrutBox color={C.teal} radius={22} style={styles.photo}>
          {photo || existing?.sticker ? (
            <>
              <Sticker key={photo ?? 'sticker'} recipe={{ photoUri: photo ?? undefined, sticker: existing?.sticker, name }} size={190} rotate={-10} style={{ right: 4, top: -40 }} />
              {freshPhoto ? (
                <Animated.View entering={FadeIn.delay(450).duration(200)} style={styles.badge}>
                  <Icon name="auto-awesome" size={16} color={C.amber} />
                  <Txt font="bold" size={12} color={C.amber} style={{ lineHeight: 16 }}>Sticker prêt</Txt>
                </Animated.View>
              ) : null}
            </>
          ) : (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Brut radius={12} style={styles.pickBtn} onPress={() => pick(true)}>
                <Icon name="photo-camera" />
                <Txt font="bold" size={13}>Prendre une photo</Txt>
              </Brut>
              <Brut radius={12} style={styles.pickBtn} onPress={() => pick(false)}>
                <Icon name="image" />
                <Txt font="bold" size={13}>Galerie</Txt>
              </Brut>
            </View>
          )}
        </BrutBox>

        <Animated.View style={shake}>
          <TextInput
            value={name}
            onChangeText={(v) => { setName(v); if (v.trim()) setError(false); }}
            placeholder="Nom de la recette"
            placeholderTextColor="rgba(42,21,48,0.3)"
            style={styles.title}
            accessibilityLabel="Nom de la recette"
          />
        </Animated.View>
        <Txt size={14} font={error ? 'bold' : 'body'} color={error ? C.coral : C.muted} style={{ marginHorizontal: 16, marginTop: 4 }}>
          {error ? 'Donne un nom à ta recette pour l’enregistrer.' : 'Seul le nom est obligatoire.'}
        </Txt>
        <TextInput value={note} onChangeText={setNote} placeholder="Une petite note (facultatif)" placeholderTextColor={C.muted} style={styles.note} multiline />

        <View style={styles.types}>
          {CATALOG.type.map((t) => {
            const on = type === t;
            return (
              <Brut key={t} color={on ? C.pink : C.tile} radius={14} style={styles.typeBtn} onPress={() => setType(t)}>
                {on ? <Animated.View entering={FadeIn.duration(120)}><Icon name="check-circle" size={20} color={C.onDark} /></Animated.View> : null}
                <Display size={15} color={on ? C.onDark : C.ink}>{t}</Display>
              </Brut>
            );
          })}
        </View>

        <Prop icon="eco" label="Régime">
          {CATALOG.diet.map((d) => <Chip key={d} label={d} color={picked.diet.includes(d) ? C.olive : C.tile} onPress={() => toggle('diet', d)} />)}
        </Prop>
        <Prop icon="soup-kitchen" label="Ustensiles">
          {CATALOG.tool.map((d) => <Chip key={d} label={d} color={picked.tool.includes(d) ? C.amber : C.tile} onPress={() => toggle('tool', d)} />)}
        </Prop>
        <Prop icon="timer" label="Temps">
          <View style={styles.timeBox}>
            <TextInput value={time} onChangeText={(v) => setTime(v.replace(/\D/g, ''))} keyboardType="number-pad" style={styles.timeInput} maxLength={3} />
            <Txt font="semi">min</Txt>
          </View>
        </Prop>
        <Prop icon="folder" label="Dossier">
          {folders.map((f) => {
            const on = folderIds.includes(f.id);
            return <Chip key={f.id} label={f.name} color={on ? C.plum : C.tile} textColor={on ? C.onDark : C.ink} onPress={() => setFolderIds((cur) => (on ? cur.filter((x) => x !== f.id) : [...cur, f.id]))} />;
          })}
        </Prop>

        <View style={styles.section}>
          <Display size={22}>Ingrédients</Display>
          <Txt size={13} color={C.muted} style={{ marginTop: 4 }}>Par exemple « 200 g lentilles corail ». Entrée pour passer au suivant.</Txt>
          <LineList lines={ings} onChange={setIngs} placeholder="Quantité et ingrédient" bullet={() => <View style={styles.dot} />} />
        </View>

        <View style={styles.section}>
          <Display size={22}>Étapes</Display>
          <Txt size={13} color={C.muted} style={{ marginTop: 4 }}>Entrée pour l’étape suivante. Écris « 10 min » pour avoir un minuteur.</Txt>
          <LineList lines={steps} onChange={setSteps} placeholder="Ce qu’il faut faire" bullet={(i) => <Display size={16} style={{ width: 22 }}>{i + 1}</Display>} multiline />
        </View>

        {editing ? (
          <Pressable onPress={remove} style={styles.danger} hitSlop={6}>
            <Icon name="delete-outline" size={20} color={C.coral} />
            <Txt font="semi" color={C.coral}>Supprimer la recette</Txt>
          </Pressable>
        ) : null}
      </ScrollView>

      {/* In the layout flow (not floating), so it can never cover the end of the form. */}
      <View style={[styles.blocks, { paddingBottom: insets.bottom + 10 }]}>
        {blocks.map((b) => (
          <Brut key={b.label} color={b.color} radius={12} offset={3} style={styles.blk} onPress={b.onPress} accessibilityLabel={`Ajouter : ${b.label}`}>
            <Icon name={b.icon} size={20} color={b.textColor ?? C.ink} />
            <Txt font="bold" size={11} color={b.textColor ?? C.ink} style={{ lineHeight: 13 }}>{b.label}</Txt>
          </Brut>
        ))}
      </View>

      {saved ? (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]} pointerEvents="none">
          <Animated.View entering={stampIn} style={styles.stamp}>
            <Display size={38}>{editing ? 'Modifié !' : 'Enregistré !'}</Display>
          </Animated.View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

type LineListProps = {
  lines: string[];
  onChange: (lines: string[]) => void;
  placeholder: string;
  bullet: (index: number) => ReactNode;
  /** Long lines wrap on screen, but Enter still starts a new line item. */
  multiline?: boolean;
};

/**
 * Notion-style list: Enter adds a new item right after the current one and moves the cursor there,
 * Enter on an empty item closes the keyboard, Backspace on an empty item removes it.
 */
function LineList({ lines, onChange, placeholder, bullet, multiline = false }: LineListProps) {
  const refs = useRef<(TextInput | null)[]>([]);
  const focusAt = useRef<number | null>(null);
  const prevLength = useRef(lines.length);

  useEffect(() => {
    const grew = lines.length > prevLength.current;
    prevLength.current = lines.length;
    const target = focusAt.current ?? (grew ? lines.length - 1 : null);
    focusAt.current = null;
    if (target === null) return undefined;
    // After the key event finishes, so the Backspace that removed a line doesn't also hit the one we focus.
    const t = setTimeout(() => refs.current[target]?.focus(), 0);
    return () => clearTimeout(t);
  }, [lines]);

  const insertAfter = (i: number) => {
    if (!lines[i].trim()) {
      refs.current[i]?.blur();
      return;
    }
    focusAt.current = i + 1;
    onChange([...lines.slice(0, i + 1), '', ...lines.slice(i + 1)]);
  };
  const removeAt = (i: number) => {
    if (lines.length <= 1) return;
    focusAt.current = Math.max(0, i - 1);
    onChange(lines.filter((_, k) => k !== i));
  };

  return lines.map((v, i) => (
    <View key={i} style={styles.line}>
      {bullet(i)}
      <TextInput
        ref={(el) => { refs.current[i] = el; }}
        value={v}
        onChangeText={(t) => onChange(lines.map((x, k) => (k === i ? t : x)))}
        onSubmitEditing={() => insertAfter(i)}
        onKeyPress={({ nativeEvent }) => { if (nativeEvent.key === 'Backspace' && v === '') removeAt(i); }}
        submitBehavior="submit"
        returnKeyType="next"
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor={C.muted}
        style={styles.lineInput}
      />
    </View>
  ));
}

function Prop({ icon, label, children }: { icon: IconName; label: string; children: ReactNode }) {
  return (
    <View style={styles.prop}>
      <View style={styles.propKey}>
        <Icon name={icon} size={20} color={C.muted} />
        <Txt color={C.muted} size={14}>{label}</Txt>
      </View>
      <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 60, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sq: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  save: { height: 44, paddingHorizontal: 16, justifyContent: 'center' },
  photo: { marginTop: 34, marginHorizontal: 16, height: 140, padding: 12, justifyContent: 'flex-end', overflow: 'visible' },
  pickBtn: { flex: 1, height: 64, alignItems: 'center', justifyContent: 'center', gap: 4 },
  badge: { position: 'absolute', left: 12, bottom: 12, height: 32, paddingHorizontal: 11, borderRadius: 10, backgroundColor: C.ink, flexDirection: 'row', alignItems: 'center', gap: 5 },
  title: { marginTop: 22, marginHorizontal: 16, fontFamily: F.display, fontSize: 28, color: C.ink, paddingVertical: 4 },
  note: { marginHorizontal: 16, marginTop: 8, fontFamily: F.body, fontSize: 15, color: C.ink, paddingVertical: 4 },
  types: { marginTop: 18, marginHorizontal: 16, flexDirection: 'row', gap: 10 },
  typeBtn: { flex: 1, height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  prop: { marginHorizontal: 16, marginTop: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  propKey: { width: 104, height: 28, flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeBox: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 10, borderWidth: 2, borderColor: C.ink, borderRadius: 10, backgroundColor: C.tile },
  timeInput: { minWidth: 32, fontFamily: F.bold, fontSize: 15, color: C.ink, paddingVertical: 0, textAlign: 'center' },
  section: { marginHorizontal: 16, marginTop: 26 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, borderBottomWidth: 1, borderColor: 'rgba(42,21,48,0.12)' },
  dot: { width: 12, height: 12, borderWidth: 2, borderColor: C.ink, borderRadius: 3 },
  lineInput: { flex: 1, fontFamily: F.medium, fontSize: 15, color: C.ink, paddingVertical: 8 },
  danger: { marginTop: 36, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8 },
  blocks: { flexDirection: 'row', gap: 8, paddingTop: 10, paddingHorizontal: 16, backgroundColor: C.paper, borderTopWidth: 2, borderColor: C.ink },
  blk: { flex: 1, height: 50, alignItems: 'center', justifyContent: 'center', gap: 2 },
  stamp: { paddingHorizontal: 34, paddingVertical: 20, borderRadius: 26, backgroundColor: C.amber, borderWidth: 3, borderColor: C.ink, boxShadow: '0px 0px 0px 8px #FFFFFF, 0px 14px 24px rgba(42,21,48,0.3)' },
});
