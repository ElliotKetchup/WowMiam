// One phone in the sync test (see ../README.md).
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import { useAccount } from '@/lib/account';
import { planMove } from '@/lib/books';
import * as cloud from '@/lib/cloud';
import { contentOf, useStore } from '@/lib/store';

const role = process.argv[2] as 'alice' | 'bob' | 'carol' | 'dave' | 'alice2' | 'erin';
const who = role === 'alice2' ? 'alice' : role;
const DIR = process.argv[3];
const flag = (name: string) => `${DIR}/${name}`;
const mark = (name: string, value = '1') => writeFileSync(flag(name), value);
let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) failures++;
  console.log(`[${role}] ${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` ${detail}`}`);
};
async function until<T>(what: string, get: () => T | undefined | null | false, ms = 15000): Promise<T> {
  const start = Date.now();
  for (;;) {
    const v = get();
    if (v) return v;
    if (Date.now() - start > ms) throw new Error(`[${who}] timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}
const waitFlag = (name: string) => until(`flag ${name}`, () => existsSync(flag(name)) && readFileSync(flag(name), 'utf8'), 60000);
const st = () => useStore.getState();
const personalId = () => st().books.find((b) => b.personal)?.id ?? '';

const env = await initializeTestEnvironment({
  projectId: 'wowmiam-sync',
  firestore: { rules: readFileSync(process.argv[4], 'utf8'), host: '127.0.0.1', port: 8089 },
});
const names = { alice: 'Alice Martin', bob: 'Bob Durand', carol: 'Carol Petit', dave: 'Dave Leroy', erin: 'Erin Moreau' };
(globalThis as any).__db = env.authenticatedContext(who).firestore();
(globalThis as any).__user = { uid: who, displayName: names[who], email: `${who}@example.com`, photoURL: null };

await until('hydration', () => useStore.persist.hasHydrated());

if (role === 'alice2') await waitFlag('alice-exit');
if (role === 'erin') {
  // An account from the first books version: its personal book is still called "Mon livre".
  const { doc, writeBatch } = await import('firebase/firestore');
  const db = (globalThis as any).__db;
  const batch = writeBatch(db);
  batch.set(doc(db, 'books', 'erinbook'), { name: 'Mon livre', color: 'plum', owner: 'erin', createdAt: 1 });
  batch.set(doc(db, 'books', 'erinbook', 'members', 'erin'), { uid: 'erin', name: 'Erin Moreau', photo: null, role: 'chef', joinedAt: 1, via: null, invitedBy: null });
  batch.set(doc(db, 'users', 'erin', 'books', 'erinbook'), { role: 'chef', personal: true, joinedAt: 1 });
  await batch.commit();
}
if (role === 'dave') {
  // An account from before books: its recipes live under users/dave.
  const { doc, setDoc } = await import('firebase/firestore');
  const db = (globalThis as any).__db;
  await setDoc(doc(db, 'users', 'dave', 'recipes', 'rdaveold00001'), {
    id: 'rdaveold00001', name: 'Gratin de Dave', type: 'Plat', diets: [], tools: [], time: 40, serves: 2, addedAt: 1, updatedAt: 5, note: '', ingredients: [], steps: [],
  });
  await setDoc(doc(db, 'users', 'dave', 'folders', 'fdave'), { id: 'fdave', name: 'Hiver', ids: ['rdaveold00001'], updatedAt: 5 });
}

if (role === 'bob') {
  // Before any account: one recipe of his own, and an example he changed.
  const pizza = st().recipes.find((r) => r.id === 'pizza')!;
  st().saveRecipe({ ...pizza, note: 'Avec du chorizo' }, []);
  st().saveRecipe({ ...pizza, id: 'rbobcurry0001', name: 'Curry de lentilles', note: '', addedAt: Date.now() }, ['soirs']);
}

cloud.initCloud();
await until('first sync', () => useAccount.getState().status === 'synced' || (useAccount.getState().status === 'error' && useAccount.getState().error));
check('first sync ok', useAccount.getState().status === 'synced', useAccount.getState().error ?? '');
if (role === 'carol' || role === 'erin') {
  const expected = role === 'carol' ? 'Le livre de Carol' : 'Le livre d’Erin';
  await until(`personal book named ${expected}`, () => st().books.find((b) => b.personal)?.name === expected);
  check(role === 'carol' ? 'new account: book named after its owner' : 'old "Mon livre" renamed after its owner', true);
}
if (role !== 'alice2' && role !== 'erin') check('local book became the personal cloud book', st().books.length === 1 && personalId() !== 'local' && st().bookId === personalId(), JSON.stringify(st().books));

try {
  if (role === 'alice') {
    check('seeds uploaded into the personal book', st().recipes.length === 6, String(st().recipes.length));
    await cloud.updateBook(personalId(), { name: 'Chez nous', color: 'plum' });
    const tarte = { ...st().recipes[0], id: 'raliceTarte01', name: 'Tarte tatin', addedAt: Date.now(), byUid: 'alice', byName: 'Alice Martin' };
    st().saveRecipe(tarte, []);
    mark('book', personalId());
    const sous = await cloud.createInvite(personalId(), 'sous');
    mark('code-sous', sous.code);

    await waitFlag('bob-joined');
    await until('Bob’s curry in Alice’s book', () => st().recipes.find((r) => r.name === 'Curry de lentilles'));
    const curry = st().recipes.find((r) => r.name === 'Curry de lentilles')!;
    check('moved recipe credited to Bob', curry.byName === 'Bob Durand', curry.byName);
    check('Bob’s edited pizza came with a new id', st().recipes.some((r) => r.name === 'Pizza wrap' && r.id !== 'pizza' && r.note === 'Avec du chorizo'));
    check('untouched examples were not doubled', st().recipes.filter((r) => r.name === 'Salade composée').length === 1);
    let members: cloud.PendingInvite[] | any[] = [];
    const stop = cloud.watchMembers(personalId(), (m) => (members = m));
    await until('two members', () => members.length === 2);
    check('Bob is Sous-chef', members.find((m: any) => m.uid === 'bob')?.role === 'sous');
    stop();

    const commis = await cloud.createInvite(personalId(), 'commis');
    mark('code-commis', commis.code);
    await waitFlag('carol-joined');
    await cloud.removeMember(personalId(), 'carol');
    mark('carol-removed');

    st().deleteRecipe('raliceTarte01');
    mark('tarte-trashed');
    await waitFlag('bob-done');
    await cloud.passToque(personalId(), 'bob');
    await until('Alice is now Sous-chef', () => st().books.find((b) => b.id === personalId())?.role === 'sous');
    check('toque passed: Alice is Sous-chef', true);
  }

  if (role === 'bob') {
    const before = planMove(st().recipes);
    check('plan: curry + edited pizza movable, 5 examples stay', before.movable.length === 2 && before.examples.length === 5, `${before.movable.map((r) => r.id)} / ${before.examples.length}`);
    const code = await waitFlag('code-sous');
    const invite = await cloud.fetchInvite(code);
    check('invite found', !!invite && invite.role === 'sous' && invite.bookName === 'Chez nous', JSON.stringify(invite));
    const home = personalId();
    await cloud.acceptInvite(invite!, before.movable);
    const book = readFileSync(flag('book'), 'utf8');
    check('Alice’s book is open', st().bookId === book);
    check('shelf has both books', st().books.length === 2, JSON.stringify(st().books.map((b) => [b.name, b.role])));
    await until('Alice’s tarte visible', () => st().recipes.find((r) => r.name === 'Tarte tatin'));
    await until('curry in the shared book', () => st().recipes.find((r) => r.name === 'Curry de lentilles'));
    const left = contentOf(st(), home).recipes;
    check('curry left the personal book', !left.some((r) => r.name === 'Curry de lentilles'), left.map((r) => r.name).join(','));
    check('examples stayed in the personal book', left.length === 5, String(left.length));
    mark('bob-joined');

    let refused = false;
    await cloud.createInvite(book, 'sous').catch(() => (refused = true));
    check('Sous-chef cannot invite a Sous-chef', refused);
    const commis = await cloud.createInvite(book, 'commis').then(() => true, () => false);
    check('Sous-chef can invite a Commis', commis);

    await waitFlag('tarte-trashed');
    await until('tarte trashed for Bob too', () => st().recipes.find((r) => r.id === 'raliceTarte01')?.deletedAt);
    check('trash synced', true);
    // Bob edits a recipe: Alice is still in the book, it's a plain shared edit.
    const curry = st().recipes.find((r) => r.name === 'Curry de lentilles')!;
    st().saveRecipe({ ...curry, note: 'Bien épicé' }, []);
    mark('bob-done');
    await until('Bob became chef', () => st().books.find((b) => b.id === book)?.role === 'chef', 20000);
    check('Bob is Chef de cuisine after the toque', true);
  }

  if (role === 'dave') {
    await until('legacy recipe in the personal book', () => st().recipes.find((r) => r.id === 'rdaveold00001'));
    check('old cloud recipes and folders moved into the personal book', st().folders.some((f) => f.id === 'fdave'));
    check('examples not resurrected over an account that had data', !st().recipes.some((r) => r.id === 'composee'), st().recipes.map((r) => r.id).join(','));
  }

  if (role === 'alice2') {
    check('second phone: same two books', st().books.length === 1 || st().books.length === 2, JSON.stringify(st().books.map((b) => b.name)));
    const shared = st().books.find((b) => b.name === 'Chez nous');
    check('second phone: the shared book is on the shelf', !!shared, JSON.stringify(st().books));
    if (shared) {
      st().openBook(shared.id);
      await until('book content', () => st().recipes.find((r) => r.name === 'Curry de lentilles'));
      check('second phone: no doubled examples', st().recipes.filter((r) => r.name === 'Salade composée').length === 1);
      check('second phone: Bob’s edit arrived', st().recipes.find((r) => r.name === 'Curry de lentilles')?.note === 'Bien épicé');
    }
  }

  if (role === 'carol') {
    const code = await waitFlag('code-commis');
    const invite = await cloud.fetchInvite(code);
    await cloud.acceptInvite(invite!, st().recipes);
    const book = readFileSync(flag('book'), 'utf8');
    check('Carol opened the book as Commis', st().bookId === book && st().books.find((b) => b.id === book)?.role === 'commis');
    await until('Carol sees recipes', () => st().recipes.find((r) => r.name === 'Tarte tatin'));
    check('Carol’s own recipes did not move (Commis)', contentOf(st(), personalId()).recipes.length === 6, String(contentOf(st(), personalId()).recipes.length));
    const tarte = st().recipes.find((r) => r.name === 'Tarte tatin')!;
    st().saveRecipe({ ...tarte, name: 'Hacked' }, []);
    await new Promise((r) => setTimeout(r, 800));
    check('a Commis edit is never sent (no sync error)', useAccount.getState().status === 'synced', useAccount.getState().error ?? '');
    await cloud.copyRecipeToBook(tarte, personalId());
    check('copy landed in Carol’s book', contentOf(st(), personalId()).recipes.some((r) => r.name === 'Tarte tatin' && r.byUid === 'carol'));
    mark('carol-joined');
    await waitFlag('carol-removed');
    await until('book gone from Carol’s shelf', () => !st().books.some((b) => b.id === book));
    check('Carol is back in her own book', st().bookId === personalId());
  }
} catch (e) {
  failures++;
  console.log(`[${who}] FAIL ${e instanceof Error ? e.message : e}`);
}

const status = useAccount.getState();
if (status.status === 'error') console.log(`[${who}] sync error at the end: ${status.error}`);
console.log(`[${who}] ${failures ? `${failures} FAILED` : 'all passed'}`);
mark(`${role}-exit`, String(failures));
process.exit(failures ? 1 : 0);
