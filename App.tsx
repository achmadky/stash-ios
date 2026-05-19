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
  Keyboard
} from 'react-native';
import { Search, Plus, X, Trash2, Edit2 } from 'lucide-react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';

// Types
interface Stash {
  id: string;
  name: string;
  location: string;
  createdAt: number;
}

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [stashes, setStashes] = useState<Stash[]>([
    { id: '1', name: 'passport', location: 'drawer', createdAt: Date.now() - 100000 },
    { id: '2', name: 'wallet', location: 'shelf', createdAt: Date.now() - 200000 },
    { id: '3', name: 'charger', location: 'backpack', createdAt: Date.now() - 300000 },
  ]);

  const nameInputRef = useRef<TextInput>(null);
  const locationInputRef = useRef<TextInput>(null);

  // Auto-focus keyboard when modal opens
  useEffect(() => {
    if (isModalVisible) {
      const timer = setTimeout(() => {
        nameInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isModalVisible]);

  const openCreateModal = () => {
    setEditingId(null);
    setNewName('');
    setNewLocation('');
    setIsModalVisible(true);
  };

  const openEditModal = (stash: Stash) => {
    setEditingId(stash.id);
    setNewName(stash.name);
    setNewLocation(stash.location);
    setIsModalVisible(true);
  };

  const handleSave = () => {
    if (newName.trim()) {
      if (editingId) {
        // Update existing
        setStashes(stashes.map(s => 
          s.id === editingId 
            ? { ...s, name: newName.trim(), location: newLocation.trim() } 
            : s
        ));
      } else {
        // Create new
        const newStash: Stash = {
          id: Math.random().toString(36).substring(7),
          name: newName.trim(),
          location: newLocation.trim(),
          createdAt: Date.now(),
        };
        setStashes([newStash, ...stashes]);
      }
      
      closeModal();
    }
  };

  const closeModal = () => {
    setIsModalVisible(false);
    setNewName('');
    setNewLocation('');
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
          onPress: () => {
            setStashes(stashes.filter(s => s.id !== id));
          } 
        }
      ]
    );
  };

  const renderStashItem = ({ item }: { item: Stash }) => (
    <View style={styles.stashItem}>
      <View style={styles.stashInfo}>
        <Text style={styles.stashName}>{item.name}</Text>
        {item.location ? <Text style={styles.stashLocation}>{item.location}</Text> : null}
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
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Stash.</Text>
      </View>

      {/* Search Bar - Primary Action */}
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
      </View>

      {/* List Container */}
      <View style={styles.listContainer}>
        <Text style={styles.sectionTitle}>
          {searchQuery ? 'Search Results' : 'Recent'}
        </Text>
        <FlatList
          data={stashes.filter((s: Stash) => 
            s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
            s.location.toLowerCase().includes(searchQuery.toLowerCase())
          )}
          keyExtractor={(item: Stash) => item.id}
          renderItem={renderStashItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No stashes found</Text>
            </View>
          }
        />
      </View>

      {/* Minimal FAB */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={openCreateModal}
        activeOpacity={0.7}
      >
        <Plus size={24} color="#000" strokeWidth={1.5} />
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
                  <X size={20} color="#8E8E93" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Item Name</Text>
                <TextInput
                  ref={nameInputRef}
                  style={styles.modalInput}
                  placeholder="passport"
                  placeholderTextColor="#C7C7CC"
                  value={newName}
                  onChangeText={setNewName}
                  returnKeyType="next"
                  onSubmitEditing={() => locationInputRef.current?.focus()}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Location</Text>
                <TextInput
                  ref={locationInputRef}
                  style={styles.modalInput}
                  placeholder="drawer"
                  placeholderTextColor="#C7C7CC"
                  value={newLocation}
                  onChangeText={setNewLocation}
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
              </View>

              <TouchableOpacity 
                style={[styles.saveButton, !newName.trim() && styles.saveButtonDisabled]} 
                onPress={handleSave}
                disabled={!newName.trim()}
              >
                <Text style={styles.saveButtonText}>{editingId ? 'Update' : 'Save'}</Text>
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
  stashLocation: {
    fontSize: 15,
    color: '#8E8E93',
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
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  modalInput: {
    fontSize: 18,
    color: '#000000',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  saveButton: {
    backgroundColor: '#000000',
    borderRadius: 14,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
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
