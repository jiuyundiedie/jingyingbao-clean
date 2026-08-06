// ============================================
// 经营宝配置中心
// 支持后端模式 (backend) 和 离线模式 (mock)
// ============================================

// ========== 后端 API 配置 ==========
// 部署后修改此地址为你的服务器域名
// 开发模式可留空走本地 mock
export const BACKEND_URL = ''; // 例如: 'https://api.jingyingbao.cn'

// ========== AI 服务配置（保留本地直连作为备用） ==========
// 后端部署后建议清空，走后端代理以保护密钥
export const AI_CONFIG = {
  // 智谱AI（主力）
  zhipu: {
    apiKey: '', // 已迁移到后端
    url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    model: 'glm-4-flash',
  },
  // 硅基流动
  siliconflow: {
    apiKey: '', // 已迁移到后端
    chatUrl: 'https://api.siliconflow.cn/v1/chat/completions',
    imageUrl: 'https://api.siliconflow.cn/v1/images/generations',
  },
  // 百度AI
  baidu: {
    apiKey: '', // 已迁移到后端
    secretKey: '', // 已迁移到后端
    url: 'https://open.bigmodel.cn/api/paas/v4/images/generations',
  },
};

// ========== API 端点 ==========
export const API = {
  // 认证
  sendSms: '/api/auth/sms/send',
  login: '/api/auth/login',
  wechatLogin: '/api/auth/wechat',
  getMe: '/api/auth/me',
  updateMe: '/api/auth/me',
  // AI
  aiChat: '/api/ai/chat',
  aiImage: '/api/ai/image',
  // 数据
  orders: '/api/data/orders',
  inventory: '/api/data/inventory',
  customers: '/api/data/customers',
  sync: '/api/data/sync',
  // 会员
  membershipPlans: '/api/membership/plans',
  membershipCurrent: '/api/membership/current',
  membershipPurchase: '/api/membership/purchase',
  membershipHistory: '/api/membership/history',
  // 优惠券
  coupons: '/api/coupons',
  couponsClaim: '/api/coupons/claim',
  couponsSend: '/api/coupons/send-to-customers',
  couponsMy: '/api/coupons/my/user-coupons',
  couponsRedeem: '/api/coupons/redeem',
  couponsStats: '/api/coupons/stats',
  // 分析与反馈
  analyticsTrack: '/api/analytics/track',
  analyticsTrackBatch: '/api/analytics/track/batch',
  analyticsCrash: '/api/analytics/crash',
  feedback: '/api/feedback',
  feedbackMy: '/api/feedback/my',
  // 版本与配置
  versionCheck: '/api/config/check',
  remoteConfig: '/api/config',
};

// ========== 辅助函数 ==========
// 检查后端是否可用
export async function isBackendAvailable() {
  if (!BACKEND_URL) return false;
  try {
    const res = await fetch(BACKEND_URL + '/api/health', { method: 'GET' });
    return res.ok;
  } catch (e) {
    return false;
  }
}

// 构建完整 URL
export function apiUrl(endpoint) {
  if (!BACKEND_URL) return '';
  return BACKEND_URL + endpoint;
}

// 带鉴权的请求
export async function apiFetch(endpoint, options = {}, token = '') {
  const url = apiUrl(endpoint);
  if (!url) {
    return { ok: false, mock: true };
  }
  try {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(url, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// 当前模式判断
export function getMode() {
  return BACKEND_URL ? 'backend' : 'mock';
}

// ========== 设备信息采集 ==========
export function getDeviceInfo() {
  try {
    const { Platform, Version, Dimensions } = require('react-native');
    return {
      platform: Platform.OS,
      osVersion: Version,
      screen: `${Dimensions.get('window').width}x${Dimensions.get('window').height}`,
    };
  } catch (e) {
    return { platform: 'unknown' };
  }
}
