import { View, Text, TouchableOpacity, Image, StyleSheet, Modal, ScrollView, Dimensions, Animated, PanResponder } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMusicPlayer } from '../stores/musicPlayer';
import { getSongUrl } from '../services/netease';
import { useRef, useEffect } from 'react';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BTN_SIZE = 52;

function formatTime(ms) {
  if (!ms || ms < 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export default function MusicPlayer() {
  const insets = useSafeAreaInsets();
  const queue = useMusicPlayer(s => s.queue);
  const currentIndex = useMusicPlayer(s => s.currentIndex);
  const isPlaying = useMusicPlayer(s => s.isPlaying);
  const isVisible = useMusicPlayer(s => s.isVisible);
  const isExpanded = useMusicPlayer(s => s.isExpanded);
  const isLoading = useMusicPlayer(s => s.isLoading);
  const positionMs = useMusicPlayer(s => s.positionMs);
  const durationMs = useMusicPlayer(s => s.durationMs);
  const togglePlay = useMusicPlayer(s => s.togglePlay);
  const setExpanded = useMusicPlayer(s => s.setExpanded);
  const hide = useMusicPlayer(s => s.hide);
  const next = useMusicPlayer(s => s.next);
  const prev = useMusicPlayer(s => s.prev);
  const seekTo = useMusicPlayer(s => s.seekTo);
  const playSong = useMusicPlayer(s => s.playSong);
  const removeFromQueue = useMusicPlayer(s => s.removeFromQueue);

  const currentSong = currentIndex >= 0 && currentIndex < queue.length ? queue[currentIndex] : null;

  const handlePlaySong = async (song) => {
    if (!song.url) {
      const url = await getSongUrl(song.id);
      if (url) {
        song = { ...song, url };
      }
    }
    await playSong(song);
  };

  const progress = durationMs > 0 ? positionMs / durationMs : 0;

  const handleSeek = (evt) => {
    const x = evt.nativeEvent.locationX;
    const barWidth = SCREEN_WIDTH - 80;
    const ratio = Math.max(0, Math.min(1, x / barWidth));
    seekTo(ratio * durationMs);
  };

  useEffect(() => {
    useMusicPlayer.getState().restoreQueue();
  }, []);

  const pan = useRef(new Animated.ValueXY({ x: SCREEN_WIDTH - BTN_SIZE - 16, y: SCREEN_HEIGHT - BTN_SIZE - insets.bottom - 20 })).current;
  const isDragging = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        isDragging.current = false;
        pan.setOffset({
          x: pan.x._value,
          y: pan.y._value,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (_, gesture) => {
        if (Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5) {
          isDragging.current = true;
        }
        Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false })(_, gesture);
      },
      onPanResponderRelease: (_, gesture) => {
        pan.flattenOffset();

        if (!isDragging.current) {
          setExpanded(true);
          return;
        }

        const maxX = SCREEN_WIDTH - BTN_SIZE - 8;
        const maxY = SCREEN_HEIGHT - BTN_SIZE - insets.bottom - 8;
        const minY = insets.top + 8;

        const currentX = Math.max(8, Math.min(maxX, pan.x._value));
        const currentY = Math.max(minY, Math.min(maxY, pan.y._value));

        Animated.spring(pan, {
          toValue: { x: currentX, y: currentY },
          useNativeDriver: false,
          friction: 7,
        }).start();
      },
    })
  ).current;

  if (!isVisible || !currentSong) return null;

  return (
    <>
      {isExpanded ? (
        <Modal visible transparent animationType="slide" onRequestClose={() => setExpanded(false)}>
          <View style={styles.fullContainer}>
            <View style={[styles.fullHeader, { paddingTop: insets.top + 12 }]}>
              <TouchableOpacity onPress={() => setExpanded(false)}>
                <Ionicons name="chevron-down" size={28} color="#333" />
              </TouchableOpacity>
              <Text style={styles.fullTitle}>正在播放</Text>
              <TouchableOpacity onPress={hide}>
                <Ionicons name="close" size={24} color="#999" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
              <View style={styles.coverContainer}>
                <Image
                  source={{ uri: currentSong.cover || 'https://via.placeholder.com/300/4A90D9/fff?text=♫' }}
                  style={styles.coverLarge}
                />
              </View>

              <View style={styles.songInfo}>
                <Text style={styles.songTitle} numberOfLines={1}>{currentSong.name || '未知歌曲'}</Text>
                <Text style={styles.songArtist} numberOfLines={1}>{currentSong.artist || '未知歌手'}</Text>
              </View>

              <TouchableOpacity activeOpacity={1} onPress={handleSeek} style={styles.progressContainer}>
                <View style={styles.progressBg}>
                  <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                </View>
              </TouchableOpacity>

              <View style={styles.timeRow}>
                <Text style={styles.timeText}>{formatTime(positionMs)}</Text>
                <Text style={styles.timeText}>{formatTime(durationMs)}</Text>
              </View>

              <View style={styles.controls}>
                <TouchableOpacity onPress={prev} style={styles.controlBtn}>
                  <Ionicons name="play-skip-back" size={28} color="#666" />
                </TouchableOpacity>
                <TouchableOpacity onPress={togglePlay} style={styles.playBtn}>
                  <Ionicons name={isLoading ? 'hourglass' : isPlaying ? 'pause' : 'play'} size={36} color="#4A90D9" />
                </TouchableOpacity>
                <TouchableOpacity onPress={next} style={styles.controlBtn}>
                  <Ionicons name="play-skip-forward" size={28} color="#666" />
                </TouchableOpacity>
              </View>

              <View style={styles.playlistSection}>
                <Text style={styles.playlistTitle}>播放列表 ({queue.length})</Text>
                {queue.map((item, index) => (
                  <TouchableOpacity
                    key={`${item.id}-${index}`}
                    style={[styles.playlistItem, index === currentIndex && styles.playlistItemActive]}
                    onPress={() => handlePlaySong(item)}
                  >
                    <Image
                      source={{ uri: item.cover || 'https://via.placeholder.com/40/4A90D9/fff?text=♫' }}
                      style={styles.playlistCover}
                    />
                    <View style={styles.playlistInfo}>
                      <Text style={[styles.playlistName, index === currentIndex && styles.playlistNameActive]} numberOfLines={1}>
                        {item.name || '未知歌曲'}
                      </Text>
                      <Text style={styles.playlistArtist} numberOfLines={1}>{item.artist || '未知歌手'}</Text>
                    </View>
                    {index === currentIndex && <Ionicons name="volume-high" size={16} color="#4A90D9" />}
                    <TouchableOpacity onPress={() => removeFromQueue(index)} style={styles.removeBtn}>
                      <Ionicons name="close-circle" size={18} color="#ccc" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </Modal>
      ) : (
        <Animated.View
          style={[styles.floatingBtn, { transform: [{ translateX: pan.x }, { translateY: pan.y }] }]}
          {...panResponder.panHandlers}
        >
          <Image
            source={{ uri: currentSong.cover || 'https://via.placeholder.com/52/4A90D9/fff?text=♫' }}
            style={styles.floatingCover}
          />
          <View style={styles.floatingOverlay}>
            <Ionicons name={isLoading ? 'hourglass-outline' : isPlaying ? 'pause' : 'play'} size={20} color="#4A90D9" />
          </View>
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  floatingBtn: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: BTN_SIZE / 2,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 10,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingCover: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: BTN_SIZE / 2,
  },
  floatingOverlay: {
    position: 'absolute',
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: BTN_SIZE / 2,
    backgroundColor: 'rgba(74,144,217,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  fullContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  fullHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  fullTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  coverContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  coverLarge: {
    width: SCREEN_WIDTH * 0.7,
    height: SCREEN_WIDTH * 0.7,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  songInfo: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: 8,
  },
  songTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  songArtist: {
    fontSize: 15,
    color: '#999',
    marginTop: 4,
  },
  progressContainer: {
    paddingHorizontal: 40,
    marginTop: 24,
  },
  progressBg: {
    height: 4,
    backgroundColor: '#eee',
    borderRadius: 2,
    position: 'relative',
    justifyContent: 'center',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4A90D9',
    borderRadius: 2,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    marginTop: 6,
  },
  timeText: {
    fontSize: 12,
    color: '#999',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    gap: 40,
  },
  controlBtn: {
    padding: 8,
  },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(74,144,217,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playlistSection: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  playlistTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  playlistItemActive: {
    backgroundColor: 'rgba(74,144,217,0.08)',
  },
  playlistCover: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
  },
  playlistInfo: {
    flex: 1,
    marginLeft: 10,
  },
  playlistName: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  playlistNameActive: {
    color: '#4A90D9',
  },
  playlistArtist: {
    fontSize: 12,
    color: '#999',
    marginTop: 1,
  },
  removeBtn: {
    padding: 6,
    marginLeft: 6,
  },
});
