/**
 * Optional Google account + Firestore sync. The app stays local-first: without an account it is one
 * local book. Signed in, every book lives at books/{bookId} (recipes, folders, members, invites) and
 * users/{uid}/books lists the ones on your shelf. The open book is mirrored both ways: local edits are
 * written to its collections, edits from the brigade arrive through snapshot listeners. The other books
 * wait in the store's stash and catch up when opened. User photos are compressed (~1080 px JPEG) and
 * uploaded to Cloud Storage under users/{uploader}/photos/; everyone shows that copy.
 */
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithCredential,
  signOut,
  type User,
} from '@react-native-firebase/auth';
import {
  type DocumentData,
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
} from '@react-native-firebase/firestore';
import { deleteObject, getDownloadURL, getStorage, putFile, ref } from '@react-native-firebase/storage';
import { GoogleSignin, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Alert } from 'react-native';

import { useAccount } from './account';
import {
  type Book,
  DEFAULT_BOOK,
  DEFAULT_BOOK_NAME,
  type Invite,
  LOCAL_BOOK,
  type Member,
  type Role,
  ROLE_ORDER,
  canCook,
  copyOf,
  inviteExpiry,
  personalBookName,
  newInviteCode,
  prepareMove,
  trashExpired,
} from './books';
import { type Folder, type Recipe, SEED_FOLDERS, SEED_RECIPE_IDS } from './data';
import { contentOf, currentBook, live, useStore } from './store';
import type { Swatch } from './theme';

/** OAuth "web" client from google-services.json (client_type 3); Firebase verifies the Google ID token against it. */
const WEB_CLIENT_ID = '64817728713-lt6tnbn7lv1ucm9cqnbb6nq03aoro049.apps.googleusercontent.com';
const SEED_FOLDER_IDS: ReadonlySet<string> = new Set(SEED_FOLDERS.map((f) => f.id));
/** Firestore takes at most 500 writes per batch. */
const BATCH_LIMIT = 450;

/* ------------------------------------------------------------ cloud shape */

// Firestore refuses nested arrays and undefined values, so tuples become objects and optionals are dropped.
type CloudRecipe = Omit<Recipe, 'ingredients' | 'steps' | 'photoUri'> & {
  ingredients: { q: number | null; unit: string; label: string }[];
  steps: { text: string; min: number }[];
};

const defined = <T extends object>(o: T): T => JSON.parse(JSON.stringify(o)) as T;

function recipeToCloud({ photoUri: _local, ingredients, steps, ...rest }: Recipe): CloudRecipe {
  return defined({
    ...rest,
    ingredients: ingredients.map(([q, unit, label]) => ({ q, unit, label })),
    steps: steps.map(([text, min]) => ({ text, min })),
  });
}

function recipeFromCloud(data: DocumentData, localPhoto: string | undefined): Recipe {
  const c = data as CloudRecipe;
  return {
    ...c,
    photoUri: localPhoto,
    ingredients: (c.ingredients ?? []).map(({ q, unit, label }) => [q, unit, label]),
    steps: (c.steps ?? []).map(({ text, min }) => [text, min]),
  };
}

const folderToCloud = (f: Folder): Folder => defined(f);

const millis = (v: unknown): number => (v instanceof Timestamp ? v.toMillis() : typeof v === 'number' ? v : 0);

/* ----------------------------------------------------------------- photos */

const PHOTO_WIDTH = 1080;
const PHOTO_QUALITY = 0.72;

const keyOf = (uri: string): string => uri.split('/').pop() ?? uri;
const photoPath = (uid: string, recipeId: string, key: string): string => `users/${uid}/photos/${recipeId}/${key}.jpg`;
const needsUpload = (r: Recipe): boolean => !!r.photoUri?.startsWith('file:') && keyOf(r.photoUri) !== r.photoKey;

let photoQueue: Promise<void> = Promise.resolve();

/** One upload at a time; a failed one is retried on the next sync since its key still won't match. */
function queuePhotos(uid: string, recipes: readonly Recipe[]): void {
  for (const r of recipes.filter(needsUpload)) {
    photoQueue = photoQueue.then(() => uploadPhoto(uid, r.id)).catch((e: unknown) => fail(e, 'Photo non envoyée'));
  }
}

async function uploadPhoto(uid: string, recipeId: string): Promise<void> {
  const r = useStore.getState().recipes.find((x) => x.id === recipeId);
  if (!r?.photoUri || !needsUpload(r)) return;
  const key = keyOf(r.photoUri);
  const target = ref(getStorage(), photoPath(uid, recipeId, key));
  if (r.cutout) {
    // Already a small transparent WebP: re-encoding as JPEG would lose the transparency.
    await putFile(target, r.photoUri, { contentType: 'image/webp', cacheControl: 'public, max-age=31536000' });
  } else {
    const rendered = await ImageManipulator.manipulate(r.photoUri).resize({ width: PHOTO_WIDTH }).renderAsync();
    const jpeg = await rendered.saveAsync({ compress: PHOTO_QUALITY, format: SaveFormat.JPEG });
    await putFile(target, jpeg.uri, { contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000' });
  }
  const url = await getDownloadURL(target);
  // A plain local edit: the store diff below writes photoUrl/photoKey to Firestore.
  useStore.setState((s) => ({ recipes: s.recipes.map((x) => (x.id === recipeId ? { ...x, photoUrl: url, photoKey: key } : x)) }));
  if (r.photoKey) await deletePhoto(uid, recipeId, r.photoKey);
}

/** Only works on your own uploads; someone else's photo stays (and is harmless). */
const deletePhoto = (uid: string, recipeId: string, key: string): Promise<void> =>
  deleteObject(ref(getStorage(), photoPath(uid, recipeId, key))).catch(() => undefined);

/* ------------------------------------------------------------------ paths */

const db = () => getFirestore();
const bookDoc = (b: string) => doc(db(), 'books', b);
const recipesOf = (b: string) => collection(db(), 'books', b, 'recipes');
const foldersOf = (b: string) => collection(db(), 'books', b, 'folders');
const membersOf = (b: string) => collection(db(), 'books', b, 'members');
const bookInvitesOf = (b: string) => collection(db(), 'books', b, 'invites');
const shelfOf = (uid: string) => collection(db(), 'users', uid, 'books');
const inviteDoc = (code: string) => doc(db(), 'invites', code);

/* ------------------------------------------------------------- the engine */

interface ShelfEntry {
  id: string;
  role: Role;
  personal: boolean;
  joinedAt: number;
}

interface Session {
  user: User;
  stops: (() => void)[];
  /** Listeners of the open book. */
  stopBook: (() => void) | null;
  /** Per shelf book: its name/colour and my rank in it. */
  watchers: Map<string, () => void>;
  entries: Map<string, ShelfEntry>;
  meta: Map<string, { name: string; color: Swatch }>;
}

let session: Session | null = null;
let applyingRemote = false;
let attachToken = 0;
/** Recipes that just moved to another book: their photo files are still in use there. */
const movedOut = new Set<string>();

const withRemote = (apply: () => void): void => {
  applyingRemote = true;
  try {
    apply();
  } finally {
    applyingRemote = false;
  }
};

const waitForHydration = (): Promise<void> =>
  useStore.persist.hasHydrated() ? Promise.resolve() : new Promise((done) => useStore.persist.onFinishHydration(() => done()));

const newer = (a?: number, b?: number): boolean => (a ?? 0) > (b ?? 0);

function requireSession(): Session {
  if (!session) throw new Error('Connecte-toi avec Google pour partager tes livres.');
  return session;
}

function whoAmI(user: User): { uid: string; name: string; photo: string | null } {
  return { uid: user.uid, name: user.displayName ?? user.email ?? 'Moi', photo: user.photoURL ?? null };
}

/**
 * Union of both sides, newest edit wins. An item only this phone has is uploaded, unless it was already
 * synced before (older than `syncedAt`): then it was deleted elsewhere and goes. Untouched seed items the
 * cloud doesn't have are dropped once the book holds data, so a fresh install can't resurrect them.
 */
function merge<T extends { id: string; updatedAt?: number }>(local: T[], cloud: T[], seeds: ReadonlySet<string>, syncedAt: number) {
  const byId = new Map(cloud.map((c) => [c.id, c]));
  const upload: T[] = [];
  for (const l of local) {
    const c = byId.get(l.id);
    if (!c) {
      const untouchedSeed = seeds.has(l.id) && l.updatedAt === undefined;
      if (cloud.length && untouchedSeed) continue;
      if (syncedAt && (l.updatedAt ?? 0) <= syncedAt) continue;
      byId.set(l.id, l);
      upload.push(l);
    } else if (newer(l.updatedAt, c.updatedAt)) {
      byId.set(l.id, l);
      upload.push(l);
    }
  }
  return { merged: [...byId.values()], upload };
}

/** Writes and deletes in a book, split into batches Firestore accepts. */
async function commit(bookId: string, recipes: Recipe[], folders: Folder[], goneRecipes: string[] = [], goneFolders: string[] = []): Promise<void> {
  const ops: ((b: ReturnType<typeof writeBatch>) => void)[] = [
    ...recipes.map((r) => (b: ReturnType<typeof writeBatch>) => b.set(doc(recipesOf(bookId), r.id), recipeToCloud(r))),
    ...folders.map((f) => (b: ReturnType<typeof writeBatch>) => b.set(doc(foldersOf(bookId), f.id), folderToCloud(f))),
    ...goneRecipes.map((id) => (b: ReturnType<typeof writeBatch>) => b.delete(doc(recipesOf(bookId), id))),
    ...goneFolders.map((id) => (b: ReturnType<typeof writeBatch>) => b.delete(doc(foldersOf(bookId), id))),
  ];
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db());
    ops.slice(i, i + BATCH_LIMIT).forEach((op) => op(batch));
    await batch.commit();
  }
}

async function startSync(user: User): Promise<void> {
  useAccount.setState({ account: { uid: user.uid, name: user.displayName, email: user.email, photo: user.photoURL }, status: 'syncing', error: null });
  await waitForHydration();

  const s: Session = { user, stops: [], stopBook: null, watchers: new Map(), entries: new Map(), meta: new Map() };
  session = s;
  const entries = await ensureShelf(user);
  if (session !== s) return;
  entries.forEach((e) => s.entries.set(e.id, e));

  // This phone's local book is the account's personal book from now on.
  const personal = entries.find((e) => e.personal);
  const store = useStore.getState();
  if (personal && store.books.some((b) => b.id === LOCAL_BOOK)) withRemote(() => store.rekeyBook(LOCAL_BOOK, personal.id));
  publishBooks();
  const open = useStore.getState().bookId;
  if (!s.entries.has(open) && personal) withRemote(() => useStore.getState().openBook(personal.id));

  s.stops.push(watchShelf(s));
  s.stops.push(
    useStore.subscribe((next, prev) => {
      if (next.bookId !== prev.bookId) attachBook(next.bookId).catch(fail);
    }),
  );
  await attachBook(useStore.getState().bookId);
  useAccount.setState({ status: 'synced' });
}

function stopSync(): void {
  if (!session) return;
  session.stopBook?.();
  session.watchers.forEach((stop) => stop());
  session.stops.forEach((stop) => stop());
  session = null;
  attachToken++;
}

/** The shelf, creating the personal book the first time (and bringing the pre-books cloud copy into it). */
async function ensureShelf(user: User): Promise<ShelfEntry[]> {
  const snap = await getDocs(shelfOf(user.uid));
  if (!snap.empty) return snap.docs.map((d) => entryFrom(d.id, d.data()));

  const local = useStore.getState().books.find((b) => b.id === LOCAL_BOOK) ?? DEFAULT_BOOK;
  // Named after its owner, unless they already renamed it themselves.
  const name = local.name === DEFAULT_BOOK_NAME ? personalBookName(user.displayName) ?? local.name : local.name;
  const id = doc(collection(db(), 'books')).id;
  const now = Date.now();
  const batch = writeBatch(db());
  batch.set(bookDoc(id), { name, color: local.color, owner: user.uid, createdAt: now });
  batch.set(doc(membersOf(id), user.uid), memberData(user, 'chef', null, null));
  batch.set(doc(shelfOf(user.uid), id), { role: 'chef', personal: true, joinedAt: now });
  await batch.commit();

  const [legacyRecipes, legacyFolders] = await Promise.all([
    getDocs(collection(db(), 'users', user.uid, 'recipes')),
    getDocs(collection(db(), 'users', user.uid, 'folders')),
  ]);
  await commit(
    id,
    legacyRecipes.docs.map((d) => recipeFromCloud(d.data(), undefined)),
    legacyFolders.docs.map((d) => d.data() as Folder),
  );
  return [{ id, role: 'chef', personal: true, joinedAt: now }];
}

const entryFrom = (id: string, d: DocumentData): ShelfEntry => ({ id, role: (d.role as Role) ?? 'commis', personal: !!d.personal, joinedAt: d.joinedAt ?? 0 });

function memberData(user: User, role: Role, via: string | null, invitedBy: string | null): Member {
  const me = whoAmI(user);
  return { uid: me.uid, name: me.name, photo: me.photo, role, joinedAt: Date.now(), via, invitedBy };
}

/** The store's shelf, from the entries (rank) and the book documents (name, colour). */
function publishBooks(): void {
  const s = session;
  if (!s) return;
  const before = new Map(useStore.getState().books.map((b) => [b.id, b]));
  const books: Book[] = [...s.entries.values()]
    .sort((a, b) => Number(b.personal) - Number(a.personal) || a.joinedAt - b.joinedAt)
    .map((e) => ({
      id: e.id,
      role: e.role,
      personal: e.personal || undefined,
      name: s.meta.get(e.id)?.name ?? before.get(e.id)?.name ?? 'Livre',
      color: s.meta.get(e.id)?.color ?? before.get(e.id)?.color ?? 'plum',
    }));
  withRemote(() => useStore.getState().setBooks(books));
}

/** Follows users/{uid}/books, and for each book its document and my membership. */
function watchShelf(s: Session): () => void {
  return onSnapshot(
    shelfOf(s.user.uid),
    (snap) => {
      const seen = new Set<string>();
      for (const d of snap.docs) {
        // A just-joined book isn't readable until the write lands; wait for the confirmed snapshot.
        if (d.metadata.hasPendingWrites) continue;
        seen.add(d.id);
        const entry = entryFrom(d.id, d.data());
        // The membership watcher knows the rank best; the shelf entry only catches up with it.
        s.entries.set(d.id, { ...entry, role: s.entries.get(d.id)?.role ?? entry.role });
        if (!s.watchers.has(d.id)) s.watchers.set(d.id, watchBook(s, d.id));
      }
      for (const id of [...s.entries.keys()]) {
        if (!seen.has(id) && !snap.docs.some((d) => d.id === id)) forget(s, id);
      }
      publishBooks();
    },
    fail,
  );
}

function watchBook(s: Session, id: string): () => void {
  const gone = (e: unknown) => (isDenied(e) ? removedFrom(s, id) : fail(e));
  const stopDoc = onSnapshot(
    bookDoc(id),
    (snap) => {
      if (!snap.exists()) return removedFrom(s, id);
      const d = snap.data() ?? {};
      s.meta.set(id, { name: d.name ?? 'Livre', color: (d.color as Swatch) ?? 'plum' });
      publishBooks();
      // Personal books created before they were named after their owner: rename once, the listener then shows it.
      const named = personalBookName(s.user.displayName);
      if (s.entries.get(id)?.personal && d.owner === s.user.uid && d.name === DEFAULT_BOOK_NAME && named) {
        updateDoc(bookDoc(id), { name: named }).catch(() => undefined);
      }
    },
    gone,
  );
  const stopMember = onSnapshot(
    doc(membersOf(id), s.user.uid),
    (snap) => {
      if (!snap.exists()) return removedFrom(s, id);
      const role = (snap.data()?.role as Role) ?? 'commis';
      const entry = s.entries.get(id);
      if (entry && entry.role !== role) {
        s.entries.set(id, { ...entry, role });
        setDoc(doc(shelfOf(s.user.uid), id), { role }, { merge: true }).catch(() => undefined);
        publishBooks();
      }
    },
    gone,
  );
  return () => {
    stopDoc();
    stopMember();
  };
}

const isDenied = (e: unknown): boolean => String((e as { code?: string })?.code ?? e).includes('permission-denied');

/** Off my shelf here (left on another phone). */
function forget(s: Session, id: string): void {
  s.watchers.get(id)?.();
  s.watchers.delete(id);
  s.entries.delete(id);
  s.meta.delete(id);
  withRemote(() => useStore.getState().dropBook(id));
}

/** The book was deleted or the chef removed me. */
function removedFrom(s: Session, id: string): void {
  if (!s.entries.has(id) || s.entries.get(id)?.personal) return;
  const name = useStore.getState().books.find((b) => b.id === id)?.name;
  forget(s, id);
  publishBooks();
  deleteDoc(doc(shelfOf(s.user.uid), id)).catch(() => undefined);
  if (name) Alert.alert('Livre retiré', `Tu ne fais plus partie de la brigade de « ${name} ».`);
}

/** Mirrors the open book: a first merge, then listeners one way and a store diff the other. */
async function attachBook(bookId: string): Promise<void> {
  const s = session;
  if (!s) return;
  s.stopBook?.();
  s.stopBook = null;
  const token = ++attachToken;
  if (!s.entries.has(bookId)) return;
  const uid = s.user.uid;
  const photoMap = () => new Map(useStore.getState().recipes.map((r) => [r.id, r.photoUri]));

  const [rSnap, fSnap] = await Promise.all([getDocs(recipesOf(bookId)), getDocs(foldersOf(bookId))]);
  const st = useStore.getState();
  if (token !== attachToken || st.bookId !== bookId) return;
  const photos = photoMap();
  const cloudRecipes = rSnap.docs.map((d) => recipeFromCloud(d.data(), photos.get(d.id)));
  const cloudFolders = fSnap.docs.map((d) => d.data() as Folder);
  const cooks = canCook(currentBook(st).role);
  if (cooks) {
    const since = st.syncedAt[bookId] ?? 0;
    const r = merge(st.recipes, cloudRecipes, SEED_RECIPE_IDS, since);
    const f = merge(st.folders, cloudFolders, SEED_FOLDER_IDS, since);
    withRemote(() => useStore.setState({ recipes: r.merged, folders: f.merged }));
    await commit(bookId, r.upload, f.upload);
  } else {
    withRemote(() => useStore.setState({ recipes: cloudRecipes, folders: cloudFolders }));
  }
  if (token !== attachToken) return;
  useStore.getState().markSynced(bookId);
  queuePhotos(uid, useStore.getState().recipes);

  const unsubRecipes = onSnapshot(recipesOf(bookId), (snap) => {
    const local = photoMap();
    withRemote(() => useStore.setState({ recipes: snap.docs.map((d) => recipeFromCloud(d.data(), local.get(d.id))) }));
    if (!snap.metadata.fromCache) useStore.getState().markSynced(bookId);
  }, quietly);
  const unsubFolders = onSnapshot(foldersOf(bookId), (snap) => {
    withRemote(() => useStore.setState({ folders: snap.docs.map((d) => d.data() as Folder) }));
  }, quietly);

  // Mirror local edits: the store replaces an object whenever it changes, so identity tells us what to write.
  const unsubStore = useStore.subscribe((next, prev) => {
    if (applyingRemote || next.bookId !== bookId || prev.bookId !== bookId) return;
    if (!canCook(currentBook(next).role)) return;
    const changed = <T extends { id: string }>(a: T[], b: T[]) => {
      const before = new Map(b.map((x) => [x.id, x]));
      const ids = new Set(a.map((x) => x.id));
      return { put: a.filter((x) => before.get(x.id) !== x), gone: b.filter((x) => !ids.has(x.id)) };
    };
    const rc = next.recipes !== prev.recipes ? changed(next.recipes, prev.recipes) : { put: [], gone: [] };
    const fc = next.folders !== prev.folders ? changed(next.folders, prev.folders) : { put: [], gone: [] };
    if (rc.put.length || rc.gone.length || fc.put.length || fc.gone.length) {
      const ids = (xs: { id: string }[]) => xs.map((x) => x.id);
      commit(bookId, rc.put, fc.put, ids(rc.gone), ids(fc.gone)).catch(fail);
      queuePhotos(uid, rc.put);
      rc.gone.forEach((g) => {
        if (g.photoKey && !movedOut.delete(g.id)) deletePhoto(uid, g.id, g.photoKey);
      });
    }
  });

  s.stopBook = () => {
    unsubRecipes();
    unsubFolders();
    unsubStore();
  };

  // Trash older than TRASH_DAYS goes for good; whoever cooks in the book does the sweeping.
  if (cooks) {
    const expired = useStore.getState().recipes.filter((r) => trashExpired(r)).map((r) => r.id);
    if (expired.length) useStore.getState().purgeRecipes(expired);
  }
}

function fail(e: unknown, context?: string): void {
  const message = e instanceof Error ? e.message : String(e);
  useAccount.setState({ status: 'error', error: context ? `${context} : ${message}` : message });
}

/** A listener on a book I just left or lost access to: not a sync failure, just nothing more to show. */
const quietly = (e: unknown): void => {
  if (!isDenied(e)) fail(e);
};

/* ------------------------------------------------------------------ books */

function addEntry(entry: ShelfEntry, meta: { name: string; color: Swatch }): void {
  const s = requireSession();
  s.entries.set(entry.id, entry);
  s.meta.set(entry.id, meta);
  if (!s.watchers.has(entry.id)) s.watchers.set(entry.id, watchBook(s, entry.id));
  publishBooks();
}

/** A new, empty book with me as its Chef de cuisine. */
export async function createBook(name: string, color: Swatch): Promise<string> {
  const { user } = requireSession();
  const id = doc(collection(db(), 'books')).id;
  const now = Date.now();
  const batch = writeBatch(db());
  batch.set(bookDoc(id), { name, color, owner: user.uid, createdAt: now });
  batch.set(doc(membersOf(id), user.uid), memberData(user, 'chef', null, null));
  batch.set(doc(shelfOf(user.uid), id), { role: 'chef', personal: false, joinedAt: now });
  await batch.commit();
  addEntry({ id, role: 'chef', personal: false, joinedAt: now }, { name, color });
  return id;
}

export async function updateBook(id: string, patch: { name: string; color: Swatch }): Promise<void> {
  const s = requireSession();
  await updateDoc(bookDoc(id), patch);
  s.meta.set(id, patch);
  publishBooks();
}

/** Leaves a brigade; with `keepCopy`, its recipes (and folders) are copied into my personal book first. */
export async function leaveBook(id: string, keepCopy: boolean): Promise<void> {
  const s = requireSession();
  const home = [...s.entries.values()].find((e) => e.personal);
  if (keepCopy && home) {
    const [rSnap, fSnap] = await Promise.all([getDocs(recipesOf(id)), getDocs(foldersOf(id))]);
    const recipes = live(rSnap.docs.map((d) => recipeFromCloud(d.data(), undefined)));
    const moved = prepareMove(recipes, fSnap.docs.map((d) => d.data() as Folder), whoAmI(s.user));
    await commit(home.id, moved.recipes, moved.folders);
    withRemote(() => useStore.getState().stashAdd(home.id, moved));
  }
  const batch = writeBatch(db());
  batch.delete(doc(membersOf(id), s.user.uid));
  batch.delete(doc(shelfOf(s.user.uid), id));
  await batch.commit();
  forget(s, id);
  publishBooks();
}

/** Deletes a whole book and everything in it (chef only). */
export async function deleteBook(id: string): Promise<void> {
  const s = requireSession();
  const [recipes, folders, invites, members] = await Promise.all([
    getDocs(recipesOf(id)),
    getDocs(foldersOf(id)),
    getDocs(bookInvitesOf(id)),
    getDocs(membersOf(id)),
  ]);
  const ops: ((b: ReturnType<typeof writeBatch>) => void)[] = [
    ...recipes.docs.map((d) => (b: ReturnType<typeof writeBatch>) => b.delete(d.ref)),
    ...folders.docs.map((d) => (b: ReturnType<typeof writeBatch>) => b.delete(d.ref)),
    ...invites.docs.flatMap((d) => [(b: ReturnType<typeof writeBatch>) => b.delete(d.ref), (b: ReturnType<typeof writeBatch>) => b.delete(inviteDoc(d.id))]),
    ...members.docs.filter((d) => d.id !== s.user.uid).map((d) => (b: ReturnType<typeof writeBatch>) => b.delete(d.ref)),
  ];
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db());
    ops.slice(i, i + BATCH_LIMIT).forEach((op) => op(batch));
    await batch.commit();
  }
  // The book goes before my own membership: deleting it needs me to still be its chef.
  const last = writeBatch(db());
  last.delete(bookDoc(id));
  await last.commit();
  const mine = writeBatch(db());
  mine.delete(doc(membersOf(id), s.user.uid));
  mine.delete(doc(shelfOf(s.user.uid), id));
  await mine.commit();
  forget(s, id);
  publishBooks();
}

/* ---------------------------------------------------------------- brigade */

export function watchMembers(bookId: string, onChange: (members: Member[]) => void): () => void {
  if (!session || !session.entries.has(bookId)) return () => undefined;
  return onSnapshot(
    membersOf(bookId),
    (snap) => {
      const members = snap.docs.map((d) => ({ ...(d.data() as Member), uid: d.id, joinedAt: millis(d.data().joinedAt) }));
      members.sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.joinedAt - b.joinedAt);
      onChange(members);
    },
    quietly,
  );
}

export type PendingInvite = Pick<Invite, 'code' | 'role' | 'by' | 'byName' | 'createdAt' | 'expiresAt'>;

export function watchInvites(bookId: string, onChange: (invites: PendingInvite[]) => void): () => void {
  if (!session || !session.entries.has(bookId)) return () => undefined;
  return onSnapshot(
    bookInvitesOf(bookId),
    (snap) => onChange(snap.docs.map((d) => ({ ...(d.data() as PendingInvite), code: d.id, expiresAt: millis(d.data().expiresAt) }))),
    quietly,
  );
}

export async function setMemberRole(bookId: string, uid: string, role: Exclude<Role, 'chef'>): Promise<void> {
  requireSession();
  await updateDoc(doc(membersOf(bookId), uid), { role });
}

/** Hands my toque to someone: they become Chef de cuisine, I become Sous-chef. */
export async function passToque(bookId: string, uid: string): Promise<void> {
  const s = requireSession();
  const batch = writeBatch(db());
  batch.update(bookDoc(bookId), { owner: uid });
  batch.update(doc(membersOf(bookId), uid), { role: 'chef' });
  batch.update(doc(membersOf(bookId), s.user.uid), { role: 'sous' });
  await batch.commit();
}

export async function removeMember(bookId: string, uid: string): Promise<void> {
  requireSession();
  const batch = writeBatch(db());
  batch.delete(doc(membersOf(bookId), uid));
  await batch.commit();
}

/* ---------------------------------------------------------------- invites */

export async function createInvite(bookId: string, role: Exclude<Role, 'chef'>): Promise<Invite> {
  const s = requireSession();
  const book = useStore.getState().books.find((b) => b.id === bookId);
  const me = whoAmI(s.user);
  const now = Date.now();
  const invite: Invite = {
    code: newInviteCode(),
    bookId,
    bookName: book?.name ?? 'Livre',
    bookColor: book?.color ?? 'plum',
    role,
    by: me.uid,
    byName: me.name,
    createdAt: now,
    expiresAt: inviteExpiry(now),
    usedBy: null,
  };
  const expiresAt = Timestamp.fromMillis(invite.expiresAt);
  const batch = writeBatch(db());
  const { code: _id, ...fields } = invite;
  batch.set(inviteDoc(invite.code), { ...fields, expiresAt });
  batch.set(doc(bookInvitesOf(bookId), invite.code), { role, by: me.uid, byName: me.name, createdAt: now, expiresAt });
  await batch.commit();
  return invite;
}

export async function cancelInvite(bookId: string, code: string): Promise<void> {
  requireSession();
  const batch = writeBatch(db());
  batch.delete(doc(bookInvitesOf(bookId), code));
  batch.delete(inviteDoc(code));
  await batch.commit();
}

/** Null when no invite has this code. */
export async function fetchInvite(code: string): Promise<Invite | null> {
  requireSession();
  const snap = await getDoc(inviteDoc(code));
  if (!snap.exists()) return null;
  const d = snap.data() ?? {};
  return { ...(d as Invite), code, expiresAt: millis(d.expiresAt), usedBy: d.usedBy ?? null };
}

/** Am I already in this book's brigade? */
export const isOnMyShelf = (bookId: string): boolean => !!session?.entries.has(bookId);

/**
 * Joins the brigade with this invite. `bring` are recipes of my personal book that move in with me
 * (with the folders holding them); they leave the personal book.
 */
export async function acceptInvite(invite: Invite, bring: readonly Recipe[]): Promise<void> {
  const s = requireSession();
  const now = Date.now();
  const batch = writeBatch(db());
  batch.update(inviteDoc(invite.code), { usedBy: s.user.uid, usedAt: now });
  batch.set(doc(membersOf(invite.bookId), s.user.uid), memberData(s.user, invite.role, invite.code, invite.by));
  batch.set(doc(shelfOf(s.user.uid), invite.bookId), { role: invite.role, personal: false, joinedAt: now });
  await batch.commit();
  addEntry({ id: invite.bookId, role: invite.role, personal: false, joinedAt: now }, { name: invite.bookName, color: invite.bookColor });

  const home = [...s.entries.values()].find((e) => e.personal);
  if (bring.length && home && canCook(invite.role)) {
    const moved = prepareMove(bring, contentOf(useStore.getState(), home.id).folders, whoAmI(s.user));
    await commit(invite.bookId, moved.recipes, moved.folders);
    // Kept with their local photo files, so photos not uploaded yet still go up once the book is open.
    withRemote(() => useStore.getState().stashAdd(invite.bookId, moved));
    await takeOut(home.id, bring.map((r) => r.id));
  }
  useStore.getState().openBook(invite.bookId);
}

/** Removes recipes that moved to another book, from the book they left. */
async function takeOut(bookId: string, ids: readonly string[]): Promise<void> {
  ids.forEach((id) => movedOut.add(id));
  const store = useStore.getState();
  if (store.bookId === bookId) {
    store.purgeRecipes(ids);
    return;
  }
  const { recipes, folders } = contentOf(store, bookId);
  const gone = new Set(ids);
  const trimmed = folders.filter((f) => f.ids.some((x) => gone.has(x))).map((f) => ({ ...f, ids: f.ids.filter((x) => !gone.has(x)), updatedAt: Date.now() }));
  await commit(bookId, [], trimmed, [...ids]);
  withRemote(() =>
    useStore.setState((st) => ({
      stash: {
        ...st.stash,
        [bookId]: { recipes: recipes.filter((r) => !gone.has(r.id)), folders: folders.map((f) => trimmed.find((t) => t.id === f.id) ?? f) },
      },
    })),
  );
}

/** A Commis keeps a recipe: a copy goes into one of my books (one where I cook). */
export async function copyRecipeToBook(recipe: Recipe, bookId: string): Promise<void> {
  const s = requireSession();
  const copy = copyOf(recipe, whoAmI(s.user));
  await commit(bookId, [copy], []);
  withRemote(() => useStore.getState().stashAdd(bookId, { recipes: [copy], folders: [] }));
}

/* ------------------------------------------------------------------- auth */

/** Call once at startup; follows the Firebase session for the life of the app. */
export function initCloud(): () => void {
  GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
  return onAuthStateChanged(getAuth(), (user) => {
    stopSync();
    if (user) startSync(user).catch(fail);
    else useAccount.setState({ account: null, status: 'off', error: null });
  });
}

export type SignInOutcome = 'signed-in' | 'cancelled';

/** 'cancelled' when the Google picker closed without an account (backed out, or never shown). */
export async function signInWithGoogle(): Promise<SignInOutcome> {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    if (res.type !== 'success') return 'cancelled';
    if (!res.data.idToken) throw new Error('Google n’a pas renvoyé de jeton de connexion.');
    await signInWithCredential(getAuth(), GoogleAuthProvider.credential(res.data.idToken));
    return 'signed-in';
  } catch (e) {
    if (isErrorWithCode(e)) {
      if (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS) return 'cancelled';
      if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) throw new Error('Les services Google Play ne sont pas disponibles sur ce téléphone.');
      if (e.code === '10' || e.code === 'DEVELOPER_ERROR') throw new Error('Connexion Google mal configurée (empreinte SHA-1 ou identifiant client). Code 10.');
      // Keep the raw code visible: it's what tells a config problem from a network one.
      throw new Error(`${e.message} (code ${e.code})`);
    }
    throw e;
  }
}

/** Signs out of Firebase and Google. The personal book stays on this phone; shared books leave it. */
export async function signOutOfCloud(): Promise<void> {
  await GoogleSignin.signOut().catch(() => undefined);
  stopSync();
  await signOut(getAuth());
  const store = useStore.getState();
  const personal = store.books.find((b) => b.personal) ?? store.books[0];
  if (!personal) return;
  withRemote(() => {
    useStore.getState().openBook(personal.id);
    useStore.getState().books.filter((b) => b.id !== personal.id).forEach((b) => useStore.getState().dropBook(b.id));
    useStore.getState().rekeyBook(personal.id, LOCAL_BOOK);
    useStore.getState().setBooks([{ ...personal, id: LOCAL_BOOK, role: 'chef', personal: true }]);
  });
}
