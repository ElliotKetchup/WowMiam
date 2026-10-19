/** Cookbook pieces: the toque, avatars, the big cover on the home screen, the shelf and book sheets. */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Sheet } from '@/components/sheets';
import { Sticker } from '@/components/sticker';
import { Brut, Display, Icon, tap, Txt } from '@/components/ui';
import { useAccount } from '@/lib/account';
import { type Book, type Member, parseInviteCode, type Role, ROLE_LABEL, ROLE_SWATCH, canCook, initialOf } from '@/lib/books';
import { createBook, updateBook, watchMembers } from '@/lib/cloud';
import { photoOf, type Recipe } from '@/lib/data';
import { contentOf, live, useStore } from '@/lib/store';
import { C, F, FOLDER_SWATCHES, type Swatch, fg, hardShadow, shade } from '@/lib/theme';

/* ------------------------------------------------------------------ toque */

/** A chef's hat: puffed top, pleats, and a band; the more pleats and the brighter the band, the higher the rank. */
export function Toque({ role, size = 28 }: { role: Role; size?: number }) {
  const pleats = role === 'chef' ? 3 : role === 'sous' ? 2 : 1;
  const border = Math.max(1.5, size * 0.07);
  const puff = size * 0.46;
  const hat = { borderWidth: border, borderColor: C.ink, backgroundColor: C.tile } as const;
  return (
    <View style={{ width: size, height: size }} accessibilityLabel={ROLE_LABEL[role]}>
      {/* Side puffs sit behind the crown, so only their outer curves show. */}
      <View style={[hat, { position: 'absolute', left: 0, top: size * 0.16, width: puff, height: puff, borderRadius: puff / 2 }]} />
      <View style={[hat, { position: 'absolute', right: 0, top: size * 0.16, width: puff, height: puff, borderRadius: puff / 2 }]} />
      <View
        style={[
          hat,
          {
            position: 'absolute',
            left: size * 0.2,
            right: size * 0.2,
            top: 0,
            height: size * 0.74,
            borderTopLeftRadius: size * 0.3,
            borderTopRightRadius: size * 0.3,
            borderBottomLeftRadius: size * 0.04,
            borderBottomRightRadius: size * 0.04,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'flex-end',
            gap: size * 0.1,
            paddingBottom: size * 0.03,
          },
        ]}>
        {Array.from({ length: pleats }, (_, i) => (
          <View key={i} style={{ width: border, height: size * 0.24, borderRadius: border, backgroundColor: C.ink }} />
        ))}
      </View>
      <View
        style={{
          position: 'absolute',
          left: size * 0.17,
          right: size * 0.17,
          bottom: 0,
          height: size * 0.3,
          borderRadius: size * 0.06,
          borderWidth: border,
          borderColor: C.ink,
          backgroundColor: C[ROLE_SWATCH[role]],
        }}
      />
    </View>
  );
}

/* ---------------------------------------------------------------- avatars */

const AVATAR_SWATCHES: readonly Swatch[] = ['amber', 'teal', 'pink', 'olive', 'coral', 'navy', 'plum'];
const avatarSwatch = (uid: string): Swatch => AVATAR_SWATCHES[[...uid].reduce((n, ch) => n + ch.charCodeAt(0), 0) % AVATAR_SWATCHES.length];

export function MemberAvatar({ uid, name, photo, size = 36 }: { uid: string; name: string | null; photo: string | null; size?: number }) {
  const sw = avatarSwatch(uid);
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: C[sw] }]}>
      {photo ? (
        <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <Display size={size * 0.44} color={fg(sw)}>{initialOf(name)}</Display>
      )}
    </View>
  );
}

export function AvatarStack({ members, max = 3, size = 28 }: { members: readonly Member[]; max?: number; size?: number }) {
  const shown = members.slice(0, max);
  const more = members.length - shown.length;
  return (
    <View style={{ flexDirection: 'row' }}>
      {shown.map((m, i) => (
        <View key={m.uid} style={{ marginLeft: i ? -size * 0.28 : 0 }}>
          <MemberAvatar uid={m.uid} name={m.name} photo={m.photo} size={size} />
        </View>
      ))}
      {more > 0 ? (
        <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, marginLeft: -size * 0.28, backgroundColor: C.paper }]}>
          <Txt font="bold" size={size * 0.38} style={{ lineHeight: size * 0.5 }}>+{more}</Txt>
        </View>
      ) : null}
    </View>
  );
}

/**
 * The open book's brigade, live. Without an account it's just you, alone in your local book.
 */
export function useMembers(bookId: string): Member[] {
  const account = useAccount((s) => s.account);
  // Listeners need the sync session, which is ready once the first sync is done.
  const ready = useAccount((s) => s.status === 'synced' || s.status === 'error');
  const [members, setMembers] = useState<Member[]>([]);
  useEffect(() => {
    setMembers([]);
    return ready ? watchMembers(bookId, setMembers) : undefined;
  }, [bookId, account?.uid, ready]);
  const alone = useMemo<Member[]>(
    () => [{ uid: account?.uid ?? 'me', name: account?.name ?? 'Toi', photo: account?.photo ?? null, role: 'chef', joinedAt: 0 }],
    [account?.uid, account?.name, account?.photo],
  );
  return account && members.length ? members : alone;
}

/* ------------------------------------------------------------------ covers */

/** A small closed book: page edges behind, spine on the left, an optional sticker on top. */
export function MiniCover({ color, cover, width = 58, height = 76 }: { color: Swatch; cover?: Recipe; width?: number; height?: number }) {
  return (
    <View style={{ width: width + 5, height: height + 4 }}>
      <View style={[styles.page, { left: 5, top: 4, width, height, borderTopRightRadius: width * 0.16, borderBottomRightRadius: width * 0.16 }]} />
      <View style={[styles.mini, { width, height, backgroundColor: C[color], borderTopRightRadius: width * 0.16, borderBottomRightRadius: width * 0.16 }]}>
        <View style={[styles.miniSpine, { width: width * 0.16, backgroundColor: shade(C[color], 0.2) }]} />
      </View>
      {cover ? <Sticker recipe={cover} size={width} rotate={8} animate={false} style={{ left: width * 0.28, top: height * 0.24 }} /> : null}
    </View>
  );
}

const coverOf = (recipes: readonly Recipe[], skip = 0): Recipe | undefined => live(recipes).filter((r) => r.sticker || photoOf(r)).at(skip);

/** The open book on the home screen: a big bound cover with its bookplate and the brigade. */
export function BookCover({ book, members }: { book: Book; members: Member[] }) {
  const recipes = useStore((s) => s.recipes);
  const folders = useStore((s) => s.folders);
  const n = live(recipes).length;
  const back = shade(C[book.color], 0.2);
  const first = coverOf(recipes);
  const second = coverOf(recipes, 1);
  const titleSize = book.name.length > 16 ? 26 : book.name.length > 8 ? 31 : 38;
  return (
    <View style={styles.coverWrap}>
      <View style={[styles.coverPage, { left: 10, top: 10, right: -2, bottom: -6 }]} />
      <View style={[styles.coverPage, { left: 6, top: 6, right: 2, bottom: -2 }]} />
      <View style={[styles.cover, { backgroundColor: C[book.color] }]}>
        <View style={[styles.spine, { backgroundColor: back }]}>
          <View style={[styles.spineBand, { top: 22 }]} />
          <View style={[styles.spineBand, { bottom: 22 }]} />
        </View>
      </View>
      {first ? <Sticker key={first.id} recipe={first} size={128} rotate={11} style={{ right: -18, top: -28 }} delay={200} /> : null}
      {second ? <Sticker key={second.id} recipe={second} size={100} rotate={-12} style={{ left: 12, bottom: -20 }} delay={340} /> : null}
      <View style={styles.plate}>
        <Txt font="bold" size={10} color={C[book.color] === C.amber ? shade(C.amber, 0.3) : C[book.color]} style={styles.eyebrow}>LIVRE DE RECETTES</Txt>
        <Display size={titleSize} style={{ textAlign: 'center', marginTop: 6 }} numberOfLines={2}>{book.name}</Display>
        <Txt font="semi" size={12} color={C.muted} style={{ marginTop: 6 }}>
          {n} recette{n > 1 ? 's' : ''} · {folders.length} dossier{folders.length > 1 ? 's' : ''}
        </Txt>
      </View>
      <Pressable onPress={() => { tap(); router.push('/brigade'); }} style={styles.brigadePill} accessibilityRole="button" accessibilityLabel="Brigade">
        <AvatarStack members={members} size={26} />
        <Txt font="semi" size={13}>Brigade</Txt>
        <Icon name="chevron-right" size={18} />
      </Pressable>
    </View>
  );
}

/* ------------------------------------------------------------------ shelf */

/** "Mes livres": switch book, create one, or join one with a code. */
export function ShelfSheet({ visible, onClose, onNewBook, onAccount }: { visible: boolean; onClose: () => void; onNewBook: () => void; onAccount: () => void }) {
  const books = useStore((s) => s.books);
  const bookId = useStore((s) => s.bookId);
  const openBook = useStore((s) => s.openBook);
  const content = useStore((s) => s);
  const account = useAccount((s) => s.account);
  const [code, setCode] = useState('');
  const [bad, setBad] = useState(false);

  const join = () => {
    const parsed = parseInviteCode(code);
    if (!parsed) {
      setBad(true);
      return;
    }
    setCode('');
    setBad(false);
    onClose();
    router.push({ pathname: '/invite/[code]', params: { code: parsed } });
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Mes livres">
      <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ gap: 14, paddingBottom: 6, paddingRight: 4 }} keyboardShouldPersistTaps="handled">
        {books.map((b) => {
          const recipes = contentOf(content, b.id).recipes;
          const n = live(recipes).length;
          const open = b.id === bookId;
          return (
            <Brut
              key={b.id}
              radius={18}
              shadow={open ? C.pink : C.ink}
              style={styles.shelfRow}
              onPress={() => {
                onClose();
                if (!open) setTimeout(() => openBook(b.id), 180);
              }}
              accessibilityLabel={`${b.name}, ${ROLE_LABEL[b.role]}`}>
              <MiniCover color={b.color} cover={coverOf(recipes)} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Display size={21} numberOfLines={2}>{b.name}</Display>
                <View style={styles.rankRow}>
                  <Toque role={b.role} size={20} />
                  <Txt font="semi" size={13}>{ROLE_LABEL[b.role]}</Txt>
                </View>
                <Txt size={12} font="medium" color={C.muted}>
                  {n ? `${n} recette${n > 1 ? 's' : ''}` : 'Pas encore de recette ici'}
                  {canCook(b.role) ? '' : ' · lecture seule'}
                </Txt>
              </View>
              {open ? (
                <View style={styles.openPill}><Txt font="bold" size={12} color={C.paper}>Ouvert</Txt></View>
              ) : (
                <Icon name="chevron-right" size={20} />
              )}
            </Brut>
          );
        })}

        {account ? (
          <>
            <View style={[styles.dashed, { backgroundColor: 'rgba(214,59,136,0.10)' }]}>
              <Icon name="mail" />
              <TextInput
                value={code}
                onChangeText={(t) => { setCode(t); setBad(false); }}
                placeholder="Code d’invitation"
                placeholderTextColor={C.muted}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={40}
                returnKeyType="go"
                onSubmitEditing={join}
                style={styles.codeInput}
                accessibilityLabel="Code d’invitation"
              />
              <Brut color={C.ink} radius={10} offset={2} style={styles.codeBtn} onPress={join} disabled={!code.trim()}>
                <Txt font="bold" size={13} color={C.paper}>Rejoindre</Txt>
              </Brut>
            </View>
            {bad ? <Txt size={13} font="semi" color={C.coral}>Ce code ne ressemble pas à une invitation (8 lettres et chiffres).</Txt> : null}
            <Pressable onPress={() => { tap(); onClose(); onNewBook(); }} style={({ pressed }) => [styles.newBook, pressed && { backgroundColor: 'rgba(42,21,48,0.06)' }]}>
              <Icon name="add" />
              <Display size={17}>Nouveau livre</Display>
            </Pressable>
          </>
        ) : (
          <View style={[styles.dashed, { flexDirection: 'column', alignItems: 'stretch', gap: 10, padding: 14 }]}>
            <Txt size={14} style={{ lineHeight: 20 }}>
              Connecte-toi avec Google pour créer d’autres livres et cuisiner à plusieurs.
            </Txt>
            <Brut color={C.ink} shadow={C.pink} radius={12} style={{ height: 46, alignItems: 'center', justifyContent: 'center' }} onPress={() => { onClose(); onAccount(); }}>
              <Display size={16} color={C.paper}>Se connecter</Display>
            </Brut>
          </View>
        )}
      </ScrollView>
    </Sheet>
  );
}

/* -------------------------------------------------------------- book sheet */

/** Create a book, or rename/recolour one (`book` given). */
export function BookSheet({ visible, onClose, book }: { visible: boolean; onClose: () => void; book?: Book }) {
  const openBook = useStore((s) => s.openBook);
  const [name, setName] = useState('');
  const [color, setColor] = useState<Swatch>('teal');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName(book?.name ?? '');
    setColor(book?.color ?? 'teal');
    setProblem(null);
  }, [visible, book]);

  const ok = name.trim().length > 0 && !busy;
  const submit = async () => {
    if (!ok) return;
    tap();
    setBusy(true);
    setProblem(null);
    try {
      if (book) await updateBook(book.id, { name: name.trim(), color });
      else {
        const id = await createBook(name.trim(), color);
        setTimeout(() => openBook(id), 200);
      }
      onClose();
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={book ? 'Modifier le livre' : 'Nouveau livre'}>
      <View style={[styles.preview, { backgroundColor: C[color] }]}>
        <View style={[styles.spine, { width: 20, backgroundColor: shade(C[color], 0.2) }]} />
        <View style={styles.previewPlate}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Nom du livre"
            placeholderTextColor="rgba(42,21,48,0.4)"
            style={styles.nameInput}
            autoFocus={!book}
            maxLength={30}
            returnKeyType="done"
            onSubmitEditing={submit}
            accessibilityLabel="Nom du livre"
          />
        </View>
      </View>
      <Txt font="semi" size={13} color={C.muted} style={{ marginTop: 18, marginBottom: 10 }}>Couverture</Txt>
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
      {problem ? <Txt size={13} font="semi" color={C.coral} style={{ marginTop: 12 }}>{problem}</Txt> : null}
      <Brut color={ok ? C.ink : 'rgba(42,21,48,0.25)'} shadow={ok ? C.pink : 'transparent'} radius={14} style={styles.cta} onPress={submit} disabled={!ok}>
        {busy ? <ActivityIndicator color={C.paper} /> : <Display size={17} color={C.paper}>{book ? 'Enregistrer' : 'Créer le livre'}</Display>}
      </Brut>
      {!book ? (
        <Txt size={12} color={C.muted} style={{ marginTop: 12, textAlign: 'center' }}>Tu en seras le Chef de cuisine. Il commence vide.</Txt>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  avatar: { borderWidth: 2, borderColor: C.ink, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  page: { position: 'absolute', borderWidth: 2, borderColor: C.ink, borderTopLeftRadius: 3, borderBottomLeftRadius: 3, backgroundColor: C.tile },
  mini: { borderWidth: 2, borderColor: C.ink, borderTopLeftRadius: 3, borderBottomLeftRadius: 3, overflow: 'hidden' },
  miniSpine: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRightWidth: 2, borderColor: C.ink },
  coverWrap: { height: 262, marginHorizontal: 16, marginTop: 18 },
  coverPage: { position: 'absolute', borderWidth: 2, borderColor: C.ink, borderTopLeftRadius: 6, borderBottomLeftRadius: 6, borderTopRightRadius: 20, borderBottomRightRadius: 20, backgroundColor: C.tile },
  cover: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 8,
    bottom: 4,
    borderWidth: 2,
    borderColor: C.ink,
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
  },
  spine: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 26, borderRightWidth: 2, borderColor: C.ink },
  spineBand: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: C.ink },
  plate: {
    position: 'absolute',
    left: 52,
    right: 64,
    top: 46,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: C.ink,
    borderRadius: 14,
    backgroundColor: C.paper,
    boxShadow: hardShadow(3),
  },
  eyebrow: { letterSpacing: 1.8, lineHeight: 13 },
  brigadePill: {
    position: 'absolute',
    right: 22,
    bottom: 18,
    height: 42,
    paddingLeft: 6,
    paddingRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: C.ink,
    borderRadius: 999,
    backgroundColor: C.paper,
  },
  shelfRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, paddingRight: 14 },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, marginBottom: 2 },
  openPill: { height: 26, paddingHorizontal: 10, borderRadius: 999, backgroundColor: C.ink, justifyContent: 'center' },
  dashed: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 2, borderStyle: 'dashed', borderColor: C.ink, borderRadius: 18, padding: 10, paddingLeft: 14 },
  codeInput: { flex: 1, fontFamily: F.semi, fontSize: 15, color: C.ink, paddingVertical: 6, letterSpacing: 1 },
  codeBtn: { height: 38, paddingHorizontal: 12, justifyContent: 'center' },
  newBook: { height: 52, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', borderColor: C.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  preview: { height: 120, borderRadius: 18, borderTopLeftRadius: 6, borderBottomLeftRadius: 6, borderWidth: 2, borderColor: C.ink, boxShadow: hardShadow(4), justifyContent: 'center', paddingLeft: 36, paddingRight: 20, overflow: 'hidden' },
  previewPlate: { borderWidth: 2, borderColor: C.ink, borderRadius: 12, backgroundColor: C.paper, paddingHorizontal: 12 },
  nameInput: { fontFamily: F.display, fontSize: 24, color: C.ink, paddingVertical: 8, textAlign: 'center' },
  swatch: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  swatchOn: { boxShadow: '0px 0px 0px 3px #F4EFF3, 0px 0px 0px 5px #2A1530' },
  cta: { marginTop: 22, height: 54, alignItems: 'center', justifyContent: 'center' },
});
