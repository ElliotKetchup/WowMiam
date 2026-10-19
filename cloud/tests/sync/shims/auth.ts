export type User = { uid: string; displayName: string | null; email: string | null; photoURL: string | null };
export const getAuth = () => ({});
export const onAuthStateChanged = (_a: unknown, cb: (u: User | null) => void) => { setTimeout(() => cb((globalThis as any).__user), 0); return () => undefined; };
export const signOut = async () => undefined;
export const signInWithCredential = async () => undefined;
export const GoogleAuthProvider = { credential: () => ({}) };
