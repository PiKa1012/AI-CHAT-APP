import { executeInsert, executeQuery } from '../database';

export async function trackUsage({ promptTokens = 0, completionTokens = 0, totalTokens = 0, model = '', provider = '', endpoint = '' }) {
  try {
    await executeInsert(
      `INSERT INTO api_usage (prompt_tokens, completion_tokens, total_tokens, model, provider, endpoint)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [promptTokens, completionTokens, totalTokens, model, provider, endpoint]
    );
  } catch (e) {
    console.warn('Failed to track usage:', e);
  }
}

export async function getUsageStats() {
  const total = await executeQuery(
    `SELECT
       COALESCE(SUM(total_tokens), 0) as total_tokens,
       COALESCE(SUM(prompt_tokens), 0) as total_prompt,
       COALESCE(SUM(completion_tokens), 0) as total_completion,
       COUNT(*) as total_calls,
       COALESCE(MAX(provider), '') as last_provider
     FROM api_usage`
  );

  const today = await executeQuery(
    `SELECT
       COALESCE(SUM(total_tokens), 0) as total_tokens,
       COUNT(*) as total_calls
     FROM api_usage
     WHERE date(created_at) = date('now')`
  );

  const todayTotal = today[0]?.total_tokens || 0;
  const todayCalls = today[0]?.total_calls || 0;
  const totalObj = total[0] || { total_tokens: 0, total_prompt: 0, total_completion: 0, total_calls: 0, last_provider: '' };

  return {
    todayTokens: todayTotal,
    todayCalls,
    totalTokens: totalObj.total_tokens,
    totalPrompt: totalObj.total_prompt,
    totalCompletion: totalObj.total_completion,
    totalCalls: totalObj.total_calls,
    provider: totalObj.last_provider || 'unknown',
    estimatedCost: estimateCost(totalObj.total_tokens, totalObj.last_provider),
  };
}

const PRICING = {
  deepseek: { input: 0.5, output: 2, currency: 'USD', label: 'DeepSeek' },
  openai: { input: 2.5, output: 10, currency: 'USD', label: 'OpenAI GPT-4o' },
  qwen: { input: 0.3, output: 0.6, currency: 'CNY', label: '通义千问' },
  wenxin: { input: 0.3, output: 0.6, currency: 'CNY', label: '文心一言' },
  claude: { input: 3, output: 15, currency: 'USD', label: 'Claude 3 Sonnet' },
};

function estimateCost(totalTokens, provider) {
  const price = PRICING[provider];
  if (!price) return null;
  const avgCostPer1M = (price.input + price.output) / 2;
  return {
    amount: ((totalTokens / 1000000) * avgCostPer1M).toFixed(4),
    currency: price.currency,
    label: price.label,
  };
}

export async function getBalance(provider, apiKey) {
  if (provider === 'deepseek') {
    return await getDeepSeekBalance(apiKey);
  }
  return null;
}

export function formatBalanceInfo(provider, raw) {
  if (!raw) return null;
  if (provider === 'deepseek') {
    const available = raw.balance_infos?.filter(b => b.total_balance !== '0.00') || [];
    const total = available.reduce((s, b) => s + parseFloat(b.total_balance || '0'), 0);
    return {
      total: total.toFixed(2),
      currency: raw.balance_infos?.[0]?.currency || 'CNY',
      label: '可用余额',
      details: available,
    };
  }
  return null;
}

const DEEPSEEK_BALANCE_URL = 'https://api.deepseek.com/user/balance';

async function getDeepSeekBalance(apiKey) {
  if (!apiKey) return null;
  try {
    const res = await fetch(DEEPSEEK_BALANCE_URL, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}
