/** Recipe model, catalog of tags, seed library built from Elliot's own dishes. */
import { FOLDER_SWATCHES, type Swatch } from './theme';

export type Kind = 'type' | 'diet' | 'tool';

/** [quantity or null, unit, label] */
export type Ingredient = [number | null, string, string];
/** [instruction, timer minutes (0 = none)] */
export type Step = [string, number];

export const STICKERS = {
  'pizza-wrap': require('@/assets/stickers/pizza-wrap.webp'),
  'salade-endives': require('@/assets/stickers/salade-endives.webp'),
  'aubergines-pizza': require('@/assets/stickers/aubergines-pizza.webp'),
  'pates-carottes': require('@/assets/stickers/pates-carottes.webp'),
  'salade-verte': require('@/assets/stickers/salade-verte.webp'),
  'salade-courgettes': require('@/assets/stickers/salade-courgettes.webp'),
} as const;
export type StickerKey = keyof typeof STICKERS;

export interface Recipe {
  id: string;
  name: string;
  sticker?: StickerKey;
  /** The photo file on this phone. */
  photoUri?: string;
  /** The compressed copy in Cloud Storage, shown on phones that don't have the file. */
  photoUrl?: string;
  /** Which local file `photoUrl` was made from (its file name), so a replaced photo gets re-uploaded. */
  photoKey?: string;
  type: string;
  diets: string[];
  tools: string[];
  time: number;
  serves: number;
  addedAt: number;
  /** Last local edit; set by the store and used to merge with the cloud copy. Absent on untouched seed recipes. */
  updatedAt?: number;
  note: string;
  ingredients: Ingredient[];
  steps: Step[];
}

export interface Folder {
  id: string;
  name: string;
  ids: string[];
  color?: Swatch;
  updatedAt?: number;
}

export const CATALOG: Record<Kind, readonly string[]> = {
  type: ['Entrée', 'Plat', 'Dessert'],
  diet: ['Végé', 'Vegan', 'Sans gluten', 'Sans lactose'],
  tool: ['Four', 'Plaque', 'Poêle', 'Casserole', 'Saladier'],
};
export const KIND_LABEL: Record<Kind, string> = { type: 'Type', diet: 'Régime', tool: 'Ustensiles' };

const DAY = 86_400_000;

export function seedRecipes(now: number = Date.now()): Recipe[] {
  return [
    {
      id: 'pizza', name: 'Pizza wrap', sticker: 'pizza-wrap', type: 'Plat', diets: ['Végé'], tools: ['Four', 'Plaque'],
      time: 15, serves: 2, addedAt: now - DAY,
      note: 'La pâte à pizza remplacée par des galettes de fajitas.',
      ingredients: [[2, '', 'galettes de fajitas'], [15, 'cl', 'sauce tomate'], [150, 'g', 'champignons de Paris'], [120, 'g', 'mozzarella râpée'], [1, 'c. à c.', 'origan']],
      steps: [['Préchauffe le four à 220 °C.', 0], ['Étale la sauce tomate sur les galettes.', 0], ['Ajoute les champignons émincés, la mozzarella et l’origan.', 0], ['Enfourne jusqu’à ce que les bords dorent.', 9]],
    },
    {
      id: 'endives', name: 'Salade d’endives aux pommes', sticker: 'salade-endives', type: 'Entrée', diets: ['Végé', 'Vegan', 'Sans gluten', 'Sans lactose'], tools: ['Saladier'],
      time: 10, serves: 2, addedAt: now - 3 * DAY,
      note: 'Endives croquantes, dés de pomme et vinaigrette à la moutarde de Dijon.',
      ingredients: [[3, '', 'endives'], [2, '', 'pommes'], [30, 'g', 'cerneaux de noix'], [1, 'c. à s.', 'moutarde de Dijon'], [3, 'c. à s.', 'huile de colza'], [1, 'c. à s.', 'vinaigre de cidre']],
      steps: [['Émince les endives, retire le cœur amer.', 0], ['Coupe les pommes en dés.', 0], ['Fouette moutarde, vinaigre et huile.', 0], ['Mélange le tout avec les noix juste avant de servir.', 0]],
    },
    {
      id: 'aubergines', name: 'Aubergines façon pizza', sticker: 'aubergines-pizza', type: 'Plat', diets: ['Végé', 'Sans gluten'], tools: ['Four'],
      time: 40, serves: 2, addedAt: now - 5 * DAY,
      note: 'Des aubergines rôties, garnies comme une pizza et servies avec du riz.',
      ingredients: [[1, '', 'grosse aubergine'], [10, 'cl', 'sauce tomate'], [100, 'g', 'tofu fumé'], [80, 'g', 'emmental râpé'], [10, '', 'olives vertes'], [150, 'g', 'riz']],
      steps: [['Coupe l’aubergine en deux dans la longueur et quadrille la chair.', 0], ['Rôtis-la au four à 200 °C avec un filet d’huile.', 20], ['Garnis de sauce tomate, de tofu, d’olives et de fromage.', 0], ['Gratine, puis sers avec le riz.', 10]],
    },
    {
      id: 'pates', name: 'Pâtes, carottes et nuggets', sticker: 'pates-carottes', type: 'Plat', diets: [], tools: ['Casserole', 'Poêle'],
      time: 25, serves: 2, addedAt: now - 6 * DAY,
      note: 'Le plat du midi qui plaît à tout le monde, avec des carottes poêlées à la ciboulette.',
      ingredients: [[200, 'g', 'fusilli'], [3, '', 'carottes'], [6, '', 'nuggets'], [40, 'g', 'emmental râpé'], [1, 'c. à s.', 'ciboulette']],
      steps: [['Cuis les pâtes dans l’eau salée.', 10], ['Poêle les carottes en rondelles avec la ciboulette.', 12], ['Dore les nuggets à la poêle.', 0], ['Sers avec le fromage râpé.', 0]],
    },
    {
      id: 'composee', name: 'Salade composée', sticker: 'salade-verte', type: 'Entrée', diets: ['Végé', 'Sans gluten'], tools: ['Casserole'],
      time: 15, serves: 2, addedAt: now - 9 * DAY,
      note: 'La salade du soir quand le frigo est presque vide.',
      ingredients: [[1, '', 'laitue'], [2, '', 'œufs'], [2, '', 'tomates'], [8, '', 'olives vertes'], [2, 'c. à s.', 'vinaigrette']],
      steps: [['Cuis les œufs dans l’eau bouillante.', 10], ['Lave et essore la salade.', 0], ['Coupe les tomates, écale les œufs.', 0], ['Assemble et assaisonne au dernier moment.', 0]],
    },
    {
      id: 'courgettes', name: 'Salade de courgettes', sticker: 'salade-courgettes', type: 'Entrée', diets: ['Végé', 'Sans gluten'], tools: ['Four'],
      time: 35, serves: 2, addedAt: now - 12 * DAY,
      note: 'Courgettes rôties, servies froides avec de la feta.',
      ingredients: [[2, '', 'courgettes'], [2, '', 'pommes de terre'], [100, 'g', 'feta'], [1, 'botte', 'coriandre']],
      steps: [['Coupe les légumes en dés.', 0], ['Rôtis-les au four à 200 °C.', 25], ['Laisse refroidir complètement.', 0], ['Ajoute la feta émiettée et la coriandre.', 0]],
    },
  ];
}

export const SEED_RECIPE_IDS: ReadonlySet<string> = new Set(['pizza', 'endives', 'aubergines', 'pates', 'composee', 'courgettes']);

export const SEED_FOLDERS: Folder[] = [
  { id: 'soirs', name: 'Soirs de semaine', ids: ['pizza', 'pates', 'aubergines'] },
  { id: 'salades', name: 'Salades d’été', ids: ['endives', 'courgettes', 'composee'] },
  { id: 'mamie', name: 'Recettes de Mamie', ids: ['aubergines'] },
  { id: 'recevoir', name: 'Pour recevoir', ids: ['pizza', 'endives'] },
  { id: 'batch', name: 'Batch cooking', ids: ['pates', 'courgettes'] },
];

/** Folders keep the colour picked at creation; seed folders fall back to their position. */
export const folderSwatch = (f: Folder, index: number): Swatch => f.color ?? FOLDER_SWATCHES[index % FOLDER_SWATCHES.length];

export function tagsOf(r: Recipe, kind: Kind): string[] {
  return kind === 'type' ? [r.type] : kind === 'diet' ? r.diets : r.tools;
}

const WEEKDAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export function addedLabel(ts: number, now: number = Date.now()): string {
  const today = new Date(now);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const d = new Date(ts);
  if (ts >= start) return 'Aujourd’hui';
  if (ts >= start - DAY) return 'Hier';
  if (ts >= start - 6 * DAY) return WEEKDAYS[d.getDay()];
  return `Le ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Inverse of parseIngredient, used to prefill the editor. */
export function ingredientLine([q, unit, label]: Ingredient): string {
  return [formatQty(q, unit, 1), label].filter(Boolean).join(' ');
}

export function formatQty(q: number | null, unit: string, factor: number): string {
  if (q === null) return unit;
  const n = Math.round(q * factor * 10) / 10;
  const text = String(n).replace('.', ',');
  return unit ? `${text} ${unit}` : text;
}

const UNITS = ['kg', 'g', 'cl', 'ml', 'l', 'c. à s.', 'c. à c.', 'pincée', 'botte', 'tranches', 'tranche'];

/** "200 g lentilles" → [200, 'g', 'lentilles']; "sel" → [null, '', 'sel'] */
export function parseIngredient(line: string): Ingredient {
  const text = line.trim();
  const m = text.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (!m) return [null, '', text];
  const qty = Number(m[1].replace(',', '.'));
  const rest = m[2];
  const unit = UNITS.find((u) => rest.toLowerCase().startsWith(`${u} `) || rest.toLowerCase() === u) ?? '';
  return [qty, unit, rest.slice(unit.length).trim()];
}

/** What to display for a user photo: the local file first, else the synced copy. */
export const photoOf = (r: Pick<Recipe, 'photoUri' | 'photoUrl'>): string | undefined => r.photoUri ?? r.photoUrl;

export const normalize = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
