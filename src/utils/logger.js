import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBeijingNow } from './time';

const LOG_KEY = 'app_logs';
const MAX_LOGS = 500;

const LOG_LEVELS = {
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  DEBUG: 'debug',
};

async function getLogs() {
  try {
    const logs = await AsyncStorage.getItem(LOG_KEY);
    return logs ? JSON.parse(logs) : [];
  } catch (e) {
    return [];
  }
}

async function saveLog(level, tag, message, data = null) {
  try {
    const logs = await getLogs();
    const now = getBeijingNow();
    const timeStr = `${now.hours.toString().padStart(2, '0')}:${now.minutes.toString().padStart(2, '0')}:${new Date().getSeconds().toString().padStart(2, '0')}`;
    const dateStr = `${now.month}/${now.day}`;
    
    const logEntry = {
      id: Date.now() + Math.random(),
      time: `${dateStr} ${timeStr}`,
      level,
      tag,
      message: typeof message === 'string' ? message : JSON.stringify(message),
      data: data ? (typeof data === 'string' ? data : JSON.stringify(data, null, 2)) : null,
    };

    logs.unshift(logEntry);
    
    if (logs.length > MAX_LOGS) {
      logs.splice(MAX_LOGS);
    }

    await AsyncStorage.setItem(LOG_KEY, JSON.stringify(logs));
  } catch (e) {
    console.error('Failed to save log:', e);
  }
}

export async function logInfo(tag, message, data) {
  await saveLog(LOG_LEVELS.INFO, tag, message, data);
}

export async function logWarn(tag, message, data) {
  await saveLog(LOG_LEVELS.WARN, tag, message, data);
}

export async function logError(tag, message, data) {
  await saveLog(LOG_LEVELS.ERROR, tag, message, data);
  console.error(`[${tag}] ${message}`, data);
}

export async function logDebug(tag, message, data) {
  await saveLog(LOG_LEVELS.DEBUG, tag, message, data);
}

export async function clearLogs() {
  try {
    await AsyncStorage.removeItem(LOG_KEY);
  } catch (e) {}
}

export async function getAllLogs() {
  return await getLogs();
}

export function setupGlobalErrorHandler() {
  const originalConsoleError = console.error;
  console.error = (...args) => {
    originalConsoleError.apply(console, args);
    const message = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
    logError('Console', message);
  };

  const originalConsoleWarn = console.warn;
  console.warn = (...args) => {
    originalConsoleWarn.apply(console, args);
    const message = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
    logWarn('Console', message);
  };

  if (typeof ErrorUtils !== 'undefined') {
    const originalHandler = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error, isFatal) => {
      logError('Global', `${isFatal ? 'Fatal' : 'Non-fatal'} error: ${error.message}`, error.stack);
      if (originalHandler) {
        originalHandler(error, isFatal);
      }
    });
  }
}

export async function logApiCall(provider, endpoint, status, error = null) {
  if (error) {
    logError('API', `${provider} ${endpoint} failed (${status})`, error);
  } else {
    logInfo('API', `${provider} ${endpoint} success (${status})`);
  }
}

export async function logNavigation(from, to) {
  logDebug('Nav', `${from} → ${to}`);
}

export async function logUserAction(action, details) {
  logInfo('User', action, details);
}
