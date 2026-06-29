import * as SQLite from 'expo-sqlite';

let db = null;

export async function getDatabase() {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('ai_companion.db');
  await initDatabase(db);
  return db;
}

async function initDatabase(database) {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      avatar TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ai_characters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      avatar TEXT,
      personality TEXT,
      description TEXT,
      voice_id TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      age INTEGER,
      gender TEXT,
      background TEXT,
      likes TEXT,
      speaking_style TEXT,
      relationship TEXT,
      greeting TEXT
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL DEFAULT 'private',
      name TEXT,
      avatar TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS conversation_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      member_type TEXT NOT NULL,
      member_id INTEGER NOT NULL,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      sender_type TEXT NOT NULL,
      sender_id INTEGER NOT NULL,
      content TEXT,
      message_type TEXT DEFAULT 'text',
      media_url TEXT,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    );

    CREATE TABLE IF NOT EXISTS moments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_type TEXT NOT NULL,
      author_id INTEGER NOT NULL,
      content TEXT,
      images TEXT,
      likes TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS moment_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      moment_id INTEGER NOT NULL,
      author_type TEXT NOT NULL,
      author_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      parent_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (moment_id) REFERENCES moments(id),
      FOREIGN KEY (parent_id) REFERENCES moment_comments(id)
    );

    CREATE TABLE IF NOT EXISTS ai_memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ai_id INTEGER NOT NULL,
      memory_type TEXT NOT NULL,
      content TEXT NOT NULL,
      importance INTEGER DEFAULT 5,
      context TEXT,
      last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ai_id) REFERENCES ai_characters(id)
    );

    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ai_id INTEGER,
      task_type TEXT NOT NULL,
      content TEXT,
      schedule_time TEXT,
      repeat_type TEXT DEFAULT 'daily',
      execute_date TEXT,
      executed_count INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ai_id) REFERENCES ai_characters(id)
    );

    CREATE TABLE IF NOT EXISTS emoji_packs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      cover_image TEXT,
      mood_tag TEXT DEFAULT 'general',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS custom_emojis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pack_id INTEGER NOT NULL,
      image_uri TEXT NOT NULL,
      name TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pack_id) REFERENCES emoji_packs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS diaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ai_id INTEGER NOT NULL,
      title TEXT,
      content TEXT NOT NULL,
      mood TEXT,
      weather TEXT,
      tags TEXT DEFAULT '[]',
      images TEXT DEFAULT '[]',
      is_public INTEGER DEFAULT 0,
      created_at DATE DEFAULT (date('now')),
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ai_id) REFERENCES ai_characters(id)
    );

    CREATE TABLE IF NOT EXISTS diary_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      diary_id INTEGER NOT NULL,
      author_type TEXT NOT NULL,
      author_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (diary_id) REFERENCES diaries(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ai_moods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ai_id INTEGER NOT NULL UNIQUE,
      mood TEXT DEFAULT 'calm',
      energy INTEGER DEFAULT 50,
      affection INTEGER DEFAULT 50,
      stress INTEGER DEFAULT 20,
      confidence INTEGER DEFAULT 50,
      last_update DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ai_id) REFERENCES ai_characters(id)
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT,
      type TEXT,
      data TEXT,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS api_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prompt_tokens INTEGER DEFAULT 0,
      completion_tokens INTEGER DEFAULT 0,
      total_tokens INTEGER DEFAULT 0,
      model TEXT,
      provider TEXT,
      endpoint TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export async function executeQuery(sql, params = []) {
  const database = await getDatabase();
  return await database.getAllAsync(sql, params);
}

export async function executeInsert(sql, params = []) {
  const database = await getDatabase();
  const result = await database.runAsync(sql, params);
  return result.lastInsertRowId;
}

export async function executeUpdate(sql, params = []) {
  const database = await getDatabase();
  return await database.runAsync(sql, params);
}
