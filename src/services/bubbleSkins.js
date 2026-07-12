export const BUBBLE_SKINS = {
  default: {
    name: '默认',
    user: { bg: '#95EC69', text: '#000', time: 'rgba(0,0,0,0.4)' },
    ai: { bg: '#fff', text: '#333', time: '#999' },
  },
  warm: {
    name: '暖橙',
    user: { bg: '#FF9A56', text: '#fff', time: 'rgba(255,255,255,0.7)' },
    ai: { bg: '#FFF3E6', text: '#333', time: '#999' },
  },
  ice: {
    name: '冰蓝',
    user: { bg: '#61C7F5', text: '#fff', time: 'rgba(255,255,255,0.7)' },
    ai: { bg: '#E6F6FF', text: '#333', time: '#999' },
  },
  pink: {
    name: '少女粉',
    user: { bg: '#FF85B3', text: '#fff', time: 'rgba(255,255,255,0.7)' },
    ai: { bg: '#FFF0F5', text: '#333', time: '#999' },
  },
  mint: {
    name: '薄荷绿',
    user: { bg: '#5EC4B0', text: '#fff', time: 'rgba(255,255,255,0.7)' },
    ai: { bg: '#E6F9F5', text: '#333', time: '#999' },
  },
  night: {
    name: '暗夜',
    user: { bg: '#4A4A6A', text: '#eee', time: 'rgba(255,255,255,0.4)' },
    ai: { bg: '#2E2E4A', text: '#ddd', time: '#999' },
  },
};

export function getBubbleSkin(skinId) {
  return BUBBLE_SKINS[skinId] || BUBBLE_SKINS.default;
}
