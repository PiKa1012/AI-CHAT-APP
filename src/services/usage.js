import { executeInsert, executeQuery } from '../database';

export function extractCachedTokens(usage) {
  if (!usage) return 0;
  if (usage.prompt_tokens_details?.cached_tokens) return usage.prompt_tokens_details.cached_tokens;
  if (usage.prompt_cache_hit_tokens) return usage.prompt_cache_hit_tokens;
  return 0;
}

export async function trackUsage({ promptTokens = 0, completionTokens = 0, totalTokens = 0, cachedTokens = 0, model = '', provider = '', endpoint = '' }) {
  try {
    await executeInsert(
      `INSERT INTO api_usage (prompt_tokens, completion_tokens, total_tokens, cached_tokens, model, provider, endpoint)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [promptTokens, completionTokens, totalTokens, cachedTokens, model, provider, endpoint]
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
       COALESCE(SUM(cached_tokens), 0) as total_cached,
       COUNT(*) as total_calls
     FROM api_usage`
  );

  const today = await executeQuery(
    `SELECT
       COALESCE(SUM(total_tokens), 0) as total_tokens,
       COALESCE(SUM(prompt_tokens), 0) as total_prompt,
       COALESCE(SUM(completion_tokens), 0) as total_completion,
       COALESCE(SUM(cached_tokens), 0) as total_cached,
       COUNT(*) as total_calls
     FROM api_usage
     WHERE date(created_at) = date('now')`
  );

  const lastRecord = await executeQuery(
    `SELECT provider, model FROM api_usage ORDER BY id DESC LIMIT 1`
  );

  const dailyStats = await executeQuery(
    `SELECT
       date(created_at) as day,
       SUM(total_tokens) as total_tokens,
       SUM(prompt_tokens) as total_prompt,
       SUM(completion_tokens) as total_completion,
       SUM(cached_tokens) as total_cached,
       COUNT(*) as calls
     FROM api_usage
     GROUP BY date(created_at)
     ORDER BY day DESC
     LIMIT 30`
  );

  const t = total[0] || {};
  const d = today[0] || {};
  const provider = lastRecord[0]?.provider || '';

  return {
    hasData: t.total_calls > 0,
    provider,
    model: lastRecord[0]?.model || '',
    todayTokens: d.total_tokens || 0,
    todayPrompt: d.total_prompt || 0,
    todayCompletion: d.total_completion || 0,
    todayCached: d.total_cached || 0,
    todayCalls: d.total_calls || 0,
    totalTokens: t.total_tokens || 0,
    totalPrompt: t.total_prompt || 0,
    totalCompletion: t.total_completion || 0,
    totalCached: t.total_cached || 0,
    totalCalls: t.total_calls || 0,
    dailyStats: (dailyStats || []).map(row => ({
      day: row.day,
      prompt: row.total_prompt || 0,
      completion: row.total_completion || 0,
      cached: row.total_cached || 0,
      calls: row.calls || 0,
    })),
    estimatedCost: estimateDeepSeekCost(t.total_prompt || 0, t.total_completion || 0, t.total_cached || 0),
    todayCost: estimateDeepSeekCost(d.total_prompt || 0, d.total_completion || 0, d.total_cached || 0),
  };
}

// DeepSeek V4 Flash 定价 (¥/1M tokens)
const DS_PRICES = {
  cacheHit: 0.02,
  cacheMiss: 1,
  output: 2,
};

function estimateDeepSeekCost(promptTokens, completionTokens, cachedTokens) {
  const cacheMissTokens = Math.max(0, promptTokens - cachedTokens);
  const cost = (cachedTokens * DS_PRICES.cacheHit + cacheMissTokens * DS_PRICES.cacheMiss + completionTokens * DS_PRICES.output) / 1000000;
  return { amount: cost.toFixed(6), currency: 'CNY' };
}

export const SUPPORTS_BALANCE = ['deepseek'];

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
