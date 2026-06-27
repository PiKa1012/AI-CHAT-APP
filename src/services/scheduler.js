import { executeQuery, executeInsert, executeUpdate } from '../database';
import { useAppStore } from '../stores';
import { aiAutoPostMoment, aiAutoChat } from './ai';
import { sendLocalNotification } from './notification';
import { generateDiary } from './diary';
import { generateProactiveMessage } from './proactive';
import { getBeijingNow } from '../utils/time';
import { saveSetting, loadSetting } from './settings';

let schedulerInterval = null;
let lastAutoPostCheck = null;
let lastAutoDiaryCheck = null;

export function startScheduler() {
  if (schedulerInterval) return;

  schedulerInterval = setInterval(async () => {
    await checkAndExecuteTasks();
    await checkAutoPostSettings();
  }, 60000);

  checkAndExecuteTasks();
  checkAutoPostSettings();
}

export function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}

async function getAutoPostSettings() {
  try {
    return await loadSetting('auto_post_settings', {
      autoMomentEnabled: false,
      autoMomentInterval: 4,
      autoDiaryEnabled: false,
      autoDiaryTime: '22:00',
      autoGroupChatEnabled: false,
      autoGroupChatInterval: 6,
    });
  } catch (e) {}
  return {
    autoMomentEnabled: false,
    autoMomentInterval: 4,
    autoDiaryEnabled: false,
    autoDiaryTime: '22:00',
    autoGroupChatEnabled: false,
    autoGroupChatInterval: 6,
  };
}

async function checkAutoPostSettings() {
  const settings = await getAutoPostSettings();
  const now = getBeijingNow();
  const currentHour = now.hours;
  const currentMinute = now.minutes;

  if (settings.autoMomentEnabled) {
    const lastPost = lastAutoPostCheck ? new Date(lastAutoPostCheck) : null;
    const hoursSinceLastPost = lastPost ? (Date.now() - lastPost.getTime()) / (1000 * 60 * 60) : Infinity;
    
    if (hoursSinceLastPost >= settings.autoMomentInterval) {
      const startHour = 8;
      const endHour = 23;
      if (currentHour >= startHour && currentHour < endHour) {
        await autoPostMoment();
        lastAutoPostCheck = new Date().toISOString();
      }
    }
  }

  if (settings.autoDiaryEnabled) {
    const [targetHour, targetMinute] = settings.autoDiaryTime.split(':').map(Number);
    const lastDiary = lastAutoDiaryCheck ? new Date(lastAutoDiaryCheck) : null;
    const isNewDay = !lastDiary || lastDiary.toDateString() !== now.toDateString();
    
    if (isNewDay && currentHour === targetHour && currentMinute >= targetMinute && currentMinute < targetMinute + 5) {
      await autoWriteDiary();
      lastAutoDiaryCheck = new Date().toISOString();
    }
  }

  if (settings.autoGroupChatEnabled) {
    // Group chat auto-posting is handled by scheduled tasks
  }
}

async function autoPostMoment() {
  try {
    const ais = await executeQuery('SELECT * FROM ai_characters WHERE is_active = 1');
    if (ais.length === 0) return;

    const randomAI = ais[Math.floor(Math.random() * ais.length)];
    await aiAutoPostMoment(randomAI.id);

    await sendLocalNotification(
      '朋友圈更新',
      `${randomAI.name} 发了一条新朋友圈`,
      { type: 'moment', aiId: randomAI.id }
    );
  } catch (error) {
    console.error('Auto post moment failed:', error);
  }
}

async function autoWriteDiary() {
  try {
    const ais = await executeQuery('SELECT * FROM ai_characters WHERE is_active = 1');
    for (const ai of ais) {
      try {
        const diary = await generateDiary(ai.id);
        await sendLocalNotification(
          '新日记',
          `${ai.name}写了一篇日记：${diary.title}`,
          { type: 'diary', aiId: ai.id }
        );
      } catch (e) {
        console.error(`生成日记失败 (${ai.name}):`, e);
      }
    }
  } catch (error) {
    console.error('Auto write diary failed:', error);
  }
}

async function checkAndExecuteTasks() {
  const now = getBeijingNow();
  const currentHour = now.hours;
  const currentMinute = now.minutes;
  const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;

  const tasks = await executeQuery(
    'SELECT * FROM scheduled_tasks WHERE is_active = 1 AND schedule_time = ?',
    [currentTime]
  );

  for (const task of tasks) {
    await executeTask(task);
  }
}

async function executeTask(task) {
  try {
    switch (task.task_type) {
      case 'post_moment':
        await executePostMoment(task);
        break;
      case 'auto_chat':
        await executeAutoChat(task);
        break;
      case 'send_message':
        await executeSendMessage(task);
        break;
      case 'write_diary':
        await executeWriteDiary(task);
        break;
      default:
        break;
    }
  } catch (error) {
    console.error('Task execution failed:', error);
  }
}

async function executePostMoment(task) {
  const ais = await executeQuery('SELECT * FROM ai_characters WHERE is_active = 1');
  if (ais.length === 0) return;

  const randomAI = ais[Math.floor(Math.random() * ais.length)];
  await aiAutoPostMoment(randomAI.id);

  await sendLocalNotification(
    '朋友圈更新',
    `${randomAI.name} 发了一条新朋友圈`,
    { type: 'moment', aiId: randomAI.id }
  );
}

async function executeAutoChat(task) {
  await aiAutoChat();

  await sendLocalNotification(
    '群聊有新消息',
    'AI们在群里聊天了',
    { type: 'group_chat' }
  );
}

async function executeSendMessage(task) {
  if (!task.ai_id) return;

  const conversations = await executeQuery(
    `SELECT c.* FROM conversations c
     JOIN conversation_members cm ON c.id = cm.conversation_id
     WHERE cm.member_id = ? AND c.type = 'private'
     LIMIT 1`,
    [task.ai_id]
  );

  if (conversations.length === 0) return;

  const ai = await executeQuery('SELECT * FROM ai_characters WHERE id = ?', [task.ai_id]);
  if (ai.length === 0) return;

  const message = await generateProactiveMessage(task.ai_id);

  const store = useAppStore.getState();
  await store.sendMessage(conversations[0].id, 'ai', task.ai_id, message);

  await sendLocalNotification(
    ai[0].name,
    message,
    { type: 'message', conversationId: conversations[0].id }
  );
}

async function executeWriteDiary(task) {
  const ais = task.ai_id 
    ? await executeQuery('SELECT * FROM ai_characters WHERE id = ? AND is_active = 1', [task.ai_id])
    : await executeQuery('SELECT * FROM ai_characters WHERE is_active = 1');

  for (const ai of ais) {
    try {
      const diary = await generateDiary(ai.id);
      await sendLocalNotification(
        '新日记',
        `${ai.name}写了一篇日记：${diary.title}`,
        { type: 'diary', aiId: ai.id }
      );
    } catch (e) {
      console.error(`生成日记失败 (${ai.name}):`, e);
    }
  }
}

export async function createScheduledTask(aiId, taskType, content, scheduleTime) {
  const id = await executeInsert(
    'INSERT INTO scheduled_tasks (ai_id, task_type, content, schedule_time) VALUES (?, ?, ?, ?)',
    [aiId, taskType, content, scheduleTime]
  );
  return id;
}

export async function updateScheduledTask(id, updates) {
  const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  await executeUpdate(`UPDATE scheduled_tasks SET ${fields} WHERE id = ?`, [...Object.values(updates), id]);
}

export async function deleteScheduledTask(id) {
  await executeUpdate('UPDATE scheduled_tasks SET is_active = 0 WHERE id = ?', [id]);
}

export async function getScheduledTasks() {
  return await executeQuery('SELECT * FROM scheduled_tasks WHERE is_active = 1 ORDER BY schedule_time');
}

export async function getAIScheduledTasks(aiId) {
  return await executeQuery(
    'SELECT * FROM scheduled_tasks WHERE ai_id = ? AND is_active = 1 ORDER BY schedule_time',
    [aiId]
  );
}

export async function saveAutoPostSettings(settings) {
  await saveSetting('auto_post_settings', settings);
}

export async function getAutoPostSettingsExport() {
  return await getAutoPostSettings();
}
