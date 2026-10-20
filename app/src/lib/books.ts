/**
 * Cookbooks ("livres") and their brigade. Every recipe and folder belongs to exactly one book.
 * A book is shared with a small brigade: one Chef de cuisine (owner), Sous-chefs who cook everything
 * and may invite Commis, and Commis who only read (and can copy a recipe into a book of their own).
 */
import { type Folder, isUntouchedSeed, type Recipe, SEED_FOLDERS, SEED_RECIPE_IDS } from './data';
import type { Swatch } from './theme';

export type Role = 'chef' | 'sous' | 'commis';

export const ROLE_LABEL: Record<Role, string> = { chef: 'Chef de cuisine', sous: 'Sous-chef', commis: 'Commis' };
export const ROLE_PLURAL: Record<Role, string> = { chef: 'Chef de cuisine', sous: 'Sous-chefs', commis: 'Commis' };
export const ROLE_DOES: Record<Role, string> = {
  chef: 'Gère la brigade et tout le livre',
  sous: 'Ajoute, modifie et supprime les recettes. Peut inviter des Commis.',
  commis: 'Lit les recettes et peut les copier dans son propre livre.',
};
export const ROLE_ORDER: readonly Role[] = ['chef', 'sous', 'commis'];
/** Band colour of the toque: the rank reads at a glance. */
export const ROLE_SWATCH: Record<Role, Swatch> = { chef: 'pink', sous: 'teal', commis: 'amber' };

export interface Book {
  id: string;
  name: string;
  color: Swatch;
  /** My rank in it. */
  role: Role;
  /** The book every account starts with; local recipes merge into it on sign-in. */
  personal?: boolean;
}

export interface Member {
  uid: string;
  name: string;
  photo: string | null;
  role: Role;
  joinedAt: number;
  /** The invite code it joined with (absent for the founder). */
  via?: string | null;
  invitedBy?: string | null;
}

export interface Invite {
  code: string;
  bookId: string;
  bookName: string;
  bookColor: Swatch;
  role: Exclude<Role, 'chef'>;
  by: string;
  byName: string;
  createdAt: number;
  expiresAt: number;
  usedBy: string | null;
}

/** The book a phone has before any account: becomes the personal book on first sign-in. */
export const LOCAL_BOOK = 'local';
/** Name of the book before we know whose it is (no account yet). */
export const DEFAULT_BOOK_NAME = 'Mon livre';
export const DEFAULT_BOOK: Book = { id: LOCAL_BOOK, name: DEFAULT_BOOK_NAME, color: 'plum', role: 'chef', personal: true };

/** "Le livre d’Elliot", "Le livre de Léa"; null when the account has no name to go by. */
export function personalBookName(fullName: string | null | undefined): string | null {
  const first = fullName?.trim().split(/\s+/)[0];
  if (!first) return null;
  return /^[aeiouyhàâäéèêëîïôöùûü]/i.test(first) ? `Le livre d’${first}` : `Le livre de ${first}`;
}
export const MAX_MEMBERS = 10;
export const INVITE_DAYS = 7;
export const TRASH_DAYS = 30;
const DAY = 86_400_000;

export const canCook = (role: Role): boolean => role !== 'commis';
/** Chefs invite Sous-chefs and Commis; Sous-chefs invite Commis only. */
export const invitableRoles = (role: Role): Exclude<Role, 'chef'>[] => (role === 'chef' ? ['sous', 'commis'] : role === 'sous' ? ['commis'] : []);

export const daysLeftInTrash = (deletedAt: number, now: number = Date.now()): number => Math.max(0, Math.ceil((deletedAt + TRASH_DAYS * DAY - now) / DAY));
export const trashExpired = (r: Pick<Recipe, 'deletedAt'>, now: number = Date.now()): boolean => !!r.deletedAt && now - r.deletedAt > TRASH_DAYS * DAY;
export const inviteExpiry = (now: number = Date.now()): number => now + INVITE_DAYS * DAY;

/* ------------------------------------------------------------- invite codes */

// No 0/O, 1/I/L: the code is read aloud and typed by hand.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 8;

/** 31^8 ≈ 850 billion codes; each one works once and for a week, so Math.random is plenty. */
export function newInviteCode(): string {
  return Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
}

/** "abcd 2345", "ABCD-2345" or a whole wowmiam:// link → "ABCD2345"; null when it can't be a code. */
export function parseInviteCode(input: string): string | null {
  const tail = input.trim().split('/').pop() ?? '';
  const code = tail.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return code.length === CODE_LENGTH && [...code].every((ch) => CODE_ALPHABET.includes(ch)) ? code : null;
}

export const prettyCode = (code: string): string => `${code.slice(0, 4)}-${code.slice(4)}`;
export const inviteLink = (code: string): string => `wowmiam://invite/${code}`;

export function inviteMessage(invite: Pick<Invite, 'code' | 'bookName' | 'byName' | 'role'>): string {
  return [
    `${invite.byName} t’invite comme ${ROLE_LABEL[invite.role]} dans « ${invite.bookName} » sur Wow Miam !`,
    '',
    `Le code : ${prettyCode(invite.code)}`,
    'Dans l’app : Bibliothèque → Rejoindre avec un code.',
    `Ou ouvre ce lien sur ton téléphone : ${inviteLink(invite.code)}`,
    '',
    `Valable ${INVITE_DAYS} jours, pour une seule personne.`,
  ].join('\n');
}

/* ------------------------------------------------- bringing recipes along */

export interface MovePlan {
  /** Recipes that can come into the new book (the person picks among them). */
  movable: Recipe[];
  /** Untouched example recipes: the other book has its own, so they stay put. */
  examples: Recipe[];
}

export function planMove(recipes: readonly Recipe[]): MovePlan {
  const live = recipes.filter((r) => !r.deletedAt);
  return { movable: live.filter((r) => !isUntouchedSeed(r)), examples: live.filter(isUntouchedSeed) };
}

const SEED_FOLDER_IDS: ReadonlySet<string> = new Set(SEED_FOLDERS.map((f) => f.id));
const freshId = (prefix: string): string => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * Copies of `picked` (and of the folders holding them) ready for another book. Example recipes and
 * folders get new ids so they can't collide with the target's own copy of the same example.
 */
export function prepareMove(picked: readonly Recipe[], folders: readonly Folder[], by: { uid: string; name: string }) {
  const ids = new Map(picked.map((r) => [r.id, SEED_RECIPE_IDS.has(r.id) ? freshId('r') : r.id]));
  const now = Date.now();
  const recipes: Recipe[] = picked.map(({ photoUri: _local, deletedAt: _gone, ...r }) => ({
    ...r,
    id: ids.get(r.id) ?? r.id,
    byUid: r.byUid ?? by.uid,
    byName: r.byName ?? by.name,
    updatedAt: now,
  }));
  const moved: Folder[] = folders
    .map((f) => ({ f, kept: f.ids.filter((id) => ids.has(id)) }))
    .filter(({ f, kept }) => kept.length && !(SEED_FOLDER_IDS.has(f.id) && f.updatedAt === undefined))
    .map(({ f, kept }) => ({ ...f, id: SEED_FOLDER_IDS.has(f.id) ? freshId('f') : f.id, ids: kept.map((id) => ids.get(id) ?? id), updatedAt: now }));
  return { recipes, folders: moved };
}

/** A recipe copied into another book: a new recipe there, credited to whoever copied it. */
export function copyOf(r: Recipe, by: { uid: string; name: string }): Recipe {
  const { photoUri: _local, deletedAt: _gone, photoKey: _key, ...rest } = r;
  const now = Date.now();
  return { ...rest, id: freshId('r'), addedAt: now, updatedAt: now, byUid: by.uid, byName: by.name };
}

export function initialOf(name: string | null | undefined): string {
  return (name?.trim() || '?').charAt(0).toUpperCase();
}

export const firstName = (name: string | null | undefined): string => name?.trim().split(/\s+/)[0] || 'Quelqu’un';
