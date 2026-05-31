/**
 * App.tsx
 * 
 * Purpose:
 * This is the main orchestrator of the Stash Mobile application. 
 * It manages search inputs, recent stashes list, and coordinates both 
 * standard text composer and voice recorder inputs.
 * 
 * Responsibilities:
 * - App initialization (load device identity).
 * - Instant client-side search.
 * - Swipe-to-delete with custom PanResponder.
 * - Undo deletion with a 3-second buffer.
 * - Capture button gesture recognition (Tap vs Hold).
 * - Simulated voice recording and speech-to-text.
 * - Long-press detail sheet with auto-save check on close.
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
  Keyboard,
  ActivityIndicator,
  RefreshControl,
  Animated,
  PanResponder,
  Pressable
} from 'react-native';
import { Search, Plus, X, Mic, AlertCircle, CheckCircle } from 'lucide-react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';

// Layered Architecture: Import data logic from services/stores.
import { stashService } from './src/services/stash.service';
import { useAppStore } from './src/store/useAppStore';
import { Stash } from './src/types/stash';

// List of realistic stashes to simulate speech-to-text transcription.
const MOCK_VOICE_STASHES = [
  "passport in second drawer",
  "MacBook charger near TV cabinet",
  "Gym gloves inside car trunk",
  "car keys in the jacket pocket",
  "wallet on the work desk",
  "spare glasses in bedside cabinet",
  "house keys on the kitchen counter",
  "headphones inside the gray backpack"
];

// Custom swipe-to-delete item wrapper using native Animated + PanResponder.
interface SwipeableItemProps {
  item: Stash;
  onDelete: (id: string) => void;
  onLongPress: (item: Stash) => void;
}

const SwipeableItem: React.FC<SwipeableItemProps> = ({ item, onDelete, onLongPress }) => {
  const translateX = useRef(new Animated.Value(0)).current;

  // Set up PanResponder to only trigger on horizontal swipe-left gestures.
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only capture horizontal movements going left (negative dx)
        return gestureState.dx < -15 && Math.abs(gestureState.dy) < 10;
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow swiping to the left
        if (gestureState.dx < 0) {
          translateX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -120) {
          // Swipe threshold exceeded: animate offscreen and call delete handler.
          Animated.timing(translateX, {
            toValue: -500,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            onDelete(item.id);
          });
        } else {
          // Bounce back to original position.
          Animated.spring(translateX, {
            toValue: 0,
            friction: 5,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        // Reset position on gesture cancellation.
        Animated.spring(translateX, {
          toValue: 0,
          friction: 5,
          useNativeDriver: true,
        }).start();
      }
    })
  ).current;

  return (
    <View style={styles.swipeContainer}>
      {/* Background delete action view */}
      <View style={styles.deleteBackground}>
        <Text style={styles.deleteText}>Delete</Text>
      </View>
      
      {/* Foreground container that receives gestures */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.swipeFront,
          { transform: [{ translateX }] }
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onLongPress={() => onLongPress(item)}
          style={styles.itemTouchable}
        >
          <View style={styles.stashInfo}>
            <Text numberOfLines={3} ellipsizeMode="tail" style={styles.stashName}>
              {item.content}
            </Text>
            <Text style={styles.stashTime}>
              {item.updated_at 
                ? `Updated ${new Date(item.updated_at).toLocaleDateString()}`
                : `Created ${new Date(item.created_at).toLocaleDateString()}`}
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

export default function App() {
  // --- UI States ---
  const [searchQuery, setSearchQuery] = useState('');
  
  // Typing Composer Modal States
  const [isComposerVisible, setIsComposerVisible] = useState(false);
  const [composerContent, setComposerContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Detail Sheet Modal States
  const [isDetailVisible, setIsDetailVisible] = useState(false);
  const [detailStash, setDetailStash] = useState<Stash | null>(null);
  const [detailContent, setDetailContent] = useState('');

  // Voice Recording States
  const [isRecording, setIsRecording] = useState(false);
  const pulseScale = useRef(new Animated.Value(1)).current;
  const recordingTimer = useRef<NodeJS.Timeout | null>(null);
  const touchStartTime = useRef<number>(0);

  // Notification Banner States
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [bannerType, setBannerType] = useState<'error' | 'success' | 'info' | null>(null);
  const bannerTimeout = useRef<NodeJS.Timeout | null>(null);

  // Undo Delete Buffer States
  const [undoVisible, setUndoVisible] = useState(false);
  const [lastDeletedStash, setLastDeletedStash] = useState<{ item: Stash; index: number } | null>(null);
  const undoTimeout = useRef<NodeJS.Timeout | null>(null);

  // --- Data States ---
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stashes, setStashes] = useState<Stash[]>([]);

  // Zustand stores device initialization
  const initializeDeviceId = useAppStore(state => state.initializeDeviceId);
  const composerInputRef = useRef<TextInput>(null);

  // Load device and stashes on mount
  useEffect(() => {
    const init = async () => {
      await initializeDeviceId();
      loadStashes();
    };
    init();
    return () => {
      if (bannerTimeout.current) clearTimeout(bannerTimeout.current);
      if (undoTimeout.current) clearTimeout(undoTimeout.current);
      if (recordingTimer.current) clearTimeout(recordingTimer.current);
    };
  }, []);

  // Pulse animation loop during voice recording hold
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseScale, {
            toValue: 1.3,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseScale, {
            toValue: 1.0,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseScale.setValue(1);
    }
  }, [isRecording]);

  // Autofocus the typing composer input when opened
  useEffect(() => {
    if (isComposerVisible) {
      const timer = setTimeout(() => {
        composerInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isComposerVisible]);

  // Dynamic client-side case-insensitive search
  const filteredStashes = stashes
    .filter(stash => stash.content.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Show premium visual feedback banner
  const showBannerMessage = (message: string, type: 'error' | 'success' | 'info' = 'info') => {
    setBannerMessage(message);
    setBannerType(type);
    if (bannerTimeout.current) clearTimeout(bannerTimeout.current);
    bannerTimeout.current = setTimeout(() => {
      setBannerMessage(null);
      setBannerType(null);
    }, 3000);
  };

  // --- API Handlers ---

  const loadStashes = async () => {
    try {
      setIsLoading(true);
      const response = await stashService.getRecentStashes();
      if (response.success) {
        setStashes(response.data);
      } else {
        showBannerMessage("Something went wrong. Please try again.", "error");
      }
    } catch (error) {
      showBannerMessage("Something went wrong. Please try again.", "error");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadStashes();
  };

  // Typing Composer Submission
  const handleComposerSubmit = async () => {
    const content = composerContent.trim();
    if (!content || isSaving) return;

    setIsSaving(true);
    try {
      const response = await stashService.createStash({ content });
      if (response.success) {
        setStashes(prev => [response.data, ...prev]);
        closeComposer();
      } else {
        showBannerMessage("Something went wrong. Please try again.", "error");
      }
    } catch (error) {
      showBannerMessage("Something went wrong. Please try again.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Optimistic Swipe-to-Delete Action
  const handleDeleteStash = async (id: string) => {
    const index = stashes.findIndex(s => s.id === id);
    if (index === -1) return;

    const targetItem = stashes[index];

    // Optimistic UI update: Remove immediately
    const updated = stashes.filter(s => s.id !== id);
    setStashes(updated);

    // Save state for possible Undo action
    setLastDeletedStash({ item: targetItem, index });
    setUndoVisible(true);

    if (undoTimeout.current) clearTimeout(undoTimeout.current);
    undoTimeout.current = setTimeout(() => {
      setUndoVisible(false);
      setLastDeletedStash(null);
    }, 3000);

    try {
      const response = await stashService.deleteStash(id);
      if (!response.success) {
        throw new Error("Failed delete");
      }
    } catch (error) {
      // Revert optimistic delete on server failure
      setStashes(prev => {
        const restored = [...prev];
        restored.splice(index, 0, targetItem);
        return restored;
      });
      setUndoVisible(false);
      setLastDeletedStash(null);
      showBannerMessage("Something went wrong. Please try again.", "error");
    }
  };

  // Restore deleted stash via Undo toast
  const handleUndoDelete = async () => {
    if (!lastDeletedStash) return;

    const { item, index } = lastDeletedStash;

    // Remove Undo layout immediately
    setUndoVisible(false);
    if (undoTimeout.current) clearTimeout(undoTimeout.current);

    // Restore locally first
    setStashes(prev => {
      const restored = [...prev];
      restored.splice(index, 0, item);
      return restored;
    });

    try {
      // Re-create the item on the server
      const response = await stashService.createStash({ content: item.content });
      if (response.success) {
        // Swap temp ID with the newly created backend ID
        setStashes(prev => prev.map(s => s.id === item.id ? response.data : s));
      } else {
        throw new Error("Failed undo recreate");
      }
    } catch (error) {
      showBannerMessage("Something went wrong. Please try again.", "error");
    } finally {
      setLastDeletedStash(null);
    }
  };

  // Detail Sheet Auto-Save Logic on close
  const handleDetailSheetClose = async () => {
    if (!detailStash) {
      setIsDetailVisible(false);
      return;
    }

    const original = detailStash.content.trim();
    const current = detailContent.trim();

    setIsDetailVisible(false);

    // Only update stash when content changes. This prevents unnecessary PATCH requests.
    if (current !== original && current.length > 0) {
      // Update locally immediately
      const updated = stashes.map(s => 
        s.id === detailStash.id ? { ...s, content: current, updated_at: new Date().toISOString() } : s
      );
      setStashes(updated);

      try {
        const response = await stashService.updateStash(detailStash.id, { content: current });
        if (response.success) {
          // Sync final item state from server
          setStashes(prev => prev.map(s => s.id === detailStash.id ? response.data : s));
        } else {
          throw new Error("Update failed");
        }
      } catch (error) {
        // Revert local changes on failure
        loadStashes();
        showBannerMessage("Something went wrong. Please try again.", "error");
      }
    }

    setDetailStash(null);
    setDetailContent('');
  };

  // Gesture Capture Press Action Handlers
  const handleCapturePressIn = () => {
    touchStartTime.current = Date.now();
    if (recordingTimer.current) clearTimeout(recordingTimer.current);

    // Start voice recording state if held past 250ms threshold.
    recordingTimer.current = setTimeout(() => {
      setIsRecording(true);
    }, 250);
  };

  const handleCapturePressOut = () => {
    if (recordingTimer.current) {
      clearTimeout(recordingTimer.current);
      recordingTimer.current = null;
    }

    const duration = Date.now() - touchStartTime.current;

    if (duration < 250) {
      // It's a short tap: Never starts recording. Open typing composer.
      openComposer();
    } else {
      // It's a hold action.
      if (duration < 500) {
        // Cancel rule: Released before 500ms -> Cancel recording, reset UI, send no API request.
        setIsRecording(false);
        showBannerMessage("Recording cancelled", "info");
      } else {
        // Valid hold: Stop recording and trigger speech-to-text submission.
        setIsRecording(false);
        handleVoiceRecordingSubmit();
      }
    }
  };

  const handleVoiceRecordingSubmit = async () => {
    // Select a random realistic physical item for speech-to-text simulation.
    const randomIndex = Math.floor(Math.random() * MOCK_VOICE_STASHES.length);
    const content = MOCK_VOICE_STASHES[randomIndex];

    // Inform the user of transcribed voice input
    showBannerMessage(`Transcribed: "${content}"`, "success");

    try {
      const response = await stashService.createStash({ content });
      if (response.success) {
        setStashes(prev => [response.data, ...prev]);
      } else {
        showBannerMessage("Something went wrong. Please try again.", "error");
      }
    } catch (error) {
      showBannerMessage("Something went wrong. Please try again.", "error");
    }
  };

  // --- Modal Helpers ---

  const openComposer = () => {
    setComposerContent('');
    setIsComposerVisible(true);
  };

  const closeComposer = () => {
    setIsComposerVisible(false);
    setComposerContent('');
    Keyboard.dismiss();
  };

  const openDetailSheet = (stash: Stash) => {
    setDetailStash(stash);
    setDetailContent(stash.content);
    setIsDetailVisible(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ExpoStatusBar style="dark" />

      {/* Title Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Stash</Text>
      </View>

      {/* Error / Notification Banner */}
      {bannerMessage && (
        <View style={[
          styles.banner,
          bannerType === 'error' && styles.bannerError,
          bannerType === 'success' && styles.bannerSuccess,
          bannerType === 'info' && styles.bannerInfo,
        ]}>
          {bannerType === 'error' ? (
            <AlertCircle size={18} color="#FF3B30" style={styles.bannerIcon} />
          ) : (
            <CheckCircle size={18} color={bannerType === 'success' ? '#34C759' : '#007AFF'} style={styles.bannerIcon} />
          )}
          <Text style={[
            styles.bannerText,
            bannerType === 'error' && styles.bannerTextError,
            bannerType === 'success' && styles.bannerTextSuccess,
            bannerType === 'info' && styles.bannerTextInfo,
          ]}>
            {bannerMessage}
          </Text>
        </View>
      )}

      {/* Search Input Box */}
      <View style={styles.searchContainer}>
        <Search size={18} color="#8E8E93" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search stash"
          placeholderTextColor="#8E8E93"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>

      {/* Main Stash List */}
      <View style={styles.listContainer}>
        {isLoading && stashes.length === 0 ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#000" />
          </View>
        ) : (
          <FlatList
            data={filteredStashes}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <SwipeableItem
                item={item}
                onDelete={handleDeleteStash}
                onLongPress={openDetailSheet}
              />
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor="#8E8E93"
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Hold to remember something.</Text>
              </View>
            }
          />
        )}
      </View>

      {/* Floating Undo Delete Action Toast */}
      {undoVisible && (
        <View style={styles.undoToast}>
          <Text style={styles.undoText}>Deleted</Text>
          <TouchableOpacity onPress={handleUndoDelete} style={styles.undoButton}>
            <Text style={styles.undoButtonText}>Undo</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Capture Button: Pressable with Tap vs Hold bindings */}
      <View style={styles.captureContainer}>
        <Pressable
          onPressIn={handleCapturePressIn}
          onPressOut={handleCapturePressOut}
          style={({ pressed }) => [
            styles.captureButton,
            pressed && styles.captureButtonPressed,
            isRecording && styles.captureButtonRecording
          ]}
        >
          {isRecording ? (
            <Mic size={26} color="#FFFFFF" />
          ) : (
            <Plus size={26} color="#FFFFFF" />
          )}
        </Pressable>
      </View>

      {/* Voice Recording Pulse Overlay Screen */}
      {isRecording && (
        <View style={styles.recordingOverlay}>
          <Animated.View style={[
            styles.pulsingCircle,
            { transform: [{ scale: pulseScale }] }
          ]} />
          <View style={styles.recordingCard}>
            <Mic size={42} color="#FF3B30" style={styles.recordingMic} />
            <Text style={styles.recordingText}>Listening...</Text>
            <Text style={styles.recordingSubtext}>Release to save • Let go early to cancel</Text>
          </View>
        </View>
      )}

      {/* Typing Composer Bottom Sheet Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isComposerVisible}
        onRequestClose={closeComposer}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={closeComposer}
        >
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContentWrapper}
          >
            <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
              <View style={styles.sheetHandle} />
              
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Where is it?</Text>
                <TouchableOpacity onPress={closeComposer}>
                  <X size={20} color="#8E8E93" />
                </TouchableOpacity>
              </View>
              
              <TextInput
                ref={composerInputRef}
                style={styles.modalInput}
                placeholder="passport in second drawer"
                placeholderTextColor="#C7C7CC"
                value={composerContent}
                onChangeText={setComposerContent}
                onSubmitEditing={handleComposerSubmit}
                returnKeyType="done"
                autoCorrect={false}
                autoCapitalize="none"
                maxLength={180}
                multiline
              />

              <View style={styles.composerFooter}>
                <Text style={styles.charCounter}>{composerContent.length}/180</Text>
                <TouchableOpacity 
                  style={[styles.saveButton, !composerContent.trim() && styles.saveButtonDisabled]} 
                  onPress={handleComposerSubmit}
                  disabled={!composerContent.trim() || isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* Detail Sheet Bottom Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isDetailVisible}
        onRequestClose={handleDetailSheetClose}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={handleDetailSheetClose}
        >
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContentWrapper}
          >
            <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
              <View style={styles.sheetHandle} />
              
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Stash Detail</Text>
                <TouchableOpacity onPress={handleDetailSheetClose}>
                  <X size={20} color="#8E8E93" />
                </TouchableOpacity>
              </View>
              
              <TextInput
                style={[styles.modalInput, styles.detailInput]}
                placeholder="Content cannot be empty"
                placeholderTextColor="#C7C7CC"
                value={detailContent}
                onChangeText={setDetailContent}
                autoFocus
                autoCorrect={false}
                autoCapitalize="none"
                maxLength={180}
                multiline
              />

              <View style={styles.composerFooter}>
                <Text style={styles.charCounter}>{detailContent.length}/180</Text>
                <Text style={styles.autoSaveLabel}>Auto-saves on close</Text>
              </View>
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
    paddingTop: Platform.OS === 'ios' ? 16 : 40,
    paddingBottom: 8,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.5,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  bannerError: {
    backgroundColor: '#FFF2F2',
    borderColor: '#FFD1D1',
  },
  bannerSuccess: {
    backgroundColor: '#F2FFF5',
    borderColor: '#D1FFD9',
  },
  bannerInfo: {
    backgroundColor: '#F2F8FF',
    borderColor: '#D1E8FF',
  },
  bannerIcon: {
    marginRight: 10,
  },
  bannerText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  bannerTextError: {
    color: '#FF3B30',
  },
  bannerTextSuccess: {
    color: '#34C759',
  },
  bannerTextInfo: {
    color: '#007AFF',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    marginHorizontal: 24,
    paddingHorizontal: 16,
    borderRadius: 12,
    height: 48,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 24,
  },
  listContent: {
    paddingBottom: 120,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeContainer: {
    backgroundColor: '#FF3B30',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  deleteBackground: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 100,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  swipeFront: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  itemTouchable: {
    padding: 18,
    width: '100%',
  },
  stashInfo: {
    flex: 1,
  },
  stashName: {
    fontSize: 16,
    color: '#1A1D20',
    fontWeight: '500',
    lineHeight: 22,
  },
  stashTime: {
    fontSize: 12,
    color: '#ADB5BD',
    marginTop: 8,
    fontWeight: '400',
  },
  captureContainer: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  captureButtonPressed: {
    transform: [{ scale: 0.95 }],
    backgroundColor: '#212529',
  },
  captureButtonRecording: {
    backgroundColor: '#FF3B30',
    transform: [{ scale: 1.1 }],
  },
  recordingOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  pulsingCircle: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 59, 48, 0.25)',
  },
  recordingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
    width: '80%',
  },
  recordingMic: {
    marginBottom: 16,
  },
  recordingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 8,
  },
  recordingSubtext: {
    fontSize: 12,
    color: '#868E96',
    textAlign: 'center',
  },
  undoToast: {
    position: 'absolute',
    bottom: 110,
    left: 24,
    right: 24,
    backgroundColor: '#212529',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 100,
  },
  undoText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
  undoButton: {
    backgroundColor: '#495057',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  undoButtonText: {
    color: '#34C759',
    fontWeight: '600',
    fontSize: 14,
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
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 44 : 24,
  },
  sheetHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#DEE2E6',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1D20',
  },
  modalInput: {
    fontSize: 17,
    color: '#1A1D20',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F5',
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 12,
    lineHeight: 24,
  },
  detailInput: {
    minHeight: 160,
  },
  composerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  charCounter: {
    fontSize: 12,
    color: '#ADB5BD',
  },
  autoSaveLabel: {
    fontSize: 12,
    color: '#34C759',
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#000000',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#E9ECEF',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    paddingTop: 80,
    alignItems: 'center',
  },
  emptyText: {
    color: '#8E8E93',
    fontSize: 15,
    fontWeight: '500',
  },
});
