import { getAPISettings } from './settings';
import { trackUsage, extractCachedTokens } from './usage';

const PROVIDER_URLS = {
  openai: 'https://api.openai.com',
  deepseek: 'https://api.deepseek.com',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode',
};

const PROVIDER_MODELS = {
  openai: 'gpt-3.5-turbo',
  deepseek: 'deepseek-chat',
  qwen: 'qwen-turbo',
};

export function getDefaultBaseUrl(provider) {
  return PROVIDER_URLS[provider] || '';
}

export function getDefaultModel(provider) {
  return PROVIDER_MODELS[provider] || '';
}

export async function callAIAPI(messages, systemPrompt = '', options = {}) {
  const settings = await getAPISettings();
  if (!settings?.apiKey) {
    throw new Error('未配置API Key，请在设置中配置');
  }

  const provider = settings.provider || 'openai';
  const baseUrl = settings.apiBaseUrl || getDefaultBaseUrl(provider);
  const model = settings.modelName || getDefaultModel(provider);

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

  let content = choice?.message?.content;
  if (!content) {
    if (choice?.finish_reason === 'tool_calls') {
      return '';
    }
    content = choice?.message?.reasoning_content || '';
    if (!content) {
      throw new Error('API返回数据格式错误');
    }
  }
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
      count: 8,
      summary: true,

    }),
  });

  if (!response.ok) {
    throw new Error(`搜索API错误 (${response.status})`);
  }

  const data = await response.json();
  const results = data.data?.webPages?.value;
  if (!results || results.length === 0) return null;
  return results.map((r, i) =>
    `[${i + 1}] ${r.name}\n${r.summary || r.snippet}\n来源: ${r.url}`
  ).join('\n\n');
}
