import { create } from 'zustand';
import { getDatabase, executeQuery, executeInsert, executeUpdate } from '../database';

export const useAppStore = create((set, get) => ({
  user: null,
  aiCharacters: [],
  conversations: [],
  currentConversation: null,
  messages: [],
  moments: [],
  scheduledTasks: [],

  setUser: (user) => set({ user }),

  loadAICharacters: async () => {
    const characters = await executeQuery('SELECT * FROM ai_characters WHERE is_active = 1');
    set({ aiCharacters: characters });
  },

  addAICharacter: async (character) => {
    const maxIdResult = await executeQuery('SELECT COALESCE(MAX(id), 9999) + 1 as nextId FROM ai_characters');
    const nextId = Math.max(maxIdResult[0]?.nextId || 10000, 10000);
    const id = await executeInsert(
      `INSERT INTO ai_characters (id, name, avatar, personality, description, voice_id, age, gender, background, likes, speaking_style, relationship, greeting, signature) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [nextId, character.name, character.avatar, character.personality, character.description, character.voice_id,
       character.age, character.gender, character.background, character.likes, character.speaking_style, 
       character.relationship, character.greeting, character.signature]
    );
    const newCharacter = { id: nextId, ...character, is_active: 1 };
    set((state) => ({ aiCharacters: [...state.aiCharacters, newCharacter] }));
    return nextId;
  },

  updateAICharacter: async (id, updates) => {
    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    await executeUpdate(`UPDATE ai_characters SET ${fields} WHERE id = ?`, [...Object.values(updates), id]);
    set((state) => ({
      aiCharacters: state.aiCharacters.map(c => c.id === id ? { ...c, ...updates } : c)
    }));
  },

  deleteAICharacter: async (id) => {
    await executeUpdate('UPDATE ai_characters SET is_active = 0 WHERE id = ?', [id]);
    set((state) => ({
      aiCharacters: state.aiCharacters.filter(c => c.id !== id)
    }));
  },

  loadConversations: async () => {
    const conversations = await executeQuery(`
      SELECT c.*, 
        (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT message_type FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_type,
        (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_time
      FROM conversations c
      ORDER BY last_message_time DESC
    `);
    set({ conversations });
  },

  createConversation: async (type, name, memberIds) => {
    const id = await executeInsert(
      'INSERT INTO conversations (type, name) VALUES (?, ?)',
      [type, name]
    );
    for (const memberId of memberIds) {
      await executeInsert(
        'INSERT INTO conversation_members (conversation_id, member_type, member_id) VALUES (?, ?, ?)',
        [id, 'ai', memberId]
      );
    }
    await get().loadConversations();
    return id;
  },

  deleteConversation: async (conversationId) => {
    await executeUpdate('DELETE FROM messages WHERE conversation_id = ?', [conversationId]);
    await executeUpdate('DELETE FROM conversation_members WHERE conversation_id = ?', [conversationId]);
    await executeUpdate('DELETE FROM conversations WHERE id = ?', [conversationId]);
    set((state) => ({
      conversations: state.conversations.filter(c => c.id !== conversationId),
      currentConversation: state.currentConversation?.id === conversationId ? null : state.currentConversation,
    }));
  },

  clearConversationMessages: async (conversationId) => {
    await executeUpdate('DELETE FROM messages WHERE conversation_id = ?', [conversationId]);
    set((state) => ({
      messages: state.messages.filter(m => m.conversation_id !== conversationId),
    }));
    await get().loadConversations();
  },

  clearAllMessages: async () => {
    await executeUpdate('DELETE FROM messages');
    set({ messages: [] });
    await get().loadConversations();
  },

  clearAllMoments: async () => {
    await executeUpdate('DELETE FROM moment_comments');
    await executeUpdate('DELETE FROM moments');
    set({ moments: [] });
  },

  clearAllDiaries: async () => {
    await executeUpdate('DELETE FROM diary_comments');
    await executeUpdate('DELETE FROM diaries');
  },

  clearAllData: async () => {
    await executeUpdate('DELETE FROM messages');
    await executeUpdate('DELETE FROM moment_comments');
    await executeUpdate('DELETE FROM moments');
    await executeUpdate('DELETE FROM diary_comments');
    await executeUpdate('DELETE FROM diaries');
    await executeUpdate('DELETE FROM ai_memories');
    await executeUpdate('DELETE FROM scheduled_tasks');
    await executeUpdate('DELETE FROM notifications');
    await executeUpdate('DELETE FROM conversation_members');
    await executeUpdate('DELETE FROM conversations');
    set({ messages: [], moments: [], conversations: [], currentConversation: null });
    await get().loadAICharacters();
    await get().loadConversations();
    await get().loadScheduledTasks();
  },



  getStorageInfo: async () => {
    const messageCount = await executeQuery('SELECT COUNT(*) as count FROM messages');
    const conversationCount = await executeQuery('SELECT COUNT(*) as count FROM conversations');
    const momentCount = await executeQuery('SELECT COUNT(*) as count FROM moments');
    const diaryCount = await executeQuery('SELECT COUNT(*) as count FROM diaries');
    const aiCount = await executeQuery('SELECT COUNT(*) as count FROM ai_characters WHERE is_active = 1');

    return {
      messages: messageCount[0]?.count || 0,
      conversations: conversationCount[0]?.count || 0,
      moments: momentCount[0]?.count || 0,
      diaries: diaryCount[0]?.count || 0,
      aiCharacters: aiCount[0]?.count || 0,
    };
  },

  updateConversation: async (conversationId, updates) => {
    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    await executeUpdate(`UPDATE conversations SET ${fields} WHERE id = ?`, [...Object.values(updates), conversationId]);
    set((state) => ({
      conversations: state.conversations.map(c => c.id === conversationId ? { ...c, ...updates } : c)
    }));
  },

  setCurrentConversation: (conversation) => set({ currentConversation: conversation }),

  loadMessages: async (conversationId, limit = 50, offset = 0) => {
    const messages = await executeQuery(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [conversationId, limit, offset]
    );
    if (offset === 0) {
      set({ messages: messages.reverse() });
    } else {
      set((state) => ({ messages: [...messages.reverse(), ...state.messages] }));
    }
    return messages.length;
  },

  loadMoreMessages: async (conversationId) => {
    const currentMessages = get().messages;
    if (currentMessages.length === 0) return 0;
    
    const oldestMessage = currentMessages[0];
    const moreMessages = await executeQuery(
      'SELECT * FROM messages WHERE conversation_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT 50',
      [conversationId, oldestMessage.created_at]
    );
    
    if (moreMessages.length > 0) {
      set((state) => ({ messages: [...moreMessages.reverse(), ...state.messages] }));
    }
    return moreMessages.length;
  },

  searchMessages: async (conversationId, keyword) => {
    return await executeQuery(
      `SELECT m.*, 
        CASE 
          WHEN m.sender_type = 'user' THEN '我'
          ELSE (SELECT name FROM ai_characters WHERE id = m.sender_id)
        END as sender_name
       FROM messages m 
       WHERE m.conversation_id = ? AND m.content LIKE ? 
       ORDER BY m.created_at DESC 
       LIMIT 100`,
      [conversationId, `%${keyword}%`]
    );
  },

  searchAllMessages: async (keyword) => {
    return await executeQuery(
      `SELECT m.*, c.name as conversation_name, c.type as conversation_type,
        CASE 
          WHEN m.sender_type = 'user' THEN '我'
          ELSE (SELECT name FROM ai_characters WHERE id = m.sender_id)
        END as sender_name
       FROM messages m 
       JOIN conversations c ON m.conversation_id = c.id
       WHERE m.content LIKE ? 
       ORDER BY m.created_at DESC 
       LIMIT 200`,
      [`%${keyword}%`]
    );
  },

  getMessagesByDate: async (conversationId, date) => {
    return await executeQuery(
      `SELECT * FROM messages 
       WHERE conversation_id = ? AND date(datetime(created_at, '+8 hours')) = ? 
       ORDER BY created_at ASC`,
      [conversationId, date]
    );
  },

  getMessageDates: async (conversationId) => {
    return await executeQuery(
      `SELECT DISTINCT date(datetime(created_at, '+8 hours')) as date, COUNT(*) as count 
       FROM messages 
       WHERE conversation_id = ? 
       GROUP BY date(datetime(created_at, '+8 hours')) 
       ORDER BY date DESC`,
      [conversationId]
    );
  },

  markConversationAsRead: async (conversationId) => {
    await executeUpdate(
      'UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND is_read = 0',
      [conversationId]
    );
  },

  sendMessage: async (conversationId, senderType, senderId, content, messageType = 'text', mediaUrl = null) => {
    const now = new Date();
    const utcStr = now.toISOString();
    const id = await executeInsert(
      'INSERT INTO messages (conversation_id, sender_type, sender_id, content, message_type, media_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [conversationId, senderType, senderId, content, messageType, mediaUrl, utcStr]
    );
    const message = { id, conversation_id: conversationId, sender_type: senderType, sender_id: senderId, content, message_type: messageType, media_url: mediaUrl, is_read: 0, created_at: utcStr };
    set((state) => ({ messages: [...state.messages, message] }));
    set((state) => ({
      conversations: state.conversations.map(c =>
        c.id === conversationId
          ? { ...c, last_message: content, last_message_type: messageType, last_message_time: utcStr }
          : c
      )
    }));
    return id;
  },

  loadMoments: async () => {
    const moments = await executeQuery('SELECT * FROM moments ORDER BY created_at DESC');
    if (moments.length > 0) {
      const ids = moments.map(m => m.id);
      const placeholders = ids.map(() => '?').join(',');
      const comments = await executeQuery(
        `SELECT * FROM moment_comments WHERE moment_id IN (${placeholders}) ORDER BY created_at ASC`,
        ids
      );
      const commentsByMoment = {};
      for (const comment of comments) {
        if (!commentsByMoment[comment.moment_id]) commentsByMoment[comment.moment_id] = [];
        commentsByMoment[comment.moment_id].push(comment);
      }
      for (let moment of moments) {
        moment.comments = commentsByMoment[moment.id] || [];
        moment.likes = JSON.parse(moment.likes || '[]');
        moment.images = JSON.parse(moment.images || '[]');
      }
    }
    set({ moments });
  },

  addMoment: async (authorType, authorId, content, images = []) => {
    const id = await executeInsert(
      'INSERT INTO moments (author_type, author_id, content, images) VALUES (?, ?, ?, ?)',
      [authorType, authorId, content, JSON.stringify(images)]
    );
    const [moment] = await executeQuery('SELECT * FROM moments WHERE id = ?', [id]);
    if (moment) {
      moment.comments = [];
      moment.likes = JSON.parse(moment.likes || '[]');
      moment.images = JSON.parse(moment.images || '[]');
    }
    set((state) => ({
      moments: moment ? [moment, ...state.moments] : state.moments,
    }));
    return id;
  },

  deleteMoment: async (momentId) => {
    await executeUpdate('DELETE FROM moment_comments WHERE moment_id = ?', [momentId]);
    await executeUpdate('DELETE FROM moments WHERE id = ?', [momentId]);
    set((state) => ({
      moments: state.moments.filter(m => m.id !== momentId),
    }));
  },

  commentOnMoment: async (momentId, authorType, authorId, content, parentId = null) => {
    const id = await executeInsert(
      'INSERT INTO moment_comments (moment_id, author_type, author_id, content, parent_id) VALUES (?, ?, ?, ?, ?)',
      [momentId, authorType, authorId, content, parentId]
    );
    const [comment] = await executeQuery('SELECT * FROM moment_comments WHERE id = ?', [id]);
    set((state) => ({
      moments: state.moments.map((m) =>
        m.id === momentId ? { ...m, comments: [...m.comments, comment] } : m
      ),
    }));
    return id;
  },

  deleteComment: async (commentId, momentId = null) => {
    if (momentId === null) {
      const [parent] = await executeQuery('SELECT moment_id FROM moment_comments WHERE id = ?', [commentId]);
      momentId = parent?.moment_id;
    }
    const childComments = await executeQuery('SELECT id FROM moment_comments WHERE parent_id = ?', [commentId]);
    for (const child of childComments) {
      await get().deleteComment(child.id, momentId);
    }
    await executeUpdate('DELETE FROM moment_comments WHERE id = ?', [commentId]);
    if (momentId) {
      set((state) => ({
        moments: state.moments.map((m) =>
          m.id === momentId
            ? { ...m, comments: m.comments.filter((c) => c.id !== commentId) }
            : m
        ),
      }));
    }
  },

  likeMoment: async (momentId, userId) => {
    const moments = await executeQuery('SELECT likes FROM moments WHERE id = ?', [momentId]);
    if (moments.length > 0) {
      let likes = JSON.parse(moments[0].likes || '[]');
      if (likes.includes(userId)) {
        likes = likes.filter(id => id !== userId);
      } else {
        likes.push(userId);
      }
      await executeUpdate('UPDATE moments SET likes = ? WHERE id = ?', [JSON.stringify(likes), momentId]);
      set((state) => ({
        moments: state.moments.map((m) =>
          m.id === momentId ? { ...m, likes } : m
        ),
      }));
    }
  },

  loadScheduledTasks: async () => {
    const tasks = await executeQuery('SELECT * FROM scheduled_tasks WHERE is_active = 1');
    set({ scheduledTasks: tasks });
  },

  addScheduledTask: async (task) => {
    const id = await executeInsert(
      'INSERT INTO scheduled_tasks (ai_id, task_type, content, schedule_time, repeat_type, execute_date) VALUES (?, ?, ?, ?, ?, ?)',
      [task.ai_id, task.task_type, task.content, task.schedule_time, task.repeat_type || 'daily', task.execute_date || null]
    );
    await get().loadScheduledTasks();
    return id;
  },

  deleteScheduledTask: async (id) => {
    await executeUpdate('UPDATE scheduled_tasks SET is_active = 0 WHERE id = ?', [id]);
    set((state) => ({
      scheduledTasks: state.scheduledTasks.filter(t => t.id !== id)
    }));
  },

  exportData: async () => {
    const data = {
      user: get().user,
      aiCharacters: await executeQuery('SELECT * FROM ai_characters'),
      conversations: await executeQuery('SELECT * FROM conversations'),
      conversationMembers: await executeQuery('SELECT * FROM conversation_members'),
      messages: await executeQuery('SELECT * FROM messages'),
      moments: await executeQuery('SELECT * FROM moments'),
      momentComments: await executeQuery('SELECT * FROM moment_comments'),
      aiMemories: await executeQuery('SELECT * FROM ai_memories'),
      scheduledTasks: await executeQuery('SELECT * FROM scheduled_tasks'),
    };
    return JSON.stringify(data, null, 2);
  },

  importData: async (jsonString) => {
    const data = JSON.parse(jsonString);
    const database = await getDatabase();
    
    if (data.user) {
      set({ user: data.user });
    }
    
    await database.withTransactionAsync(async () => {
      await executeUpdate('DELETE FROM moment_comments');
      await executeUpdate('DELETE FROM moments');
      await executeUpdate('DELETE FROM messages');
      await executeUpdate('DELETE FROM conversation_members');
      await executeUpdate('DELETE FROM conversations');
      await executeUpdate('DELETE FROM ai_memories');
      await executeUpdate('DELETE FROM scheduled_tasks');
      await executeUpdate('DELETE FROM ai_characters');

      for (const char of data.aiCharacters || []) {
        await executeInsert(
          'INSERT INTO ai_characters (id, name, avatar, personality, description, voice_id, age, gender, background, likes, speaking_style, relationship, greeting, signature, coverBg, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [char.id, char.name, char.avatar, char.personality, char.description, char.voice_id, char.age, char.gender, char.background, char.likes, char.speaking_style, char.relationship, char.greeting, char.signature, char.coverBg, char.is_active]
        );
      }
      for (const conv of data.conversations || []) {
        await executeInsert(
          'INSERT INTO conversations (id, type, name, avatar) VALUES (?, ?, ?, ?)',
          [conv.id, conv.type, conv.name, conv.avatar]
        );
      }
      for (const msg of data.messages || []) {
        await executeInsert(
          'INSERT INTO messages (id, conversation_id, sender_type, sender_id, content, message_type, media_url, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [msg.id, msg.conversation_id, msg.sender_type, msg.sender_id, msg.content, msg.message_type, msg.media_url, msg.is_read, msg.created_at]
        );
      }
      for (const moment of data.moments || []) {
        await executeInsert(
          'INSERT INTO moments (id, author_type, author_id, content, images, likes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [moment.id, moment.author_type, moment.author_id, moment.content, moment.images, moment.likes, moment.created_at]
        );
      }
      for (const comment of data.momentComments || []) {
        await executeInsert(
          'INSERT INTO moment_comments (id, moment_id, author_type, author_id, content, parent_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [comment.id, comment.moment_id, comment.author_type, comment.author_id, comment.content, comment.parent_id, comment.created_at]
        );
      }
      for (const task of data.scheduledTasks || []) {
        await executeInsert(
          'INSERT INTO scheduled_tasks (id, ai_id, task_type, content, schedule_time, repeat_type, execute_date, executed_count, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [task.id, task.ai_id, task.task_type, task.content, task.schedule_time, task.repeat_type, task.execute_date, task.executed_count, task.is_active, task.created_at]
        );
      }
      for (const memory of data.aiMemories || []) {
        await executeInsert(
          'INSERT INTO ai_memories (id, ai_id, memory_type, content, importance, context, last_accessed, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [memory.id, memory.ai_id, memory.memory_type, memory.content, memory.importance, memory.context, memory.last_accessed, memory.created_at]
        );
      }
      for (const member of data.conversationMembers || []) {
        await executeInsert(
          'INSERT INTO conversation_members (id, conversation_id, member_type, member_id, joined_at) VALUES (?, ?, ?, ?, ?)',
          [member.id, member.conversation_id, member.member_type, member.member_id, member.joined_at]
        );
      }
    });

    await get().loadAICharacters();
    await get().loadConversations();
    await get().loadMoments();
    await get().loadScheduledTasks();
  }
}));
