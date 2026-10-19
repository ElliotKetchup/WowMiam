/** The open book's brigade, drawn like a bookplate: who cooks, who reads, open invitations, and the book's own actions. */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AccountSheet } from '@/components/account-sheet';
import { BookSheet, MemberAvatar, Toque, useMembers } from '@/components/books';
import { Sheet } from '@/components/sheets';
import { Brut, BrutBox, Display, Icon, type IconName, StatusShade, tap, Txt } from '@/components/ui';
import { useAccount } from '@/lib/account';
import { type Member, MAX_MEMBERS, type Role, ROLE_DOES, ROLE_ORDER, ROLE_PLURAL, ROLE_SWATCH, firstName, invitableRoles, ROLE_LABEL } from '@/lib/books';
import { type PendingInvite, cancelInvite, deleteBook, leaveBook, passToque, removeMember, setMemberRole, watchInvites } from '@/lib/cloud';
import { addedLabel } from '@/lib/data';
import { live, useBook, useStore } from '@/lib/store';
import { C, shade } from '@/lib/theme';

const DAY = 86_400_000;

export default function BrigadeScreen() {
  const insets = useSafeAreaInsets();
  const book = useBook();
  const account = useAccount((s) => s.account);
  const members = useMembers(book.id);
  const trashed = useStore((s) => s.recipes.filter((r) => r.deletedAt).length);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [acting, setActing] = useState<Member | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const ready = useAccount((s) => s.status === 'synced' || s.status === 'error');
  useEffect(() => (ready ? watchInvites(book.id, setInvites) : undefined), [book.id, account?.uid, ready]);

  const used = new Set(members.map((m) => m.via).filter(Boolean));
  const now = Date.now();
  const pending = invites.filter((i) => !used.has(i.code) && i.expiresAt > now);
  const isChef = book.role === 'chef';

  // The chef tidies up invitations that were used or ran out.
  useEffect(() => {
    if (!isChef) return;
    const usedCodes = new Set(members.map((m) => m.via).filter(Boolean));
    invites.filter((i) => usedCodes.has(i.code) || i.expiresAt <= Date.now()).forEach((i) => cancelInvite(book.id, i.code).catch(() => undefined));
  }, [invites, members, isChef, book.id]);

  const canInvite = !!account && invitableRoles(book.role).length > 0 && members.length + pending.length < MAX_MEMBERS;
  const nameOf = (uid?: string | null) => members.find((m) => m.uid === uid)?.name;

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
    } catch (e) {
      Alert.alert('Oups', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const leave = () =>
    Alert.alert(`Quitter « ${book.name} » ?`, 'Tu ne verras plus ses recettes. Tu peux en garder une copie dans ton livre.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Partir', style: 'destructive', onPress: () => run(() => leaveBook(book.id, false)).then(() => router.back()) },
      { text: 'Garder une copie', onPress: () => run(() => leaveBook(book.id, true)).then(() => router.back()) },
    ]);
  const remove = () =>
    Alert.alert(`Supprimer « ${book.name} » ?`, 'Toutes ses recettes et ses dossiers disparaissent, pour toute la brigade. C’est définitif.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => run(() => deleteBook(book.id)).then(() => router.back()) },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40, paddingHorizontal: 16 }}>
        <View style={styles.bar}>
          <Brut radius={12} style={styles.sq} onPress={() => router.back()} accessibilityLabel="Retour">
            <Icon name="arrow-back" />
          </Brut>
          {busy ? <ActivityIndicator color={C.ink} /> : null}
        </View>
        <Display size={44} style={{ marginTop: 12 }}>Brigade</Display>
        <Txt font="medium" size={14} color={C.muted} style={{ marginTop: 6 }}>
          {book.name} · {members.length} membre{members.length > 1 ? 's' : ''}
        </Txt>

        <Animated.View entering={FadeInDown.duration(260)}>
          <BrutBox radius={20} style={[styles.plate, { boxShadow: `4px 4px 0px ${C[book.color]}` }]}>
            <View style={[styles.plateInner, { borderColor: C[book.color] }]}>
              {ROLE_ORDER.map((role) => {
                const ranked = members.filter((m) => m.role === role);
                if (!ranked.length) return null;
                return (
                  <View key={role}>
                    <RankHeading role={role} />
                    {ranked.map((m) => {
                      const me = m.uid === account?.uid || !account;
                      const actionable = account && ((isChef && !me) || (me && !isChef));
                      return (
                        <View key={m.uid} style={styles.member}>
                          <View style={styles.hatted}>
                            <View style={styles.hat}><Toque role={m.role} size={role === 'chef' ? 32 : 28} /></View>
                            <MemberAvatar uid={m.uid} name={m.name} photo={m.photo} size={40} />
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Display size={20} numberOfLines={1}>
                              {m.name}
                              {me && account ? <Txt font="semi" size={13} color={C.muted}> (toi)</Txt> : null}
                            </Display>
                            <Txt size={13} font="medium" color={C.muted} style={{ marginTop: 3 }} numberOfLines={2}>
                              {m.invitedBy && nameOf(m.invitedBy) && m.role !== 'chef' ? `Invité par ${firstName(nameOf(m.invitedBy))}` : shortDoes(m.role)}
                            </Txt>
                          </View>
                          {actionable ? (
                            <Pressable onPress={() => { tap(); if (me) leave(); else setActing(m); }} hitSlop={8} style={styles.more} accessibilityLabel={me ? 'Quitter le livre' : `Options pour ${m.name}`}>
                              <Icon name={me ? 'logout' : 'more-horiz'} />
                            </Pressable>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          </BrutBox>
        </Animated.View>

        {pending.length ? (
          <>
            <Txt font="semi" size={13} color={C.muted} style={{ marginTop: 22 }}>En attente</Txt>
            {pending.map((i) => (
              <View key={i.code} style={styles.pending}>
                <Icon name="link" />
                <View style={{ flex: 1 }}>
                  <Txt font="semi" size={14}>Lien {ROLE_LABEL[i.role]} · {addedLabel(i.createdAt).toLowerCase()}</Txt>
                  <Txt size={12} font="medium" color={C.muted} style={{ marginTop: 2 }}>
                    De {firstName(i.byName)} · 1 personne · expire dans {Math.max(1, Math.ceil((i.expiresAt - now) / DAY))} j
                  </Txt>
                </View>
                {isChef || i.by === account?.uid ? (
                  <Pressable onPress={() => { tap(); run(() => cancelInvite(book.id, i.code)); }} hitSlop={8} style={{ padding: 6 }}>
                    <Txt font="semi" size={14} style={{ textDecorationLine: 'underline' }}>Annuler</Txt>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </>
        ) : null}

        {!account ? (
          <View style={styles.pending}>
            <Icon name="group" />
            <Txt size={14} style={{ flex: 1, lineHeight: 20 }}>Connecte-toi avec Google pour inviter ta brigade.</Txt>
            <Brut color={C.ink} radius={10} offset={2} style={styles.small} onPress={() => setAccountOpen(true)}>
              <Txt font="bold" size={13} color={C.paper}>Connexion</Txt>
            </Brut>
          </View>
        ) : null}

        <View style={styles.actions}>
          {canInvite ? (
            <Brut color={C.pink} radius={16} style={styles.action} onPress={() => router.push('/inviter')}>
              <Icon name="person-add" color={C.onDark} />
              <Display size={17} color={C.onDark}>Inviter</Display>
            </Brut>
          ) : null}
          <Brut radius={16} style={styles.action} onPress={() => router.push('/corbeille')}>
            <Icon name="delete-outline" />
            <Txt font="semi" size={15}>Corbeille{trashed ? ` · ${trashed}` : ''}</Txt>
          </Brut>
        </View>
        {account && members.length + pending.length >= MAX_MEMBERS ? (
          <Txt size={12} color={C.muted} style={{ marginTop: 10 }}>La brigade est complète ({MAX_MEMBERS} personnes au plus).</Txt>
        ) : null}

        {account && isChef ? (
          <View style={styles.links}>
            <BookLink icon="edit" label="Modifier le livre" onPress={() => setEditOpen(true)} />
            {!book.personal ? <BookLink icon="delete-forever" label="Supprimer le livre" danger onPress={remove} /> : null}
          </View>
        ) : null}
      </ScrollView>

      <StatusShade height={insets.top} />
      <MemberSheet member={acting} bookId={book.id} onClose={() => setActing(null)} run={run} />
      <BookSheet visible={editOpen} onClose={() => setEditOpen(false)} book={book} />
      <AccountSheet visible={accountOpen} onClose={() => setAccountOpen(false)} />
    </View>
  );
}

const shortDoes = (role: Role): string =>
  role === 'chef' ? 'Gère la brigade et le livre' : role === 'sous' ? 'Cuisine tout le livre' : 'Lit et copie dans son livre';

function RankHeading({ role }: { role: Role }) {
  const color = role === 'commis' ? shade(C.amber, 0.25) : C[ROLE_SWATCH[role]];
  return (
    <View style={styles.heading}>
      <View style={[styles.rule, { backgroundColor: color }]} />
      <Txt font="bold" size={11} color={color} style={{ letterSpacing: 1.8 }}>{ROLE_PLURAL[role].toUpperCase()}</Txt>
      <View style={[styles.rule, { backgroundColor: color }]} />
    </View>
  );
}

function BookLink({ icon, label, onPress, danger = false }: { icon: IconName; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={() => { tap(); onPress(); }} style={styles.link} hitSlop={6}>
      <Icon name={icon} size={20} color={danger ? C.coral : C.ink} />
      <Txt font="semi" color={danger ? C.coral : C.ink}>{label}</Txt>
    </Pressable>
  );
}

/** The chef's options for someone in the brigade. */
function MemberSheet({ member, bookId, onClose, run }: { member: Member | null; bookId: string; onClose: () => void; run: (a: () => Promise<unknown>) => Promise<void> }) {
  const recipes = useStore((s) => s.recipes);
  if (!member) return <Sheet visible={false} onClose={onClose} title="">{null}</Sheet>;
  const name = firstName(member.name);
  const mine = live(recipes).filter((r) => r.byUid === member.uid).length;
  const act = (action: () => Promise<unknown>) => {
    onClose();
    run(action);
  };
  const options: { icon: IconName; label: string; sub: string; danger?: boolean; onPress: () => void }[] = [];
  if (member.role === 'commis') {
    options.push({ icon: 'arrow-upward', label: 'Passer Sous-chef', sub: ROLE_DOES.sous, onPress: () => act(() => setMemberRole(bookId, member.uid, 'sous')) });
  }
  if (member.role === 'sous') {
    options.push({ icon: 'arrow-downward', label: 'Passer Commis', sub: ROLE_DOES.commis, onPress: () => act(() => setMemberRole(bookId, member.uid, 'commis')) });
  }
  options.push({
    icon: 'swap-horiz',
    label: 'Lui passer la toque',
    sub: `${name} devient Chef de cuisine, toi Sous-chef.`,
    onPress: () =>
      Alert.alert(`Passer la toque à ${name} ?`, `${name} gérera la brigade et le livre. Tu deviens Sous-chef.`, [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Passer la toque', onPress: () => act(() => passToque(bookId, member.uid)) },
      ]),
  });
  options.push({
    icon: 'person-remove',
    label: 'Retirer de la brigade',
    sub: mine ? `Ses ${mine} recette${mine > 1 ? 's' : ''} restent dans le livre.` : 'Le livre disparaît de son étagère.',
    danger: true,
    onPress: () =>
      Alert.alert(`Retirer ${name} ?`, 'Le livre disparaîtra de son étagère.', [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Retirer', style: 'destructive', onPress: () => act(() => removeMember(bookId, member.uid)) },
      ]),
  });
  return (
    <Sheet visible onClose={onClose} title={member.name}>
      <View style={{ gap: 10, paddingBottom: 8 }}>
        {options.map((o) => (
          <Brut key={o.label} radius={16} style={styles.option} onPress={o.onPress}>
            <Icon name={o.icon} color={o.danger ? C.coral : C.ink} />
            <View style={{ flex: 1 }}>
              <Txt font="bold" size={15} color={o.danger ? C.coral : C.ink}>{o.label}</Txt>
              <Txt size={13} color={C.muted} style={{ marginTop: 2 }}>{o.sub}</Txt>
            </View>
          </Brut>
        ))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  bar: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sq: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  plate: { marginTop: 18, padding: 8 },
  plateInner: { borderWidth: 2, borderStyle: 'dashed', borderRadius: 14, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 4 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rule: { flex: 1, height: 2 },
  member: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 10, paddingBottom: 14 },
  hatted: { width: 44, height: 56, justifyContent: 'flex-end' },
  hat: { position: 'absolute', top: -2, left: 6, zIndex: 1 },
  more: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  pending: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 2, borderStyle: 'dashed', borderColor: C.ink, borderRadius: 14, padding: 10, paddingLeft: 12, backgroundColor: 'rgba(0,125,114,0.08)' },
  small: { height: 36, paddingHorizontal: 12, justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 22 },
  action: { flex: 1, height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  links: { marginTop: 22, gap: 4, alignItems: 'flex-start' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
});
