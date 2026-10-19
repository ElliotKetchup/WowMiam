/** The open book's trash: deleted recipes wait here TRASH_DAYS days, then go for good. */
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Sticker } from '@/components/sticker';
import { Brut, Display, Icon, StatusShade, tap, Txt } from '@/components/ui';
import { TRASH_DAYS, canCook, daysLeftInTrash, firstName } from '@/lib/books';
import { addedLabel } from '@/lib/data';
import { useRole, useStore } from '@/lib/store';
import { C } from '@/lib/theme';

export default function TrashScreen() {
  const insets = useSafeAreaInsets();
  const recipes = useStore((s) => s.recipes);
  const restore = useStore((s) => s.restoreRecipe);
  const purge = useStore((s) => s.purgeRecipes);
  const cooks = canCook(useRole());
  const trashed = recipes.filter((r) => r.deletedAt).sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));

  const destroy = (id: string, name: string) =>
    Alert.alert(`Supprimer « ${name} » pour de bon ?`, 'Elle disparaît pour toute la brigade. C’est définitif.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => purge([id]) },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40, paddingHorizontal: 16 }}>
        <View style={styles.bar}>
          <Brut radius={12} style={styles.sq} onPress={() => router.back()} accessibilityLabel="Retour">
            <Icon name="arrow-back" />
          </Brut>
        </View>
        <Display size={44} style={{ marginTop: 12 }}>Corbeille</Display>
        <Txt font="medium" size={14} color={C.muted} style={{ marginTop: 6 }}>
          Les recettes supprimées restent {TRASH_DAYS} jours, puis disparaissent.
        </Txt>

        <View style={{ marginTop: 26, gap: 14 }}>
          {trashed.map((r, i) => (
            <Animated.View key={r.id} entering={FadeInDown.duration(240).delay(i * 50)} exiting={FadeOut.duration(160)} layout={LinearTransition.duration(200)}>
              <View style={styles.row}>
                <View style={{ width: 64, height: 64, opacity: 0.75 }}><Sticker recipe={r} size={64} animate={false} /></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Display size={18} numberOfLines={2}>{r.name}</Display>
                  <Txt size={12} font="medium" color={C.muted} style={{ marginTop: 4 }}>
                    {r.deletedAt ? `Supprimée ${addedLabel(r.deletedAt).toLowerCase()}` : ''}
                    {r.byName ? ` · de ${firstName(r.byName)}` : ''} · encore {daysLeftInTrash(r.deletedAt ?? 0)} j
                  </Txt>
                  {cooks ? (
                    <View style={styles.buttons}>
                      <Brut color={C.olive} radius={10} offset={2} style={styles.small} onPress={() => restore(r.id)}>
                        <Icon name="restore-from-trash" size={18} />
                        <Txt font="bold" size={13}>Restaurer</Txt>
                      </Brut>
                      <Pressable onPress={() => { tap(); destroy(r.id, r.name); }} hitSlop={8} style={styles.del} accessibilityLabel={`Supprimer ${r.name} pour de bon`}>
                        <Icon name="delete-forever" size={20} color={C.coral} />
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              </View>
            </Animated.View>
          ))}
          {trashed.length === 0 ? (
            <View style={styles.empty}>
              <Icon name="delete-outline" size={30} color={C.muted} />
              <Txt style={{ textAlign: 'center', marginTop: 8 }}>La corbeille est vide.</Txt>
            </View>
          ) : null}
        </View>
      </ScrollView>
      <StatusShade height={insets.top} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 56, flexDirection: 'row', alignItems: 'center' },
  sq: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: 2, borderColor: C.ink, borderRadius: 18, backgroundColor: C.tile },
  buttons: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  small: { height: 34, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 4 },
  del: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  empty: { padding: 28, borderRadius: 20, borderWidth: 2, borderStyle: 'dashed', borderColor: C.ink, alignItems: 'center' },
});
