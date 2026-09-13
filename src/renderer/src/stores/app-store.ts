import { create } from 'zustand'

interface AppSelectionState {
  activeAccountId: string | null
  setActiveAccount: (id: string | null) => void
}

export const useAccountStore = create<AppSelectionState>((set) => ({
  activeAccountId: null,
  setActiveAccount: (id) => set({ activeAccountId: id })
}))