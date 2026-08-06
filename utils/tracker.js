// ============================================
// 用户行为追踪工具
// 用于采集用户行为数据，上报到后端分析系统
// 后端不可用时静默忽略，不影响主流程
// ============================================
import { API, apiFetch, getDeviceInfo } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TRACKING_QUEUE_KEY = '@tracking_queue';
const MAX_QUEUE_SIZE = 100;
const FLUSH_INTERVAL = 30000; // 30秒批量上报

let queue = [];
let flushTimer = null;
let enabled = true;

// 初始化
export async function initTracker(token = '') {
  await loadQueue();
  if (token) {
    startAutoFlush(token);
  }
}

// 加载本地缓存队列
async function loadQueue() {
  try {
    const data = await AsyncStorage.getItem(TRACKING_QUEUE_KEY);
    if (data) {
      queue = JSON.parse(data);
    }
  } catch (e) {
    queue = [];
  }
}

// 保存队列到本地
async function saveQueue() {
  try {
    await AsyncStorage.setItem(TRACKING_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    // 忽略存储错误
  }
}

// 自动刷新
function startAutoFlush(token) {
  if (flushTimer) return;
  flushTimer = setInterval(() => {
    if (queue.length > 0) {
      flush(token);
    }
  }, FLUSH_INTERVAL);
}

// 立即上报队列
export async function flush(token = '') {
  if (queue.length === 0) return;
  const events = queue.splice(0, Math.min(queue.length, 20));
  const res = await apiFetch(API.analyticsTrackBatch, {
    method: 'POST',
    body: JSON.stringify({ events }),
  }, token);
  if (res.ok) {
    await saveQueue();
  } else {
    // 失败放回队列
    queue = [...events, ...queue].slice(0, MAX_QUEUE_SIZE);
    await saveQueue();
  }
}

// ========== 核心追踪方法 ==========

// 追踪事件
export function track(action, page = '', detail = {}, durationMs = 0) {
  if (!enabled) return;
  
  const event = {
    action,
    page,
    detail,
    durationMs,
    timestamp: Date.now(),
  };
  
  queue.push(event);
  
  // 超过10条立即上报
  if (queue.length >= 10) {
    const token = getCachedToken();
    if (token) flush(token);
    else saveQueue();
  } else {
    saveQueue();
  }
}

// 页面访问追踪
export function trackPage(pageName) {
  track('page_view', pageName);
}

// 功能使用追踪
export function trackFeature(featureName, detail = {}) {
  track('feature_use', featureName, detail);
}

// 交易行为追踪
export function trackTransaction(type, amount, detail = {}) {
  track('transaction', type, { ...detail, amount });
}

// 错误追踪
export function trackError(error, context = '') {
  track('error', context, {
    message: error?.message || String(error),
    stack: error?.stack?.substring(0, 500) || '',
  });
}

// 崩溃上报
export async function reportCrash(error, version = '', token = '') {
  const deviceInfo = getDeviceInfo();
  await apiFetch(API.analyticsCrash, {
    method: 'POST',
    body: JSON.stringify({
      error: error?.message || String(error),
      stack: error?.stack || '',
      version,
      device: deviceInfo,
    }),
  }, token);
}

// ========== 反馈提交 ==========

export async function submitFeedback({ type = 'feedback', title = '', content, rating = 0, token = '' }) {
  const deviceInfo = getDeviceInfo();
  const version = getAppVersion();
  
  const res = await apiFetch(API.feedback, {
    method: 'POST',
    body: JSON.stringify({
      type,
      title,
      content,
      rating,
      device: deviceInfo,
      version,
    }),
  }, token);
  
  if (res.ok && res.data) {
    return { success: true, ...res.data };
  }
  return { success: false, error: res.data?.error || '提交失败' };
}

// ========== 工具方法 ==========

// 获取缓存的 token（从 AsyncStorage）
async function getCachedToken() {
  try {
    return await AsyncStorage.getItem('@auth_token') || '';
  } catch (e) {
    return '';
  }
}

// 同步获取 token（用于批量上报定时器中）
function getSyncToken() {
  // 简单实现，实际项目应通过 context 获取
  return '';
}

// 获取当前版本号
function getAppVersion() {
  try {
    const { version } = require('../../app.json');
    return version || '';
  } catch (e) {
    return '';
  }
}

// 开启/关闭追踪
export function setTrackingEnabled(v) {
  enabled = v;
}

// 页面停留时间追踪
export function createPageTimer(pageName) {
  const startTime = Date.now();
  return () => {
    const duration = Date.now() - startTime;
    track('page_duration', pageName, { duration_ms: duration }, duration);
  };
}

// 常用行为快捷方法
export const actions = {
  LOGIN: 'login',
  LOGOUT: 'logout',
  REGISTER: 'register',
  VIEW_ORDER: 'view_order',
  CREATE_ORDER: 'create_order',
  REDEEM_ORDER: 'redeem_order',
  VIEW_INVENTORY: 'view_inventory',
  ADD_CUSTOMER: 'add_customer',
  SEND_COUPON: 'send_coupon',
  USE_AI: 'use_ai',
  GENERATE_POSTER: 'generate_poster',
  SHARE: 'share',
  VIEW_REPORT: 'view_report',
  UPDATE_SETTING: 'update_setting',
  PURCHASE_MEMBERSHIP: 'purchase_membership',
};
