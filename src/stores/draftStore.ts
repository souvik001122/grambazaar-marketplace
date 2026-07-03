import { create } from 'zustand';
import * as FileSystem from 'expo-file-system/legacy';

export interface ProductDraft {
  id: string;
  name: string;
  category: string;
  price: string;
  description: string;
  stock: string;
  deliveryOption: string;
  images: string[];
  createdAt: string;
}

interface DraftState {
  drafts: ProductDraft[];
  isLoading: boolean;
  loadDrafts: () => Promise<void>;
  saveDraft: (draft: Omit<ProductDraft, 'id' | 'createdAt'>, id?: string) => Promise<void>;
  deleteDraft: (id: string) => Promise<void>;
  clearDrafts: () => Promise<void>;
}

const FILE_PATH = `${FileSystem.documentDirectory}grambazaar_product_drafts.json`;

const readDraftsFromFile = async (): Promise<ProductDraft[]> => {
  try {
    const fileInfo = await FileSystem.getInfoAsync(FILE_PATH);
    if (!fileInfo.exists) {
      return [];
    }
    const content = await FileSystem.readAsStringAsync(FILE_PATH);
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Error reading drafts from file system:', error);
    return [];
  }
};

const writeDraftsToFile = async (drafts: ProductDraft[]): Promise<void> => {
  try {
    await FileSystem.writeAsStringAsync(FILE_PATH, JSON.stringify(drafts));
  } catch (error) {
    console.error('Error writing drafts to file system:', error);
  }
};

export const useDraftStore = create<DraftState>((set, get) => ({
  drafts: [],
  isLoading: false,

  loadDrafts: async () => {
    set({ isLoading: true });
    const drafts = await readDraftsFromFile();
    set({ drafts, isLoading: false });
  },

  saveDraft: async (draftData, id) => {
    const currentDrafts = [...get().drafts];
    const now = new Date().toISOString();

    if (id) {
      // Update existing draft
      const updatedDrafts = currentDrafts.map((d) =>
        d.id === id
          ? {
              ...d,
              ...draftData,
              updatedAt: now,
            }
          : d
      );
      set({ drafts: updatedDrafts });
      await writeDraftsToFile(updatedDrafts);
    } else {
      // Create new draft
      const newDraft: ProductDraft = {
        id: `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...draftData,
        createdAt: now,
      };
      const updatedDrafts = [newDraft, ...currentDrafts];
      set({ drafts: updatedDrafts });
      await writeDraftsToFile(updatedDrafts);
    }
  },

  deleteDraft: async (id) => {
    const updatedDrafts = get().drafts.filter((d) => d.id !== id);
    set({ drafts: updatedDrafts });
    await writeDraftsToFile(updatedDrafts);
  },

  clearDrafts: async () => {
    set({ drafts: [] });
    await writeDraftsToFile([]);
  },
}));
