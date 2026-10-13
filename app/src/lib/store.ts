/** App state, persisted on the device. Filters combine OU inside a group and ET across groups. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { type Folder, type Kind, type Recipe, SEED_FOLDERS, normalize, seedRecipes, tagsOf } from './data';
import type { Swatch } from './theme';

export type Op = 'OU' | 'ET';
export type Groups = Record<Kind, { op: Op; on: string[] }>;
export type Sort = 'recent' | 'az';

interface State {
  recipes: Recipe[];
  folders: Folder[];
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
  deleteRecipe: (id: string) => void;
  addFolder: (name: string, color: Swatch) => string;
  updateFolder: (id: string, patch: Pick<Folder, 'name' | 'color'>) => void;
  deleteFolder: (id: string) => void;
  toggleInFolder: (folderId: string, recipeId: string) => void;
}

const newFolderId = (): string => `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

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
            recipes: exists ? s.recipes.map((r) => (r.id === recipe.id ? recipe : r)) : [recipe, ...s.recipes],
            folders: s.folders.map((f) => {
              const has = f.ids.includes(recipe.id);
              const want = folderIds.includes(f.id);
              if (has === want) return f;
              return { ...f, ids: want ? [recipe.id, ...f.ids] : f.ids.filter((x) => x !== recipe.id) };
            }),
          };
        }),
      deleteRecipe: (id) =>
        set((s) => {
          const { [id]: _gone, ...serves } = s.serves;
          return {
            recipes: s.recipes.filter((r) => r.id !== id),
            folders: s.folders.map((f) => (f.ids.includes(id) ? { ...f, ids: f.ids.filter((x) => x !== id) } : f)),
            serves,
          };
        }),
      addFolder: (name, color) => {
        const id = newFolderId();
        set({ folders: [...get().folders, { id, name, color, ids: [] }] });
        return id;
      },
      updateFolder: (id, patch) => set((s) => ({ folders: s.folders.map((f) => (f.id === id ? { ...f, ...patch } : f)) })),
      deleteFolder: (id) => set((s) => ({ folders: s.folders.filter((f) => f.id !== id) })),
      toggleInFolder: (folderId, recipeId) =>
        set((s) => ({
          folders: s.folders.map((f) =>
            f.id !== folderId ? f : { ...f, ids: f.ids.includes(recipeId) ? f.ids.filter((x) => x !== recipeId) : [recipeId, ...f.ids] },
          ),
        })),
    }),
    {
      name: 'wowmiam-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ recipes: s.recipes, folders: s.folders, groups: s.groups, sort: s.sort, serves: s.serves }),
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
  const list = recipes.filter((r) => matches(r, groups, query));
  return sort === 'az'
    ? [...list].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    : [...list].sort((a, b) => b.addedAt - a.addedAt);
}

export const activeCount = (groups: Groups): number => Object.values(groups).reduce((n, g) => n + g.on.length, 0);
