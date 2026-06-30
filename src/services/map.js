import { loadSetting } from './settings';

const BASE_URL = 'https://restapi.amap.com/v3';

async function getKey() {
  const settings = await loadSetting('api_settings', {});
  return settings.amapApiKey || '';
}

async function apiGet(path, params) {
  const key = await getKey();
  if (!key) throw new Error('未配置高德 API Key');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const query = new URLSearchParams({ key, ...params, output: 'JSON' });
    const response = await fetch(`${BASE_URL}${path}?${query}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`请求失败: ${response.status}`);
    const data = await response.json();
    if (data.status !== '1') throw new Error(data.info || '高德 API 返回错误');
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export async function searchNearby(location, keyword, radius = 1000) {
  const data = await apiGet('/place/around', {
    location,
    keywords: keyword,
    radius,
    offset: 10,
    page: 1,
    extensions: 'all',
  });
  return (data.pois || []).map(p => ({
    id: p.id,
    name: p.name,
    address: p.address,
    distance: p.distance,
    tel: p.tel || '',
    type: p.type,
    location: p.location,
    rating: p.biz_ext?.rating || '',
    cost: p.biz_ext?.cost || '',
    photos: p.photos || [],
  }));
}

export async function searchByKeyword(keyword, city = '') {
  const data = await apiGet('/place/text', {
    keywords: keyword,
    city,
    offset: 10,
    page: 1,
  });
  return (data.pois || []).map(p => ({
    id: p.id,
    name: p.name,
    address: p.address,
    location: p.location,
    tel: p.tel || '',
    type: p.type,
    distance: p.distance,
  }));
}

export async function getRoute(origin, destination, type = 'driving', city = '') {
  const endpoint = type === 'cycling' ? 'bicycling' : type;
  const params = { origin, destination, extensions: 'all' };
  if (type === 'transit') {
    params.city = city;
    params.cityd = city;
  } else if (type === 'driving') {
    params.strategy = 0;
  }
  const data = await apiGet('/direction/' + endpoint, params);
  const route = data.route?.paths?.[0];
  if (!route) throw new Error('未找到路线');
  return {
    distance: route.distance,
    duration: route.duration,
    steps: (route.steps || []).map(s => s.instruction),
    polyline: route.steps.map(s => s.polyline).join(';'),
  };
}

export async function getWeather(city) {
  const data = await apiGet('/weather/weatherInfo', {
    city,
    extensions: 'all',
  });
  const forecasts = data.forecasts?.[0]?.casts || [];
  return forecasts.map(c => ({
    date: c.date,
    week: c.week,
    dayWeather: c.dayweather,
    nightWeather: c.nightweather,
    dayTemp: c.daytemp,
    nightTemp: c.nighttemp,
    dayWind: c.daywind,
    nightWind: c.nightwind,
  }));
}

export async function getAddressFromLocation(location) {
  const data = await apiGet('/geocode/regeo', { location });
  const regeo = data.regeocode;
  return {
    address: regeo?.formatted_address || '',
    province: regeo?.addressComponent?.province || '',
    city: regeo?.addressComponent?.city || '',
    district: regeo?.addressComponent?.district || '',
    street: regeo?.addressComponent?.street || '',
  };
}

export async function getCurrentLocation() {
  return getLocationByIP();
}

async function ipApiFallback() {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 5000);
    const res = await fetch('http://ip-api.com/json/', { signal: c.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 'success') return null;
    const lat = data.lat;
    const lng = data.lon;
    return {
      source: 'ip-api',
      city: data.city || '',
      province: data.regionName || '',
      lat: String(lat),
      lng: String(lng),
      location: `${lng},${lat}`,
    };
  } catch {
    return null;
  }
}

export async function getLocationByIP() {
  const data = await apiGet('/ip', {});
  const loc = data.location || '';
  if (loc) {
    const parts = loc.split(',');
    return {
      source: 'ip',
      city: data.city || '',
      province: data.province || '',
      lat: parts[1] || '',
      lng: parts[0] || '',
      location: loc,
    };
  }
  const rect = data.rectangle || '';
  const rectParts = rect.split(';');
  if (rectParts.length === 2) {
    const min = rectParts[0].split(',');
    const max = rectParts[1].split(',');
    if (min.length === 2 && max.length === 2) {
      const centerLng = ((parseFloat(min[0]) + parseFloat(max[0])) / 2).toFixed(6);
      const centerLat = ((parseFloat(min[1]) + parseFloat(max[1])) / 2).toFixed(6);
      return {
        source: 'ip',
        city: data.city || '',
        province: data.province || '',
        lat: centerLat,
        lng: centerLng,
        location: `${centerLng},${centerLat}`,
      };
    }
  }

  if (data.city || data.province) {
    return {
      source: 'ip',
      city: data.city || '',
      province: data.province || '',
      lat: '',
      lng: '',
      location: '',
    };
  }

  const fallback = await ipApiFallback();
  if (fallback) return fallback;

  return {
    source: 'ip',
    city: '',
    province: '',
    lat: '',
    lng: '',
    location: '',
  };
}

export function getLocationFromAddress(address, city = '') {
  return apiGet('/geocode/geo', { address, city });
}

const MAP_INTENTS = [
  { pattern: /(附近|周边|最近).*(吃|美食|餐厅|饭馆|小吃|饭店|餐馆|玩|景点|咖啡|奶茶|超市|便利店)/, action: 'nearby_food' },
  { pattern: /(附近|周边|最近).*(厕所|卫生间|洗手间|医院|药店|银行|ATM|加油站)/, action: 'nearby_place' },
  { pattern: /(怎么走|路线|导航|怎么去|如何去|路怎么走)/, action: 'route' },
  { pattern: /天气/, action: 'weather' },
  { pattern: /(我在哪|我现在在哪|我现在在哪里|我在哪儿|我现在在哪儿|我目前在哪|我目前的位置|我的位置|定位|当前位置)/, action: 'location' },
  { pattern: /^(推荐|介绍|说说|推荐一下)\s*(.*)(景点|好玩|地方|公园|美食|吃的)/, action: 'recommend' },
];

export function detectMapIntent(text) {
  for (const { pattern, action } of MAP_INTENTS) {
    if (pattern.test(text)) return action;
  }
  return null;
}

export function extractLocation(text) {
  const patterns = [
    /从(.+?)(?:到|去|至)(.+)/,
    /(?:到|去|前往)(.+)/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      return m.slice(1).map(s => s.trim().replace(/(怎么走|路线|导航|怎么去|如何去|路怎么走)$/, '').trim()).filter(Boolean);
    }
  }
  return [];
}

export function extractCity(text) {
  const cities = ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '南京', '西安', '重庆', '天津', '苏州', '长沙', '郑州', '东莞', '青岛', '沈阳', '宁波', '昆明', '大连', '厦门', '合肥', '佛山', '福州', '哈尔滨', '济南', '温州', '长春', '石家庄', '常州', '泉州', '南宁', '贵阳', '南昌', '太原', '烟台', '嘉兴', '南通', '金华', '珠海', '惠州', '徐州', '海口', '乌鲁木齐', '绍兴', '中山', '台州', '兰州'];
  for (const city of cities) {
    if (text.includes(city)) return city;
  }
  return null;
}
