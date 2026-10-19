/** Who is signed in and how the cloud copy is doing. Not persisted: Firebase restores the session itself. */
import { create } from 'zustand';

export type SyncStatus = 'off' | 'syncing' | 'synced' | 'error';

export interface Account {
  uid: string;
  name: string | null;
  email: string | null;
  photo: string | null;
}

interface AccountState {
  account: Account | null;
  status: SyncStatus;
  error: string | null;
}

export const useAccount = create<AccountState>()(() => ({ account: null, status: 'off', error: null }));
