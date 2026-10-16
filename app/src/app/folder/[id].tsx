import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FolderSheet, RecipePickerSheet } from '@/components/sheets';
import { Brut, BrutBox, Chip, Display, Icon, StatusShade, STICKER_LAG, Txt } from '@/components/ui';
import { Sticker } from '@/components/sticker';
import { photoOf, type Recipe } from '@/lib/data';
import { useStore } from '@/lib/store';
import { C, type Swatch, fg } from '@/lib/theme';

export default function FolderScreen() {
  const { id, color } = useLocalSearchParams<{ id: string; color?: Swatch }>();
  const insets = useSafeAreaInsets();
  const folder = useStore((s) => s.folders.find((f) => f.id === id));
  const recipes = useStore((s) => s.recipes);
  const [editOpen, setEditOpen] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  if (!folder) return null;
  const sw: Swatch = folder.color ?? color ?? 'amber';
  const list = folder.ids.map((rid) => recipes.find((r) => r.id === rid)).filter((r): r is Recipe => !!r);
  const cover = list.find((r) => r.sticker || photoOf(r));

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40 }}>
        <View style={styles.bar}>
          <Brut radius={12} style={styles.sq} onPress={() => router.back()} accessibilityLabel="Retour">
            <Icon name="arrow-back" />
          </Brut>
          <Brut radius={12} style={styles.sq} onPress={() => setEditOpen(true)} accessibilityLabel="Modifier le dossier">
            <Icon name="edit" size={20} />
          </Brut>
        </View>

        <BrutBox color={C[sw]} radius={24} style={styles.head}>
          <View style={[styles.tab, { backgroundColor: C[sw] }]} />
          <View style={[styles.tabCover, { backgroundColor: C[sw] }]} />
          <Display size={36} color={fg(sw)} style={{ maxWidth: cover ? '60%' : '100%' }} numberOfLines={4}>{folder.name}</Display>
          <Txt font="semi" size={14} color={fg(sw)} style={{ marginTop: 10 }}>
            {list.length} recette{list.length > 1 ? 's' : ''}
          </Txt>
          {cover ? <Sticker key={cover.id} recipe={cover} size={136} rotate={12} style={{ right: -8, top: -34 }} delay={STICKER_LAG} /> : null}
        </BrutBox>

        <View style={{ marginTop: 30, marginHorizontal: 16, gap: 24 }}>
          {list.map((r, i) => (
            <Animated.View key={r.id} entering={FadeInDown.duration(260).delay(80 + i * 60)}>
              <Brut radius={20} style={styles.row} onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: r.id, color: 'teal' } })}>
                <Sticker recipe={r} size={118} rotate={-10} style={{ left: -12, top: -14 }} delay={80 + i * 60 + STICKER_LAG} />
                <View style={{ flex: 1, marginLeft: 116 }}>
                  <Display size={19} numberOfLines={3}>{r.name}</Display>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                    <Chip label={r.type} />
                    <Chip label={`${r.time} min`} />
                  </View>
                </View>
                <Icon name="chevron-right" />
              </Brut>
            </Animated.View>
          ))}
          {list.length === 0 ? (
            <View style={styles.empty}>
              <Txt style={{ textAlign: 'center' }}>Ce dossier est vide pour l’instant.</Txt>
            </View>
          ) : null}
          <Brut color={C.amber} radius={16} style={styles.add} onPress={() => setPickOpen(true)}>
            <Icon name="playlist-add" />
            <Display size={17}>{list.length ? 'Ajouter ou retirer des recettes' : 'Ranger des recettes ici'}</Display>
          </Brut>
        </View>
      </ScrollView>

      <StatusShade height={insets.top} />
      <FolderSheet visible={editOpen} onClose={() => setEditOpen(false)} folder={folder} defaultColor={sw} onDeleted={() => router.back()} />
      <RecipePickerSheet visible={pickOpen} onClose={() => setPickOpen(false)} folder={folder} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sq: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  head: { marginTop: 40, marginHorizontal: 16, minHeight: 180, padding: 18, justifyContent: 'flex-end', borderTopLeftRadius: 4, overflow: 'visible' },
  tab: { position: 'absolute', left: -2, top: -20, width: 96, height: 20, borderWidth: 2, borderBottomWidth: 0, borderColor: C.ink, borderTopLeftRadius: 10, borderTopRightRadius: 14 },
  tabCover: { position: 'absolute', left: 0, top: -2, width: 92, height: 4 },
  row: { minHeight: 104, padding: 14, flexDirection: 'row', alignItems: 'center', overflow: 'visible' },
  empty: { padding: 24, borderRadius: 20, borderWidth: 2, borderStyle: 'dashed', borderColor: C.ink },
  add: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
