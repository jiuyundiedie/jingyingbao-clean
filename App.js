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
import moment from 'moment';
import { useSafeAreaInsets, SafeAreaProvider } from 'react-native-safe-area-context';

// ===== 工具函数 =====
const showToast = (msg) => {
  if (Platform.OS === 'android') {
    ToastAndroid.show(msg, ToastAndroid.SHORT);
  } else {
    Alert.alert('提示', msg);
  }
};

const detectIndustry = (shopName) => {
  const foodKeywords = ['火锅', '烧烤', '奶茶', '咖啡', '面馆', '川菜', '粤菜', '日料', '韩餐', '西餐', '烘焙', '小吃', '餐厅', '饭店', '餐饮', '美食', '快餐', '外卖', '茶饮', '饮品', '糕点', '甜品'];
  for (const kw of foodKeywords) { if (shopName.includes(kw)) return '餐饮类'; }
  return '餐饮类';
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

// ===== Reducer =====
const defaultState = {
  user: null,
  shopInfo: { shopName: '', phone: '', industry: '餐饮类' },
  previousAccounts: [],
  globalOrderRecord: [],
};

const initialState = JSON.parse(JSON.stringify(defaultState));

function appReducer(state, action) {
  switch (action.type) {
    case 'LOGIN': return { ...state, user: action.payload.user, shopInfo: action.payload.shopInfo };
    case 'LOGOUT': return { ...state, user: null, shopInfo: { shopName: '', phone: '', industry: '餐饮类' } };
    case 'UPDATE_SHOP_INFO': return { ...state, shopInfo: action.payload };
    case 'ADD_ORDER_RECORD': return { ...state, globalOrderRecord: [action.payload, ...(state.globalOrderRecord || [])] };
    case 'ADD_PREVIOUS_ACCOUNT': {
      const exists = (state.previousAccounts || []).find(a => a.phone === action.payload.phone);
      if (exists) return state;
      return { ...state, previousAccounts: [...(state.previousAccounts || []), action.payload] };
    }
    case 'CLEAR_PREVIOUS_ACCOUNTS': return { ...state, previousAccounts: [] };
    case 'RESTORE_ALL_DATA': {
      const r = action.payload || {};
      return {
        ...defaultState,
        ...r,
        globalOrderRecord: Array.isArray(r.globalOrderRecord) ? r.globalOrderRecord : [],
        previousAccounts: Array.isArray(r.previousAccounts) ? r.previousAccounts : [],
        user: r.user || null,
        shopInfo: (r.shopInfo && typeof r.shopInfo === 'object') ? r.shopInfo : { shopName: '', phone: '', industry: '餐饮类' },
      };
    }
    default: return state;
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
      previousAccounts: state.previousAccounts || [],
      user: state.user,
      shopInfo: state.shopInfo,
    };
    await AsyncStorage.setItem('appData', JSON.stringify(dataToSave));
  } catch (error) {
    console.warn('保存数据失败', error);
  }
};

const loadAllData = async () => {
  try {
    const data = await AsyncStorage.getItem('appData');
    if (data) return JSON.parse(data);
    return null;
  } catch (error) {
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
  dailyReportCard: { marginTop: 16, backgroundColor: BG_CARD, padding: 14, borderRadius: 14, ...SHADOW },
  reportTitle: { fontSize: 16, fontWeight: '600', color: TEXT_MAIN, marginBottom: 8 },
  reportRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  reportLabel: { fontSize: 14, color: TEXT_SECOND },
  reportValue: { fontSize: 14, color: TEXT_MAIN, fontWeight: '500' },
  exportBtn: { marginTop: 8, padding: 10, backgroundColor: PRIMARY_COLOR, borderRadius: 8, alignSelf: 'flex-start' },
  exportBtnText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  inputBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderColor: BORDER_COLOR, backgroundColor: '#F7F7F7', position: 'absolute', bottom: 0, left: 0, right: 0, ...SHADOW },
  inputBox: { flex: 1, height: 44, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 0, borderRadius: 22, fontSize: 15, backgroundColor: '#FFFFFF', color: TEXT_MAIN, ...SHADOW },
  sendBtn: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: PRIMARY_COLOR, borderRadius: 22, marginLeft: 8 },
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
  const previousAccounts = state.previousAccounts || [];

  useEffect(() => {
    if (state.user) navigation.replace('RootTabs');
  }, [state.user]);

  const handleLogin = async () => {
    try {
      if (phone.length !== 11) { showToast('请输入11位手机号'); return; }
      if (code !== '123456') { showToast('验证码错误'); return; }
      if (!shopName.trim()) { showToast('请输入店铺名称'); return; }
      const industry = detectIndustry(shopName);
      const user = { role, phone, shopName, name: role === '员工' ? employeeName.trim() : '老板' };
      const shopInfo = { shopName, phone, industry };
      dispatch({ type: 'LOGIN', payload: { user, shopInfo } });
      dispatch({ type: 'ADD_PREVIOUS_ACCOUNT', payload: { phone, role, shopName, name: user.name } });
      await AsyncStorage.setItem('user', JSON.stringify(user));
      await AsyncStorage.setItem('shopInfo', JSON.stringify(shopInfo));
      navigation.replace('RootTabs');
    } catch (error) {
      console.error('登录失败:', error);
      showToast('登录失败，请重试');
    }
  };

  const handleHistorySelect = async (account) => {
    try {
      const user = { role: account.role, phone: account.phone, shopName: account.shopName, name: account.name || '老板' };
      const shopInfo = { shopName: account.shopName, phone: account.phone, industry: detectIndustry(account.shopName) };
      dispatch({ type: 'LOGIN', payload: { user, shopInfo } });
      await AsyncStorage.setItem('user', JSON.stringify(user));
      await AsyncStorage.setItem('shopInfo', JSON.stringify(shopInfo));
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
        {['商家','员工'].map(r => (
          <TouchableOpacity key={r} style={[styles.roleBtn, role === r && styles.roleBtnActive]} onPress={() => setRole(r)}>
            <Text style={[styles.roleText, role === r && { color: '#fff' }]}>{r}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.label}>手机号</Text>
      <TextInput style={[styles.formInput, { marginBottom: 12 }]} placeholder="请输入手机号" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
      <Text style={styles.label}>验证码</Text>
      <View style={[styles.codeRow, { marginBottom: 16 }]}>
        <TextInput style={[styles.formInput, styles.codeInput]} placeholder="验证码" keyboardType="numeric" value={code} onChangeText={setCode} />
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
      <TouchableOpacity style={styles.loginBtn} onPress={handleLogin}>
        <Text style={styles.loginBtnText}>登录</Text>
      </TouchableOpacity>
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
    const industry = detectIndustry(shopName);
    dispatch({ type: 'UPDATE_SHOP_INFO', payload: { ...shopInfo, shopName, phone, industry } });
    showToast(`门店信息已保存`);
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
    <View style={{ position:'absolute', zIndex:9998, top:0, left:0, right:0, bottom:0, flexDirection: 'row' }}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }} activeOpacity={1} onPress={onClose} />
      <ScrollView style={{ width: width * 0.7, height: '100%', backgroundColor: BG_CARD }}>
        <View style={styles.safeTop} />
        <View style={[styles.headerBar, { borderBottomWidth: 0 }]}>
          <Text style={styles.pageTitle}>系统设置</Text>
          <TouchableOpacity onPress={onClose}><Text style={{ fontSize:20, color: TEXT_SECOND }}>✕</Text></TouchableOpacity>
        </View>
        <View style={{ padding: 16 }}>
          <View style={styles.settingGroup}>
            <View style={[styles.settingItem, { borderBottomWidth: 0 }]}>
              <Ionicons name="storefront-outline" size={20} color={TEXT_SECOND} style={{ marginRight: 12 }} />
              <View style={{ flex:1 }}>
                <Text style={styles.label}>门店名称</Text>
                {isEmployee ? (
                  <Text style={[styles.formInput, { backgroundColor: '#F5F5F5', color: TEXT_SECOND, marginTop:4 }]}>{shopName}</Text>
                ) : (
                  <TextInput style={[styles.formInput, { marginTop:4 }]} value={shopName} onChangeText={setShopName} placeholder="输入门店名称" editable={!isEmployee} />
                )}
              </View>
            </View>
          </View>
          <View style={styles.settingGroup}>
            <View style={[styles.settingItem, { borderBottomWidth: 0 }]}>
              <Ionicons name="call-outline" size={20} color={TEXT_SECOND} style={{ marginRight: 12 }} />
              <View style={{ flex:1 }}>
                <Text style={styles.label}>绑定手机号</Text>
                {isEmployee ? (
                  <Text style={[styles.formInput, { backgroundColor: '#F5F5F5', color: TEXT_SECOND, marginTop:4 }]}>{phone}</Text>
                ) : (
                  <TextInput style={[styles.formInput, { marginTop:4 }]} value={phone} onChangeText={setPhone} placeholder="输入手机号" keyboardType="phone-pad" editable={!isEmployee} />
                )}
              </View>
            </View>
          </View>
          {!isEmployee && (
            <TouchableOpacity style={[styles.primaryBtn, { marginTop:8, height:40 }]} onPress={saveShop}>
              <Text style={styles.sendTxt}>保存信息</Text>
            </TouchableOpacity>
          )}
          <View style={styles.settingGroup}>
            <TouchableOpacity style={styles.settingItem} onPress={handleSwitchAccount}>
              <Ionicons name="person-outline" size={20} color={TEXT_SECOND} style={{ marginRight: 12 }} />
              <Text style={{ color:TEXT_MAIN }}>切换账号</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.settingItem, styles.settingItemLast]} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={20} color={DANGER_COLOR} style={{ marginRight: 12 }} />
              <Text style={{ color:DANGER_COLOR }}>退出登录</Text>
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
      const shopInfo = { shopName: account.shopName, phone: account.phone, industry: detectIndustry(account.shopName) };
      dispatch({ type: 'LOGIN', payload: { user, shopInfo } });
      await AsyncStorage.setItem('user', JSON.stringify(user));
      await AsyncStorage.setItem('shopInfo', JSON.stringify(shopInfo));
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
// ===== 第一段结束 =====// ================== 订单核销 ==================
const VerifyOrder = () => {
  const navigation = useNavigation();
  const { state, dispatch } = useApp();
  const [orderCode, setOrderCode] = useState('');
  const [platform, setPlatform] = useState('美团');
  const [couponPrice, setCouponPrice] = useState('');

  const handleVerify = () => {
    try {
      if (!orderCode.trim()) { showToast('请输入核销码'); return; }
      const price = parseFloat(couponPrice);
      if (isNaN(price) || price <= 0) { showToast('请输入有效金额'); return; }
      const record = { id: Date.now().toString(), code: orderCode.trim(), platform, couponPrice: price, time: new Date().toISOString() };
      dispatch({ type: 'ADD_ORDER_RECORD', payload: record });
      showToast(`核销成功！${platform} ¥${price}`);
      setOrderCode('');
      setCouponPrice('');
    } catch (error) {
      showToast('核销失败');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.safeTop} />
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={{ fontSize:20 }}>&lt;</Text></TouchableOpacity>
        <Text style={styles.pageTitle}>订单核销</Text>
        <View style={{ width:24 }} />
      </View>
      <ScrollView style={{ padding:16 }}>
        <View style={styles.cardBox}>
          <Text style={styles.label}>核销码</Text>
          <TextInput style={[styles.formInput, { marginBottom:12 }]} placeholder="输入核销码" value={orderCode} onChangeText={setOrderCode} />
          <Text style={styles.label}>平台</Text>
          <View style={{ flexDirection:'row', gap:12, marginTop:4, marginBottom:12 }}>
            {['美团','抖音','大众点评'].map(p => (
              <TouchableOpacity key={p} style={[styles.tagNormal, platform === p && styles.tagActive]} onPress={() => setPlatform(p)}>
                <Text style={{ color: platform === p ? '#fff' : TEXT_MAIN }}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.label}>金额 (¥)</Text>
          <TextInput style={styles.formInput} placeholder="0.00" keyboardType="decimal-pad" value={couponPrice} onChangeText={setCouponPrice} />
          <TouchableOpacity style={styles.primaryBtn} onPress={handleVerify}><Text style={styles.sendTxt}>确认核销</Text></TouchableOpacity>
        </View>
        <View style={styles.cardBox}>
          <Text style={{ fontSize:16, fontWeight:'600', marginBottom:8 }}>今日已核销</Text>
          {(state.globalOrderRecord || [])
            .filter(item => moment(item.time).format('YYYY-MM-DD') === moment().format('YYYY-MM-DD'))
            .map((item, idx) => (
              <View key={idx} style={styles.listItem}>
                <Text style={{ fontSize:14, color:TEXT_MAIN }}>{item.platform} - ¥{item.couponPrice}</Text>
                <Text style={{ fontSize:12, color:TEXT_THIRD }}>{moment(item.time).format('HH:mm')}</Text>
              </View>
            ))
          }
          {(state.globalOrderRecord || []).filter(item => moment(item.time).format('YYYY-MM-DD') === moment().format('YYYY-MM-DD')).length === 0 && (
            <Text style={{ color:TEXT_THIRD, textAlign:'center', padding:12 }}>今日暂无核销记录</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

// ================== 首页（精简） ==================
const HomePage = () => {
  const navigation = useNavigation();
  const { state, dispatch } = useApp();
  const user = state.user;
  const [settingOpen, setSettingOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();

  if (!user) {
    return (
      <View style={{ flex:1, justifyContent:'center', alignItems:'center' }}>
        <Text>请重新登录</Text>
      </View>
    );
  }

  const globalOrderRecord = state.globalOrderRecord || [];
  const todayStr = moment().format('YYYY-MM-DD');
  const todayOrders = globalOrderRecord.filter(item => moment(item.time).format('YYYY-MM-DD') === todayStr);
  let totalIncome = 0;
  todayOrders.forEach(order => { totalIncome += order.couponPrice || 0; });

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  // 模拟日报数据（为了演示，从订单计算）
  const dailyReport = {
    date: todayStr,
    totalOrder: todayOrders.length,
    income: totalIncome,
    profit: totalIncome * 0.3,
    profitRate: 30,
  };

  const isEmployee = user?.role === '员工';

  const topPadding = insets.top || (Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 32);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG_PAGE }}>
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <SettingDrawer visible={settingOpen} onClose={() => setSettingOpen(false)} />
        <View style={styles.headerBar}>
          <View style={{ width: 40 }} />
          <Text style={styles.homeTitle}>经营宝</Text>
          <TouchableOpacity onPress={() => setSettingOpen(true)}><Ionicons name="settings-outline" size={24} color={TEXT_SECOND} /></TouchableOpacity>
        </View>
        <ScrollView style={{ flex:1, paddingHorizontal:16 }} contentContainerStyle={{ paddingBottom:80 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[PRIMARY_COLOR]} />}>
          <View style={styles.cardBox}>
            <Text style={{ fontSize:18, fontWeight:'600', color:TEXT_MAIN, marginBottom:8 }}>👋 欢迎，{user?.name || '商家'}</Text>
            <Text style={{ color:TEXT_SECOND }}>店铺：{(state.shopInfo || {}).shopName || '未设置'}</Text>
            {isEmployee && <Text style={{ color:TEXT_SECOND, marginTop:4 }}>角色：员工</Text>}
          </View>

          <View style={{ flexDirection:'row', flexWrap:'wrap', gap:12, marginTop:16 }}>
            <View style={{ width:(width-44)/2, backgroundColor:BG_CARD, padding:16, borderRadius:14, ...SHADOW }}>
              <Text style={{ fontSize:13, color:TEXT_SECOND }}>今日核销订单</Text>
              <Text style={{ fontSize:22, fontWeight:'700', marginTop:8, color:TEXT_MAIN }}>{todayOrders.length}</Text>
            </View>
            {!isEmployee && (
              <>
                <View style={{ width:(width-44)/2, backgroundColor:BG_CARD, padding:16, borderRadius:14, ...SHADOW }}>
                  <Text style={{ fontSize:13, color:TEXT_SECOND }}>今日总营收</Text>
                  <Text style={{ fontSize:22, fontWeight:'700', marginTop:8, color:PRIMARY_COLOR }}>¥{totalIncome}</Text>
                </View>
              </>
            )}
          </View>

          {!isEmployee && (
            <View style={styles.dailyReportCard}>
              <Text style={styles.reportTitle}>📊 今日经营日报</Text>
              <View style={styles.reportRow}><Text style={styles.reportLabel}>日期</Text><Text style={styles.reportValue}>{dailyReport.date}</Text></View>
              <View style={styles.reportRow}><Text style={styles.reportLabel}>订单数</Text><Text style={styles.reportValue}>{dailyReport.totalOrder}单</Text></View>
              <View style={styles.reportRow}><Text style={styles.reportLabel}>总营收</Text><Text style={styles.reportValue}>¥{dailyReport.income}</Text></View>
              <View style={styles.reportRow}><Text style={styles.reportLabel}>净利润</Text><Text style={styles.reportValue}>¥{dailyReport.profit}</Text></View>
              <View style={styles.reportRow}><Text style={styles.reportLabel}>利润率</Text><Text style={styles.reportValue}>{dailyReport.profitRate}%</Text></View>
            </View>
          )}

          {/* 业务功能菜单 */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop:16 }}>
            <View style={{ flexDirection:'row', gap:12, paddingRight:16 }}>
              <TouchableOpacity onPress={() => navigation.navigate('VerifyOrder')} style={{ width:110, backgroundColor:BG_CARD, paddingVertical:16, borderRadius:12, alignItems:'center', ...SHADOW }}>
                <Text style={{ fontSize:28 }}>🎫</Text>
                <Text style={{ fontSize:13, marginTop:6, color:TEXT_MAIN }}>订单核销</Text>
              </TouchableOpacity>
              {/* 可扩展其他功能 */}
            </View>
          </ScrollView>

          {/* 员工私聊（仅示例） */}
          <View style={{ marginTop:16 }}>
            <Text style={{ fontSize:16, fontWeight:'600', color:TEXT_MAIN, marginBottom:8 }}>员工私聊</Text>
            <View style={styles.listItem}>
              <Text style={{ fontSize:14, color:TEXT_SECOND }}>暂无员工，请先添加</Text>
            </View>
          </View>
        </ScrollView>
      </View>

      {/* 悬浮AI助手（仅商家端） */}
      {!isEmployee && (
        <TouchableOpacity style={{ position:'absolute', bottom:80, right:20, width:56, height:56, borderRadius:28, backgroundColor:PRIMARY_COLOR, justifyContent:'center', alignItems:'center', ...SHADOW, zIndex:999 }} onPress={() => Alert.alert('AI助手', '功能开发中')}>
          <Ionicons name="chatbubble-ellipses" size={28} color="#fff" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};
// ===== 第二段结束 =====// ================== 底部标签导航 ==================
function RootTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'HomeTab') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'VerifyTab') iconName = focused ? 'checkmark-circle' : 'checkmark-circle-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: PRIMARY_COLOR,
        tabBarInactiveTintColor: TEXT_THIRD,
        headerShown: false,
        tabBarStyle: { height: Platform.OS === 'ios' ? 80 : 60, paddingBottom: Platform.OS === 'ios' ? 20 : 8 },
      })}
    >
      <Tab.Screen name="HomeTab" component={HomePage} options={{ title: '首页' }} />
      <Tab.Screen name="VerifyTab" component={VerifyOrder} options={{ title: '核销' }} />
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
        console.warn('初始化加载失败', error);
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
      <View style={{ flex:1, justifyContent:'center', alignItems:'center' }}>
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