/**
 * Opening an invitation (wowmiam://invite/CODE, or a code typed on the shelf): who invites me, into
 * which book and at what rank, and what happens to my own recipes when I join.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, Keyframe } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MiniCover, Toque } from '@/components/books';
import { Sticker } from '@/components/sticker';
import { Brut, Display, Icon, StatusShade, tap, Txt } from '@/components/ui';
import { useAccount } from '@/lib/account';
import { type Invite, ROLE_LABEL, ROLE_SWATCH, canCook, firstName, parseInviteCode, planMove } from '@/lib/books';
import { acceptInvite, fetchInvite, isOnMyShelf, signInWithGoogle } from '@/lib/cloud';
import { type Recipe, SEED_RECIPE_IDS } from '@/lib/data';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';

const NONE: Recipe[] = [];

type Phase = 'loading' | 'signed-out' | 'missing' | 'used' | 'expired' | 'member' | 'ready' | 'error';
type Choice = 'all' | 'pick' | 'none';

/** The rank stamp lands like the "Enregistré !" one: big, then pressed flat. */
const stamp = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 1.8 }, { rotate: '-2deg' }] },
  100: { opacity: 1, transform: [{ scale: 1 }, { rotate: '-9deg' }] },
})
  .duration(280)
  .delay(250);

export default function JoinScreen() {
  const { code: raw } = useLocalSearchParams<{ code: string }>();
  const code = parseInviteCode(raw ?? '');
  const insets = useSafeAreaInsets();
  const account = useAccount((s) => s.account);
  const syncing = useAccount((s) => s.status === 'syncing');
  const books = useStore((s) => s.books);
  const personal = books.find((b) => b.personal);
  // A stable empty list: a fresh [] per render would make the store think the selection changed forever.
  const mine = useStore((s) => (!personal ? NONE : personal.id === s.bookId ? s.recipes : s.stash[personal.id]?.recipes ?? NONE));
  const plan = useMemo(() => planMove(mine), [mine]);
  const [phase, setPhase] = useState<Phase>('loading');
  const [invite, setInvite] = useState<Invite | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [choice, setChoice] = useState<Choice>('all');
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => setPicked(new Set(plan.movable.map((r) => r.id))), [plan]);

  useEffect(() => {
    if (!code) return setPhase('missing');
    if (!account) return setPhase('signed-out');
    if (syncing) return setPhase('loading');
    let alive = true;
    setPhase('loading');
    fetchInvite(code)
      .then((i) => {
        if (!alive) return;
        setInvite(i);
        if (!i) setPhase('missing');
        else if (isOnMyShelf(i.bookId)) setPhase('member');
        else if (i.usedBy) setPhase('used');
        else if (i.expiresAt < Date.now()) setPhase('expired');
        else setPhase('ready');
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setProblem(e instanceof Error ? e.message : String(e));
        setPhase('error');
      });
    return () => {
      alive = false;
    };
  }, [code, account, syncing]);

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const cooks = !!invite && canCook(invite.role);
  const bring = !cooks || choice === 'none' ? [] : choice === 'all' ? plan.movable : plan.movable.filter((r) => picked.has(r.id));

  const join = async () => {
    if (!invite) return;
    tap();
    setBusy(true);
    setProblem(null);
    try {
      await acceptInvite(invite, bring);
      router.replace('/');
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const signIn = async () => {
    tap();
    setProblem(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40, paddingHorizontal: 16 }}>
        <View style={styles.bar}>
          <Brut radius={12} style={styles.sq} onPress={leave} accessibilityLabel="Fermer">
            <Icon name="close" />
          </Brut>
        </View>

        <View style={styles.hero}>
          <View style={{ transform: [{ rotate: '-5deg' }] }}>
            <MiniCover color={invite?.bookColor ?? 'plum'} width={124} height={164} />
            {invite ? (
              <View style={styles.plate}>
                <Display size={17} style={{ textAlign: 'center' }} numberOfLines={2}>{invite.bookName}</Display>
              </View>
            ) : null}
          </View>
          {invite && phase === 'ready' ? (
            <Animated.View entering={stamp} style={[styles.stamp, { borderColor: C[ROLE_SWATCH[invite.role]] }]}>
              <Toque role={invite.role} size={34} />
              <Display size={19} color={C[ROLE_SWATCH[invite.role]]}>{ROLE_LABEL[invite.role].toUpperCase()}</Display>
            </Animated.View>
          ) : null}
        </View>

        {phase === 'loading' ? <ActivityIndicator color={C.ink} style={{ marginTop: 30 }} /> : null}

        {phase === 'signed-out' ? (
          <Animated.View entering={FadeInDown.duration(240)}>
            <Display size={28} style={styles.center}>Une invitation t’attend</Display>
            <Txt size={15} style={[styles.center, { marginTop: 10, lineHeight: 22 }]}>
              Connecte-toi avec Google pour voir qui t’invite et rejoindre sa brigade.
            </Txt>
            <Brut color={C.ink} shadow={C.pink} radius={14} style={styles.cta} onPress={signIn}>
              <Display size={17} color={C.paper}>Continuer avec Google</Display>
            </Brut>
          </Animated.View>
        ) : null}

        {(['missing', 'used', 'expired', 'member', 'error'] as Phase[]).includes(phase) ? (
          <Animated.View entering={FadeIn.duration(200)}>
            <Display size={26} style={styles.center}>{DEAD_END[phase]?.title}</Display>
            <Txt size={15} style={[styles.center, { marginTop: 10, lineHeight: 22 }]}>{DEAD_END[phase]?.text}</Txt>
            <Brut radius={14} style={styles.cta} onPress={phase === 'member' && invite ? () => { useStore.getState().openBook(invite.bookId); router.replace('/'); } : leave}>
              <Display size={17}>{phase === 'member' ? 'Ouvrir le livre' : 'Retour'}</Display>
            </Brut>
          </Animated.View>
        ) : null}

        {phase === 'ready' && invite ? (
          <Animated.View entering={FadeInDown.duration(260)}>
            <Display size={30} style={styles.center}>{firstName(invite.byName)} t’invite dans sa brigade</Display>
            <Txt size={14} font="medium" color={C.muted} style={[styles.center, { marginTop: 8 }]}>
              « {invite.bookName} » · {cooks ? 'tu pourras ajouter, modifier et supprimer ses recettes' : 'tu pourras lire ses recettes et copier celles qui te plaisent'}
            </Txt>

            {cooks && plan.movable.length ? (
              <>
                <View style={styles.qHead}>
                  <Display size={21}>Et tes recettes ?</Display>
                  <Txt size={12} font="semi" color={C.muted}>{plan.movable.length} dans « {personal?.name ?? 'Mon livre'} »</Txt>
                </View>
                <View style={{ gap: 10, marginTop: 10 }} accessibilityRole="radiogroup">
                  <Option on={choice === 'all'} onPress={() => setChoice('all')} title="Tout apporter" sub={`${plan.movable.length} recette${plan.movable.length > 1 ? 's' : ''} rejoigne${plan.movable.length > 1 ? 'nt' : ''} « ${invite.bookName} »`} />
                  <Option on={choice === 'pick'} onPress={() => setChoice('pick')} title="Choisir lesquelles" sub={choice === 'pick' ? `${bring.length} cochée${bring.length > 1 ? 's' : ''}` : undefined} />
                  {choice === 'pick' ? (
                    <View style={{ gap: 8 }}>
                      {plan.movable.map((r) => {
                        const on = picked.has(r.id);
                        return (
                          <Pressable
                            key={r.id}
                            onPress={() => { tap(); setPicked((p) => { const n = new Set(p); if (on) n.delete(r.id); else n.add(r.id); return n; }); }}
                            style={[styles.pickRow, on && { backgroundColor: C.tile }]}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: on }}>
                            <View style={{ width: 48, height: 48 }}><Sticker recipe={r} size={48} animate={false} /></View>
                            <Txt font="semi" size={15} style={{ flex: 1 }} numberOfLines={2}>{r.name}</Txt>
                            <View style={[styles.check, on && { backgroundColor: C.olive }]}>{on ? <Icon name="check" size={18} /> : null}</View>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                  <Option on={choice === 'none'} onPress={() => setChoice('none')} title="Garder mon livre à part" sub="Les deux livres restent sur ton étagère" />
                </View>
              </>
            ) : null}

            {cooks && plan.examples.length ? (
              <View style={styles.note}>
                <Icon name="content-copy" size={20} />
                <Txt size={13} font="medium" style={{ flex: 1, lineHeight: 19 }}>
                  {plan.examples.length > 1 ? `Les ${plan.examples.length} recettes d’exemple restent` : 'La recette d’exemple reste'} dans ton livre : on ne les double pas.
                  {plan.movable.some((r) => SEED_RECIPE_IDS.has(r.id))
                    ? ' Celles que tu as modifiées sont à toi : elles peuvent venir.'
                    : ''}
                </Txt>
              </View>
            ) : null}

            {problem ? <Txt size={13} font="semi" color={C.coral} style={{ marginTop: 12 }}>{problem}</Txt> : null}
            <Brut color={C.ink} shadow={C.pink} radius={14} style={styles.cta} onPress={join} disabled={busy}>
              {busy ? <ActivityIndicator color={C.paper} /> : <Display size={17} color={C.paper}>Rejoindre la brigade</Display>}
            </Brut>
            <Pressable onPress={() => { tap(); leave(); }} style={styles.refuse} hitSlop={6}>
              <Txt font="semi" style={{ textDecorationLine: 'underline' }}>Refuser</Txt>
            </Pressable>
          </Animated.View>
        ) : null}

        {problem && phase !== 'ready' && phase !== 'error' ? <Txt size={13} font="semi" color={C.coral} style={{ marginTop: 12, textAlign: 'center' }}>{problem}</Txt> : null}
      </ScrollView>
      <StatusShade height={insets.top} />
    </View>
  );
}

const DEAD_END: Partial<Record<Phase, { title: string; text: string }>> = {
  missing: { title: 'Invitation introuvable', text: 'Vérifie le code : 8 lettres et chiffres, comme ABCD-2345. Il a peut-être été annulé.' },
  used: { title: 'Invitation déjà utilisée', text: 'Chaque invitation sert à une seule personne. Demande-en une nouvelle.' },
  expired: { title: 'Invitation expirée', text: 'Elle n’était valable que 7 jours. Demande-en une nouvelle.' },
  member: { title: 'Tu en fais déjà partie', text: 'Ce livre est déjà sur ton étagère.' },
  error: { title: 'Impossible de lire l’invitation', text: 'Vérifie ta connexion internet, puis réessaie.' },
};

function Option({ on, onPress, title, sub }: { on: boolean; onPress: () => void; title: string; sub?: string }) {
  return (
    <Pressable
      onPress={() => { tap(); onPress(); }}
      style={[styles.option, on && { boxShadow: `4px 4px 0px ${C.pink}` }]}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}>
      <View style={[styles.radio, on && { backgroundColor: C.pink }]} />
      <View style={{ flex: 1 }}>
        <Txt font="bold" size={15}>{title}</Txt>
        {sub ? <Txt size={13} font="medium" color={C.muted} style={{ marginTop: 2 }}>{sub}</Txt> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { height: 56, flexDirection: 'row', alignItems: 'center' },
  sq: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  hero: { height: 200, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  plate: { position: 'absolute', left: 30, right: 12, top: 50, borderWidth: 2, borderColor: C.ink, borderRadius: 8, backgroundColor: C.paper, paddingVertical: 8, paddingHorizontal: 4 },
  stamp: { position: 'absolute', right: 24, bottom: 18, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 3, borderRadius: 12, backgroundColor: C.paper, paddingVertical: 4, paddingLeft: 6, paddingRight: 12 },
  center: { textAlign: 'center' },
  qHead: { marginTop: 24, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 2, borderColor: C.ink, borderRadius: 16, backgroundColor: C.tile, paddingVertical: 12, paddingHorizontal: 14 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.ink, backgroundColor: C.tile, boxShadow: 'inset 0px 0px 0px 4px #FFFFFF' },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, borderRadius: 14, borderWidth: 2, borderColor: C.ink, marginLeft: 18 },
  check: { width: 26, height: 26, borderWidth: 2, borderColor: C.ink, borderRadius: 7, backgroundColor: C.tile, alignItems: 'center', justifyContent: 'center' },
  note: { marginTop: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderWidth: 2, borderStyle: 'dashed', borderColor: C.ink, borderRadius: 14, padding: 12, backgroundColor: 'rgba(224,150,42,0.14)' },
  cta: { marginTop: 22, height: 56, alignItems: 'center', justifyContent: 'center' },
  refuse: { alignSelf: 'center', marginTop: 14, padding: 8 },
});
