// ===== 第一批：首页骨架 + 核心导航（不含复杂数据逻辑） =====
import React, { createContext, useContext, useReducer, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, Alert,
  ActivityIndicator, Dimensions, Platform, SafeAreaView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets, SafeAreaProvider } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const PRIMARY_COLOR = '#165DFF';
const BG_PAGE = '#F2F3F5';
const BG_CARD = '#FFFFFF';
const TEXT_MAIN = '#1D2129';
const TEXT_SECOND = '#4E5969';
const TEXT_THIRD = '#86909C';
const SHADOW = { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 };

// 状态管理（简化版，仅保留登录和基本数据）
const defaultState = { user: null, shopInfo: { shopName: '' } };
const initialState = JSON.parse(JSON.stringify(defaultState));
function appReducer(state, action) {
  switch (action.type) {
    case 'LOGIN': return { ...state, user: action.payload.user, shopInfo: action.payload.shopInfo };
    default: return state;
  }
}
const AppContext = createContext(null);
const useApp = () => useContext(AppContext);

// ================== 登录页 ==================
const LoginScreen = () => {
  const { dispatch } = useApp();
  const navigation = useNavigation();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [shopName, setShopName] = useState('测试店铺');

  const handleLogin = async () => {
    try {
      if (phone.length !== 11) { Alert.alert('提示', '请输入11位手机号'); return; }
      if (code !== '123456') { Alert.alert('提示', '验证码错误'); return; }
      const user = { phone, name: '老板', role: '商家', shopName };
      const shopInfo = { shopName, phone };
      dispatch({ type: 'LOGIN', payload: { user, shopInfo } });
      await AsyncStorage.setItem('user', JSON.stringify(user));
      await AsyncStorage.setItem('shopInfo', JSON.stringify(shopInfo));
      navigation.replace('RootTabs');
    } catch (error) {
      Alert.alert('错误', '登录失败，请重试');
    }
  };

  return (
    <View style={{ flex:1, justifyContent:'center', padding:20 }}>
      <Text style={{ fontSize:24, fontWeight:'bold', marginBottom:20 }}>经营宝</Text>
      <TextInput style={{ borderWidth:1, padding:10, marginBottom:10 }} placeholder="手机号" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
      <TextInput style={{ borderWidth:1, padding:10, marginBottom:10 }} placeholder="验证码(123456)" keyboardType="numeric" value={code} onChangeText={setCode} />
      <TextInput style={{ borderWidth:1, padding:10, marginBottom:10 }} placeholder="店铺名称" value={shopName} onChangeText={setShopName} />
      <TouchableOpacity style={{ backgroundColor:PRIMARY_COLOR, padding:15, borderRadius:8 }} onPress={handleLogin}>
        <Text style={{ color:'#fff', textAlign:'center' }}>登录</Text>
      </TouchableOpacity>
    </View>
  );
};

// ================== 样式 ==================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_PAGE },
  headerBar: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, backgroundColor: BG_CARD, ...SHADOW },
  homeTitle: { fontSize: 20, fontWeight: '700', color: TEXT_MAIN },
  cardBox: { backgroundColor: BG_CARD, padding: 16, borderRadius: 14, marginHorizontal: 16, marginTop: 16, ...SHADOW },
  reportCard: { backgroundColor: BG_CARD, padding: 14, borderRadius: 14, marginTop: 16, marginHorizontal: 16, ...SHADOW },
  reportTitle: { fontSize: 16, fontWeight: '600', color: TEXT_MAIN, marginBottom: 8 },
  reportRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  reportLabel: { fontSize: 14, color: TEXT_SECOND },
  reportValue: { fontSize: 14, color: TEXT_MAIN, fontWeight: '500' },
  menuItem: { width: 110, backgroundColor: BG_CARD, paddingVertical: 16, borderRadius: 12, alignItems: 'center', ...SHADOW },
  menuIcon: { fontSize: 28 },
  menuLabel: { fontSize: 13, marginTop: 6, color: TEXT_MAIN },
});

// ================== 首页 ==================
const HomePage = () => {
  const { state } = useApp();
  const insets = useSafeAreaInsets();
  const topPadding = insets.top || (Platform.OS === 'ios' ? 44 : 0);

  // 菜单数据
  const menuList = [
    { icon: "🎫", label: "订单核销", key: 'Verify' },
    { icon: "📦", label: "出入库", key: 'Stock' },
    { icon: "👥", label: "员工管理", key: 'Staff' },
    { icon: "💬", label: "顾客客服", key: 'Customer' },
    { icon: "🤝", label: "内部沟通", key: 'Internal' },
    { icon: "🤖", label: "AI助手", key: 'AI' },
    { icon: "📊", label: "商品总览", key: 'Product' },
  ];

  // 日报数据（静态占位）
  const dailyReport = { date: '2024-01-01', totalOrder: 5, income: 1200, profit: 300, profitRate: '25%' };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG_PAGE }}>
      <View style={[styles.container, { paddingTop: topPadding }]}>
        {/* 顶部栏 */}
        <View style={styles.headerBar}>
          <View style={{ width: 40 }} />
          <Text style={styles.homeTitle}>经营宝</Text>
          <TouchableOpacity onPress={() => Alert.alert('设置', '设置功能开发中')}>
            <Ionicons name="settings-outline" size={24} color={TEXT_SECOND} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* 欢迎卡片 */}
          <View style={styles.cardBox}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: TEXT_MAIN, marginBottom: 8 }}>
              👋 欢迎，{state.user?.name || '商家'}
            </Text>
            <Text style={{ color: TEXT_SECOND }}>店铺：{state.shopInfo?.shopName || '未设置'}</Text>
          </View>

          {/* 日报卡片 */}
          <View style={styles.reportCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.reportTitle}>📊 经营日报</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {['日报', '周报', '月报'].map(label => (
                  <TouchableOpacity key={label} style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16, backgroundColor: label === '日报' ? PRIMARY_COLOR : '#E8F3FF' }}>
                    <Text style={{ color: label === '日报' ? '#fff' : TEXT_MAIN, fontSize: 12 }}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.reportRow}><Text style={styles.reportLabel}>日期</Text><Text style={styles.reportValue}>{dailyReport.date}</Text></View>
            <View style={styles.reportRow}><Text style={styles.reportLabel}>订单数</Text><Text style={styles.reportValue}>{dailyReport.totalOrder}单</Text></View>
            <View style={styles.reportRow}><Text style={styles.reportLabel}>总营收</Text><Text style={styles.reportValue}>¥{dailyReport.income}</Text></View>
            <View style={styles.reportRow}><Text style={styles.reportLabel}>净利润</Text><Text style={styles.reportValue}>¥{dailyReport.profit}</Text></View>
            <View style={styles.reportRow}><Text style={styles.reportLabel}>利润率</Text><Text style={styles.reportValue}>{dailyReport.profitRate}</Text></View>
          </View>

          {/* 业务菜单 */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 16, paddingHorizontal: 16 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {menuList.map((item, idx) => (
                <TouchableOpacity key={idx} style={styles.menuItem} onPress={() => Alert.alert(item.label, '功能开发中')}>
                  <Text style={styles.menuIcon}>{item.icon}</Text>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </ScrollView>
      </View>

      {/* 悬浮AI助手按钮 */}
      <TouchableOpacity
        style={{
          position: 'absolute',
          bottom: 80,
          right: 20,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: PRIMARY_COLOR,
          justifyContent: 'center',
          alignItems: 'center',
          ...SHADOW,
          zIndex: 999,
        }}
        onPress={() => Alert.alert('AI助手', '功能开发中')}
      >
        <Ionicons name="chatbubble-ellipses" size={28} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

// ================== 占位页面（用于底部标签） ==================
const PlaceholderPage = ({ title }) => (
  <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Text style={{ fontSize: 18, color: TEXT_SECOND }}>{title} - 开发中</Text>
  </SafeAreaView>
);

// ================== 底部标签导航 ==================
function RootTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'HomeTab') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'VerifyTab') iconName = focused ? 'checkmark-circle' : 'checkmark-circle-outline';
          else if (route.name === 'StockTab') iconName = focused ? 'cube' : 'cube-outline';
          else if (route.name === 'InternalTab') iconName = focused ? 'people' : 'people-outline';
          else if (route.name === 'AITab') iconName = focused ? 'bulb' : 'bulb-outline';
          else if (route.name === 'CustomerTab') iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: PRIMARY_COLOR,
        tabBarInactiveTintColor: TEXT_THIRD,
        headerShown: false,
        tabBarStyle: { height: Platform.OS === 'ios' ? 80 : 60, paddingBottom: Platform.OS === 'ios' ? 20 : 8 },
      })}
    >
      <Tab.Screen name="HomeTab" component={HomePage} options={{ title: '首页' }} />
      <Tab.Screen name="VerifyTab" children={() => <PlaceholderPage title="订单核销" />} options={{ title: '核销' }} />
      <Tab.Screen name="CustomerTab" children={() => <PlaceholderPage title="顾客客服" />} options={{ title: '客服' }} />
      <Tab.Screen name="StockTab" children={() => <PlaceholderPage title="出入库" />} options={{ title: '出入库' }} />
      <Tab.Screen name="InternalTab" children={() => <PlaceholderPage title="内部沟通" />} options={{ title: '内部' }} />
      <Tab.Screen name="AITab" children={() => <PlaceholderPage title="AI助手" />} options={{ title: 'AI助手' }} />
    </Tab.Navigator>
  );
}

// ================== 导航 ==================
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="RootTabs" component={RootTabs} />
    </Stack.Navigator>
  );
}

// ================== App ==================
export default function App() {
  const [state, dispatch] = useReducer(appReducer, initialState);
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