import { executeQuery, executeInsert, executeUpdate } from '../database';
import * as FileSystem from 'expo-file-system';
import { copyToAppStorage, pickImageFromGallery, pickMultipleImagesFromGallery } from './media';

export { pickImageFromGallery as pickImage, pickMultipleImagesFromGallery as pickMultipleImages };

export const MOOD_TAGS = [
  { id: 'happy', name: '开心', icon: '😊' },
  { id: 'sad', name: '难过', icon: '😢' },
  { id: 'angry', name: '生气', icon: '😠' },
  { id: 'shy', name: '害羞', icon: '😳' },
  { id: 'love', name: '喜欢', icon: '🥰' },
  { id: 'excited', name: '兴奋', icon: '🤩' },
  { id: 'calm', name: '平静', icon: '😌' },
  { id: 'funny', name: '搞笑', icon: '😂' },
  { id: 'general', name: '通用', icon: '👍' },
];

export async function getEmojiPacks() {
  return await executeQuery('SELECT * FROM emoji_packs ORDER BY created_at DESC');
}

export async function createEmojiPack(name, moodTag = 'general') {
  return await executeInsert(
    'INSERT INTO emoji_packs (name, mood_tag) VALUES (?, ?)',
    [name, moodTag]
  );
}

export async function updateEmojiPackMood(packId, moodTag) {
  await executeUpdate('UPDATE emoji_packs SET mood_tag = ? WHERE id = ?', [moodTag, packId]);
}

export async function deleteEmojiPack(packId) {
  const emojis = await getPackEmojis(packId);
  for (const emoji of emojis) {
    try {
      await FileSystem.deleteAsync(emoji.image_uri, { idempotent: true });
    } catch (e) {}
  }
  await executeUpdate('DELETE FROM emoji_packs WHERE id = ?', [packId]);
}

export async function getPackEmojis(packId) {
  return await executeQuery(
    'SELECT * FROM custom_emojis WHERE pack_id = ? ORDER BY sort_order ASC',
    [packId]
  );
}

export async function getAllEmojis() {
  return await executeQuery(`
    SELECT ce.*, ep.name as pack_name, ep.mood_tag
    FROM custom_emojis ce
    JOIN emoji_packs ep ON ce.pack_id = ep.id
    ORDER BY ep.name, ce.sort_order ASC
  `);
}

export async function getEmojiByMood(mood) {
  const packs = await executeQuery(
    'SELECT * FROM emoji_packs WHERE mood_tag = ?',
    [mood]
  );
  
  if (packs.length === 0) {
    const generalPacks = await executeQuery(
      'SELECT * FROM emoji_packs WHERE mood_tag = ?',
      ['general']
    );
    if (generalPacks.length === 0) return null;
    
    const randomPack = generalPacks[Math.floor(Math.random() * generalPacks.length)];
    const emojis = await getPackEmojis(randomPack.id);
    if (emojis.length === 0) return null;
    return emojis[Math.floor(Math.random() * emojis.length)].image_uri;
  }

  const randomPack = packs[Math.floor(Math.random() * packs.length)];
  const emojis = await getPackEmojis(randomPack.id);
  if (emojis.length === 0) return null;
  return emojis[Math.floor(Math.random() * emojis.length)].image_uri;
}

export async function addEmojiToPack(packId, imageUri, name = '') {
  const localUri = await copyToAppStorage(imageUri, 'emojis');
  if (!localUri) return null;
  
  const maxOrder = await executeQuery(
    'SELECT MAX(sort_order) as max_order FROM custom_emojis WHERE pack_id = ?',
    [packId]
  );
  const nextOrder = (maxOrder[0]?.max_order || 0) + 1;
  
  return await executeInsert(
    'INSERT INTO custom_emojis (pack_id, image_uri, name, sort_order) VALUES (?, ?, ?, ?)',
    [packId, localUri, name, nextOrder]
  );
}

export async function deleteEmoji(emojiId) {
  const emoji = await executeQuery('SELECT * FROM custom_emojis WHERE id = ?', [emojiId]);
  if (emoji.length > 0) {
    try {
      await FileSystem.deleteAsync(emoji[0].image_uri, { idempotent: true });
    } catch (e) {}
    await executeUpdate('DELETE FROM custom_emojis WHERE id = ?', [emojiId]);
  }
}
