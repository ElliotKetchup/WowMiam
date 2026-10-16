/**
 * Optional Google account + Firestore sync. The app stays local-first: without an account nothing changes.
 * Signed in, recipes and folders live under users/{uid}/ and every local edit is mirrored there;
 * edits from another phone arrive through snapshot listeners. Photos stay on the phone for now.
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
  type CollectionReference,
  type DocumentData,
  collection,
  doc,
  getDocs,
  getFirestore,
  onSnapshot,
  writeBatch,
} from '@react-native-firebase/firestore';
import { GoogleSignin, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';

import { useAccount } from './account';
import { type Folder, type Recipe, SEED_FOLDERS, SEED_RECIPE_IDS } from './data';
import { useStore } from './store';

/** OAuth "web" client from google-services.json (client_type 3); Firebase verifies the Google ID token against it. */
const WEB_CLIENT_ID = '64817728713-lt6tnbn7lv1ucm9cqnbb6nq03aoro049.apps.googleusercontent.com';
const SEED_FOLDER_IDS: ReadonlySet<string> = new Set(SEED_FOLDERS.map((f) => f.id));

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

/* ------------------------------------------------------------- the engine */

let applyingRemote = false;
let stopSync: (() => void) | null = null;

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

/**
 * Union of both sides, newest edit wins. Untouched seed items that the cloud doesn't have are dropped
 * once the account already holds data, so a fresh install can't resurrect a seed deleted elsewhere.
 */
function merge<T extends { id: string; updatedAt?: number }>(local: T[], cloud: T[], seeds: ReadonlySet<string>) {
  const byId = new Map(cloud.map((c) => [c.id, c]));
  const upload: T[] = [];
  for (const l of local) {
    const c = byId.get(l.id);
    if (!c) {
      const untouchedSeed = seeds.has(l.id) && l.updatedAt === undefined;
      if (cloud.length && untouchedSeed) continue;
      byId.set(l.id, l);
      upload.push(l);
    } else if (newer(l.updatedAt, c.updatedAt)) {
      byId.set(l.id, l);
      upload.push(l);
    }
  }
  return { merged: [...byId.values()], upload };
}

async function startSync(user: User): Promise<void> {
  useAccount.setState({ account: { name: user.displayName, email: user.email, photo: user.photoURL }, status: 'syncing', error: null });
  await waitForHydration();

  const db = getFirestore();
  const recipesCol = collection(db, 'users', user.uid, 'recipes');
  const foldersCol = collection(db, 'users', user.uid, 'folders');
  const photoOf = () => new Map(useStore.getState().recipes.map((r) => [r.id, r.photoUri]));

  const [rSnap, fSnap] = await Promise.all([getDocs(recipesCol), getDocs(foldersCol)]);
  const photos = photoOf();
  const cloudRecipes = rSnap.docs.map((d) => recipeFromCloud(d.data(), photos.get(d.id)));
  const cloudFolders = fSnap.docs.map((d) => d.data() as Folder);
  const { recipes, folders } = useStore.getState();
  const r = merge(recipes, cloudRecipes, SEED_RECIPE_IDS);
  const f = merge(folders, cloudFolders, SEED_FOLDER_IDS);

  withRemote(() => useStore.setState({ recipes: r.merged, folders: f.merged }));
  await commit(recipesCol, foldersCol, r.upload, f.upload, [], []);

  const unsubRecipes = onSnapshot(recipesCol, (snap) => {
    const local = photoOf();
    withRemote(() => useStore.setState({ recipes: snap.docs.map((d) => recipeFromCloud(d.data(), local.get(d.id))) }));
  }, fail);
  const unsubFolders = onSnapshot(foldersCol, (snap) => {
    withRemote(() => useStore.setState({ folders: snap.docs.map((d) => d.data() as Folder) }));
  }, fail);

  // Mirror local edits: the store replaces an object whenever it changes, so identity tells us what to write.
  const unsubStore = useStore.subscribe((next, prev) => {
    if (applyingRemote) return;
    const changed = <T extends { id: string }>(a: T[], b: T[]) => {
      const before = new Map(b.map((x) => [x.id, x]));
      const ids = new Set(a.map((x) => x.id));
      return { put: a.filter((x) => before.get(x.id) !== x), gone: b.filter((x) => !ids.has(x.id)).map((x) => x.id) };
    };
    const rc = next.recipes !== prev.recipes ? changed(next.recipes, prev.recipes) : { put: [], gone: [] };
    const fc = next.folders !== prev.folders ? changed(next.folders, prev.folders) : { put: [], gone: [] };
    if (rc.put.length || rc.gone.length || fc.put.length || fc.gone.length) {
      commit(recipesCol, foldersCol, rc.put, fc.put, rc.gone, fc.gone).catch(fail);
    }
  });

  useAccount.setState({ status: 'synced' });
  stopSync = () => {
    unsubRecipes();
    unsubFolders();
    unsubStore();
  };
}

async function commit(
  recipesCol: CollectionReference,
  foldersCol: CollectionReference,
  recipes: Recipe[],
  folders: Folder[],
  goneRecipes: string[],
  goneFolders: string[],
): Promise<void> {
  if (!recipes.length && !folders.length && !goneRecipes.length && !goneFolders.length) return;
  const batch = writeBatch(getFirestore());
  recipes.forEach((r) => batch.set(doc(recipesCol, r.id), recipeToCloud(r)));
  folders.forEach((f) => batch.set(doc(foldersCol, f.id), folderToCloud(f)));
  goneRecipes.forEach((id) => batch.delete(doc(recipesCol, id)));
  goneFolders.forEach((id) => batch.delete(doc(foldersCol, id)));
  await batch.commit();
}

function fail(e: unknown): void {
  const message = e instanceof Error ? e.message : String(e);
  useAccount.setState({ status: 'error', error: message });
}

/* ------------------------------------------------------------------- auth */

/** Call once at startup; follows the Firebase session for the life of the app. */
export function initCloud(): () => void {
  GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
  return onAuthStateChanged(getAuth(), (user) => {
    stopSync?.();
    stopSync = null;
    if (user) startSync(user).catch(fail);
    else useAccount.setState({ account: null, status: 'off', error: null });
  });
}

/** Resolves false when the person backs out of the Google picker. */
export async function signInWithGoogle(): Promise<boolean> {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    if (res.type !== 'success') return false;
    if (!res.data.idToken) throw new Error('Google n’a pas renvoyé de jeton de connexion.');
    await signInWithCredential(getAuth(), GoogleAuthProvider.credential(res.data.idToken));
    return true;
  } catch (e) {
    if (isErrorWithCode(e)) {
      if (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS) return false;
      if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) throw new Error('Les services Google Play ne sont pas disponibles sur ce téléphone.');
      if (e.code === '10' || e.code === 'DEVELOPER_ERROR') throw new Error('Connexion Google mal configurée (empreinte SHA-1 ou identifiant client).');
    }
    throw e;
  }
}

/** Signs out of Firebase and Google. The recipes stay on this phone. */
export async function signOutOfCloud(): Promise<void> {
  await GoogleSignin.signOut().catch(() => undefined);
  await signOut(getAuth());
}
