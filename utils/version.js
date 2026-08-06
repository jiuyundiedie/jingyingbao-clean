// ============================================
// 版本检查与远程配置工具
// 负责检查版本更新、获取远程功能开关
// ============================================
import { API, apiFetch, getDeviceInfo, BACKEND_URL } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';

const VERSION_CACHE_KEY = '@version_info';
const CONFIG_CACHE_KEY = '@remote_config';
const VERSION_CHECK_INTERVAL = 6 * 3600 * 1000; // 6小时检查一次

// ========== 版本检查 ==========

export async function checkVersion(currentVersion = '') {
  if (!BACKEND_URL) return { hasUpdate: false };
  
  const deviceInfo = getDeviceInfo();
  const platform = deviceInfo.platform || 'android';
  
  const res = await apiFetch(API.versionCheck, {
    method: 'POST',
    body: JSON.stringify({
      platform,
      currentVersion,
    }),
  });
  
  if (res.ok && res.data) {
    // 缓存版本信息
    try {
      await AsyncStorage.setItem(VERSION_CACHE_KEY, JSON.stringify({
        ...res.data,
        checkedAt: Date.now(),
      }));
    } catch (e) {}
    return res.data;
  }
  
  // 从缓存读取
  try {
    const cached = await AsyncStorage.getItem(VERSION_CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch (e) {}
  
  return { hasUpdate: false };
}

// 获取本地缓存的版本信息
export async function getCachedVersionInfo() {
  try {
    const data = await AsyncStorage.getItem(VERSION_CACHE_KEY);
    return data ? JSON.parse(data) : { hasUpdate: false };
  } catch (e) {
    return { hasUpdate: false };
  }
}

// 静默版本检查（适合启动时）
export async function silentCheck(currentVersion = '') {
  const cached = await getCachedVersionInfo();
  const checkedAt = cached.checkedAt || 0;
  const now = Date.now();
  
  if (now - checkedAt < VERSION_CHECK_INTERVAL) {
    return cached;
  }
  
  return checkVersion(currentVersion);
}

// ========== 远程配置 ==========

export async function fetchRemoteConfig(platform = '') {
  if (!BACKEND_URL) {
    // 离线模式返回默认配置
    return getDefaultConfig();
  }
  
  const res = await apiFetch(API.remoteConfig + (platform ? `?platform=${platform}` : ''));
  
  if (res.ok && res.data && res.data.data) {
    try {
      await AsyncStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify({
        config: res.data.data,
        updatedAt: Date.now(),
      }));
    } catch (e) {}
    return res.data.data;
  }
  
  // 返回缓存
  return getCachedConfig();
}

// 获取缓存的配置
async function getCachedConfig() {
  try {
    const data = await AsyncStorage.getItem(CONFIG_CACHE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      return parsed.config || getDefaultConfig();
    }
  } catch (e) {}
  return getDefaultConfig();
}

// 默认配置（离线时使用）
function getDefaultConfig() {
  return {
    feature_membership_enabled: 'false',
    feature_coupons_enabled: 'true',
    feature_ai_enabled: 'true',
    feature_analytics_enabled: 'true',
    maintenance_mode: 'false',
    force_update_version: '',
  };
}

// 获取某个配置项的值
export async function getConfigValue(key, defaultValue = null) {
  const config = await getCachedConfig();
  return config[key] !== undefined ? config[key] : defaultValue;
}

// 获取功能开关（布尔）
export async function isFeatureEnabled(featureName) {
  const value = await getConfigValue(`feature_${featureName}`, 'false');
  return value === 'true';
}

// 快捷方法：判断是否在维护模式
export async function isInMaintenance() {
  const value = await getConfigValue('maintenance_mode', 'false');
  return value === 'true';
}

// 获取强制更新的最低版本
export async function getForceUpdateVersion() {
  return await getConfigValue('force_update_version', '');
}

// ========== 启动时的初始化 ==========

export async function initAppConfig(currentVersion = '') {
  const results = {
    config: null,
    version: null,
    maintenance: false,
  };
  
  try {
    results.config = await fetchRemoteConfig();
    results.maintenance = results.config?.maintenance_mode === 'true';
  } catch (e) {
    results.config = getDefaultConfig();
  }
  
  try {
    results.version = await silentCheck(currentVersion);
  } catch (e) {
    results.version = { hasUpdate: false };
  }
  
  return results;
}

// 强制刷新配置（用户手动触发）
export async function forceRefresh(platform = '') {
  try {
    const config = await fetchRemoteConfig(platform);
    const version = await checkVersion('');
    return { config, version };
  } catch (e) {
    return { config: null, version: null, error: e.message };
  }
}
