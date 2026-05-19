import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

interface AppState {
  deviceId: string | null;
  initializeDeviceId: () => Promise<string>;
}

const DEVICE_ID_KEY = 'stash_device_id';

export const useAppStore = create<AppState>((set) => ({
  deviceId: null,
  initializeDeviceId: async () => {
    let id = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    
    // Validate if existing ID is a valid UUID, otherwise regenerate
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!id || !uuidRegex.test(id)) {
      // Generate a valid UUID v4 format
      // Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
      await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
      console.log(`[Store] Generated new valid UUID Device ID: ${id}`);
    } else {
      console.log(`[Store] Loaded existing Device ID: ${id}`);
    }
    
    set({ deviceId: id });
    return id;
  },
}));
