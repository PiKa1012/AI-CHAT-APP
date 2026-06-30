const BEIJING_OFFSET_HOURS = 8;

function padZero(num) {
  return num.toString().padStart(2, '0');
}

function parseToUTC(dateStr) {
  if (!dateStr) return new Date();
  
  if (typeof dateStr === 'string') {
    if (dateStr.includes('T') || dateStr.includes('Z')) {
      return new Date(dateStr);
    } else {
      const d = new Date(dateStr.replace(' ', 'T'));
      return isNaN(d.getTime()) ? new Date() : d;
    }
  }
  return new Date(dateStr);
}

function getBeijingHours(dateStr) {
  const utcDate = parseToUTC(dateStr);
  if (isNaN(utcDate.getTime())) return { h: 0, m: 0, d: new Date() };
  
  const utcMs = utcDate.getTime();
  const beijingMs = utcMs + (BEIJING_OFFSET_HOURS * 60 * 60 * 1000);
  const beijingDate = new Date(beijingMs);
  
  return {
    h: beijingDate.getUTCHours(),
    m: beijingDate.getUTCMinutes(),
    d: beijingDate
  };
}

export function getBeijingNow() {
  const utcMs = Date.now();
  const beijingMs = utcMs + (BEIJING_OFFSET_HOURS * 60 * 60 * 1000);
  const d = new Date(beijingMs);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hours: d.getUTCHours(),
    minutes: d.getUTCMinutes(),
    date: d
  };
}

export function formatTime(dateStr) {
  const { h, m } = getBeijingHours(dateStr);
  return `${padZero(h)}:${padZero(m)}`;
}

export function formatDate(dateStr) {
  const { d } = getBeijingHours(dateStr);
  const now = getBeijingNow();
  
  const dYear = d.getUTCFullYear();
  const dMonth = d.getUTCMonth() + 1;
  const dDay = d.getUTCDate();
  
  if (dYear === now.year && dMonth === now.month && dDay === now.day) return '今天';
  
  const yesterday = new Date(now.date);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (dYear === yesterday.getUTCFullYear() && dMonth === yesterday.getUTCMonth() + 1 && dDay === yesterday.getUTCDate()) {
    return '昨天';
  }
  
  return `${dMonth}月${dDay}日`;
}

export function formatDateTime(dateStr) {
  const { h, m, d } = getBeijingHours(dateStr);
  const now = getBeijingNow();
  const timeStr = `${padZero(h)}:${padZero(m)}`;
  
  const dYear = d.getUTCFullYear();
  const dMonth = d.getUTCMonth() + 1;
  const dDay = d.getUTCDate();
  
  if (dYear === now.year && dMonth === now.month && dDay === now.day) return `今天 ${timeStr}`;
  
  const yesterday = new Date(now.date);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (dYear === yesterday.getUTCFullYear() && dMonth === yesterday.getUTCMonth() + 1 && dDay === yesterday.getUTCDate()) {
    return `昨天 ${timeStr}`;
  }
  
  return `${dMonth}月${dDay}日 ${timeStr}`;
}

export function getBeijingToday() {
  const now = getBeijingNow();
  return `${now.year}-${padZero(now.month)}-${padZero(now.day)}`;
}

export function getCurrentTimeInfo() {
  const now = getBeijingNow();
  const hour = now.hours;
  const minute = now.minutes;
  const year = now.year;
  const month = now.month;
  const day = now.day;
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  const weekDay = weekDays[now.date.getUTCDay()];

  let period;
  if (hour >= 5 && hour < 11) period = '早上';
  else if (hour >= 11 && hour < 14) period = '中午';
  else if (hour >= 14 && hour < 18) period = '下午';
  else if (hour >= 18 && hour < 22) period = '晚上';
  else period = '深夜';

  return {
    full: `${year}年${month}月${day}日 星期${weekDay} ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
    period,
    hour,
    minute,
    date: `${month}月${day}日`,
    weekDay: `星期${weekDay}`,
  };
}
