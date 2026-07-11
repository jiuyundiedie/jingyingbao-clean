import React, { createContext, useContext, useReducer, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput, Alert,
  ActivityIndicator, Platform, StatusBar
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// ===== 工具函数 =====
const showToast = (msg) => {
  Alert.alert('提示', msg);
};

// ===== Reducer =====
const defaultState = {
  user: null,
  shopInfo: { shopName: '', phone: '' },
  previousAccounts: [],
};

const initialState = JSON.parse(JSON.stringify(defaultState));

function appReducer(state, action) {
  switch (action.type) {
    case 'LOGIN':
      return { ...state, user: action.payload.user, shopInfo: action.payload.shopInfo };
    case 'LOGOUT':
      return { ...state, user: null, shopInfo: { shopName: '', phone: '' } };
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
        shopInfo: r.shopInfo || { shopName: '', phone: '' },
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
  container: { flex: 1, backgroundColor: '#F8FAFF', justifyContent: 'center', paddingHorizontal: 24 },
  title: { fontSize: 28, fontWeight: '700', color: '#1D2129', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#4E5969', marginBottom: 32 },
  label: { fontSize: 14, color: '#4E5969', marginTop: 12, marginBottom: 6, fontWeight: '500' },
  input: { height: 44, paddingHorizontal: 14, borderWidth: 1, borderColor: '#E5E6EB', borderRadius: 10, backgroundColor: '#fff', color: '#1D2129' },
  loginBtn: { height: 48, backgroundColor: '#165DFF', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 16 },
  loginBtnText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  homeContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F2F3F5' },
  homeTitle: { fontSize: 24, fontWeight: 'bold', color: '#1D2129' },
  settingGroup: { marginTop: 16, backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden' },
  settingItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#E5E6EB' },
  settingItemLast: { borderBottomWidth: 0 },
  settingText: { fontSize: 16, color: '#1D2129', marginLeft: 12 },
});

// ================== 登录页面（带详细错误显示） ==================
const LoginScreen = () => {
  const { state, dispatch } = useApp();
  const navigation = useNavigation();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
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
      
      // 构建用户对象
      const user = { phone, name: '老板' };
      const shopInfo = { shopName: '我的店铺', phone };
      
      // 存储到 AsyncStorage
      await AsyncStorage.setItem('user', JSON.stringify(user));
      await AsyncStorage.setItem('shopInfo', JSON.stringify(shopInfo));
      
      // 更新 Redux
      dispatch({ type: 'LOGIN', payload: { user, shopInfo } });
      dispatch({ type: 'ADD_PREVIOUS_ACCOUNT', payload: { phone, name: user.name } });
      
      // 跳转
      navigation.replace('RootTabs');
      setLoading(false);
    } catch (error) {
      // 显示详细错误信息
      Alert.alert('登录失败', `错误详情:\n${error.message || String(error)}\n\n堆栈:\n${error.stack || '无堆栈'}`);
      console.error('登录错误:', error);
      setLoading(false);
    }
  };

  const handleHistorySelect = async (account) => {
    try {
      const user = { phone: account.phone, name: account.name || '老板' };
      const shopInfo = { shopName: '我的店铺', phone: account.phone };
      await AsyncStorage.setItem('user', JSON.stringify(user));
      await AsyncStorage.setItem('shopInfo', JSON.stringify(shopInfo));
      dispatch({ type: 'LOGIN', payload: { user, shopInfo } });
      navigation.replace('RootTabs');
    } catch (error) {
      Alert.alert('切换失败', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>经营宝</Text>
      <Text style={styles.subtitle}>登录您的店铺账号</Text>
      {previousAccounts.length > 0 && (
        <View>
          <Text style={styles.label}>历史账号</Text>
          {previousAccounts.map((acc, idx) => (
            <TouchableOpacity key={idx} onPress={() => handleHistorySelect(acc)} style={{ paddingVertical: 8 }}>
              <Text style={{ fontSize: 16 }}>{acc.phone}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <Text style={styles.label}>手机号</Text>
      <TextInput style={[styles.input, { marginBottom: 12 }]} placeholder="请输入手机号" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
      <Text style={styles.label}>验证码</Text>
      <TextInput style={[styles.input, { marginBottom: 16 }]} placeholder="验证码 (123456)" keyboardType="numeric" value={code} onChangeText={setCode} />
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
            <Ionicons name="person-outline" size={20} color="#4E5969" />
            <Text style={styles.settingText}>切换账号</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.settingItem, styles.settingItemLast]} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#F53F3F" />
            <Text style={{ ...styles.settingText, color: '#F53F3F' }}>退出登录</Text>
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
      const user = { phone: account.phone, name: account.name || '老板' };
      const shopInfo = { shopName: '我的店铺', phone: account.phone };
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
  if (currentUser) allAccounts.push({ phone: currentUser.phone, name: currentUser.name, isCurrent: true });
  previousAccounts.forEach(acc => {
    if (!allAccounts.find(a => a.phone === acc.phone)) allAccounts.push({ ...acc, isCurrent: false });
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F3F5', paddingHorizontal: 16, paddingTop: 20 }}>
      <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 16 }}>切换账号</Text>
      {allAccounts.length === 0 ? (
        <Text style={{ textAlign: 'center', marginTop: 30, color: '#86909C' }}>暂无历史账号</Text>
      ) : (
        allAccounts.map((acc, idx) => (
          <TouchableOpacity key={idx} onPress={() => handleSelect(acc)} disabled={acc.isCurrent} style={{ backgroundColor: '#fff', padding: 16, borderRadius: 12, marginVertical: 6 }}>
            <Text style={{ fontSize: 16 }}>{acc.phone}{acc.isCurrent ? ' (当前)' : ''}</Text>
          </TouchableOpacity>
        ))
      )}
      <TouchableOpacity onPress={handleRegister} style={{ marginTop: 20, backgroundColor: '#165DFF', padding: 14, borderRadius: 12, alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontWeight: '600' }}>注册新账号</Text>
      </TouchableOpacity>
    </View>
  );
};

// ================== 首页 ==================
const HomePage = () => {
  const { state } = useApp();
  const [settingOpen, setSettingOpen] = useState(false);
  const user = state.user;

  return (
    <View style={styles.homeContainer}>
      <SettingDrawer visible={settingOpen} onClose={() => setSettingOpen(false)} />
      <Text style={styles.homeTitle}>✅ 登录成功！</Text>
      <Text style={{ marginTop: 8, fontSize: 16 }}>欢迎 {user?.name}</Text>
      <TouchableOpacity
        onPress={() => setSettingOpen(true)}
        style={{ marginTop: 20, backgroundColor: '#165DFF', padding: 10, borderRadius: 8 }}
      >
        <Text style={{ color: '#fff' }}>打开设置</Text>
      </TouchableOpacity>
    </View>
  );
};
// ===== 第二段结束 =====// // ================== 底部标签导航 ==================
const Tab = createBottomTabNavigator();  // 添加这一行
function RootTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="HomeTab" component={HomePage} options={{ title: '首页' }} />
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
        <ActivityIndicator size="large" color="#165DFF" />
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