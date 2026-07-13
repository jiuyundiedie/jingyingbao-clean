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
const showToast = (msg) => {
  if (Platform.OS === 'android') {
    ToastAndroid.show(msg, ToastAndroid.SHORT);
  } else {
    Alert.alert('提示', msg);
  }
};

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
const SettingDrawer = ({ visible, onClose }) => {
  const navigation = useNavigation();
  const { state, dispatch } = useApp();
  const user = state.user;
  const shopInfo = state.shopInfo || { shopName: '', phone: '' };
  const isEmployee = user?.role === '员工';
  const [shopName, setShopName] = useState(shopInfo.shopName || '');
  const [phone, setPhone] = useState(shopInfo.phone || '');
  const pushConfig = state.pushConfig || { workHour: "9", workMinute: "0", offHour: "21", offMinute: "0" };
  const [workH, setWorkH] = useState(pushConfig.workHour);
  const [workM, setWorkM] = useState(pushConfig.workMinute);
  const [offH, setOffH] = useState(pushConfig.offHour);
  const [offM, setOffM] = useState(pushConfig.offMinute);
  const [showSwitchAccountModal, setShowSwitchAccountModal] = useState(false);

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
    } catch (error) {
      showToast('退出失败');
    }
  };
  const handleSwitchAccount = async () => {
    try {
      if (user) {
        dispatch({ type: 'ADD_PREVIOUS_ACCOUNT', payload: { phone: user.phone, role: user.role, shopName: shopInfo.shopName, name: user.name } });
      }
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('shopInfo');
      dispatch({ type: 'LOGOUT' });
      onClose();
    } catch (error) {
      showToast('切换失败');
    }
  };

  if (!visible) return null;
  return (
    <View style={{ position: 'absolute', zIndex: 9998, top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row' }}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }} activeOpacity={1} onPress={onClose} />
      <ScrollView style={{ width: width * 0.7, height: '100%', backgroundColor: BG_CARD }}>
        <View style={styles.safeTop} />
        <View style={[styles.headerBar, { borderBottomWidth: 0 }]}>
          <Text style={styles.pageTitle}>系统设置</Text>
          <TouchableOpacity onPress={onClose}><Text style={{ fontSize: 20, color: TEXT_SECOND }}>✕</Text></TouchableOpacity>
        </View>
        <View style={{ padding: 16 }}>
          <View style={styles.settingGroup}>
            <View style={[styles.settingItem, { borderBottomWidth: 0 }]}>
              <Ionicons name="storefront-outline" size={22} color={PRIMARY_COLOR} style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>门店名称</Text>
                {isEmployee ? (
                  <Text style={[styles.formInput, { backgroundColor: '#F5F5F5', color: TEXT_SECOND, marginTop: 4 }]}>{shopName}</Text>
                ) : (
                  <TextInput style={[styles.formInput, { marginTop: 4 }]} value={shopName} onChangeText={setShopName} placeholder="输入门店名称" editable={!isEmployee} />
                )}
              </View>
            </View>
          </View>
          <View style={styles.settingGroup}>
            <View style={[styles.settingItem, { borderBottomWidth: 0 }]}>
              <Ionicons name="call-outline" size={22} color={PRIMARY_COLOR} style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>绑定手机号</Text>
                {isEmployee ? (
                  <Text style={[styles.formInput, { backgroundColor: '#F5F5F5', color: TEXT_SECOND, marginTop: 4 }]}>{phone}</Text>
                ) : (
                  <TextInput style={[styles.formInput, { marginTop: 4 }]} value={phone} onChangeText={setPhone} placeholder="输入手机号" keyboardType="phone-pad" editable={!isEmployee} />
                )}
              </View>
            </View>
          </View>
          {!isEmployee && (
            <TouchableOpacity style={[styles.primaryBtn, { marginTop: 8, height: 40 }]} onPress={saveShop}>
              <Text style={styles.sendTxt}>保存信息</Text>
            </TouchableOpacity>
          )}
          {!isEmployee && (
            <View style={styles.settingGroup}>
              <View style={styles.settingItem}>
                <Ionicons name="time-outline" size={22} color={PRIMARY_COLOR} style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>每周早间周报推送</Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TextInput style={[styles.formInput, { flex: 1 }]} keyboardType="numeric" maxLength={2} value={workH} onChangeText={setWorkH} placeholder="小时" />
                    <TextInput style={[styles.formInput, { flex: 1 }]} keyboardType="numeric" maxLength={2} value={workM} onChangeText={setWorkM} placeholder="分钟" />
                  </View>
                </View>
              </View>
              <View style={[styles.settingItem, styles.settingItemLast]}>
                <Ionicons name="moon-outline" size={22} color={PRIMARY_COLOR} style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>每日下班/月末推送</Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TextInput style={[styles.formInput, { flex: 1 }]} keyboardType="numeric" maxLength={2} value={offH} onChangeText={setOffH} placeholder="小时" />
                    <TextInput style={[styles.formInput, { flex: 1 }]} keyboardType="numeric" maxLength={2} value={offM} onChangeText={setOffM} placeholder="分钟" />
                  </View>
                  <TouchableOpacity style={[styles.miniBlueBtn, { marginTop: 8, alignSelf: 'flex-start' }]} onPress={savePush}>
                    <Text style={styles.sendTxt}>保存时间</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
          <View style={styles.settingGroup}>
            <TouchableOpacity style={styles.settingItem} onPress={() => { setShowSwitchAccountModal(true); }}>
              <Ionicons name="person-outline" size={22} color={PRIMARY_COLOR} style={{ marginRight: 12 }} />
              <Text style={{ color: TEXT_MAIN }}>切换账号</Text>
              <Ionicons name="chevron-forward" size={18} color={TEXT_THIRD} style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.settingItem, styles.settingItemLast]} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={22} color={DANGER_COLOR} style={{ marginRight: 12 }} />
              <Text style={{ color: DANGER_COLOR }}>退出登录</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      <SwitchAccountModal visible={showSwitchAccountModal} onClose={() => { setShowSwitchAccountModal(false); onClose(); }} />
    </View>
  );
};

// ================== 切换账号页面 ==================
const SwitchAccountScreen = () => {
  const navigation = useNavigation();
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
      navigation.replace('RootTabs');
    } catch (error) {
      showToast('切换失败');
    }
  };

  const handleLoginOther = async () => {
    if (currentUser) {
      dispatch({ type: 'ADD_PREVIOUS_ACCOUNT', payload: { phone: currentUser.phone, role: currentUser.role, shopName: currentUser.shopName, name: currentUser.name } });
    }
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('shopInfo');
    dispatch({ type: 'LOGOUT' });
    navigation.replace('Login');
  };

  const allAccounts = [];
  if (currentUser) allAccounts.push({ phone: currentUser.phone, role: currentUser.role, shopName: currentUser.shopName, name: currentUser.name, isCurrent: true });
  previousAccounts.forEach(acc => {
    if (!allAccounts.find(a => a.phone === acc.phone)) allAccounts.push({ ...acc, isCurrent: false });
  });

  return (
    <View style={styles.switchAccountContainer}>
      <Text style={[styles.pageTitle, { marginBottom: 16 }]}>切换账号</Text>
      {allAccounts.map((acc, idx) => (
        <TouchableOpacity key={idx} style={styles.accountItem} onPress={() => handleSelect(acc)} disabled={acc.isCurrent}>
          <View style={styles.accountInfo}>
            <Text style={styles.accountPhone}>{acc.phone}</Text>
            <Text style={styles.accountDetail}>{acc.shopName} · {acc.role}{acc.isCurrent ? ' (当前)' : ''}</Text>
          </View>
          {!acc.isCurrent && <Ionicons name="chevron-forward" size={24} color={TEXT_THIRD} />}
        </TouchableOpacity>
      ))}
      <TouchableOpacity style={styles.registerBtn} onPress={handleLoginOther}>
        <Text style={styles.registerBtnText}>+ 添加其他账号</Text>
      </TouchableOpacity>
    </View>
  );
};

// ================== 切换账号弹窗（独立 Modal 组件，可在设置中直接弹出） ==================
const SwitchAccountModal = ({ visible, onClose }) => {
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
      onClose();
      showToast(`已切换到 ${account.phone}`);
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
      onClose();
      if (navigationRef.current) {
        navigationRef.current.reset({ index: 0, routes: [{ name: 'Login' }] });
      }
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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
        <View style={{ backgroundColor: BG_CARD, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: TEXT_MAIN }}>👤 切换账号</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={TEXT_THIRD} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 400 }}>
            {allAccounts.length === 0 ? (
              <Text style={{ color: TEXT_THIRD, textAlign: 'center', padding: 30 }}>暂无账号</Text>
            ) : (
              allAccounts.map((acc, idx) => (
                <View key={idx} style={{ backgroundColor: acc.isCurrent ? LIGHT_PRIMARY : '#F5F7FA', borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: PRIMARY_COLOR, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                    <Ionicons name="person" size={24} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: TEXT_MAIN }}>{acc.phone}{acc.isCurrent ? ' (当前)' : ''}</Text>
                    <Text style={{ fontSize: 12, color: TEXT_SECOND, marginTop: 2 }}>{acc.shopName} · {acc.role}</Text>
                  </View>
                  {acc.isCurrent ? (
                    <View style={{ backgroundColor: SUCCESS_COLOR, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                      <Text style={{ color: '#fff', fontSize: 12 }}>使用中</Text>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity style={{ backgroundColor: PRIMARY_COLOR, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }} onPress={() => handleSelect(acc)}>
                        <Text style={{ color: '#fff', fontSize: 12 }}>切换</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={{ backgroundColor: '#F0F0F0', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 12 }} onPress={() => handleDeleteAccount(acc.phone)}>
                        <Ionicons name="trash-outline" size={16} color={DANGER_COLOR} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))
            )}
          </ScrollView>
          <TouchableOpacity style={{ backgroundColor: PRIMARY_COLOR, padding: 14, borderRadius: 12, marginTop: 12, alignItems: 'center' }} onPress={handleLoginOther}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>+ 添加新账号 / 登录其他账号</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
      let total = 0;
      const details = [];
      for (let i = 0; i < aiCountPhotos.length; i++) {
        const base64 = await FileSystem.readAsStringAsync(aiCountPhotos[i], { encoding: FileSystem.EncodingType.Base64 });
        const imageData = `data:image/jpeg;base64,${base64}`;
        const reply = await fetchZhipuChat([
          { role: 'user', content: `请仔细数一下这张图片中的商品总数（不管是什么商品，只要数清楚有多少个/件）。只返回一个纯数字，不要包含其他文字、单位或标点符号。` }
        ], '你是一个商品数量识别助手，只需要返回图片中商品的数量，纯数字。');
        const num = parseInt(reply.replace(/[^\d]/g, ''));
        const count = isNaN(num) ? 0 : num;
        total += count;
        details.push({ photoIndex: i + 1, count });
      }
      const goodsOptions = (state.goodsList || []);
      setAiCountResult({ total, details, photos: aiCountPhotos.length, goodsOptions });
      if (total === 0) {
        showToast('未识别到商品数量，请重新拍照');
      } else {
        showToast(`共识别到 ${total} 件商品`);
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
                <Image key={idx} source={{ uri }} style={{ width: 80, height: 80, borderRadius: 8, marginRight: 8 }} />
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

  const customerList = Object.keys(state.privateChatMessages || {}).map(phone => ({
    phone,
    lastMsg: state.privateChatMessages[phone]?.[0]?.text || '',
  }));

  const currentMessages = messages.filter(m => m.platform === currentPlatform);

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
          time: new Date().toISOString(),
        };
        setMessages(prev => [...prev, msg]);
        setSelectedImages([]);
        setInputText('');
        setShowMediaOptions(false);
        setAiPaused(true);
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
        return;
      }
      if (!text && selectedImages.length === 0) { showToast('请输入内容或选择图片'); return; }
      const msg = {
        id: Date.now().toString(),
        text: text || '',
        image: null,
        from: 'staff',
        platform: currentPlatform,
        time: new Date().toISOString(),
      };
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
    '请问您需要什么帮助？'
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

      {customerList.length > 0 && (
        <View style={{ padding: 8, backgroundColor: BG_CARD, borderBottomWidth: 1, borderColor: BORDER_COLOR }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {customerList.map(c => (
              <TouchableOpacity
                key={c.phone}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  backgroundColor: selectedPhone === c.phone ? PRIMARY_COLOR : LIGHT_PRIMARY,
                  borderRadius: 16,
                  marginRight: 8
                }}
                onPress={() => setSelectedPhone(c.phone)}
              >
                <Text style={{ color: selectedPhone === c.phone ? '#fff' : TEXT_MAIN }}>{c.phone}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {selectedPhone && (
            <View style={{ marginTop: 6 }}>
              <Text style={{ fontSize: 12, color: TEXT_SECOND }}>
                累计消费：¥{getCustomerStats(selectedPhone).total} ｜ 订单数：{getCustomerStats(selectedPhone).count} ｜ 上次到店：{getCustomerStats(selectedPhone).lastOrder}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
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
                {(state.customerTags[selectedPhone] || []).map((tag, idx) => (
                  <View key={idx} style={{ backgroundColor: LIGHT_PRIMARY, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, marginRight: 4, marginBottom: 4 }}>
                    <Text style={{ fontSize: 12, color: PRIMARY_COLOR }}>#{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8, backgroundColor: BG_CARD, borderBottomWidth: 1, borderColor: BORDER_COLOR }}>
        {['美团', '抖音', '大众点评'].map(p => (
          <TouchableOpacity key={p} onPress={() => setCurrentPlatform(p)}>
            <Text style={{
              fontSize: 16,
              fontWeight: currentPlatform === p ? '700' : '400',
              color: currentPlatform === p ? PRIMARY_COLOR : TEXT_SECOND
            }}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>

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
        <TouchableOpacity onPress={() => setShowQuickReply(!showQuickReply)} style={{ paddingHorizontal: 8 }}>
          <Ionicons name="flash-outline" size={20} color={PRIMARY_COLOR} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowMediaOptions(true)} style={{ paddingHorizontal: 8 }}>
          <Ionicons name="add-circle-outline" size={24} color={PRIMARY_COLOR} />
        </TouchableOpacity>
        <TextInput
          style={styles.inputBox}
          placeholder="回复顾客..."
          value={inputText}
          onChangeText={setInputText}
          multiline
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
    const bossPhone = state.shopInfo?.phone;
    if (bossPhone) chatStaffList = [{ id: 'boss', name: '老板', phone: bossPhone }];
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
  const [isHidden, setIsHidden] = useState(false);
  const [searchText, setSearchText] = useState('');
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

  const bgColors = ['#F2F3F5', '#E8F5E9', '#E3F2FD', '#FFF3E0', '#FCE4EC', '#EDE7F6', '#FFFFFF', '#37474F'];
  const staffMembers = state.staffMemberList || [];
  const groupMessages = state.groupChatMessages[chatId] || [];

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

  const toggleHidden = () => {
    setIsHidden(!isHidden);
    showToast(isHidden ? '已取消隐藏会话' : '已隐藏会话');
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

  const reportUser = () => {
    Alert.alert('举报用户', '确定要举报该用户吗？', [
      { text: '取消' },
      { text: '举报', onPress: () => showToast('举报已提交，我们会尽快处理') }
    ]);
  };

  const searchMessages = () => {
    if (!searchText.trim()) return;
    const filtered = groupMessages.filter(msg => msg.text && msg.text.includes(searchText));
    showToast(filtered.length > 0 ? `找到 ${filtered.length} 条记录` : '未找到匹配记录');
    setShowSearchModal(false);
    setSearchText('');
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
          <TouchableOpacity onPress={() => navigation.goBack()}><Text style={{ fontSize: 20 }}>&lt;</Text></TouchableOpacity>
          <Text style={styles.pageTitle}>聊天设置</Text>
          <View style={{ width: 24 }} />
        </View>
      </SafeAreaView>
      <ScrollView style={{ paddingHorizontal: 16 }}>
        <View style={{ marginTop: 16 }}>
          <TouchableOpacity style={styles.chatSettingItem}>
            <Text style={styles.pageTitle}>内部群聊</Text>
            <Text style={[styles.chatSettingDesc, { color: TEXT_THIRD }]}>群成员: {(state.staffMemberList || []).length + 1}人</Text>
          </TouchableOpacity>
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
          <TouchableOpacity style={[styles.chatSettingItem, { borderBottomWidth: 0 }]} onPress={() => setShowMediaModal(true)}>
            <Ionicons name="images-outline" size={22} color={PRIMARY_COLOR} />
            <Text style={styles.chatSettingText}>图片、视频、文件</Text>
            <Text style={styles.chatSettingDesc}>></Text>
          </TouchableOpacity>
        </View>
        <View style={{ marginTop: 16, backgroundColor: BG_CARD, borderRadius: 14, overflow: 'hidden', ...SHADOW }}>
          <TouchableOpacity style={styles.chatSettingItem} onPress={toggleTop}>
            <Ionicons name="pin-outline" size={22} color={PRIMARY_COLOR} />
            <Text style={styles.chatSettingText}>{isTop ? '取消置顶' : '设为置顶'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.chatSettingItem} onPress={toggleSpecialCare}>
            <Ionicons name="heart-outline" size={22} color={PRIMARY_COLOR} />
            <Text style={styles.chatSettingText}>特别关心</Text>
            {isSpecialCare && <Text style={[styles.chatSettingDesc, { color: SUCCESS_COLOR }]}>已开启</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.chatSettingItem} onPress={toggleHidden}>
            <Ionicons name="eye-off-outline" size={22} color={PRIMARY_COLOR} />
            <Text style={styles.chatSettingText}>隐藏会话</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.chatSettingItem, { borderBottomWidth: 0 }]} onPress={toggleMute}>
            <Ionicons name={isMuted ? "notifications-off-outline" : "notifications-outline"} size={22} color={PRIMARY_COLOR} />
            <Text style={styles.chatSettingText}>{isMuted ? '取消消息免打扰' : '消息免打扰'}</Text>
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
        <View style={{ marginTop: 16, backgroundColor: BG_CARD, borderRadius: 14, overflow: 'hidden', ...SHADOW }}>
          <TouchableOpacity style={[styles.chatSettingItem, { borderBottomWidth: 0 }]} onPress={reportUser}>
            <Ionicons name="alert-circle-outline" size={22} color={DANGER_COLOR} />
            <Text style={{ ...styles.chatSettingText, color: DANGER_COLOR }}>被骚扰了？举报该用户</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={showSearchModal} transparent animationType="fade">
        <View style={styles.modalMask}>
          <View style={styles.modalWrap}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>查找聊天记录</Text>
              <TouchableOpacity onPress={() => { setShowSearchModal(false); setSearchText(''); }}><Text style={styles.closeTxt}>✕</Text></TouchableOpacity>
            </View>
            <TextInput style={styles.formInput} placeholder="输入关键词搜索" value={searchText} onChangeText={setSearchText} />
            <TouchableOpacity style={styles.primaryBtn} onPress={searchMessages}><Text style={styles.sendTxt}>搜索</Text></TouchableOpacity>
          </View>
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
  const abortControllerRef = useRef(null);

  const industry = state.shopInfo?.industry || '餐饮类';
  const shopName = state.shopInfo?.shopName || '我的门店';

  const getQuickReplies = () => {
    if (industry === '餐饮类') {
      return [
        '今日推荐菜品有哪些？',
        '顾客投诉菜品不新鲜怎么处理？',
        '本周食材采购成本是多少？',
        '帮我生成一份促销活动文案',
        '今日客单价是多少？'
      ];
    } else if (industry === '服务类') {
      return [
        '今日服务订单量是多少？',
        '员工排班表怎么安排？',
        '顾客满意度如何提升？',
        '帮我生成服务推广话术',
        '本月服务收入目标是多少？'
      ];
    } else if (industry === '企业类') {
      return [
        '今日销售业绩如何？',
        '团队协作效率如何提升？',
        '请生成项目汇报模板',
        '员工绩效怎么考核？',
        '本月招聘计划是什么？'
      ];
    }
    return [
      '今天生意怎么样？',
      '有什么经营建议？',
      '帮我分析数据',
      '生成一份报表',
      '怎么提高利润？'
    ];
  };

  const quickReplies = getQuickReplies();

  useEffect(() => {
    if (messages.length === 0) {
      if (industry === '待识别') {
        setMessages([{ id: '1', text: `您好！我是经营宝AI助手，正在识别您的店铺类型...`, from: 'ai', time: new Date().toISOString() }]);
        const abortController = new AbortController();
        fetchZhipuChat([], `请根据店铺名称「${shopName}」判断商家类型，只能在以下三个类型中选择一个：餐饮类、服务类、企业类。只需返回类型名称，不要包含其他文字。`, abortController.signal)
          .then(result => {
            let detectedIndustry = '餐饮类';
            if (result.includes('服务类')) detectedIndustry = '服务类';
            else if (result.includes('企业类')) detectedIndustry = '企业类';
            dispatch({ type: 'SET_SHOP_INFO', payload: { ...shopInfo, industry: detectedIndustry } });
            setMessages([
              { id: '1', text: `您好！我是经营宝AI助手，已识别您的店铺为「${shopName}」(${detectedIndustry})，可以帮您解答经营问题、生成营销文案、分析数据等。您也可以描述图片需求，我帮您生成创意图片。`, from: 'ai', time: new Date().toISOString() }
            ]);
          })
          .catch(() => {
            setMessages([{ id: '1', text: `您好！我是经营宝AI助手，已识别您的店铺为「${shopName}」，可以帮您解答经营问题、生成营销文案、分析数据等。您也可以描述图片需求，我帮您生成创意图片。`, from: 'ai', time: new Date().toISOString() }]);
          });
      } else {
        setMessages([{ id: '1', text: `您好！我是经营宝AI助手，已识别您的店铺为「${shopName}」(${industry})，可以帮您解答经营问题、生成营销文案、分析数据等。您也可以描述图片需求，我帮您生成创意图片。`, from: 'ai', time: new Date().toISOString() }]);
      }
    }
  }, []);

  const handleMarketing = (type) => {
    const prompts = {
      '文案': '请生成一条吸引人的营销文案',
      '海报': '请设计一张宣传海报的文字描述',
      '广告语': '请生成一条简短有力的广告语'
    };
    setInputText(prompts[type] || '');
  };

  const toggleImageGen = () => {
    setShowImageGen(!showImageGen);
    const hint = {
      id: Date.now().toString(),
      text: showImageGen ? '已切换回问答模式' : '🖼️ 图片生成模式已开启，输入您想要的画面描述即可生成图片。',
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

      const orders = state.globalOrderRecord || [];
      const goods = state.goodsList || [];
      const todayStr = new Date().toISOString().split('T')[0];
      const todayOrders = orders.filter(o => o.time?.startsWith(todayStr));
      const totalOrders = orders.length;
      const totalRevenue = orders.reduce((sum, o) => sum + (o.couponPrice || 0), 0);
      const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.couponPrice || 0), 0);
      const totalStock = goods.reduce((sum, g) => sum + (g.stock || 0), 0);
      const lowStockItems = goods.filter(g => (g.stock || 0) < 10).map(g => `${g.name}(库存:${g.stock})`).join(',');
      
      const businessContext = `【店铺信息】名称：${shopName}，类型：${industry}
【经营数据】总订单数：${totalOrders}，总营收：¥${totalRevenue}，今日订单：${todayOrders.length}，今日营收：¥${todayRevenue}
【库存数据】商品总数：${goods.length}，总库存：${totalStock}，库存不足商品：${lowStockItems || '无'}
【订单列表】${orders.slice(-5).map(o => `${o.platform}：${o.productName || '商品'} ¥${o.couponPrice || 0} ${formatDate(o.time)}`).join('；')}`;

      const msgList = messages.filter(m => m.from !== 'system').map(m => ({
        role: m.from === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));
      msgList.push({ role: 'user', content: text });
      let reply = '';
      if (showImageGen) {
        try {
          const fullPrompt = `${text}，适用于${industry}店铺「${shopName}」的宣传，风格时尚吸引人。`;
          const imageResult = await fetchZhipuImage(fullPrompt, abortControllerRef.current.signal);
          if (!abortControllerRef.current.signal.aborted && imageResult) {
            if (imageResult === 'aborted') {
              setLoading(false);
              abortControllerRef.current = null;
              return;
            }
            const aiMsg = {
              id: (Date.now()+1).toString(),
              text: '图片已生成',
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
            reply = '生成失败，请重试';
          }
        } catch (e) {
          if (e.name === 'AbortError') {
            setLoading(false);
            abortControllerRef.current = null;
            return;
          }
          reply = '生成失败，请重试';
        }
      } else {
        reply = await fetchZhipuChat(msgList, `你是一个经营宝AI助手，帮助${industry}商家解决经营问题。以下是当前店铺的经营数据，基于这些数据回答用户问题：\n\n${businessContext}\n\n回答要简洁、实用，基于上述数据进行分析。`, abortControllerRef.current.signal);
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
      <SafeAreaView edges={['top']} style={{ backgroundColor: BG_CARD }}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => navigation.goBack()}><Text style={{ fontSize: 20 }}>&lt;</Text></TouchableOpacity>
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
                <Image source={{ uri: msg.image }} style={styles.imageMessage} />
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
          {['文案', '海报', '广告语'].map(label => (
            <TouchableOpacity key={label} style={{ marginRight: 8, marginBottom: 4, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: LIGHT_PRIMARY, borderRadius: 16 }} onPress={() => handleMarketing(label)}>
              <Text style={{ fontSize: 13, color: PRIMARY_COLOR }}>📣 {label}</Text>
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
        <TouchableOpacity onPress={() => setShowQuickReply(!showQuickReply)} style={{ paddingHorizontal: 8 }}><Ionicons name="sparkles-outline" size={24} color={PRIMARY_COLOR} /></TouchableOpacity>
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
  const menuList = allMenuList.filter(item => {
    if (isEmployee) return ['VerifyOrder', 'StockManage', 'InternalChat'].includes(item.key);
    return true;
  });

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
    const bossPhone = state.shopInfo?.phone || '';
    if (bossPhone) chatStaffList = [{ id: 'boss', name: '老板', phone: bossPhone }];
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
        const welcome = { id: Date.now().toString(), text: `🎉 ${staff.name} 已入职，欢迎加入！`, from: '系统', fromPhone: 'system', time: new Date().toISOString(), type: 'text' };
        dispatch({ type: 'ADD_GROUP_MESSAGE', payload: { chatId: 'internal', message: welcome } });
        showToast(`${staff.name} 已批准入职`);
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
            <Text style={{ fontSize: 18, fontWeight: '600', color: TEXT_MAIN, marginBottom: 8 }}>👋 欢迎，{user?.name || '商家'}</Text>
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
                <TouchableOpacity style={{ width: (width - 44) / 2, backgroundColor: BG_CARD, padding: 16, borderRadius: 14, ...SHADOW }} onPress={() => navigation.navigate('StaffManage')}>
                  <Text style={{ fontSize: 13, color: TEXT_SECOND }}>入职申请</Text>
                  <Text style={{ fontSize: 22, fontWeight: '700', marginTop: 8, color: ((state.staffMemberList || []).filter(s => s.status === 'pending').length) > 0 ? DANGER_COLOR : TEXT_MAIN }}>
                    {(state.staffMemberList || []).filter(s => s.status === 'pending').length}
                    {((state.staffMemberList || []).filter(s => s.status === 'pending').length) > 0 && <Text style={{ fontSize: 14, color: PRIMARY_COLOR, marginLeft: 8 }}>点击查看 →</Text>}
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
              {menuList.filter(item => menuVisibility[item.key] !== false).map((item, idx) => (
                <TouchableOpacity key={idx} onPress={() => handleMenuPress(item)} style={styles.menuItem}>
                  <Ionicons name={item.icon} size={28} color={PRIMARY_COLOR} />
                  <Text style={{ fontSize: 13, marginTop: 6, color: TEXT_MAIN }}>{item.label}</Text>
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
        <DraggableFloatingButton onPress={() => navigation.navigate('MerchantAssistant')} />
      )}
    </View>
  );
};

const DraggableFloatingButton = ({ onPress }) => {
  const [position, setPosition] = useState({ x: width - 76, y: height - 180 });
  const [isDragging, setIsDragging] = useState(false);
  const positionRef = useRef({ x: width - 76, y: height - 180 });
  const startPosRef = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderGrant: () => {
      setIsDragging(true);
      hasMovedRef.current = false;
      startPosRef.current = { x: positionRef.current.x, y: positionRef.current.y };
    },
    onPanResponderMove: (_, gestureState) => {
      if (Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5) {
        hasMovedRef.current = true;
      }
      let newX = startPosRef.current.x + gestureState.dx;
      let newY = startPosRef.current.y + gestureState.dy;
      newX = Math.max(0, Math.min(width - 56, newX));
      newY = Math.max(0, Math.min(height - 100, newY));
      setPosition({ x: newX, y: newY });
    },
    onPanResponderRelease: () => {
      setIsDragging(false);
      if (!hasMovedRef.current) {
        onPress();
      }
    },
    onPanResponderTerminate: () => {
      setIsDragging(false);
    },
  });

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}
    >
      <View
        {...panResponder.panHandlers}
        style={{
          position: 'absolute',
          left: position.x,
          top: position.y,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: PRIMARY_COLOR,
          justifyContent: 'center',
          alignItems: 'center',
          ...SHADOW,
          transform: [{ scale: isDragging ? 1.1 : 1 }],
        }}
      >
        <Ionicons name="sparkles" size={28} color="#fff" />
        <View style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: SUCCESS_COLOR, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 10 }}>AI</Text>
        </View>
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
      <Stack.Screen name="SwitchAccount" component={SwitchAccountScreen} />
    </Stack.Navigator>
  );
}

function AppStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="RootTabs" component={RootTabs} />
      <Stack.Screen name="BadReviewList" component={BadReviewListPage} />
      <Stack.Screen name="ProductOverview" component={ProductOverview} />
      <Stack.Screen name="StaffManage" component={StaffManage} />
      <Stack.Screen name="PrivateChat" component={PrivateChat} />
      <Stack.Screen name="ChatSetting" component={ChatSettingScreen} />
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
      </AppContext.Provider>
    </SafeAreaProvider>
  );
}
// ===== 第三段结束 =====