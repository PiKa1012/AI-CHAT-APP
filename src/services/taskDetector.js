import { getAPISettings } from './settings';
import { createScheduledTask } from './scheduler';

export async function detectAndCreateTask(aiId, userMessage) {
  const settings = await getAPISettings();
  if (!settings?.apiKey) return null;

  const prompt = `分析用户消息，判断是否要创建定时任务。

用户消息："${userMessage}"

如果是定时任务，输出JSON：
{
  "is_task": true,
  "task_type": "post_moment" 或 "write_diary" 或 "send_message",
  "schedule_time": "HH:MM格式",
  "content": "任务描述（可选）"
}

任务类型说明：
- post_moment: 发朋友圈
- write_diary: 写日记
- send_message: 发消息

如果不是定时任务，输出：
{
  "is_task": false
}

只输出JSON，不要其他文字。`;

  try {
    const provider = settings.provider || 'openai';
    const baseUrl = settings.apiBaseUrl || getDefaultBaseUrl(provider);
    const model = settings.modelName || getDefaultModel(provider);

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.1,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      
      if (result.is_task && result.schedule_time) {
        const taskId = await createScheduledTask(
          aiId,
          result.task_type || 'send_message',
          result.content || '',
          result.schedule_time
        );
        
        return {
          created: true,
          taskType: result.task_type,
          scheduleTime: result.schedule_time,
          taskId,
        };
      }
    }
  } catch (error) {
    console.error('检测定时任务失败:', error);
  }
  
  return null;
}

function getDefaultBaseUrl(provider) {
  const urls = {
    openai: 'https://api.openai.com',
    deepseek: 'https://api.deepseek.com',
    qwen: 'https://dashscope.aliyuncs.com/compatible-mode',
  };
  return urls[provider] || 'https://api.openai.com';
}

function getDefaultModel(provider) {
  const models = {
    openai: 'gpt-3.5-turbo',
    deepseek: 'deepseek-chat',
    qwen: 'qwen-turbo',
  };
  return models[provider] || 'gpt-3.5-turbo';
}

export function getTaskTypeName(taskType) {
  const names = {
    'post_moment': '发朋友圈',
    'write_diary': '写日记',
    'send_message': '发消息',
  };
  return names[taskType] || '任务';
}
