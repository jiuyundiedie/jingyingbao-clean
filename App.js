import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

const Stack = createNativeStackNavigator();

// ===== 登录页面 =====
const LoginScreen = ({ navigation }) => {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');

  const handleLogin = () => {
    if (phone.length !== 11) {
      Alert.alert('提示', '请输入11位手机号');
      return;
    }
    if (code !== '123456') {
      Alert.alert('提示', '验证码错误');
      return;
    }
    // 登录成功，跳转到首页
    navigation.replace('Home');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>经营宝</Text>
      <Text style={styles.subtitle}>登录您的店铺账号</Text>
      <TextInput
        style={styles.input}
        placeholder="手机号"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />
      <TextInput
        style={styles.input}
        placeholder="验证码 (123456)"
        keyboardType="numeric"
        value={code}
        onChangeText={setCode}
      />
      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>登录</Text>
      </TouchableOpacity>
    </View>
  );
};

// ===== 首页（空白，仅验证跳转） =====
const HomeScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>✅ 首页加载成功</Text>
      <Text>导航和跳转正常</Text>
    </View>
  );
};

// ===== App 根组件 =====
export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#F8FAFF' },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 32 },
  input: { height: 44, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 14, marginBottom: 12, backgroundColor: '#fff' },
  button: { height: 48, backgroundColor: '#165DFF', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});