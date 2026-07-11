import React, { createContext, useContext, useReducer, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput, Alert,
  ActivityIndicator, ScrollView, Dimensions
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// ===== 常量 =====
const { width } = Dimensions.get('window');
const PRIMARY_COLOR = '#165DFF';
const DANGER_COLOR = '#F53F3F';
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

// ===== 工具函数 =====
const showToast = (msg) => {
  Alert.alert('提示', msg);
};

const detectIndustry = (shopName) => {
  const foodKeywords = ['火锅', '烧烤', '奶茶', '咖啡', '面馆', '川菜', '粤菜', '日料', '韩餐', '西餐', '烘焙', '小吃', '餐厅', '饭店', '餐饮', '美食', '快餐', '外卖', '茶饮', '饮品', '糕点', '甜品'];
  for (const kw of foodKeywords) { if (shopName.includes(kw)) return '餐饮类'; }
  return '餐饮类';
};

// ===== Reducer =====
const defaultState = {
  user: null,
  shopInfo: { shopName: '', phone: '', industry: '餐饮类', staffList: [] },
  previousAccounts: [],
  staffMemberList: [],
  globalOrderRecord: [],
  goodsList: [],
  badReviewCount: 0,
  badReviewList: [],
};

const initialState = JSON.parse(JSON.stringify(defaultState));

function appReducer(state, action) {
  switch (action.type) {
    case 'LOGIN':
      return { ...state, user: action.payload.user, shopInfo: action.payload.shopInfo };
    case 'LOGOUT':
      return { ...state, user: null, shopInfo: { shopName: '', phone: '', industry: '餐饮类', staffList: [] } };
    case 'SET_SHOP_CONFIG':
      return { ...state, shopInfo: { ...state.shopInfo, ...action.payload } };
    case 'ADD_ORDER_RECORD':
      return { ...state, globalOrderRecord: [action.payload, ...(state.globalOrderRecord || [])] };
    case 'SET_GOODS_LIST':
      return { ...state, goodsList: action.payload || [] };
    case 'SET_STAFF_LIST':
      return { ...state, staffMemberList: action.payload || [] };
    case 'ADD_STAFF_APPLICATION': {
      const { staff } = action.payload;
      if (state.staffMemberList.find(s => s.phone === staff.phone)) return state;
      return { ...state, staffMemberList: [...state.staffMemberList, { ...staff, status: 'pending' }] };
    }
    case 'APPROVE_STAFF_APPLICATION': {
      const { phone } = action.payload;
      return { ...state, staffMemberList: state.staffMemberList.map(s => s.phone === phone ? { ...s, status: 'approved' } : s) };
    }
    case 'REJECT_STAFF_APPLICATION': {
      const { phone } = action.payload;
      return { ...state, staffMemberList: state.staffMemberList.filter(s => s.phone !== phone) };
    }
    case 'ADD_PREVIOUS_ACCOUNT': {
      const exists = state.previousAccounts.find(a => a.phone === action.payload.phone);
      if (exists) return state;
      return { ...state, previousAccounts: [...state.previousAccounts, action.payload] };
    }
    case 'CLEAR_PREVIOUS_ACCOUNTS':
      return { ...state, previousAccounts: [] };
    case 'RESTORE_ALL_DATA': {
      const r = action.payload || {};
      return {
        ...state,
        previousAccounts: r.previousAccounts || [],
        user: r.user || null,
        shopInfo: r.shopInfo || { shopName: '', phone: '', industry: '餐饮类', staffList: [] },
        staffMemberList: r.staffMemberList || [],
        globalOrderRecord: r.globalOrderRecord || [],
        goodsList: r.goodsList || [],
        badReviewList: r.badReviewList || [],
        badReviewCount: r.badReviewList?.length || 0,
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
      previousAccounts: state.previousAccounts || [],
      user: state.user,
      shopInfo: state.shopInfo,
      staffMemberList: state.staffMemberList || [],
      globalOrderRecord: state.globalOrderRecord || [],
      goodsList: state.goodsList || [],
      badReviewList: state.badReviewList || [],
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
  container: { flex: 1, backgroundColor: BG_PAGE },
  loginContainer: { flex: 1, backgroundColor: '#F8FAFF', justifyContent: 'center', paddingHorizontal: 24 },
  title: { fontSize: 28, fontWeight: '700', color: TEXT_MAIN, marginBottom: 8 },
  subtitle: { fontSize: 16, color: TEXT_SECOND, marginBottom: 32 },
  label: { fontSize: 14, color: TEXT_SECOND, marginTop: 12, marginBottom: 6, fontWeight: '500' },
  input: { height: 44, paddingHorizontal: 14, borderWidth: 1, borderColor: BORDER_COLOR, borderRadius: 10, backgroundColor: '#fff', color: TEXT_MAIN },
  loginBtn: { height: 48, backgroundColor: PRIMARY_COLOR, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 16 },
  loginBtnText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  homeContainer: { flex: 1, backgroundColor: BG_PAGE },
  headerBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: BG_CARD,
    ...SHADOW,
  },
  homeTitle: { fontSize: 20, fontWeight: '700', color: TEXT_MAIN },
  cardBox: { backgroundColor: BG_CARD, padding: 16, borderRadius: 14, ...SHADOW, marginTop: 16 },
  statItem: { width: (width - 44) / 2, backgroundColor: BG_CARD, padding: 16, borderRadius: 14, ...SHADOW },
  statLabel: { fontSize: 13, color: TEXT_SECOND },
  statValue: { fontSize: 22, fontWeight: '700', marginTop: 8, color: TEXT_MAIN },
  listItem: { backgroundColor: BG_CARD, padding: 14, borderRadius: 12, marginVertical: 6, ...SHADOW },
  settingGroup: { marginTop: 16, backgroundColor: BG_CARD, borderRadius: 14, overflow: 'hidden' },
  settingItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR },
  settingItemLast: { borderBottomWidth: 0 },
  settingText: { fontSize: 16, color: TEXT_MAIN, marginLeft: 12 },
  switchAccountContainer: { flex: 1, backgroundColor: BG_PAGE, paddingHorizontal: 16, paddingTop: 20 },
  accountItem: { backgroundColor: BG_CARD, padding: 16, borderRadius: 12, marginVertical: 6 },
  registerBtn: { marginTop: 20, backgroundColor: PRIMARY_COLOR, padding: 14, borderRadius: 12, alignItems: 'center' },
  registerBtnText: { color: '#fff', fontWeight: '600' },
  dailyReportCard: { backgroundColor: BG_CARD, padding: 14, borderRadius: 14, marginTop: 16, ...SHADOW },
  reportTitle: { fontSize: 16, fontWeight: '600', color: TEXT_MAIN, marginBottom: 8 },
  reportRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  reportLabel: { fontSize: 14, color: TEXT_SECOND },
  reportValue: { fontSize: 14, color: TEXT_MAIN, fontWeight: '500' },
  exportBtn: { marginTop: 8, padding: 10, backgroundColor: PRIMARY_COLOR, borderRadius: 8, alignSelf: 'flex-start' },
  exportBtnText: { color: '#fff', fontSize: 14, fontWeight: '500' },
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
      if (role === '员工') {
        if (!employeeName.trim()) { showToast('请输入员工姓名'); setLoading(false); return; }
        if (!shopName.trim()) { showToast('请输入店铺名称'); setLoading(false); return; }
      } else {
        if (!shopName.trim()) { showToast('请输入店铺名称'); setLoading(false); return; }
      }

      const industry = detectIndustry(shopName);
      const user = { role, phone, shopName, name: role === '员工' ? employeeName.trim() : '老板' };
      const shopInfo = { shopName, phone, industry, staffList: [] };

      if (role === '员工') {
        const staff = { id: Date.now().toString(), name: employeeName.trim(), phone, role: '员工', status: 'pending', joinedAt: new Date().toISOString() };
        dispatch({ type: 'ADD_STAFF_APPLICATION', payload: { staff } });
        showToast('入职申请已发送，等待商家审批');
      }

      await AsyncStorage.setItem('user', JSON.stringify(user));
      await AsyncStorage.setItem('shopInfo', JSON.stringify(shopInfo));

      dispatch({ type: 'LOGIN', payload: { user, shopInfo } });
      dispatch({ type: 'SET_SHOP_CONFIG', payload: { shopName, industry } });
      dispatch({ type: 'ADD_PREVIOUS_ACCOUNT', payload: { phone, role, shopName, name: user.name } });

      navigation.replace('RootTabs');
      setLoading(false);
    } catch (error) {
      Alert.alert('登录失败', error.message || String(error));
      console.error('登录错误:', error);
      setLoading(false);
    }
  };

  const handleHistorySelect = async (account) => {
    try {
      const user = { role: account.role, phone: account.phone, shopName: account.shopName, name: account.name || '老板' };
      const shopInfo = { shopName: account.shopName, phone: account.phone, industry: detectIndustry(account.shopName), staffList: [] };
      await AsyncStorage.setItem('user', JSON.stringify(user));
      await AsyncStorage.setItem('shopInfo', JSON.stringify(shopInfo));
      dispatch({ type: 'LOGIN', payload: { user, shopInfo } });
      dispatch({ type: 'SET_SHOP_CONFIG', payload: { shopName: account.shopName, industry: shopInfo.industry } });
      navigation.replace('RootTabs');
    } catch (error) {
      showToast('切换失败');
    }
  };

  return (
    <View style={styles.loginContainer}>
      <Text style={styles.title}>经营宝</Text>
      <Text style={styles.subtitle}>登录您的店铺账号</Text>
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
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 24 }}>
        {['商家','员工'].map(r => (
          <TouchableOpacity key={r} onPress={() => setRole(r)} style={{ flex: 1, paddingVertical: 12, marginHorizontal: 6, borderRadius: 10, borderWidth: 1, borderColor: role === r ? PRIMARY_COLOR : BORDER_COLOR, backgroundColor: role === r ? '#E8F3FF' : 'transparent', alignItems: 'center' }}>
            <Text style={{ fontSize: 16, fontWeight: '500', color: role === r ? PRIMARY_COLOR : TEXT_MAIN }}>{r}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.label}>手机号</Text>
      <TextInput style={[styles.input, { marginBottom: 12 }]} placeholder="请输入手机号" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
      <Text style={styles.label}>验证码</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        <TextInput style={[styles.input, { flex: 1, marginRight: 8 }]} placeholder="验证码" keyboardType="numeric" value={code} onChangeText={setCode} />
        <TouchableOpacity style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#E8F3FF', borderRadius: 8 }}><Text style={{ color: PRIMARY_COLOR }}>获取验证码</Text></TouchableOpacity>
      </View>
      <Text style={styles.label}>店铺名称</Text>
      <TextInput style={[styles.input, { marginBottom: 12 }]} placeholder="请输入店铺名称" value={shopName} onChangeText={setShopName} />
      {role === '员工' && (
        <>
          <Text style={styles.label}>员工姓名</Text>
          <TextInput style={[styles.input, { marginBottom: 12 }]} placeholder="请输入您的姓名" value={employeeName} onChangeText={setEmployeeName} />
        </>
      )}
      <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={loading}>
        <Text style={styles.loginBtnText}>{loading ? '登录中...' : '登录'}</Text>
      </TouchableOpacity>
    </View>
  );
};
// ===== 第一段结束 =====// ================== 设置抽屉 ==================
const SettingDrawer = ({ visible, onClose }) => {
  const navigation = useNavigation();
  const { state, dispatch } = useApp();

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
      <View style={{ width: '70%', height: '100%', backgroundColor: '#fff', padding: 16 }}>
        <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 20 }}>设置</Text>
        <View style={styles.settingGroup}>
          <TouchableOpacity style={styles.settingItem} onPress={handleSwitchAccount}>
            <Ionicons name="person-outline" size={20} color={TEXT_SECOND} />
            <Text style={styles.settingText}>切换账号</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.settingItem, styles.settingItemLast]} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color={DANGER_COLOR} />
            <Text style={{ ...styles.settingText, color: DANGER_COLOR }}>退出登录</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={{ marginTop: 20, alignSelf: 'flex-end' }} onPress={onClose}>
          <Text style={{ fontSize: 18 }}>关闭</Text>
        </TouchableOpacity>
      </View>
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
      const shopInfo = { shopName: account.shopName, phone: account.phone, industry: detectIndustry(account.shopName), staffList: [] };
      await AsyncStorage.setItem('user', JSON.stringify(user));
      await AsyncStorage.setItem('shopInfo', JSON.stringify(shopInfo));
      dispatch({ type: 'LOGIN', payload: { user, shopInfo } });
      dispatch({ type: 'SET_SHOP_CONFIG', payload: { shopName: account.shopName, industry: shopInfo.industry } });
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
      <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 16 }}>切换账号</Text>
      {allAccounts.length === 0 ? (
        <Text style={{ textAlign: 'center', marginTop: 30, color: TEXT_THIRD }}>暂无历史账号</Text>
      ) : (
        allAccounts.map((acc, idx) => (
          <TouchableOpacity key={idx} style={styles.accountItem} onPress={() => handleSelect(acc)} disabled={acc.isCurrent}>
            <Text style={{ fontSize: 16 }}>{acc.phone} - {acc.shopName} ({acc.role}){acc.isCurrent ? ' (当前)' : ''}</Text>
          </TouchableOpacity>
        ))
      )}
      <TouchableOpacity style={styles.registerBtn} onPress={handleRegister}>
        <Text style={styles.registerBtnText}>注册新账号</Text>
      </TouchableOpacity>
    </View>
  );
};

// ================== 首页（完整） ==================
const HomePage = () => {
  const { state } = useApp();
  const [settingOpen, setSettingOpen] = useState(false);
  const user = state.user;
  const shopInfo = state.shopInfo || { shopName: '', phone: '' };
  const isEmployee = user?.role === '员工';

  // 获取今日核销订单数（模拟）
  const todayOrders = (state.globalOrderRecord || []).filter(item => {
    const today = new Date().toISOString().split('T')[0];
    return item.time && item.time.startsWith(today);
  });
  const totalIncome = todayOrders.reduce((sum, order) => sum + (order.couponPrice || 0), 0);
  const goodsCount = (state.goodsList || []).length;
  const badReviewCount = state.badReviewCount || 0;

  // 员工私聊列表（商家端显示所有已批准员工，员工端显示商家）
  let chatStaffList = [];
  if (isEmployee) {
    const bossPhone = shopInfo.phone || '';
    if (bossPhone) chatStaffList = [{ id: 'boss', name: '商家', phone: bossPhone }];
  } else {
    chatStaffList = (state.staffMemberList || []).filter(s => s.status === 'approved' && s.phone !== user?.phone);
  }

  // 待审批入职申请
  const pendingStaff = (state.staffMemberList || []).filter(s => s.status === 'pending');

  return (
    <View style={styles.homeContainer}>
      <SettingDrawer visible={settingOpen} onClose={() => setSettingOpen(false)} />
      <View style={styles.headerBar}>
        <View style={{ width: 40 }} />
        <Text style={styles.homeTitle}>经营宝</Text>
        <TouchableOpacity onPress={() => setSettingOpen(true)}>
          <Ionicons name="settings-outline" size={24} color={TEXT_SECOND} />
        </TouchableOpacity>
      </View>
      <ScrollView style={{ flex: 1, paddingHorizontal: 16 }} contentContainerStyle={{ paddingBottom: 80 }}>
        {/* 欢迎卡片 */}
        <View style={styles.cardBox}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: TEXT_MAIN, marginBottom: 8 }}>
            👋 欢迎，{user?.name || '商家'}
          </Text>
          <Text style={{ color: TEXT_SECOND }}>店铺：{shopInfo.shopName || '未设置'}</Text>
          <Text style={{ color: TEXT_SECOND, marginTop: 4 }}>手机号：{shopInfo.phone || '未绑定'}</Text>
          {isEmployee && <Text style={{ color: TEXT_SECOND, marginTop: 4 }}>角色：员工</Text>}
        </View>

        {/* 核心数据卡片 */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>今日核销订单</Text>
            <Text style={styles.statValue}>{todayOrders.length}</Text>
          </View>
          {!isEmployee && (
            <>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>今日总营收</Text>
                <Text style={[styles.statValue, { color: PRIMARY_COLOR }]}>¥{totalIncome}</Text>
              </View>
              <TouchableOpacity style={styles.statItem} onPress={() => {}}>
                <Text style={styles.statLabel}>差评预警</Text>
                <Text style={[styles.statValue, { color: badReviewCount > 0 ? DANGER_COLOR : TEXT_MAIN }]}>
                  {badReviewCount}
                  {badReviewCount > 0 && <Text style={{ fontSize: 14, color: PRIMARY_COLOR, marginLeft: 8 }}>点击查看 →</Text>}
                </Text>
              </TouchableOpacity>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>总商品数</Text>
                <Text style={styles.statValue}>{goodsCount}</Text>
              </View>
            </>
          )}
        </View>

        {/* 日报预览（仅商家端） */}
        {!isEmployee && (
          <View style={styles.dailyReportCard}>
            <Text style={styles.reportTitle}>📊 今日经营日报</Text>
            <View style={styles.reportRow}><Text style={styles.reportLabel}>订单数</Text><Text style={styles.reportValue}>{todayOrders.length}单</Text></View>
            <View style={styles.reportRow}><Text style={styles.reportLabel}>总营收</Text><Text style={styles.reportValue}>¥{totalIncome}</Text></View>
            <View style={styles.reportRow}><Text style={styles.reportLabel}>净利润</Text><Text style={styles.reportValue}>¥{totalIncome * 0.3}</Text></View>
            <View style={styles.reportRow}><Text style={styles.reportLabel}>利润率</Text><Text style={styles.reportValue}>30%</Text></View>
            <TouchableOpacity style={styles.exportBtn}><Text style={styles.exportBtnText}>📤 导出CSV</Text></TouchableOpacity>
          </View>
        )}

        {/* 业务功能菜单 */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 16 }}>
          <View style={{ flexDirection: 'row', gap: 12, paddingRight: 16 }}>
            <TouchableOpacity style={{ width: 110, backgroundColor: BG_CARD, paddingVertical: 16, borderRadius: 12, alignItems: 'center', ...SHADOW }}>
              <Text style={{ fontSize: 28 }}>🎫</Text>
              <Text style={{ fontSize: 13, marginTop: 6, color: TEXT_MAIN }}>订单核销</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ width: 110, backgroundColor: BG_CARD, paddingVertical: 16, borderRadius: 12, alignItems: 'center', ...SHADOW }}>
              <Text style={{ fontSize: 28 }}>📦</Text>
              <Text style={{ fontSize: 13, marginTop: 6, color: TEXT_MAIN }}>出入库</Text>
            </TouchableOpacity>
            {!isEmployee && (
              <>
                <TouchableOpacity style={{ width: 110, backgroundColor: BG_CARD, paddingVertical: 16, borderRadius: 12, alignItems: 'center', ...SHADOW }}>
                  <Text style={{ fontSize: 28 }}>👥</Text>
                  <Text style={{ fontSize: 13, marginTop: 6, color: TEXT_MAIN }}>员工管理</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ width: 110, backgroundColor: BG_CARD, paddingVertical: 16, borderRadius: 12, alignItems: 'center', ...SHADOW }}>
                  <Text style={{ fontSize: 28 }}>💬</Text>
                  <Text style={{ fontSize: 13, marginTop: 6, color: TEXT_MAIN }}>顾客客服</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={{ width: 110, backgroundColor: BG_CARD, paddingVertical: 16, borderRadius: 12, alignItems: 'center', ...SHADOW }}>
              <Text style={{ fontSize: 28 }}>🤝</Text>
              <Text style={{ fontSize: 13, marginTop: 6, color: TEXT_MAIN }}>内部沟通</Text>
            </TouchableOpacity>
            {!isEmployee && (
              <TouchableOpacity style={{ width: 110, backgroundColor: BG_CARD, paddingVertical: 16, borderRadius: 12, alignItems: 'center', ...SHADOW }}>
                <Text style={{ fontSize: 28 }}>🤖</Text>
                <Text style={{ fontSize: 13, marginTop: 6, color: TEXT_MAIN }}>AI助手</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>

        {/* 员工私聊 */}
        {chatStaffList.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: TEXT_MAIN, marginBottom: 8 }}>{isEmployee ? '联系商家' : '员工私聊'}</Text>
            {chatStaffList.map(staff => (
              <TouchableOpacity key={staff.id} style={[styles.listItem, { flexDirection: 'row', alignItems: 'center' }]}>
                <Text style={{ fontSize: 16, color: TEXT_MAIN }}>👤 {staff.name}</Text>
                <Text style={{ fontSize: 14, color: TEXT_SECOND, marginLeft: 8 }}>({staff.phone})</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* 入职申请（商家端） */}
        {!isEmployee && pendingStaff.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: TEXT_MAIN, marginBottom: 8 }}>📩 入职申请</Text>
            {pendingStaff.map(staff => (
              <View key={staff.id} style={[styles.listItem]}>
                <Text style={{ fontSize: 16, color: TEXT_MAIN }}>{staff.name} ({staff.phone})</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                  <TouchableOpacity style={{ paddingHorizontal: 14, paddingVertical: 6, backgroundColor: SUCCESS_COLOR, borderRadius: 6 }}><Text style={{ color: '#fff' }}>同意</Text></TouchableOpacity>
                  <TouchableOpacity style={{ paddingHorizontal: 14, paddingVertical: 6, backgroundColor: DANGER_COLOR, borderRadius: 6 }}><Text style={{ color: '#fff' }}>拒绝</Text></TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* 悬浮AI助手（仅商家端） */}
      {!isEmployee && (
        <TouchableOpacity style={{ position: 'absolute', bottom: 80, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: PRIMARY_COLOR, justifyContent: 'center', alignItems: 'center', ...SHADOW, zIndex: 999 }}>
          <Ionicons name="chatbubble-ellipses" size={28} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
};
// ===== 第二段结束 =====// ================== 底部标签导航 ==================
const Tab = createBottomTabNavigator();
function RootTabs() {
  const { state } = useApp();
  const isEmployee = state.user?.role === '员工';
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'HomeTab') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'VerifyTab') iconName = focused ? 'checkmark-circle' : 'checkmark-circle-outline';
          else if (route.name === 'InternalTab') iconName = focused ? 'people' : 'people-outline';
          else if (route.name === 'AITab') iconName = focused ? 'bulb' : 'bulb-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: PRIMARY_COLOR,
        tabBarInactiveTintColor: TEXT_THIRD,
        headerShown: false,
        tabBarStyle: { height: Platform.OS === 'ios' ? 80 : 60, paddingBottom: Platform.OS === 'ios' ? 20 : 8 },
      })}
    >
      <Tab.Screen name="HomeTab" component={HomePage} options={{ title: '首页' }} />
      <Tab.Screen name="VerifyTab" component={VerifyOrderPlaceholder} options={{ title: '核销' }} />
      <Tab.Screen name="InternalTab" component={InternalChatPlaceholder} options={{ title: '内部' }} />
      {!isEmployee && <Tab.Screen name="AITab" component={AIPlaceholder} options={{ title: 'AI助手' }} />}
    </Tab.Navigator>
  );
}

// 占位组件（后续替换为真实页面）
const VerifyOrderPlaceholder = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Text>订单核销页面（即将上线）</Text>
  </View>
);
const InternalChatPlaceholder = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Text>内部沟通页面（即将上线）</Text>
  </View>
);
const AIPlaceholder = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Text>AI助手页面（即将上线）</Text>
  </View>
);

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