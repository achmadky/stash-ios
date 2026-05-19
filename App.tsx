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

// Services & Store
import { stashService } from './src/services/stash.service';
import { useAppStore } from './src/store/useAppStore';
import { Stash } from './src/types/stash';

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stashes, setStashes] = useState<Stash[]>([]);

  const initializeDeviceId = useAppStore(state => state.initializeDeviceId);
  const inputRef = useRef<TextInput>(null);

  // Initialize App
  useEffect(() => {
    const init = async () => {
      await initializeDeviceId();
      loadStashes();
    };
    init();
  }, []);

  // Handle Search Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        performSearch();
      } else {
        loadStashes();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Auto-focus keyboard when modal opens
  useEffect(() => {
    if (isModalVisible) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isModalVisible]);

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

  const onRefresh = () => {
    setIsRefreshing(true);
    loadStashes();
  };

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

  const handleSave = async () => {
    if (!newContent.trim()) return;

    try {
      setIsLoading(true);
      if (editingId) {
        const response = await stashService.updateStash(editingId, { content: newContent.trim() });
        if (response.success) {
          setStashes(stashes.map(s => s.id === editingId ? response.data : s));
        }
      } else {
        const response = await stashService.createStash({ content: newContent.trim() });
        if (response.success) {
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

  const closeModal = () => {
    setIsModalVisible(false);
    setNewContent('');
    setEditingId(null);
    Keyboard.dismiss();
  };

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

  const renderStashItem = ({ item }: { item: Stash }) => (
    <View style={styles.stashItem}>
      <View style={styles.stashInfo}>
        <Text style={styles.stashName}>{item.content}</Text>
      </View>
      <View style={styles.stashActions}>
        <TouchableOpacity onPress={() => openEditModal(item)} style={styles.actionButton}>
          <Edit2/>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.actionButton}>
          <Trash2/>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ExpoStatusBar style="auto" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Stash.</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Search/>
        <TextInput
          style={styles.searchInput}
          placeholder="Search anything"
          placeholderTextColor="#8E8E93"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {isLoading && searchQuery.length > 0 && (
          <ActivityIndicator size="small" color="#8E8E93" />
        )}
      </View>

      {/* List Container */}
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

      {/* Minimal FAB */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={openCreateModal}
        activeOpacity={0.7}
      >
        <Plus/>
      </TouchableOpacity>

      {/* Create/Edit Modal */}
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
                  <X/>
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
                multiline
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
    paddingBottom: 100,
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
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
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
    minHeight: 100,
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
