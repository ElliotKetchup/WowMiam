/** Bottom sheets: folder create/edit and "add recipes to this folder". */
import { type ReactNode, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brut, Display, Icon, tap, Txt } from '@/components/ui';
import { Sticker } from '@/components/sticker';
import type { Folder } from '@/lib/data';
import { useStore } from '@/lib/store';
import { C, F, FOLDER_SWATCHES, type Swatch, fg } from '@/lib/theme';

export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(42,21,48,0.45)' }]} onPress={onClose} accessibilityLabel="Fermer" />
        <View style={{ flex: 1 }} pointerEvents="box-none" />
        <Animated.View entering={SlideInDown.duration(260)} style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.head}>
            <Display size={24}>{title}</Display>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Fermer">
              <Icon name="close" />
            </Pressable>
          </View>
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

type FolderSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Absent: create a folder. */
  folder?: Folder;
  defaultColor?: Swatch;
  onCreated?: (id: string) => void;
  onDeleted?: () => void;
};

export function FolderSheet({ visible, onClose, folder, defaultColor = 'amber', onCreated, onDeleted }: FolderSheetProps) {
  const addFolder = useStore((s) => s.addFolder);
  const updateFolder = useStore((s) => s.updateFolder);
  const deleteFolder = useStore((s) => s.deleteFolder);
  const [name, setName] = useState('');
  const [color, setColor] = useState<Swatch>(defaultColor);

  useEffect(() => {
    if (!visible) return;
    setName(folder?.name ?? '');
    setColor(folder?.color ?? defaultColor);
  }, [visible, folder, defaultColor]);

  const ok = name.trim().length > 0;
  const submit = () => {
    if (!ok) return;
    if (folder) updateFolder(folder.id, { name: name.trim(), color });
    else onCreated?.(addFolder(name.trim(), color));
    onClose();
  };
  const remove = () => {
    if (!folder) return;
    Alert.alert('Supprimer ce dossier ?', 'Les recettes qu’il contient restent dans ta bibliothèque.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          onClose();
          onDeleted?.();
          setTimeout(() => deleteFolder(folder.id), 350);
        },
      },
    ]);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={folder ? 'Modifier le dossier' : 'Nouveau dossier'}>
      <View style={[styles.preview, { backgroundColor: C[color] }]}>
        <View style={[styles.tab, { backgroundColor: C[color] }]} />
        <View style={[styles.tabCover, { backgroundColor: C[color] }]} />
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Nom du dossier"
          placeholderTextColor={fg(color) === C.ink ? 'rgba(42,21,48,0.4)' : 'rgba(255,246,250,0.55)'}
          style={[styles.nameInput, { color: fg(color) }]}
          autoFocus={!folder}
          maxLength={40}
          multiline
          submitBehavior="blurAndSubmit"
          returnKeyType="done"
          onSubmitEditing={submit}
          accessibilityLabel="Nom du dossier"
        />
      </View>

      <Txt font="semi" size={13} color={C.muted} style={{ marginTop: 18, marginBottom: 10 }}>Couleur</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {FOLDER_SWATCHES.map((s) => (
          <Pressable
            key={s}
            onPress={() => { tap(); setColor(s); }}
            style={[styles.swatch, { backgroundColor: C[s] }, color === s && styles.swatchOn]}
            accessibilityLabel={`Couleur ${s}`}>
            {color === s ? <Icon name="check" size={20} color={fg(s)} /> : null}
          </Pressable>
        ))}
      </View>

      <Brut color={ok ? C.ink : 'rgba(42,21,48,0.25)'} shadow={ok ? C.pink : 'transparent'} radius={14} style={styles.cta} onPress={submit} disabled={!ok}>
        <Display size={17} color={C.paper}>{folder ? 'Enregistrer' : 'Créer le dossier'}</Display>
      </Brut>
      {folder ? (
        <Pressable onPress={remove} style={styles.danger} hitSlop={6}>
          <Icon name="delete-outline" size={20} color={C.coral} />
          <Txt font="semi" color={C.coral}>Supprimer le dossier</Txt>
        </Pressable>
      ) : null}
    </Sheet>
  );
}

export function RecipePickerSheet({ visible, onClose, folder }: { visible: boolean; onClose: () => void; folder: Folder }) {
  const recipes = useStore((s) => s.recipes);
  const toggleInFolder = useStore((s) => s.toggleInFolder);
  const sorted = [...recipes].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  return (
    <Sheet visible={visible} onClose={onClose} title="Ranger des recettes">
      <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
        {sorted.map((r) => {
          const on = folder.ids.includes(r.id);
          return (
            <Pressable key={r.id} onPress={() => { tap(); toggleInFolder(folder.id, r.id); }} style={[styles.pickRow, on && { backgroundColor: C.tile }]}>
              <View style={{ width: 52, height: 52 }}>
                <Sticker recipe={r} size={52} animate={false} />
              </View>
              <Txt font="semi" size={15} style={{ flex: 1 }} numberOfLines={2}>{r.name}</Txt>
              <View style={[styles.check, on && { backgroundColor: C.olive }]}>
                {on ? <Animated.View entering={FadeIn.duration(120)}><Icon name="check" size={18} /></Animated.View> : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      <Brut color={C.ink} shadow={C.pink} radius={14} style={styles.cta} onPress={onClose}>
        <Display size={17} color={C.paper}>
          {folder.ids.length} recette{folder.ids.length > 1 ? 's' : ''} dans le dossier
        </Display>
      </Brut>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: C.paper, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 2, borderBottomWidth: 0, borderColor: C.ink, paddingHorizontal: 16, paddingTop: 18 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 },
  preview: { minHeight: 96, borderRadius: 18, borderTopLeftRadius: 4, borderWidth: 2, borderColor: C.ink, padding: 14, justifyContent: 'flex-end', boxShadow: '4px 4px 0px #2A1530' },
  tab: { position: 'absolute', left: -2, top: -18, width: 78, height: 18, borderWidth: 2, borderBottomWidth: 0, borderColor: C.ink, borderTopLeftRadius: 10, borderTopRightRadius: 14 },
  tabCover: { position: 'absolute', left: 0, top: -2, width: 74, height: 4 },
  nameInput: { fontFamily: F.display, fontSize: 26, paddingVertical: 4 },
  swatch: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  swatchOn: { boxShadow: '0px 0px 0px 3px #F4EFF3, 0px 0px 0px 5px #2A1530' },
  cta: { marginTop: 22, height: 54, alignItems: 'center', justifyContent: 'center' },
  danger: { marginTop: 16, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, padding: 6 },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, borderRadius: 14, borderWidth: 2, borderColor: C.ink },
  check: { width: 26, height: 26, borderWidth: 2, borderColor: C.ink, borderRadius: 7, backgroundColor: C.tile, alignItems: 'center', justifyContent: 'center' },
});
