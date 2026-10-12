import { Directory, File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { type ReactNode, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSequence, withTiming, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brut, BrutBox, Chip, Display, Icon, type IconName, Sticker, tap, Txt } from '@/components/ui';
import { CATALOG, type Kind, parseIngredient, type Recipe } from '@/lib/data';
import { useStore } from '@/lib/store';
import { C, F } from '@/lib/theme';

const newId = (): string => `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

async function keepPhoto(uri: string, id: string): Promise<string> {
  const dir = new Directory(Paths.document, 'photos');
  dir.create({ idempotent: true });
  const ext = uri.split('?')[0].split('.').pop() || 'jpg';
  const dest = new File(dir, `${id}.${ext}`);
  await new File(uri).copy(dest);
  return dest.uri;
}

export default function CreateScreen() {
  const insets = useSafeAreaInsets();
  const folders = useStore((s) => s.folders);
  const addRecipe = useStore((s) => s.addRecipe);
  const [id] = useState(newId);
  const [photo, setPhoto] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [type, setType] = useState('Plat');
  const [picked, setPicked] = useState<Record<Exclude<Kind, 'type'>, string[]>>({ diet: [], tool: [] });
  const [folderId, setFolderId] = useState<string | null>(null);
  const [time, setTime] = useState('20');
  const [ings, setIngs] = useState<string[]>(['']);
  const [steps, setSteps] = useState<string[]>(['']);
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
      photoUri: photo ?? undefined,
      type,
      diets: picked.diet,
      tools: picked.tool,
      time: Math.max(1, Number.parseInt(time, 10) || 20),
      serves: 2,
      addedAt: Date.now(),
      note: note.trim(),
      ingredients: ings.map((l) => l.trim()).filter(Boolean).map(parseIngredient),
      steps: steps.map((s) => s.trim()).filter(Boolean).map((s) => [s, Number(s.match(/(\d+)\s*min/)?.[1] ?? 0)] as [string, number]),
    };
    addRecipe(recipe, folderId);
    setSaved(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    setTimeout(() => router.back(), 900);
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
        <Txt font="semi" color={C.muted}>Nouvelle recette</Txt>
        <Brut color={C.ink} shadow={C.pink} radius={12} style={styles.save} onPress={save}>
          <Txt font="bold" color={C.paper}>Enregistrer</Txt>
        </Brut>
      </View>

      <ScrollView ref={scroll} contentContainerStyle={{ paddingBottom: 150 }} keyboardShouldPersistTaps="handled">
        <BrutBox color={C.teal} radius={22} style={styles.photo}>
          {photo ? (
            <>
              <Sticker recipe={{ photoUri: photo, name }} size={190} rotate={-10} style={{ right: 4, top: -40 }} />
              <Animated.View entering={ZoomIn.delay(300).springify()} style={styles.badge}>
                <Icon name="auto-awesome" size={16} color={C.amber} />
                <Txt font="bold" size={12} color={C.amber} style={{ lineHeight: 16 }}>Sticker prêt</Txt>
              </Animated.View>
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
              <Brut key={t} color={on ? C.pink : C.tile} radius={14} offset={on ? 6 : 4} style={styles.typeBtn} onPress={() => setType(t)}>
                {on ? <Animated.View entering={ZoomIn.springify()}><Icon name="check-circle" size={20} color={C.onDark} /></Animated.View> : null}
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
          {folders.map((f) => <Chip key={f.id} label={f.name} color={folderId === f.id ? C.plum : C.tile} textColor={folderId === f.id ? C.onDark : C.ink} onPress={() => setFolderId((cur) => (cur === f.id ? null : f.id))} />)}
        </Prop>

        <View style={styles.section}>
          <Display size={22}>Ingrédients</Display>
          <Txt size={13} color={C.muted} style={{ marginTop: 4 }}>Un par ligne, par exemple « 200 g lentilles corail ».</Txt>
          {ings.map((v, i) => (
            <Animated.View key={`ing-${i}`} entering={FadeIn} style={styles.line}>
              <View style={styles.dot} />
              <TextInput value={v} onChangeText={(t) => setIngs((arr) => arr.map((x, k) => (k === i ? t : x)))} placeholder="Quantité et ingrédient" placeholderTextColor={C.muted} style={styles.lineInput} />
            </Animated.View>
          ))}
        </View>

        <View style={styles.section}>
          <Display size={22}>Étapes</Display>
          <Txt size={13} color={C.muted} style={{ marginTop: 4 }}>Écris « 10 min » dans une étape pour avoir un minuteur.</Txt>
          {steps.map((v, i) => (
            <Animated.View key={`step-${i}`} entering={FadeIn} style={styles.line}>
              <Display size={16} style={{ width: 22 }}>{i + 1}</Display>
              <TextInput value={v} onChangeText={(t) => setSteps((arr) => arr.map((x, k) => (k === i ? t : x)))} placeholder="Ce qu’il faut faire" placeholderTextColor={C.muted} style={styles.lineInput} multiline />
            </Animated.View>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.blocks, { paddingBottom: insets.bottom + 12 }]}>
        <Txt font="semi" size={13} color={C.muted} style={{ marginBottom: 10 }}>Ajouter un bloc</Txt>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {blocks.map((b) => (
            <Brut key={b.label} color={b.color} style={styles.blk} onPress={b.onPress}>
              <Icon name={b.icon} size={26} color={b.textColor ?? C.ink} />
              <Txt font="bold" size={12} color={b.textColor ?? C.ink} style={{ lineHeight: 15 }}>{b.label}</Txt>
            </Brut>
          ))}
        </View>
      </View>

      {saved ? (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]} pointerEvents="none">
          <Animated.View entering={ZoomIn.springify().damping(9)} style={styles.stamp}>
            <Display size={38}>Enregistré !</Display>
          </Animated.View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
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
  blocks: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 12, paddingHorizontal: 16, backgroundColor: C.paper, borderTopWidth: 2, borderColor: C.ink },
  blk: { flex: 1, height: 70, alignItems: 'center', justifyContent: 'center', gap: 5 },
  stamp: { paddingHorizontal: 34, paddingVertical: 20, borderRadius: 26, backgroundColor: C.amber, borderWidth: 3, borderColor: C.ink, boxShadow: '0px 0px 0px 8px #FFFFFF, 0px 14px 24px rgba(42,21,48,0.3)', transform: [{ rotate: '-8deg' }] },
});
