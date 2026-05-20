/**
 * App.tsx
 * 
 * Purpose:
 * This is the main entry point of the Stash Mobile application. 
 * It acts as the "orchestrator" for the Home screen, managing the search UI, 
 * the list of stashes, and the creation/editing modal.
 * 
 * Responsibilities:
 * - App initialization (Device ID setup).
 * - State management for search and local data display.
 * - Coordinating API calls via the Service layer.
 * - Rendering the primary UI components and modals.
 * 
 * Learning Note:
 * In a larger app, this file would be broken down into multiple screens using 
 * a navigation library (like React Navigation). For this "search-first" MVP, 
 * we keep it unified for speed and simplicity.
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  Modal, 
  KeyboardAvoidingView, 
  Platform,
  SafeAreaView,
  Alert,
  Keyboard,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { Search, Plus, X, Trash2, Edit2 } from 'lucide-react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';

// Layered Architecture: 
// We import our data logic from services and store rather than calling axios directly.
// This keeps our UI code "clean" and focused only on how things look.
import { stashService } from './src/services/stash.service';
import { useAppStore } from './src/store/useAppStore';
import { Stash } from './src/types/stash';

export default function App() {
  // --- UI State ---
  // searchQuery: Holds the text currently typed in the search bar.
  const [searchQuery, setSearchQuery] = useState('');
  // isModalVisible: Controls the visibility of the "Where is it?" popup.
  const [isModalVisible, setIsModalVisible] = useState(false);
  // newContent: Temporary storage for the text being typed in the create/edit modal.
  const [newContent, setNewContent] = useState('');
  // editingId: If null, the modal is in "Create" mode. If it has a UUID, we are "Editing".
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // --- Data State ---
  // isLoading: Shows a spinner when we are waiting for the backend.
  const [isLoading, setIsLoading] = useState(false);
  // isRefreshing: Specifically for the "Pull-to-Refresh" interaction.
  const [isRefreshing, setIsRefreshing] = useState(false);
  // stashes: The actual array of data we received from the API.
  const [stashes, setStashes] = useState<Stash[]>([]);

  // --- Logic & Hooks ---
  // We pull the initialization function from our Zustand store.
  const initializeDeviceId = useAppStore(state => state.initializeDeviceId);
  // Ref for the modal input so we can programmatically focus the keyboard.
  const inputRef = useRef<TextInput>(null);

  /**
   * App Initialization
   * Runs once when the component mounts.
   * We must ensure the Device ID exists before making any stash requests.
   */
  useEffect(() => {
    const init = async () => {
      await initializeDeviceId();
      loadStashes(); // Fetch initial data
    };
    init();
  }, []);

  /**
   * Search Debounce Flow
   * We don't want to hit the API on every single keystroke (it's expensive).
   * Instead, we wait for 300ms of "silence" before triggering the search call.
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        performSearch();
      } else {
        loadStashes(); // If search is cleared, show recent items again.
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  /**
   * Modal Auto-Focus
   * UX Trick: When the modal slides up, we wait 100ms for the animation 
   * to settle before forcing the keyboard to open.
   */
  useEffect(() => {
    if (isModalVisible) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isModalVisible]);

  // --- API Interaction Handlers ---

  /**
   * loadStashes
   * Fetches the 20 most recent items for this device.
   */
  const loadStashes = async () => {
    try {
      setIsLoading(true);
      const response = await stashService.getRecentStashes();
      if (response.success) {
        setStashes(response.data);
      }
    } catch (error) {
      console.error('Failed to load stashes:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  /**
   * performSearch
   * Calls the specialized search endpoint on the backend.
   */
  const performSearch = async () => {
    try {
      setIsLoading(true);
      const response = await stashService.searchStashes(searchQuery);
      if (response.success) {
        setStashes(response.data);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * onRefresh
   * Triggered by the user pulling down the list.
   */
  const onRefresh = () => {
    setIsRefreshing(true);
    loadStashes();
  };

  /**
   * handleSave
   * Handles both Creating a new stash and Updating an existing one.
   * This logic is "optimistic" in spirit but waits for API confirmation 
   * to ensure data integrity.
   */
  const handleSave = async () => {
    if (!newContent.trim()) return;

    try {
      setIsLoading(true);
      if (editingId) {
        // Mode: Update
        const response = await stashService.updateStash(editingId, { content: newContent.trim() });
        if (response.success) {
          // Update the item in our local array without a full re-fetch.
          setStashes(stashes.map(s => s.id === editingId ? response.data : s));
        }
      } else {
        // Mode: Create
        const response = await stashService.createStash({ content: newContent.trim() });
        if (response.success) {
          // Prepend the new item to the top of our local list.
          setStashes([response.data, ...stashes]);
        }
      }
      closeModal();
    } catch (error) {
      Alert.alert('Error', 'Couldn’t save stash. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * handleDelete
   * Asks for confirmation before calling the DELETE endpoint.
   * Soft-deletion happens on the backend, but we remove it from the UI immediately.
   */
  const handleDelete = (id: string) => {
    Alert.alert(
      "Delete Stash",
      "Are you sure you want to remove this item?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: async () => {
            try {
              const response = await stashService.deleteStash(id);
              if (response.success) {
                setStashes(stashes.filter(s => s.id !== id));
              }
            } catch (error) {
              Alert.alert('Error', 'Couldn’t delete stash.');
            }
          } 
        }
      ]
    );
  };

  // --- Modal Helpers ---

  const openCreateModal = () => {
    setEditingId(null);
    setNewContent('');
    setIsModalVisible(true);
  };

  const openEditModal = (stash: Stash) => {
    setEditingId(stash.id);
    setNewContent(stash.content);
    setIsModalVisible(true);
  };

  const closeModal = () => {
    setIsModalVisible(false);
    setNewContent('');
    setEditingId(null);
    Keyboard.dismiss();
  };

  // --- Render Helpers ---

  /**
   * renderStashItem
   * Defines how a single row in our list looks.
   */
  const renderStashItem = ({ item }: { item: Stash }) => (
    <View style={styles.stashItem}>
      <View style={styles.stashInfo}>
        <Text style={styles.stashName}>{item.content}</Text>
      </View>
      <View style={styles.stashActions}>
        <TouchableOpacity onPress={() => openEditModal(item)} style={styles.actionButton}>
          <Edit2 size={18} color="#8E8E93" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.actionButton}>
          <Trash2 size={18} color="#FF3B30" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ExpoStatusBar style="auto" />
      
      {/* Header: Centered and conversational to set a calm mood */}
      <View style={styles.header}>
        <Text style={styles.title}>Stash</Text>
      </View>

      {/* Search Bar: The primary interaction point for "Search-First" UX */}
      <View style={styles.searchContainer}>
        <Search size={20} color="#8E8E93" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search anything"
          placeholderTextColor="#8E8E93"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {/* Inline loader inside search bar for immediate feedback */}
        {isLoading && searchQuery.length > 0 && (
          <ActivityIndicator size="small" color="#8E8E93" />
        )}
      </View>

      {/* List Section: Recent items or Search results */}
      <View style={styles.listContainer}>
        <Text style={styles.sectionTitle}>
          {searchQuery ? 'Search Results' : 'Recent'}
        </Text>
        <FlatList
          data={stashes}
          keyExtractor={(item) => item.id}
          renderItem={renderStashItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#8E8E93" />
          }
          ListEmptyComponent={
            !isLoading ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No stashes found</Text>
              </View>
            ) : null
          }
        />
      </View>

      {/* FAB (Floating Add Button): Minimal and monochrome to avoid visual noise */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={openCreateModal}
        activeOpacity={0.7}
      >
        <Plus size={24} color="#000" strokeWidth={1.5} />
      </TouchableOpacity>

      {/* Create/Edit Modal: Uses conversational "Where is it?" prompt */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isModalVisible}
        onRequestClose={closeModal}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={closeModal}
        >
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContentWrapper}
          >
            <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Where is it?</Text>
                <TouchableOpacity onPress={closeModal}>
                  <X size={20} color="#8E8E93" />
                </TouchableOpacity>
              </View>
              
              <TextInput
                ref={inputRef}
                style={styles.modalInput}
                placeholder="passport in blue drawer"
                placeholderTextColor="#C7C7CC"
                value={newContent}
                onChangeText={setNewContent}
                onSubmitEditing={handleSave}
                returnKeyType="done"
                autoCorrect={false}
                autoCapitalize="none"
                multiline // Allows for longer descriptions if needed
              />

              <TouchableOpacity 
                style={[styles.saveButton, !newContent.trim() && styles.saveButtonDisabled]} 
                onPress={handleSave}
                disabled={!newContent.trim() || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>{editingId ? 'Update' : 'Save'}</Text>
                )}
              </TouchableOpacity>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// --- Styles ---
// We follow Apple's Human Interface Guidelines for spacing and colors.
// Using System Gray shades (#8E8E93, #F2F2F7) for a "native" iOS feel.
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: '#000000',
    letterSpacing: -0.5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    marginHorizontal: 32,
    paddingHorizontal: 16,
    borderRadius: 14,
    height: 52,
    marginBottom: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 17,
    color: '#000000',
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  listContent: {
    paddingBottom: 100, // Extra space so the FAB doesn't cover the last item.
  },
  stashItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C6C6C8',
  },
  stashInfo: {
    flex: 1,
  },
  stashName: {
    fontSize: 17,
    color: '#000000',
    marginBottom: 2,
    fontWeight: '500',
  },
  stashActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 40,
    right: 32,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    // Soft shadow for depth without "Material Design" harshness.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // Dimmed background to focus on the modal.
    justifyContent: 'flex-end',
  },
  modalContentWrapper: {
    width: '100%',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
  },
  modalInput: {
    fontSize: 20,
    color: '#000000',
    paddingVertical: 12,
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
    minHeight: 100, // Large typing area for better mobile ergonomics.
  },
  saveButton: {
    backgroundColor: '#000000',
    borderRadius: 14,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#F2F2F7',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  emptyContainer: {
    paddingTop: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#8E8E93',
    fontSize: 15,
  },
});
