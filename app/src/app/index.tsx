import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FolderSheet } from '@/components/sheets';
import { Brut, BrutBox, Chip, Display, Icon, Logo, popIn, STICKER_LAG, Sticker, tap, Txt } from '@/components/ui';
import { CATALOG, type Folder, type Kind, KIND_LABEL, type Recipe, addedLabel, folderSwatch } from '@/lib/data';
import { activeCount, selectResults, useStore } from '@/lib/store';
import { C, FOLDER_SWATCHES, type Swatch, TILE_SWATCHES, fg } from '@/lib/theme';

type Tab = 'home' | 'folders';
type Slot = 'w' | 't' | 'n' | 'ws';

const SLOT_HEIGHT: Record<Slot, number> = { w: 176, t: 264, n: 124, ws: 124 };
const STICKER_AT: Record<Slot, { size: number; rotate: number; pos: object }> = {
  w: { size: 196, rotate: -14, pos: { right: -40, top: -42 } },
  t: { size: 150, rotate: -6, pos: { right: -24, bottom: -42 } },
  n: { size: 96, rotate: 12, pos: { right: -32, top: -60 } },
  ws: { size: 124, rotate: -8, pos: { right: 6, top: -48 } },
};
const KIND_SWATCH: Record<Kind, Swatch> = { type: 'pink', diet: 'olive', tool: 'amber' };

export default function Home() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('home');
  const [filterOpen, setFilterOpen] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      {tab === 'home' ? (
        <View key="home" style={{ flex: 1 }}>
          <HomeView top={insets.top} onOpenFilters={() => setFilterOpen(true)} />
        </View>
      ) : (
        <View key="folders" style={{ flex: 1 }}>
          <FoldersView top={insets.top} />
        </View>
      )}
      <NavBar tab={tab} onTab={setTab} bottom={insets.bottom} />
      {filterOpen ? <FilterPanel top={insets.top} onClose={() => setFilterOpen(false)} /> : null}
    </View>
  );
}

/* ------------------------------------------------------------------ home */

function HomeView({ top, onOpenFilters }: { top: number; onOpenFilters: () => void }) {
  const { recipes, groups, query, sort, setQuery, setSort } = useStore();
  const results = useMemo(() => selectResults(recipes, groups, query, sort), [recipes, groups, query, sort]);

  return (
    <ScrollView contentContainerStyle={{ paddingTop: top + 8, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Logo />
          <Display size={27}>
            Wow Miam
            <Display size={27} color={C.pink}> !</Display>
          </Display>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginHorizontal: 16, marginTop: 6 }}>
        <BrutBox radius={14} style={styles.search}>
          <Icon name="search" color={C.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Recette, ingrédient, ustensile…"
            placeholderTextColor={C.muted}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={10}>
              <Icon name="close" size={18} color={C.muted} />
            </Pressable>
          ) : null}
        </BrutBox>
        <Brut color={C.amber} radius={14} style={styles.tune} onPress={onOpenFilters}>
          <Icon name="tune" />
          {activeCount(groups) ? (
            <View style={styles.badge}>
              <Txt font="bold" size={11} color={C.onDark} style={{ lineHeight: 14 }}>
                {activeCount(groups)}
              </Txt>
            </View>
          ) : null}
        </Brut>
      </View>

      <QueryRow />

      <View style={styles.section}>
        <View>
          <Display size={22}>{sort === 'az' ? 'De A à Z' : 'Derniers ajouts'}</Display>
          <Txt size={12} font="semi" color={C.muted} style={{ marginTop: 4 }}>
            {results.length} recette{results.length > 1 ? 's' : ''}
          </Txt>
        </View>
        <SortSwitch value={sort} onChange={setSort} />
      </View>

      <Bento list={results} />
    </ScrollView>
  );
}

function QueryRow() {
  const { groups, toggleTag, toggleOp } = useStore();
  const kinds = (Object.keys(groups) as Kind[]).filter((k) => groups[k].on.length);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.query}>
      {kinds.length === 0 ? (
        <Txt size={13} font="semi" color={C.muted}>
          Aucun filtre : toutes tes recettes
        </Txt>
      ) : null}
      {kinds.map((kind, i) => {
        const g = groups[kind];
        const sw = KIND_SWATCH[kind];
        const chips = g.on.map((label, j) => (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {j > 0 ? (
              <Pressable onPress={() => { tap(); toggleOp(kind); }} hitSlop={6}>
                <Animated.View key={g.op} entering={FadeIn.duration(150)} style={styles.op}>
                  <Txt font="bold" size={11} color={C.onDark} style={{ lineHeight: 13 }}>{g.op}</Txt>
                </Animated.View>
              </Pressable>
            ) : null}
            <Animated.View entering={FadeIn.duration(150)}>
              <Chip label={label} color={C[sw]} textColor={fg(sw)} trailing="close" onPress={() => toggleTag(kind, label)} />
            </Animated.View>
          </View>
        ));
        return (
          <View key={kind} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {i > 0 ? <Txt font="bold" size={11} style={{ marginHorizontal: 2 }}>ET</Txt> : null}
            {g.on.length > 1 ? <View style={styles.group}>{chips}</View> : chips}
          </View>
        );
      })}
    </ScrollView>
  );
}

function SortSwitch({ value, onChange }: { value: 'recent' | 'az'; onChange: (v: 'recent' | 'az') => void }) {
  const x = useSharedValue(value === 'az' ? 1 : 0);
  useEffect(() => {
    x.value = withTiming(value === 'az' ? 1 : 0, { duration: 180 });
  }, [value, x]);
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * 72 }] }));
  return (
    <View style={styles.seg}>
      <Animated.View style={[styles.segThumb, thumb]} />
      {(['recent', 'az'] as const).map((v) => (
        <Pressable key={v} onPress={() => { tap(); onChange(v); }} style={styles.segBtn}>
          <Txt font="bold" size={12} color={value === v ? C.paper : C.ink}>
            {v === 'recent' ? 'Récents' : 'A–Z'}
          </Txt>
        </Pressable>
      ))}
    </View>
  );
}

function Bento({ list }: { list: Recipe[] }) {
  if (!list.length) {
    return (
      <Animated.View entering={FadeIn} style={styles.empty}>
        <Display size={20}>Aucune recette</Display>
        <Txt style={{ textAlign: 'center', marginTop: 6 }}>Rien ne coche toutes ces cases. Passe un ET en OU, ou retire un filtre.</Txt>
      </Animated.View>
    );
  }
  const [first, second, third, fourth, ...rest] = list;
  const pairs: Recipe[][] = [];
  for (let i = 0; i < rest.length; i += 2) pairs.push(rest.slice(i, i + 2));
  let idx = 0;
  const next = () => idx++;
  return (
    <View style={{ marginTop: 46, marginHorizontal: 16, gap: 16 }}>
      <Tile r={first} slot="w" index={next()} />
      {second ? (
        <View style={{ flexDirection: 'row', gap: 14 }}>
          <Tile r={second} slot="t" index={next()} inRow />
          <View style={{ gap: 16, flex: 1 }}>
            {third ? <Tile r={third} slot="n" index={next()} /> : null}
            {fourth ? <Tile r={fourth} slot="n" index={next()} /> : null}
          </View>
        </View>
      ) : null}
      {pairs.map((pair) =>
        pair.length === 2 ? (
          <View key={pair[0].id} style={{ flexDirection: 'row', gap: 14, marginTop: 30 }}>
            <Tile r={pair[0]} slot="n" index={next()} inRow />
            <Tile r={pair[1]} slot="n" index={next()} inRow />
          </View>
        ) : (
          <View key={pair[0].id} style={{ marginTop: 30 }}>
            <Tile r={pair[0]} slot="ws" index={next()} />
          </View>
        ),
      )}
    </View>
  );
}

/** Tiles grow with their text (min height per slot), and text is clamped so they never grow forever. */
function Tile({ r, slot, index, inRow = false }: { r: Recipe; slot: Slot; index: number; inRow?: boolean }) {
  const sw = TILE_SWATCHES[index % TILE_SWATCHES.length];
  const color = C[sw];
  const tc = fg(sw);
  const dark = tc === C.onDark;
  const at = STICKER_AT[slot];
  const wide = slot === 'w' || slot === 'ws';
  const delay = index * 60;
  return (
    <Animated.View
      key={`${r.id}-${slot}`}
      entering={popIn(delay)}
      layout={LinearTransition.duration(220)}
      style={[{ minHeight: SLOT_HEIGHT[slot], zIndex: index }, inRow ? { flex: 1 } : null]}>
      <Brut
        color={color}
        radius={20}
        style={{ flexGrow: 1, padding: slot === 'w' ? 16 : 14, overflow: 'visible' }}
        onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: r.id, color: sw } })}>
        {slot !== 'n' ? (
          <Txt size={12} font="semi" color={tc} style={{ opacity: 0.85, marginBottom: 6 }}>
            {addedLabel(r.addedAt)}
          </Txt>
        ) : null}
        <Display size={slot === 'w' ? 28 : 19} color={tc} style={{ maxWidth: wide ? '62%' : '70%', zIndex: 1 }} numberOfLines={slot === 't' ? 4 : 3}>
          {r.name}
        </Display>
        {slot === 'w' ? (
          <Txt size={13} color={tc} style={{ maxWidth: '58%', marginTop: 8, opacity: 0.92 }} numberOfLines={3}>
            {r.note}
          </Txt>
        ) : null}
        <View style={{ marginTop: 'auto', paddingTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 6, zIndex: 1 }}>
          <Chip label={r.type} color={dark ? 'transparent' : C.tile} textColor={tc} outline={dark ? tc : C.ink} />
          {slot !== 'n' && r.diets[0] ? <Chip label={r.diets[0]} color={dark ? 'transparent' : C.tile} textColor={tc} outline={dark ? tc : C.ink} /> : null}
          {slot === 'w' ? <Chip label={`${r.time} min`} icon="timer" color={dark ? 'transparent' : C.tile} textColor={tc} outline={dark ? tc : C.ink} /> : null}
        </View>
        <Sticker recipe={r} size={at.size} rotate={at.rotate} style={at.pos} delay={delay + STICKER_LAG} />
      </Brut>
    </Animated.View>
  );
}

/* --------------------------------------------------------------- filters */

function FilterPanel({ top, onClose }: { top: number; onClose: () => void }) {
  const { recipes, groups, query, sort, toggleTag, clearFilters } = useStore();
  const n = selectResults(recipes, groups, query, sort).length;
  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(42,21,48,0.4)' }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>
      <Animated.View entering={FadeInDown.duration(220)} style={{ position: 'absolute', left: 16, right: 16, top: top + 120 }}>
        <BrutBox color={C.paper} radius={22} style={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Display size={22}>Filtrer</Display>
            <Pressable onPress={() => { tap(); clearFilters(); }} hitSlop={8}>
              <Txt font="semi" size={14} style={{ textDecorationLine: 'underline' }}>Tout effacer</Txt>
            </Pressable>
          </View>
          {(Object.keys(CATALOG) as Kind[]).map((kind) => (
            <View key={kind} style={{ marginTop: 14 }}>
              <Txt font="semi" size={13} color={C.muted} style={{ marginBottom: 8 }}>{KIND_LABEL[kind]}</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {CATALOG[kind].map((label) => {
                  const on = groups[kind].on.includes(label);
                  const sw = KIND_SWATCH[kind];
                  return <Chip key={label} big label={label} color={on ? C[sw] : C.tile} textColor={on ? fg(sw) : C.ink} onPress={() => toggleTag(kind, label)} />;
                })}
              </View>
            </View>
          ))}
          <Brut color={C.ink} radius={14} offset={4} shadow={C.pink} style={{ marginTop: 18, height: 54, alignItems: 'center', justifyContent: 'center' }} onPress={onClose}>
            <Display size={17} color={C.paper}>{n ? `Voir ${n} recette${n > 1 ? 's' : ''}` : 'Aucune recette'}</Display>
          </Brut>
        </BrutBox>
      </Animated.View>
    </View>
  );
}

/* --------------------------------------------------------------- folders */

function FoldersView({ top }: { top: number }) {
  const { folders, recipes } = useStore();
  const [sheet, setSheet] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const [first, ...rest] = folders;
  const cells: (Folder | 'new')[] = first ? [...rest, 'new'] : [];
  const rows: (Folder | 'new')[][] = [];
  for (let i = 0; i < cells.length; i += 2) rows.push(cells.slice(i, i + 2));
  const byId = new Map(recipes.map((r) => [r.id, r]));
  let idx = 0;
  const open = () => setSheet(true);
  return (
    <ScrollView ref={scroll} contentContainerStyle={{ paddingTop: top + 14, paddingBottom: 140 }}>
      <View style={{ marginHorizontal: 16, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Display size={44}>Dossiers</Display>
          <Txt color={C.muted} style={{ marginTop: 6 }}>
            {folders.length} dossier{folders.length > 1 ? 's' : ''} rangé{folders.length > 1 ? 's' : ''} à la main
          </Txt>
        </View>
        <Brut color={C.amber} radius={14} style={styles.addFolder} onPress={open} accessibilityLabel="Nouveau dossier">
          <Icon name="create-new-folder" />
        </Brut>
      </View>
      <View style={{ marginTop: 52, marginHorizontal: 16, gap: 34 }}>
        {first ? <FolderTile f={first} index={idx++} wide byId={byId} /> : <NewFolderTile index={0} onPress={open} />}
        {rows.map((row) => (
          <View key={row[0] === 'new' ? 'new' : row[0].id} style={{ flexDirection: 'row', gap: 14 }}>
            {row.map((f) => (f === 'new' ? <NewFolderTile key="new" index={idx++} onPress={open} /> : <FolderTile key={f.id} f={f} index={idx++} byId={byId} />))}
          </View>
        ))}
      </View>
      <FolderSheet
        visible={sheet}
        onClose={() => setSheet(false)}
        defaultColor={FOLDER_SWATCHES[folders.length % FOLDER_SWATCHES.length]}
        onCreated={() => setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 250)}
      />
    </ScrollView>
  );
}

/** Folder cards grow with a long name, up to a clamp of 3–4 lines. */
function FolderTile({ f, index, wide = false, byId }: { f: Folder; index: number; wide?: boolean; byId: Map<string, Recipe> }) {
  const sw = folderSwatch(f, index);
  const color = C[sw];
  const tc = fg(sw);
  const covers = f.ids.map((id) => byId.get(id)).filter((r): r is Recipe => !!r && !!(r.sticker || r.photoUri)).slice(0, wide ? 2 : 1);
  const delay = index * 70;
  return (
    <Animated.View entering={popIn(delay)} style={[{ minHeight: wide ? 156 : 140, zIndex: index }, wide ? null : { flex: 1 }]}>
      <Brut
        color={color}
        radius={20}
        style={{ flexGrow: 1, padding: 14, paddingTop: 16, borderTopLeftRadius: 4, overflow: 'visible' }}
        onPress={() => router.push({ pathname: '/folder/[id]', params: { id: f.id, color: sw } })}>
        <View style={[styles.folderTab, { backgroundColor: color }]} />
        <View style={[styles.folderTabCover, { backgroundColor: color }]} />
        <Display size={wide ? 30 : 20} color={tc} style={{ maxWidth: covers.length ? (wide ? '52%' : '64%') : '100%', zIndex: 2 }} numberOfLines={wide ? 3 : 4}>
          {f.name}
        </Display>
        <View style={{ marginTop: 'auto', paddingTop: 10, flexDirection: 'row', alignItems: 'baseline', gap: 6, zIndex: 2 }}>
          <Display size={22} color={tc}>{f.ids.length}</Display>
          <Txt font="semi" size={13} color={tc}>recette{f.ids.length > 1 ? 's' : ''}</Txt>
        </View>
        {covers.map((r, i) => (
          <Sticker
            key={r.id}
            recipe={r}
            size={wide ? (i ? 140 : 132) : 96}
            rotate={i ? 10 : -12}
            style={wide ? (i ? { right: -14, top: 18 } : { right: 92, top: -58 }) : { right: -18, top: -48 }}
            delay={delay + STICKER_LAG + i * 110}
          />
        ))}
      </Brut>
    </Animated.View>
  );
}

function NewFolderTile({ index, onPress }: { index: number; onPress: () => void }) {
  return (
    <Animated.View entering={popIn(index * 70)} style={{ flex: 1, minHeight: 140 }}>
      <Pressable onPress={() => { tap(); onPress(); }} style={({ pressed }) => [styles.newFolder, pressed && { backgroundColor: 'rgba(42,21,48,0.06)' }]}>
        <Icon name="add" size={30} />
        <Display size={18}>Nouveau dossier</Display>
      </Pressable>
    </Animated.View>
  );
}

/* ---------------------------------------------------------------- navbar */

function NavBar({ tab, onTab, bottom }: { tab: Tab; onTab: (t: Tab) => void; bottom: number }) {
  return (
    <View style={[styles.nav, { paddingBottom: bottom + 10 }]}>
      <NavTab label="Accueil" icon="home" on={tab === 'home'} onPress={() => onTab('home')} />
      <View style={styles.plusWrap}>
        <Brut color={C.pink} radius={20} offset={6} style={styles.plus} onPress={() => router.push('/create')} accessibilityLabel="Nouvelle recette">
          <Icon name="add" size={38} color={C.onDark} />
        </Brut>
      </View>
      <NavTab label="Dossiers" icon="folder" on={tab === 'folders'} onPress={() => onTab('folders')} />
    </View>
  );
}

function NavTab({ label, icon, on, onPress }: { label: string; icon: 'home' | 'folder'; on: boolean; onPress: () => void }) {
  const s = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    s.value = withTiming(on ? 1 : 0, { duration: 180 });
  }, [on, s]);
  const pill = useAnimatedStyle(() => ({ transform: [{ scaleX: s.value }], opacity: s.value }));
  return (
    <Pressable onPress={() => { tap(); onPress(); }} style={{ flex: 1, alignItems: 'center', gap: 3 }}>
      <View style={{ width: 60, height: 30, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: C.ink, borderRadius: 999 }, pill]} />
        <Icon name={icon} color={on ? C.paper : C.muted} />
      </View>
      <Txt font="semi" size={12} color={on ? C.ink : C.muted}>{label}</Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { height: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  search: { flex: 1, height: 54, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14 },
  searchInput: { flex: 1, fontFamily: 'Onest_500Medium', fontSize: 15, color: C.ink, paddingVertical: 0 },
  tune: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -10, right: -10, width: 22, height: 22, borderRadius: 11, backgroundColor: C.coral, borderWidth: 2, borderColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  query: { paddingHorizontal: 16, paddingVertical: 14, alignItems: 'center', gap: 6, minHeight: 60 },
  op: { height: 24, paddingHorizontal: 8, borderRadius: 7, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  group: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 4, borderWidth: 2, borderStyle: 'dashed', borderColor: C.ink, borderRadius: 999, backgroundColor: 'rgba(214,59,136,0.12)' },
  section: { marginHorizontal: 16, marginTop: 4, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  seg: { flexDirection: 'row', borderWidth: 2, borderColor: C.ink, borderRadius: 10, overflow: 'hidden', backgroundColor: C.tile },
  segThumb: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 72, backgroundColor: C.ink },
  segBtn: { width: 72, height: 32, alignItems: 'center', justifyContent: 'center' },
  empty: { margin: 16, marginTop: 30, padding: 24, borderRadius: 20, borderWidth: 2, borderStyle: 'dashed', borderColor: C.ink, alignItems: 'center' },
  folderTab: { position: 'absolute', left: -2, top: -18, width: 78, height: 18, borderWidth: 2, borderBottomWidth: 0, borderColor: C.ink, borderTopLeftRadius: 10, borderTopRightRadius: 14 },
  folderTabCover: { position: 'absolute', left: 0, top: -2, width: 74, height: 4 },
  nav: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 10, paddingHorizontal: 28, backgroundColor: C.paper, borderTopWidth: 2, borderColor: C.ink, flexDirection: 'row', alignItems: 'center' },
  addFolder: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  newFolder: { flex: 1, borderRadius: 20, borderTopLeftRadius: 4, borderWidth: 2, borderStyle: 'dashed', borderColor: C.ink, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 14 },
  plusWrap: { marginTop: -40, transform: [{ rotate: '-4deg' }] },
  plus: { width: 66, height: 66, alignItems: 'center', justifyContent: 'center' },
});
