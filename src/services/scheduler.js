import { executeQuery, executeInsert, executeUpdate } from '../database';
import { useAppStore } from '../stores';
import { aiAutoPostMoment, aiAutoChat, getPersonalityPrompt, callAIAPI } from './ai';
import { sendLocalNotification } from './notification';
import { generateDiary } from './diary';
import { generateProactiveMessage } from './proactive';
import { getBeijingNow } from '../utils/time';
import { saveSetting, loadSetting } from './settings';
import * as Notifications from 'expo-notifications';

let schedulerInterval = null;
let lastAutoPostCheck = null;
let lastAutoDiaryCheck = null;
const executedTaskIds = new Set();

export function startScheduler() {
  if (schedulerInterval) return;

  schedulerInterval = setInterval(async () => {
    await checkAutoPostSettings();
    await checkDueScheduledTasks();
  }, 60000);

  checkAutoPostSettings();
  checkDueScheduledTasks();
  syncScheduledTasksToNotifications();
}

export function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}

export async function syncScheduledTasksToNotifications() {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of scheduled) {
      if (notification.identifier.startsWith('scheduled_task_')) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }

    const tasks = await executeQuery('SELECT * FROM scheduled_tasks WHERE is_active = 1');
    
    for (const task of tasks) {
      if (!task.schedule_time || !task.schedule_time.includes(':')) continue;

      const [hours, minutes] = task.schedule_time.split(':').map(Number);
      
      let taskName = '';
      switch (task.task_type) {
        case 'post_moment': taskName = '发朋友圈'; break;
        case 'write_diary': taskName = '写日记'; break;
        case 'send_message': taskName = task.content || '发消息'; break;
        case 'auto_chat': taskName = '群聊发言'; break;
        default: taskName = '执行任务';
      }

      await Notifications.scheduleNotificationAsync({
        identifier: `scheduled_task_${task.id}`,
        content: {
          title: '定时任务',
          body: taskName,
          data: { taskId: task.id, taskType: task.task_type },
        },
        trigger: {
          type: 'daily',
          hour: hours,
          minute: minutes,
        },
      });
    }
  } catch (error) {
    console.error('同步定时任务失败:', error);
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

async function checkDueScheduledTasks() {
  try {
    if (executedTaskIds.size > 1000) {
      executedTaskIds.clear();
    }

    const now = getBeijingNow();
    const currentTime = `${now.hours.toString().padStart(2, '0')}:${now.minutes.toString().padStart(2, '0')}`;
    const today = `${now.year}-${now.month.toString().padStart(2, '0')}-${now.day.toString().padStart(2, '0')}`;

    const tasks = await executeQuery('SELECT * FROM scheduled_tasks WHERE is_active = 1');

    for (const task of tasks) {
      const taskKey = `${task.id}_${today}`;
      if (executedTaskIds.has(taskKey)) continue;

      if (task.schedule_time !== currentTime) continue;

      if (task.repeat_type === 'once' && task.execute_date !== today) continue;

      executedTaskIds.add(taskKey);
      await executeTask(task);

      if (task.repeat_type === 'once') {
        await executeUpdate('UPDATE scheduled_tasks SET is_active = 0, executed_count = executed_count + 1 WHERE id = ?', [task.id]);
      } else {
        await executeUpdate('UPDATE scheduled_tasks SET executed_count = executed_count + 1 WHERE id = ?', [task.id]);
      }
    }
  } catch (error) {
    console.error('检查定时任务失败:', error);
  }
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
}

export async function executeScheduledTask(taskId) {
  const now = getBeijingNow();
  const today = `${now.year}-${now.month.toString().padStart(2, '0')}-${now.day.toString().padStart(2, '0')}`;
  const taskKey = `${taskId}_${today}`;
  if (executedTaskIds.has(taskKey)) return;
  executedTaskIds.add(taskKey);

  const tasks = await executeQuery('SELECT * FROM scheduled_tasks WHERE id = ? AND is_active = 1', [taskId]);
  if (tasks.length === 0) return;

  const task = tasks[0];
  await executeTask(task);

  if (task.repeat_type === 'once') {
    await executeUpdate('UPDATE scheduled_tasks SET is_active = 0, executed_count = executed_count + 1 WHERE id = ?', [taskId]);
  } else {
    await executeUpdate('UPDATE scheduled_tasks SET executed_count = executed_count + 1 WHERE id = ?', [taskId]);
  }
}

async function autoPostMoment() {
  try {
    const ais = await executeQuery('SELECT * FROM ai_characters WHERE is_active = 1');
    if (ais.length === 0) return;

    const randomAI = ais[Math.floor(Math.random() * ais.length)];
    await aiAutoPostMoment(randomAI.id);
  } catch (error) {
    console.error('发朋友圈失败:', error.message || error);
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
        console.error(`生成日记失败 (${ai.name}):`, e.message || e);
      }
    }
  } catch (error) {
    console.error('写日记失败:', error.message || error);
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
        console.warn('未知任务类型:', task.task_type);
        break;
    }
  } catch (error) {
    console.error(`Task execution failed (${task.task_type}):`, error.message || error);
  }
}

async function executePostMoment(task) {
  try {
    let ai;
    if (task.ai_id) {
      const ais = await executeQuery('SELECT * FROM ai_characters WHERE id = ? AND is_active = 1', [task.ai_id]);
      if (ais.length > 0) ai = ais[0];
    }
    
    if (!ai) {
      const ais = await executeQuery('SELECT * FROM ai_characters WHERE is_active = 1');
      if (ais.length === 0) return;
      ai = ais[Math.floor(Math.random() * ais.length)];
    }

    await aiAutoPostMoment(ai.id);
  } catch (error) {
    console.error('发朋友圈任务失败:', error.message || error);
  }
}

async function executeAutoChat(task) {
  try {
    if (task.ai_id) {
      const conversationId = task.content ? parseInt(task.content) : null;
      if (conversationId) {
        const ai = await executeQuery('SELECT * FROM ai_characters WHERE id = ? AND is_active = 1', [task.ai_id]);
        if (ai.length > 0) {
          const prompt = getPersonalityPrompt(ai[0]) + '\n在群里说一句话，要自然，像普通聊天。只输出内容。';
          const content = await callAIAPI([{ role: 'user', content: '在群里说句话' }], prompt);
          const store = useAppStore.getState();
          await store.sendMessage(conversationId, 'ai', task.ai_id, content);
          
          await sendLocalNotification(
            '群聊新消息',
            `${ai[0].name}: ${content}`,
            { type: 'group_chat' }
          );
          return;
        }
      }
    }
    
    await aiAutoChat();

    await sendLocalNotification(
      '群聊有新消息',
      'AI们在群里聊天了',
      { type: 'group_chat' }
    );
  } catch (error) {
    console.error('群聊任务失败:', error.message || error);
  }
}

async function executeSendMessage(task) {
  if (!task.ai_id) return;

  try {
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

    let message;
    if (task.content) {
      const prompt = getPersonalityPrompt(ai[0]) + `\n用户设置了提醒：${task.content}\n请用自然的方式提醒用户，可以适当扩展内容。只输出消息内容。`;
      message = await callAIAPI([{ role: 'user', content: '提醒用户' }], prompt);
    } else {
      message = await generateProactiveMessage(task.ai_id);
    }

    const store = useAppStore.getState();
    await store.sendMessage(conversations[0].id, 'ai', task.ai_id, message);

    await sendLocalNotification(
      ai[0].name,
      message,
      { type: 'message', conversationId: conversations[0].id }
    );
  } catch (error) {
    console.error('发送消息任务失败:', error.message || error);
  }
}

async function executeWriteDiary(task) {
  try {
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
        console.error(`生成日记失败 (${ai.name}):`, e.message || e);
      }
    }
  } catch (error) {
    console.error('写日记任务失败:', error.message || error);
  }
}

export async function createScheduledTask(aiId, taskType, content, scheduleTime, repeatType = 'daily', executeDate = null) {
  const id = await executeInsert(
    'INSERT INTO scheduled_tasks (ai_id, task_type, content, schedule_time, repeat_type, execute_date) VALUES (?, ?, ?, ?, ?, ?)',
    [aiId, taskType, content, scheduleTime, repeatType, executeDate]
  );
  
  await syncScheduledTasksToNotifications();
  
  return id;
}

export async function updateScheduledTask(id, updates) {
  const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  await executeUpdate(`UPDATE scheduled_tasks SET ${fields} WHERE id = ?`, [...Object.values(updates), id]);
  await syncScheduledTasksToNotifications();
}

export async function deleteScheduledTask(id) {
  await executeUpdate('UPDATE scheduled_tasks SET is_active = 0 WHERE id = ?', [id]);
  await syncScheduledTasksToNotifications();
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
