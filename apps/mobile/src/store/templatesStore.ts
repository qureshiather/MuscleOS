import { create } from 'zustand';
import type { WorkoutTemplate, TemplateFolder } from '@muscleos/types';
import {
  getTemplates,
  setTemplates,
  getTemplateFolders,
  setTemplateFolders,
} from '@/storage/localStorage';
import { BUILT_IN_TEMPLATES } from '@/data/builtInTemplates';
import {
  notifyTemplateUpsert,
  notifyTemplateDelete,
  notifyFolderUpsert,
  notifyFolderDelete,
} from '@/sync';

export interface TemplatesState {
  userTemplates: WorkoutTemplate[];
  folders: TemplateFolder[];
  isLoading: boolean;
  load: () => Promise<void>;
  addTemplate: (t: WorkoutTemplate) => Promise<void>;
  updateTemplate: (id: string, t: Partial<WorkoutTemplate>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  addFolder: (f: TemplateFolder) => Promise<void>;
  updateFolder: (id: string, f: Partial<TemplateFolder>) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  /** All templates = built-in + user (built-in first) */
  allTemplates: () => WorkoutTemplate[];
}

export const useTemplatesStore = create<TemplatesState>((set, get) => ({
  userTemplates: [],
  folders: [],
  isLoading: true,

  load: async () => {
    set({ isLoading: true });
    try {
      const [userTemplates, folders] = await Promise.all([
        getTemplates(),
        getTemplateFolders(),
      ]);
      set({ userTemplates, folders, isLoading: false });
    } catch {
      set({ userTemplates: [], folders: [], isLoading: false });
    }
  },

  addTemplate: async (t) => {
    const { userTemplates } = get();
    const next = [...userTemplates, t];
    await setTemplates(next);
    set({ userTemplates: next });
    notifyTemplateUpsert(t);
  },

  updateTemplate: async (id, patch) => {
    const { userTemplates } = get();
    const next = userTemplates.map((t) => (t.id === id ? { ...t, ...patch } : t));
    await setTemplates(next);
    set({ userTemplates: next });
    const updated = next.find((t) => t.id === id);
    if (updated) notifyTemplateUpsert(updated);
  },

  deleteTemplate: async (id) => {
    const { userTemplates } = get();
    const next = userTemplates.filter((t) => t.id !== id);
    await setTemplates(next);
    set({ userTemplates: next });
    notifyTemplateDelete(id);
  },

  addFolder: async (f) => {
    const { folders } = get();
    const next = [...folders, f];
    await setTemplateFolders(next);
    set({ folders: next });
    notifyFolderUpsert(f);
  },

  updateFolder: async (id, patch) => {
    const { folders } = get();
    const next = folders.map((f) => (f.id === id ? { ...f, ...patch } : f));
    await setTemplateFolders(next);
    set({ folders: next });
    const updated = next.find((f) => f.id === id);
    if (updated) notifyFolderUpsert(updated);
  },

  deleteFolder: async (id) => {
    const { folders, userTemplates } = get();
    const nextFolders = folders.filter((f) => f.id !== id);
    const nextTemplates = userTemplates.map((t) =>
      t.folderId === id ? { ...t, folderId: undefined } : t
    );
    await Promise.all([setTemplateFolders(nextFolders), setTemplates(nextTemplates)]);
    set({ folders: nextFolders, userTemplates: nextTemplates });
    notifyFolderDelete(id);
    for (const t of nextTemplates) notifyTemplateUpsert(t);
  },

  allTemplates: () => {
    const { userTemplates } = get();
    return [...BUILT_IN_TEMPLATES, ...userTemplates];
  },
}));
