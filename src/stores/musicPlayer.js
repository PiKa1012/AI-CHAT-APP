import { create } from 'zustand';
import { Audio } from 'expo-av';
import { saveSetting, loadSetting } from '../services/settings';

let sound = null;
let isPlayingLock = false;

function getNextIndex(queue, currentIndex, playMode) {
  if (queue.length === 0) return -1;
  if (playMode === 'shuffle') {
    if (queue.length === 1) return 0;
    let next = currentIndex;
    while (next === currentIndex) {
      next = Math.floor(Math.random() * queue.length);
    }
    return next;
  }
  if (currentIndex < queue.length - 1) return currentIndex + 1;
  return -1;
}

export const useMusicPlayer = create((set, get) => ({
  queue: [],
  currentIndex: -1,
  isPlaying: false,
  isExpanded: false,
  isVisible: false,
  isLoading: false,
  positionMs: 0,
  durationMs: 0,
  playMode: 'order',

  persistQueue: async () => {
    const { queue, currentIndex, playMode } = get();
    await saveSetting('music_queue', { queue, currentIndex, playMode });
  },

  restoreQueue: async () => {
    const data = await loadSetting('music_queue', null);
    if (data && data.queue && data.queue.length > 0) {
      set({ queue: data.queue, currentIndex: data.currentIndex ?? -1, playMode: data.playMode || 'order', isVisible: true });
    }
  },

  cleanup: async () => {
    if (sound) {
      try { await sound.unloadAsync(); } catch (e) {}
      sound = null;
    }
    set({ positionMs: 0, durationMs: 0 });
  },

  playFromIndex: async (index) => {
    const { queue } = get();
    if (index < 0 || index >= queue.length) return;
    const song = queue[index];
    if (!song.url) return;

    set({ currentIndex: index, isLoading: true });
    await get().cleanup();

    try {
      const result = await Audio.Sound.createAsync(
        { uri: song.url },
        { shouldPlay: true, progressUpdateIntervalMillis: 500 }
      );
      sound = result.sound;

      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        set({
          positionMs: status.positionMillis,
          durationMs: status.durationMillis || 0,
          isPlaying: status.isPlaying,
        });
        if (status.didJustFinish) {
          const { playMode } = get();
          if (playMode === 'loop') {
            sound?.setPositionAsync(0);
            sound?.playAsync();
          } else {
            get().next();
          }
        }
      });

      set({ isPlaying: true, isLoading: false, isVisible: true });
    } catch (e) {
      console.error('播放失败:', e);
      set({ isLoading: false });
    }
  },

  playSong: async (song) => {
    if (isPlayingLock) return;
    isPlayingLock = true;
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });
    } catch (e) {}

    const { queue } = get();
    const existingIndex = queue.findIndex(s => s.id === song.id);

    if (existingIndex >= 0) {
      if (existingIndex === get().currentIndex && sound) {
        await sound.playAsync();
        set({ isPlaying: true });
      } else {
        await get().playFromIndex(existingIndex);
      }
    } else {
      const newQueue = [...queue, song];
      set({ queue: newQueue });
      await get().playFromIndex(newQueue.length - 1);
    }
    isPlayingLock = false;
    await get().persistQueue();
  },

  togglePlay: async () => {
    const { isPlaying } = get();
    if (!sound) return;
    try {
      if (isPlaying) {
        await sound.pauseAsync();
        set({ isPlaying: false });
      } else {
        await sound.playAsync();
        set({ isPlaying: true });
      }
    } catch (e) {}
  },

  next: async () => {
    const { queue, currentIndex, playMode } = get();
    const nextIndex = getNextIndex(queue, currentIndex, playMode);
    if (nextIndex >= 0) {
      await get().playFromIndex(nextIndex);
    }
  },

  prev: async () => {
    const { queue, currentIndex } = get();
    if (currentIndex > 0) {
      await get().playFromIndex(currentIndex - 1);
    }
  },

  seekTo: async (positionMs) => {
    if (sound) {
      try { await sound.setPositionAsync(positionMs); } catch (e) {}
    }
  },

  removeFromQueue: async (index) => {
    const { queue, currentIndex } = get();
    const newQueue = queue.filter((_, i) => i !== index);
    set({ queue: newQueue });
    if (index === currentIndex) {
      get().cleanup();
      set({ currentIndex: -1, isPlaying: false, isVisible: newQueue.length > 0 });
    } else if (index < currentIndex) {
      set({ currentIndex: currentIndex - 1 });
    }
    await get().persistQueue();
  },

  setExpanded: (expanded) => set({ isExpanded: expanded }),
  setVisible: (visible) => set({ isVisible: visible }),
  setPlayMode: (mode) => {
    set({ playMode: mode });
    get().persistQueue();
  },

  hide: async () => {
    await get().cleanup();
    set({ isVisible: false, isExpanded: false, isPlaying: false, positionMs: 0, durationMs: 0 });
  },
}));
