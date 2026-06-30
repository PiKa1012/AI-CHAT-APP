import { getAPISettings } from './settings';
import { trackUsage, extractCachedTokens } from './usage';

const PROVIDER_URLS = {
  openai: 'https://api.openai.com',
  claude: 'https://api.anthropic.com',
  deepseek: 'https://api.deepseek.com',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode',
  wenxin: 'https://aip.baidubce.com',
};

const PROVIDER_MODELS = {
  openai: 'gpt-3.5-turbo',
  claude: 'claude-3-sonnet-20240229',
  deepseek: 'deepseek-chat',
  qwen: 'qwen-turbo',
  wenxin: 'ernie-bot',
};

export function getDefaultBaseUrl(provider) {
  return PROVIDER_URLS[provider] || '';
}

export function getDefaultModel(provider) {
  return PROVIDER_MODELS[provider] || '';
}

async function callClaudeAPI(baseUrl, apiKey, model, messages, systemPrompt) {
  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 500,
      system: systemPrompt || '',
      messages: messages.map(m => ({
        role: m.role === 'system' ? 'user' : m.role,
        content: m.content,
      })),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API错误 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text;
  if (!text) throw new Error('Claude API返回数据格式错误');
  return text;
}

export async function callAIAPI(messages, systemPrompt = '', options = {}) {
  const settings = await getAPISettings();
  if (!settings?.apiKey) {
    throw new Error('未配置API Key，请在设置中配置');
  }

  const provider = settings.provider || 'openai';
  const baseUrl = settings.apiBaseUrl || getDefaultBaseUrl(provider);
  const model = settings.modelName || getDefaultModel(provider);

  if (provider === 'claude') {
    return await callClaudeAPI(baseUrl, settings.apiKey, model, messages, systemPrompt);
  }

  const apiMessages = [];
  if (systemPrompt) {
    apiMessages.push({ role: 'system', content: systemPrompt });
  }
  apiMessages.push(...messages);

  const body = {
    model,
    messages: apiMessages,
    max_tokens: options.max_tokens ?? 500,
    temperature: options.temperature ?? 0.7,
  };

  if (options.tools) {
    body.tools = options.tools;
    body.tool_choice = options.tool_choice || 'auto';
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout ?? 30000);
  let response;
  try {
    response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API错误 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  if (data.usage) {
    trackUsage({
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
      cachedTokens: extractCachedTokens(data.usage),
      model,
      provider: settings.provider || 'unknown',
      endpoint: options.endpoint || 'chat',
    });
  }

  const choice = data.choices?.[0];

  if (options.tools && choice?.finish_reason === 'tool_calls') {
    return {
      content: choice.message?.content || '',
      toolCalls: choice.message?.tool_calls || [],
    };
  }

  const content = choice?.message?.content;
  if (!content) throw new Error('API返回数据格式错误');
  return content;
}

export async function searchWeb(query) {
  const settings = await getAPISettings();
  if (!settings?.enableSearch) return null;

  const response = await fetch('https://api.bochaai.com/v1/web-search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${settings.searchApiKey || ''}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      count: 3,
      summary: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`搜索API错误 (${response.status})`);
  }

  const data = await response.json();
  return data.data?.webPages?.value?.map(r => r.snippet || r.summary).join('\n') || null;
}
