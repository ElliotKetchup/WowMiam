/**
 * App state, persisted on the device. Filters combine OU inside a group and ET across groups.
 * `recipes` and `folders` are the open book's; the other books wait in `stash` so they work offline too.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { type Book, DEFAULT_BOOK, type Role } from './books';
import { type Folder, type Kind, type Recipe, SEED_FOLDERS, normalize, seedRecipes, tagsOf } from './data';
import type { Swatch } from './theme';

export type Op = 'OU' | 'ET';
export type Groups = Record<Kind, { op: Op; on: string[] }>;
export type Sort = 'recent' | 'az';
export interface BookContent {
  recipes: Recipe[];
  folders: Folder[];
}

interface State {
  recipes: Recipe[];
  folders: Folder[];
  /** The shelf, with my rank in each book. */
  books: Book[];
  bookId: string;
  stash: Record<string, BookContent>;
  /** When I last looked at each book's news ("Léa a ajouté…"). */
  seenAt: Record<string, number>;
  /** Last time each book matched the cloud: a recipe older than that and gone from the cloud was deleted there. */
  syncedAt: Record<string, number>;
  groups: Groups;
  sort: Sort;
  query: string;
  serves: Record<string, number>;
  toggleTag: (kind: Kind, label: string) => void;
  toggleOp: (kind: Kind) => void;
  clearFilters: () => void;
  setSort: (sort: Sort) => void;
  setQuery: (query: string) => void;
  setServes: (id: string, n: number) => void;
  /** Insert or replace a recipe, and make it a member of exactly `folderIds`. */
  saveRecipe: (recipe: Recipe, folderIds: readonly string[]) => void;
  /** To the trash: hidden everywhere, restorable for TRASH_DAYS. */
  deleteRecipe: (id: string) => void;
  restoreRecipe: (id: string) => void;
  /** Gone for good, from the book and its folders. */
  purgeRecipes: (ids: readonly string[]) => void;
  /** Adds recipes and folders to the open book as they are (already stamped). */
  importContent: (content: BookContent) => void;
  setBooks: (books: Book[]) => void;
  /** Puts the open book away in the stash and takes `id` out. */
  openBook: (id: string) => void;
  /** The local book got its cloud id: same content, new name for it. */
  rekeyBook: (from: string, to: string) => void;
  /** Takes a book off the shelf (left it, removed from it, deleted). */
  dropBook: (id: string) => void;
  /** Recipes written straight to the cloud copy of a book that isn't open. */
  stashAdd: (bookId: string, content: BookContent) => void;
  markSeen: (bookId: string) => void;
  markSynced: (bookId: string) => void;
  addFolder: (name: string, color: Swatch) => string;
  updateFolder: (id: string, patch: Pick<Folder, 'name' | 'color'>) => void;
  deleteFolder: (id: string) => void;
  toggleInFolder: (folderId: string, recipeId: string) => void;
}

const stamp = <T extends object>(item: T): T & { updatedAt: number } => ({ ...item, updatedAt: Date.now() });

const newFolderId = (): string => `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

const unionById = <T extends { id: string }>(base: T[], extra: T[]): T[] => {
  const ids = new Set(extra.map((x) => x.id));
  return [...extra, ...base.filter((x) => !ids.has(x.id))];
};

const DEFAULT_GROUPS: Groups = {
  diet: { op: 'OU', on: [] },
  type: { op: 'OU', on: [] },
  tool: { op: 'OU', on: [] },
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      recipes: seedRecipes(),
      folders: SEED_FOLDERS,
      books: [DEFAULT_BOOK],
      bookId: DEFAULT_BOOK.id,
      stash: {},
      seenAt: {},
      syncedAt: {},
      groups: DEFAULT_GROUPS,
      sort: 'recent',
      query: '',
      serves: {},
      toggleTag: (kind, label) =>
        set((s) => {
          const g = s.groups[kind];
          const on = g.on.includes(label) ? g.on.filter((t) => t !== label) : [...g.on, label];
          return { groups: { ...s.groups, [kind]: { ...g, on } } };
        }),
      toggleOp: (kind) =>
        set((s) => {
          const g = s.groups[kind];
          return { groups: { ...s.groups, [kind]: { ...g, op: g.op === 'OU' ? 'ET' : 'OU' } } };
        }),
      clearFilters: () => set({ groups: { diet: { op: 'OU', on: [] }, type: { op: 'OU', on: [] }, tool: { op: 'OU', on: [] } } }),
      setSort: (sort) => set({ sort }),
      setQuery: (query) => set({ query }),
      setServes: (id, n) => set((s) => ({ serves: { ...s.serves, [id]: n } })),
      saveRecipe: (recipe, folderIds) =>
        set((s) => {
          const exists = s.recipes.some((r) => r.id === recipe.id);
          return {
            recipes: exists ? s.recipes.map((r) => (r.id === recipe.id ? stamp(recipe) : r)) : [stamp(recipe), ...s.recipes],
            folders: s.folders.map((f) => {
              const has = f.ids.includes(recipe.id);
              const want = folderIds.includes(f.id);
              if (has === want) return f;
              return stamp({ ...f, ids: want ? [recipe.id, ...f.ids] : f.ids.filter((x) => x !== recipe.id) });
            }),
          };
        }),
      deleteRecipe: (id) => set((s) => ({ recipes: s.recipes.map((r) => (r.id === id ? stamp({ ...r, deletedAt: Date.now() }) : r)) })),
      restoreRecipe: (id) =>
        set((s) => ({ recipes: s.recipes.map((r) => (r.id === id ? stamp({ ...r, deletedAt: undefined }) : r)) })),
      purgeRecipes: (ids) =>
        set((s) => {
          const gone = new Set(ids);
          return {
            recipes: s.recipes.filter((r) => !gone.has(r.id)),
            folders: s.folders.map((f) => (f.ids.some((x) => gone.has(x)) ? stamp({ ...f, ids: f.ids.filter((x) => !gone.has(x)) }) : f)),
            serves: Object.fromEntries(Object.entries(s.serves).filter(([k]) => !gone.has(k))),
          };
        }),
      importContent: ({ recipes, folders }) => set((s) => ({ recipes: unionById(s.recipes, recipes), folders: unionById(s.folders, folders) })),
      setBooks: (books) => set({ books }),
      openBook: (id) =>
        set((s) => {
          if (id === s.bookId) return {};
          const { [id]: next = { recipes: [], folders: [] }, ...rest } = s.stash;
          return {
            bookId: id,
            recipes: next.recipes,
            folders: next.folders,
            stash: { ...rest, [s.bookId]: { recipes: s.recipes, folders: s.folders } },
            groups: DEFAULT_GROUPS,
            query: '',
          };
        }),
      rekeyBook: (from, to) =>
        set((s) => {
          const rekey = <V>(m: Record<string, V>): Record<string, V> =>
            from in m ? Object.fromEntries(Object.entries(m).map(([k, v]) => [k === from ? to : k, v])) : m;
          return {
            bookId: s.bookId === from ? to : s.bookId,
            books: s.books.map((b) => (b.id === from ? { ...b, id: to } : b)),
            stash: rekey(s.stash),
            seenAt: rekey(s.seenAt),
            // A sync time belongs to one cloud book; carried over it would delete what the new one lacks.
            syncedAt: Object.fromEntries(Object.entries(s.syncedAt).filter(([k]) => k !== from)),
          };
        }),
      dropBook: (id) =>
        set((s) => {
          const { [id]: _gone, ...stash } = s.stash;
          const books = s.books.filter((b) => b.id !== id);
          if (s.bookId !== id) return { books, stash };
          const home = books.find((b) => b.personal) ?? books[0] ?? DEFAULT_BOOK;
          const { [home.id]: next = { recipes: [], folders: [] }, ...rest } = stash;
          return { books: books.length ? books : [DEFAULT_BOOK], stash: rest, bookId: home.id, recipes: next.recipes, folders: next.folders, groups: DEFAULT_GROUPS, query: '' };
        }),
      stashAdd: (bookId, content) =>
        set((s) => {
          if (bookId === s.bookId) return { recipes: unionById(s.recipes, content.recipes), folders: unionById(s.folders, content.folders) };
          const was = s.stash[bookId] ?? { recipes: [], folders: [] };
          return { stash: { ...s.stash, [bookId]: { recipes: unionById(was.recipes, content.recipes), folders: unionById(was.folders, content.folders) } } };
        }),
      // Called from a render effect, possibly before the saved state has loaded: writing then would save
      // the default state over the phone's recipes.
      markSeen: (bookId) => {
        if (useStore.persist.hasHydrated()) set((s) => ({ seenAt: { ...s.seenAt, [bookId]: Date.now() } }));
      },
      markSynced: (bookId) => set((s) => ({ syncedAt: { ...s.syncedAt, [bookId]: Date.now() } })),
      addFolder: (name, color) => {
        const id = newFolderId();
        set({ folders: [...get().folders, stamp({ id, name, color, ids: [] as string[] })] });
        return id;
      },
      updateFolder: (id, patch) => set((s) => ({ folders: s.folders.map((f) => (f.id === id ? stamp({ ...f, ...patch }) : f)) })),
      deleteFolder: (id) => set((s) => ({ folders: s.folders.filter((f) => f.id !== id) })),
      toggleInFolder: (folderId, recipeId) =>
        set((s) => ({
          folders: s.folders.map((f) =>
            f.id !== folderId ? f : stamp({ ...f, ids: f.ids.includes(recipeId) ? f.ids.filter((x) => x !== recipeId) : [recipeId, ...f.ids] }),
          ),
        })),
    }),
    {
      name: 'wowmiam-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        recipes: s.recipes,
        folders: s.folders,
        books: s.books,
        bookId: s.bookId,
        stash: s.stash,
        seenAt: s.seenAt,
        syncedAt: s.syncedAt,
        groups: s.groups,
        sort: s.sort,
        serves: s.serves,
      }),
    },
  ),
);

export function matches(r: Recipe, groups: Groups, query: string): boolean {
  const byTags = (Object.keys(groups) as Kind[]).every((kind) => {
    const g = groups[kind];
    if (!g.on.length) return true;
    const tags = tagsOf(r, kind);
    return g.op === 'OU' ? g.on.some((t) => tags.includes(t)) : g.on.every((t) => tags.includes(t));
  });
  if (!byTags) return false;
  const q = normalize(query.trim());
  if (!q) return true;
  const hay = normalize([r.name, r.note, ...r.ingredients.map((i) => i[2]), ...r.tools].join(' '));
  return q.split(/\s+/).every((word) => hay.includes(word));
}

export function selectResults(recipes: Recipe[], groups: Groups, query: string, sort: Sort): Recipe[] {
  const list = recipes.filter((r) => !r.deletedAt && matches(r, groups, query));
  return sort === 'az'
    ? [...list].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    : [...list].sort((a, b) => b.addedAt - a.addedAt);
}

export const activeCount = (groups: Groups): number => Object.values(groups).reduce((n, g) => n + g.on.length, 0);

export const live = (recipes: readonly Recipe[]): Recipe[] => recipes.filter((r) => !r.deletedAt);

export const currentBook = (s: Pick<State, 'books' | 'bookId'>): Book => s.books.find((b) => b.id === s.bookId) ?? s.books[0] ?? DEFAULT_BOOK;

/** The open book. */
export const useBook = (): Book => useStore(currentBook);

/** My rank in the open book. */
export const useRole = (): Role => useStore((s) => currentBook(s).role);

/** Recipes of a book, open or stashed. */
export const contentOf = (s: Pick<State, 'bookId' | 'recipes' | 'folders' | 'stash'>, bookId: string): BookContent =>
  bookId === s.bookId ? { recipes: s.recipes, folders: s.folders } : s.stash[bookId] ?? { recipes: [], folders: [] };

/** True once the saved state has been read from the phone. */
export const useHydrated = (): boolean =>
  useSyncExternalStore(
    (onChange) => useStore.persist.onFinishHydration(onChange),
    () => useStore.persist.hasHydrated(),
    () => false,
  );
