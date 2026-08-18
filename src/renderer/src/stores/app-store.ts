import { create } from 'zustand'
import type { Account, Content, Template, RenderJob } from '@shared/index'

interface AppState {
  accounts: Account[]
  contents: Content[]
  templates: Template[]
  renderJobs: RenderJob[]
  activeAccountId: string | null
  isLoading: boolean

  setAccounts: (accounts: Account[]) => void
  setContents: (contents: Content[]) => void
  setTemplates: (templates: Template[]) => void
  setRenderJobs: (jobs: RenderJob[]) => void
  setActiveAccount: (id: string | null) => void
  setLoading: (loading: boolean) => void
  addContent: (content: Content) => void
  updateContent: (id: string, data: Partial<Content>) => void
  removeContent: (id: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  accounts: [],
  contents: [],
  templates: [],
  renderJobs: [],
  activeAccountId: null,
  isLoading: false,

  setAccounts: (accounts) => set({ accounts }),
  setContents: (contents) => set({ contents }),
  setTemplates: (templates) => set({ templates }),
  setRenderJobs: (jobs) => set({ renderJobs: jobs }),
  setActiveAccount: (id) => set({ activeAccountId: id }),
  setLoading: (isLoading) => set({ isLoading }),
  addContent: (content) => set((s) => ({ contents: [...s.contents, content] })),
  updateContent: (id, data) =>
    set((s) => ({
      contents: s.contents.map((c) => (c.id === id ? { ...c, ...data } : c))
    })),
  removeContent: (id) =>
    set((s) => ({
      contents: s.contents.filter((c) => c.id !== id)
    }))
}))
