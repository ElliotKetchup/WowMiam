// Security rules: who may read and write what in a book, run against the Firestore emulator (`npm test`).
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { Timestamp, deleteDoc, doc, getDoc, getDocs, collection, setDoc, updateDoc, writeBatch } from 'firebase/firestore';

const env = await initializeTestEnvironment({
  projectId: 'wowmiam-test',
  firestore: { rules: readFileSync(new URL('../../app/firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8089 },
});
const as = (uid) => env.authenticatedContext(uid).firestore();
const anon = env.unauthenticatedContext().firestore();
let failures = 0;
async function check(name, p) {
  try { await p; console.log('ok  ', name); } catch (e) { failures++; console.log('FAIL', name, '-', e.message.split('\n')[0]); }
}
const later = () => Timestamp.fromMillis(Date.now() + 7 * 86400000);
const past = () => Timestamp.fromMillis(Date.now() - 1000);
const member = (uid, role, via = null) => ({ uid, name: uid, photo: null, role, joinedAt: Date.now(), via, invitedBy: null });

async function found(db, uid, b) {
  const batch = writeBatch(db);
  batch.set(doc(db, 'books', b), { name: 'Chez nous', color: 'plum', owner: uid, createdAt: 1 });
  batch.set(doc(db, 'books', b, 'members', uid), member(uid, 'chef'));
  batch.set(doc(db, 'users', uid, 'books', b), { role: 'chef', personal: true, joinedAt: 1 });
  return batch.commit();
}
async function invite(db, uid, b, code, role, expiresAt = later()) {
  const batch = writeBatch(db);
  batch.set(doc(db, 'invites', code), { bookId: b, bookName: 'Chez nous', bookColor: 'plum', role, by: uid, byName: uid, createdAt: 1, expiresAt, usedBy: null });
  batch.set(doc(db, 'books', b, 'invites', code), { role, by: uid, byName: uid, createdAt: 1, expiresAt });
  return batch.commit();
}
async function join(db, uid, b, code, role) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'invites', code), { usedBy: uid, usedAt: 2 });
  batch.set(doc(db, 'books', b, 'members', uid), member(uid, role, code));
  batch.set(doc(db, 'users', uid, 'books', b), { role, personal: false, joinedAt: 2 });
  return batch.commit();
}

const A = as('alice'), B = as('bob'), C = as('carol'), D = as('dave'), E = as('eve');

await check('alice founds a book', assertSucceeds(found(A, 'alice', 'bk1')));
await check('eve cannot found a member in an existing book', assertFails(setDoc(doc(E, 'books', 'bk1', 'members', 'eve'), member('eve', 'chef'))));
await check('eve cannot found a book owned by alice', assertFails(found(E, 'alice', 'bk9')));
await check('alice writes a recipe', assertSucceeds(setDoc(doc(A, 'books', 'bk1', 'recipes', 'r1'), { name: 'Tarte' })));
await check('eve cannot read the recipe', assertFails(getDoc(doc(E, 'books', 'bk1', 'recipes', 'r1'))));
await check('anonymous cannot read an invite', assertFails(getDoc(doc(anon, 'invites', 'X'))));
await check('eve cannot invite into alice\'s book', assertFails(invite(E, 'eve', 'bk1', 'EVECODE1', 'sous')));
await check('alice invites a sous-chef', assertSucceeds(invite(A, 'alice', 'bk1', 'SOUSCODE', 'sous')));
await check('bob reads the invite by code', assertSucceeds(getDoc(doc(B, 'invites', 'SOUSCODE'))));
await check('bob cannot list invites', assertFails(getDocs(collection(B, 'invites'))));
await check('bob cannot join as chef with a sous code', assertFails(join(B, 'bob', 'bk1', 'SOUSCODE', 'chef')));
await check('bob cannot add himself without using the code', assertFails(setDoc(doc(B, 'books', 'bk1', 'members', 'bob'), member('bob', 'sous', 'SOUSCODE'))));
await check('bob joins as sous-chef', assertSucceeds(join(B, 'bob', 'bk1', 'SOUSCODE', 'sous')));
await check('carol cannot reuse the used code', assertFails(join(C, 'carol', 'bk1', 'SOUSCODE', 'sous')));
await check('bob writes a recipe', assertSucceeds(setDoc(doc(B, 'books', 'bk1', 'recipes', 'r2'), { name: 'Curry' })));
await check('bob cannot invite a sous-chef', assertFails(invite(B, 'bob', 'bk1', 'BOBSOUS1', 'sous')));
await check('bob invites a commis', assertSucceeds(invite(B, 'bob', 'bk1', 'COMMIS01', 'commis')));
await check('bob lists the book invites', assertSucceeds(getDocs(collection(B, 'books', 'bk1', 'invites'))));
await check('carol joins as commis', assertSucceeds(join(C, 'carol', 'bk1', 'COMMIS01', 'commis')));
await check('carol reads recipes', assertSucceeds(getDocs(collection(C, 'books', 'bk1', 'recipes'))));
await check('carol cannot write a recipe', assertFails(setDoc(doc(C, 'books', 'bk1', 'recipes', 'r3'), { name: 'Nope' })));
await check('carol cannot promote herself', assertFails(updateDoc(doc(C, 'books', 'bk1', 'members', 'carol'), { role: 'sous' })));
await check('carol cannot invite', assertFails(invite(C, 'carol', 'bk1', 'CAROL001', 'commis')));
await check('alice invites with an expired code', assertSucceeds(invite(A, 'alice', 'bk1', 'EXPIRED1', 'commis', past())));
await check('dave cannot join with an expired code', assertFails(join(D, 'dave', 'bk1', 'EXPIRED1', 'commis')));
await check('bob (sous) cannot remove carol', assertFails(deleteDoc(doc(B, 'books', 'bk1', 'members', 'carol'))));
await check('bob cannot rename the owner', assertFails(updateDoc(doc(B, 'books', 'bk1'), { owner: 'bob' })));
await check('bob renames the book', assertSucceeds(updateDoc(doc(B, 'books', 'bk1'), { name: 'Chez nous 2' })));
await check('alice demotes bob to commis', assertSucceeds(updateDoc(doc(A, 'books', 'bk1', 'members', 'bob'), { role: 'commis' })));
await check('bob (now commis) cannot write', assertFails(setDoc(doc(B, 'books', 'bk1', 'recipes', 'r4'), { name: 'x' })));
await check('alice promotes bob back', assertSucceeds(updateDoc(doc(A, 'books', 'bk1', 'members', 'bob'), { role: 'sous' })));
await check('alice removes carol', assertSucceeds(deleteDoc(doc(A, 'books', 'bk1', 'members', 'carol'))));
await check('carol reads her own (gone) membership', assertSucceeds(getDoc(doc(C, 'books', 'bk1', 'members', 'carol'))));
await check('carol can no longer read recipes', assertFails(getDocs(collection(C, 'books', 'bk1', 'recipes'))));
await check('alice (chef) cannot just leave', assertFails(deleteDoc(doc(A, 'books', 'bk1', 'members', 'alice'))));
await check('alice passes the toque to bob', assertSucceeds((() => {
  const batch = writeBatch(A);
  batch.update(doc(A, 'books', 'bk1'), { owner: 'bob' });
  batch.update(doc(A, 'books', 'bk1', 'members', 'bob'), { role: 'chef' });
  batch.update(doc(A, 'books', 'bk1', 'members', 'alice'), { role: 'sous' });
  return batch.commit();
})()));
await check('alice (now sous) leaves', assertSucceeds(deleteDoc(doc(A, 'books', 'bk1', 'members', 'alice'))));
await check('bob (chef) deletes recipes, invites and the book', assertSucceeds((async () => {
  const batch = writeBatch(B);
  for (const r of ['r1', 'r2']) batch.delete(doc(B, 'books', 'bk1', 'recipes', r));
  for (const c of ['SOUSCODE', 'COMMIS01', 'EXPIRED1']) { batch.delete(doc(B, 'books', 'bk1', 'invites', c)); batch.delete(doc(B, 'invites', c)); }
  await batch.commit();
  const last = writeBatch(B); last.delete(doc(B, 'books', 'bk1')); await last.commit();
  const mine = writeBatch(B); mine.delete(doc(B, 'books', 'bk1', 'members', 'bob')); mine.delete(doc(B, 'users', 'bob', 'books', 'bk1')); await mine.commit();
})()));
await check('eve cannot touch alice\'s shelf', assertFails(setDoc(doc(E, 'users', 'alice', 'books', 'x'), { role: 'chef' })));

await env.cleanup();
console.log(failures ? `${failures} FAILED` : 'all passed');
process.exit(failures ? 1 : 0);
