// The app's RN Firebase modular calls, served by the web SDK against the emulator as one test user.
export { Timestamp, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
export type { DocumentData } from 'firebase/firestore';
export const getFirestore = () => (globalThis as any).__db;
