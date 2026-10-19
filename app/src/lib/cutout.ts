/**
 * Dish photos become die-cut stickers on the phone: the WowMiamCutout native module (app/modules/wowmiam-cutout)
 * asks ML Kit for the subject, makes the rest transparent and adds a white rim. Without the module
 * (web, or an APK older than 0.3.0) photos stay round.
 */
import { requireOptionalNativeModule } from 'expo';
import { Directory, File, Paths } from 'expo-file-system';

interface CutoutNative {
  cutOutAsync(source: string, dest: string): Promise<{ uri: string; width: number; height: number } | null>;
}

const native = requireOptionalNativeModule<CutoutNative>('WowMiamCutout');

export const canCutOut = native !== null;

export type CutOutcome = { kind: 'sticker'; uri: string } | { kind: 'no-subject' } | { kind: 'failed'; reason: string };

export async function cutOutDish(photoUri: string, recipeId: string): Promise<CutOutcome> {
  if (!native) return { kind: 'failed', reason: 'Le détourage demande la dernière version de l’app.' };
  const dir = new Directory(Paths.document, 'photos');
  dir.create({ idempotent: true });
  const dest = new File(dir, `${recipeId}-cut-${Date.now().toString(36)}.webp`).uri;
  try {
    const made = await native.cutOutAsync(photoUri, dest);
    return made ? { kind: 'sticker', uri: made.uri } : { kind: 'no-subject' };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // ML Kit's model arrives through Google Play services; until then it answers "unavailable".
    return /unavailable|download|waiting/i.test(message)
      ? { kind: 'failed', reason: 'Le détourage se prépare (téléchargement par Google). Réessaie dans quelques minutes.' }
      : { kind: 'failed', reason: `Détourage impossible : ${message}` };
  }
}
