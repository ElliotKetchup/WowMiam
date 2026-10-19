/**
 * A new invitation for the open book, shown as a kitchen order ticket hanging from the rail:
 * the rank it gives, its code, a QR code to scan from this phone, and a button to send it.
 */
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Toque } from '@/components/books';
import { QrCode } from '@/components/qr';
import { Brut, Display, Icon, StatusShade, tap, Txt } from '@/components/ui';
import { type Invite, type Role, ROLE_DOES, ROLE_LABEL, firstName, invitableRoles, inviteLink, inviteMessage, prettyCode } from '@/lib/books';
import { cancelInvite, createInvite } from '@/lib/cloud';
import { useBook } from '@/lib/store';
import { C } from '@/lib/theme';

type Rank = Exclude<Role, 'chef'>;
const TICKET = 300;
const TOOTH = 15;

export default function InviteScreen() {
  const insets = useSafeAreaInsets();
  const book = useBook();
  const ranks = invitableRoles(book.role);
  const [rank, setRank] = useState<Rank>(ranks[0] ?? 'commis');
  const [invite, setInvite] = useState<Invite | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const sent = useRef(false);

  // One invite per rank shown; switching rank before sending replaces the unsent one.
  useEffect(() => {
    let alive = true;
    let made: Invite | null = null;
    setInvite(null);
    setProblem(null);
    createInvite(book.id, rank)
      .then((i) => {
        made = i;
        if (alive) setInvite(i);
        else cancelInvite(book.id, i.code).catch(() => undefined);
      })
      .catch((e: unknown) => alive && setProblem(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
      if (made && !sent.current) cancelInvite(book.id, made.code).catch(() => undefined);
      sent.current = false;
    };
  }, [book.id, rank]);

  const send = async () => {
    if (!invite) return;
    tap();
    sent.current = true;
    await Share.share({ message: inviteMessage(invite) }).catch(() => undefined);
  };

  const until = invite ? new Date(invite.expiresAt).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) : '';

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 120, paddingHorizontal: 16 }}>
        <View style={styles.bar}>
          <Brut radius={12} style={styles.sq} onPress={() => router.back()} accessibilityLabel="Fermer">
            <Icon name="close" />
          </Brut>
        </View>
        <Display size={34} style={{ marginTop: 12 }}>Nouvelle invitation</Display>

        {ranks.length > 1 ? (
          <View style={styles.seg} accessibilityRole="radiogroup">
            {ranks.map((r) => (
              <Pressable
                key={r}
                onPress={() => { tap(); setRank(r); }}
                style={[styles.segBtn, rank === r && { backgroundColor: C.ink }]}
                accessibilityRole="radio"
                accessibilityState={{ checked: rank === r }}>
                <Txt font="bold" size={14} color={rank === r ? C.paper : C.ink}>{ROLE_LABEL[r]}</Txt>
              </Pressable>
            ))}
          </View>
        ) : null}
        <Txt size={13} font="medium" color={C.muted} style={{ marginTop: 10 }}>{ROLE_DOES[rank]}</Txt>

        <View style={styles.rail} />
        <View style={styles.ticketWrap}>
          <View style={styles.ticket}>
            <View style={styles.ticketHead}>
              <Txt font="bold" size={11} color={C.muted} style={styles.caps}>BON POUR</Txt>
              {invite ? <Txt font="bold" size={11} color={C.muted} style={styles.caps}>{prettyCode(invite.code)}</Txt> : null}
            </View>
            <View style={styles.rankRow}>
              <Toque role={rank} size={40} />
              <Display size={28}>1 {ROLE_LABEL[rank]}</Display>
            </View>
            <View style={styles.cut} />
            <Line label="Livre" value={book.name} />
            <Line label="De la part de" value={invite ? firstName(invite.byName) : '…'} />
            <Line label="Valable jusqu’au" value={until || '…'} />
            <Line label="Utilisable" value="1 fois" />
            <View style={styles.cut} />
            <View style={styles.qrBox}>
              {invite ? (
                <Animated.View entering={FadeIn.duration(200)}>
                  <QrCode value={inviteLink(invite.code)} size={168} />
                </Animated.View>
              ) : problem ? (
                <Txt size={13} font="semi" color={C.coral} style={{ textAlign: 'center', padding: 8 }}>{problem}</Txt>
              ) : (
                <ActivityIndicator color={C.ink} />
              )}
            </View>
            <Txt size={12} font="semi" color={C.muted} style={{ textAlign: 'center', marginTop: 8 }}>
              À scanner avec l’appareil photo du téléphone
            </Txt>
          </View>
          <View style={styles.teeth}>
            {Array.from({ length: TICKET / TOOTH }, (_, i) => (
              <View key={i} style={styles.tooth} />
            ))}
          </View>
        </View>
      </ScrollView>

      <StatusShade height={insets.top} />
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Brut color={invite ? C.ink : 'rgba(42,21,48,0.25)'} shadow={invite ? C.pink : 'transparent'} radius={14} style={styles.send} onPress={send} disabled={!invite}>
          <Icon name="share" color={C.paper} />
          <Display size={17} color={C.paper}>Envoyer l’invitation</Display>
        </Brut>
      </View>
    </View>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <Txt size={13} font="medium" color={C.muted}>{label}</Txt>
      <Txt size={13} font="bold" numberOfLines={1} style={{ flexShrink: 1, textAlign: 'right' }}>{value}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 56, flexDirection: 'row', alignItems: 'center' },
  sq: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  seg: { marginTop: 16, flexDirection: 'row', borderWidth: 2, borderColor: C.ink, borderRadius: 12, overflow: 'hidden', backgroundColor: C.tile },
  segBtn: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' },
  rail: { marginTop: 22, height: 22, borderWidth: 2, borderColor: C.ink, borderRadius: 999, backgroundColor: '#DCD3DB', boxShadow: '0px 4px 0px #2A1530', zIndex: 2 },
  ticketWrap: { width: TICKET, alignSelf: 'center', marginTop: -10, transform: [{ rotate: '-1.5deg' }] },
  ticket: { backgroundColor: C.tile, borderLeftWidth: 2, borderRightWidth: 2, borderColor: C.ink, paddingHorizontal: 18, paddingTop: 22, paddingBottom: 8 },
  ticketHead: { flexDirection: 'row', justifyContent: 'space-between' },
  caps: { letterSpacing: 1.8, lineHeight: 14 },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  cut: { borderTopWidth: 2, borderStyle: 'dashed', borderColor: C.ink, marginVertical: 12 },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 3 },
  qrBox: { alignSelf: 'center', minWidth: 184, minHeight: 184, padding: 6, borderWidth: 2, borderColor: C.ink, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: C.tile },
  // The torn edge: diamonds hung under the ticket, their top halves hidden behind it.
  teeth: { flexDirection: 'row', height: TOOTH / 2 + 3, overflow: 'hidden', marginTop: -1 },
  tooth: {
    width: TOOTH,
    height: TOOTH,
    marginTop: -TOOTH / 2 - 1,
    backgroundColor: C.tile,
    borderWidth: 2,
    borderColor: C.ink,
    transform: [{ rotate: '45deg' }, { scale: 0.72 }],
  },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 14, paddingHorizontal: 16, backgroundColor: 'rgba(244,239,243,0.94)' },
  send: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
