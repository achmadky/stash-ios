/**
 * store/useAppStore.ts
 * 
 * Purpose:
 * This file manages "Global State" using Zustand. 
 * Global state is data that needs to be accessed by many different parts of the 
 * app (like the Device ID, which is used in every API call).
 * 
 * Responsibilities:
 * - Generate a unique Device ID for new installs.
 * - Persist the Device ID on the physical phone so it survives app restarts.
 * - Provide a simple way for any component to access the current Device ID.
 * 
 * Learning Note:
 * We use Zustand because it's much lighter and easier to understand than Redux, 
 * but more powerful than just using React Context for complex logic.
 */

import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

interface AppState {
  deviceId: string | null;
  initializeDeviceId: () => Promise<string>;
}

// The "Key" we use to save/load from the phone's secure storage.
const DEVICE_ID_KEY = 'stash_device_id';

export const useAppStore = create<AppState>((set) => ({
  // The current ID in memory. Starts as null.
  deviceId: null,

  /**
   * initializeDeviceId
   * This is the "Bootup" logic for our app's identity.
   */
  initializeDeviceId: async () => {
    // 1. Try to load an existing ID from the phone's encrypted storage.
    let id = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    
    // 2. Validate if the found ID is a valid UUID v4.
    // This regex ensures we don't accidentally use malformed data from old versions.
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!id || !uuidRegex.test(id)) {
      /**
       * 3. If no valid ID is found, we generate a fresh UUID v4.
       * A UUID v4 is essentially a "collision-proof" random string.
       * Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
       */
      id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });

      // 4. Save the new ID permanently to the phone.
      await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
      console.log(`[Store] Generated new valid UUID Device ID: ${id}`);
    } else {
      console.log(`[Store] Loaded existing Device ID: ${id}`);
    }
    
    // 5. Update the Zustand state so the rest of the app can see the ID.
    set({ deviceId: id });
    return id;
  },
}));
