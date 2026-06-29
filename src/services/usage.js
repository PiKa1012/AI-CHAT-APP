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
       COUNT(*) as total_calls
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
  const totalObj = total[0] || { total_tokens: 0, total_prompt: 0, total_completion: 0, total_calls: 0 };

  return {
    todayTokens: todayTotal,
    todayCalls,
    totalTokens: totalObj.total_tokens,
    totalPrompt: totalObj.total_prompt,
    totalCompletion: totalObj.total_completion,
    totalCalls: totalObj.total_calls,
    estimatedCost: (totalObj.total_tokens / 1000000) * 0.5,
  };
}

const DEEPSEEK_BALANCE_URL = 'https://api.deepseek.com/user/balance';

export async function getDeepSeekBalance(apiKey) {
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

export function getBalanceInfo(balance) {
  if (!balance) return null;
  const available = balance.balance_infos?.filter(b => b.total_balance !== '0.00') || [];
  const total = available.reduce((s, b) => s + parseFloat(b.total_balance || '0'), 0);
  return {
    total: total.toFixed(2),
    currency: balance.balance_infos?.[0]?.currency || 'CNY',
    details: available,
  };
}
