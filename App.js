import React, { createContext, useContext, useReducer, useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, TouchableWithoutFeedback, StyleSheet, TextInput, ScrollView, Alert,
  BackHandler, ActivityIndicator, Dimensions, Platform, ToastAndroid,
  Modal, Image, FlatList, RefreshControl, StatusBar, SafeAreaView,
  PanResponder
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer, useNavigation, createNavigationContainerRef } from '@react-navigation/native';
const navigationRef = createNavigationContainerRef();
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { Camera, CameraType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

// ===== 工具函数 =====
let toastHideTimer = null;
let toastClickHandler = null;
const showToast = (msg, duration = 2000) => {
  if (Platform.OS === 'android') {
    ToastAndroid.show(msg, ToastAndroid.SHORT);
  }
  if (toastRef.current) {
    toastRef.current.setMsg(msg);
    toastRef.current.setVisible(true);
    if (toastHideTimer) clearTimeout(toastHideTimer);
    toastHideTimer = setTimeout(() => {
      if (toastRef.current) toastRef.current.setVisible(false);
    }, duration);
  }
};
const hideToast = () => {
  if (toastHideTimer) clearTimeout(toastHideTimer);
  if (toastRef.current) toastRef.current.setVisible(false);
};

// 自定义 Toast 组件（点击立即消失）
const CustomToast = () => {
  const [visible, setVisible] = useState(false);
  const [msg, setMsg] = useState('');
  toastRef.current = { setMsg, setVisible, show: () => setVisible(true) };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={hideToast}>
      <TouchableOpacity activeOpacity={1} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.05)' }} onPress={hideToast}>
        <View style={{ position: 'absolute', top: 80, left: 0, right: 0, alignItems: 'center' }}>
          <View style={{ backgroundColor: 'rgba(50,50,50,0.92)', borderRadius: 22, paddingHorizontal: 20, paddingVertical: 12, maxWidth: '80%' }}>
            <Text style={{ color: '#fff', fontSize: 14, textAlign: 'center' }}>{msg}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};
const toastRef = { current: null };

const { width, height } = Dimensions.get('window');
const PRIMARY_COLOR = '#5B6DF0'; // 更高级的紫蓝色
const LIGHT_PRIMARY = '#EEF1FF';
const DANGER_COLOR = '#F53F3F';
const SUCCESS_COLOR = '#00B42A';
const BG_PAGE = '#F5F7FA';
const BG_CARD = '#FFFFFF';
const TEXT_MAIN = '#1A2332';
const TEXT_SECOND = '#4A5A6E';
const TEXT_THIRD = '#8E9DB0';
const BORDER_COLOR = '#E8ECF1';
const EMOJI_LIST = ['😀','😃','😄','😁','😆','🥲','😊','😇','🙂','🙃','😉','😌','🥰','😍','🤩','😘'];
const SHADOW = {
  shadowColor: '#1A2332',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 6,
};

const ZHIPU_API_KEY = "1cca44e3c1124a999d501621e9fe8305.xf2xNXly5CkSBe5p";
const ZHIPU_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const ZHIPU_MODEL = "glm-4-flash";

// ===== 日期工具 =====
const getTodayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const formatTime = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const getWeekStart = () => {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setDate(diff);
  return monday;
};

// ===== 压缩图片 =====
const compressImage = async (uri) => {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 800 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );
    return result.uri;
  } catch (error) {
    return uri;
  }
};

// ===== AI 聊天 =====
async function fetchZhipuChat(msgList, prompt, signal) {
  try {
    const res = await fetch(ZHIPU_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${ZHIPU_API_KEY}` },
      body: JSON.stringify({
        model: ZHIPU_MODEL,
        messages: [{ role: "system", content: prompt }, ...msgList],
        temperature: 0.7
      }),
      signal: signal,
    });
    const json = await res.json();
    return json.choices?.[0]?.message?.content || "网络异常，获取回复失败";
  } catch (err) {
    if (err.name === 'AbortError') return '已取消';
    return "网络异常，获取回复失败";
  }
}

async function fetchZhipuImage(prompt, signal) {
  try {
    const res = await fetch('https://open.bigmodel.cn/api/paas/v4/images/generations', {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${ZHIPU_API_KEY}` },
      body: JSON.stringify({
        model: "cogview-3-plus",
        prompt: prompt,
        image_size: "1024x1024",
        num_images: 1
      }),
      signal: signal,
    });
    const json = await res.json();
    if (!res.ok) {
      console.error('Image generation failed:', json);
      return null;
    }
    const imageData = json.data?.[0];
    if (imageData?.b64_json) {
      return `data:image/png;base64,${imageData.b64_json}`;
    } else if (imageData?.url) {
      try {
        const fileName = `temp_img_${Date.now()}.png`;
        const downloadRes = await FileSystem.downloadAsync(imageData.url, FileSystem.documentDirectory + fileName);
        const base64 = await FileSystem.readAsStringAsync(downloadRes.uri, { encoding: FileSystem.EncodingType.Base64 });
        return `data:image/png;base64,${base64}`;
      } catch (e) {
        console.error('Failed to fetch image URL:', e);
        return null;
      }
    }
    return null;
  } catch (err) {
    if (err.name === 'AbortError') return 'aborted';
    console.error('Image generation error:', err);
    return null;
  }
}

async function fetchZhipuVision(imageUri, prompt, signal) {
  try {
    const base64 = await FileSystem.readAsStringAsync(imageUri, { encoding: FileSystem.EncodingType.Base64 });
    const dataUri = `data:image/jpeg;base64,${base64}`;
    const res = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${ZHIPU_API_KEY}` },
      body: JSON.stringify({
        model: "glm-4v-plus",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: dataUri } }
          ]
        }],
        max_tokens: 100,
        temperature: 0.1,
      }),
      signal: signal,
    });
    const json = await res.json();
    if (!res.ok) {
      console.error('Vision API failed:', json);
      return null;
    }
    return json.choices?.[0]?.message?.content || '';
  } catch (err) {
    if (err.name === 'AbortError') return 'aborted';
    console.error('Vision API error:', err);
    return null;
  }
}

// ===== 日报/周报/月报计算 =====
const calcDailyReport = (state) => {
  try {
    const todayStr = getTodayStr();
    const businessHistory = state.businessHistory || [];
    const existing = businessHistory.find(r => r.date === todayStr);
    if (existing) return existing;
    const globalOrderRecord = state.globalOrderRecord || [];
    const todayOrders = globalOrderRecord.filter(item => item.time && formatDate(item.time) === todayStr);
    let meituanIncome = 0, douyinIncome = 0, dianpingIncome = 0;
    todayOrders.forEach(order => {
      switch(order.platform) {
        case "美团": meituanIncome += order.couponPrice || 0; break;
        case "抖音": douyinIncome += order.couponPrice || 0; break;
        case "大众点评": dianpingIncome += order.couponPrice || 0; break;
      }
    });
    const totalIncome = meituanIncome + douyinIncome + dianpingIncome;
    const costCache = state.costCache || { purchaseCost: "", fixedCost: "" };
    const purchaseCost = Number(costCache.purchaseCost) || 0;
    const fixedCost = Number(costCache.fixedCost) || 0;
    const lastBusinessInput = state.lastBusinessInput || {};
    const tempLoss = Number(lastBusinessInput.loss) || 0;
    const tempOtherCost = Number(lastBusinessInput.otherCost) || 0;
    const subLoss = Number(lastBusinessInput.lossOverdue||0) + Number(lastBusinessInput.lossOperate||0) + Number(lastBusinessInput.lossOther||0);
    const totalLoss = tempLoss + subLoss;
    const totalCost = purchaseCost + fixedCost + tempOtherCost + totalLoss;
    const profit = totalIncome - totalCost;
    const profitRate = totalIncome === 0 ? 0 : Number((profit / totalIncome * 100).toFixed(2));
    return {
      id: new Date().getTime().toString(),
      date: todayStr,
      shopName: (state.shopConfig || {}).shopName || '我的门店',
      income: totalIncome,
      meituanIncome,
      douyinIncome,
      dianpingIncome,
      totalOrder: todayOrders.length,
      purchaseCost,
      loss: totalLoss,
      fixedCost,
      otherCost: tempOtherCost,
      totalCost,
      profit,
      profitRate
    };
  } catch (e) { return null; }
};

const generateWeekReport = (state) => {
  try {
    const today = new Date();
    const weekStart = getWeekStart();
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const businessHistory = state.businessHistory || [];
    const weekList = businessHistory.filter(item => {
      const d = new Date(item.date);
      return d >= weekStart && d <= weekEnd;
    });
    if(weekList.length === 0) return null;
    const totalIncome = weekList.reduce((s,r)=>s + (r.income || 0), 0);
    const totalProfit = weekList.reduce((s,r)=>s + (r.profit || 0), 0);
    const totalOrder = weekList.reduce((s,r)=>s + (r.totalOrder || 0), 0);
    const avgDailyIncome = Number((totalIncome/weekList.length).toFixed(2));
    return {
      startDate: formatDate(weekStart.toISOString()),
      endDate: formatDate(weekEnd.toISOString()),
      totalIncome,
      totalProfit,
      totalOrder,
      avgDailyIncome
    };
  } catch (e) { return null; }
};

const generateMonthReport = (state) => {
  try {
    const today = new Date();
    const monthStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
    const businessHistory = state.businessHistory || [];
    const monthList = businessHistory.filter(item => item.date && item.date.startsWith(monthStr));
    if(monthList.length === 0) return null;
    const totalIncome = monthList.reduce((s,r)=>s + (r.income || 0), 0);
    const totalProfit = monthList.reduce((s,r)=>s + (r.profit || 0), 0);
    const totalOrder = monthList.reduce((s,r)=>s + (r.totalOrder || 0), 0);
    return {
      yearMonth: monthStr,
      totalIncome,
      totalProfit,
      totalOrder,
      dayCount: monthList.length
    };
  } catch (e) { return null; }
};

// ===== Reducer =====
const defaultState = {
  user: null,
  shopInfo: { shopName: '', phone: '', industry: '餐饮类' },
  previousAccounts: [],
  globalOrderRecord: [],
  globalStockRecord: [],
  goodsList: [],
  staffMemberList: [],
  badReviewCount: 0,
  badReviewList: [],
  privateChatMessages: {},
  customerTags: {},
  businessHistory: [],
  costCache: { purchaseCost: "", fixedCost: "" },
  shopConfig: { shopName: "我的门店", industry: "餐饮类" },
  lastBusinessInput: { income: "", purchaseCost: "", loss: "", fixedCost: "", otherCost: "", lossOverdue: "", lossOperate: "", lossOther: "" },
  latestDailyReport: null,
  groupChatMessages: {},
  pushConfig: { workHour: "9", workMinute: "0", offHour: "21", offMinute: "0" },
  menuVisibility: {
    VerifyOrder: true,
    StockManage: true,
    StaffManage: true,
    CustomerService: true,
    InternalChat: true,
    MerchantAssistant: true,
    ProductOverview: true,
  },
};

const initialState = JSON.parse(JSON.stringify(defaultState));

function appReducer(state, action) {
  switch (action.type) {
    case 'LOGIN':
      return { ...state, user: action.payload.user, shopInfo: action.payload.shopInfo };
    case 'LOGOUT':
      return { ...state, user: null, shopInfo: { shopName: '', phone: '', industry: '餐饮类' } };
    case 'UPDATE_SHOP_INFO':
      return { ...state, shopInfo: action.payload };
    case 'SET_SHOP_INFO':
      return { ...state, shopInfo: { ...state.shopInfo, ...action.payload } };
    case 'ADD_ORDER_RECORD':
      return { ...state, globalOrderRecord: [action.payload, ...(state.globalOrderRecord || [])] };
    case 'ADD_STOCK_RECORD':
      return { ...state, globalStockRecord: [action.payload, ...(state.globalStockRecord || [])] };
    case 'SET_GOODS_LIST':
      return { ...state, goodsList: action.payload || [] };
    case 'SET_STAFF_LIST':
      return { ...state, staffMemberList: action.payload || [] };
    case 'APPROVE_STAFF_APPLICATION': {
      const list = state.staffMemberList || [];
      const index = list.findIndex(item => item.phone === action.payload.phone);
      if (index === -1) return state;
      const newList = [...list];
      newList[index] = { ...newList[index], status: 'approved' };
      return { ...state, staffMemberList: newList };
    }
    case 'REJECT_STAFF_APPLICATION': {
      const list = state.staffMemberList || [];
      return { ...state, staffMemberList: list.filter(item => item.phone !== action.payload.phone) };
    }
    case 'ADD_STAFF_APPLICATION': {
      const exists = (state.staffMemberList || []).find(item => item.phone === action.payload.phone);
      if (exists) return state;
      return { ...state, staffMemberList: [...(state.staffMemberList || []), { ...action.payload, status: 'pending', id: Date.now().toString() }] };
    }
    case 'SET_NIGHT_MODE':
      return { ...state, nightMode: action.payload };
    case 'SET_LANGUAGE':
      return { ...state, language: action.payload };
    case 'SET_PUSH_CONFIG':
      return { ...state, pushConfig: action.payload };
    case 'SET_CUSTOMER_TAG': {
      const { phone, tag } = action.payload;
      const tags = (state.customerTags || {})[phone] || [];
      if (tags.includes(tag)) return state;
      return { ...state, customerTags: { ...(state.customerTags || {}), [phone]: [...tags, tag] } };
    }
    case 'ADD_STAFF_MEMBER': {
      const exists = (state.staffMemberList || []).find(item => item.phone === action.payload.phone);
      if (exists) return state;
      return { ...state, staffMemberList: [...(state.staffMemberList || []), { ...action.payload, status: 'approved', id: Date.now().toString() }] };
    }
    case 'REMOVE_STAFF_MEMBER': {
      return { ...state, staffMemberList: (state.staffMemberList || []).filter(item => item.phone !== action.payload) };
    }
    case 'UPDATE_STAFF_STATUS': {
      const list = state.staffMemberList || [];
      const index = list.findIndex(item => item.phone === action.payload.phone);
      if (index === -1) return state;
      const newList = [...list];
      newList[index] = { ...newList[index], status: action.payload.status };
      return { ...state, staffMemberList: newList };
    }
    case 'SET_BAD_REVIEW_COUNT':
      return { ...state, badReviewCount: action.payload };
    case 'INCREASE_BAD_REVIEW_COUNT':
      return { ...state, badReviewCount: (state.badReviewCount || 0) + action.payload };
    case 'ADD_BAD_REVIEW': {
      const newList = [action.payload, ...(state.badReviewList || [])];
      return { ...state, badReviewList: newList, badReviewCount: newList.length };
    }
    case 'MARK_BAD_REVIEW_HANDLED': {
      const list = state.badReviewList || [];
      const index = list.findIndex(item => item.id === action.payload);
      if (index === -1) return state;
      const newList = [...list];
      newList[index] = { ...newList[index], handled: true };
      return { ...state, badReviewList: newList };
    }
    case 'ADD_PRIVATE_MESSAGE': {
      const { phone, message } = action.payload;
      const existing = state.privateChatMessages[phone] || [];
      return { ...state, privateChatMessages: { ...state.privateChatMessages, [phone]: [...existing, message] } };
    }
    case 'SET_CUSTOMER_TAG': {
      const { phone, tag } = action.payload;
      const existing = state.customerTags[phone] || [];
      return { ...state, customerTags: { ...state.customerTags, [phone]: existing.includes(tag) ? existing : [...existing, tag] } };
    }
    case 'ADD_GROUP_MESSAGE': {
      const { chatId, message } = action.payload;
      const existing = state.groupChatMessages[chatId] || [];
      return { ...state, groupChatMessages: { ...state.groupChatMessages, [chatId]: [...existing, message] } };
    }
    case 'SET_GROUP_MESSAGES': {
      const { chatId, messages } = action.payload;
      return { ...state, groupChatMessages: { ...state.groupChatMessages, [chatId]: messages } };
    }
    case 'CLEAR_GROUP_MESSAGES': {
      const { chatId } = action.payload;
      const newState = { ...state };
      delete newState.groupChatMessages[chatId];
      return newState;
    }
    case 'ADD_BUSINESS_REPORT':
      return { ...state, businessHistory: [...(state.businessHistory || []), action.payload] };
    case 'SET_COST_CACHE':
      return { ...state, costCache: action.payload || { purchaseCost: "", fixedCost: "" } };
    case 'SET_SHOP_CONFIG':
      return { ...state, shopConfig: action.payload || { shopName: "我的门店", industry: "餐饮类" } };
    case 'SET_PRIVATE_CHAT_MESSAGES': {
      const { phone, messages } = action.payload;
      return { ...state, privateChatMessages: { ...(state.privateChatMessages || {}), [phone]: messages } };
    }
    case 'ADD_BOSS_NOTIFICATION':
      return { ...state, bossNotifications: [...(state.bossNotifications || []), action.payload] };
    case 'CLEAR_BOSS_NOTIFICATION': {
      return { ...state, bossNotifications: (state.bossNotifications || []).filter(n => n.id !== action.payload.id) };
    }
    case 'SET_LAST_BUSINESS_INPUT':
      return { ...state, lastBusinessInput: action.payload || { income: "", purchaseCost: "", loss: "", fixedCost: "", otherCost: "", lossOverdue: "", lossOperate: "", lossOther: "" } };
    case 'SET_LATEST_DAILY_REPORT':
      return { ...state, latestDailyReport: action.payload };
    case 'SET_PUSH_CONFIG':
      return { ...state, pushConfig: action.payload || { workHour: "9", workMinute: "0", offHour: "21", offMinute: "0" } };
    case 'TOGGLE_MENU_VISIBILITY': {
      const { key, visible } = action.payload;
      return { ...state, menuVisibility: { ...state.menuVisibility, [key]: visible } };
    }
    case 'ADD_PREVIOUS_ACCOUNT': {
      const exists = (state.previousAccounts || []).find(a => a.phone === action.payload.phone);
      if (exists) return state;
      return { ...state, previousAccounts: [...(state.previousAccounts || []), action.payload] };
    }
    case 'SET_PREVIOUS_ACCOUNTS': {
      return { ...state, previousAccounts: action.payload || [] };
    }
    case 'CLEAR_PREVIOUS_ACCOUNTS':
      return { ...state, previousAccounts: [] };
    case 'RESTORE_ALL_DATA': {
      const r = action.payload || {};
      return {
        ...state,
        globalOrderRecord: Array.isArray(r.globalOrderRecord) ? r.globalOrderRecord : [],
        globalStockRecord: Array.isArray(r.globalStockRecord) ? r.globalStockRecord : [],
        goodsList: Array.isArray(r.goodsList) ? r.goodsList : [],
        staffMemberList: Array.isArray(r.staffMemberList) ? r.staffMemberList : [],
        badReviewList: Array.isArray(r.badReviewList) ? r.badReviewList : [],
        privateChatMessages: (r.privateChatMessages && typeof r.privateChatMessages === 'object') ? r.privateChatMessages : {},
        customerTags: (r.customerTags && typeof r.customerTags === 'object') ? r.customerTags : {},
        businessHistory: Array.isArray(r.businessHistory) ? r.businessHistory : [],
        groupChatMessages: (r.groupChatMessages && typeof r.groupChatMessages === 'object') ? r.groupChatMessages : {},
        previousAccounts: Array.isArray(r.previousAccounts) ? r.previousAccounts : [],
        user: r.user || null,
        shopInfo: r.shopInfo || { shopName: '', phone: '', industry: '餐饮类' },
        badReviewCount: typeof r.badReviewCount === 'number' ? r.badReviewCount : 0,
        costCache: r.costCache || { purchaseCost: "", fixedCost: "" },
        shopConfig: r.shopConfig || { shopName: "我的门店", industry: "餐饮类" },
        lastBusinessInput: r.lastBusinessInput || { income: "", purchaseCost: "", loss: "", fixedCost: "", otherCost: "", lossOverdue: "", lossOperate: "", lossOther: "" },
        latestDailyReport: r.latestDailyReport || null,
        pushConfig: r.pushConfig || { workHour: "9", workMinute: "0", offHour: "21", offMinute: "0" },
        menuVisibility: { ...defaultState.menuVisibility, ...(r.menuVisibility || {}) },
      };
    }
    default:
      return state;
  }
}

const AppContext = createContext(null);
const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};

// ===== 持久化 =====
const saveAllData = async (state) => {
  try {
    const dataToSave = {
      globalOrderRecord: state.globalOrderRecord || [],
      globalStockRecord: state.globalStockRecord || [],
      goodsList: state.goodsList || [],
      staffMemberList: state.staffMemberList || [],
      badReviewList: state.badReviewList || [],
      privateChatMessages: state.privateChatMessages || {},
      customerTags: state.customerTags || {},
      businessHistory: state.businessHistory || [],
      groupChatMessages: state.groupChatMessages || {},
      previousAccounts: state.previousAccounts || [],
      user: state.user,
      shopInfo: state.shopInfo,
      costCache: state.costCache || { purchaseCost: "", fixedCost: "" },
      shopConfig: state.shopConfig || { shopName: "我的门店", industry: "餐饮类" },
      lastBusinessInput: state.lastBusinessInput || { income: "", purchaseCost: "", loss: "", fixedCost: "", otherCost: "", lossOverdue: "", lossOperate: "", lossOther: "" },
      latestDailyReport: state.latestDailyReport || null,
      pushConfig: state.pushConfig || { workHour: "9", workMinute: "0", offHour: "21", offMinute: "0" },
      menuVisibility: state.menuVisibility || {},
    };
    await AsyncStorage.setItem('appData', JSON.stringify(dataToSave));
  } catch (error) {
    console.warn('保存失败', error);
  }
};

const loadAllData = async () => {
  try {
    const data = await AsyncStorage.getItem('appData');
    if (data) return JSON.parse(data);
    return null;
  } catch (error) {
    console.warn('加载失败', error);
    return null;
  }
};

// ===== 样式 =====
const styles = StyleSheet.create({
  safeTop: { height: Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight || 32) },
  headerBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    backgroundColor: BG_CARD,
    borderBottomWidth: 0,
    ...SHADOW,
  },
  // 美化的返回按钮
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(91,109,240,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  // 设置卡片样式
  settingsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
    ...SHADOW,
  },
  settingsGroupTitle: {
    fontSize: 13, color: TEXT_THIRD, marginTop: 12, marginBottom: 8, marginLeft: 4, fontWeight: '500',
  },
  settingsRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14,
    borderBottomWidth: 0.5, borderColor: '#F0F0F0',
  },
  settingsRowLast: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14,
  },
  settingsIcon: { width: 28, marginRight: 12 },
  settingsIconWrap: {
    width: 30, height: 30, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
  },
  settingsIconText: {
    fontSize: 16, fontWeight: 'bold', color: '#4FACFE',
    lineHeight: 18,
  },
  settingsRowText: { fontSize: 15, color: TEXT_MAIN, flex: 1 },
  settingsRight: { fontSize: 13, color: TEXT_THIRD, marginRight: 6 },
  settingsLogoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', padding: 14, borderRadius: 12, marginTop: 16, marginBottom: 12,
    ...SHADOW,
  },
  // 悬浮窗按钮（美化）
  fabButton: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: PRIMARY_COLOR,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: PRIMARY_COLOR, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },
  fabButtonInner: {
    width: 50, height: 50, borderRadius: 25,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: PRIMARY_COLOR,
  },
  pageTitle: { fontSize: 18, fontWeight: '600', color: TEXT_MAIN },
  homeTitle: { fontSize: 22, fontWeight: '700', color: TEXT_MAIN, letterSpacing: 0.5 },
  container: { flex: 1, backgroundColor: BG_PAGE },
  chatScroll: { flex: 1, paddingHorizontal: 12 },
  bubbleLeft: { backgroundColor: BG_CARD, padding: 14, borderRadius: 18, marginVertical: 4, maxWidth: '78%', alignSelf: 'flex-start', ...SHADOW },
  bubbleRight: { backgroundColor: LIGHT_PRIMARY, padding: 14, borderRadius: 18, marginVertical: 4, maxWidth: '78%', alignSelf: 'flex-end', ...SHADOW },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 0,
    borderColor: BORDER_COLOR,
    backgroundColor: BG_CARD,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    ...SHADOW,
  },
  inputBox: { flex: 1, height: 44, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 0, borderRadius: 24, fontSize: 15, backgroundColor: '#F2F4F8', color: TEXT_MAIN },
  sendBtn: { paddingHorizontal: 18, paddingVertical: 10, backgroundColor: PRIMARY_COLOR, borderRadius: 24, marginLeft: 8, ...SHADOW },
  sendTxt: { color: '#fff', fontSize: 14, fontWeight: '500' },
  label: { fontSize: 14, color: TEXT_SECOND, marginTop: 12, marginBottom: 6, fontWeight: '500' },
  formInput: { height: 44, paddingHorizontal: 14, borderWidth: 1, borderColor: BORDER_COLOR, borderRadius: 12, backgroundColor: BG_CARD, color: TEXT_MAIN },
  primaryBtn: { marginTop: 16, height: 48, backgroundColor: PRIMARY_COLOR, borderRadius: 12, justifyContent: 'center', alignItems: 'center', ...SHADOW },
  miniBlueBtn: { paddingHorizontal: 14, paddingVertical: 10, backgroundColor: PRIMARY_COLOR, borderRadius: 8, ...SHADOW },
  loginContainer: { flex: 1, backgroundColor: '#F5F7FA', paddingHorizontal: 24, justifyContent: 'center' },
  loginTitle: { fontSize: 32, fontWeight: '700', color: TEXT_MAIN, marginBottom: 8 },
  loginSubtitle: { fontSize: 16, color: TEXT_SECOND, marginBottom: 32 },
  roleSelector: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 24 },
  roleBtn: { flex: 1, paddingVertical: 12, marginHorizontal: 6, borderRadius: 12, borderWidth: 2, borderColor: BORDER_COLOR, alignItems: 'center' },
  roleBtnActive: { borderColor: PRIMARY_COLOR, backgroundColor: LIGHT_PRIMARY },
  roleText: { fontSize: 16, fontWeight: '500', color: TEXT_MAIN },
  loginBtn: { height: 48, backgroundColor: PRIMARY_COLOR, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 16, ...SHADOW },
  loginBtnText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  codeRow: { flexDirection: 'row', alignItems: 'center' },
  codeInput: { flex: 1 },
  getCodeBtn: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: LIGHT_PRIMARY, borderRadius: 8, marginLeft: 8 },
  getCodeText: { color: PRIMARY_COLOR, fontSize: 14 },
  tagNormal: { paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: BORDER_COLOR, borderRadius: 20, backgroundColor: 'transparent' },
  tagActive: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: PRIMARY_COLOR, borderRadius: 20 },
  cardBox: { backgroundColor: BG_CARD, padding: 16, borderRadius: 16, ...SHADOW },
  listItem: { backgroundColor: BG_CARD, padding: 14, borderRadius: 14, marginVertical: 6, ...SHADOW },
  emojiRow: { height: 44, backgroundColor: BG_CARD, paddingHorizontal: 10, borderTopWidth: 1, borderColor: BORDER_COLOR },
  quickReplyContainer: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingVertical: 6, backgroundColor: BG_CARD, borderBottomWidth: 1, borderColor: BORDER_COLOR },
  quickReplyBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: LIGHT_PRIMARY, borderRadius: 20, marginRight: 8, marginBottom: 6 },
  quickReplyText: { color: PRIMARY_COLOR, fontSize: 13 },
  settingGroup: { marginTop: 16, backgroundColor: BG_CARD, borderRadius: 16, overflow: 'hidden', ...SHADOW },
  settingItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR },
  settingItemLast: { borderBottomWidth: 0 },
  switchAccountContainer: { flex: 1, backgroundColor: BG_PAGE, paddingHorizontal: 16, paddingTop: 20 },
  accountItem: { backgroundColor: BG_CARD, padding: 16, borderRadius: 14, marginVertical: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', ...SHADOW },
  accountInfo: { flex: 1 },
  accountPhone: { fontSize: 16, fontWeight: '500', color: TEXT_MAIN },
  accountDetail: { fontSize: 14, color: TEXT_SECOND, marginTop: 2 },
  registerBtn: { marginTop: 20, height: 48, backgroundColor: PRIMARY_COLOR, borderRadius: 12, justifyContent: 'center', alignItems: 'center', ...SHADOW },
  registerBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  badReviewItem: { backgroundColor: BG_CARD, padding: 14, borderRadius: 14, marginVertical: 6, ...SHADOW },
  badReviewContent: { fontSize: 14, color: TEXT_MAIN },
  badReviewMeta: { fontSize: 12, color: TEXT_THIRD, marginTop: 4 },
  badReviewHandled: { fontSize: 12, color: SUCCESS_COLOR, marginTop: 4, fontWeight: '500' },
  badReviewHandledBtn: { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: SUCCESS_COLOR, borderRadius: 8, marginLeft: 8 },
  badReviewHandledBtnText: { color: '#fff', fontSize: 12 },
  badReviewEmpty: { textAlign: 'center', marginTop: 40, color: TEXT_THIRD, fontSize: 16 },
  imageMessage: { width: 150, height: 150, borderRadius: 12, marginTop: 4 },
  productItem: { backgroundColor: BG_CARD, padding: 14, borderRadius: 14, marginVertical: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', ...SHADOW },
  productName: { fontSize: 16, fontWeight: '500', color: TEXT_MAIN },
  productStock: { fontSize: 14, color: TEXT_SECOND },
  productPlatform: { fontSize: 12, color: TEXT_THIRD },
  editBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: LIGHT_PRIMARY, borderRadius: 8 },
  editBtnText: { color: PRIMARY_COLOR, fontSize: 13, fontWeight: '500' },
  modalMask: { position: 'absolute', zIndex: 9999, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  modalWrap: { width: '100%', maxWidth: 480, backgroundColor: BG_CARD, borderRadius: 24, padding: 24, ...SHADOW },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: TEXT_MAIN },
  closeTxt: { fontSize: 24, color: TEXT_THIRD },
  scannerContainer: { flex: 1 },
  cancelBtn: { position: 'absolute', top: 40, right: 20, backgroundColor: 'rgba(0,0,0,0.7)', padding: 10, borderRadius: 8 },
  cancelText: { color: '#fff', fontSize: 16 },
  reportCard: { backgroundColor: BG_CARD, padding: 16, borderRadius: 16, marginTop: 16, ...SHADOW },
  reportTitle: { fontSize: 16, fontWeight: '600', color: TEXT_MAIN, marginBottom: 8 },
  reportRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  reportLabel: { fontSize: 14, color: TEXT_SECOND },
  reportValue: { fontSize: 14, color: TEXT_MAIN, fontWeight: '500' },
  exportBtn: { marginTop: 8, padding: 10, backgroundColor: PRIMARY_COLOR, borderRadius: 8, alignSelf: 'flex-start', ...SHADOW },
  exportBtnText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  chatSettingItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR },
  chatSettingText: { fontSize: 16, color: TEXT_MAIN, marginLeft: 12 },
  chatSettingDesc: { fontSize: 14, color: TEXT_THIRD, marginLeft: 'auto' },
  voiceModal: { width: '80%', backgroundColor: BG_CARD, borderRadius: 24, padding: 24, alignItems: 'center' },
  miniBtnWithIcon: { width: '31%', paddingVertical: 12, paddingHorizontal: 8, borderRadius: 12, alignItems: 'center', ...SHADOW },
  voiceTextInput: { width: '100%', height: 120, borderWidth: 1, borderColor: BORDER_COLOR, borderRadius: 12, padding: 12, fontSize: 16, textAlignVertical: 'top' },
  menuItem: { width: 110, backgroundColor: BG_CARD, paddingVertical: 16, borderRadius: 16, alignItems: 'center', ...SHADOW },
  staffChatItem: { backgroundColor: BG_CARD, padding: 14, borderRadius: 14, marginVertical: 6, flexDirection: 'row', alignItems: 'center', ...SHADOW },
});

// ================== 登录页面 ==================
const LoginScreen = () => {
  const { state, dispatch } = useApp();
  const navigation = useNavigation();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [role, setRole] = useState('商家');
  const [shopName, setShopName] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const previousAccounts = state.previousAccounts || [];

  useEffect(() => {
    if (!initialized) {
      setInitialized(true);
      if (state.user) {
        navigation.replace('RootTabs');
      }
    }
  }, [state.user, initialized]);

  const handleLogin = async () => {
    if (loading) return;
    setLoading(true);
    try {
      console.log('Login started');
      if (phone.length !== 11) { 
        showToast('请输入11位手机号'); 
        setLoading(false); 
        return; 
      }
      if (code !== '123456') { 
        showToast('验证码错误'); 
        setLoading(false); 
        return; 
      }
      if (!shopName.trim()) { 
        showToast('请输入店铺名称'); 
        setLoading(false); 
        return; 
      }
      console.log('Validation passed');

      const user = { role, phone, shopName, name: role === '员工' ? employeeName.trim() : '老板' };
      const shopInfo = { shopName, phone, industry: '待识别' };

      await AsyncStorage.setItem('user', JSON.stringify(user));
      await AsyncStorage.setItem('shopInfo', JSON.stringify(shopInfo));

      dispatch({ type: 'LOGIN', payload: { user, shopInfo } });
      dispatch({ type: 'ADD_PREVIOUS_ACCOUNT', payload: { phone, role, shopName, name: user.name } });

      if (role === '员工') {
        dispatch({ type: 'ADD_STAFF_APPLICATION', payload: {
          id: Date.now().toString(),
          phone,
          name: employeeName.trim(),
          shopName: shopInfo.shopName,
          status: 'pending',
          role: '员工',
        }});
        showToast('入职申请已发送，请等待商家审核');
      }

      setLoading(false);
      navigation.replace('RootTabs');
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('登录失败', `错误: ${error.message || String(error)}`);
      setLoading(false);
    }
  };

  const handleHistorySelect = async (account) => {
    try {
      const user = { role: account.role, phone: account.phone, shopName: account.shopName, name: account.name || '老板' };
      const shopInfo = { shopName: account.shopName, phone: account.phone, industry: '餐饮类' };
      await AsyncStorage.setItem('user', JSON.stringify(user));
      await AsyncStorage.setItem('shopInfo', JSON.stringify(shopInfo));
      dispatch({ type: 'LOGIN', payload: { user, shopInfo } });
      navigation.replace('RootTabs');
    } catch (error) {
      showToast('切换失败');
    }
  };

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 }} style={{ backgroundColor: '#F5F7FA' }}>
      <Text style={styles.loginTitle}>经营宝</Text>
      <Text style={styles.loginSubtitle}>登录您的店铺账号</Text>
      <Text style={styles.label}>选择角色</Text>
      <View style={styles.roleSelector}>
        {['商家', '员工'].map(r => (
          <TouchableOpacity key={r} style={[styles.roleBtn, role === r && styles.roleBtnActive]} onPress={() => setRole(r)}>
            <Text style={[styles.roleText, role === r && { color: '#fff' }]}>{r}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.label}>手机号</Text>
      <TextInput style={[styles.formInput, { marginBottom: 12 }]} placeholder="请输入手机号" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
      <Text style={styles.label}>验证码</Text>
      <View style={[styles.codeRow, { marginBottom: 16 }]}>
        <TextInput style={[styles.formInput, styles.codeInput]} placeholder="验证码 (123456)" keyboardType="numeric" value={code} onChangeText={setCode} />
        <TouchableOpacity style={styles.getCodeBtn}><Text style={styles.getCodeText}>获取验证码</Text></TouchableOpacity>
      </View>
      <Text style={styles.label}>店铺名称</Text>
      <TextInput style={styles.formInput} placeholder="请输入店铺名称" value={shopName} onChangeText={setShopName} />
      {role === '员工' && (
        <>
          <Text style={styles.label}>员工姓名</Text>
          <TextInput style={styles.formInput} placeholder="请输入您的姓名" value={employeeName} onChangeText={setEmployeeName} />
        </>
      )}
      <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={loading}>
        <Text style={styles.loginBtnText}>{loading ? '登录中...' : '登录'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};
// ===== 第一段结束 =====// ================== 设置抽屉（含推送时间，图标已美化） ==================
// ================== 个人资料编辑页面 ==================
const ProfileEditScreen = ({ navigation }) => {
  const { state, dispatch } = useApp();
  const user = state.user || {};
  const shopInfo = state.shopInfo || {};
  const [name, setName] = useState(user.name || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [gender, setGender] = useState(user.gender || '未设置');
  const [avatar, setAvatar] = useState(user.avatar || '');
  const [region, setRegion] = useState(user.region || '');
  const [signature, setSignature] = useState(user.signature || '');
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  const avatarColors = [
    { bg: '#FF6B6B', text: '白羊' },
    { bg: '#4ECDC4', text: '清新' },
    { bg: '#FFD93D', text: '阳光' },
    { bg: '#6BCB77', text: '自然' },
    { bg: '#4D96FF', text: '海洋' },
    { bg: '#A66CFF', text: '神秘' },
    { bg: '#FF9F45', text: '温暖' },
    { bg: '#95A5A6', text: '商务' },
  ];

  const pickAvatar = () => {
    Alert.alert('选择头像方式', '', [
      { text: '从相册选择', onPress: async () => {
        try {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') { showToast('需要相册权限'); return; }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
          });
          if (!result.canceled) {
            setAvatar(result.assets[0].uri);
          }
        } catch (e) { showToast('选择失败'); }
      }},
      { text: '拍摄头像', onPress: async () => {
        try {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') { showToast('需要相机权限'); return; }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
          });
          if (!result.canceled) {
            setAvatar(result.assets[0].uri);
          }
        } catch (e) { showToast('拍摄失败'); }
      }},
      { text: '使用预设头像', onPress: () => setShowAvatarPicker(true) },
      { text: '取消', style: 'cancel' },
    ]);
  };

  const saveProfile = async () => {
    if (!name.trim()) { showToast('请输入姓名'); return; }
    if (!/^1\d{10}$/.test(phone)) { showToast('请输入有效的手机号'); return; }
    const newUser = { ...user, name: name.trim(), phone, gender, avatar, region, signature };
    const newShopInfo = { ...shopInfo, phone };
    try {
      await AsyncStorage.setItem('user', JSON.stringify(newUser));
      await AsyncStorage.setItem('shopInfo', JSON.stringify(newShopInfo));
      dispatch({ type: 'LOGIN', payload: { user: newUser, shopInfo: newShopInfo } });
      showToast('个人资料已保存');
      navigation.goBack();
    } catch (e) { showToast('保存失败'); }
  };

  const getAvatarText = () => (name || user.name || '?').substring(0, 1);

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: PRIMARY_COLOR }}>
        <View style={[styles.headerBar, { backgroundColor: PRIMARY_COLOR }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8 }}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={[styles.pageTitle, { color: '#fff', flex: 1, textAlign: 'center', marginRight: 32 }]}>个人资料</Text>
        </View>
      </SafeAreaView>
      <ScrollView style={{ flex: 1, backgroundColor: '#F5F7FA' }}>
        <View style={{ backgroundColor: PRIMARY_COLOR, paddingBottom: 30, alignItems: 'center' }}>
          <TouchableOpacity onPress={pickAvatar} style={{ position: 'relative' }}>
            <View style={{ width: 90, height: 90, borderRadius: 45, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 3, borderColor: '#fff' }}>
              {avatar && (avatar.startsWith('http') || avatar.startsWith('file') || avatar.startsWith('data')) ? (
                <Image source={{ uri: avatar }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <Text style={{ fontSize: 36, color: PRIMARY_COLOR, fontWeight: 'bold' }}>{getAvatarText()}</Text>
              )}
            </View>
            <View style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: '#fff', borderRadius: 14, width: 28, height: 28, justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="camera" size={16} color={PRIMARY_COLOR} />
            </View>
          </TouchableOpacity>
          <Text style={{ color: '#fff', marginTop: 10, fontSize: 16, fontWeight: '500' }}>{name || '未设置姓名'}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 4 }}>{user.role || '用户'} · {shopInfo.shopName || '未设置门店'}</Text>
        </View>

        <View style={{ backgroundColor: '#fff', marginTop: -20, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 16, paddingBottom: 40 }}>
          <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
            <Text style={{ fontSize: 13, color: TEXT_THIRD, marginBottom: 8 }}>基本信息</Text>
            <View style={{ backgroundColor: '#F5F7FA', borderRadius: 12, padding: 16 }}>
              <View style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 13, color: TEXT_SECOND, marginBottom: 6 }}>姓名</Text>
                <TextInput style={{ backgroundColor: '#fff', borderRadius: 8, padding: 10, fontSize: 15, color: TEXT_MAIN }} value={name} onChangeText={setName} placeholder="请输入姓名" />
              </View>
              <View style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 13, color: TEXT_SECOND, marginBottom: 6 }}>手机号</Text>
                <TextInput style={{ backgroundColor: '#fff', borderRadius: 8, padding: 10, fontSize: 15, color: TEXT_MAIN }} value={phone} onChangeText={setPhone} placeholder="请输入手机号" keyboardType="phone-pad" maxLength={11} />
              </View>
              <TouchableOpacity style={{ marginBottom: 14 }} onPress={() => setShowGenderPicker(true)}>
                <Text style={{ fontSize: 13, color: TEXT_SECOND, marginBottom: 6 }}>性别</Text>
                <View style={{ backgroundColor: '#fff', borderRadius: 8, padding: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 15, color: TEXT_MAIN }}>{gender}</Text>
                  <Ionicons name="chevron-forward" size={18} color={TEXT_THIRD} />
                </View>
              </TouchableOpacity>
              <View style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 13, color: TEXT_SECOND, marginBottom: 6 }}>地区</Text>
                <TextInput style={{ backgroundColor: '#fff', borderRadius: 8, padding: 10, fontSize: 15, color: TEXT_MAIN }} value={region} onChangeText={setRegion} placeholder="如：北京市朝阳区" />
              </View>
              <View>
                <Text style={{ fontSize: 13, color: TEXT_SECOND, marginBottom: 6 }}>个性签名</Text>
                <TextInput style={{ backgroundColor: '#fff', borderRadius: 8, padding: 10, fontSize: 15, color: TEXT_MAIN, minHeight: 60 }} value={signature} onChangeText={setSignature} placeholder="说点什么吧..." multiline />
              </View>
            </View>
          </View>

          <TouchableOpacity style={{ backgroundColor: PRIMARY_COLOR, marginHorizontal: 16, padding: 14, borderRadius: 25, alignItems: 'center' }} onPress={saveProfile}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>保存修改</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={showGenderPicker} transparent animationType="fade" onRequestClose={() => setShowGenderPicker(false)}>
        <TouchableOpacity activeOpacity={1} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} onPress={() => setShowGenderPicker(false)}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 }}>选择性别</Text>
            {['男', '女', '未设置'].map(g => (
              <TouchableOpacity key={g} style={{ paddingVertical: 14, alignItems: 'center', borderBottomWidth: 1, borderColor: BORDER_COLOR }} onPress={() => { setGender(g); setShowGenderPicker(false); }}>
                <Text style={{ fontSize: 16, color: gender === g ? PRIMARY_COLOR : TEXT_MAIN, fontWeight: gender === g ? 'bold' : 'normal' }}>{g}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={{ paddingVertical: 14, alignItems: 'center', marginTop: 8 }} onPress={() => setShowGenderPicker(false)}>
              <Text style={{ fontSize: 16, color: DANGER_COLOR }}>取消</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showAvatarPicker} transparent animationType="fade" onRequestClose={() => setShowAvatarPicker(false)}>
        <TouchableOpacity activeOpacity={1} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => setShowAvatarPicker(false)}>
          <View style={{ backgroundColor: '#fff', margin: 20, borderRadius: 20, padding: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 }}>选择预设头像</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
              {avatarColors.map((c, idx) => (
                <TouchableOpacity key={idx} style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: c.bg, justifyContent: 'center', alignItems: 'center' }} onPress={() => { setAvatar(c.bg); setShowAvatarPicker(false); }}>
                  <Text style={{ color: '#fff', fontSize: 24, fontWeight: 'bold' }}>{(name || '?').substring(0, 1)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={{ marginTop: 16, alignItems: 'center' }} onPress={() => setShowAvatarPicker(false)}>
              <Text style={{ color: DANGER_COLOR, fontSize: 15 }}>取消</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

// ================== 设置抽屉 ==================
const SettingDrawer = ({ visible, onClose }) => {
  const navigation = useNavigation();
  const { state, dispatch } = useApp();
  const user = state.user;
  const shopInfo = state.shopInfo || { shopName: '', phone: '' };
  const isEmployee = user?.role === '员工';
  const [shopName, setShopName] = useState(shopInfo.shopName || '');
  const [phone, setPhone] = useState(shopInfo.phone || '');
  const [pushConfig, setPushConfig] = useState(state.pushConfig || { workHour: "9", workMinute: "0", offHour: "21", offMinute: "0" });
  const [workH, setWorkH] = useState(pushConfig.workHour);
  const [workM, setWorkM] = useState(pushConfig.workMinute);
  const [offH, setOffH] = useState(pushConfig.offHour);
  const [offM, setOffM] = useState(pushConfig.offMinute);
  const [theme, setTheme] = useState(state.theme || 'light');
  const [language, setLanguage] = useState(state.language || '简体中文');
  const [notifSound, setNotifSound] = useState(state.notifSound !== false);
  const [notifVibrate, setNotifVibrate] = useState(state.notifVibrate !== false);
  const [fontSize, setFontSize] = useState(state.fontSize || '标准');
  const [nightMode, setNightMode] = useState(state.nightMode || false);
  const [showLanguage, setShowLanguage] = useState(false);
  const [showFontSize, setShowFontSize] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showVersion, setShowVersion] = useState(false);
  const [showClearCache, setShowClearCache] = useState(false);
  const [showShopNameEdit, setShowShopNameEdit] = useState(false);
  const [editShopName, setEditShopName] = useState(shopName);

  const saveShop = () => {
    if (isEmployee) { showToast('员工无权修改'); return; }
    const industry = detectIndustry(shopName);
    const updatedShopInfo = { ...shopInfo, shopName, phone, industry };
    dispatch({ type: 'UPDATE_SHOP_INFO', payload: updatedShopInfo });
    dispatch({ type: 'SET_SHOP_CONFIG', payload: { shopName, industry } });
    showToast(`门店信息已保存，类型：${industry}`);
  };

  const savePush = () => {
    if (isEmployee) return;
    const config = { workHour: workH, workMinute: workM, offHour: offH, offMinute: offM };
    dispatch({ type: 'SET_PUSH_CONFIG', payload: config });
    setPushConfig(config);
    showToast("推送时间保存成功");
  };

  const handleLogout = async () => {
    try {
      if (user) {
        dispatch({ type: 'ADD_PREVIOUS_ACCOUNT', payload: { phone: user.phone, role: user.role, shopName: shopInfo.shopName, name: user.name } });
      }
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('shopInfo');
      dispatch({ type: 'LOGOUT' });
      onClose();
    } catch (error) { showToast('退出失败'); }
  };

  const clearCache = () => {
    Alert.alert('清除缓存', '确定要清除所有缓存数据吗？这将删除本地存储的临时数据。', [
      { text: '取消' },
      { text: '清除', style: 'destructive', onPress: () => {
        showToast('缓存已清除（演示）');
        setShowClearCache(false);
      }}
    ]);
  };

  const goToProfile = () => {
    onClose();
    setTimeout(() => {
      if (navigationRef.current) navigationRef.current.navigate('ProfileEdit');
      else navigation.navigate('ProfileEdit');
    }, 200);
  };

  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <TouchableOpacity activeOpacity={1} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', flexDirection: 'row' }} onPress={onClose}>
      <View style={{ flex: 1 }} />
      <View style={{ width: width * 0.75, height: '100%', backgroundColor: '#F5F7FA' }} onStartShouldSetResponder={() => true}>
        <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: PRIMARY_COLOR, paddingTop: 50, paddingBottom: 20, paddingHorizontal: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#fff' }}>系统设置</Text>
            <TouchableOpacity onPress={onClose} style={{ padding: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 16 }}>
              <Ionicons name="close" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={goToProfile} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginRight: 12 }}>
              {user?.avatar && (user.avatar.startsWith('http') || user.avatar.startsWith('file') || user.avatar.startsWith('data')) ? (
                <Image source={{ uri: user.avatar }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <Text style={{ color: PRIMARY_COLOR, fontSize: 24, fontWeight: 'bold' }}>{(user?.name || '?').substring(0, 1)}</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>{user?.name || '未设置'}</Text>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, marginLeft: 6 }}>
                  <Text style={{ color: '#fff', fontSize: 10 }}>{user?.role || '用户'}</Text>
                </View>
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 4 }} numberOfLines={1}>{user?.signature || '点击设置个人资料 →'}</Text>
            </View>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', marginTop: 16, gap: 8 }}>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: 8, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>{(state.goodsList || []).length}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10, marginTop: 2 }}>商品数</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: 8, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>{(state.globalOrderRecord || []).length}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10, marginTop: 2 }}>总订单</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: 8, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>{(state.staffMemberList || []).filter(s => s.status === 'approved').length}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10, marginTop: 2 }}>员工数</Text>
            </View>
          </View>
        </View>

        <View style={{ padding: 12 }}>
          {/* 账户设置组 */}
          <Text style={styles.settingsGroupTitle}>账户设置</Text>
          <View style={styles.settingsCard}>
            <TouchableOpacity style={styles.settingsRow} onPress={goToProfile}>
              <Ionicons name="person-circle-outline" size={22} color={PRIMARY_COLOR} style={styles.settingsIcon} />
              <Text style={styles.settingsRowText}>个人资料</Text>
              <Text style={styles.settingsRight}>{user?.name || '未设置'}</Text>
              <Ionicons name="chevron-forward" size={18} color={TEXT_THIRD} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingsRow} onPress={() => setShowShopNameEdit(true)}>
              <Ionicons name="storefront-outline" size={22} color={PRIMARY_COLOR} style={styles.settingsIcon} />
              <Text style={styles.settingsRowText}>门店信息</Text>
              <Text style={styles.settingsRight} numberOfLines={1}>{shopName || '未设置'}</Text>
              <Ionicons name="chevron-forward" size={18} color={TEXT_THIRD} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingsRowLast} onPress={() => { onClose(); setTimeout(() => { if (navigationRef.current) navigationRef.current.navigate('SwitchAccount'); else navigation.navigate('SwitchAccount'); }, 200); }}>
              <Ionicons name="swap-horizontal-outline" size={22} color={PRIMARY_COLOR} style={styles.settingsIcon} />
              <Text style={styles.settingsRowText}>切换账号</Text>
              <Ionicons name="chevron-forward" size={18} color={TEXT_THIRD} />
            </TouchableOpacity>
          </View>

          {/* 消息通知组 */}
          <Text style={styles.settingsGroupTitle}>消息通知</Text>
          <View style={styles.settingsCard}>
            <View style={styles.settingsRow}>
              <Ionicons name="notifications-outline" size={22} color={PRIMARY_COLOR} style={styles.settingsIcon} />
              <Text style={styles.settingsRowText}>新消息通知</Text>
              <Switch value={notifSound} onValueChange={setNotifSound} trackColor={{ true: PRIMARY_COLOR }} />
            </View>
            <View style={styles.settingsRow}>
              <Ionicons name="volume-high-outline" size={22} color={PRIMARY_COLOR} style={styles.settingsIcon} />
              <Text style={styles.settingsRowText}>提示音</Text>
              <Switch value={notifSound} onValueChange={setNotifSound} trackColor={{ true: PRIMARY_COLOR }} />
            </View>
            <View style={styles.settingsRow}>
              <Ionicons name="phone-portrait-outline" size={22} color={PRIMARY_COLOR} style={styles.settingsIcon} />
              <Text style={styles.settingsRowText}>震动提醒</Text>
              <Switch value={notifVibrate} onValueChange={setNotifVibrate} trackColor={{ true: PRIMARY_COLOR }} />
            </View>
            {!isEmployee && (
              <View style={styles.settingsRowLast}>
                <Ionicons name="time-outline" size={22} color={PRIMARY_COLOR} style={styles.settingsIcon} />
                <Text style={styles.settingsRowText}>推送时间</Text>
                <Text style={styles.settingsRight}>{workH.padStart(2,'0')}:{workM.padStart(2,'0')} - {offH.padStart(2,'0')}:{offM.padStart(2,'0')}</Text>
              </View>
            )}
          </View>
          {!isEmployee && (
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
              <TextInput style={{ flex: 1, backgroundColor: '#fff', borderRadius: 8, padding: 8, fontSize: 13 }} keyboardType="numeric" maxLength={2} value={workH} onChangeText={setWorkH} placeholder="开始时" />
              <TextInput style={{ flex: 1, backgroundColor: '#fff', borderRadius: 8, padding: 8, fontSize: 13 }} keyboardType="numeric" maxLength={2} value={workM} onChangeText={setWorkM} placeholder="开始分" />
              <TextInput style={{ flex: 1, backgroundColor: '#fff', borderRadius: 8, padding: 8, fontSize: 13 }} keyboardType="numeric" maxLength={2} value={offH} onChangeText={setOffH} placeholder="结束时" />
              <TextInput style={{ flex: 1, backgroundColor: '#fff', borderRadius: 8, padding: 8, fontSize: 13 }} keyboardType="numeric" maxLength={2} value={offM} onChangeText={setOffM} placeholder="结束分" />
              <TouchableOpacity style={{ backgroundColor: PRIMARY_COLOR, paddingHorizontal: 12, borderRadius: 8, justifyContent: 'center' }} onPress={savePush}>
                <Text style={{ color: '#fff', fontSize: 12 }}>保存</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 通用设置组 */}
          <Text style={styles.settingsGroupTitle}>通用设置</Text>
          <View style={styles.settingsCard}>
            <TouchableOpacity style={styles.settingsRow} onPress={() => setShowLanguage(true)}>
              <Ionicons name="language-outline" size={22} color={PRIMARY_COLOR} style={styles.settingsIcon} />
              <Text style={styles.settingsRowText}>语言</Text>
              <Text style={styles.settingsRight}>{language}</Text>
              <Ionicons name="chevron-forward" size={18} color={TEXT_THIRD} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingsRow} onPress={() => setShowFontSize(true)}>
              <View style={[styles.settingsIconWrap, { backgroundColor: '#06B6D420' }]}>
                <Ionicons name="resize" size={18} color="#06B6D4" />
              </View>
              <Text style={styles.settingsRowText}>字体大小</Text>
              <Text style={styles.settingsRight}>{fontSize}</Text>
              <Ionicons name="chevron-forward" size={18} color={TEXT_THIRD} />
            </TouchableOpacity>
            <View style={styles.settingsRowLast}>
              <Ionicons name="moon-outline" size={22} color={PRIMARY_COLOR} style={styles.settingsIcon} />
              <Text style={styles.settingsRowText}>深色模式</Text>
              <Switch value={nightMode} onValueChange={(v) => { setNightMode(v); dispatch({ type: 'SET_NIGHT_MODE', payload: v }); }} trackColor={{ true: PRIMARY_COLOR }} />
            </View>
          </View>

          {/* 数据与存储组 */}
          <Text style={styles.settingsGroupTitle}>数据与存储</Text>
          <View style={styles.settingsCard}>
            <TouchableOpacity style={styles.settingsRow}>
              <Ionicons name="cloud-upload-outline" size={22} color={PRIMARY_COLOR} style={styles.settingsIcon} />
              <Text style={styles.settingsRowText}>数据备份</Text>
              <Text style={styles.settingsRight}>已备份</Text>
              <Ionicons name="chevron-forward" size={18} color={TEXT_THIRD} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingsRow}>
              <Ionicons name="cloud-download-outline" size={22} color={PRIMARY_COLOR} style={styles.settingsIcon} />
              <Text style={styles.settingsRowText}>数据恢复</Text>
              <Ionicons name="chevron-forward" size={18} color={TEXT_THIRD} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingsRowLast} onPress={() => setShowClearCache(true)}>
              <Ionicons name="trash-outline" size={22} color={PRIMARY_COLOR} style={styles.settingsIcon} />
              <Text style={styles.settingsRowText}>清除缓存</Text>
              <Text style={styles.settingsRight}>12.4 MB</Text>
              <Ionicons name="chevron-forward" size={18} color={TEXT_THIRD} />
            </TouchableOpacity>
          </View>

          {/* 帮助与关于组 */}
          <Text style={styles.settingsGroupTitle}>帮助与关于</Text>
          <View style={styles.settingsCard}>
            <TouchableOpacity style={styles.settingsRow} onPress={() => setShowHelp(true)}>
              <View style={[styles.settingsIconWrap, { backgroundColor: '#4FACFE20' }]}>
                <Ionicons name="book" size={18} color="#4FACFE" />
              </View>
              <Text style={styles.settingsRowText}>使用帮助</Text>
              <Ionicons name="chevron-forward" size={18} color={TEXT_THIRD} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingsRow} onPress={() => setShowPrivacy(true)}>
              <Ionicons name="shield-checkmark-outline" size={22} color={PRIMARY_COLOR} style={styles.settingsIcon} />
              <Text style={styles.settingsRowText}>隐私政策</Text>
              <Ionicons name="chevron-forward" size={18} color={TEXT_THIRD} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingsRow} onPress={() => setShowAbout(true)}>
              <View style={[styles.settingsIconWrap, { backgroundColor: '#FF9F4520' }]}>
                <Ionicons name="business" size={18} color="#FF9F45" />
              </View>
              <Text style={styles.settingsRowText}>关于我们</Text>
              <Ionicons name="chevron-forward" size={18} color={TEXT_THIRD} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingsRowLast} onPress={() => setShowVersion(true)}>
              <View style={[styles.settingsIconWrap, { backgroundColor: '#5B6DF020' }]}>
                <Ionicons name="code-slash" size={16} color="#5B6DF0" />
              </View>
              <Text style={styles.settingsRowText}>版本信息</Text>
              <Text style={styles.settingsRight}>v 1.0.0</Text>
              <Ionicons name="chevron-forward" size={18} color={TEXT_THIRD} />
            </TouchableOpacity>
          </View>

          {/* 退出登录 */}
          <TouchableOpacity style={styles.settingsLogoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color={DANGER_COLOR} />
            <Text style={{ color: DANGER_COLOR, fontSize: 16, fontWeight: '600', marginLeft: 8 }}>退出登录</Text>
          </TouchableOpacity>

          <View style={{ alignItems: 'center', paddingVertical: 20 }}>
            <Text style={{ color: TEXT_THIRD, fontSize: 11 }}>经营宝 v 1.0.0</Text>
            <Text style={{ color: TEXT_THIRD, fontSize: 11, marginTop: 2 }}>© 2026 智谱AI · Powered by React Native</Text>
          </View>
        </View>
      </ScrollView>

      <Modal visible={showLanguage} transparent animationType="fade" onRequestClose={() => setShowLanguage(false)}>
        <TouchableOpacity activeOpacity={1} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => setShowLanguage(false)}>
          <View style={{ backgroundColor: '#fff', margin: 20, borderRadius: 16, padding: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 }}>选择语言</Text>
            {['简体中文', '繁體中文', 'English', '日本語', '한국어'].map(l => (
              <TouchableOpacity key={l} style={{ paddingVertical: 14, alignItems: 'center', borderBottomWidth: 1, borderColor: BORDER_COLOR }} onPress={() => { setLanguage(l); dispatch({ type: 'SET_LANGUAGE', payload: l }); setShowLanguage(false); showToast(`已切换到${l}`); }}>
                <Text style={{ fontSize: 16, color: language === l ? PRIMARY_COLOR : TEXT_MAIN, fontWeight: language === l ? 'bold' : 'normal' }}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showFontSize} transparent animationType="fade" onRequestClose={() => setShowFontSize(false)}>
        <TouchableOpacity activeOpacity={1} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => setShowFontSize(false)}>
          <View style={{ backgroundColor: '#fff', margin: 20, borderRadius: 16, padding: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 }}>字体大小</Text>
            {['小', '标准', '大', '特大'].map(s => (
              <TouchableOpacity key={s} style={{ paddingVertical: 14, alignItems: 'center', borderBottomWidth: 1, borderColor: BORDER_COLOR }} onPress={() => { setFontSize(s); setShowFontSize(false); showToast(`已设置字体为${s}`); }}>
                <Text style={{ fontSize: s === '小' ? 14 : s === '标准' ? 16 : s === '大' ? 18 : 20, color: fontSize === s ? PRIMARY_COLOR : TEXT_MAIN, fontWeight: fontSize === s ? 'bold' : 'normal' }}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showAbout} transparent animationType="fade" onRequestClose={() => setShowAbout(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: '#fff', width: width * 0.85, borderRadius: 16, padding: 24, alignItems: 'center' }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: PRIMARY_COLOR, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
              <Ionicons name="business" size={48} color="#fff" />
            </View>
            <Text style={{ fontSize: 22, fontWeight: 'bold', color: TEXT_MAIN }}>经营宝</Text>
            <Text style={{ fontSize: 13, color: TEXT_SECOND, marginTop: 4 }}>v 1.0.0</Text>
            <Text style={{ fontSize: 14, color: TEXT_MAIN, marginTop: 16, lineHeight: 22, textAlign: 'center' }}>经营宝是一款专为中小型门店设计的智能管理工具，集成经营分析、AI助手、订单核销、库存管理、顾客服务于一体。\n\n由智谱AI驱动，让门店管理更轻松。</Text>
            <TouchableOpacity style={{ backgroundColor: PRIMARY_COLOR, paddingHorizontal: 30, paddingVertical: 10, borderRadius: 20, marginTop: 16 }} onPress={() => setShowAbout(false)}>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>我知道了</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showPrivacy} transparent animationType="fade" onRequestClose={() => setShowPrivacy(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ flex: 1, backgroundColor: '#fff', margin: 20, marginTop: 80, borderRadius: 16, padding: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold' }}>隐私政策</Text>
              <TouchableOpacity onPress={() => setShowPrivacy(false)}><Ionicons name="close" size={24} color={TEXT_THIRD} /></TouchableOpacity>
            </View>
            <ScrollView>
              <Text style={{ fontSize: 14, color: TEXT_MAIN, lineHeight: 22 }}>{`经营宝隐私政策\n\n1. 信息收集\n我们收集您主动提供的店铺信息、订单数据、库存数据用于为您提供管理服务。\n\n2. 信息使用\n您的数据仅用于经营分析、AI助手回复等核心功能，不会用于其他商业目的。\n\n3. 信息存储\n所有数据存储在您的设备本地，您可随时清除。\n\n4. 信息共享\n我们不会与任何第三方共享您的经营数据。\n\n5. 您的权利\n您可以随时查看、修改、删除您的个人信息和经营数据。\n\n6. 联系我们\n如有问题请通过应用内反馈功能联系我们。\n\n更新日期：2026-01-01`}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showHelp} transparent animationType="fade" onRequestClose={() => setShowHelp(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ flex: 1, backgroundColor: '#fff', margin: 20, marginTop: 80, borderRadius: 16, padding: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.settingsIconWrap, { backgroundColor: '#4FACFE20', marginRight: 10 }]}>
                  <Ionicons name="book" size={18} color="#4FACFE" />
                </View>
                <Text style={{ fontSize: 18, fontWeight: 'bold' }}>使用帮助</Text>
              </View>
              <TouchableOpacity onPress={() => setShowHelp(false)}><Ionicons name="close" size={24} color={TEXT_THIRD} /></TouchableOpacity>
            </View>
            <ScrollView>
              {[
                { icon: 'camera', iconColor: '#5B6DF0', iconBg: '#5B6DF020', q: '如何快速拍照识别商品', a: '在出入库页面点击"拍照识别数量"，可多次拍摄商品图片，AI将自动识别数量。' },
                { icon: 'person-add', iconColor: '#10B981', iconBg: '#10B98120', q: '如何邀请员工加入', a: '员工在自己的手机下载App，注册时选择"员工"角色并填写店名，您的员工管理页面会收到入职申请。' },
                { icon: 'sparkles', iconColor: '#8B5CF6', iconBg: '#8B5CF620', q: 'AI助手能做什么', a: 'AI助手基于您店铺的真实数据，提供经营分析、日报生成、营销文案、海报设计等服务。' },
                { icon: 'swap-horizontal', iconColor: '#F59E0B', iconBg: '#F59E0B20', q: '如何切换账号', a: '在设置页面点击"切换账号"，选择已登录的其他账号或添加新账号。' },
                { icon: 'cloud-upload', iconColor: '#06B6D4', iconBg: '#06B6D420', q: '数据会丢失吗', a: '所有数据保存在本地，建议定期通过"数据备份"功能备份重要数据。' },
                { icon: 'chatbox-ellipses', iconColor: '#EC4899', iconBg: '#EC489920', q: '遇到问题如何反馈', a: '通过设置页面的"意见反馈"功能提交问题，我们会尽快处理。' },
              ].map((item, idx) => (
                <View key={idx} style={{ marginBottom: 14, padding: 12, backgroundColor: '#F5F7FA', borderRadius: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[styles.settingsIconWrap, { width: 24, height: 24, backgroundColor: item.iconBg, marginRight: 8 }]}>
                      <Ionicons name={item.icon} size={14} color={item.iconColor} />
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: PRIMARY_COLOR, flex: 1 }}>{item.q}</Text>
                  </View>
                  <Text style={{ fontSize: 13, color: TEXT_MAIN, marginTop: 6, lineHeight: 20, paddingLeft: 32 }}>{item.a}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showVersion} transparent animationType="fade" onRequestClose={() => setShowVersion(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: '#fff', width: width * 0.85, borderRadius: 16, padding: 24, alignItems: 'center' }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: PRIMARY_COLOR, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
              <Ionicons name="rocket" size={40} color="#fff" />
            </View>
            <Text style={{ fontSize: 22, fontWeight: 'bold', color: TEXT_MAIN }}>经营宝 v 1.0.0</Text>
            <View style={{ width: '100%', marginTop: 16 }}>
              {[
                ['版本号', '1.0.0'],
                ['构建号', '20260301'],
                ['更新日期', '2026-03-01'],
                ['运行平台', Platform.OS],
                ['开发者', '智谱AI团队'],
              ].map(([k, v], idx) => (
                <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: idx < 4 ? 1 : 0, borderColor: BORDER_COLOR }}>
                  <Text style={{ fontSize: 14, color: TEXT_SECOND }}>{k}</Text>
                  <Text style={{ fontSize: 14, color: TEXT_MAIN, fontWeight: '500' }}>{v}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity style={{ backgroundColor: PRIMARY_COLOR, paddingHorizontal: 30, paddingVertical: 10, borderRadius: 20, marginTop: 16 }} onPress={() => setShowVersion(false)}>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>检查更新</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showClearCache} transparent animationType="fade" onRequestClose={() => setShowClearCache(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: '#fff', width: width * 0.85, borderRadius: 16, padding: 24, alignItems: 'center' }}>
            <Ionicons name="trash-outline" size={48} color={DANGER_COLOR} />
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginTop: 12, color: TEXT_MAIN }}>清除缓存</Text>
            <Text style={{ fontSize: 14, color: TEXT_SECOND, marginTop: 8, textAlign: 'center' }}>当前缓存大小：12.4 MB{'\n'}清除缓存不会删除您的经营数据</Text>
            <View style={{ flexDirection: 'row', marginTop: 20, gap: 12 }}>
              <TouchableOpacity style={{ flex: 1, paddingVertical: 10, backgroundColor: '#F5F7FA', borderRadius: 8, alignItems: 'center' }} onPress={() => setShowClearCache(false)}>
                <Text style={{ color: TEXT_MAIN, fontSize: 14 }}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, paddingVertical: 10, backgroundColor: DANGER_COLOR, borderRadius: 8, alignItems: 'center' }} onPress={clearCache}>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>清除</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showShopNameEdit} transparent animationType="fade" onRequestClose={() => setShowShopNameEdit(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' }}>
          <View style={{ backgroundColor: '#fff', margin: 20, borderRadius: 16, padding: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold' }}>编辑门店信息</Text>
              <TouchableOpacity onPress={() => setShowShopNameEdit(false)}><Ionicons name="close" size={24} color={TEXT_THIRD} /></TouchableOpacity>
            </View>
            <Text style={{ fontSize: 13, color: TEXT_SECOND, marginBottom: 6 }}>门店名称</Text>
            <TextInput style={{ backgroundColor: '#F5F7FA', borderRadius: 8, padding: 12, fontSize: 15, color: TEXT_MAIN, marginBottom: 12 }} value={editShopName} onChangeText={setEditShopName} placeholder="输入门店名称" />
            <Text style={{ fontSize: 13, color: TEXT_SECOND, marginBottom: 6 }}>绑定手机号</Text>
            <TextInput style={{ backgroundColor: '#F5F7FA', borderRadius: 8, padding: 12, fontSize: 15, color: TEXT_MAIN, marginBottom: 16 }} value={phone} onChangeText={setPhone} placeholder="输入手机号" keyboardType="phone-pad" maxLength={11} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity style={{ flex: 1, paddingVertical: 12, backgroundColor: '#F5F7FA', borderRadius: 8, alignItems: 'center' }} onPress={() => setShowShopNameEdit(false)}>
                <Text style={{ color: TEXT_MAIN, fontSize: 14 }}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, paddingVertical: 12, backgroundColor: PRIMARY_COLOR, borderRadius: 8, alignItems: 'center' }} onPress={() => { setShopName(editShopName); saveShop(); setShowShopNameEdit(false); }}>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>保存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
    </TouchableOpacity>
    </Modal>
  );
};

// ================== 切换账号页面（保留兼容性） ==================
const SwitchAccountScreen = ({ navigation }) => {
  return <SwitchAccountPage navigation={navigation} />;
};


// ================== 切换账号弹窗（独立 Modal 组件，可在设置中直接弹出） ==================
// ================== 切换账号页面（全屏） ==================
const SwitchAccountPage = ({ navigation }) => {
  const { state, dispatch } = useApp();
  const currentUser = state.user;
  const previousAccounts = state.previousAccounts || [];

  const handleSelect = async (account) => {
    try {
      const user = { role: account.role, phone: account.phone, shopName: account.shopName, name: account.name || '老板' };
      const shopInfo = { shopName: account.shopName, phone: account.phone, industry: '餐饮类' };
      await AsyncStorage.setItem('user', JSON.stringify(user));
      await AsyncStorage.setItem('shopInfo', JSON.stringify(shopInfo));
      dispatch({ type: 'LOGIN', payload: { user, shopInfo } });
      showToast(`已切换到 ${account.phone}`);
      navigation.goBack();
    } catch (error) {
      showToast('切换失败');
    }
  };

  const handleLoginOther = async () => {
    try {
      if (currentUser) {
        dispatch({ type: 'ADD_PREVIOUS_ACCOUNT', payload: { phone: currentUser.phone, role: currentUser.role, shopName: currentUser.shopName, name: currentUser.name } });
      }
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('shopInfo');
      dispatch({ type: 'LOGOUT' });
      navigation.goBack();
      setTimeout(() => {
        if (navigationRef.current) {
          navigationRef.current.reset({ index: 0, routes: [{ name: 'Login' }] });
        }
      }, 100);
    } catch (error) {
      showToast('操作失败');
    }
  };

  const handleDeleteAccount = (phone) => {
    Alert.alert('删除账号', `确定要删除账号 ${phone} 吗？`, [
      { text: '取消' },
      { text: '删除', style: 'destructive', onPress: () => {
        const newList = previousAccounts.filter(a => a.phone !== phone);
        dispatch({ type: 'SET_PREVIOUS_ACCOUNTS', payload: newList });
        showToast('已删除');
      }}
    ]);
  };

  const allAccounts = [];
  if (currentUser) allAccounts.push({ phone: currentUser.phone, role: currentUser.role, shopName: currentUser.shopName, name: currentUser.name, isCurrent: true });
  previousAccounts.forEach(acc => {
    if (!allAccounts.find(a => a.phone === acc.phone)) allAccounts.push({ ...acc, isCurrent: false });
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F7FA' }}>
      <View style={[styles.headerBar, { backgroundColor: PRIMARY_COLOR }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8 }}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#fff', flex: 1, textAlign: 'center', marginRight: 32 }}>切换账号</Text>
      </View>
      <ScrollView style={{ flex: 1, padding: 16 }}>
        {allAccounts.length === 0 ? (
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 40, alignItems: 'center', marginTop: 40 }}>
            <Ionicons name="person-outline" size={48} color={TEXT_THIRD} />
            <Text style={{ color: TEXT_THIRD, marginTop: 12 }}>暂无账号</Text>
          </View>
        ) : (
          allAccounts.map((acc, idx) => (
            <View key={idx} style={{ backgroundColor: acc.isCurrent ? LIGHT_PRIMARY : '#fff', borderRadius: 12, padding: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderWidth: acc.isCurrent ? 1 : 0, borderColor: PRIMARY_COLOR }}>
              <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: PRIMARY_COLOR, justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
                <Ionicons name="person" size={28} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: TEXT_MAIN }}>{acc.phone}{acc.isCurrent ? ' (当前)' : ''}</Text>
                <Text style={{ fontSize: 12, color: TEXT_SECOND, marginTop: 4 }}>{acc.shopName} · {acc.role}</Text>
              </View>
              {acc.isCurrent ? (
                <View style={{ backgroundColor: SUCCESS_COLOR, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 }}>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>使用中</Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity style={{ backgroundColor: PRIMARY_COLOR, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14 }} onPress={() => handleSelect(acc)}>
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>切换</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={{ backgroundColor: '#F0F0F0', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 14 }} onPress={() => handleDeleteAccount(acc.phone)}>
                    <Ionicons name="trash-outline" size={16} color={DANGER_COLOR} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
      <View style={{ padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderColor: BORDER_COLOR }}>
        <TouchableOpacity style={{ backgroundColor: PRIMARY_COLOR, padding: 14, borderRadius: 12, alignItems: 'center' }} onPress={handleLoginOther}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>+ 添加新账号 / 登录其他账号</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ================== 差评列表 ==================
const BadReviewListPage = () => {
  const navigation = useNavigation();
  const { state, dispatch } = useApp();
  const list = state.badReviewList || [];
  const handleMark = (id) => {
    dispatch({ type: 'MARK_BAD_REVIEW_HANDLED', payload: id });
    showToast('已标记为已处理');
  };
  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: BG_CARD }}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => navigation.goBack()}><Text style={{ fontSize: 20 }}>&lt;</Text></TouchableOpacity>
          <Text style={styles.pageTitle}>差评预警详情</Text>
          <View style={{ width: 24 }} />
        </View>
      </SafeAreaView>
      <ScrollView style={{ padding: 16 }}>
        {list.length === 0 ? (
          <Text style={styles.badReviewEmpty}>✅ 暂无差评，继续保持！</Text>
        ) : (
          list.map(item => (
            <View key={item.id} style={styles.badReviewItem}>
              <Text style={styles.badReviewContent}>“{item.content}”</Text>
              <Text style={styles.badReviewMeta}>平台：{item.platform} ｜ {item.time}</Text>
              {item.handled ? (
                <Text style={styles.badReviewHandled}>✅ 已处理</Text>
              ) : (
                <TouchableOpacity style={styles.badReviewHandledBtn} onPress={() => handleMark(item.id)}>
                  <Text style={styles.badReviewHandledBtnText}>标记已处理</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

// ================== 商品管理 ==================
const ProductOverview = () => {
  const navigation = useNavigation();
  const { state, dispatch } = useApp();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [name, setName] = useState('');
  const [stock, setStock] = useState('');
  const [platform, setPlatform] = useState('美团');

  const handleSave = () => {
    try {
      if (!name.trim()) { showToast('请输入商品名称'); return; }
      const stockNum = parseInt(stock) || 0;
      if (editingItem) {
        const updated = (state.goodsList || []).map(item =>
          item.id === editingItem.id ? { ...item, name: name.trim(), stock: stockNum, platform } : item
        );
        dispatch({ type: 'SET_GOODS_LIST', payload: updated });
        showToast('已更新');
      } else {
        const newItem = {
          id: Date.now().toString(),
          name: name.trim(),
          stock: stockNum,
          platform,
          createdAt: new Date().toISOString(),
        };
        dispatch({ type: 'SET_GOODS_LIST', payload: [...(state.goodsList || []), newItem] });
        showToast('添加成功');
      }
      setModalVisible(false);
      setName('');
      setStock('');
      setEditingItem(null);
    } catch (error) {
      showToast('操作失败');
    }
  };

  const handleDelete = (id) => {
    Alert.alert('确认删除', '确定删除该商品？', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => {
        try {
          dispatch({ type: 'SET_GOODS_LIST', payload: (state.goodsList || []).filter(item => item.id !== id) });
          showToast('已删除');
        } catch (error) { showToast('删除失败'); }
      }}
    ]);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setName(item.name);
    setStock(String(item.stock));
    setPlatform(item.platform || '美团');
    setModalVisible(true);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: BG_CARD }}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => navigation.goBack()}><Text style={{ fontSize: 20 }}>&lt;</Text></TouchableOpacity>
          <Text style={styles.pageTitle}>商品总览</Text>
          <TouchableOpacity onPress={() => { setEditingItem(null); setName(''); setStock(''); setPlatform('美团'); setModalVisible(true); }}>
            <Ionicons name="add-outline" size={24} color={PRIMARY_COLOR} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
      <FlatList
        data={state.goodsList || []}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={[styles.productItem, { borderColor: item.stock < 5 ? DANGER_COLOR : 'transparent', borderWidth: item.stock < 5 ? 2 : 0 }]}>
            <View>
              <Text style={styles.productName}>{item.name}</Text>
              <Text style={styles.productPlatform}>平台: {item.platform}</Text>
              <Text style={[styles.productStock, { color: item.stock < 5 ? DANGER_COLOR : TEXT_SECOND }]}>库存: {item.stock} {item.stock < 5 && '⚠️'}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}><Text style={styles.editBtnText}>编辑</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.editBtn, { backgroundColor: DANGER_COLOR }]} onPress={() => handleDelete(item.id)}><Text style={{ color: '#fff', fontSize: 13, fontWeight: '500' }}>删除</Text></TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 40, color: TEXT_THIRD }}>暂无商品，点击右上角➕添加</Text>}
        contentContainerStyle={{ padding: 16 }}
      />
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalMask}>
          <View style={styles.modalWrap}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingItem ? '编辑商品' : '添加商品'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}><Text style={styles.closeTxt}>✕</Text></TouchableOpacity>
            </View>
            <Text style={styles.label}>商品名称</Text>
            <TextInput style={styles.formInput} value={name} onChangeText={setName} placeholder="例如：招牌牛肉面" />
            <Text style={styles.label}>库存</Text>
            <TextInput style={styles.formInput} value={stock} onChangeText={setStock} keyboardType="numeric" placeholder="数量" />
            <Text style={styles.label}>平台</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
              {['美团', '抖音', '大众点评'].map(p => (
                <TouchableOpacity key={p} style={[styles.tagNormal, platform === p && styles.tagActive]} onPress={() => setPlatform(p)}>
                  <Text style={{ color: platform === p ? '#fff' : TEXT_MAIN }}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleSave}>
              <Text style={styles.sendTxt}>{editingItem ? '更新' : '添加'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ================== 出入库管理 ==================
const StockManage = () => {
  const navigation = useNavigation();
  const { state, dispatch } = useApp();
  const isEmployee = state.user?.role === '员工';
  const [modalVisible, setModalVisible] = useState(false);
  const [type, setType] = useState('入库');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [selectedGoodsId, setSelectedGoodsId] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [photoUris, setPhotoUris] = useState([]);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualProductName, setManualProductName] = useState('');
  const [manualPlatform, setManualPlatform] = useState('美团');
  const [loadingPlatform, setLoadingPlatform] = useState(null);
  const [voiceModalVisible, setVoiceModalVisible] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [aiCountModalVisible, setAiCountModalVisible] = useState(false);
  const [aiCountPhotos, setAiCountPhotos] = useState([]);
  const [aiCountResult, setAiCountResult] = useState(null);
  const [aiCountLoading, setAiCountLoading] = useState(false);

  const goodsOptions = (state.goodsList || []).map(g => ({ label: g.name, value: g.id }));
  
  const sortedGoods = [...(state.goodsList || [])].sort((a, b) => {
    if (sortBy === 'name') {
      return sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
    } else if (sortBy === 'stock') {
      return sortOrder === 'asc' ? a.stock - b.stock : b.stock - a.stock;
    } else if (sortBy === 'platform') {
      return sortOrder === 'asc' ? a.platform.localeCompare(b.platform) : b.platform.localeCompare(a.platform);
    }
    return 0;
  });

  const voiceInput = () => {
    setVoiceModalVisible(true);
    setVoiceText('');
  };

  const confirmVoice = () => {
    if (voiceText.trim()) {
      setManualProductName(voiceText.trim());
      setShowManualInput(true);
      setModalVisible(true);
      setVoiceModalVisible(false);
      setVoiceText('');
    } else {
      showToast('请输入商品名称');
    }
  };

  const handleManualSubmit = () => {
    if (!manualProductName.trim()) { showToast('请输入商品名称'); return; }
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) { showToast('请输入有效数量'); return; }
    let existing = (state.goodsList || []).find(g => g.name === manualProductName.trim() && g.platform === manualPlatform);
    if (existing) {
      let newStock = existing.stock;
      if (type === '入库') newStock += qty;
      else {
        if (existing.stock < qty) { showToast('库存不足'); return; }
        newStock -= qty;
      }
      const updatedGoods = (state.goodsList || []).map(g =>
        g.id === existing.id ? { ...g, stock: newStock } : g
      );
      dispatch({ type: 'SET_GOODS_LIST', payload: updatedGoods });
      const record = {
        id: Date.now().toString(),
        type,
        productName: existing.name,
        quantity: qty,
        reason: reason.trim() || '无备注',
        time: new Date().toISOString(),
        photo: photoUris.length > 0 ? photoUris[0] : null,
      };
      dispatch({ type: 'ADD_STOCK_RECORD', payload: record });
      showToast(`${type}成功: ${existing.name} ×${qty}`);
    } else {
      const newItem = {
        id: Date.now().toString(),
        name: manualProductName.trim(),
        stock: type === '入库' ? qty : 0,
        platform: manualPlatform,
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: 'SET_GOODS_LIST', payload: [...(state.goodsList || []), newItem] });
      const record = {
        id: Date.now().toString(),
        type,
        productName: newItem.name,
        quantity: qty,
        reason: reason.trim() || '无备注',
        time: new Date().toISOString(),
        photo: photoUris.length > 0 ? photoUris[0] : null,
      };
      dispatch({ type: 'ADD_STOCK_RECORD', payload: record });
      showToast(`新增商品并${type}成功: ${newItem.name} ×${qty}`);
    }
    setModalVisible(false);
    setQuantity('');
    setReason('');
    setSelectedGoodsId(null);
    setPhotoUris([]);
    setManualProductName('');
    setShowManualInput(false);
  };

  const handleSubmit = () => {
    if (!selectedGoodsId) { showToast('请选择商品'); return; }
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) { showToast('请输入有效数量'); return; }
    const goods = (state.goodsList || []).find(g => g.id === selectedGoodsId);
    if (!goods) { showToast('商品不存在'); return; }
    let newStock = goods.stock;
    if (type === '入库') newStock += qty;
    else {
      if (goods.stock < qty) { showToast('库存不足'); return; }
      newStock -= qty;
    }
    const updatedGoods = (state.goodsList || []).map(g =>
      g.id === selectedGoodsId ? { ...g, stock: newStock } : g
    );
    dispatch({ type: 'SET_GOODS_LIST', payload: updatedGoods });
    const record = {
      id: Date.now().toString(),
      type,
      productName: goods.name,
      quantity: qty,
      reason: reason.trim() || '无备注',
      time: new Date().toISOString(),
      photo: photoUris.length > 0 ? photoUris[0] : null,
    };
    dispatch({ type: 'ADD_STOCK_RECORD', payload: record });
    showToast(`${type}成功: ${goods.name} ×${qty}`);
    setModalVisible(false);
    setQuantity('');
    setReason('');
    setSelectedGoodsId(null);
    setPhotoUris([]);
  };

  const [outQuantity, setOutQuantity] = useState('');
  const [outModalGoods, setOutModalGoods] = useState(null);

  const handleQuickOut = (goods) => {
    if (goods.stock <= 0) {
      showToast('库存不足');
      return;
    }
    setOutQuantity('1');
    setOutModalGoods(goods);
  };

  const confirmQuickOut = () => {
    if (!outModalGoods) return;
    const qty = parseInt(outQuantity);
    if (isNaN(qty) || qty <= 0) {
      showToast('请输入有效数量');
      return;
    }
    if (qty > outModalGoods.stock) {
      showToast('出库数量超过库存');
      return;
    }
    const newStock = outModalGoods.stock - qty;
    const updatedGoods = (state.goodsList || []).map(g =>
      g.id === outModalGoods.id ? { ...g, stock: newStock } : g
    );
    dispatch({ type: 'SET_GOODS_LIST', payload: updatedGoods });
    const record = {
      id: Date.now().toString(),
      type: '出库',
      productName: outModalGoods.name,
      quantity: qty,
      reason: '快速出库',
      time: new Date().toISOString(),
      photo: null,
    };
    dispatch({ type: 'ADD_STOCK_RECORD', payload: record });
    showToast(`出库成功: ${outModalGoods.name} ×${qty}`);
    setOutModalGoods(null);
    setOutQuantity('');
  };

  const handleScan = async () => {
    try {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      if (status !== 'granted') { showToast('需要相机权限'); return; }
      setScanning(true);
    } catch (error) { showToast('扫码失败'); }
  };

  const handleBarCodeScanned = ({ data }) => {
    setScanning(false);
    const matched = (state.goodsList || []).find(g => g.code === data);
    if (matched) {
      setSelectedGoodsId(matched.id);
      if (type === '出库') {
        if (matched.stock <= 0) {
          showToast('库存不足');
          return;
        }
        Alert.alert(
          '确认出库',
          `商品：${matched.name}\n当前库存：${matched.stock}\n请输入出库数量`,
          [
            { text: '取消' },
            { text: '确认出库', onPress: () => {
              const qty = 1;
              const newStock = matched.stock - qty;
              const updatedGoods = (state.goodsList || []).map(g =>
                g.id === matched.id ? { ...g, stock: newStock } : g
              );
              dispatch({ type: 'SET_GOODS_LIST', payload: updatedGoods });
              const record = {
                id: Date.now().toString(),
                type: '出库',
                productName: matched.name,
                quantity: qty,
                reason: '扫码出库',
                time: new Date().toISOString(),
                photo: null,
              };
              dispatch({ type: 'ADD_STOCK_RECORD', payload: record });
              showToast(`出库成功: ${matched.name} ×${qty}`);
            }}
          ]
        );
      } else {
        showToast(`扫描到商品：${matched.name}`);
      }
    } else {
      Alert.alert('扫描结果', `条码：${data}\n未找到匹配商品，请手动选择或手动录入`, [
        { text: '手动录入', onPress: () => { setShowManualInput(true); setModalVisible(true); } },
        { text: '确定' }
      ]);
    }
  };

  const pickPhotos = async (source) => {
    try {
      let result;
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') { showToast('需要相机权限'); return; }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          quality: 0.7,
        });
        if (!result.canceled) {
          const compressed = await compressImage(result.assets[0].uri);
          setPhotoUris([compressed]);
          if (type === '入库') {
            setShowManualInput(true);
            setModalVisible(true);
            setManualProductName('');
            setQuantity('');
          } else {
            if (!modalVisible) setModalVisible(true);
          }
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { showToast('需要相册权限'); return; }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          quality: 0.7,
          selectionLimit: 10,
        });
        if (!result.canceled) {
          const compressedUris = await Promise.all(result.assets.map(a => compressImage(a.uri)));
          setPhotoUris(compressedUris);
          if (type === '入库') {
            setShowManualInput(true);
            setModalVisible(true);
            setManualProductName('');
            setQuantity('');
          } else {
            if (!modalVisible) setModalVisible(true);
          }
        }
      }
    } catch (error) { showToast('选择图片失败'); }
  };

  const handleAICount = async () => {
    setAiCountPhotos([]);
    setAiCountResult(null);
    setAiCountModalVisible(true);
  };

  const aiCountAddPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { showToast('需要相机权限'); return; }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6 });
      if (!result.canceled) {
        const compressed = await compressImage(result.assets[0].uri);
        setAiCountPhotos(prev => [...prev, compressed]);
      }
    } catch (e) { showToast('拍照失败'); }
  };

  const aiCountRecognize = async () => {
    if (aiCountPhotos.length === 0) { showToast('请先拍照'); return; }
    setAiCountLoading(true);
    try {
      const existingDetails = aiCountResult?.details || [];
      const startIdx = existingDetails.length;
      const newPhotos = aiCountPhotos.slice(startIdx);
      if (newPhotos.length === 0) {
        showToast('所有照片已识别完成');
        setAiCountLoading(false);
        return;
      }
      const newDetails = [...existingDetails];
      // 串行识别 + 即时更新
      for (let i = 0; i < newPhotos.length; i++) {
        const photoIdx = startIdx + i;
        let count = 0;
        let success = false;
        try {
          // 智谱GLM-4V视觉模型识别 - 加入重试
          const prompt = `数清图片中独立物品的总数。规则：\n1. 只数完整清晰可见的物品\n2. 散件按单个计算\n3. 包装按整包装数计算\n4. 必须只返回纯阿拉伯数字,不要其他任何内容`;
          let reply = null;
          // 最多重试 2 次
          for (let retry = 0; retry < 2; retry++) {
            try {
              reply = await fetchZhipuVision(newPhotos[i], prompt);
              if (reply && reply !== 'aborted') break;
            } catch (err) {
              if (retry === 1) throw err;
              await new Promise(r => setTimeout(r, 500));
            }
          }
          if (reply && reply !== 'aborted') {
            const num = parseInt((reply || '').replace(/[^\d]/g, ''));
            if (!isNaN(num) && num > 0 && num < 10000) {
              count = num;
              success = true;
            }
          }
        } catch (e) {
          console.warn(`第${photoIdx + 1}张识别失败:`, e);
        }
        newDetails.push({ photoIndex: photoIdx + 1, count, success });
        // 流式更新（每张识别完立即显示）
        const total = newDetails.reduce((sum, d) => sum + d.count, 0);
        const goodsOptions = (state.goodsList || []);
        setAiCountResult({ total, details: [...newDetails], photos: newDetails.length, goodsOptions });
      }
      const total = newDetails.reduce((sum, d) => sum + d.count, 0);
      const failed = newDetails.filter(d => !d.success).length;
      if (failed > 0) {
        showToast(`识别完成 ${total} 件，${failed}张失败可点击重新识别`);
      } else if (total > 0) {
        showToast(`识别完成，共 ${total} 件商品`);
      } else {
        showToast('识别失败，请确保照片清晰后重试');
      }
    } catch (e) {
      console.error('AI识别失败:', e);
      showToast('识别失败，请重试');
    } finally {
      setAiCountLoading(false);
    }
  };

  const [aiCountSelectedGoodsId, setAiCountSelectedGoodsId] = useState(null);

  const aiCountSubmit = () => {
    if (!aiCountResult || aiCountResult.total === 0) { showToast('请先拍照识别数量'); return; }
    if (!aiCountSelectedGoodsId) { showToast('请选择出库的商品'); return; }
    const goods = (state.goodsList || []).find(g => g.id === aiCountSelectedGoodsId);
    if (!goods) { showToast('商品不存在'); return; }
    if (aiCountResult.total > goods.stock) {
      showToast(`识别数量 ${aiCountResult.total} 超过库存 ${goods.stock}，请先入库`);
      return;
    }
    const newStock = goods.stock - aiCountResult.total;
    const updatedGoods = (state.goodsList || []).map(g => g.id === goods.id ? { ...g, stock: newStock } : g);
    dispatch({ type: 'SET_GOODS_LIST', payload: updatedGoods });
    dispatch({ type: 'ADD_STOCK_RECORD', payload: {
      id: Date.now().toString(),
      type: '出库',
      productName: goods.name,
      quantity: aiCountResult.total,
      reason: 'AI拍照识别数量出库',
      time: new Date().toISOString(),
      photo: null,
    }});
    showToast(`已出库: ${goods.name} ×${aiCountResult.total}`);
    setAiCountModalVisible(false);
    setAiCountPhotos([]);
    setAiCountResult(null);
    setAiCountSelectedGoodsId(null);
  };

  const handleShelf = async (platform, goodsId) => {
    try {
      if (!goodsId) { showToast('请先选择商品'); return; }
      const goods = (state.goodsList || []).find(g => g.id === goodsId);
      if (!goods) { showToast('商品不存在'); return; }
      setLoadingPlatform(platform);
      const prompt = `请将以下商品信息转换为适合${platform}平台的上架格式，包含标题、价格、库存、描述和宣传语。名称：${goods.name}，库存：${goods.stock}。`;
      const reply = await fetchZhipuChat([{ role: 'user', content: prompt }], '你是一个电商上架助手。');
      Alert.alert(`上架到${platform}`, reply);
      showToast(`已成功生成${platform}上架内容`);
    } catch (error) {
      showToast(`${platform}上架生成失败`);
    } finally {
      setLoadingPlatform(null);
    }
  };

  const handleShelfAll = async (goodsId) => {
    try {
      if (!goodsId) { showToast('请先选择商品'); return; }
      const goods = (state.goodsList || []).find(g => g.id === goodsId);
      if (!goods) { showToast('商品不存在'); return; }
      setLoadingPlatform('all');
      const prompt = `请将以下商品信息分别生成适合美团、抖音、大众点评三个平台的上架格式，每个平台用分隔线隔开，包含标题、价格、库存、描述和宣传语。名称：${goods.name}，库存：${goods.stock}。`;
      const reply = await fetchZhipuChat([{ role: 'user', content: prompt }], '你是一个电商上架助手，擅长多平台格式转换。');
      Alert.alert('一键上架所有平台', reply);
      showToast('已生成所有平台上架内容');
    } catch (error) {
      showToast('一键上架生成失败');
    } finally {
      setLoadingPlatform(null);
    }
  };

  if (scanning) {
    return (
      <View style={styles.scannerContainer}>
        <BarCodeScanner onBarCodeScanned={handleBarCodeScanned} style={StyleSheet.absoluteFillObject} />
        <TouchableOpacity style={styles.cancelBtn} onPress={() => setScanning(false)}><Text style={styles.cancelText}>取消扫描</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: BG_CARD }}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => navigation.goBack()}><Text style={{ fontSize: 20 }}>&lt;</Text></TouchableOpacity>
          <Text style={styles.pageTitle}>出入库管理</Text>
          <TouchableOpacity onPress={() => { setType('入库'); setSelectedGoodsId(null); setQuantity(''); setReason(''); setPhotoUris([]); setModalVisible(true); setShowManualInput(false); setManualProductName(''); }}>
            <Ionicons name="add-outline" size={24} color={PRIMARY_COLOR} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 8 }}>
        <TouchableOpacity style={[styles.miniBtnWithIcon, { backgroundColor: PRIMARY_COLOR }]} onPress={() => { setType('入库'); handleScan(); }}>
          <Ionicons name="qr-code-outline" size={20} color="#fff" />
          <Text style={{ fontSize: 12, color: '#fff', marginTop: 4 }}>扫码入库</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.miniBtnWithIcon, { backgroundColor: DANGER_COLOR }]} onPress={() => { setType('出库'); handleScan(); }}>
          <Ionicons name="qr-code-outline" size={20} color="#fff" />
          <Text style={{ fontSize: 12, color: '#fff', marginTop: 4 }}>扫码出库</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.miniBtnWithIcon, { backgroundColor: PRIMARY_COLOR }]} onPress={() => { setType('入库'); pickPhotos('camera'); }}>
          <Ionicons name="camera-outline" size={20} color="#fff" />
          <Text style={{ fontSize: 12, color: '#fff', marginTop: 4 }}>拍照入库</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.miniBtnWithIcon, { backgroundColor: PRIMARY_COLOR }]} onPress={() => { setType('入库'); pickPhotos('library'); }}>
          <Ionicons name="images-outline" size={20} color="#fff" />
          <Text style={{ fontSize: 12, color: '#fff', marginTop: 4 }}>相册入库</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.miniBtnWithIcon, { backgroundColor: DANGER_COLOR }]} onPress={() => { setType('出库'); handleAICount(); }}>
          <Ionicons name="camera-outline" size={20} color="#fff" />
          <Text style={{ fontSize: 12, color: '#fff', marginTop: 4 }}>拍照识别数量</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.miniBtnWithIcon, { backgroundColor: SUCCESS_COLOR }]} onPress={() => { setType('入库'); setShowManualInput(true); setModalVisible(true); }}>
          <Ionicons name="keyboard-outline" size={20} color="#fff" />
          <Text style={{ fontSize: 12, color: '#fff', marginTop: 4 }}>手动录入</Text>
        </TouchableOpacity>
      </View>
      {!isEmployee && (
      <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
        <Text style={{ fontWeight: '600', marginBottom: 6 }}>📤 上架平台</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {['美团', '抖音', '大众点评'].map(p => (
            <TouchableOpacity
              key={p}
              style={[styles.miniBlueBtn, { flex: 1, backgroundColor: loadingPlatform === p ? '#999' : PRIMARY_COLOR }]}
              onPress={() => handleShelf(p, selectedGoodsId)}
              disabled={loadingPlatform !== null}
            >
              <Text style={styles.sendTxt}>{loadingPlatform === p ? '生成中...' : `⬆️ ${p}`}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.miniBlueBtn, { flex: 1, backgroundColor: loadingPlatform === 'all' ? '#999' : SUCCESS_COLOR }]}
            onPress={() => handleShelfAll(selectedGoodsId)}
            disabled={loadingPlatform !== null}
          >
            <Text style={styles.sendTxt}>{loadingPlatform === 'all' ? '生成中...' : '🚀 一键上架'}</Text>
          </TouchableOpacity>
        </View>
        {!selectedGoodsId && <Text style={{ fontSize: 12, color: TEXT_THIRD, marginTop: 4 }}>⚠️ 请先在下方选择一个商品</Text>}
      </View>
      )}
      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: '600' }}>📦 库存列表</Text>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {[{ key: 'name', label: '名称' }, { key: 'stock', label: '库存' }, { key: 'platform', label: '平台' }].map(s => (
              <TouchableOpacity 
                key={s.key} 
                style={[styles.miniBlueBtn, { paddingHorizontal: 12, paddingVertical: 4, backgroundColor: sortBy === s.key ? PRIMARY_COLOR : LIGHT_PRIMARY }]}
                onPress={() => {
                  setSortBy(s.key);
                  setSortOrder(sortBy === s.key && sortOrder === 'asc' ? 'desc' : 'asc');
                }}
              >
                <Text style={{ fontSize: 12, color: sortBy === s.key ? '#fff' : PRIMARY_COLOR }}>
                  {s.label} {sortBy === s.key ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        {sortedGoods.map(g => {
          const getPlatformIcon = (platform) => {
            switch(platform) {
              case '美团': return 'shopping-cart-outline';
              case '抖音': return 'music-video-outline';
              case '大众点评': return 'star-outline';
              default: return 'storefront-outline';
            }
          };
          const getPlatformColor = (platform) => {
            switch(platform) {
              case '美团': return '#FFD100';
              case '抖音': return '#000000';
              case '大众点评': return '#FF6B00';
              default: return PRIMARY_COLOR;
            }
          };
          return (
            <View key={g.id} style={[styles.listItem, { borderWidth: selectedGoodsId === g.id ? 2 : 0, borderColor: PRIMARY_COLOR }]}>
              <TouchableOpacity onPress={() => setSelectedGoodsId(g.id)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: LIGHT_PRIMARY, justifyContent: 'center', alignItems: 'center' }}>
                      <Ionicons name="package-outline" size={20} color={PRIMARY_COLOR} />
                    </View>
                    <View>
                      <Text style={{ fontSize: 16, fontWeight: '500' }}>{g.name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <Ionicons name={getPlatformIcon(g.platform)} size={12} color={getPlatformColor(g.platform)} />
                        <Text style={{ fontSize: 12, color: TEXT_SECOND }}>{g.platform}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: g.stock < 5 ? DANGER_COLOR : PRIMARY_COLOR }}>{g.stock}</Text>
                    <Text style={{ fontSize: 10, color: TEXT_THIRD }}>库存</Text>
                  </View>
                </View>
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity style={[styles.miniBlueBtn, { flex: 1 }]} onPress={() => { setType('入库'); setSelectedGoodsId(g.id); setQuantity(''); setReason(''); setPhotoUris([]); setModalVisible(true); setShowManualInput(false); }}>
                  <Text style={styles.sendTxt}>📥 入库</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.miniBlueBtn, { flex: 1, backgroundColor: DANGER_COLOR }]} onPress={() => handleQuickOut(g)}>
                  <Text style={styles.sendTxt}>📤 出库</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
        {sortedGoods.length === 0 && <Text style={{ color: TEXT_THIRD, textAlign: 'center', marginTop: 20 }}>暂无商品，请先添加商品</Text>}
      </View>
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalMask}>
          <View style={styles.modalWrap}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{showManualInput ? '手动录入' : type}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}><Text style={styles.closeTxt}>✕</Text></TouchableOpacity>
            </View>
            {showManualInput ? (
              <>
                <Text style={styles.label}>商品名称</Text>
                <TextInput style={styles.formInput} value={manualProductName} onChangeText={setManualProductName} placeholder="输入商品名称" />
                <Text style={styles.label}>平台</Text>
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                  {['美团', '抖音', '大众点评'].map(p => (
                    <TouchableOpacity key={p} style={[styles.tagNormal, manualPlatform === p && styles.tagActive]} onPress={() => setManualPlatform(p)}>
                      <Text style={{ color: manualPlatform === p ? '#fff' : TEXT_MAIN }}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.label}>数量</Text>
                <TextInput style={styles.formInput} value={quantity} onChangeText={setQuantity} keyboardType="numeric" placeholder="数量" />
                <Text style={styles.label}>备注</Text>
                <TextInput style={styles.formInput} value={reason} onChangeText={setReason} placeholder="可选备注" />
                {photoUris.length > 0 && (
                  <View style={{ marginVertical: 8 }}>
                    <ScrollView horizontal>
                      {photoUris.map((uri, idx) => (
                        <Image key={idx} source={{ uri }} style={{ width: 80, height: 80, borderRadius: 8, marginRight: 8 }} />
                      ))}
                    </ScrollView>
                    <TouchableOpacity onPress={() => setPhotoUris([])}><Text style={{ color: DANGER_COLOR, marginTop: 4 }}>移除照片</Text></TouchableOpacity>
                  </View>
                )}
                <TouchableOpacity style={styles.primaryBtn} onPress={handleManualSubmit}><Text style={styles.sendTxt}>确认{type}</Text></TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.label}>选择商品</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {goodsOptions.map(opt => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.tagNormal, selectedGoodsId === opt.value && styles.tagActive]}
                      onPress={() => setSelectedGoodsId(opt.value)}
                    >
                      <Text style={{ color: selectedGoodsId === opt.value ? '#fff' : TEXT_MAIN }}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.label}>数量</Text>
                <TextInput style={styles.formInput} value={quantity} onChangeText={setQuantity} keyboardType="numeric" placeholder="数量" />
                <Text style={styles.label}>备注</Text>
                <TextInput style={styles.formInput} value={reason} onChangeText={setReason} placeholder="可选备注" />
                {photoUris.length > 0 && (
                  <View style={{ marginVertical: 8 }}>
                    <ScrollView horizontal>
                      {photoUris.map((uri, idx) => (
                        <Image key={idx} source={{ uri }} style={{ width: 80, height: 80, borderRadius: 8, marginRight: 8 }} />
                      ))}
                    </ScrollView>
                    <TouchableOpacity onPress={() => setPhotoUris([])}><Text style={{ color: DANGER_COLOR, marginTop: 4 }}>移除照片</Text></TouchableOpacity>
                  </View>
                )}
                <TouchableOpacity style={styles.primaryBtn} onPress={handleSubmit}><Text style={styles.sendTxt}>确认{type}</Text></TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
      {/* 语音录入自定义Modal */}
      <Modal visible={voiceModalVisible} transparent animationType="fade">
        <View style={styles.modalMask}>
          <View style={styles.voiceModal}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>🎤 语音录入</Text>
            <Text style={{ fontSize: 14, color: TEXT_SECOND, marginBottom: 12 }}>请说出商品名称，可手动修改</Text>
            <TextInput
              style={styles.voiceTextInput}
              multiline
              placeholder="输入商品名称..."
              value={voiceText}
              onChangeText={setVoiceText}
              autoFocus
            />
            <View style={{ flexDirection: 'row', marginTop: 16 }}>
              <TouchableOpacity style={{ flex: 1, padding: 12, backgroundColor: '#eee', borderRadius: 8, marginRight: 8 }} onPress={() => { setVoiceModalVisible(false); setVoiceText(''); }}>
                <Text style={{ textAlign: 'center', color: TEXT_SECOND }}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, padding: 12, backgroundColor: PRIMARY_COLOR, borderRadius: 8 }} onPress={confirmVoice}>
                <Text style={{ textAlign: 'center', color: '#fff' }}>确认</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* 出库数量选择弹窗 */}
      <Modal visible={!!outModalGoods} transparent animationType="fade">
        <View style={styles.modalMask}>
          <View style={styles.voiceModal}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 4 }}>📤 出库数量</Text>
            <Text style={{ fontSize: 14, color: TEXT_SECOND, marginBottom: 12 }}>
              {outModalGoods ? `${outModalGoods.name} (库存：${outModalGoods.stock})` : ''}
            </Text>
            <TextInput
              style={[styles.voiceTextInput, { textAlign: 'center', fontSize: 24, fontWeight: 'bold' }]}
              value={outQuantity}
              onChangeText={setOutQuantity}
              keyboardType="numeric"
              maxLength={4}
              autoFocus
            />
            <View style={{ flexDirection: 'row', marginTop: 16, gap: 8 }}>
              <TouchableOpacity style={{ flex: 1, padding: 12, backgroundColor: '#eee', borderRadius: 8 }} onPress={() => { setOutModalGoods(null); setOutQuantity(''); }}>
                <Text style={{ textAlign: 'center', color: TEXT_SECOND }}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, padding: 12, backgroundColor: DANGER_COLOR, borderRadius: 8 }} onPress={confirmQuickOut}>
                <Text style={{ textAlign: 'center', color: '#fff', fontWeight: '600' }}>确认出库</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* AI识别数量弹窗 */}
      <Modal visible={aiCountModalVisible} transparent animationType="fade">
        <View style={styles.modalMask}>
          <View style={[styles.voiceModal, { maxHeight: '90%', width: '92%' }]}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>📷 AI拍照识别数量</Text>
            <Text style={{ fontSize: 12, color: TEXT_SECOND, marginBottom: 12 }}>可以拍多张照片，AI会自动识别并累加总数</Text>
            <ScrollView horizontal style={{ marginBottom: 12, maxHeight: 100 }}>
              {aiCountPhotos.map((uri, idx) => (
                <View key={idx} style={{ position: 'relative', marginRight: 8 }}>
                  <Image source={{ uri }} style={{ width: 80, height: 80, borderRadius: 8 }} />
                  <TouchableOpacity
                    style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: DANGER_COLOR, justifyContent: 'center', alignItems: 'center' }}
                    onPress={() => {
                      setAiCountPhotos(prev => prev.filter((_, i) => i !== idx));
                      // 删除对应识别结果
                      if (aiCountResult && aiCountResult.details) {
                        const newDetails = aiCountResult.details.filter((_, i) => i !== idx);
                        const newTotal = newDetails.reduce((sum, d) => sum + d.count, 0);
                        setAiCountResult({ ...aiCountResult, total: newTotal, details: newDetails, photos: newDetails.length });
                      }
                    }}
                  >
                    <Ionicons name="close" size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
              {aiCountPhotos.length === 0 && <Text style={{ color: TEXT_THIRD, lineHeight: 80 }}>还没有照片，点击下方按钮开始拍照</Text>}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <TouchableOpacity style={{ flex: 1, padding: 12, backgroundColor: PRIMARY_COLOR, borderRadius: 8 }} onPress={aiCountAddPhoto}>
                <Text style={{ textAlign: 'center', color: '#fff' }}>📷 拍照</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, padding: 12, backgroundColor: aiCountLoading ? '#999' : SUCCESS_COLOR, borderRadius: 8 }} onPress={aiCountRecognize} disabled={aiCountLoading}>
                <Text style={{ textAlign: 'center', color: '#fff' }}>{aiCountLoading ? '识别中...' : '🤖 开始识别'}</Text>
              </TouchableOpacity>
            </View>
            {aiCountResult && aiCountResult.total > 0 && (
              <View style={{ backgroundColor: '#F5F7FA', padding: 12, borderRadius: 8, marginBottom: 12 }}>
                <Text style={{ fontSize: 14, color: TEXT_SECOND, marginBottom: 8 }}>📊 识别结果</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ fontSize: 13, color: TEXT_MAIN }}>拍照数: {aiCountResult.photos} 张</Text>
                  <Text style={{ fontSize: 16, color: PRIMARY_COLOR, fontWeight: 'bold' }}>总数量: {aiCountResult.total} 件</Text>
                </View>
                {aiCountResult.details.map((d, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
                    <Text style={{ fontSize: 12, color: TEXT_SECOND }}>第 {d.photoIndex} 张</Text>
                    <Text style={{ fontSize: 12, color: TEXT_MAIN }}>识别到 {d.count} 件</Text>
                  </View>
                ))}
              </View>
            )}
            {aiCountResult && aiCountResult.total > 0 && (
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 13, color: TEXT_SECOND, marginBottom: 8 }}>📦 选择出库商品（数量已自动匹配）</Text>
                <ScrollView style={{ maxHeight: 200 }}>
                  {aiCountResult.goodsOptions.length === 0 ? (
                    <Text style={{ color: DANGER_COLOR, fontSize: 12, textAlign: 'center', padding: 12 }}>暂无库存商品，请先入库</Text>
                  ) : (
                    aiCountResult.goodsOptions.map(item => {
                      const isSelected = aiCountSelectedGoodsId === item.id;
                      const insufficient = aiCountResult.total > item.stock;
                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            padding: 10,
                            borderRadius: 8,
                            marginBottom: 6,
                            backgroundColor: isSelected ? LIGHT_PRIMARY : '#F5F7FA',
                            borderWidth: isSelected ? 1.5 : 0,
                            borderColor: PRIMARY_COLOR,
                            opacity: insufficient ? 0.5 : 1,
                          }}
                          onPress={() => { if (!insufficient) setAiCountSelectedGoodsId(item.id); }}
                          disabled={insufficient}
                        >
                          <Ionicons name={isSelected ? "radio-button-on" : "radio-button-off"} size={20} color={isSelected ? PRIMARY_COLOR : TEXT_THIRD} />
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={{ fontSize: 14, color: TEXT_MAIN, fontWeight: isSelected ? '600' : '400' }}>{item.name}</Text>
                            <Text style={{ fontSize: 11, color: TEXT_SECOND, marginTop: 2 }}>当前库存: {item.stock} {insufficient ? '⚠️ 不足' : ''}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </ScrollView>
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={{ flex: 1, padding: 12, backgroundColor: '#eee', borderRadius: 8 }} onPress={() => { setAiCountModalVisible(false); setAiCountPhotos([]); setAiCountResult(null); setAiCountSelectedGoodsId(null); }}>
                <Text style={{ textAlign: 'center', color: TEXT_SECOND }}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, padding: 12, backgroundColor: (aiCountResult?.total > 0 && aiCountSelectedGoodsId) ? DANGER_COLOR : '#ccc', borderRadius: 8 }} onPress={aiCountSubmit} disabled={!(aiCountResult?.total > 0 && aiCountSelectedGoodsId)}>
                <Text style={{ textAlign: 'center', color: '#fff', fontWeight: '600' }}>确认出库{aiCountResult ? ` ×${aiCountResult.total}` : ''}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ================== 顾客客服（AI暂停功能保留） ==================
const CustomerService = () => {
  const navigation = useNavigation();
  const { state, dispatch } = useApp();
  const [inputText, setInputText] = useState('');
  const [currentPlatform, setCurrentPlatform] = useState('美团');
  const [messages, setMessages] = useState([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showQuickReply, setShowQuickReply] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [aiMode, setAiMode] = useState(false);
  const scrollViewRef = useRef(null);
  const [selectedPhone, setSelectedPhone] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [showMediaOptions, setShowMediaOptions] = useState(false);
  const [aiPaused, setAiPaused] = useState(false);
  const [escalateToBoss, setEscalateToBoss] = useState(false);

  // 收集所有顾客（按手机号）
  const allCustomers = Object.keys(state.privateChatMessages || {});

  // 按平台分组的顾客列表
  const customerByPlatform = (platform) => {
    const result = [];
    allCustomers.forEach(phone => {
      const msgs = state.privateChatMessages[phone] || [];
      const lastMsg = msgs[msgs.length - 1];
      if (!lastMsg) return;
      // 筛选当前平台的消息
      const platformMsgs = msgs.filter(m => (m.platform || '其他') === platform);
      if (platformMsgs.length === 0 && msgs.length > 0) return;
      const lastPlatformMsg = platformMsgs[platformMsgs.length - 1] || lastMsg;
      result.push({
        phone,
        platform,
        lastMsg: lastPlatformMsg,
        unread: platformMsgs.filter(m => m.from !== 'staff' && m.from !== state.user?.phone && !m.read).length,
      });
    });
    return result;
  };

  const currentCustomers = customerByPlatform(currentPlatform);
  const currentMessages = messages.filter(m => m.platform === currentPlatform && m.phone === selectedPhone);

  // 同步消息
  useEffect(() => {
    if (selectedPhone) {
      const msgs = (state.privateChatMessages[selectedPhone] || []).filter(m => (m.platform || '其他') === currentPlatform);
      setMessages(msgs);
    }
  }, [selectedPhone, currentPlatform, state.privateChatMessages]);

  // 客服权限范围 - 基础咨询、退款申请、订单查询
  const STAFF_PERMISSION_KEYWORDS = ['价格', '菜单', '营业时间', '地址', '电话', '位置', '几点', '怎么去', '有货吗', '有吗', '能', '可以', '退换', '发票', '小票'];
  const BOSS_ONLY_KEYWORDS = ['投诉', '差评', '退款', '赔偿', '举报', '诉讼', '起诉', '曝光', '黑心', '欺诈', '食品安全', '吃坏', '中毒', '侮辱', '谩骂'];

  // 检测是否超出客服权限
  const isEscalationNeeded = (text) => {
    return BOSS_ONLY_KEYWORDS.some(k => text.includes(k));
  };

  const escalateToMerchant = () => {
    // 通知商家（在state中记录待处理事项）
    const note = {
      id: Date.now().toString(),
      type: 'escalation',
      fromPhone: selectedPhone,
      platform: currentPlatform,
      message: inputText || '顾客咨询超出客服权限',
      time: new Date().toISOString(),
      handled: false,
    };
    dispatch({ type: 'ADD_BOSS_NOTIFICATION', payload: note });
    showToast('⚠️ 已通知商家介入处理');
  };

  const sendMessage = async (type = 'text') => {
    try {
      let text = inputText.trim();
      let images = [];
      if (type === 'image') {
        if (selectedImages.length === 0) { showToast('请先选择图片'); return; }
        for (let uri of selectedImages) {
          const compressed = await compressImage(uri);
          const base64 = await FileSystem.readAsStringAsync(compressed, { encoding: FileSystem.EncodingType.Base64 });
          images.push(`data:image/jpeg;base64,${base64}`);
        }
        const msg = {
          id: Date.now().toString(),
          text: text || '图片消息',
          image: images[0],
          from: 'staff',
          platform: currentPlatform,
          phone: selectedPhone,
          time: new Date().toISOString(),
          read: true,
        };
        // 保存到全局消息
        const allMsgs = (state.privateChatMessages[selectedPhone] || []).concat([msg]);
        dispatch({ type: 'SET_PRIVATE_CHAT_MESSAGES', payload: { phone: selectedPhone, messages: allMsgs } });
        setMessages(prev => [...prev, msg]);
        setSelectedImages([]);
        setInputText('');
        setShowMediaOptions(false);
        setAiPaused(true);
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
        return;
      }
      if (!text && selectedImages.length === 0) { showToast('请输入内容或选择图片'); return; }
      // 检测是否需要转商家
      if (isEscalationNeeded(text)) {
        escalateToMerchant();
        return;
      }
      const msg = {
        id: Date.now().toString(),
        text: text || '',
        image: null,
        from: 'staff',
        platform: currentPlatform,
        phone: selectedPhone,
        time: new Date().toISOString(),
        read: true,
      };
      // 保存到全局消息
      const allMsgs = (state.privateChatMessages[selectedPhone] || []).concat([msg]);
      dispatch({ type: 'SET_PRIVATE_CHAT_MESSAGES', payload: { phone: selectedPhone, messages: allMsgs } });
      setMessages(prev => [...prev, msg]);
      setInputText('');
      setShowEmoji(false);
      setShowQuickReply(false);
      setAiPaused(true);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (error) {
      showToast('发送失败');
    }
  };

  const resumeAI = () => {
    setAiPaused(false);
    showToast('AI已恢复，将自动回复顾客');
  };

  const pickImages = async (source) => {
    try {
      setShowMediaOptions(false);
      let result;
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') { showToast('需要相机权限'); return; }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          quality: 0.7,
        });
        if (!result.canceled) {
          setSelectedImages([...selectedImages, result.assets[0].uri]);
          showToast('已选1张图片，点击发送按钮发送');
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { showToast('需要相册权限'); return; }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          quality: 0.7,
          selectionLimit: 10,
        });
        if (!result.canceled) {
          const uris = result.assets.map(a => a.uri);
          setSelectedImages([...selectedImages, ...uris]);
          showToast(`已选${uris.length}张图片，点击发送按钮发送`);
        }
      }
    } catch (error) { showToast('选择图片失败'); }
  };

  const removeImage = (index) => {
    const newList = [...selectedImages];
    newList.splice(index, 1);
    setSelectedImages(newList);
  };

  const quickReplies = [
    '您好，请问有什么可以帮助您？',
    '稍等，我帮您查询一下',
    '感谢您的反馈，我们会尽快处理',
    '欢迎下次光临！',
    '请问您需要什么帮助？',
    '请问您贵姓，方便称呼吗？',
  ];

  const addTag = () => {
    if (!selectedPhone) { showToast('请先选择顾客'); return; }
    if (!tagInput.trim()) { showToast('请输入标签'); return; }
    dispatch({ type: 'SET_CUSTOMER_TAG', payload: { phone: selectedPhone, tag: tagInput.trim() } });
    setTagInput('');
    showToast('标签已添加');
  };

  const getCustomerStats = (phone) => {
    const orders = (state.globalOrderRecord || []).filter(o => o.phone === phone);
    const total = orders.reduce((s, o) => s + (o.couponPrice || 0), 0);
    return {
      total,
      count: orders.length,
      lastOrder: orders.length > 0 ? formatDate(orders[0].time) : '无'
    };
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: BG_CARD }}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => navigation.goBack()}><Text style={{ fontSize: 20 }}>&lt;</Text></TouchableOpacity>
          <Text style={styles.pageTitle}>顾客客服</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {aiPaused && (
              <TouchableOpacity onPress={resumeAI} style={{ marginRight: 10 }}>
                <Text style={{ color: SUCCESS_COLOR, fontWeight: 'bold' }}>▶ 恢复AI</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setAiMode(!aiMode)}>
              <Text style={{ color: aiMode ? SUCCESS_COLOR : TEXT_THIRD }}>
                {aiMode ? '🤖 AI已开启' : '🤖 AI关闭'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8, backgroundColor: BG_CARD, borderBottomWidth: 1, borderColor: BORDER_COLOR }}>
        {['美团', '抖音', '大众点评'].map(p => {
          const platformCustomers = customerByPlatform(p);
          const platformUnread = platformCustomers.reduce((s, c) => s + c.unread, 0);
          return (
            <TouchableOpacity key={p} onPress={() => { setCurrentPlatform(p); setSelectedPhone(''); }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{
                  fontSize: 16,
                  fontWeight: currentPlatform === p ? '700' : '400',
                  color: currentPlatform === p ? PRIMARY_COLOR : TEXT_SECOND
                }}>{p}</Text>
                {platformUnread > 0 && (
                  <View style={{ backgroundColor: DANGER_COLOR, borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, marginTop: 2 }}>
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>{platformUnread > 99 ? '99+' : platformUnread}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {currentCustomers.length > 0 ? (
        <View style={{ padding: 8, backgroundColor: BG_CARD, borderBottomWidth: 1, borderColor: BORDER_COLOR }}>
          <Text style={{ fontSize: 12, color: TEXT_SECOND, marginBottom: 6 }}>💬 {currentPlatform}平台咨询顾客 ({currentCustomers.length})</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {currentCustomers.map(c => (
              <TouchableOpacity
                key={c.phone}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  backgroundColor: selectedPhone === c.phone ? PRIMARY_COLOR : '#fff',
                  borderRadius: 12,
                  marginRight: 8,
                  minWidth: 100,
                  borderWidth: 1,
                  borderColor: selectedPhone === c.phone ? PRIMARY_COLOR : BORDER_COLOR,
                }}
                onPress={() => setSelectedPhone(c.phone)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: selectedPhone === c.phone ? '#fff' : TEXT_MAIN, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>{c.phone}</Text>
                  {c.unread > 0 && (
                    <View style={{ backgroundColor: DANGER_COLOR, borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, marginLeft: 4 }}>
                      <Text style={{ color: '#fff', fontSize: 9, fontWeight: 'bold' }}>{c.unread}</Text>
                    </View>
                  )}
                </View>
                <Text style={{ color: selectedPhone === c.phone ? '#fff' : TEXT_SECOND, fontSize: 11, marginTop: 2 }} numberOfLines={1}>{c.lastMsg?.text || '...'}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {selectedPhone && (
            <View style={{ marginTop: 8, padding: 8, backgroundColor: '#fff', borderRadius: 8 }}>
              <Text style={{ fontSize: 12, color: TEXT_SECOND }}>
                📊 累计消费：¥{getCustomerStats(selectedPhone).total} ｜ 订单数：{getCustomerStats(selectedPhone).count} ｜ 上次到店：{getCustomerStats(selectedPhone).lastOrder}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                <TextInput
                  style={[styles.formInput, { flex: 1, height: 32, fontSize: 12 }]}
                  placeholder="添加标签"
                  value={tagInput}
                  onChangeText={setTagInput}
                />
                <TouchableOpacity style={[styles.miniBlueBtn, { marginLeft: 6 }]} onPress={addTag}>
                  <Text style={styles.sendTxt}>+</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
                {(state.customerTags?.[selectedPhone] || []).map((tag, idx) => (
                  <View key={idx} style={{ backgroundColor: LIGHT_PRIMARY, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, marginRight: 4, marginBottom: 4 }}>
                    <Text style={{ fontSize: 12, color: PRIMARY_COLOR }}>#{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      ) : (
        <View style={{ padding: 30, alignItems: 'center', backgroundColor: BG_CARD }}>
          <Ionicons name="chatbubbles-outline" size={48} color={TEXT_THIRD} />
          <Text style={{ color: TEXT_THIRD, marginTop: 8 }}>{currentPlatform}平台暂无咨询</Text>
        </View>
      )}

      {selectedImages.length > 0 && (
        <View style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: BORDER_COLOR }}>
          <ScrollView horizontal>
            {selectedImages.map((uri, idx) => (
              <View key={idx} style={{ marginRight: 8, position: 'relative' }}>
                <Image source={{ uri }} style={{ width: 80, height: 80, borderRadius: 8 }} />
                <TouchableOpacity
                  style={{ position: 'absolute', top: -4, right: -4, backgroundColor: DANGER_COLOR, borderRadius: 12, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => removeImage(idx)}
                >
                  <Text style={{ color: '#fff', fontSize: 12 }}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      <ScrollView
        ref={scrollViewRef}
        style={styles.chatScroll}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 80 }}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {currentMessages.map(msg => (
          <View key={msg.id} style={msg.from === 'staff' ? styles.bubbleRight : styles.bubbleLeft}>
            {msg.image ? (
              <Image source={{ uri: msg.image }} style={styles.imageMessage} />
            ) : (
              <Text style={{ fontSize: 15, color: TEXT_MAIN }}>{msg.text}</Text>
            )}
            <Text style={{ fontSize: 10, color: TEXT_THIRD, marginTop: 4 }}>{formatTime(msg.time)}</Text>
            {msg.from === 'ai' && <Text style={{ fontSize: 9, color: SUCCESS_COLOR }}>🤖 AI回复</Text>}
          </View>
        ))}
        {currentMessages.length === 0 && (
          <Text style={{ textAlign: 'center', color: TEXT_THIRD, marginTop: 30 }}>暂无咨询，开始与顾客对话</Text>
        )}
      </ScrollView>

      {showQuickReply && (
        <View style={styles.quickReplyContainer}>
          {quickReplies.map((text, idx) => (
            <TouchableOpacity key={idx} style={styles.quickReplyBtn} onPress={() => { setInputText(text); setShowQuickReply(false); }}>
              <Text style={styles.quickReplyText}>{text}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {showEmoji && (
        <View style={styles.emojiRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {EMOJI_LIST.map(emoji => (
              <TouchableOpacity key={emoji} onPress={() => { setInputText(inputText + emoji); setShowEmoji(false); }}>
                <Text style={{ fontSize: 28, marginHorizontal: 4 }}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {showMediaOptions && (
        <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff', borderTopWidth: 1, borderColor: BORDER_COLOR }}>
          <TouchableOpacity style={{ flex: 1, alignItems: 'center', padding: 8 }} onPress={() => pickImages('camera')}>
            <Ionicons name="camera-outline" size={24} color={PRIMARY_COLOR} />
            <Text style={{ fontSize: 12, color: TEXT_SECOND }}>拍照</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 1, alignItems: 'center', padding: 8 }} onPress={() => pickImages('library')}>
            <Ionicons name="images-outline" size={24} color={PRIMARY_COLOR} />
            <Text style={{ fontSize: 12, color: TEXT_SECOND }}>相册</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 1, alignItems: 'center', padding: 8 }} onPress={() => setShowMediaOptions(false)}>
            <Ionicons name="close-outline" size={24} color={DANGER_COLOR} />
            <Text style={{ fontSize: 12, color: DANGER_COLOR }}>取消</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputBar}>
        <TouchableOpacity onPress={() => setShowEmoji(!showEmoji)} style={{ paddingHorizontal: 8 }}>
          <Text style={{ fontSize: 24 }}>😊</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowQuickReply(!showQuickReply)} style={{ paddingHorizontal: 8 }}><Ionicons name="flash" size={20} color={PRIMARY_COLOR} /></TouchableOpacity>
        <TouchableOpacity onPress={() => setShowMediaOptions(true)} style={{ paddingHorizontal: 8 }}>
          <Ionicons name="add-circle-outline" size={24} color={PRIMARY_COLOR} />
        </TouchableOpacity>
        <TextInput
          style={styles.inputBox}
          placeholder={selectedPhone ? `回复 ${selectedPhone}...` : "请先选择顾客..."}
          value={inputText}
          onChangeText={setInputText}
          multiline
          editable={!!selectedPhone}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={() => sendMessage('text')}>
          <Text style={styles.sendTxt}>发送</Text>
        </TouchableOpacity>
        {selectedImages.length > 0 && (
          <TouchableOpacity style={[styles.sendBtn, { backgroundColor: SUCCESS_COLOR, marginLeft: 4 }]} onPress={() => sendMessage('image')}>
            <Text style={styles.sendTxt}>📷 发送图片</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={{ height: 56 }} />
    </View>
  );
};

// ================== 内部沟通 ==================
const InternalChat = () => {
  const navigation = useNavigation();
  const { state, dispatch } = useApp();
  const [inputText, setInputText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const scrollViewRef = useRef(null);
  const [chatBgColor, setChatBgColor] = useState('#F2F3F5');
  const [imageUri, setImageUri] = useState(null);
  const [showMediaOptions, setShowMediaOptions] = useState(false);
  const [callType, setCallType] = useState('voice');
  const [callStatus, setCallStatus] = useState('idle');
  const [callDuration, setCallDuration] = useState(0);
  const [callingName, setCallingName] = useState('');
  const callTimerRef = useRef(null);

  const chatId = 'internal';
  const groupMessages = state.groupChatMessages[chatId] || [];
  
  let chatStaffList = [];
  const user = state.user;
  if (user?.role === '员工') {
    // 员工端：只有被商家批准的员工才显示老板私聊入口
    const myApplication = (state.staffMemberList || []).find(s => s.phone === user?.phone && s.status === 'approved');
    const bossPhone = state.shopInfo?.phone;
    if (myApplication && bossPhone) chatStaffList = [{ id: 'boss', name: '老板', phone: bossPhone }];
  } else {
    chatStaffList = (state.staffMemberList || []).filter(s => s.status === 'approved' && s.phone !== user?.phone);
  }

  const startCall = async (type) => {
    setShowMediaOptions(false);
    if (type === 'video') {
      const { status } = await Camera.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showToast('需要相机权限');
        return;
      }
    }
    setCallType(type);
    setCallStatus('calling');
    setCallDuration(0);
    setCallingName('正在呼叫...');
    setTimeout(() => {
      setCallStatus('connected');
      setCallingName('内部沟通群');
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }, 2000);
  };

  const endCall = () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    setCallStatus('ended');
    setTimeout(() => {
      setCallStatus('idle');
      setCallDuration(0);
    }, 2000);
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const sendGroupMessage = async (type = 'text') => {
    try {
      let text = inputText.trim();
      let image = null;
      if (type === 'image') {
        if (!imageUri) { showToast('请先选择图片'); return; }
        const compressed = await compressImage(imageUri);
        const base64 = await FileSystem.readAsStringAsync(compressed, { encoding: FileSystem.EncodingType.Base64 });
        image = `data:image/jpeg;base64,${base64}`;
      } else if (!text) {
        showToast('请输入内容');
        return;
      }
      const msg = {
        id: Date.now().toString(),
        text: type === 'text' ? text : '',
        image: image || null,
        from: state.user?.name || '员工',
        fromPhone: state.user?.phone || '',
        time: new Date().toISOString(),
        type: 'text',
      };
      dispatch({ type: 'ADD_GROUP_MESSAGE', payload: { chatId, message: msg } });
      setInputText('');
      setImageUri(null);
      setShowEmoji(false);
      setShowMediaOptions(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (error) {
      showToast('发送失败');
    }
  };

  const pickImage = async (source) => {
    try {
      setShowMediaOptions(false);
      const options = { mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 0.7 };
      let result;
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') { showToast('需要相机权限'); return; }
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { showToast('需要相册权限'); return; }
        result = await ImagePicker.launchImageLibraryAsync(options);
      }
      if (!result.canceled) {
        setImageUri(result.assets[0].uri);
        await sendGroupMessage('image');
      }
    } catch (error) {
      showToast('选择图片失败');
    }
  };

  const goToChatSettings = () => {
    navigation.navigate('ChatSetting', { chatId });
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: BG_CARD }}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => navigation.goBack()}><Text style={{ fontSize: 20 }}>&lt;</Text></TouchableOpacity>
          <Text style={styles.pageTitle}>内部沟通</Text>
          <TouchableOpacity onPress={goToChatSettings}><Text style={{ fontSize: 20, color: TEXT_MAIN }}>⋯</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
      <View style={{ flex: 1, backgroundColor: chatBgColor }}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.chatScroll}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 80 }}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {groupMessages.length === 0 && <Text style={{ textAlign: 'center', color: TEXT_THIRD, marginTop: 30 }}>暂无消息</Text>}
          {groupMessages.map(msg => {
            const isMe = msg.fromPhone === state.user?.phone;
            return (
              <View key={msg.id} style={isMe ? styles.bubbleRight : styles.bubbleLeft}>
                {msg.image ? (
                  <Image source={{ uri: msg.image }} style={styles.imageMessage} />
                ) : (
                  <Text style={{ fontSize: 15, color: TEXT_MAIN }}>{msg.text}</Text>
                )}
                <Text style={{ fontSize: 10, color: TEXT_THIRD, marginTop: 4 }}>{formatTime(msg.time)}</Text>
                <Text style={{ fontSize: 10, color: TEXT_THIRD }}>{msg.from}</Text>
              </View>
            );
          })}
        </ScrollView>
        {showEmoji && (
          <View style={styles.emojiRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {EMOJI_LIST.map(emoji => (
                <TouchableOpacity key={emoji} onPress={() => { setInputText(inputText + emoji); setShowEmoji(false); }}>
                  <Text style={{ fontSize: 28, marginHorizontal: 4 }}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
        {showMediaOptions && (
          <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff', borderTopWidth: 1, borderColor: BORDER_COLOR }}>
            <TouchableOpacity style={{ flex: 1, alignItems: 'center', padding: 8 }} onPress={() => pickImage('camera')}>
              <Ionicons name="camera-outline" size={24} color={PRIMARY_COLOR} />
              <Text style={{ fontSize: 12, color: TEXT_SECOND }}>拍照</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex: 1, alignItems: 'center', padding: 8 }} onPress={() => pickImage('library')}>
              <Ionicons name="images-outline" size={24} color={PRIMARY_COLOR} />
              <Text style={{ fontSize: 12, color: TEXT_SECOND }}>相册</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex: 1, alignItems: 'center', padding: 8 }} onPress={() => startCall('voice')}>
              <Ionicons name="call-outline" size={24} color={SUCCESS_COLOR} />
              <Text style={{ fontSize: 12, color: SUCCESS_COLOR }}>语音通话</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex: 1, alignItems: 'center', padding: 8 }} onPress={() => startCall('video')}>
              <Ionicons name="videocam-outline" size={24} color={PRIMARY_COLOR} />
              <Text style={{ fontSize: 12, color: PRIMARY_COLOR }}>视频通话</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex: 1, alignItems: 'center', padding: 8 }} onPress={() => setShowMediaOptions(false)}>
              <Ionicons name="close-outline" size={24} color={DANGER_COLOR} />
              <Text style={{ fontSize: 12, color: DANGER_COLOR }}>取消</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={[styles.inputBar, { backgroundColor: chatBgColor === '#F2F3F5' ? '#F7F7F7' : chatBgColor }]}>
          <TouchableOpacity onPress={() => setShowEmoji(!showEmoji)} style={{ paddingHorizontal: 8 }}><Text style={{ fontSize: 24 }}>😊</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setShowMediaOptions(true)} style={{ paddingHorizontal: 8 }}><Ionicons name="add-circle-outline" size={24} color={PRIMARY_COLOR} /></TouchableOpacity>
          <TextInput style={styles.inputBox} placeholder="发送内部消息..." value={inputText} onChangeText={setInputText} multiline />
          <TouchableOpacity style={styles.sendBtn} onPress={() => sendGroupMessage('text')}><Text style={styles.sendTxt}>发送</Text></TouchableOpacity>
        </View>
        <View style={{ height: 56 }} />
      </View>
      {(callStatus === 'calling' || callStatus === 'connected' || callStatus === 'ended') && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', backgroundColor: '#1a1a1a', zIndex: 1000 }}>
          {callType === 'video' && callStatus === 'connected' && (
            <Camera 
              style={{ flex: 1, width: '100%', height: '100%' }} 
              type={CameraType.front}
            />
          )}
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: callType === 'video' && callStatus === 'connected' ? 'transparent' : '#1a1a1a' }}>
            <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: BG_CARD, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
              {callType === 'video' ? (
                <Ionicons name="videocam-outline" size={48} color={PRIMARY_COLOR} />
              ) : (
                <Ionicons name="person-outline" size={48} color={PRIMARY_COLOR} />
              )}
            </View>
            <Text style={{ fontSize: 22, fontWeight: '600', color: '#fff', marginBottom: 4 }}>{callingName}</Text>
            <Text style={{ fontSize: 14, color: '#aaa', marginBottom: 8 }}>
              {callType === 'video' ? '📹 视频通话' : '📞 语音通话'}
            </Text>
            <Text style={{ fontSize: 16, color: '#aaa', marginBottom: 8 }}>
              {callStatus === 'calling' ? '正在呼叫...' : callStatus === 'connected' ? formatDuration(callDuration) : '通话已结束'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 48 }}>
              <Text style={{ fontSize: 12, color: '#888' }}>参与人员:</Text>
              <View style={{ flexDirection: 'row' }}>
                {chatStaffList.slice(0, 4).map((staff, idx) => (
                  <View 
                    key={idx} 
                    style={{ 
                      width: 32, 
                      height: 32, 
                      borderRadius: 16, 
                      backgroundColor: LIGHT_PRIMARY, 
                      justifyContent: 'center', 
                      alignItems: 'center',
                      marginLeft: idx > 0 ? -8 : 0,
                      borderWidth: 2,
                      borderColor: '#1a1a1a'
                    }}
                  >
                    <Ionicons name="person-outline" size={16} color={PRIMARY_COLOR} />
                  </View>
                ))}
                {chatStaffList.length > 4 && (
                  <View 
                    style={{ 
                      width: 32, 
                      height: 32, 
                      borderRadius: 16, 
                      backgroundColor: PRIMARY_COLOR, 
                      justifyContent: 'center', 
                      alignItems: 'center',
                      marginLeft: -8,
                      borderWidth: 2,
                      borderColor: '#1a1a1a'
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 10 }}>+{chatStaffList.length - 4}</Text>
                  </View>
                )}
                <Text style={{ fontSize: 12, color: '#888', marginLeft: 8 }}>{chatStaffList.length + 1}人</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 32 }}>
              <TouchableOpacity style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' }} onPress={() => showToast('已静音')}>
                <Ionicons name="mic-off-outline" size={28} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' }} onPress={() => showToast('已切换扬声器')}>
                <Ionicons name="volume-high-outline" size={28} color="#fff" />
              </TouchableOpacity>
              {callType === 'video' && (
                <TouchableOpacity style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' }} onPress={() => showToast('已切换摄像头')}>
                  <Ionicons name="camera-reverse-outline" size={28} color="#fff" />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: DANGER_COLOR, justifyContent: 'center', alignItems: 'center' }} onPress={endCall}>
                <Ionicons name="call-outline" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

// ================== 聊天设置页面 ==================
const ChatSettingScreen = ({ route, navigation }) => {
  const { chatId } = route.params || {};
  const { state, dispatch } = useApp();
  const [isMuted, setIsMuted] = useState(false);
  const [isTop, setIsTop] = useState(false);
  const [isSpecialCare, setIsSpecialCare] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchType, setSearchType] = useState('all'); // all / text / image / video / file / member
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [previewEnabled, setPreviewEnabled] = useState(true);
  const [bgColor, setBgColor] = useState('#F2F3F5');
  const [showGroupMembers, setShowGroupMembers] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

  const bgColors = ['#F2F3F5', '#E8F5E9', '#E3F2FD', '#FFF3E0', '#FCE4EC', '#EDE7F6', '#FFFFFF', '#37474F'];
  const staffMembers = state.staffMemberList || [];
  const groupMessages = state.groupChatMessages[chatId] || [];

  // 群成员：老板在首位，员工在后面
  const allMembers = [
    { phone: state.user?.phone, name: state.user?.name || '老板', role: '老板', isOwner: true },
    ...staffMembers.filter(s => s.status === 'approved').map(s => ({ phone: s.phone, name: s.name, role: '员工', isOwner: false }))
  ];

  const toggleMute = () => {
    setIsMuted(!isMuted);
    showToast(isMuted ? '已取消消息免打扰' : '已开启消息免打扰');
  };

  const toggleTop = () => {
    setIsTop(!isTop);
    showToast(isTop ? '已取消置顶' : '已置顶');
  };

  const toggleSpecialCare = () => {
    setIsSpecialCare(!isSpecialCare);
    showToast(isSpecialCare ? '已取消特别关心' : '已开启特别关心');
  };

  const clearMessages = () => {
    Alert.alert('删除聊天记录', '确定要删除所有聊天记录吗？', [
      { text: '取消' },
      { text: '删除', style: 'destructive', onPress: () => {
        dispatch({ type: 'CLEAR_GROUP_MESSAGES', payload: { chatId } });
        showToast('聊天记录已删除');
        navigation.goBack();
      }}
    ]);
  };

  const searchMessages = () => {
    if (!searchText.trim()) { showToast('请输入搜索内容'); return; }
    let filtered = groupMessages;
    if (searchType === 'text') {
      filtered = filtered.filter(m => m.text && m.text.includes(searchText));
    } else if (searchType === 'image') {
      filtered = filtered.filter(m => m.image);
    } else if (searchType === 'video') {
      filtered = filtered.filter(m => m.video);
    } else if (searchType === 'file') {
      filtered = filtered.filter(m => m.file);
    } else if (searchType === 'member') {
      filtered = filtered.filter(m => (m.fromName || '').includes(searchText) || (m.from || '').includes(searchText));
    } else {
      filtered = filtered.filter(m => {
        if (m.text && m.text.includes(searchText)) return true;
        if (m.fromName && m.fromName.includes(searchText)) return true;
        if (m.from && m.from.includes(searchText)) return true;
        return false;
      });
    }
    setSearchResults(filtered);
  };

  const toggleMemberSelect = (member) => {
    const exists = selectedMembers.find(m => m.phone === member.phone);
    if (exists) {
      setSelectedMembers(selectedMembers.filter(m => m.phone !== member.phone));
    } else {
      setSelectedMembers([...selectedMembers, member]);
    }
  };

  const createGroup = () => {
    if (!groupName.trim()) { showToast('请输入群名称'); return; }
    if (selectedMembers.length === 0) { showToast('请至少选择一位成员'); return; }
    showToast(`群聊「${groupName}」已创建，包含 ${selectedMembers.length} 位成员`);
    setShowCreateGroupModal(false);
    setGroupName('');
    setSelectedMembers([]);
  };

  const saveNotifySettings = () => {
    showToast('通知设置已保存');
    setShowNotifyModal(false);
  };

  const changeBgColor = (color) => {
    setBgColor(color);
    showToast('聊天背景已更换');
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: BG_CARD }}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={{ padding: 8 }}>
            <Ionicons name="chevron-back" size={24} color={TEXT_MAIN} />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>聊天设置</Text>
          <View style={{ width: 24 }} />
        </View>
      </SafeAreaView>
      <ScrollView style={{ paddingHorizontal: 16 }}>
        <View style={{ marginTop: 16 }}>
          <TouchableOpacity style={styles.chatSettingItem} onPress={() => setShowGroupMembers(!showGroupMembers)}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: PRIMARY_COLOR, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
              <Ionicons name="people" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pageTitle}>内部群聊</Text>
              <Text style={[styles.chatSettingDesc, { color: TEXT_THIRD }]}>群成员: {allMembers.length}人{showGroupMembers ? ' ▼' : ' ▶'}</Text>
            </View>
          </TouchableOpacity>
          {showGroupMembers && (
            <View style={{ backgroundColor: '#fff', borderRadius: 8, padding: 14, marginTop: 8 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
                {allMembers.map((m, idx) => (
                  <TouchableOpacity key={idx} style={{ width: 72, alignItems: 'center' }}>
                    <View style={{ width: 56, height: 56, borderRadius: 8, backgroundColor: m.isOwner ? PRIMARY_COLOR : '#7B8DF0', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
                      {m.avatar && (m.avatar.startsWith('http') || m.avatar.startsWith('file') || m.avatar.startsWith('data')) ? (
                        <Image source={{ uri: m.avatar }} style={{ width: '100%', height: '100%', borderRadius: 8 }} />
                      ) : (
                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 20 }}>{(m.name || '?').substring(0, 1)}</Text>
                      )}
                      {m.isOwner && (
                        <View style={{ position: 'absolute', bottom: -2, right: -2, backgroundColor: '#FFD93D', borderRadius: 8, paddingHorizontal: 4, paddingVertical: 1, borderWidth: 1, borderColor: '#fff' }}>
                          <Text style={{ color: '#5B6DF0', fontSize: 8, fontWeight: 'bold' }}>老板</Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ fontSize: 11, color: TEXT_MAIN, marginTop: 6, textAlign: 'center' }} numberOfLines={1}>{m.name}</Text>
                    <Text style={{ fontSize: 9, color: TEXT_THIRD, textAlign: 'center' }}>{m.isOwner ? '老板' : '员工'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>
        <View style={{ marginTop: 16, backgroundColor: BG_CARD, borderRadius: 14, overflow: 'hidden', ...SHADOW }}>
          <TouchableOpacity style={styles.chatSettingItem} onPress={() => setShowCreateGroupModal(true)}>
            <Ionicons name="person-add-outline" size={22} color={PRIMARY_COLOR} />
            <Text style={styles.chatSettingText}>发起群聊</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.chatSettingItem} onPress={() => setShowSearchModal(true)}>
            <Ionicons name="search-outline" size={22} color={PRIMARY_COLOR} />
            <Text style={styles.chatSettingText}>查找聊天记录</Text>
          </TouchableOpacity>
        </View>
        <View style={{ marginTop: 16, backgroundColor: BG_CARD, borderRadius: 14, overflow: 'hidden', ...SHADOW }}>
          <TouchableOpacity style={styles.chatSettingItem} onPress={toggleTop}>
            <Ionicons name="pin-outline" size={22} color={PRIMARY_COLOR} />
            <Text style={styles.chatSettingText}>{isTop ? '取消置顶' : '设为置顶'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.chatSettingItem, { borderBottomWidth: 0 }]} onPress={toggleSpecialCare}>
            <Ionicons name="heart-outline" size={22} color={PRIMARY_COLOR} />
            <Text style={styles.chatSettingText}>特别关心</Text>
            {isSpecialCare && <Text style={[styles.chatSettingDesc, { color: SUCCESS_COLOR }]}>已开启</Text>}
          </TouchableOpacity>
        </View>
        <View style={{ marginTop: 16, backgroundColor: BG_CARD, borderRadius: 14, overflow: 'hidden', ...SHADOW }}>
          <TouchableOpacity style={styles.chatSettingItem} onPress={() => setShowNotifyModal(true)}>
            <Ionicons name="notifications-circle-outline" size={22} color={PRIMARY_COLOR} />
            <Text style={styles.chatSettingText}>消息通知设置</Text>
            <Text style={styles.chatSettingDesc}>通知预览、提示音等></Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.chatSettingItem, { borderBottomWidth: 0 }]} onPress={() => setShowMediaModal(true)}>
            <Ionicons name="color-palette-outline" size={22} color={PRIMARY_COLOR} />
            <Text style={styles.chatSettingText}>设置当前聊天背景</Text>
          </TouchableOpacity>
        </View>
        <View style={{ marginTop: 16, backgroundColor: BG_CARD, borderRadius: 14, overflow: 'hidden', ...SHADOW }}>
          <TouchableOpacity style={[styles.chatSettingItem, { borderBottomWidth: 0 }]} onPress={clearMessages}>
            <Ionicons name="trash-outline" size={22} color={DANGER_COLOR} />
            <Text style={{ ...styles.chatSettingText, color: DANGER_COLOR }}>删除聊天记录</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={showSearchModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#F5F7FA' }}>
          <SafeAreaView edges={['top']} style={{ backgroundColor: '#fff' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 10, borderBottomWidth: 1, borderColor: BORDER_COLOR }}>
              <TouchableOpacity onPress={() => { setShowSearchModal(false); setSearchText(''); setSearchResults([]); }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={{ padding: 8 }}>
                <Ionicons name="chevron-back" size={24} color={TEXT_MAIN} />
              </TouchableOpacity>
              <Text style={{ fontSize: 17, fontWeight: 'bold', color: TEXT_MAIN, flex: 1, marginLeft: 4 }}>查找聊天记录</Text>
            </View>
          </SafeAreaView>
          <View style={{ padding: 14, backgroundColor: '#fff' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F2F5', borderRadius: 22, paddingHorizontal: 14, paddingVertical: 8 }}>
              <Ionicons name="search" size={18} color={TEXT_THIRD} />
              <TextInput style={{ flex: 1, fontSize: 14, marginLeft: 8, color: TEXT_MAIN }} placeholder={searchType === 'member' ? '输入成员姓名' : '搜索所有聊天内容'} value={searchText} onChangeText={setSearchText} onSubmitEditing={searchMessages} returnKeyType="search" />
              {searchText ? (
                <TouchableOpacity onPress={() => setSearchText('')}>
                  <Ionicons name="close-circle" size={18} color={TEXT_THIRD} />
                </TouchableOpacity>
              ) : null}
            </View>
            {/* 类型筛选（不含图片视频文件） */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              {[
                { key: 'all', label: '全部' },
                { key: 'text', label: '文字' },
                { key: 'member', label: '按成员' },
              ].map(t => (
                <TouchableOpacity key={t.key} onPress={() => setSearchType(t.key)} style={{ paddingHorizontal: 14, paddingVertical: 6, backgroundColor: searchType === t.key ? PRIMARY_COLOR : '#F0F2F5', borderRadius: 16 }}>
                  <Text style={{ fontSize: 12, color: searchType === t.key ? '#fff' : TEXT_MAIN }}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {/* 群成员快捷筛选（点击查看该成员所有消息） */}
            <View style={{ marginTop: 14 }}>
              <Text style={{ fontSize: 12, color: TEXT_THIRD, marginBottom: 8 }}>点击群成员查看其所有消息</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {allMembers.map((m, idx) => (
                    <TouchableOpacity key={idx} onPress={() => { setSearchType('member'); setSearchText(m.name); searchMessages(); }} style={{ alignItems: 'center', width: 56 }}>
                      <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: m.isOwner ? PRIMARY_COLOR : '#7B8DF0', justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>{(m.name || '?').substring(0, 1)}</Text>
                      </View>
                      <Text style={{ fontSize: 10, color: TEXT_MAIN, marginTop: 4 }} numberOfLines={1}>{m.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>
          <ScrollView style={{ flex: 1, padding: 12 }}>
            {searchResults.length > 0 ? (
              <>
                <Text style={{ fontSize: 12, color: TEXT_THIRD, marginBottom: 8 }}>共找到 {searchResults.length} 条记录</Text>
                {searchResults.map((m, idx) => (
                  <TouchableOpacity key={idx} style={{ padding: 12, backgroundColor: '#fff', borderRadius: 8, marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: m.from === user?.phone ? PRIMARY_COLOR : '#7B8DF0', justifyContent: 'center', alignItems: 'center', marginRight: 6 }}>
                          <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>{(m.fromName || m.from || '?').substring(0, 1)}</Text>
                        </View>
                        <Text style={{ fontSize: 12, color: PRIMARY_COLOR, fontWeight: '600' }}>{m.fromName || m.from}</Text>
                      </View>
                      <Text style={{ fontSize: 10, color: TEXT_THIRD }}>{formatTime(m.time)}</Text>
                    </View>
                    <Text style={{ fontSize: 14, color: TEXT_MAIN, lineHeight: 20 }} numberOfLines={3}>{m.text || (m.image ? '🖼️ [图片]' : m.video ? '🎬 [视频]' : m.file ? '📎 [文件]' : '[消息]')}</Text>
                  </TouchableOpacity>
                ))}
              </>
            ) : searchText ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <Ionicons name="search" size={48} color={TEXT_THIRD} />
                <Text style={{ color: TEXT_THIRD, marginTop: 12 }}>未找到匹配记录</Text>
              </View>
            ) : (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <Ionicons name="search" size={48} color={TEXT_THIRD} />
                <Text style={{ color: TEXT_THIRD, marginTop: 12, textAlign: 'center' }}>输入关键词搜索所有聊天内容{'\n'}或点击上方群成员查看其所有消息</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={showMediaModal} transparent animationType="fade">
        <View style={styles.modalMask}>
          <View style={styles.modalWrap}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>媒体管理</Text>
              <TouchableOpacity onPress={() => setShowMediaModal(false)}><Text style={styles.closeTxt}>✕</Text></TouchableOpacity>
            </View>
            <Text style={styles.label}>选择聊天背景</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {bgColors.map((color, idx) => (
                <TouchableOpacity key={idx} style={{ width: 50, height: 50, borderRadius: 10, backgroundColor: color, borderWidth: bgColor === color ? 3 : 0, borderColor: PRIMARY_COLOR }} onPress={() => { changeBgColor(color); setShowMediaModal(false); }} />
              ))}
            </View>
            <Text style={styles.label}>图片和视频</Text>
            <Text style={{ color: TEXT_THIRD, fontSize: 14, textAlign: 'center', paddingVertical: 16 }}>暂无媒体文件</Text>
          </View>
        </View>
      </Modal>

      <Modal visible={showNotifyModal} transparent animationType="fade">
        <View style={styles.modalMask}>
          <View style={styles.modalWrap}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>消息通知设置</Text>
              <TouchableOpacity onPress={() => setShowNotifyModal(false)}><Text style={styles.closeTxt}>✕</Text></TouchableOpacity>
            </View>
            <View style={styles.settingGroup}>
              <View style={styles.settingItem}>
                <Ionicons name="volume-high-outline" size={22} color={PRIMARY_COLOR} />
                <Text style={{ flex: 1, color: TEXT_MAIN }}>提示音</Text>
                <TouchableOpacity style={{ width: 50, height: 28, borderRadius: 14, backgroundColor: soundEnabled ? PRIMARY_COLOR : '#ddd', justifyContent: 'center', paddingHorizontal: 4 }} onPress={() => setSoundEnabled(!soundEnabled)}>
                  <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', marginLeft: soundEnabled ? 22 : 0 }} />
                </TouchableOpacity>
              </View>
              <View style={styles.settingItem}>
                <Ionicons name="vibrate-outline" size={22} color={PRIMARY_COLOR} />
                <Text style={{ flex: 1, color: TEXT_MAIN }}>震动</Text>
                <TouchableOpacity style={{ width: 50, height: 28, borderRadius: 14, backgroundColor: vibrationEnabled ? PRIMARY_COLOR : '#ddd', justifyContent: 'center', paddingHorizontal: 4 }} onPress={() => setVibrationEnabled(!vibrationEnabled)}>
                  <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', marginLeft: vibrationEnabled ? 22 : 0 }} />
                </TouchableOpacity>
              </View>
              <View style={[styles.settingItem, styles.settingItemLast]}>
                <Ionicons name="eye-outline" size={22} color={PRIMARY_COLOR} />
                <Text style={{ flex: 1, color: TEXT_MAIN }}>通知预览</Text>
                <TouchableOpacity style={{ width: 50, height: 28, borderRadius: 14, backgroundColor: previewEnabled ? PRIMARY_COLOR : '#ddd', justifyContent: 'center', paddingHorizontal: 4 }} onPress={() => setPreviewEnabled(!previewEnabled)}>
                  <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', marginLeft: previewEnabled ? 22 : 0 }} />
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity style={styles.primaryBtn} onPress={saveNotifySettings}><Text style={styles.sendTxt}>保存设置</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showCreateGroupModal} transparent animationType="fade">
        <View style={styles.modalMask}>
          <View style={styles.modalWrap}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>发起群聊</Text>
              <TouchableOpacity onPress={() => { setShowCreateGroupModal(false); setGroupName(''); setSelectedMembers([]); }}><Text style={styles.closeTxt}>✕</Text></TouchableOpacity>
            </View>
            <Text style={styles.label}>群名称</Text>
            <TextInput style={styles.formInput} placeholder="输入群名称" value={groupName} onChangeText={setGroupName} />
            <Text style={styles.label}>选择成员 ({selectedMembers.length})</Text>
            <ScrollView style={{ maxHeight: 200 }}>
              {staffMembers.map(member => (
                <TouchableOpacity key={member.phone} style={{ padding: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: BORDER_COLOR }} onPress={() => toggleMemberSelect(member)}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: selectedMembers.find(m => m.phone === member.phone) ? PRIMARY_COLOR : BORDER_COLOR, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                    {selectedMembers.find(m => m.phone === member.phone) && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: PRIMARY_COLOR }} />}
                  </View>
                  <Text style={{ flex: 1, color: TEXT_MAIN }}>{member.name}</Text>
                  <Text style={{ color: TEXT_THIRD, fontSize: 12 }}>{member.phone}</Text>
                </TouchableOpacity>
              ))}
              {staffMembers.length === 0 && <Text style={{ color: TEXT_THIRD, textAlign: 'center', padding: 16 }}>暂无员工，请先添加</Text>}
            </ScrollView>
            <TouchableOpacity style={styles.primaryBtn} onPress={createGroup}><Text style={styles.sendTxt}>创建群聊</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ================== 语音助手（独立页面，支持语音输入、网络搜索、商家数据） ==================
const VoiceAssistant = () => {
  const navigation = useNavigation();
  const { state } = useApp();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const scrollViewRef = useRef(null);
  const abortControllerRef = useRef(null);
  const recognitionRef = useRef(null);

  const industry = state.shopInfo?.industry || '待识别';
  const shopName = state.shopInfo?.shopName || '我的门店';
  const userName = state.user?.name || '老板';

  // 收集软件全局所有数据
  const collectAllBusinessData = () => {
    const orders = state.globalOrderRecord || [];
    const goods = state.goodsList || [];
    const stockRecords = state.globalStockRecord || [];
    const todayStr = new Date().toISOString().split('T')[0];
    const thisMonth = todayStr.substring(0, 7);
    const todayOrders = orders.filter(o => o.time?.startsWith(todayStr));
    const monthOrders = orders.filter(o => o.time?.startsWith(thisMonth));
    const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.couponPrice || 0), 0);
    const monthRevenue = monthOrders.reduce((sum, o) => sum + (o.couponPrice || 0), 0);
    const totalRevenue = orders.reduce((sum, o) => sum + (o.couponPrice || 0), 0);
    const totalStock = goods.reduce((sum, g) => sum + (g.stock || 0), 0);
    const lowStockItems = goods.filter(g => (g.stock || 0) < 10).map(g => `${g.name}(库存:${g.stock})`);
    const todayIn = stockRecords.filter(r => r.type === '入库' && r.time?.startsWith(todayStr)).reduce((s, r) => s + (r.quantity || 0), 0);
    const todayOut = stockRecords.filter(r => r.type === '出库' && r.time?.startsWith(todayStr)).reduce((s, r) => s + (r.quantity || 0), 0);
    const platformStats = {};
    orders.forEach(o => {
      if (o.platform) {
        if (!platformStats[o.platform]) platformStats[o.platform] = { count: 0, revenue: 0 };
        platformStats[o.platform].count++;
        platformStats[o.platform].revenue += o.couponPrice || 0;
      }
    });
    return {
      shopName, industry, userName,
      todayOrders: todayOrders.length, todayRevenue, monthOrders: monthOrders.length, monthRevenue, totalOrders: orders.length, totalRevenue,
      totalGoods: goods.length, totalStock, lowStockItems,
      todayIn, todayOut,
      platformStats,
      badReviewCount: state.badReviewCount || 0,
      staffCount: (state.staffMemberList || []).filter(s => s.status === 'approved').length,
    };
  };

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: '1',
        text: `您好 ${userName}！我是您的智能语音助手 🎙️\n\n我可以：\n🎙️ 直接语音对话（点击下方麦克风按钮）\n🔍 联网搜索最新行业信息\n📊 分析您店铺的真实经营数据\n💡 提供针对性的经营建议\n\n请直接说话或输入问题！`,
        from: 'ai',
        time: new Date().toISOString(),
      }]);
    }
  }, []);

  // 语音识别（Web Speech API）
  const startVoice = () => {
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        showToast('当前环境不支持语音识别');
        return;
      }
      const recognition = new SpeechRecognition();
      recognition.lang = 'zh-CN';
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.onstart = () => {
        setRecording(true);
        setRecognizing(true);
        showToast('正在聆听...请说话');
      };
      recognition.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }
        if (finalTranscript) {
          setInputText(prev => prev + finalTranscript);
        } else if (interimTranscript) {
          setInputText(interimTranscript);
        }
      };
      recognition.onerror = (event) => {
        console.error('语音识别错误:', event.error);
        if (event.error === 'no-speech') showToast('未检测到语音');
        else if (event.error === 'not-allowed') showToast('请允许使用麦克风');
        else showToast('语音识别出错');
        setRecording(false);
        setRecognizing(false);
      };
      recognition.onend = () => {
        setRecording(false);
        setRecognizing(false);
      };
      recognitionRef.current = recognition;
      recognition.start();
    } catch (error) {
      console.error('启动语音识别失败:', error);
      showToast('启动语音识别失败');
      setRecording(false);
      setRecognizing(false);
    }
  };

  const stopVoice = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
    setRecording(false);
    setRecognizing(false);
  };

  // 语音播报回复
  const speakText = (text) => {
    try {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text.substring(0, 200));
        utter.lang = 'zh-CN';
        utter.rate = 1.0;
        window.speechSynthesis.speak(utter);
      }
    } catch (error) {
      console.error('语音播报失败:', error);
    }
  };

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text) return;
    const userMsg = {
      id: Date.now().toString(),
      text,
      from: 'user',
      time: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    abortControllerRef.current = new AbortController();
    setLoading(true);

    try {
      const allData = collectAllBusinessData();
      const businessContext = `【店铺信息】名称：${allData.shopName}，类型：${allData.industry}
【核心数据】今日订单：${allData.todayOrders}单，今日营收：¥${allData.todayRevenue}，本月订单：${allData.monthOrders}单，本月营收：¥${allData.monthRevenue}，总营收：¥${allData.totalRevenue}
【库存】商品总数：${allData.totalGoods}，总库存：${allData.totalStock}，今日入库：${allData.todayIn}，今日出库：${allData.todayOut}，库存不足：${allData.lowStockItems.join('、') || '无'}
【平台分布】${Object.entries(allData.platformStats).map(([p, s]) => `${p}：${s.count}单 ¥${s.revenue}`).join('，') || '暂无'}
【其他】差评数：${allData.badReviewCount}，在职员工：${allData.staffCount}人`;

      const msgList = messages.slice(-10).map(m => ({
        role: m.from === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));
      msgList.push({ role: 'user', content: text });

      const systemPrompt = `你是「${allData.shopName}」${industry}店铺的专属智能语音助手，服务商家${userName}。

【店铺实时数据】
${businessContext}

【你的能力】
1. 直接通过语音与商家对话，回答简洁有力
2. 可以联网搜集行业最新信息（同款爆款、行业趋势、竞品动态、营销方法）
3. 基于店铺真实数据进行分析，绝对不编造数据
4. 提供可执行的具体建议

【回答风格】
- 简洁、口语化（因为是语音对话）
- 数据准确引用真实数据
- 给出具体步骤
- 用"您"称呼商家
- 重点突出，不啰嗦`;

      const reply = await fetchZhipuChat(msgList, systemPrompt, abortControllerRef.current.signal);
      if (abortControllerRef.current?.signal.aborted) {
        setLoading(false);
        abortControllerRef.current = null;
        return;
      }
      const aiMsg = {
        id: (Date.now()+1).toString(),
        text: reply,
        from: 'ai',
        time: new Date().toISOString(),
      };
      setMessages(prev => [...prev, aiMsg]);
      // 自动语音播报
      speakText(reply);
      setLoading(false);
      abortControllerRef.current = null;
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (error) {
      if (error.name === 'AbortError') {}
      else { showToast('发送失败'); }
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setLoading(false);
    showToast('已停止');
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: PRIMARY_COLOR }}>
        <View style={[styles.headerBar, { backgroundColor: PRIMARY_COLOR }]}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={[styles.pageTitle, { color: '#fff' }]}>🎙️ 智能语音助手</Text>
          {loading ? (
            <TouchableOpacity onPress={stopGeneration}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>⏹ 停止</Text>
            </TouchableOpacity>
          ) : <View style={{ width: 30 }} />}
        </View>
      </SafeAreaView>

      <ScrollView
        ref={scrollViewRef}
        style={styles.chatScroll}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 200 }}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map(msg => (
          <View key={msg.id} style={msg.from === 'user' ? styles.bubbleRight : styles.bubbleLeft}>
            {msg.from === 'ai' && <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Ionicons name="sparkles" size={14} color={PRIMARY_COLOR} />
              <Text style={{ fontSize: 11, color: PRIMARY_COLOR, marginLeft: 4 }}>AI助手</Text>
            </View>}
            <Text style={{ fontSize: 15, color: TEXT_MAIN, lineHeight: 22 }}>{msg.text}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
              <Text style={{ fontSize: 10, color: TEXT_THIRD }}>{formatTime(msg.time)}</Text>
              {msg.from === 'ai' && (
                <TouchableOpacity onPress={() => speakText(msg.text)} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="volume-high-outline" size={14} color={PRIMARY_COLOR} />
                  <Text style={{ fontSize: 10, color: PRIMARY_COLOR, marginLeft: 2 }}>朗读</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
        {loading && <View style={[styles.bubbleLeft, { padding: 12 }]}>
          <ActivityIndicator size="small" color={PRIMARY_COLOR} />
          <Text style={{ fontSize: 12, color: TEXT_SECOND, marginLeft: 8 }}>正在思考...</Text>
        </View>}
      </ScrollView>

      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: BG_CARD, borderTopWidth: 1, borderColor: BORDER_COLOR, padding: 12 }}>
        {recording && (
          <View style={{ backgroundColor: '#FFE4B5', padding: 8, borderRadius: 8, marginBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: DANGER_COLOR, marginRight: 8 }} />
            <Text style={{ fontSize: 13, color: '#FF6347', flex: 1 }}>正在聆听...{recognizing ? '已识别文字' : ''}</Text>
            <TouchableOpacity onPress={stopVoice}><Text style={{ color: DANGER_COLOR, fontSize: 13 }}>停止</Text></TouchableOpacity>
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TextInput
            style={[styles.inputBox, { flex: 1 }]}
            placeholder="输入问题或长按麦克风说话..."
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          <TouchableOpacity
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: recording ? DANGER_COLOR : PRIMARY_COLOR, justifyContent: 'center', alignItems: 'center' }}
            onPress={recording ? stopVoice : startVoice}
            disabled={loading}
          >
            <Ionicons name={recording ? "mic" : "mic-outline"} size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: inputText.trim() ? PRIMARY_COLOR : '#ccc', justifyContent: 'center', alignItems: 'center' }}
            onPress={sendMessage}
            disabled={!inputText.trim() || loading}
          >
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
      <View style={{ height: 56 }} />
    </View>
  );
};

// ================== AI助手（快捷话术 + 停止 + 行业识别） ==================
const MerchantAssistant = () => {
  const navigation = useNavigation();
  const { state, dispatch } = useApp();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [showImageGen, setShowImageGen] = useState(false);
  const scrollViewRef = useRef(null);
  const [imageUri, setImageUri] = useState(null);
  const [showMediaOptions, setShowMediaOptions] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showQuickReply, setShowQuickReply] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const abortControllerRef = useRef(null);

  const industry = state.shopInfo?.industry || '待识别';
  const shopName = state.shopInfo?.shopName || '我的门店';
  const userName = state.user?.name || '老板';

  // 收集软件全局所有数据
  const collectAllBusinessData = () => {
    const orders = state.globalOrderRecord || [];
    const goods = state.goodsList || [];
    const stockRecords = state.globalStockRecord || [];
    const badReviews = state.badReviewList || [];
    const staffList = state.staffMemberList || [];
    const todayStr = new Date().toISOString().split('T')[0];
    const thisMonth = todayStr.substring(0, 7);
    const todayOrders = orders.filter(o => o.time?.startsWith(todayStr));
    const monthOrders = orders.filter(o => o.time?.startsWith(thisMonth));
    const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.couponPrice || 0), 0);
    const monthRevenue = monthOrders.reduce((sum, o) => sum + (o.couponPrice || 0), 0);
    const totalRevenue = orders.reduce((sum, o) => sum + (o.couponPrice || 0), 0);
    const totalStock = goods.reduce((sum, g) => sum + (g.stock || 0), 0);
    const lowStockItems = goods.filter(g => (g.stock || 0) < 10).map(g => `${g.name}(库存:${g.stock})`);
    const todayIn = stockRecords.filter(r => r.type === '入库' && r.time?.startsWith(todayStr)).reduce((s, r) => s + (r.quantity || 0), 0);
    const todayOut = stockRecords.filter(r => r.type === '出库' && r.time?.startsWith(todayStr)).reduce((s, r) => s + (r.quantity || 0), 0);
    const platformStats = {};
    orders.forEach(o => {
      if (o.platform) {
        if (!platformStats[o.platform]) platformStats[o.platform] = { count: 0, revenue: 0 };
        platformStats[o.platform].count++;
        platformStats[o.platform].revenue += o.couponPrice || 0;
      }
    });
    const recentOrders = orders.slice(-10).map(o => `${o.platform}：${o.productName || '商品'} ¥${o.couponPrice || 0} ${(o.time || '').substring(11, 16)}`).join('；');
    return {
      shopName, industry, userName,
      todayOrders: todayOrders.length, todayRevenue, monthOrders: monthOrders.length, monthRevenue, totalOrders: orders.length, totalRevenue,
      totalGoods: goods.length, totalStock, lowStockItems,
      todayIn, todayOut,
      platformStats,
      recentOrders,
      badReviewCount: state.badReviewCount || 0,
      staffCount: staffList.filter(s => s.status === 'approved').length,
    };
  };

  const getQuickReplies = () => {
    if (industry === '餐饮类') {
      return [
        '今天生意怎么样？',
        '今日总营收是多少？',
        '哪些菜卖得最好？',
        '怎么提高翻台率？',
        '帮我写一份招牌菜推荐文案',
        '本周食材采购建议',
        '差评预警情况',
        '生成一份爆款海报',
      ];
    } else if (industry === '服务类') {
      return [
        '今日服务订单量是多少？',
        '怎么提升客户满意度？',
        '员工排班表怎么安排？',
        '本月服务收入目标',
        '帮我生成服务推广话术',
        '客户复购率分析',
      ];
    } else if (industry === '企业类') {
      return [
        '今日销售业绩如何？',
        '团队协作效率提升',
        '项目汇报模板',
        '员工绩效怎么考核？',
        '本月招聘计划',
        '客户转化率分析',
      ];
    }
    return ['今天生意怎么样？', '有什么经营建议？', '帮我分析数据', '生成一份报表', '怎么提高利润？'];
  };

  const quickReplies = getQuickReplies();

  useEffect(() => {
    if (messages.length === 0) {
      if (industry === '待识别' && shopName) {
        // 第一次打开AI助手且未识别 - 进行识别
        setMessages([{ id: '1', text: `您好！我是经营宝AI助手，正在识别您的店铺类型...`, from: 'ai', time: new Date().toISOString() }]);
        const abortController = new AbortController();
        fetchZhipuChat([], `请根据店铺名称「${shopName}」判断商家类型，只能在以下三个类型中选择一个：餐饮类、服务类、企业类。只需返回类型名称，不要包含其他文字。`, abortController.signal)
          .then(async result => {
            let detectedIndustry = '餐饮类';
            if (result.includes('服务类')) detectedIndustry = '服务类';
            else if (result.includes('企业类')) detectedIndustry = '企业类';
            const newShopInfo = { ...state.shopInfo, industry: detectedIndustry };
            dispatch({ type: 'SET_SHOP_INFO', payload: { industry: detectedIndustry } });
            // 持久化到 AsyncStorage
            try { await AsyncStorage.setItem('shopInfo', JSON.stringify(newShopInfo)); } catch (e) {}
            setMessages([
              { id: '1', text: `您好 ${userName}！已识别您的${detectedIndustry}店铺「${shopName}」。\n\n我可以帮您：\n📊 分析经营数据\n💡 提升利润建议\n📝 生成营销文案、海报\n📅 生成日报/周报/月报\n⚠️ 差评预警处理\n\n请直接输入您的问题！`, from: 'ai', time: new Date().toISOString() }
            ]);
          })
          .catch(() => {
            setMessages([{ id: '1', text: `您好 ${userName}！我是经营宝AI助手，您的店铺「${shopName}」的智能管家。\n\n我可以帮您分析经营数据、生成营销文案、回答经营问题。\n\n请直接输入您的问题！`, from: 'ai', time: new Date().toISOString() }]);
          });
      } else if (industry === '待识别' && !shopName) {
        setMessages([
          { id: '1', text: `您好 ${userName}！我是经营宝AI助手。\n\n请先在设置中填写您的门店名称，我可以帮您：\n📊 分析经营数据\n💡 提供经营建议\n📝 生成营销文案、海报\n📅 生成各类报表\n\n请直接输入您的问题！`, from: 'ai', time: new Date().toISOString() }
        ]);
      } else {
        // 已识别 - 直接显示欢迎语
        setMessages([
          { id: '1', text: `您好 ${userName}！我是您的${industry}店铺「${shopName}」智能管家。\n\n我可以帮您：\n📊 实时分析经营数据\n💡 提供利润提升建议\n📝 生成营销文案/海报/广告语\n📅 自动生成日报/周报/月报\n⚠️ 差评预警识别\n\n请直接输入您的问题！`, from: 'ai', time: new Date().toISOString() }
        ]);
      }
    }
  }, []);

  const handleMarketing = (type) => {
    const prompts = {
      '文案': `帮我写一条关于${shopName}的${industry}爆款营销文案，要求有吸引力、适合社交平台传播`,
      '海报': `帮我设计一张${shopName}${industry}店铺的宣传海报文字描述，要求突出卖点`,
      '广告语': `帮我写3条${shopName}${industry}店铺的简短有力广告语`,
      '日报': `根据我的经营数据生成今日日报`,
      '周报': `根据我的经营数据生成本周周报`,
      '月报': `根据我的经营数据生成本月月报`,
    };
    setInputText(prompts[type] || '');
    if (type === '海报' || type === '广告语') setShowImageGen(true);
  };

  const toggleImageGen = () => {
    setShowImageGen(!showImageGen);
    const hint = {
      id: Date.now().toString(),
      text: showImageGen ? '已切换回问答模式' : '🖼️ 图片生成模式已开启，输入您想要的画面描述即可生成图片。我会参考当前${industry}行业的爆款设计风格为您生成。'.replace('${industry}', industry),
      from: 'ai',
      time: new Date().toISOString(),
    };
    setMessages(prev => [...prev, hint]);
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setLoading(false);
      showToast('已停止生成');
    }
  };

  // 检测是否是数据查询/分析类问题
  const isDataQuery = (text) => {
    const keywords = ['生意', '营收', '订单', '库存', '卖', '数据', '差评', '报告', '统计', '多少', '怎样', '如何', '怎么', '建议', '提升', '增长', '利润'];
    return keywords.some(k => text.includes(k));
  };

  // 检测是否是生成图片类
  const isImageGenRequest = (text) => {
    return /海报|图片|设计|封面|宣传|画|生成图/.test(text);
  };

  // 检测是否是日报/周报/月报
  const isReportRequest = (text) => {
    return /日报|周报|月报|报告/.test(text);
  };

  const sendMessage = async (type = 'text') => {
    try {
      let text = inputText.trim();
      let image = null;
      if (type === 'image') {
        if (!imageUri) return;
        const compressed = await compressImage(imageUri);
        const base64 = await FileSystem.readAsStringAsync(compressed, { encoding: FileSystem.EncodingType.Base64 });
        image = `data:image/jpeg;base64,${base64}`;
      } else if (!text) return;
      const userMsg = {
        id: Date.now().toString(),
        text: type === 'text' ? text : '',
        image: image || null,
        from: 'user',
        time: new Date().toISOString(),
      };
      setMessages(prev => [...prev, userMsg]);
      setInputText('');
      setImageUri(null);
      setShowMediaOptions(false);
      setShowEmoji(false);
      if (type === 'image') {
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
        return;
      }

      abortControllerRef.current = new AbortController();
      setLoading(true);

      // 收集所有真实数据
      const allData = collectAllBusinessData();
      const businessContext = `【店铺信息】名称：${allData.shopName}，类型：${allData.industry}
【核心数据】今日订单：${allData.todayOrders}单，今日营收：¥${allData.todayRevenue}，本月订单：${allData.monthOrders}单，本月营收：¥${allData.monthRevenue}，总营收：¥${allData.totalRevenue}
【库存情况】商品总数：${allData.totalGoods}，总库存：${allData.totalStock}，今日入库：${allData.todayIn}，今日出库：${allData.todayOut}，库存不足：${allData.lowStockItems.join('、') || '无'}
【平台分布】${Object.entries(allData.platformStats).map(([p, s]) => `${p}：${s.count}单 ¥${s.revenue}`).join('，') || '暂无'}
【最近10条订单】${allData.recentOrders || '暂无'}
【其他】差评数：${allData.badReviewCount}，在职员工：${allData.staffCount}人`;

      const msgList = messages.filter(m => m.from !== 'system').slice(-10).map(m => ({
        role: m.from === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));
      msgList.push({ role: 'user', content: text });

      // 判断是否需要生成图片
      const shouldGenImage = showImageGen || isImageGenRequest(text);
      // 判断是否是报告请求
      const isReport = isReportRequest(text);
      let reply = '';

      if (shouldGenImage) {
        try {
          const fullPrompt = `${text}，适用于${industry}店铺「${shopName}」的宣传，参考当前${industry}行业爆款海报的设计风格：构图简洁、色彩鲜明、突出卖点、吸引眼球，风格时尚高端。`;
          const imageResult = await fetchZhipuImage(fullPrompt, abortControllerRef.current.signal);
          if (!abortControllerRef.current.signal.aborted && imageResult && imageResult !== 'aborted') {
            const aiMsg = {
              id: (Date.now()+1).toString(),
              text: '🎨 已为您生成图片，结合了' + industry + '行业当前流行的爆款设计风格：',
              image: imageResult,
              from: 'ai',
              time: new Date().toISOString(),
            };
            setMessages(prev => [...prev, aiMsg]);
            setLoading(false);
            abortControllerRef.current = null;
            setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
            return;
          } else {
            reply = '图片生成失败，请稍后重试';
          }
        } catch (e) {
          if (e.name === 'AbortError') {
            setLoading(false);
            abortControllerRef.current = null;
            return;
          }
          reply = '图片生成失败，请稍后重试';
        }
      } else {
        // 文案/对话
        const systemPrompt = `你是「${allData.shopName}」${industry}店铺的专属AI助手，服务对象是商家${userName}。

【店铺全量实时数据】
${businessContext}

【你的核心职责】
1. 基于上述真实数据回答商家问题，绝对不能编造数据
2. 经营分析：分析营收、订单、库存、利润等数据，提供可执行的提升方案
3. 报告生成：日报/周报/月报都要用真实数据计算和总结
4. 营销支持：根据${industry}行业特点生成爆款文案、海报描述、广告语
5. 问题诊断：差评预警、库存预警、营收下滑等问题诊断
6. 顾问建议：如何提高利润、翻台率、客单价、复购率等

【回答风格】
- 直接、实用、可执行
- 数据要准确引用上面提供的真实数据
- 给出具体可操作的建议步骤
- 用"您"称呼商家
- 重点突出，分段清晰
- 必要时用数字和百分比说话`;
        reply = await fetchZhipuChat(msgList, systemPrompt, abortControllerRef.current.signal);
      }
      if (abortControllerRef.current?.signal.aborted) {
        setLoading(false);
        abortControllerRef.current = null;
        return;
      }
      const aiMsg = {
        id: (Date.now()+1).toString(),
        text: reply,
        from: 'ai',
        time: new Date().toISOString(),
      };
      setMessages(prev => [...prev, aiMsg]);
      setLoading(false);
      abortControllerRef.current = null;
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (error) {
      if (error.name === 'AbortError') {}
      else { showToast('发送失败'); }
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const pickImage = async (source) => {
    try {
      setShowMediaOptions(false);
      const options = { mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 0.7 };
      let result;
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') { showToast('需要相机权限'); return; }
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { showToast('需要相册权限'); return; }
        result = await ImagePicker.launchImageLibraryAsync(options);
      }
      if (!result.canceled) {
        setImageUri(result.assets[0].uri);
        await sendMessage('image');
      }
    } catch (error) {
      showToast('选择图片失败');
    }
  };

  return (
    <View style={styles.container}>
      <FullscreenImageViewer
        visible={!!fullscreenImage}
        imageUri={fullscreenImage}
        onClose={() => setFullscreenImage(null)}
      />
      <SafeAreaView edges={['top']} style={{ backgroundColor: BG_CARD }}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={{ padding: 8 }}>
            <Ionicons name="chevron-back" size={24} color={TEXT_MAIN} />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>AI助手</Text>
          <View style={{ flexDirection: 'row' }}>
            {loading && (
              <TouchableOpacity onPress={stopGeneration} style={{ marginRight: 10 }}>
                <Text style={{ color: DANGER_COLOR, fontWeight: 'bold' }}>⏹ 停止</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={toggleImageGen}>
              <Text style={{ fontSize: 16, color: showImageGen ? SUCCESS_COLOR : PRIMARY_COLOR }}>
                {showImageGen ? '🎨 图片模式' : '🖼️ 开启图片'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
      <ScrollView
        ref={scrollViewRef}
        style={styles.chatScroll}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 80 }}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map(msg => (
          <View key={msg.id} style={msg.from === 'user' ? styles.bubbleRight : styles.bubbleLeft}>
            {msg.image ? (
              <>
                <Text style={{ fontSize: 14, color: TEXT_SECOND, marginBottom: 4 }}>{msg.text}</Text>
                <TouchableOpacity onPress={() => setFullscreenImage(msg.image)}>
                  <Image source={{ uri: msg.image }} style={styles.imageMessage} />
                  <View style={{ position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, padding: 4, flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="expand-outline" size={12} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 10, marginLeft: 2 }}>全屏</Text>
                  </View>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={{ fontSize: 15, color: TEXT_MAIN }}>{msg.text}</Text>
            )}
            <Text style={{ fontSize: 10, color: TEXT_THIRD, marginTop: 4 }}>{formatTime(msg.time)}</Text>
          </View>
        ))}
        {loading && <View style={[styles.bubbleLeft, { padding: 12 }]}><ActivityIndicator size="small" color={PRIMARY_COLOR} /></View>}
      </ScrollView>
      {showEmoji && (
        <View style={styles.emojiRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {EMOJI_LIST.map(emoji => (
              <TouchableOpacity key={emoji} onPress={() => { setInputText(inputText + emoji); setShowEmoji(false); }}>
                <Text style={{ fontSize: 28, marginHorizontal: 4 }}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
      {showMediaOptions && (
        <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff', borderTopWidth: 1, borderColor: BORDER_COLOR }}>
          <TouchableOpacity style={{ flex: 1, alignItems: 'center', padding: 8 }} onPress={() => pickImage('camera')}>
            <Ionicons name="camera-outline" size={24} color={PRIMARY_COLOR} />
            <Text style={{ fontSize: 12, color: TEXT_SECOND }}>拍照</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 1, alignItems: 'center', padding: 8 }} onPress={() => pickImage('library')}>
            <Ionicons name="images-outline" size={24} color={PRIMARY_COLOR} />
            <Text style={{ fontSize: 12, color: TEXT_SECOND }}>相册</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 1, alignItems: 'center', padding: 8 }} onPress={() => setShowMediaOptions(false)}>
            <Ionicons name="close-outline" size={24} color={DANGER_COLOR} />
            <Text style={{ fontSize: 12, color: DANGER_COLOR }}>取消</Text>
          </TouchableOpacity>
        </View>
      )}
      {showQuickReply && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: BG_CARD, borderTopWidth: 1, borderColor: BORDER_COLOR }}>
          {['文案', '海报', '广告语', '日报', '周报', '月报'].map(label => (
            <TouchableOpacity key={label} style={{ marginRight: 8, marginBottom: 4, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: label === '海报' || label === '广告语' ? '#FFE4B5' : LIGHT_PRIMARY, borderRadius: 16 }} onPress={() => handleMarketing(label)}>
              <Text style={{ fontSize: 13, color: label === '海报' || label === '广告语' ? '#FF8C00' : PRIMARY_COLOR }}>📣 {label}</Text>
            </TouchableOpacity>
          ))}
          {quickReplies.map((text, idx) => (
            <TouchableOpacity key={idx} style={{ marginRight: 8, marginBottom: 4, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: LIGHT_PRIMARY, borderRadius: 16 }} onPress={() => setInputText(text)}>
              <Text style={{ fontSize: 13, color: PRIMARY_COLOR }}>{text}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <View style={styles.inputBar}>
        <TouchableOpacity onPress={() => setShowEmoji(!showEmoji)} style={{ paddingHorizontal: 8 }}><Text style={{ fontSize: 24 }}>😊</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => setShowMediaOptions(true)} style={{ paddingHorizontal: 8 }}><Ionicons name="add-circle-outline" size={24} color={PRIMARY_COLOR} /></TouchableOpacity>
        <TouchableOpacity onPress={() => setShowQuickReply(!showQuickReply)} style={{ paddingHorizontal: 8 }}><Ionicons name="flash" size={22} color={PRIMARY_COLOR} /></TouchableOpacity>
        <TextInput
          style={[styles.inputBox, { flex: 1 }]}
          placeholder={showImageGen ? "输入图片描述..." : "输入问题..."}
          value={inputText}
          onChangeText={setInputText}
          multiline
        />
        <TouchableOpacity style={styles.sendBtn} onPress={() => sendMessage('text')} disabled={loading}>
          <Text style={styles.sendTxt}>发送</Text>
        </TouchableOpacity>
      </View>
      <View style={{ height: 56 }} />
    </View>
  );
};

// ================== 首页全屏语音助手（覆盖层） ==================
const HomeVoiceAssistant = ({ visible, onClose }) => {
  const { state } = useApp();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [voiceMode, setVoiceMode] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const scrollViewRef = useRef(null);
  const abortControllerRef = useRef(null);
  const recognitionRef = useRef(null);
  const speechTimerRef = useRef(null);

  const industry = state.shopInfo?.industry || '餐饮类';
  const shopName = state.shopInfo?.shopName || '我的门店';
  const userName = state.user?.name || '老板';

  const collectAllBusinessData = () => {
    const orders = state.globalOrderRecord || [];
    const goods = state.goodsList || [];
    const stockRecords = state.globalStockRecord || [];
    const todayStr = new Date().toISOString().split('T')[0];
    const todayOrders = orders.filter(o => o.time?.startsWith(todayStr));
    const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.couponPrice || 0), 0);
    const totalStock = goods.reduce((sum, g) => sum + (g.stock || 0), 0);
    const lowStockItems = goods.filter(g => (g.stock || 0) < 10).map(g => `${g.name}(库存:${g.stock})`);
    const platformStats = {};
    orders.forEach(o => {
      if (o.platform) {
        if (!platformStats[o.platform]) platformStats[o.platform] = { count: 0, revenue: 0 };
        platformStats[o.platform].count++;
        platformStats[o.platform].revenue += o.couponPrice || 0;
      }
    });
    return { todayOrders: todayOrders.length, todayRevenue, totalGoods: goods.length, totalStock, lowStockItems, platformStats };
  };

  useEffect(() => {
    if (visible && messages.length === 0) {
      setMessages([{
        id: '1',
        text: `您好 ${userName}！我是您的智能语音助手 🎙️\n\n点击麦克风直接说话，AI会一边语音播报一边显示文字。\n\n点击右上角的"🔊 语音"按钮可切换为仅文字模式。`,
        from: 'ai',
        time: new Date().toISOString(),
      }]);
    }
  }, [visible]);

  const startVoice = () => {
    try {
      // 兼容多种环境
      const SR = (typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition))
        || (typeof global !== 'undefined' && (global.SpeechRecognition || global.webkitSpeechRecognition));
      if (!SR) { showToast('当前环境不支持语音识别，请使用文字输入'); return; }
      const recognition = new SR();
      recognition.lang = 'zh-CN';
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.maxAlternatives = 1;
      recognition.onstart = () => { setRecording(true); showToast('正在聆听...请说话'); };
      recognition.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) finalTranscript += transcript;
          else interimTranscript += transcript;
        }
        if (finalTranscript) setInputText(prev => (prev + ' ' + finalTranscript).trim());
        else if (interimTranscript) setInputText(interimTranscript);
      };
      recognition.onerror = (e) => {
        setRecording(false);
        const err = e.error || '未知错误';
        if (err === 'no-speech') showToast('未检测到语音，请重试');
        else if (err === 'not-allowed') showToast('请授权麦克风权限');
        else showToast('语音识别错误：' + err);
      };
      recognition.onend = () => { setRecording(false); };
      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) { showToast('启动语音失败: ' + (e?.message || e)); setRecording(false); }
  };

  const stopVoice = () => {
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch (e) {} }
    setRecording(false);
  };

  const speakText = (text) => {
    try {
      if (!voiceMode) return;
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
        // 按标点分句，更自然
        const sentences = text.split(/(?<=[。！？!?；;])/g).filter(s => s.trim());
        if (sentences.length === 0) sentences.push(text);
        let idx = 0;
        setSpeaking(true);
        const speakNext = () => {
          if (idx >= sentences.length) { setSpeaking(false); return; }
          const utter = new SpeechSynthesisUtterance(sentences[idx].trim());
          utter.lang = 'zh-CN';
          utter.rate = 1.05;
          utter.onend = () => { idx++; speechTimerRef.current = setTimeout(speakNext, 100); };
          utter.onerror = () => setSpeaking(false);
          window.speechSynthesis.speak(utter);
        };
        speakNext();
      }
    } catch (e) { setSpeaking(false); }
  };

  const stopSpeaking = () => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
    setSpeaking(false);
  };

  const toggleVoiceMode = () => {
    if (voiceMode) {
      stopSpeaking();
      setVoiceMode(false);
      showToast('已切换为仅文字模式');
    } else {
      setVoiceMode(true);
      showToast('已开启语音播报');
    }
  };

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text) return;
    const userMsg = { id: Date.now().toString(), text, from: 'user', time: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    abortControllerRef.current = new AbortController();
    setLoading(true);
    try {
      const allData = collectAllBusinessData();
      const businessContext = `今日订单：${allData.todayOrders}单，今日营收：¥${allData.todayRevenue}，商品数：${allData.totalGoods}，总库存：${allData.totalStock}，库存不足：${allData.lowStockItems.join('、') || '无'}，平台分布：${Object.entries(allData.platformStats).map(([p, s]) => `${p}${s.count}单`).join('/')}`;
      const msgList = messages.slice(-6).map(m => ({ role: m.from === 'user' ? 'user' : 'assistant', content: m.text }));
      msgList.push({ role: 'user', content: text });
      const systemPrompt = `你是「${shopName}」${industry}店铺的专属智能助手，服务商家${userName}。店铺实时数据：${businessContext}。回答要简洁直接、基于真实数据、用"您"称呼商家。`;
      const reply = await fetchZhipuChat(msgList, systemPrompt, abortControllerRef.current.signal);
      if (abortControllerRef.current?.signal.aborted) { setLoading(false); return; }
      const aiMsg = { id: (Date.now()+1).toString(), text: reply, from: 'ai', time: new Date().toISOString() };
      setMessages(prev => [...prev, aiMsg]);
      speakText(reply);
      setLoading(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) { if (e.name !== 'AbortError') showToast('发送失败'); setLoading(false); }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#F5F7FA' }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: PRIMARY_COLOR }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 10, backgroundColor: PRIMARY_COLOR }}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={{ padding: 8, zIndex: 100 }}>
            <Ionicons name="chevron-back" size={26} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 4 }}>
            <Text style={{ fontSize: 17, fontWeight: 'bold', color: '#fff' }}>🎙️ 语音助手</Text>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
              {voiceMode ? (speaking ? '🔊 正在播报...' : '🔊 语音模式') : '📝 仅文字模式'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={toggleVoiceMode}
            style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: voiceMode ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)', borderRadius: 14, flexDirection: 'row', alignItems: 'center' }}
          >
            <Ionicons name={voiceMode ? 'volume-high' : 'volume-mute'} size={14} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 11, marginLeft: 4 }}>{voiceMode ? '语音' : '静默'}</Text>
          </TouchableOpacity>
          {loading && (
            <TouchableOpacity onPress={() => { abortControllerRef.current?.abort(); stopSpeaking(); setLoading(false); }} style={{ paddingHorizontal: 8, paddingVertical: 6, marginLeft: 4 }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>⏹</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>

      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 12, paddingBottom: 200 }}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map(msg => (
          <View key={msg.id} style={{
            backgroundColor: msg.from === 'user' ? PRIMARY_COLOR : '#fff',
            alignSelf: msg.from === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '85%',
            padding: 12,
            borderRadius: 12,
            marginBottom: 10,
          }}>
            <Text style={{ fontSize: 15, color: msg.from === 'user' ? '#fff' : TEXT_MAIN, lineHeight: 22 }}>{msg.text}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
              <Text style={{ fontSize: 10, color: msg.from === 'user' ? 'rgba(255,255,255,0.7)' : TEXT_THIRD }}>{formatTime(msg.time)}</Text>
              {msg.from === 'ai' && msg.text && (
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  {voiceMode && (
                    <TouchableOpacity onPress={() => speakText(msg.text)} style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="play-circle-outline" size={14} color={PRIMARY_COLOR} />
                      <Text style={{ fontSize: 10, color: PRIMARY_COLOR, marginLeft: 2 }}>播放</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => { try { navigator.clipboard?.writeText(msg.text); showToast('已复制'); } catch(e) {} }} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="copy-outline" size={14} color={PRIMARY_COLOR} />
                    <Text style={{ fontSize: 10, color: PRIMARY_COLOR, marginLeft: 2 }}>复制</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        ))}
        {loading && (
          <View style={{ backgroundColor: '#fff', alignSelf: 'flex-start', padding: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center' }}>
            <ActivityIndicator size="small" color={PRIMARY_COLOR} />
            <Text style={{ fontSize: 12, color: TEXT_SECOND, marginLeft: 8 }}>正在思考...</Text>
          </View>
        )}
      </ScrollView>

      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopWidth: 1, borderColor: BORDER_COLOR, padding: 12 }}>
        {recording && (
          <View style={{ backgroundColor: '#FFE4B5', padding: 8, borderRadius: 8, marginBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: DANGER_COLOR, marginRight: 8 }} />
            <Text style={{ fontSize: 13, color: '#FF6347', flex: 1 }}>正在聆听...</Text>
            <TouchableOpacity onPress={stopVoice}><Text style={{ color: DANGER_COLOR, fontSize: 13 }}>停止</Text></TouchableOpacity>
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TextInput
            style={{ flex: 1, backgroundColor: '#F5F7FA', borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, maxHeight: 100 }}
            placeholder="说话或输入问题..."
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          <TouchableOpacity
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: recording ? DANGER_COLOR : '#5BC0BE', justifyContent: 'center', alignItems: 'center' }}
            onPress={recording ? stopVoice : startVoice}
            disabled={loading}
          >
            <Ionicons name={recording ? "mic" : "mic-outline"} size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: inputText.trim() ? PRIMARY_COLOR : '#ccc', justifyContent: 'center', alignItems: 'center' }}
            onPress={sendMessage}
            disabled={!inputText.trim() || loading}
          >
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
      <View style={{ height: 56 }} />
      </View>
    </Modal>
  );
};

// ================== AI助手图片全屏查看器 ==================
const FullscreenImageViewer = ({ visible, imageUri, onClose }) => {
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' }}>
        <Image source={{ uri: imageUri }} style={{ width: '100%', height: '100%', resizeMode: 'contain' }} />
        <TouchableOpacity
          style={{ position: 'absolute', top: 40, right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' }}
          onPress={onClose}
        >
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={{ position: 'absolute', bottom: 40, right: 16, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: PRIMARY_COLOR, borderRadius: 20, flexDirection: 'row', alignItems: 'center' }}
          onPress={async () => {
            try {
              const fileUri = `${FileSystem.documentDirectory}ai_image_${Date.now()}.jpg`;
              await FileSystem.downloadAsync(imageUri, fileUri);
              showToast('已下载到本地');
            } catch (e) {
              showToast('下载失败');
            }
          }}
        >
          <Ionicons name="download-outline" size={18} color="#fff" />
          <Text style={{ color: '#fff', marginLeft: 6, fontSize: 14 }}>下载图片</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

// ================== 首页（完整功能 + 员工私聊长条按钮 + 顶部适配 + 导航修复） ==================
const HomePage = () => {
  const navigation = useNavigation();
  const { state, dispatch } = useApp();
  const user = state.user;
  const insets = useSafeAreaInsets();
  const [settingOpen, setSettingOpen] = useState(false);
  const [exitTimer, setExitTimer] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reportType, setReportType] = useState('daily');
  const [showVoiceAssistant, setShowVoiceAssistant] = useState(false);

  if (!user) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>请重新登录</Text>
      </View>
    );
  }

  const globalOrderRecord = state.globalOrderRecord || [];
  const todayStr = getTodayStr();
  const todayOrders = globalOrderRecord.filter(item => item.time && formatDate(item.time) === todayStr);
  let meituanIncome = 0, douyinIncome = 0, dianpingIncome = 0;
  todayOrders.forEach(order => {
    if (order && order.platform) {
      switch(order.platform) {
        case '美团': meituanIncome += order.couponPrice || 0; break;
        case '抖音': douyinIncome += order.couponPrice || 0; break;
        case '大众点评': dianpingIncome += order.couponPrice || 0; break;
      }
    }
  });
  const totalIncome = meituanIncome + douyinIncome + dianpingIncome;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const report = calcDailyReport(state);
      if (report) dispatch({ type: 'SET_LATEST_DAILY_REPORT', payload: report });
    } catch (error) {}
    setRefreshing(false);
  }, [state]);

  const exportData = async () => {
    try {
      const businessHistory = state.businessHistory || [];
      const csv = "日期,订单数,总营收,净利润,利润率\n" + businessHistory.map(r => `${r.date},${r.totalOrder},${r.income},${r.profit},${r.profitRate}%`).join('\n');
      const uri = FileSystem.documentDirectory + 'business_report.csv';
      await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
      else showToast('分享不可用');
    } catch (e) { showToast('导出失败'); }
  };

  const isEmployee = user?.role === '员工';
  const allMenuList = [
    { icon: "qr-code-outline", label: "订单核销", key: 'VerifyOrder', tab: '核销', screen: 'VerifyOrder' },
    { icon: "swap-horizontal-outline", label: "出入库", key: 'StockManage', tab: '出入库', screen: 'StockManage' },
    { icon: "people-outline", label: "员工管理", key: 'StaffManage', internal: true, screen: 'StaffManage' },
    { icon: "chatbox-outline", label: "顾客客服", key: 'CustomerService', tab: '客服', screen: 'CustomerService' },
    { icon: "people-circle-outline", label: "内部沟通", key: 'InternalChat', tab: '内部', screen: 'InternalChat' },
    { icon: "sparkles-outline", label: "AI助手", key: 'MerchantAssistant', tab: 'AI助手', screen: 'MerchantAssistant' },
    { icon: "grid-outline", label: "商品总览", key: 'ProductOverview', internal: true, screen: 'ProductOverview' },
  ];
  // 计算每个功能的消息数（按消息数从大到小排序）
  const calcMenuUnread = (key) => {
    if (!user) return 0;
    if (key === 'CustomerService') {
      // 客服消息：未读顾客消息 + 待商家处理的通知
      let count = 0;
      Object.values(state.privateChatMessages || {}).forEach(msgs => {
        msgs.forEach(m => { if (m && m.fromPhone !== user.phone && !m.read) count++; });
      });
      if (!isEmployee) {
        count += (state.bossNotifications || []).filter(n => !n.handled).length;
      }
      return count;
    }
    if (key === 'InternalChat') {
      // 内部沟通：未读的群消息
      const internalMsgs = state.groupChatMessages?.internal || [];
      return internalMsgs.filter(m => m && m.fromPhone !== user.phone && !m.read).length;
    }
    if (key === 'StaffManage' && !isEmployee) {
      // 员工管理（商家）：待审核的入职申请
      return (state.staffMemberList || []).filter(s => s.status === 'pending').length;
    }
    if (key === 'MerchantAssistant' && (state.badReviewCount || 0) > 0) {
      return state.badReviewCount;
    }
    return 0;
  };
  const menuList = allMenuList.filter(item => {
    if (isEmployee) return ['VerifyOrder', 'StockManage', 'InternalChat'].includes(item.key);
    return true;
  }).map(item => ({ ...item, unread: calcMenuUnread(item.key) }))
    .sort((a, b) => b.unread - a.unread);

  const handleMenuPress = (item) => {
    try {
      if (item.internal) {
        navigation.navigate(item.screen);
      } else {
        const parent = navigation.getParent();
        if (parent) {
          parent.navigate(item.tab);
        } else {
          navigation.navigate(item.screen);
        }
      }
    } catch (e) {
      console.warn('跳转失败', e);
      showToast('跳转失败');
    }
  };

  let chatStaffList = [];
  if (isEmployee) {
    // 员工端：只有被商家批准的员工才显示老板私聊入口
    const myApplication = (state.staffMemberList || []).find(s => s.phone === user?.phone && s.status === 'approved');
    const bossPhone = state.shopInfo?.phone || '';
    if (myApplication && bossPhone) {
      chatStaffList = [{ id: 'boss', name: '老板', phone: bossPhone }];
    }
  } else {
    chatStaffList = (state.staffMemberList || []).filter(s => s.status === 'approved' && s.phone !== user?.phone);
  }
  const pendingStaff = (state.staffMemberList || []).filter(s => s.status === 'pending');

  const goToPrivateChat = (staff) => navigation.navigate('PrivateChat', { phone: staff.phone, name: staff.name });

  const latestReport = state.latestDailyReport;
  const menuVisibility = state.menuVisibility || {};

  const handleApprove = (phone) => {
    try {
      dispatch({ type: 'APPROVE_STAFF_APPLICATION', payload: { phone } });
      const staff = state.staffMemberList.find(s => s.phone === phone);
      if (staff) {
        // 发送系统群消息
        const welcome = { id: Date.now().toString(), text: `🎉 ${staff.name} 已入职，欢迎加入！`, from: '系统', fromPhone: 'system', time: new Date().toISOString(), type: 'text' };
        dispatch({ type: 'ADD_GROUP_MESSAGE', payload: { chatId: 'internal', message: welcome } });
        // 发送私聊欢迎消息给员工
        const bossName = state.user?.name || '老板';
        const shopName = state.shopInfo?.shopName || '门店';
        const privateWelcome = {
          id: Date.now().toString(),
          text: `欢迎 ${staff.name} 加入${shopName}！我是老板${bossName}，以后工作中有任何问题随时找我沟通。`,
          from: 'staff',
          fromPhone: state.user?.phone || 'boss',
          fromName: bossName,
          toPhone: staff.phone,
          time: new Date().toISOString(),
          read: false,
          type: 'text',
        };
        dispatch({ type: 'ADD_PRIVATE_MESSAGE', payload: { phone: staff.phone, message: privateWelcome } });
        showToast(`${staff.name} 已批准入职，已发送欢迎消息`);
      }
    } catch (error) { showToast('操作失败'); }
  };
  const handleReject = (phone) => {
    try {
      dispatch({ type: 'REJECT_STAFF_APPLICATION', payload: { phone } });
      showToast('已拒绝');
    } catch (error) { showToast('操作失败'); }
  };

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (navigation.isFocused() && !navigation.canGoBack()) {
        if (exitTimer) { BackHandler.exitApp(); return true; }
        showToast('再按一次退出');
        const timer = setTimeout(() => setExitTimer(null), 2000);
        setExitTimer(timer);
        return true;
      }
      return false;
    });
    return () => backHandler.remove();
  }, [navigation, exitTimer]);

  const getReportData = () => {
    if (reportType === 'daily') return latestReport;
    if (reportType === 'weekly') return generateWeekReport(state);
    return generateMonthReport(state);
  };
  const reportData = getReportData();

  return (
    <View style={styles.container}>
      <SettingDrawer visible={settingOpen} onClose={() => setSettingOpen(false)} />
      <SafeAreaView edges={['top']} style={{ backgroundColor: BG_CARD }}>
        <View style={styles.headerBar}>
          <View style={{ width: 40 }} />
          <Text style={styles.homeTitle}>经营宝</Text>
          <TouchableOpacity onPress={() => setSettingOpen(true)}><Ionicons name="settings-outline" size={24} color={TEXT_SECOND} /></TouchableOpacity>
        </View>
      </SafeAreaView>
      <ScrollView style={{ flex: 1, paddingHorizontal: 16 }} contentContainerStyle={{ paddingBottom: 80 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[PRIMARY_COLOR]} />}>
          <View style={styles.cardBox}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: TEXT_MAIN, marginBottom: 8 }}>👋 欢迎，{user?.name || (isEmployee ? '员工' : '老板')}</Text>
            <Text style={{ color: TEXT_SECOND }}>店铺：{(state.shopInfo || {}).shopName || '未设置'}</Text>
            {isEmployee && <Text style={{ color: TEXT_SECOND, marginTop: 4 }}>角色：员工</Text>}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
            <View style={{ width: (width - 44) / 2, backgroundColor: BG_CARD, padding: 16, borderRadius: 14, ...SHADOW }}>
              <Text style={{ fontSize: 13, color: TEXT_SECOND }}>今日核销订单</Text>
              <Text style={{ fontSize: 22, fontWeight: '700', marginTop: 8, color: TEXT_MAIN }}>{todayOrders.length}</Text>
            </View>
            {!isEmployee && (
              <>
                <View style={{ width: (width - 44) / 2, backgroundColor: BG_CARD, padding: 16, borderRadius: 14, ...SHADOW }}>
                  <Text style={{ fontSize: 13, color: TEXT_SECOND }}>今日总营收</Text>
                  <Text style={{ fontSize: 22, fontWeight: '700', marginTop: 8, color: PRIMARY_COLOR }}>¥{totalIncome}</Text>
                </View>
                <TouchableOpacity style={{ width: (width - 44) / 2, backgroundColor: BG_CARD, padding: 16, borderRadius: 14, ...SHADOW }} onPress={() => navigation.navigate('BadReviewList')}>
                  <Text style={{ fontSize: 13, color: TEXT_SECOND }}>差评预警</Text>
                  <Text style={{ fontSize: 22, fontWeight: '700', marginTop: 8, color: (state.badReviewCount || 0) > 0 ? DANGER_COLOR : TEXT_MAIN }}>
                    {state.badReviewCount || 0}
                    {(state.badReviewCount || 0) > 0 && <Text style={{ fontSize: 14, color: PRIMARY_COLOR, marginLeft: 8 }}>点击查看 →</Text>}
                  </Text>
                </TouchableOpacity>
                <View style={{ width: (width - 44) / 2, backgroundColor: BG_CARD, padding: 16, borderRadius: 14, ...SHADOW }}>
                  <Text style={{ fontSize: 13, color: TEXT_SECOND }}>总商品数</Text>
                  <Text style={{ fontSize: 22, fontWeight: '700', marginTop: 8, color: TEXT_MAIN }}>{(state.goodsList || []).length}</Text>
                </View>
              </>
            )}
          </View>

          {!isEmployee && (
            <View style={styles.dailyReportCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.reportTitle}>📊 经营报告</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {['daily', 'weekly', 'monthly'].map(type => {
                    const label = type === 'daily' ? '日报' : type === 'weekly' ? '周报' : '月报';
                    return (
                      <TouchableOpacity key={type} style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16, backgroundColor: reportType === type ? PRIMARY_COLOR : LIGHT_PRIMARY }} onPress={() => setReportType(type)}>
                        <Text style={{ color: reportType === type ? '#fff' : TEXT_MAIN, fontSize: 12 }}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              {reportData ? (
                <>
                  {reportType === 'daily' && (
                    <>
                      <View style={styles.reportRow}><Text style={styles.reportLabel}>日期</Text><Text style={styles.reportValue}>{reportData.date}</Text></View>
                      <View style={styles.reportRow}><Text style={styles.reportLabel}>订单数</Text><Text style={styles.reportValue}>{reportData.totalOrder}单</Text></View>
                      <View style={styles.reportRow}><Text style={styles.reportLabel}>总营收</Text><Text style={styles.reportValue}>¥{reportData.income}</Text></View>
                      <View style={styles.reportRow}><Text style={styles.reportLabel}>净利润</Text><Text style={styles.reportValue}>¥{reportData.profit}</Text></View>
                      <View style={styles.reportRow}><Text style={styles.reportLabel}>利润率</Text><Text style={styles.reportValue}>{reportData.profitRate}%</Text></View>
                    </>
                  )}
                  {reportType === 'weekly' && (
                    <>
                      <View style={styles.reportRow}><Text style={styles.reportLabel}>周期</Text><Text style={styles.reportValue}>{reportData.startDate} ~ {reportData.endDate}</Text></View>
                      <View style={styles.reportRow}><Text style={styles.reportLabel}>总订单</Text><Text style={styles.reportValue}>{reportData.totalOrder}单</Text></View>
                      <View style={styles.reportRow}><Text style={styles.reportLabel}>总营收</Text><Text style={styles.reportValue}>¥{reportData.totalIncome}</Text></View>
                      <View style={styles.reportRow}><Text style={styles.reportLabel}>总利润</Text><Text style={styles.reportValue}>¥{reportData.totalProfit}</Text></View>
                      <View style={styles.reportRow}><Text style={styles.reportLabel}>日均营收</Text><Text style={styles.reportValue}>¥{reportData.avgDailyIncome}</Text></View>
                    </>
                  )}
                  {reportType === 'monthly' && (
                    <>
                      <View style={styles.reportRow}><Text style={styles.reportLabel}>月份</Text><Text style={styles.reportValue}>{reportData.yearMonth}</Text></View>
                      <View style={styles.reportRow}><Text style={styles.reportLabel}>有效天数</Text><Text style={styles.reportValue}>{reportData.dayCount}天</Text></View>
                      <View style={styles.reportRow}><Text style={styles.reportLabel}>总订单</Text><Text style={styles.reportValue}>{reportData.totalOrder}单</Text></View>
                      <View style={styles.reportRow}><Text style={styles.reportLabel}>总营收</Text><Text style={styles.reportValue}>¥{reportData.totalIncome}</Text></View>
                      <View style={styles.reportRow}><Text style={styles.reportLabel}>总利润</Text><Text style={styles.reportValue}>¥{reportData.totalProfit}</Text></View>
                    </>
                  )}
                </>
              ) : (
                <Text style={{ color: TEXT_THIRD, fontSize: 14, textAlign: 'center', paddingVertical: 8 }}>
                  {reportType === 'daily' ? '暂无日报数据，请先核销订单' : '暂无该周期数据'}
                </Text>
              )}
              <TouchableOpacity style={styles.exportBtn} onPress={exportData}><Text style={styles.exportBtnText}>📤 导出CSV</Text></TouchableOpacity>
            </View>
          )}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 16 }}>
            <View style={{ flexDirection: 'row', gap: 12, paddingRight: 16 }}>
              {menuList.map((item, idx) => (
                <TouchableOpacity key={item.key} onPress={() => handleMenuPress(item)} style={styles.menuItem}>
                  <View style={{ position: 'relative' }}>
                    <Ionicons name={item.icon} size={28} color={PRIMARY_COLOR} />
                    {item.unread > 0 && (
                      <View style={{ position: 'absolute', top: -6, right: -10, backgroundColor: DANGER_COLOR, borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 }}>
                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>{item.unread > 99 ? '99+' : item.unread}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontSize: 13, marginTop: 6, color: TEXT_MAIN, fontWeight: item.unread > 0 ? '600' : '400' }}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {chatStaffList.length > 0 && (
            <View style={{ marginTop: 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: TEXT_MAIN }}>💬 {isEmployee ? '联系老板' : '员工私聊'}</Text>
                <Text style={{ fontSize: 12, color: TEXT_THIRD }}>{chatStaffList.length}人</Text>
              </View>
              <View style={{ backgroundColor: BG_CARD, borderRadius: 16, padding: 8, ...SHADOW }}>
                {chatStaffList.map(staff => (
                  <TouchableOpacity
                    key={staff.id}
                    style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12 }}
                    onPress={() => goToPrivateChat(staff)}
                  >
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: LIGHT_PRIMARY, justifyContent: 'center', alignItems: 'center' }}>
                      <Ionicons name="person-outline" size={24} color={PRIMARY_COLOR} />
                    </View>
                    <View style={{ marginLeft: 14, flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '500', color: TEXT_MAIN }}>{staff.name}</Text>
                      <Text style={{ fontSize: 13, color: TEXT_THIRD, marginTop: 2 }}>{staff.phone}</Text>
                    </View>
                    <View style={{ padding: 8, backgroundColor: LIGHT_PRIMARY, borderRadius: 20 }}>
                      <Ionicons name="message-circle-outline" size={20} color={PRIMARY_COLOR} />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {!isEmployee && pendingStaff.length > 0 && (
            <View style={{ marginTop: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: TEXT_MAIN, marginBottom: 8 }}>📩 入职申请</Text>
              {pendingStaff.map(staff => (
                <View key={staff.id} style={styles.listItem}>
                  <Text style={{ fontSize: 16, color: TEXT_MAIN }}>{staff.name} ({staff.phone})</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                    <TouchableOpacity style={[styles.miniBlueBtn, { backgroundColor: SUCCESS_COLOR }]} onPress={() => handleApprove(staff.phone)}><Text style={styles.sendTxt}>同意</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.miniBlueBtn, { backgroundColor: DANGER_COLOR }]} onPress={() => handleReject(staff.phone)}><Text style={styles.sendTxt}>拒绝</Text></TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

      {!isEmployee && (
        <DraggableFloatingButton onPress={() => setShowVoiceAssistant(true)} />
      )}

      <HomeVoiceAssistant visible={showVoiceAssistant} onClose={() => setShowVoiceAssistant(false)} />
    </View>
  );
};

const DraggableFloatingButton = ({ onPress }) => {
  const [position, setPosition] = useState({ x: width - 76, y: height - 220 });
  const positionRef = useRef({ x: width - 76, y: height - 220 });
  const dragRef = useRef({ isDragging: false, startX: 0, startY: 0, startTouchX: 0, startTouchY: 0, hasMoved: false });
  const lastTapRef = useRef(0);
  const [pressIn, setPressIn] = useState(false);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  const onTouchStart = (e) => {
    const touch = e.nativeEvent.touches[0];
    dragRef.current.startX = positionRef.current.x;
    dragRef.current.startY = positionRef.current.y;
    dragRef.current.startTouchX = touch.pageX;
    dragRef.current.startTouchY = touch.pageY;
    dragRef.current.isDragging = true;
    dragRef.current.hasMoved = false;
    setPressIn(true);
  };

  const onTouchMove = (e) => {
    if (!dragRef.current.isDragging) return;
    const touch = e.nativeEvent.touches[0];
    const dx = touch.pageX - dragRef.current.startTouchX;
    const dy = touch.pageY - dragRef.current.startTouchY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      dragRef.current.hasMoved = true;
    }
    if (dragRef.current.hasMoved) {
      let newX = dragRef.current.startX + dx;
      let newY = dragRef.current.startY + dy;
      newX = Math.max(0, Math.min(width - 60, newX));
      newY = Math.max(0, Math.min(height - 120, newY));
      setPosition({ x: newX, y: newY });
    }
  };

  const onTouchEnd = () => {
    const wasDragging = dragRef.current.hasMoved;
    dragRef.current.isDragging = false;
    dragRef.current.hasMoved = false;
    setPressIn(false);
    if (!wasDragging) {
      const now = Date.now();
      if (now - lastTapRef.current < 300) return;
      lastTapRef.current = now;
      onPress();
    }
  };

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}>
      <View
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => true}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          position: 'absolute',
          left: position.x,
          top: position.y,
          width: 60,
          height: 60,
          borderRadius: 30,
          shadowColor: '#5B6DF0',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.4,
          shadowRadius: 10,
          elevation: 8,
          transform: [{ scale: pressIn ? 0.92 : 1 }],
        }}
      >
        <View style={{
          width: 60, height: 60, borderRadius: 30,
          backgroundColor: '#5B6DF0',
          justifyContent: 'center', alignItems: 'center',
          borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)',
          overflow: 'hidden',
        }}>
          <View style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: '#7B8DF0',
            opacity: 0.5,
            borderRadius: 30,
            transform: [{ translateX: -10 }, { translateY: -10 }, { rotate: '45deg' }],
            width: 30, height: 60,
          }} />
          <Ionicons name="mic" size={26} color="#fff" />
          <View style={{ position: 'absolute', bottom: 6, right: 6, backgroundColor: '#FFD93D', borderRadius: 8, paddingHorizontal: 4, paddingVertical: 1, borderWidth: 1, borderColor: '#fff' }}>
            <Text style={{ color: '#5B6DF0', fontSize: 8, fontWeight: 'bold' }}>AI</Text>
          </View>
        </View>
        <View style={{
          position: 'absolute', top: -4, right: -4,
          width: 16, height: 16, borderRadius: 8,
          backgroundColor: '#FF4757', borderWidth: 2, borderColor: '#fff',
        }} />
      </View>
    </View>
  );
};
// ===== 第二段结束 =====// ================== 订单核销 ==================
const VerifyOrder = () => {
  const navigation = useNavigation();
  const { state, dispatch } = useApp();
  const [orderCode, setOrderCode] = useState('');
  const [platform, setPlatform] = useState('美团');
  const [couponPrice, setCouponPrice] = useState('');
  const [scanning, setScanning] = useState(false);
  const [selectedGoodsId, setSelectedGoodsId] = useState(null);

  const requestCameraPermission = async () => {
    try {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      return status === 'granted';
    } catch (e) {
      return false;
    }
  };

  const handleVerify = () => {
    try {
      if (!orderCode.trim()) { showToast('请输入核销码'); return; }
      const price = parseFloat(couponPrice);
      if (isNaN(price) || price <= 0) { showToast('请输入有效金额'); return; }
      if (selectedGoodsId) {
        const goods = (state.goodsList || []).find(g => g.id === selectedGoodsId);
        if (goods && goods.stock < 1) {
          Alert.alert('库存不足', `${goods.name} 库存不足`);
          return;
        }
        if (goods) {
          const updated = (state.goodsList || []).map(g =>
            g.id === selectedGoodsId ? { ...g, stock: g.stock - 1 } : g
          );
          dispatch({ type: 'SET_GOODS_LIST', payload: updated });
          showToast(`已扣减 ${goods.name} 库存 1 件`);
        }
      }
      const record = {
        id: Date.now().toString(),
        code: orderCode.trim(),
        platform,
        couponPrice: price,
        time: new Date().toISOString(),
        goodsId: selectedGoodsId,
        staff: state.user?.name || '未知',
      };
      dispatch({ type: 'ADD_ORDER_RECORD', payload: record });
      showToast(`核销成功！${platform} ¥${price}`);
      setOrderCode('');
      setCouponPrice('');
      setSelectedGoodsId(null);
    } catch (error) {
      showToast('核销失败，请重试');
    }
  };

  const handleBarCodeScanned = async ({ data }) => {
    setScanning(false);
    setOrderCode(data);
    showToast('AI识别商品中...');
    try {
      const reply = await fetchZhipuChat(
        [{ role: 'user', content: `核销码是：${data}。请告诉我这个核销码对应的是什么商品类型（如：奶茶、咖啡、火锅套餐等），只返回商品类型名称，不要包含其他文字。` }],
        '你是一个商品识别助手。'
      );
      const productType = reply.trim();
      const matched = (state.goodsList || []).find(g =>
        g.name.includes(productType) || productType.includes(g.name)
      );
      if (matched) {
        setSelectedGoodsId(matched.id);
        showToast(`识别到商品：${matched.name}`);
      } else {
        showToast(`未匹配到库存商品，可手动选择`);
      }
    } catch (e) {
      console.error('AI识别失败:', e);
    }
  };

  if (scanning) {
    return (
      <View style={styles.scannerContainer}>
        <BarCodeScanner onBarCodeScanned={handleBarCodeScanned} style={StyleSheet.absoluteFillObject} />
        <TouchableOpacity style={styles.cancelBtn} onPress={() => setScanning(false)}><Text style={styles.cancelText}>取消</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: BG_CARD }}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => navigation.goBack()}><Text style={{ fontSize: 20 }}>&lt;</Text></TouchableOpacity>
          <Text style={styles.pageTitle}>订单核销</Text>
          <View style={{ width: 24 }} />
        </View>
      </SafeAreaView>
      <ScrollView style={{ padding: 16 }}>
        <View style={styles.cardBox}>
          <Text style={styles.label}>核销码</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TextInput style={[styles.formInput, { flex: 1 }]} placeholder="输入核销码或扫码" value={orderCode} onChangeText={setOrderCode} />
            <TouchableOpacity style={styles.miniBlueBtn} onPress={async () => {
              const ok = await requestCameraPermission();
              if (ok) setScanning(true);
              else showToast('需要相机权限');
            }}>
              <Text style={styles.sendTxt}>扫码</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.label}>平台</Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
            {['美团', '抖音', '大众点评'].map(p => (
              <TouchableOpacity key={p} style={[styles.tagNormal, platform === p && styles.tagActive]} onPress={() => setPlatform(p)}>
                <Text style={{ color: platform === p ? '#fff' : TEXT_MAIN }}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.label}>金额 (¥)</Text>
          <TextInput style={styles.formInput} placeholder="0.00" keyboardType="decimal-pad" value={couponPrice} onChangeText={setCouponPrice} />
          <Text style={styles.label}>选择商品（可选，用于库存联动）</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            {(state.goodsList || []).map(g => (
              <TouchableOpacity key={g.id} style={[styles.tagNormal, selectedGoodsId === g.id && styles.tagActive]} onPress={() => setSelectedGoodsId(g.id)}>
                <Text style={{ color: selectedGoodsId === g.id ? '#fff' : TEXT_MAIN }}>{g.name} ({g.stock})</Text>
              </TouchableOpacity>
            ))}
            {(state.goodsList || []).length === 0 && <Text style={{ color: TEXT_THIRD }}>暂无商品，请先添加</Text>}
          </View>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleVerify}>
            <Text style={styles.sendTxt}>确认核销</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.cardBox}>
          <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>今日已核销</Text>
          {(state.globalOrderRecord || [])
            .filter(item => item.time && formatDate(item.time) === getTodayStr())
            .map((item, idx) => (
              <View key={idx} style={styles.listItem}>
                <Text style={{ fontSize: 14, color: TEXT_MAIN }}>{item.platform} - ¥{item.couponPrice}</Text>
                <Text style={{ fontSize: 12, color: TEXT_THIRD }}>{formatTime(item.time)} {item.staff && `核销员: ${item.staff}`}</Text>
              </View>
            ))
          }
          {(state.globalOrderRecord || []).filter(item => item.time && formatDate(item.time) === getTodayStr()).length === 0 && (
            <Text style={{ color: TEXT_THIRD, textAlign: 'center', padding: 12 }}>今日暂无核销记录</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

// ================== 私聊页面 ==================
const PrivateChat = ({ route, navigation }) => {
  const { phone, name } = route.params || {};
  const { state, dispatch } = useApp();
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState([]);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const scrollViewRef = useRef(null);
  const [showMediaOptions, setShowMediaOptions] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);

  useEffect(() => {
    const savedMessages = state.privateChatMessages[phone] || [];
    setMessages(savedMessages);
  }, [phone]);

  const sendMessage = async (type = 'text') => {
    try {
      let text = inputText.trim();
      let images = [];
      if (type === 'image') {
        if (selectedImages.length === 0) { showToast('请先选择图片'); return; }
        for (let uri of selectedImages) {
          const compressed = await compressImage(uri);
          const base64 = await FileSystem.readAsStringAsync(compressed, { encoding: FileSystem.EncodingType.Base64 });
          images.push(`data:image/jpeg;base64,${base64}`);
        }
        const msg = {
          id: Date.now().toString(),
          text: text || '图片消息',
          image: images[0],
          from: 'staff',
          platform: 'private',
          time: new Date().toISOString(),
        };
        setMessages(prev => [...prev, msg]);
        dispatch({ type: 'ADD_PRIVATE_MESSAGE', payload: { phone, message: msg } });
        setSelectedImages([]);
        setInputText('');
        setShowMediaOptions(false);
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
        return;
      }
      if (!text) return;
      const msg = {
        id: Date.now().toString(),
        text,
        image: null,
        from: 'staff',
        platform: 'private',
        time: new Date().toISOString(),
      };
      setMessages(prev => [...prev, msg]);
      dispatch({ type: 'ADD_PRIVATE_MESSAGE', payload: { phone, message: msg } });
      setInputText('');
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (error) {
      showToast('发送失败');
    }
  };

  const confirmVoice = () => {
    if (voiceText.trim()) {
      setInputText(voiceText.trim());
      setShowVoiceModal(false);
      setVoiceText('');
    } else {
      showToast('请输入内容');
    }
  };

  const pickImages = async (source) => {
    try {
      setShowMediaOptions(false);
      let result;
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') { showToast('需要相机权限'); return; }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          quality: 0.7,
        });
        if (!result.canceled) {
          setSelectedImages([...selectedImages, result.assets[0].uri]);
          showToast('已选1张图片');
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { showToast('需要相册权限'); return; }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          quality: 0.7,
          selectionLimit: 10,
        });
        if (!result.canceled) {
          const uris = result.assets.map(a => a.uri);
          setSelectedImages([...selectedImages, ...uris]);
          showToast(`已选${uris.length}张图片`);
        }
      }
    } catch (error) { showToast('选择图片失败'); }
  };

  const removeImage = (index) => {
    const newList = [...selectedImages];
    newList.splice(index, 1);
    setSelectedImages(newList);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: BG_CARD }}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => navigation.goBack()}><Text style={{ fontSize: 20 }}>&lt;</Text></TouchableOpacity>
          <Text style={styles.pageTitle}>{name || '私聊'}</Text>
          <View style={{ width: 24 }} />
        </View>
      </SafeAreaView>
      {selectedImages.length > 0 && (
        <View style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: BORDER_COLOR }}>
          <ScrollView horizontal>
            {selectedImages.map((uri, idx) => (
              <View key={idx} style={{ marginRight: 8, position: 'relative' }}>
                <Image source={{ uri }} style={{ width: 80, height: 80, borderRadius: 8 }} />
                <TouchableOpacity
                  style={{ position: 'absolute', top: -4, right: -4, backgroundColor: DANGER_COLOR, borderRadius: 12, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => removeImage(idx)}
                >
                  <Text style={{ color: '#fff', fontSize: 12 }}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
      <ScrollView
        ref={scrollViewRef}
        style={styles.chatScroll}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 80 }}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map(msg => (
          <View key={msg.id} style={msg.from === 'staff' ? styles.bubbleRight : styles.bubbleLeft}>
            {msg.image ? (
              <Image source={{ uri: msg.image }} style={styles.imageMessage} />
            ) : (
              <Text style={{ fontSize: 15, color: TEXT_MAIN }}>{msg.text}</Text>
            )}
            <Text style={{ fontSize: 10, color: TEXT_THIRD, marginTop: 4 }}>{formatTime(msg.time)}</Text>
          </View>
        ))}
        {messages.length === 0 && (
          <Text style={{ textAlign: 'center', color: TEXT_THIRD, marginTop: 30 }}>开始与 {name || '对方'} 对话</Text>
        )}
      </ScrollView>
      {showMediaOptions && (
        <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff', borderTopWidth: 1, borderColor: BORDER_COLOR }}>
          <TouchableOpacity style={{ flex: 1, alignItems: 'center', padding: 8 }} onPress={() => pickImages('camera')}>
            <Ionicons name="camera-outline" size={24} color={PRIMARY_COLOR} />
            <Text style={{ fontSize: 12, color: TEXT_SECOND }}>拍照</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 1, alignItems: 'center', padding: 8 }} onPress={() => pickImages('library')}>
            <Ionicons name="images-outline" size={24} color={PRIMARY_COLOR} />
            <Text style={{ fontSize: 12, color: TEXT_SECOND }}>相册</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 1, alignItems: 'center', padding: 8 }} onPress={() => { setShowVoiceModal(true); setVoiceText(''); }}>
            <Ionicons name="mic-outline" size={24} color={PRIMARY_COLOR} />
            <Text style={{ fontSize: 12, color: TEXT_SECOND }}>语音</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 1, alignItems: 'center', padding: 8 }} onPress={() => setShowMediaOptions(false)}>
            <Ionicons name="close-outline" size={24} color={DANGER_COLOR} />
            <Text style={{ fontSize: 12, color: DANGER_COLOR }}>取消</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.inputBar}>
        <TouchableOpacity onPress={() => setShowMediaOptions(true)} style={{ paddingHorizontal: 8 }}><Ionicons name="add-circle-outline" size={24} color={PRIMARY_COLOR} /></TouchableOpacity>
        <TextInput
          style={styles.inputBox}
          placeholder="输入消息..."
          value={inputText}
          onChangeText={setInputText}
          multiline
        />
        <TouchableOpacity style={styles.sendBtn} onPress={() => sendMessage('text')}><Text style={styles.sendTxt}>发送</Text></TouchableOpacity>
        {selectedImages.length > 0 && (
          <TouchableOpacity style={[styles.sendBtn, { backgroundColor: SUCCESS_COLOR, marginLeft: 4 }]} onPress={() => sendMessage('image')}><Text style={styles.sendTxt}>📷 发送</Text></TouchableOpacity>
        )}
      </View>
      <View style={{ height: 56 }} />
      <Modal visible={showVoiceModal} transparent animationType="fade">
        <View style={styles.modalMask}>
          <View style={styles.voiceModal}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>🎤 语音输入</Text>
            <Text style={{ fontSize: 14, color: TEXT_SECOND, marginBottom: 12 }}>输入要发送的消息</Text>
            <TextInput
              style={styles.voiceTextInput}
              multiline
              placeholder="输入消息..."
              value={voiceText}
              onChangeText={setVoiceText}
              autoFocus
            />
            <View style={{ flexDirection: 'row', marginTop: 16 }}>
              <TouchableOpacity style={{ flex: 1, padding: 12, backgroundColor: '#eee', borderRadius: 8, marginRight: 8 }} onPress={() => { setShowVoiceModal(false); setVoiceText(''); }}>
                <Text style={{ textAlign: 'center', color: TEXT_SECOND }}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, padding: 12, backgroundColor: PRIMARY_COLOR, borderRadius: 8 }} onPress={confirmVoice}>
                <Text style={{ textAlign: 'center', color: '#fff' }}>发送</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ================== 员工管理页面 ==================
const StaffManage = () => {
  const navigation = useNavigation();
  const { state, dispatch } = useApp();
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [position, setPosition] = useState('店员');
  const [showDetail, setShowDetail] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);

  const staffMemberList = state.staffMemberList || [];
  const pendingList = staffMemberList.filter(s => s.status === 'pending');
  const approvedList = staffMemberList.filter(s => s.status === 'approved');

  const handleAddStaff = () => {
    if (!name.trim()) { showToast('请输入员工姓名'); return; }
    if (phone.length !== 11) { showToast('请输入11位手机号'); return; }
    dispatch({ type: 'ADD_STAFF_MEMBER', payload: { name: name.trim(), phone, position } });
    showToast(`员工 ${name} 已添加`);
    setModalVisible(false);
    setName('');
    setPhone('');
    setPosition('店员');
  };

  const handleApprove = (staff) => {
    dispatch({ type: 'APPROVE_STAFF_APPLICATION', payload: { phone: staff.phone } });
    const welcome = { id: Date.now().toString(), text: `🎉 ${staff.name} 已入职，欢迎加入！`, from: '系统', fromPhone: 'system', time: new Date().toISOString(), type: 'text' };
    dispatch({ type: 'ADD_GROUP_MESSAGE', payload: { chatId: 'internal', message: welcome } });
    showToast(`${staff.name} 已批准入职`);
  };

  const handleReject = (staff) => {
    dispatch({ type: 'REJECT_STAFF_APPLICATION', payload: staff.phone });
    showToast('已拒绝申请');
  };

  const handleRemove = (staff) => {
    Alert.alert('确认删除', `确定要删除员工 ${staff.name} 吗？`, [
      { text: '取消' },
      { text: '删除', style: 'destructive', onPress: () => {
        dispatch({ type: 'REMOVE_STAFF_MEMBER', payload: staff.phone });
        showToast('已删除员工');
        setShowDetail(false);
      }}
    ]);
  };

  const handleSuspend = (staff) => {
    dispatch({ type: 'UPDATE_STAFF_STATUS', payload: { phone: staff.phone, status: 'suspended' } });
    showToast('已暂停该员工权限');
    setShowDetail(false);
  };

  const handleResume = (staff) => {
    dispatch({ type: 'UPDATE_STAFF_STATUS', payload: { phone: staff.phone, status: 'approved' } });
    showToast('已恢复该员工权限');
  };

  const goToChat = (staff) => {
    navigation.navigate('PrivateChat', { phone: staff.phone, name: staff.name });
    setShowDetail(false);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: BG_CARD }}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => navigation.goBack()}><Text style={{ fontSize: 20 }}>&lt;</Text></TouchableOpacity>
          <Text style={styles.pageTitle}>员工管理</Text>
          <TouchableOpacity onPress={() => { setModalVisible(true); }}>
            <Ionicons name="add-outline" size={24} color={PRIMARY_COLOR} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
      <ScrollView style={{ padding: 16 }}>
        {pendingList.length > 0 && (
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: TEXT_MAIN, marginBottom: 10 }}>📩 入职申请 ({pendingList.length})</Text>
            {pendingList.map(staff => (
              <View key={staff.phone} style={styles.listItem}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, color: TEXT_MAIN }}>{staff.name}</Text>
                  <Text style={{ fontSize: 12, color: TEXT_THIRD }}>{staff.phone} | {staff.position || '店员'}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity style={[styles.miniBlueBtn, { backgroundColor: SUCCESS_COLOR }]} onPress={() => handleApprove(staff)}><Text style={styles.sendTxt}>同意</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.miniBlueBtn, { backgroundColor: DANGER_COLOR }]} onPress={() => handleReject(staff)}><Text style={styles.sendTxt}>拒绝</Text></TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: TEXT_MAIN, marginBottom: 10 }}>👥 在职员工 ({approvedList.length})</Text>
          {approvedList.map(staff => (
            <TouchableOpacity key={staff.phone} style={styles.listItem} onPress={() => { setSelectedStaff(staff); setShowDetail(true); }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: LIGHT_PRIMARY, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                <Ionicons name="person-outline" size={22} color={PRIMARY_COLOR} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, color: TEXT_MAIN }}>{staff.name}</Text>
                <Text style={{ fontSize: 12, color: TEXT_THIRD }}>{staff.phone} | {staff.position || '店员'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={TEXT_THIRD} />
            </TouchableOpacity>
          ))}
          {approvedList.length === 0 && <Text style={{ color: TEXT_THIRD, textAlign: 'center', padding: 20 }}>暂无在职员工，点击右上角添加</Text>}
        </View>
      </ScrollView>
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalMask}>
          <View style={styles.modalWrap}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>添加员工</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}><Text style={styles.closeTxt}>✕</Text></TouchableOpacity>
            </View>
            <Text style={styles.label}>员工姓名</Text>
            <TextInput style={styles.formInput} placeholder="输入姓名" value={name} onChangeText={setName} />
            <Text style={styles.label}>手机号</Text>
            <TextInput style={styles.formInput} placeholder="输入手机号" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
            <Text style={styles.label}>职位</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
              {['店员', '店长', '收银员', '厨师'].map(p => (
                <TouchableOpacity key={p} style={[styles.tagNormal, position === p && styles.tagActive]} onPress={() => setPosition(p)}>
                  <Text style={{ color: position === p ? '#fff' : TEXT_MAIN }}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleAddStaff}><Text style={styles.sendTxt}>添加</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal visible={showDetail} transparent animationType="fade">
        <View style={styles.modalMask}>
          <View style={styles.modalWrap}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>员工详情</Text>
              <TouchableOpacity onPress={() => setShowDetail(false)}><Text style={styles.closeTxt}>✕</Text></TouchableOpacity>
            </View>
            {selectedStaff && (
              <>
                <View style={{ alignItems: 'center', marginVertical: 16 }}>
                  <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: LIGHT_PRIMARY, justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="person-outline" size={40} color={PRIMARY_COLOR} />
                  </View>
                  <Text style={{ fontSize: 20, fontWeight: '600', color: TEXT_MAIN, marginTop: 12 }}>{selectedStaff.name}</Text>
                  <Text style={{ fontSize: 14, color: TEXT_SECOND }}>{selectedStaff.position || '店员'}</Text>
                </View>
                <View style={styles.settingGroup}>
                  <TouchableOpacity style={styles.settingItem} onPress={() => goToChat(selectedStaff)}>
                    <Ionicons name="chatbox-outline" size={22} color={PRIMARY_COLOR} />
                    <Text style={{ flex: 1, color: TEXT_MAIN }}>发消息</Text>
                    <Ionicons name="chevron-forward" size={20} color={TEXT_THIRD} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.settingItem} onPress={() => { showToast('拨打电话功能开发中'); }}>
                    <Ionicons name="call-outline" size={22} color={PRIMARY_COLOR} />
                    <Text style={{ flex: 1, color: TEXT_MAIN }}>拨打电话</Text>
                    <Ionicons name="chevron-forward" size={20} color={TEXT_THIRD} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.settingItem} onPress={() => handleSuspend(selectedStaff)}>
                    <Ionicons name="pause-outline" size={22} color="#FF8C00" />
                    <Text style={{ flex: 1, color: '#FF8C00' }}>暂停权限</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.settingItem, styles.settingItemLast]} onPress={() => handleRemove(selectedStaff)}>
                    <Ionicons name="trash-outline" size={22} color={DANGER_COLOR} />
                    <Text style={{ flex: 1, color: DANGER_COLOR }}>删除员工</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ================== 占位页面 ==================
const PlaceholderPage = ({ title }) => {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BG_PAGE }}>
      <Text style={{ fontSize: 20, color: TEXT_THIRD }}>📌 {title}</Text>
      <Text style={{ fontSize: 14, color: TEXT_THIRD, marginTop: 8 }}>功能开发中，敬请期待</Text>
    </View>
  );
};

// ================== 底部标签导航 ==================
const Tab = createBottomTabNavigator();
function RootTabs() {
  const { state } = useApp();
  const isEmployee = state.user?.role === '员工';

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === '首页') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === '核销') iconName = focused ? 'qr-code' : 'qr-code-outline';
          else if (route.name === '客服') iconName = focused ? 'chatbox' : 'chatbox-outline';
          else if (route.name === '出入库') iconName = focused ? 'swap-horizontal' : 'swap-horizontal-outline';
          else if (route.name === '内部') iconName = focused ? 'people' : 'people-outline';
          else if (route.name === 'AI助手') iconName = focused ? 'sparkles' : 'sparkles-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: PRIMARY_COLOR,
        tabBarInactiveTintColor: TEXT_THIRD,
        headerShown: false,
        tabBarStyle: { height: Platform.OS === 'ios' ? 80 : 60, paddingBottom: Platform.OS === 'ios' ? 20 : 8 },
      })}
    >
      <Tab.Screen name="首页" component={HomePage} />
      <Tab.Screen name="核销" component={VerifyOrder} />
      {!isEmployee && <Tab.Screen name="客服" component={CustomerService} />}
      <Tab.Screen name="出入库" component={StockManage} />
      <Tab.Screen name="内部" component={InternalChat} />
      {!isEmployee && <Tab.Screen name="AI助手" component={MerchantAssistant} />}
    </Tab.Navigator>
  );
}

// ================== 主栈导航 ==================
const Stack = createNativeStackNavigator();
function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}

function AppStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 300,
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="RootTabs" component={RootTabs} />
      <Stack.Screen name="SwitchAccount" component={SwitchAccountScreen} />
      <Stack.Screen name="BadReviewList" component={BadReviewListPage} />
      <Stack.Screen name="ProductOverview" component={ProductOverview} />
      <Stack.Screen name="StaffManage" component={StaffManage} />
      <Stack.Screen name="PrivateChat" component={PrivateChat} />
      <Stack.Screen name="ChatSetting" component={ChatSettingScreen} />
      <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} />
    </Stack.Navigator>
  );
}

// ================== App 容器 ==================
export default function App() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const appData = await loadAllData();
        if (appData) {
          dispatch({ type: 'RESTORE_ALL_DATA', payload: appData });
        }
        const userStr = await AsyncStorage.getItem('user');
        const shopStr = await AsyncStorage.getItem('shopInfo');
        if (userStr && shopStr) {
          try {
            const user = JSON.parse(userStr);
            const shopInfo = JSON.parse(shopStr);
            if (user && shopInfo && user.phone && shopInfo.shopName) {
              dispatch({ type: 'LOGIN', payload: { user, shopInfo } });
            }
          } catch (parseError) {
            console.warn('数据解析失败', parseError);
            await AsyncStorage.removeItem('user');
            await AsyncStorage.removeItem('shopInfo');
          }
        }
      } catch (error) {
        console.warn('加载失败', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (!loading) {
      saveAllData(state);
    }
  }, [state, loading]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AppContext.Provider value={{ state, dispatch }}>
        <NavigationContainer ref={navigationRef}>
          {state.user ? <AppStack /> : <AuthStack />}
        </NavigationContainer>
        <CustomToast />
      </AppContext.Provider>
    </SafeAreaProvider>
  );
}
// ===== 第三段结束 =====