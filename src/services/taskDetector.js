import { getAPISettings } from './settings';
import { createScheduledTask } from './scheduler';
import { getBeijingNow } from '../utils/time';
import { callAIAPI } from './api-client';

export async function detectAndCreateTask(aiId, userMessage) {
  const settings = await getAPISettings();
  if (!settings?.apiKey) return null;

  const now = getBeijingNow();
  const currentTime = `${now.hours.toString().padStart(2, '0')}:${now.minutes.toString().padStart(2, '0')}`;
  const currentDate = `${now.year}-${now.month.toString().padStart(2, '0')}-${now.day.toString().padStart(2, '0')}`;

  const prompt = `分析用户消息，判断是否要创建定时任务或提醒。

当前时间：${currentDate} ${currentTime}

用户消息："${userMessage}"

如果是定时任务/提醒，输出JSON：
{
  "is_task": true,
  "task_type": "post_moment" 或 "write_diary" 或 "send_message",
  "schedule_time": "HH:MM格式（24小时制）",
  "repeat_type": "daily" 或 "once",
  "execute_date": "YYYY-MM-DD格式",
  "content": "任务描述"
}

判断规则：
1. repeat_type 判断：
   - 用户说"两分钟后"、"一会儿"、"等下"、"下午"、"明天"等具体时间 → "once"
   - 用户说"每天"、"每日"、"每晚"、"每天早上"等重复词 → "daily"
   - 没有明确说"每天"的一律是 "once"

2. schedule_time 计算：
   - "两分钟后" → 根据当前时间+2分钟
   - "下午3点" → 15:00
   - "明天早上8点" → 08:00（execute_date设为明天）

3. task_type：
   - "提醒我xxx"、"叫我xxx" → send_message
   - "发朋友圈" → post_moment
   - "写日记" → write_diary

4. execute_date：
   - once类型必须填写具体日期
   - daily类型填今天的日期

示例：
- "两分钟后提醒我吃饭" → {is_task:true, task_type:"send_message", schedule_time:"当前时间+2分钟", repeat_type:"once", execute_date:"今天日期", content:"该吃饭了"}
- "每天晚上10点写日记" → {is_task:true, task_type:"write_diary", schedule_time:"22:00", repeat_type:"daily", execute_date:"今天日期", content:"写日记"}

如果不是定时任务，输出：
{
  "is_task": false
}

只输出JSON，不要其他文字。`;

  try {
    const content = await callAIAPI(
      [{ role: 'user', content: prompt }],
      '',
      { max_tokens: 300, temperature: 0.1, endpoint: 'task_detector' }
    );
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      
      if (result.is_task && result.schedule_time) {
        const taskId = await createScheduledTask(
          aiId,
          result.task_type || 'send_message',
          result.content || userMessage,
          result.schedule_time,
          result.repeat_type || 'once',
          result.execute_date || currentDate
        );
        
        return {
          created: true,
          taskType: result.task_type,
          scheduleTime: result.schedule_time,
          repeatType: result.repeat_type || 'once',
          executeDate: result.execute_date || currentDate,
          taskId,
        };
      }
    }
  } catch (error) {
    console.warn('检测定时任务超时，跳过');
  }
  
  return null;
}

export function getTaskTypeName(taskType) {
  const names = {
    'post_moment': '发朋友圈',
    'write_diary': '写日记',
    'send_message': '发消息',
  };
  return names[taskType] || '任务';
}
