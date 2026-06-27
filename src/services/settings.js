import { executeQuery, executeInsert, executeUpdate } from '../database';

let cachedAPISettings = null;

export async function saveSetting(key, value) {
  const jsonValue = JSON.stringify(value);
  const existing = await executeQuery('SELECT key FROM user_settings WHERE key = ?', [key]);
  
  if (existing.length > 0) {
    await executeUpdate('UPDATE user_settings SET value = ? WHERE key = ?', [jsonValue, key]);
  } else {
    await executeInsert('INSERT INTO user_settings (key, value) VALUES (?, ?)', [key, jsonValue]);
  }

  if (key === 'api_settings') {
    cachedAPISettings = null;
  }
}

export async function loadSetting(key, defaultValue = null) {
  try {
    const result = await executeQuery('SELECT value FROM user_settings WHERE key = ?', [key]);
    if (result.length > 0) {
      return JSON.parse(result[0].value);
    }
  } catch (e) {}
  return defaultValue;
}

export async function deleteSetting(key) {
  await executeUpdate('DELETE FROM user_settings WHERE key = ?', [key]);
  if (key === 'api_settings') {
    cachedAPISettings = null;
  }
}

export async function getAPISettings() {
  if (cachedAPISettings) return cachedAPISettings;
  cachedAPISettings = await loadSetting('api_settings', null);
  return cachedAPISettings;
}

export function clearAPISettingsCache() {
  cachedAPISettings = null;
}
