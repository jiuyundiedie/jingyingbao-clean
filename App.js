import React, { createContext, useContext, useReducer, useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, Alert,
  BackHandler, ActivityIndicator, Dimensions, Platform, ToastAndroid,
  Modal, Image, FlatList, RefreshControl, StatusBar, SafeAreaView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// ===== 工具函数 =====
const showToast = (msg) => {
  if (Platform.OS === 'android') {
    ToastAndroid.show(msg, ToastAndroid.SHORT);
  } else {
    Alert.alert('提示', msg);
  }
};

const { width, height } = Dimensions.get('window');
const PRIMARY_COLOR = '#165DFF';
const LIGHT_PRIMARY = '#E8F3FF';
const DANGER_COLOR = '#F53F3F';
const SUCCESS_COLOR = '#00B42A';
const BG_PAGE = '#F2F3F5';
const BG_CARD = '#FFFFFF';
const TEXT_MAIN = '#1D2129';
const TEXT_SECOND = '#4E5969';
const TEXT_THIRD = '#86909C';
const BORDER_COLOR = '#E5E6EB';
const SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 8,
  elevation: 4,
};

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

// ===== Reducer =====
const defaultState = {
  user: null,
  shopInfo: { shopName: '', phone: '', industry: '餐饮类' },
  previousAccounts: [],
  globalOrderRecord: [],
  goodsList: [],
  staffMemberList: [],
  badReviewCount: 0,
  badReviewList: [],
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
    case 'SET_GOODS_LIST':
      return { ...state, goodsList: action.payload || [] };
    case 'SET_STAFF_LIST':
      return { ...state, staffMemberList: action.payload || [] };
    case 'SET_BAD_REVIEW_COUNT':
      return { ...state, badReviewCount: action.payload };
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
    case 'ADD_PREVIOUS_ACCOUNT': {
      const exists = (state.previousAccounts || []).find(a => a.phone === action.payload.phone);
      if (exists) return state;
      return { ...state, previousAccounts: [...(state.previousAccounts || []), action.payload] };
    }
    case 'CLEAR_PREVIOUS_ACCOUNTS':
      return { ...state, previousAccounts: [] };
    case 'RESTORE_ALL_DATA': {
      const r = action.payload || {};
      return {
        ...state,
        globalOrderRecord: Array.isArray(r.globalOrderRecord) ? r.globalOrderRecord : [],
        goodsList: Array.isArray(r.goodsList) ? r.goodsList : [],
        staffMemberList: Array.isArray(r.staffMemberList) ? r.staffMemberList : [],
        badReviewList: Array.isArray(r.badReviewList) ? r.badReviewList : [],
        previousAccounts: Array.isArray(r.previousAccounts) ? r.previousAccounts : [],
        user: r.user || null,
        shopInfo: r.shopInfo || { shopName: '', phone: '', industry: '餐饮类' },
        badReviewCount: typeof r.badReviewCount === 'number' ? r.badReviewCount : 0,
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
      goodsList: state.goodsList || [],
      staffMemberList: state.staffMemberList || [],
      badReviewList: state.badReviewList || [],
      previousAccounts: state.previousAccounts || [],
      user: state.user,
      shopInfo: state.shopInfo,
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
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: BG_CARD,
    ...SHADOW,
  },
  pageTitle: { fontSize: 18, fontWeight: '600', color: TEXT_MAIN },
  homeTitle: { fontSize: 20, fontWeight: '700', color: TEXT_MAIN },
  container: { flex: 1, backgroundColor: BG_PAGE },
  cardBox: { backgroundColor: BG_CARD, padding: 16, borderRadius: 14, ...SHADOW },
  listItem: { backgroundColor: BG_CARD, padding: 14, borderRadius: 12, marginVertical: 6, ...SHADOW },
  label: { fontSize: 14, color: TEXT_SECOND, marginTop: 12, marginBottom: 6, fontWeight: '500' },
  formInput: { height: 44, paddingHorizontal: 14, borderWidth: 1, borderColor: BORDER_COLOR, borderRadius: 10, backgroundColor: BG_CARD, color: TEXT_MAIN },
  primaryBtn: { marginTop: 16, height: 48, backgroundColor: PRIMARY_COLOR, borderRadius: 12, justifyContent: 'center', alignItems: 'center', ...SHADOW },
  miniBlueBtn: { paddingHorizontal: 14, paddingVertical: 10, backgroundColor: PRIMARY_COLOR, borderRadius: 8 },
  sendTxt: { color: '#fff', fontSize: 14, fontWeight: '500' },
  loginContainer: { flex: 1, backgroundColor: '#F8FAFF', paddingHorizontal: 24, justifyContent: 'center' },
  loginTitle: { fontSize: 28, fontWeight: '700', color: TEXT_MAIN, marginBottom: 8 },
  loginSubtitle: { fontSize: 16, color: TEXT_SECOND, marginBottom: 32 },
  roleSelector: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 24 },
  roleBtn: { flex: 1, paddingVertical: 12, marginHorizontal: 6, borderRadius: 10, borderWidth: 1, borderColor: BORDER_COLOR, alignItems: 'center' },
  roleBtnActive: { borderColor: PRIMARY_COLOR, backgroundColor: LIGHT_PRIMARY },
  roleText: { fontSize: 16, fontWeight: '500', color: TEXT_MAIN },
  loginBtn: { height: 48, backgroundColor: PRIMARY_COLOR, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 16 },
  loginBtnText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  codeRow: { flexDirection: 'row', alignItems: 'center' },
  codeInput: { flex: 1 },
  getCodeBtn: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: LIGHT_PRIMARY, borderRadius: 8, marginLeft: 8 },
  getCodeText: { color: PRIMARY_COLOR, fontSize: 14 },
  tagNormal: { paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: BORDER_COLOR, borderRadius: 20, backgroundColor: 'transparent' },
  tagActive: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: PRIMARY_COLOR, borderRadius: 20 },
  settingGroup: { marginTop: 16, backgroundColor: BG_CARD, borderRadius: 14, overflow: 'hidden', ...SHADOW },
  settingItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR },
  settingItemLast: { borderBottomWidth: 0 },
  switchAccountContainer: { flex: 1, backgroundColor: BG_PAGE, paddingHorizontal: 16, paddingTop: 20 },
  accountItem: { backgroundColor: BG_CARD, padding: 16, borderRadius: 12, marginVertical: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', ...SHADOW },
  accountInfo: { flex: 1 },
  accountPhone: { fontSize: 16, fontWeight: '500', color: TEXT_MAIN },
  accountDetail: { fontSize: 14, color: TEXT_SECOND, marginTop: 2 },
  registerBtn: { marginTop: 20, height: 48, backgroundColor: PRIMARY_COLOR, borderRadius: 12, justifyContent: 'center', alignItems: 'center', ...SHADOW },
  registerBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  badReviewItem: { backgroundColor: BG_CARD, padding: 14, borderRadius: 12, marginVertical: 6, ...SHADOW },
  badReviewContent: { fontSize: 14, color: TEXT_MAIN },
  badReviewMeta: { fontSize: 12, color: TEXT_THIRD, marginTop: 4 },
  badReviewHandled: { fontSize: 12, color: SUCCESS_COLOR, marginTop: 4, fontWeight: '500' },
  badReviewHandledBtn: { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: SUCCESS_COLOR, borderRadius: 6, marginLeft: 8 },
  badReviewHandledBtnText: { color: '#fff', fontSize: 12 },
  badReviewEmpty: { textAlign: 'center', marginTop: 40, color: TEXT_THIRD, fontSize: 16 },
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
  const previousAccounts = state.previousAccounts || [];

  useEffect(() => {
    if (state.user) {
      navigation.replace('RootTabs');
    }
  }, [state.user]);

  const handleLogin = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (phone.length !== 11) { showToast('请输入11位手机号'); setLoading(false); return; }
      if (code !== '123456') { showToast('验证码错误'); setLoading(false); return; }
      if (!shopName.trim()) { showToast('请输入店铺名称'); setLoading(false); return; }

      const user = { role, phone, shopName, name: role === '员工' ? employeeName.trim() : '老板' };
      const shopInfo = { shopName, phone, industry: '餐饮类' };

      await AsyncStorage.setItem('user', JSON.stringify(user));
      await AsyncStorage.setItem('shopInfo', JSON.stringify(shopInfo));

      dispatch({ type: 'LOGIN', payload: { user, shopInfo } });
      dispatch({ type: 'ADD_PREVIOUS_ACCOUNT', payload: { phone, role, shopName, name: user.name } });

      navigation.replace('RootTabs');
      setLoading(false);
    } catch (error) {
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
    <View style={styles.loginContainer}>
      <Text style={styles.loginTitle}>经营宝</Text>
      <Text style={styles.loginSubtitle}>登录您的店铺账号</Text>
      <TouchableOpacity onPress={() => setShowHistory(!showHistory)}>
        <Text style={{ color: PRIMARY_COLOR, marginBottom: 12 }}>历史账号</Text>
      </TouchableOpacity>
      {showHistory && previousAccounts.length > 0 && (
        <View style={{ marginBottom: 12 }}>
          {previousAccounts.map((acc, idx) => (
            <TouchableOpacity key={idx} style={{ paddingVertical: 8, borderBottomWidth: 1, borderColor: BORDER_COLOR }} onPress={() => handleHistorySelect(acc)}>
              <Text style={{ fontSize: 16, color: TEXT_MAIN }}>{acc.phone} - {acc.shopName} ({acc.role})</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
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
    </View>
  );
};
// ===== 第一段结束 =====// ================== 差评列表 ==================
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
      <View style={styles.safeTop} />
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={{ fontSize: 20 }}>&lt;</Text></TouchableOpacity>
        <Text style={styles.pageTitle}>差评预警详情</Text>
        <View style={{ width: 24 }} />
      </View>
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

// ================== 设置抽屉 ==================
const SettingDrawer = ({ visible, onClose }) => {
  const navigation = useNavigation();
  const { state, dispatch } = useApp();
  const user = state.user;
  const shopInfo = state.shopInfo || { shopName: '', phone: '' };
  const isEmployee = user?.role === '员工';
  const [shopName, setShopName] = useState(shopInfo.shopName || '');
  const [phone, setPhone] = useState(shopInfo.phone || '');

  const saveShop = () => {
    if (isEmployee) { showToast('员工无权修改'); return; }
    dispatch({ type: 'UPDATE_SHOP_INFO', payload: { ...shopInfo, shopName, phone } });
    showToast('门店信息已保存');
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('shopInfo');
      dispatch({ type: 'LOGOUT' });
      onClose();
      navigation.replace('Login');
    } catch (error) {
      showToast('退出失败');
    }
  };
  const handleSwitchAccount = () => { onClose(); navigation.navigate('SwitchAccount'); };

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
              <Ionicons name="storefront-outline" size={20} color={TEXT_SECOND} style={{ marginRight: 12 }} />
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
              <Ionicons name="call-outline" size={20} color={TEXT_SECOND} style={{ marginRight: 12 }} />
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
          <View style={styles.settingGroup}>
            <TouchableOpacity style={styles.settingItem} onPress={handleSwitchAccount}>
              <Ionicons name="person-outline" size={20} color={TEXT_SECOND} style={{ marginRight: 12 }} />
              <Text style={{ color: TEXT_MAIN }}>切换账号</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.settingItem, styles.settingItemLast]} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={20} color={DANGER_COLOR} style={{ marginRight: 12 }} />
              <Text style={{ color: DANGER_COLOR }}>退出登录</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
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

  const handleRegister = async () => {
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('shopInfo');
    dispatch({ type: 'LOGOUT' });
    dispatch({ type: 'CLEAR_PREVIOUS_ACCOUNTS' });
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
      {allAccounts.length === 0 ? (
        <Text style={{ color: TEXT_THIRD, textAlign: 'center', marginTop: 30 }}>暂无历史账号</Text>
      ) : (
        allAccounts.map((acc, idx) => (
          <TouchableOpacity key={idx} style={styles.accountItem} onPress={() => handleSelect(acc)} disabled={acc.isCurrent}>
            <View style={styles.accountInfo}>
              <Text style={styles.accountPhone}>{acc.phone}</Text>
              <Text style={styles.accountDetail}>{acc.shopName} · {acc.role}{acc.isCurrent ? ' (当前)' : ''}</Text>
            </View>
            {!acc.isCurrent && <Ionicons name="chevron-forward" size={24} color={TEXT_THIRD} />}
          </TouchableOpacity>
        ))
      )}
      <TouchableOpacity style={styles.registerBtn} onPress={handleRegister}>
        <Text style={styles.registerBtnText}>注册新账号</Text>
      </TouchableOpacity>
    </View>
  );
};

// ================== 首页 ==================
const HomePage = () => {
  const navigation = useNavigation();
  const { state, dispatch } = useApp();
  const user = state.user;
  const [settingOpen, setSettingOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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
  let totalIncome = 0;
  todayOrders.forEach(order => { totalIncome += order.couponPrice || 0; });

  const isEmployee = user?.role === '员工';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG_PAGE }}>
      <View style={styles.container}>
        <SettingDrawer visible={settingOpen} onClose={() => setSettingOpen(false)} />
        <View style={styles.headerBar}>
          <View style={{ width: 40 }} />
          <Text style={styles.homeTitle}>经营宝</Text>
          <TouchableOpacity onPress={() => setSettingOpen(true)}><Ionicons name="settings-outline" size={24} color={TEXT_SECOND} /></TouchableOpacity>
        </View>
        <ScrollView style={{ flex: 1, paddingHorizontal: 16 }} contentContainerStyle={{ paddingBottom: 80 }}>
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
                <View style={{ width: (width - 44) / 2, backgroundColor: BG_CARD, padding: 16, borderRadius: 14, ...SHADOW }}>
                  <Text style={{ fontSize: 13, color: TEXT_SECOND }}>总商品数</Text>
                  <Text style={{ fontSize: 22, fontWeight: '700', marginTop: 8, color: TEXT_MAIN }}>{(state.goodsList || []).length}</Text>
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};
// ===== 第二段结束 =====// ================== 订单核销页面 ==================
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

  const handleBarCodeScanned = ({ data }) => {
    setScanning(false);
    setOrderCode(data);
  };

  if (scanning) {
    return (
      <View style={{ flex: 1 }}>
        <BarCodeScanner onBarCodeScanned={handleBarCodeScanned} style={{ flex: 1 }} />
        <TouchableOpacity
          style={{ position: 'absolute', top: 40, right: 20, backgroundColor: 'rgba(0,0,0,0.7)', padding: 10, borderRadius: 8 }}
          onPress={() => setScanning(false)}
        >
          <Text style={{ color: '#fff', fontSize: 16 }}>取消</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.safeTop} />
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={{ fontSize: 20 }}>&lt;</Text></TouchableOpacity>
        <Text style={styles.pageTitle}>订单核销</Text>
        <View style={{ width: 24 }} />
      </View>
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
          else if (route.name === '核销') iconName = focused ? 'checkmark-circle' : 'checkmark-circle-outline';
          else if (route.name === '客服') iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          else if (route.name === '出入库') iconName = focused ? 'cube' : 'cube-outline';
          else if (route.name === '内部') iconName = focused ? 'people' : 'people-outline';
          else if (route.name === 'AI助手') iconName = focused ? 'bulb' : 'bulb-outline';
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
      {!isEmployee && <Tab.Screen name="客服" component={() => <PlaceholderPage title="顾客客服" />} />}
      <Tab.Screen name="出入库" component={() => <PlaceholderPage title="出入库管理" />} />
      <Tab.Screen name="内部" component={() => <PlaceholderPage title="内部沟通" />} />
      {!isEmployee && <Tab.Screen name="AI助手" component={() => <PlaceholderPage title="AI助手" />} />}
    </Tab.Navigator>
  );
}

// ================== 主栈导航 ==================
const Stack = createNativeStackNavigator();
function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="RootTabs" component={RootTabs} />
      <Stack.Screen name="SwitchAccount" component={SwitchAccountScreen} />
      <Stack.Screen name="BadReviewList" component={BadReviewListPage} />
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
          const user = JSON.parse(userStr);
          const shopInfo = JSON.parse(shopStr);
          dispatch({ type: 'LOGIN', payload: { user, shopInfo } });
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
        <NavigationContainer>
          <MainStack />
        </NavigationContainer>
      </AppContext.Provider>
    </SafeAreaProvider>
  );
}
// ===== 第三段结束 =====