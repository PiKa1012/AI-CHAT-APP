import { create } from 'zustand';
import { Audio } from 'expo-av';
import { saveSetting, loadSetting } from '../services/settings';
import { getSongUrl } from '../services/netease';

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
  _sound: null,
  _playingLock: false,

  persistQueue: async () => {
    const { queue, currentIndex, playMode } = get();
    await saveSetting('music_queue', { queue, currentIndex, playMode });
  },

  restoreQueue: async () => {
    const data = await loadSetting('music_queue', null);
    if (data && data.queue && data.queue.length > 0) {
      set({ queue: data.queue, currentIndex: data.currentIndex ?? -1, playMode: data.playMode || 'order', isVisible: false });
    }
  },

  cleanup: async () => {
    const { _sound } = get();
    if (_sound) {
      try { await _sound.unloadAsync(); } catch (e) { console.warn('卸载音频失败:', e?.message); }
      set({ _sound: null });
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

    let url = song.url;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await Audio.Sound.createAsync(
          { uri: url },
          { shouldPlay: true, progressUpdateIntervalMillis: 500 }
        );
        const newSound = result.sound;
        set({ _sound: newSound });

        newSound.setOnPlaybackStatusUpdate((status) => {
          if (!status.isLoaded) return;
          set({
            positionMs: status.positionMillis,
            durationMs: status.durationMillis || 0,
            isPlaying: status.isPlaying,
          });
          if (status.didJustFinish) {
            const { playMode, _sound } = get();
            if (playMode === 'loop') {
              _sound?.setPositionAsync(0);
              _sound?.playAsync();
            } else {
              get().next();
            }
          }
        });

        if (url !== song.url) {
          const { queue } = get();
          const updatedQueue = [...queue];
          if (updatedQueue[index]) {
            updatedQueue[index] = { ...updatedQueue[index], url };
            set({ queue: updatedQueue });
          }
        }

        set({ isPlaying: true, isLoading: false, isVisible: true });
        return;
      } catch (e) {
        if (attempt === 0) {
          const newUrl = await getSongUrl(song.id);
          if (newUrl && newUrl !== url) {
            url = newUrl;
            await get().cleanup();
            continue;
          }
        }
        console.error('播放失败:', e);
        set({ isLoading: false });
        return;
      }
    }
  },

  playSong: async (song) => {
    const { _playingLock } = get();
    if (_playingLock) return;
    set({ _playingLock: true });
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });
    } catch (e) {
      console.warn('设置音频模式失败:', e?.message);
    }

    try {
      const { queue, _sound } = get();
      const existingIndex = queue.findIndex(s => s.id === song.id);

      if (existingIndex >= 0) {
        if (existingIndex === get().currentIndex && _sound) {
          await _sound.playAsync();
          set({ isPlaying: true });
        } else {
          await get().playFromIndex(existingIndex);
        }
      } else {
        const newQueue = [...queue, song];
        set({ queue: newQueue });
        await get().playFromIndex(newQueue.length - 1);
      }

      await get().persistQueue();
    } finally {
      set({ _playingLock: false });
    }
  },

  togglePlay: async () => {
    const { isPlaying, _sound } = get();
    if (!_sound) return;
    try {
      if (isPlaying) {
        await _sound.pauseAsync();
        set({ isPlaying: false });
      } else {
        await _sound.playAsync();
        set({ isPlaying: true });
      }
    } catch (e) {
      console.warn('播放音频失败:', e?.message);
    }
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
    const { _sound } = get();
    if (_sound) {
      try { await _sound.setPositionAsync(positionMs); } catch (e) { console.warn('设置音频位置失败:', e?.message); }
    }
  },

  removeFromQueue: async (index) => {
    const { queue, currentIndex } = get();
    const newQueue = queue.filter((_, i) => i !== index);
    set({ queue: newQueue });
    if (index === currentIndex) {
      await get().cleanup();
      set({ currentIndex: -1, isPlaying: false, isVisible: newQueue.length > 0 });
    } else if (index < currentIndex) {
      set({ currentIndex: currentIndex - 1 });
    }
    await get().persistQueue();
  },

  setExpanded: (expanded) => set({ isExpanded: expanded }),
  setVisible: (visible) => set({ isVisible: visible }),
  setPlayMode: async (mode) => {
    set({ playMode: mode });
    await get().persistQueue();
  },

  hide: async () => {
    await get().cleanup();
    set({ isVisible: false, isExpanded: false, isPlaying: false, positionMs: 0, durationMs: 0 });
  },
}));
