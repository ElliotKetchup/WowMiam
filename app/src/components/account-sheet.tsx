/** Sign in with Google to back up and sync recipes; or see who is signed in and sign out. */
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import * as Updates from 'expo-updates';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Sheet } from '@/components/sheets';
import { Brut, Display, Icon, type IconName, tap, Txt } from '@/components/ui';
import { type Account, type SyncStatus, useAccount } from '@/lib/account';
import { signInWithGoogle, signOutOfCloud } from '@/lib/cloud';
import { C, hardShadow } from '@/lib/theme';

const STATUS: Record<SyncStatus, { icon: IconName; label: string; color: string }> = {
  off: { icon: 'cloud-off', label: 'Pas de sauvegarde', color: C.muted },
  syncing: { icon: 'cloud-sync', label: 'Synchronisation…', color: C.amber },
  synced: { icon: 'cloud-done', label: 'Tes recettes sont sauvegardées', color: C.teal },
  error: { icon: 'error-outline', label: 'La synchronisation a échoué', color: C.coral },
};

export function AccountSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { account, status, error } = useAccount();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const run = async (action: () => Promise<unknown>) => {
    tap();
    setBusy(true);
    setProblem(null);
    try {
      await action();
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={account ? 'Ton compte' : 'Sauvegarde'}>
      {account ? <Profile account={account} /> : (
        <Txt size={15} style={{ lineHeight: 22 }}>
          Connecte-toi pour retrouver tes recettes et tes dossiers sur tous tes téléphones, et ne plus jamais les perdre.
        </Txt>
      )}

      <View style={styles.status}>
        <Icon name={STATUS[status].icon} size={20} color={STATUS[status].color} />
        <Txt font="semi" size={14} color={STATUS[status].color}>{STATUS[status].label}</Txt>
      </View>
      {status === 'error' && error ? <Txt size={13} color={C.muted}>{error}</Txt> : null}
      {problem ? <Txt size={13} font="semi" color={C.coral} style={{ marginTop: 6 }}>{problem}</Txt> : null}

      {account ? (
        <Brut radius={14} style={styles.cta} onPress={() => run(signOutOfCloud)} disabled={busy}>
          {busy ? <ActivityIndicator color={C.ink} /> : <Display size={17}>Se déconnecter</Display>}
        </Brut>
      ) : (
        <Brut
          color={C.ink}
          shadow={C.pink}
          radius={14}
          style={styles.cta}
          disabled={busy}
          onPress={() =>
            run(async () => {
              if ((await signInWithGoogle()) === 'cancelled') {
                setProblem('La fenêtre Google s’est fermée sans connexion. Si elle ne s’est même pas affichée, dis-le à Claude.');
              }
            })
          }>
          {busy ? <ActivityIndicator color={C.paper} /> : (
            <View style={styles.row}>
              <View style={styles.g}><Txt font="bold" size={15} style={{ lineHeight: 18 }}>G</Txt></View>
              <Display size={17} color={C.paper}>Continuer avec Google</Display>
            </View>
          )}
        </Brut>
      )}
      <Txt size={12} color={C.muted} style={{ marginTop: 12, textAlign: 'center' }}>
        {account ? 'Tes recettes restent sur ce téléphone après la déconnexion.' : 'Tes photos sont compressées puis sauvegardées avec les recettes.'}
      </Txt>
      <Txt size={11} color={C.muted} style={{ marginTop: 10, textAlign: 'center', opacity: 0.7 }}>{buildLabel()}</Txt>
    </Sheet>
  );
}

/** Which code is running: the one inside the APK, or an over-the-air update (and from when). */
function buildLabel(): string {
  const version = `v${Updates.runtimeVersion ?? Constants.expoConfig?.version ?? "?"}`;
  if (Updates.isEmbeddedLaunch) return `${version} · APK n°${Constants.expoConfig?.android?.versionCode ?? '?'}`;
  const at = Updates.createdAt?.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return at ? `${version} · mise à jour du ${at}` : version;
}

function Profile({ account }: { account: Account }) {
  const initial = (account.name ?? account.email ?? '?').charAt(0).toUpperCase();
  return (
    <View style={styles.row}>
      <Avatar photo={account.photo} initial={initial} size={52} />
      <View style={{ flex: 1, minWidth: 0 }}>
        {account.name ? <Display size={20} numberOfLines={1}>{account.name}</Display> : null}
        {account.email ? <Txt size={14} color={C.muted} numberOfLines={1}>{account.email}</Txt> : null}
      </View>
    </View>
  );
}

export function Avatar({ photo, initial, size }: { photo: string | null; initial: string; size: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      {photo ? <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Display size={size * 0.42}>{initial}</Display>}
    </View>
  );
}

/** Header button: the person's avatar when signed in, a cloud otherwise. */
export function AccountButton({ onPress }: { onPress: () => void }) {
  const { account, status } = useAccount();
  return (
    <Pressable onPress={() => { tap(); onPress(); }} hitSlop={8} accessibilityRole="button" accessibilityLabel={account ? 'Ton compte' : 'Sauvegarder mes recettes'}>
      {account ? (
        <View>
          <Avatar photo={account.photo} initial={(account.name ?? account.email ?? '?').charAt(0).toUpperCase()} size={40} />
          {status === 'error' ? <View style={styles.dot} /> : null}
        </View>
      ) : (
        <View style={styles.cloud}><Icon name="cloud-upload" size={22} /></View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18 },
  cta: { marginTop: 22, height: 54, alignItems: 'center', justifyContent: 'center' },
  g: { width: 26, height: 26, borderRadius: 13, backgroundColor: C.tile, alignItems: 'center', justifyContent: 'center' },
  avatar: { borderWidth: 2, borderColor: C.ink, backgroundColor: C.amber, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cloud: { width: 40, height: 40, borderRadius: 12, borderWidth: 2, borderColor: C.ink, backgroundColor: C.tile, alignItems: 'center', justifyContent: 'center', boxShadow: hardShadow(2) },
  dot: { position: 'absolute', right: -2, top: -2, width: 14, height: 14, borderRadius: 7, backgroundColor: C.coral, borderWidth: 2, borderColor: C.paper },
});
