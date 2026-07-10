import React, { createContext, useContext, useReducer, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput, Alert, ActivityIndicator, Platform, StatusBar
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

const { width, height } = Dimensions.get('window');
const PRIMARY_COLOR = '#165DFF';
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
  shopInfo: { shopName: '', phone: '' },
};

const initialState = JSON.parse(JSON.stringify(defaultState));

function appReducer(state, action) {
  switch (action.type) {
    case 'LOGIN': return { ...state, user: action.payload.user, shopInfo: action.payload.shopInfo };
    case 'LOGOUT': return { ...state, user: null, shopInfo: { shopName: '', phone: '' } };
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
const saveUser = async (user, shopInfo) => {
  try {
    await AsyncStorage.setItem('user', JSON.stringify(user));
    await AsyncStorage.setItem('shopInfo', JSON.stringify(shopInfo));
  } catch (error) {
    console.warn('保存失败', error);
  }
};

const loadUser = async () => {
  try {
    const userStr = await AsyncStorage.getItem('user');
    const shopStr = await AsyncStorage.getItem('shopInfo');
    if (userStr && shopStr) {
      return { user: JSON.parse(userStr), shopInfo: JSON.parse(shopStr) };
    }
    return null;
  } catch (error) {
    return null;
  }
};

const clearUser = async () => {
  await AsyncStorage.removeItem('user');
  await AsyncStorage.removeItem('shopInfo');
};

// ===== 样式 =====
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, backgroundColor: '#F8FAFF' },
  title: { fontSize: 28, fontWeight: '700', color: TEXT_MAIN, marginBottom: 8 },
  subtitle: { fontSize: 16, color: TEXT_SECOND, marginBottom: 32 },
  label: { fontSize: 14, color: TEXT_SECOND, marginTop: 12, marginBottom: 6, fontWeight: '500' },
  input: { height: 44, paddingHorizontal: 14, borderWidth: 1, borderColor: BORDER_COLOR, borderRadius: 10, backgroundColor: BG_CARD, color: TEXT_MAIN },
  loginBtn: { height: 48, backgroundColor: PRIMARY_COLOR, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 16, ...SHADOW },
  loginBtnText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  homeContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BG_PAGE },
  homeText: { fontSize: 24, fontWeight: 'bold', color: TEXT_MAIN },
});

// ================== 登录页面 ==================
const LoginScreen = () => {
  const { state, dispatch } = useApp();
  const navigation = useNavigation();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');

  useEffect(() => {
    if (state.user) {
      Alert.alert('调试', '已有用户，自动跳转');
      navigation.replace('RootTabs');
    }
  }, [state.user]);

  const handleLogin = async () => {
    try {
      Alert.alert('调试', '登录按钮点击');
      if (phone.length !== 11) { showToast('请输入11位手机号'); return; }
      if (code !== '123456') { showToast('验证码错误'); return; }
      Alert.alert('调试', '验证通过');
      const user = { phone, name: '老板' };
      const shopInfo = { shopName: '测试店铺', phone };
      dispatch({ type: 'LOGIN', payload: { user, shopInfo } });
      Alert.alert('调试', 'dispatch完成');
      await saveUser(user, shopInfo);
      Alert.alert('调试', '存储完成，即将跳转');
      navigation.replace('RootTabs');
      Alert.alert('调试', '跳转命令已执行');
    } catch (error) {
      Alert.alert('登录失败', error.message || String(error));
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>经营宝</Text>
      <Text style={styles.subtitle}>登录您的店铺账号</Text>
      <Text style={styles.label}>手机号</Text>
      <TextInput style={[styles.input, { marginBottom: 12 }]} placeholder="请输入手机号" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
      <Text style={styles.label}>验证码</Text>
      <TextInput style={styles.input} placeholder="验证码(123456)" keyboardType="numeric" value={code} onChangeText={setCode} />
      <TouchableOpacity style={styles.loginBtn} onPress={handleLogin}>
        <Text style={styles.loginBtnText}>登录</Text>
      </TouchableOpacity>
    </View>
  );
};

// ================== 空白首页 ==================
const HomePage = () => {
  const { state } = useApp();
  return (
    <View style={styles.homeContainer}>
      <Text style={styles.homeText}>✅ 登录成功！</Text>
      <Text>欢迎 {state.user?.name}</Text>
    </View>
  );
};

// ================== 底部标签导航（只有一个首页） ==================
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
        const data = await loadUser();
        if (data) {
          dispatch({ type: 'LOGIN', payload: data });
        }
      } catch (error) {
        console.warn('加载失败', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

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
// ===== 第一段结束 =====