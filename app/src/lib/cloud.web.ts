/** The web build (used for previews) has no Firebase native modules: the account stays signed out, one local book. */
import type { Invite, Member, Role } from './books';
import type { Recipe } from './data';
import type { Swatch } from './theme';

const NEEDS_APP = 'Disponible dans l’app Android, connecté avec Google.';

export function initCloud(): () => void {
  return () => undefined;
}

export type SignInOutcome = 'signed-in' | 'cancelled';

export async function signInWithGoogle(): Promise<SignInOutcome> {
  throw new Error('La connexion Google est disponible dans l’app Android.');
}

export async function signOutOfCloud(): Promise<void> {
  return undefined;
}

export async function createBook(_name: string, _color: Swatch): Promise<string> {
  throw new Error(NEEDS_APP);
}

export async function updateBook(_id: string, _patch: { name: string; color: Swatch }): Promise<void> {
  throw new Error(NEEDS_APP);
}

export async function leaveBook(_id: string, _keepCopy: boolean): Promise<void> {
  throw new Error(NEEDS_APP);
}

export async function deleteBook(_id: string): Promise<void> {
  throw new Error(NEEDS_APP);
}

export function watchMembers(_bookId: string, _onChange: (members: Member[]) => void): () => void {
  return () => undefined;
}

export type PendingInvite = Pick<Invite, 'code' | 'role' | 'by' | 'byName' | 'createdAt' | 'expiresAt'>;

export function watchInvites(_bookId: string, _onChange: (invites: PendingInvite[]) => void): () => void {
  return () => undefined;
}

export async function setMemberRole(_bookId: string, _uid: string, _role: Exclude<Role, 'chef'>): Promise<void> {
  throw new Error(NEEDS_APP);
}

export async function passToque(_bookId: string, _uid: string): Promise<void> {
  throw new Error(NEEDS_APP);
}

export async function removeMember(_bookId: string, _uid: string): Promise<void> {
  throw new Error(NEEDS_APP);
}

export async function createInvite(_bookId: string, _role: Exclude<Role, 'chef'>): Promise<Invite> {
  throw new Error(NEEDS_APP);
}

export async function cancelInvite(_bookId: string, _code: string): Promise<void> {
  throw new Error(NEEDS_APP);
}

export async function fetchInvite(_code: string): Promise<Invite | null> {
  throw new Error(NEEDS_APP);
}

export const isOnMyShelf = (_bookId: string): boolean => false;

export async function acceptInvite(_invite: Invite, _bring: readonly Recipe[]): Promise<void> {
  throw new Error(NEEDS_APP);
}

export async function copyRecipeToBook(_recipe: Recipe, _bookId: string): Promise<void> {
  throw new Error(NEEDS_APP);
}
