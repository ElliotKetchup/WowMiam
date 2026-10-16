/** The web build (used for previews) has no Firebase native modules: the account stays signed out. */
export function initCloud(): () => void {
  return () => undefined;
}

export async function signInWithGoogle(): Promise<boolean> {
  throw new Error('La connexion Google est disponible dans l’app Android.');
}

export async function signOutOfCloud(): Promise<void> {
  return undefined;
}
