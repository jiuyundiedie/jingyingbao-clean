// 极简测试版（仅登录+空首页）
import React, { createContext, useContext, useReducer, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const defaultState = { user: null, shopInfo: {} };
const initialState = JSON.parse(JSON.stringify(defaultState));
function appReducer(state, action) {
  switch (action.type) {
    case 'LOGIN': return { ...state, user: action.payload.user, shopInfo: action.payload.shopInfo };
    default: return state;
  }
}
const AppContext = createContext(null);
const useApp = () => useContext(AppContext);

const LoginScreen = () => {
  const { dispatch } = useApp();
  const navigation = useNavigation();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const handleLogin = async () => {
    if (phone.length !== 11) { Alert.alert('提示', '请输入11位手机号'); return; }
    if (code !== '123456') { Alert.alert('提示', '验证码错误'); return; }
    const user = { phone, name: '老板' };
    dispatch({ type: 'LOGIN', payload: { user, shopInfo: { phone } } });
    await AsyncStorage.setItem('user', JSON.stringify(user));
    navigation.replace('RootTabs');
  };
  return (
    <View style={{ flex:1, justifyContent:'center', padding:20 }}>
      <Text style={{ fontSize:24, marginBottom:20 }}>经营宝(测试)</Text>
      <TextInput style={{ borderWidth:1, padding:10, marginBottom:10 }} placeholder="手机号" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
      <TextInput style={{ borderWidth:1, padding:10, marginBottom:10 }} placeholder="验证码(123456)" keyboardType="numeric" value={code} onChangeText={setCode} />
      <TouchableOpacity style={{ backgroundColor:'#165DFF', padding:15, borderRadius:8 }} onPress={handleLogin}>
        <Text style={{ color:'#fff', textAlign:'center' }}>登录</Text>
      </TouchableOpacity>
    </View>
  );
};

const HomePage = () => {
  const { state } = useApp();
  return (
    <View style={{ flex:1, justifyContent:'center', alignItems:'center' }}>
      <Text style={{ fontSize:24 }}>✅ 登录成功！</Text>
      <Text>欢迎 {state.user?.name}</Text>
    </View>
  );
};

function RootTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="HomeTab" component={HomePage} options={{ title: '首页' }} />
    </Tab.Navigator>
  );
}

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