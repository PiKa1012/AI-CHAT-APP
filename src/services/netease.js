import { loadSetting } from './settings';

const DEFAULT_BASE_URL = 'https://netease-cloud-music-api-xxx.vercel.app';

async function getBaseUrl() {
  const settings = await loadSetting('api_settings', {});
  return settings.neteaseApiBaseUrl || DEFAULT_BASE_URL;
}

function fetchWithTimeout(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timeout));
}

export async function searchSongs(keyword, limit = 5) {
  const baseUrl = await getBaseUrl();
  const response = await fetchWithTimeout(
    `${baseUrl}/search?keywords=${encodeURIComponent(keyword)}&limit=${limit}&randomCNIP=true`
  );
  if (!response.ok) throw new Error(`搜索失败: ${response.status}`);
  const data = await response.json();
  const songs = (data.result?.songs || []).map(song => ({
    id: song.id,
    name: song.name,
    artist: (song.artists || []).map(a => a.name).join(' / '),
    album: song.album?.name || '',
    cover: '',
    duration: song.duration || 0,
  }));

  if (songs.length > 0) {
    try {
      const details = await getSongDetail(songs.map(s => s.id));
      if (details.length > 0) {
        const detailMap = {};
        details.forEach(d => { detailMap[d.id] = d; });
        songs.forEach(s => {
          if (detailMap[s.id]) {
            s.cover = detailMap[s.id].cover;
            if (!s.artist) s.artist = detailMap[s.id].artist;
          }
        });
      }
    } catch (e) {
      console.warn('获取歌曲详情失败，使用默认封面:', e.message);
    }
  }

  return songs;
}

export async function getSongUrl(id) {
  const baseUrl = await getBaseUrl();
  const response = await fetchWithTimeout(
    `${baseUrl}/song/url?id=${id}&level=standard&randomCNIP=true`
  );
  if (!response.ok) throw new Error(`获取播放链接失败: ${response.status}`);
  const data = await response.json();
  return data.data?.[0]?.url || null;
}

export async function getSongDetail(ids) {
  const baseUrl = await getBaseUrl();
  const idStr = Array.isArray(ids) ? ids.join(',') : ids;
  const response = await fetchWithTimeout(
    `${baseUrl}/song/detail?ids=${idStr}&randomCNIP=true`
  );
  if (!response.ok) throw new Error(`获取歌曲详情失败: ${response.status}`);
  const data = await response.json();
  return (data.songs || []).map(song => ({
    id: song.id,
    name: song.name,
    artist: (song.ar || []).map(a => a.name).join(' / '),
    album: song.al?.name || '',
    cover: song.al?.picUrl || '',
    duration: song.dt || 0,
  }));
}

export async function testConnection() {
  const baseUrl = await getBaseUrl();
  const response = await fetchWithTimeout(`${baseUrl}/search?keywords=test&limit=1&randomCNIP=true`);
  return response.ok;
}

export function extractMusicKeyword(text) {
  const patterns = [
    /^(?:听|我想听|来一首|放一首|点一首|放|搜一下|搜歌|搜音乐|找歌|找音乐)\s*(.+)/,
    /^我想听[一一下]?\s*(.+)/,
    /^[给]我[放来]?\s*(.+)/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1].trim()) {
      return match[1].trim();
    }
  }
  return null;
}
