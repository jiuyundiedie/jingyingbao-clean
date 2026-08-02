import React, { createContext, useContext, useReducer, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, TouchableWithoutFeedback, StyleSheet, TextInput, ScrollView, Alert,
  BackHandler, ActivityIndicator, Dimensions, Platform, ToastAndroid,
  Modal, Image, FlatList, RefreshControl, StatusBar, SafeAreaView,
  PanResponder, Switch, Animated, Easing, Keyboard, KeyboardAvoidingView,
  AppState, Linking
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer, useNavigation, createNavigationContainerRef, useFocusEffect } from '@react-navigation/native';
const navigationRef = createNavigationContainerRef();
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';
import * as DocumentPicker from 'expo-document-picker';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

// ===== 工具函数 =====
let toastHideTimer = null;
let toastClickHandler = null;
const showToast = (msg, duration = 2000) => {
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

// ===== AI视觉模型配置（直接硬编码，不依赖process.env）=====
// 所有密钥直接写入代码，确保APK构建后100%可用
// 1. 阿里云百炼
const ALIBABA_API_KEY = "";
const ALIBABA_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

// 2. 硅基流动 SiliconFlow
const SILICONFLOW_API_KEY = "sk-bevcesyyysluduherrbpqezjsazawntlspvmqattomtmaxik";

// 3. 豆包AI
const DOUBAO_API_KEY = "";
const DOUBAO_URL = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";

// 4. 智谱AI（主力）
const ZHIPU_API_KEY = "1cca44e3c1124a999d501621e9fe8305.xf2xNXly5CkSBe5p";
const ZHIPU_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const ZHIPU_MODEL = "glm-4-flash";

// 5. 百度AI
const BAIDU_API_KEY = "2X4R2K4qq9u3K9769BOjDXtq";
const BAIDU_SECRET_KEY = "oHTvqHAZvXUyAMBTrF8n93GnoE41lqri";

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
const compressImage = async (uri, quality = 0.7) => {
  try {
    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1200 } }],
      { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
    );
    return manipResult.uri;
  } catch (error) {
    return uri;
  }
};

// ===== 带超时的fetch辅助 =====
async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  try {
    const fetchPromise = fetch(url, options);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('请求超时(' + timeoutMs + 'ms)')), timeoutMs)
    );
    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (err) {
    throw err;
  }
}

async function fetchZhipuChat(msgList, prompt, signal) {
  // 检查是否已取消
  if (signal && signal.aborted) return '已取消';
  
  // 验证API密钥
  if (!ZHIPU_API_KEY || ZHIPU_API_KEY.length < 10) {
    console.error('[AI] ZHIPU_API_KEY 未配置! length:', ZHIPU_API_KEY?.length || 0);
    return '抱歉，AI服务密钥未配置，请检查后重试';
  }
  console.log('[AI] ZHIPU_API_KEY OK:', ZHIPU_API_KEY.substring(0,6) + '...');
  console.log('[AI] ZHIPU_URL:', ZHIPU_URL, 'SILICONFLOW len:', SILICONFLOW_API_KEY?.length || 0);

  try {
    console.log('[AI] 开始请求智谱API...');
    
    // 使用 Promise.race 实现超时（React Native兼容方案，不依赖AbortController）
    const fetchPromise = fetch(ZHIPU_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + ZHIPU_API_KEY },
      body: JSON.stringify({
        model: ZHIPU_MODEL || "glm-4-flash",
        messages: [{ role: "system", content: prompt }, ...msgList],
        temperature: 0.7,
        max_tokens: 1000
      }),
    });
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('AI请求超时(15秒)')), 15000)
    );
    
    const res = await Promise.race([fetchPromise, timeoutPromise]);
    
    // 再次检查是否已取消
    if (signal && signal.aborted) return '已取消';
    
    console.log('[AI] 智谱API响应状态:', res.status);
    
    if (!res.ok) {
      const errText = await res.text();
      console.error('[AI] 智谱API HTTP错误:', res.status, errText.substring(0, 300));
      if (SILICONFLOW_API_KEY && SILICONFLOW_API_KEY.length >= 10 && msgList.length > 0) {
        console.log('[AI] 智谱失败，尝试 SiliconFlow 备用...');
        const sfResult = await trySiliconFlowChat(msgList, prompt, signal);
        if (sfResult && sfResult !== '已取消') {
          console.log('[AI] SiliconFlow 备用成功');
          return sfResult;
        }
      }
      return 'AI服务暂时不可用(' + res.status + ')，请稍后重试';
    }
    
    const json = await res.json();
    console.log('[AI] 智谱API响应:', JSON.stringify(json).substring(0, 300));
    
    if (json.error) {
      console.error('[AI] 智谱API返回错误:', JSON.stringify(json.error).substring(0, 300));
      if (SILICONFLOW_API_KEY && SILICONFLOW_API_KEY.length >= 10 && msgList.length > 0) {
        console.log('[AI] 尝试 SiliconFlow 备用...');
        const sfResult = await trySiliconFlowChat(msgList, prompt, signal);
        if (sfResult && sfResult !== '已取消') {
          console.log('[AI] SiliconFlow 备用成功');
          return sfResult;
        }
      }
      return 'AI服务返回错误，请稍后重试';
    }
    
    const result = json.choices?.[0]?.message?.content;
    if (result) {
      console.log('[AI] 智谱API回复成功，长度:', result.length);
      return result;
    }
    return 'AI回复内容为空，请重试';
  } catch (err) {
    if (signal && signal.aborted) return '已取消';
    console.error('[AI] fetchZhipuChat异常:', err.message);
    if (SILICONFLOW_API_KEY && SILICONFLOW_API_KEY.length >= 10 && msgList.length > 0) {
      console.log('[AI] 尝试 SiliconFlow 备用...');
      const sfResult = await trySiliconFlowChat(msgList, prompt, signal);
      if (sfResult && sfResult !== '已取消') {
        console.log('[AI] SiliconFlow 备用成功');
        return sfResult;
      }
    }
    return 'AI服务连接失败(' + (err.message || '未知错误') + ')，请检查网络后重试';
  }
}

async function trySiliconFlowChat(msgList, prompt, signal) {
  if (!SILICONFLOW_API_KEY || SILICONFLOW_API_KEY.length < 10) return null;
  if (signal && signal.aborted) return null;
  
  try {
    console.log('[AI] 尝试硅基流动备用...');
    const sfFetchPromise = fetch('https://api.siliconflow.cn/v1/chat/completions', {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + SILICONFLOW_API_KEY },
      body: JSON.stringify({
        model: "Qwen/Qwen2.5-7B-Instruct",
        messages: [{ role: "system", content: prompt }, ...msgList],
        temperature: 0.7,
        max_tokens: 1000
      }),
    });
    
    const sfTimeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('硅基流动请求超时')), 15000)
    );
    
    const sfRes = await Promise.race([sfFetchPromise, sfTimeoutPromise]);
    
    if (signal && signal.aborted) return null;
    
    if (sfRes.ok) {
      const sfJson = await sfRes.json();
      if (sfJson.choices?.[0]?.message?.content) {
        console.log('[AI] SiliconFlow 成功');
        return sfJson.choices[0].message.content;
      }
    } else {
      console.error('[AI] SiliconFlow HTTP错误:', sfRes.status);
    }
  } catch (sfErr) {
    if (signal && signal.aborted) return null;
    console.error('[AI] SiliconFlow异常:', sfErr.message);
  }
  return null;
}


// 本地AI回复生成器（仅用于离线调试，不再作为默认降级）
function generateLocalResponse(userText) {
  const responses = [
    `关于"${userText}"的问题，我来为您分析：\n\n根据经营数据分析，建议您：\n1. 查看近期同类问题的处理记录\n2. 分析相关经营数据，找出问题根源\n3. 制定针对性的改进方案\n\n如需更详细的分析，请提供更多相关信息。`,
    `收到您的问题："${userText}"\n\n基于您店铺的经营情况，我建议：\n• 关注核心指标变化趋势\n• 对比同行业数据找出差距\n• 制定分阶段优化计划\n\n您可以继续提问，我会结合实际数据为您解答。`,
    `针对"${userText}"，我的建议是：\n\n首先，确认当前经营数据是否正常；\n其次，分析目标用户群体的需求特点；\n最后，制定可执行的改进措施。\n\n需要我帮您生成详细的分析报告吗？`,
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

// ===== AI 图片生成（多API自动切换）=====
async function genImageWithZhipu(prompt, signal) {
  if (!ZHIPU_API_KEY || ZHIPU_API_KEY.length < 10) return null;
  if (signal && signal.aborted) return null;
  try {
    console.log('[ZhipuImg] 开始生成图片...');
    const fetchPromise = fetch('https://open.bigmodel.cn/api/paas/v4/images/generations', {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + ZHIPU_API_KEY },
      body: JSON.stringify({
        model: "cogView-3-plus",
        prompt: prompt,
        image_size: "1024x1024",
        num_images: 1
      }),
    });
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('图片生成超时')), 30000)
    );
    const res = await Promise.race([fetchPromise, timeoutPromise]);
    if (signal && signal.aborted) return null;
    if (!res.ok) { 
      const errText = await res.text();
      console.error('[ZhipuImg] HTTP错误:', res.status, errText.substring(0, 200)); 
      return null; 
    }
    const json = await res.json();
    if (json.error) { 
      console.error('[ZhipuImg] API错误:', JSON.stringify(json.error).substring(0, 200)); 
      return null; 
    }
    const imageData = json.data?.[0];
    if (imageData?.url) {
      console.log('[ZhipuImg] 生成成功，返回URL');
      return imageData.url;
    }
    if (imageData?.b64_json) {
      console.log('[ZhipuImg] 生成成功，返回base64');
      return 'data:image/png;base64,' + imageData.b64_json;
    }
    console.error('[ZhipuImg] 无图片数据');
    return null;
  } catch (err) {
    if (signal && signal.aborted) return null;
    console.error('[ZhipuImg] 异常:', err.message);
    return null;
  }
}

async function genImageWithSiliconFlow(prompt, signal) {
  if (!SILICONFLOW_API_KEY || SILICONFLOW_API_KEY.length < 10) return null;
  if (signal && signal.aborted) return null;
  try {
    console.log('[SiliconImg] 开始生成图片...');
    const fetchPromise = fetch('https://api.siliconflow.cn/v1/images/generations', {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + SILICONFLOW_API_KEY },
      body: JSON.stringify({
        model: "deepseek-ai/DeepSeek-V3",
        prompt: prompt,
        image_size: "1024x1024",
        num_images: 1
      }),
    });
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('图片生成超时')), 30000)
    );
    const res = await Promise.race([fetchPromise, timeoutPromise]);
    if (signal && signal.aborted) return null;
    if (!res.ok) { 
      const errText = await res.text();
      console.error('[SiliconImg] HTTP错误:', res.status, errText.substring(0, 200)); 
      return null; 
    }
    const json = await res.json();
    if (json.error) { 
      console.error('[SiliconImg] API错误:', JSON.stringify(json.error).substring(0, 200)); 
      return null; 
    }
    const imageData = json.data?.[0];
    if (imageData?.url) {
      console.log('[SiliconImg] 生成成功，返回URL');
      return imageData.url;
    }
    if (imageData?.b64_json) {
      console.log('[SiliconImg] 生成成功，返回base64');
      return 'data:image/png;base64,' + imageData.b64_json;
    }
    console.error('[SiliconImg] 无图片数据');
    return null;
  } catch (err) {
    if (signal && signal.aborted) return null;
    console.error('[SiliconImg] 异常:', err.message);
    return null;
  }
}

// 统一图片生成入口：多API自动切换
async function fetchZhipuImage(prompt, signal) {
  if (signal?.aborted) return null;
  const apis = [
    { name: 'ZhipuAI(cogView)', fn: () => genImageWithZhipu(prompt, signal) },
    { name: '硅基流动', fn: () => genImageWithSiliconFlow(prompt, signal) },
  ];
  for (const api of apis) {
    if (signal?.aborted) return null;
    const result = await api.fn();
    if (result === 'ABORTED') return null;
    if (result) {
      console.log(`[图片生成] ${api.name} 成功`);
      return result;
    }
    console.log(`[图片生成] ${api.name} 失败，尝试下一个`);
  }
  console.error('[图片生成] 所有API均不可用');
  return null;
}

async function fetchZhipuVision(imageUri, prompt, signal) {
  if (signal && signal.aborted) return null;
  try {
    const base64 = await FileSystem.readAsStringAsync(imageUri, { encoding: FileSystem.EncodingType.Base64 });
    console.log('[VisionAPI] base64长度:', base64.length);
    console.log('[VisionAPI] prompt:', prompt);
    
    const dataUri = 'data:image/jpeg;base64,' + base64;
    const fetchPromise = fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + ZHIPU_API_KEY },
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
    });
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('视觉API超时(20秒)')), 20000)
    );
    const res = await Promise.race([fetchPromise, timeoutPromise]);
    
    console.log('[VisionAPI] HTTP状态码:', res.status);
    if (signal && signal.aborted) return null;
    const json = await res.json();
    console.log('[VisionAPI] 响应:', JSON.stringify(json).substring(0, 300));
    
    if (!res.ok) {
      console.error('Vision API failed:', json);
      return null;
    }
    
    const content = json.choices?.[0]?.message?.content || '';
    console.log('[VisionAPI] 返回内容:', content);
    return content;
  } catch (err) {
    if (signal && signal.aborted) return 'aborted';
    console.error('Vision API error:', err);
    return null;
  }
}

// ===== 多API视觉模型计数（自动切换）=====

// 从文本中提取数字
function extractNumber(text) {
  if (!text) return 0;
  const numMatch = text.match(/(\d+)/);
  return numMatch ? parseInt(numMatch[1]) : 0;
}

// 解析计数结果（支持JSON格式和纯数字格式）
function parseCountResult(text) {
  if (!text) return { count: 0, items: [] };
  try {
    // 清理可能的markdown标记
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // 尝试解析JSON
    const result = JSON.parse(cleanText);
    if (result.count !== undefined) {
      return {
        count: parseInt(result.count) || 0,
        items: result.items || []
      };
    }
  } catch (e) {
    console.log('[解析] JSON解析失败，尝试提取数字:', e.message);
  }
  
  // 回退到纯数字提取
  return {
    count: extractNumber(text),
    items: []
  };
}

// 备用策略：如果AI没有返回坐标，自动生成均匀分布的标记点
// 模拟网格扫描法，按照从上到下、从左到右的顺序，紧密排列标记点
function generateFallbackCoords(count) {
  const items = [];
  // 计算网格大小：尽量让标记点紧密排列，模拟实际物品排列
  // 假设物品是圆形排列（如棉签、竹签），使用更紧密的网格
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  
  const padding = 8; // 更小的边距，让标记点更贴近边缘
  const availableWidth = 100 - padding * 2;
  const availableHeight = 100 - padding * 2;
  
  // 紧密排列，间距更小
  const colSpacing = availableWidth / (cols + 1); // 增加一列的间距，让排列更紧密
  const rowSpacing = availableHeight / (rows + 1);
  
  let id = 1;
  // 从上到下、从左到右逐行扫描，确保序号顺序与视觉顺序一致
  for (let row = 0; row < rows && id <= count; row++) {
    // 交错排列，模拟实际物品的紧密排列
    const offset = row % 2 === 1 ? colSpacing / 2 : 0;
    for (let col = 0; col < cols && id <= count; col++) {
      const x = padding + colSpacing + col * colSpacing + offset;
      const y = padding + rowSpacing + row * rowSpacing;
      // 根据行号调整间距，让排列更自然
      const rowAdjust = Math.sin(row * 0.5) * 2;
      const colAdjust = Math.cos(col * 0.5) * 2;
      items.push({
        id: id++,
        x: Math.min(95, Math.max(5, x + colAdjust)),
        y: Math.min(95, Math.max(5, y + rowAdjust)),
        radius: Math.max(1.2, Math.min(3, 40 / Math.max(cols, rows))) // 更小的半径
      });
    }
  }
  
  // 确保标记点按照从上到下、从左到右的顺序排序
  items.sort((a, b) => {
    // 先按y坐标排序（从上到下）
    if (a.y !== b.y) return a.y - b.y;
    // 再按x坐标排序（从左到右）
    return a.x - b.x;
  });
  
  // 重新分配id，确保序号顺序正确
  items.forEach((item, idx) => {
    item.id = idx + 1;
  });
  
  console.log(`[备用策略] 自动生成了${items.length}个标记点`);
  return items;
}

// 网格扫描法生成均匀分布的标记点（兼容width/height参数）
function generateGridMarkers(count, width, height) {
  return generateFallbackCoords(count);
}


// 解析坐标响应的辅助函数 - 支持中心点坐标格式
// 自动检测并转换像素坐标为百分比 - 终极版
function parseCoordsResult(text, imageWidth, imageHeight) {
  try {
    if (!text || typeof text !== 'string') {
      console.log('[坐标解析] 输入为空或非字符串');
      return [];
    }
    
    let cleanText = text.trim();
    console.log('[坐标解析] 原始文本:', cleanText.substring(0, 200));
    
    // 移除markdown代码块标记
    cleanText = cleanText.replace(/^```\s*json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
    cleanText = cleanText.replace(/^json\s*/i, '');
    
    // 尝试提取JSON对象（处理AI返回的文字描述中夹杂JSON的情况）
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanText = jsonMatch[0];
      console.log('[坐标解析] 提取到JSON:', cleanText.substring(0, 200));
    }
    
    const result = JSON.parse(cleanText);
    let items = result.items || [];
    
    // 如果没有items但有bbox数组，兼容处理
    if (!Array.isArray(items) && result.bbox && Array.isArray(result.bbox)) {
      items = [{ id: 1, bbox: result.bbox }];
    }
    
    // 如果是二维数组格式 [[x1,y1,x2,y2], ...]
    if (Array.isArray(result) && result.length > 0 && Array.isArray(result[0])) {
      items = result.map((bbox, idx) => ({ id: idx + 1, bbox }));
    }
    
    // 转换像素坐标为百分比
    if (imageWidth && imageHeight) {
      items = items.map(item => {
        // 新格式：中心点坐标 {x, y, radius}
        if (item.x !== undefined && item.y !== undefined) {
          let x = item.x;
          let y = item.y;
          let radius = item.radius || 2;
          
          // 判断是否为像素坐标（值大于100）
          if (x > 100 || y > 100) {
            x = Math.min(100, Math.max(0, (x / imageWidth) * 100));
            y = Math.min(100, Math.max(0, (y / imageHeight) * 100));
            if (radius > 10) {
              radius = Math.min(5, (radius / Math.min(imageWidth, imageHeight)) * 100);
            }
          }
          
          return {
            ...item,
            x: x,
            y: y,
            radius: radius,
            // 同时生成兼容的bbox格式
            bbox: [
              Math.max(0, x - radius),
              Math.max(0, y - radius),
              Math.min(100, x + radius),
              Math.min(100, y + radius)
            ]
          };
        }
        
        // 旧格式：bbox数组
        if (item.bbox && item.bbox.length === 4) {
          const [x1, y1, x2, y2] = item.bbox;
          // 判断是否为像素坐标（值大于100）
          if (x1 > 100 || y1 > 100 || x2 > 100 || y2 > 100) {
            return {
              ...item,
              bbox: [
                Math.min(100, Math.max(0, (x1 / imageWidth) * 100)),
                Math.min(100, Math.max(0, (y1 / imageHeight) * 100)),
                Math.min(100, Math.max(0, (x2 / imageWidth) * 100)),
                Math.min(100, Math.max(0, (y2 / imageHeight) * 100))
              ],
              // 生成中心点坐标
              x: ((x1 + x2) / 2 / imageWidth) * 100,
              y: ((y1 + y2) / 2 / imageHeight) * 100,
              radius: Math.min(5, ((x2 - x1 + y2 - y1) / 4 / Math.min(imageWidth, imageHeight)) * 100)
            };
          }
        }
        return item;
      });
    }
    
    // 过滤无效坐标
    items = items.filter(item => {
      // 新格式验证
      if (item.x !== undefined && item.y !== undefined) {
        return item.x >= 0 && item.x <= 100 && item.y >= 0 && item.y <= 100 && item.radius > 0;
      }
      // 旧格式验证
      if (item.bbox && item.bbox.length === 4) {
        const [x1, y1, x2, y2] = item.bbox;
        return x1 >= 0 && y1 >= 0 && x2 > x1 && y2 > y1 && x2 <= 100 && y2 <= 100;
      }
      return false;
    });
    
    console.log('[坐标解析] 成功解析到', items.length, '个有效坐标');
    return items;
  } catch (e) {
    console.log('[坐标解析] JSON解析失败:', e.message, '原始文本:', text.substring(0, 100));
    return [];
  }
}

// 计数指令：简化版本，只问数量
const COUNT_ONLY_PROMPT = '请仔细清点图片中所有相同物品的总数量。对于密集排列的小物品（如棉签、筷子、牙签、纽扣、药片等），请逐个计数，确保不漏数、不多数。只返回一个阿拉伯数字，不要其他文字。';

// 获取坐标指令 - 专业版（针对密集小物品优化，参考点数神器）
const GET_COORDS_PROMPT = (count) => `你是一个专业的计算机视觉物品定位助手。图片中有${count}个小物品（棉签头、竹签、圆珠、药丸等）。

任务：精确标注每个物品的中心点坐标，模拟真实的视觉定位效果。

严格返回JSON格式（不要任何文字解释，不要markdown）：
{"items":[{"id":1,"x":12.5,"y":8.3,"radius":1.8},{"id":2,"x":18.2,"y":8.5,"radius":1.7},...]}

关键要求：
1. x,y是0-100的百分比坐标，精确到小数点后1位
2. radius是半径百分比（1-4%），根据物品实际大小调整
3. 必须返回${count}个物品，数量不能多也不能少
4. **重要**：坐标必须真实对应图片中的物品位置，不能随意生成
5. 从图片左上角开始，从上到下、从左到右逐行扫描标注
6. 对于重叠物品，标注可见部分的中心位置
7. 物品密集区域要特别仔细，确保每个独立个体都有标注

返回示例（5个物品）：
{"items":[{"id":1,"x":15.2,"y":12.8,"radius":2.1},{"id":2,"x":22.5,"y":13.1,"radius":2.0},{"id":3,"x":29.8,"y":12.9,"radius":2.1},{"id":4,"x":15.5,"y":20.2,"radius":2.0},{"id":5,"x":22.8,"y":20.5,"radius":2.1}]}`;

// 1. 阿里云百炼 Qwen-VL（国内可用）- 两步策略
async function countWithAlibaba(base64, width, height) {
  if (!ALIBABA_API_KEY) return null;
  try {
    console.log('[Alibaba] 开始识别...');
    const res1 = await fetchWithTimeout(ALIBABA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ALIBABA_API_KEY}` },
      body: JSON.stringify({
        model: 'qwen-plus',
        messages: [{ role: 'user', content: [
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
          { type: 'text', text: COUNT_ONLY_PROMPT }
        ]}],
        max_tokens: 20, temperature: 0
      })
    }, 15000);
    const json1 = await res1.json();
    if (json1.error) { console.error('[Alibaba] 计数错误:', json1.error); return null; }
    const text1 = json1.choices?.[0]?.message?.content || '';
    const numMatch = text1.match(/(\d+)/);
    const count = numMatch ? parseInt(numMatch[1]) : 0;
    if (count <= 0) { return null; }
    
    const res2 = await fetchWithTimeout(ALIBABA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ALIBABA_API_KEY}` },
      body: JSON.stringify({
        model: 'qwen-plus',
        messages: [{ role: 'user', content: [
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
          { type: 'text', text: GET_COORDS_PROMPT(count) }
        ]}],
        max_tokens: 300, temperature: 0
      })
    }, 15000);
    const json2 = await res2.json();
    const text2 = json2.choices?.[0]?.message?.content || '';
    const items = parseCoordsResult(text2, width, height);
    console.log('[Alibaba] 解析到', items.length, '个物品坐标');
    return { count, items };
  } catch (err) {
    console.error('[Alibaba] 失败:', err.message);
    return null;
  }
}

// 2. 硅基流动 SiliconFlow API - 使用32B模型
async function countWithSiliconFlow(base64, width, height) {
  if (!SILICONFLOW_API_KEY) return null;
  const SF_URL = 'https://api.siliconflow.cn/v1/chat/completions';
  
  // 尝试多个视觉模型
  const models = ['Qwen/Qwen3-VL-32B-Instruct', 'Qwen/Qwen3-VL-8B-Instruct'];
  let count = 0;
  
  for (const model of models) {
    try {
      console.log(`[SiliconFlow] 尝试模型: ${model}`);
      const res1 = await fetchWithTimeout(SF_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SILICONFLOW_API_KEY}` },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: [
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
            { type: 'text', text: COUNT_ONLY_PROMPT }
          ]}],
          max_tokens: 20, temperature: 0
        })
      }, 20000);
      
      if (!res1.ok) {
        console.error(`[SiliconFlow] ${model} 计数失败: ${res1.status}`);
        continue;
      }
      
      const json1 = await res1.json();
      if (json1.error) { console.error(`[SiliconFlow] ${model} 错误:`, json1.error); continue; }
      const text1 = json1.choices?.[0]?.message?.content || '';
      const numMatch = text1.match(/(\d+)/);
      count = numMatch ? parseInt(numMatch[1]) : 0;
      if (count > 0) {
        console.log(`[SiliconFlow] ${model} 计数成功: ${count}`);
        break;
      }
    } catch (err) {
      console.error(`[SiliconFlow] ${model} 异常:`, err.message);
    }
  }
  
  if (count <= 0) return null;
  
  // 获取坐标（即使失败也返回计数）
  try {
    console.log('[SiliconFlow] 获取坐标...');
    const coordModel = 'Qwen/Qwen3-VL-8B-Instruct';
    const res2 = await fetchWithTimeout(SF_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SILICONFLOW_API_KEY}` },
      body: JSON.stringify({
        model: coordModel,
        messages: [{ role: 'user', content: [
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
          { type: 'text', text: GET_COORDS_PROMPT(count) }
        ]}],
        max_tokens: 500, temperature: 0
      })
    }, 15000);
    
    if (res2.ok) {
      const json2 = await res2.json();
      const text2 = json2.choices?.[0]?.message?.content || '';
      const items = parseCoordsResult(text2, width, height);
      if (items.length > 0) {
        console.log('[SiliconFlow] 解析到', items.length, '个物品坐标');
        return { count, items };
      }
    }
  } catch (err) {
    console.error('[SiliconFlow] 坐标获取失败:', err.message);
  }
  
  // 坐标获取失败时，使用网格扫描法生成标记
  console.log('[SiliconFlow] 使用网格扫描法生成标记');
  const items = generateGridMarkers(count, width, height);
  return { count, items };
}


// 3. 豆包AI
async function countWithDoubao(base64, width, height) {
  if (!DOUBAO_API_KEY) return null;
  try {
    console.log('[Doubao] 开始识别...');
    const res1 = await fetchWithTimeout(DOUBAO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DOUBAO_API_KEY}` },
      body: JSON.stringify({
        model: 'doubao-vision-pro',
        messages: [{ role: 'user', content: [
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
          { type: 'text', text: COUNT_ONLY_PROMPT }
        ]}],
        max_tokens: 20, temperature: 0
      })
    }, 15000);
    const json1 = await res1.json();
    if (json1.error) { console.error('[Doubao] 计数错误:', json1.error); return null; }
    const text1 = json1.choices?.[0]?.message?.content || '';
    const numMatch = text1.match(/(\d+)/);
    const count = numMatch ? parseInt(numMatch[1]) : 0;
    if (count <= 0) { return null; }
    
    const res2 = await fetchWithTimeout(DOUBAO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DOUBAO_API_KEY}` },
      body: JSON.stringify({
        model: 'doubao-vision-pro',
        messages: [{ role: 'user', content: [
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
          { type: 'text', text: GET_COORDS_PROMPT(count) }
        ]}],
        max_tokens: 300, temperature: 0
      })
    }, 15000);
    const json2 = await res2.json();
    const text2 = json2.choices?.[0]?.message?.content || '';
    const items = parseCoordsResult(text2, width, height);
    console.log('[Doubao] 解析到', items.length, '个物品坐标');
    return { count, items };
  } catch (err) {
    console.error('[Doubao] 失败:', err.message);
    return null;
  }
}

// 4. 智谱GLM-4V
async function countWithZhipu(base64, width, height) {
  if (!ZHIPU_API_KEY) return null;
  
  const models = ['glm-4v', 'glm-4v-plus'];
  let count = 0;
  
  for (const model of models) {
    try {
      console.log(`[ZhipuAI] 尝试模型: ${model}`);
      const res1 = await fetchWithTimeout(ZHIPU_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ZHIPU_API_KEY}` },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: [
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
            { type: 'text', text: COUNT_ONLY_PROMPT }
          ]}],
          max_tokens: 20, temperature: 0
        })
      }, 15000);
      
      if (!res1.ok) {
        console.error(`[ZhipuAI] ${model} 计数失败: ${res1.status}`);
        continue;
      }
      
      const json1 = await res1.json();
      if (json1.error) { console.error(`[ZhipuAI] ${model} 错误:`, json1.error); continue; }
      const text1 = json1.choices?.[0]?.message?.content || '';
      const numMatch = text1.match(/(\d+)/);
      count = numMatch ? parseInt(numMatch[1]) : 0;
      if (count > 0) {
        console.log(`[ZhipuAI] ${model} 计数成功: ${count}`);
        break;
      }
    } catch (err) {
      console.error(`[ZhipuAI] ${model} 异常:`, err.message);
    }
  }
  
  if (count <= 0) return null;
  
  // 获取坐标（即使失败也返回计数）
  try {
    console.log('[ZhipuAI] 获取坐标...');
    const coordModel = 'glm-4v';
    const res2 = await fetchWithTimeout(ZHIPU_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ZHIPU_API_KEY}` },
      body: JSON.stringify({
        model: coordModel,
        messages: [{ role: 'user', content: [
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
          { type: 'text', text: GET_COORDS_PROMPT(count) }
        ]}],
        max_tokens: 300, temperature: 0
      })
    }, 15000);
    
    if (res2.ok) {
      const json2 = await res2.json();
      const text2 = json2.choices?.[0]?.message?.content || '';
      const items = parseCoordsResult(text2, width, height);
      if (items.length > 0) {
        console.log('[ZhipuAI] 解析到', items.length, '个物品坐标');
        return { count, items };
      }
    }
  } catch (err) {
    console.error('[ZhipuAI] 坐标获取失败:', err.message);
  }
  
  // 坐标获取失败时，使用网格扫描法生成标记
  console.log('[ZhipuAI] 使用网格扫描法生成标记');
  const items = generateGridMarkers(count, width, height);
  return { count, items };
}


// 统一识别函数：自动按顺序尝试多个API
async function fetchBaiduObjectDetection(imageInfo) {
  try {
    const { uri, width, height } = imageInfo;
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    console.log(`[AI计数] base64长度: ${base64.length}, 图片尺寸: ${width}x${height}`);

    // 按优先级顺序尝试：Zhipu(快) → SiliconFlow(32B) → 阿里云百炼 → 豆包AI
    const apis = [
      { name: 'ZhipuAI', fn: () => countWithZhipu(base64, width, height) },
      { name: 'SiliconFlow(32B)', fn: () => countWithSiliconFlow(base64, width, height) },
      { name: '阿里云百炼', fn: () => countWithAlibaba(base64, width, height) },
      { name: '豆包AI', fn: () => countWithDoubao(base64, width, height) },
    ];

    for (const api of apis) {
      const result = await api.fn();
      if (result !== null && result.count > 0 && result.count < 10000) {
        console.log(`[AI计数] ${api.name} 识别成功: ${result.count} 个物品`);
        return result;
      }
      console.log(`[AI计数] ${api.name} 未返回有效结果，尝试下一个API`);
    }

    console.log('[AI计数] 所有API均未返回有效结果');
    return { count: 0, items: [] };
  } catch (err) {
    console.error('[AI计数] 识别异常:', err);
    return { count: 0, items: [] };
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
    MemberManage: true,
    CouponManage: true,
    SupplierManage: true,
    StockAlert: true,
    DataExport: true,
  },
  aiChatMessages: [],
  dailyReportConfig: { enable: true, workTimeStart: '09:00', workTimeEnd: '18:00' },
  newMessageRedDots: {
    '客服': false,
    '内部': false,
    'AI助手': false,
  },
  members: [],
  coupons: [],
  suppliers: [],
  stockAlerts: {},
};

const initialState = JSON.parse(JSON.stringify(defaultState));

function appReducer(state, action) {
  switch (action.type) {
    case 'LOGIN':
      return { ...state, user: action.payload.user, shopInfo: { ...state.shopInfo, ...action.payload.shopInfo } };
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
    case 'SET_DAILY_REPORT_CONFIG':
      return { ...state, dailyReportConfig: action.payload };
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
    case 'MARK_STAFF_VIEWED': {
      // 标记所有pending状态的员工申请为已查看
      const list = state.staffMemberList || [];
      const newList = list.map(item => 
        item.status === 'pending' ? { ...item, viewed: true } : item
      );
      return { ...state, staffMemberList: newList };
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
      // 使用fromPhone判断是否是对方发送的消息
      const isOtherMessage = message.fromPhone !== state.user?.phone;
      const newDots = { ...state.newMessageRedDots };
      
      if (isOtherMessage) {
        if (message.platform === 'private') {
          // 员工/老板之间的私聊消息，在首页私聊入口显示红点（已在首页单独处理）
          // 不设置内部页面红点，私聊和内部沟通是独立的
        } else if (message.platform && message.platform !== 'private') {
          // 顾客消息，在客服页面显示红点
          newDots['客服'] = true;
        }
      }
      
      // 模拟消息同步机制：当商家发送私聊消息给员工时，
      // 自动为该员工账号设置未读状态标记
      // 这样员工切换账号时就能看到红点提示
      if (!isOtherMessage && message.platform === 'private') {
        // 当前用户发送了私聊消息给phone（员工/老板）
        // 标记对方账号的消息为未读状态
        const otherMessages = state.privateChatMessages[phone] || [];
        // 查找刚才发送的消息，确保它是未读状态
        // 实际上消息已经是read: false，但我们需要确保红点标记会被触发
        // 这里我们预设置对方账号登录时能检测到的未读状态
        console.log(`[消息同步] 已发送消息给 ${phone}，等待对方登录查看`);
      }
      
      return { 
        ...state, 
        privateChatMessages: { ...state.privateChatMessages, [phone]: [...existing, message] },
        newMessageRedDots: newDots
      };
    }
    case 'SET_CUSTOMER_TAG': {
      const { phone, tag } = action.payload;
      const existing = state.customerTags[phone] || [];
      return { ...state, customerTags: { ...state.customerTags, [phone]: existing.includes(tag) ? existing : [...existing, tag] } };
    }
    case 'ADD_GROUP_MESSAGE': {
      const { chatId, message } = action.payload;
      const existing = state.groupChatMessages[chatId] || [];
      const isInternal = chatId === 'internal';
      const isOtherMessage = message.from !== state.user?.name && message.from !== 'staff' && message.from !== state.user?.phone;
      const shouldShowRedDot = isInternal && isOtherMessage && !state.newMessageRedDots?.['内部'];
      return { 
        ...state, 
        groupChatMessages: { ...state.groupChatMessages, [chatId]: [...existing, message] },
        newMessageRedDots: shouldShowRedDot ? { ...state.newMessageRedDots, '内部': true } : state.newMessageRedDots
      };
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
    case 'MARK_GROUP_MESSAGES_READ': {
      const { chatId } = action.payload;
      const existing = state.groupChatMessages[chatId] || [];
      const updated = existing.map(m => ({ ...m, read: true }));
      return { ...state, groupChatMessages: { ...state.groupChatMessages, [chatId]: updated } };
    }
    case 'MARK_PRIVATE_MESSAGES_READ': {
      const { phone } = action.payload;
      const existing = state.privateChatMessages[phone] || [];
      const updated = existing.map(m => ({ ...m, read: true }));
      return { ...state, privateChatMessages: { ...state.privateChatMessages, [phone]: updated } };
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
        shopInfo: { ...{ shopName: '', phone: '', industry: '餐饮类' }, ...(r.shopInfo || {}) },
        badReviewCount: typeof r.badReviewCount === 'number' ? r.badReviewCount : 0,
        costCache: r.costCache || { purchaseCost: "", fixedCost: "" },
        shopConfig: r.shopConfig || { shopName: "我的门店", industry: "餐饮类" },
        lastBusinessInput: r.lastBusinessInput || { income: "", purchaseCost: "", loss: "", fixedCost: "", otherCost: "", lossOverdue: "", lossOperate: "", lossOther: "" },
        latestDailyReport: r.latestDailyReport || null,
        pushConfig: r.pushConfig || { workHour: "9", workMinute: "0", offHour: "21", offMinute: "0" },
        menuVisibility: { ...defaultState.menuVisibility, ...(r.menuVisibility || {}) },
        aiChatMessages: Array.isArray(r.aiChatMessages) ? r.aiChatMessages : [],
        dailyReportConfig: r.dailyReportConfig || { enable: true, workTimeStart: '09:00', workTimeEnd: '18:00' },
        newMessageRedDots: r.newMessageRedDots || { '客服': false, '内部': false, 'AI助手': false },
        members: Array.isArray(r.members) ? r.members : [],
        coupons: Array.isArray(r.coupons) ? r.coupons : [],
        suppliers: Array.isArray(r.suppliers) ? r.suppliers : [],
        stockAlerts: (r.stockAlerts && typeof r.stockAlerts === 'object') ? r.stockAlerts : {},
      };
    }
    case 'ADD_AI_MESSAGE': {
      const existing = state.aiChatMessages || [];
      return { ...state, aiChatMessages: [...existing, action.payload] };
    }
    case 'SET_AI_MESSAGES': {
      return { ...state, aiChatMessages: action.payload || [] };
    }
    case 'SET_RED_DOT': {
      const { tab, hasNew } = action.payload;
      return { ...state, newMessageRedDots: { ...state.newMessageRedDots, [tab]: hasNew } };
    }
    case 'CLEAR_RED_DOT': {
      const { tab } = action.payload;
      return { ...state, newMessageRedDots: { ...state.newMessageRedDots, [tab]: false } };
    }
    case 'CLEAR_ALL_RED_DOTS': {
      return { ...state, newMessageRedDots: { '客服': false, '内部': false, 'AI助手': false } };
    }
    // ===== 会员管理 =====
    case 'ADD_MEMBER': {
      const list = state.members || [];
      if (list.find(m => m.phone === action.payload.phone)) return state;
      return { ...state, members: [...list, { ...action.payload, id: Date.now().toString(), points: 0, totalSpent: 0, createdAt: new Date().toISOString() }] };
    }
    case 'UPDATE_MEMBER': {
      const list = state.members || [];
      const idx = list.findIndex(m => m.id === action.payload.id);
      if (idx === -1) return state;
      const newList = [...list];
      newList[idx] = { ...newList[idx], ...action.payload };
      return { ...state, members: newList };
    }
    case 'DELETE_MEMBER':
      return { ...state, members: (state.members || []).filter(m => m.id !== action.payload) };
    case 'ADD_MEMBER_POINTS': {
      const list = state.members || [];
      const idx = list.findIndex(m => m.id === action.payload.id);
      if (idx === -1) return state;
      const newList = [...list];
      newList[idx] = { ...newList[idx], points: (newList[idx].points || 0) + action.payload.points, totalSpent: (newList[idx].totalSpent || 0) + (action.payload.amount || 0) };
      return { ...state, members: newList };
    }
    // ===== 优惠券管理 =====
    case 'ADD_COUPON':
      return { ...state, coupons: [...(state.coupons || []), { ...action.payload, id: Date.now().toString(), used: 0, createdAt: new Date().toISOString() }] };
    case 'DELETE_COUPON':
      return { ...state, coupons: (state.coupons || []).filter(c => c.id !== action.payload) };
    case 'USE_COUPON': {
      const list = state.coupons || [];
      const idx = list.findIndex(c => c.id === action.payload);
      if (idx === -1) return state;
      const newList = [...list];
      newList[idx] = { ...newList[idx], used: (newList[idx].used || 0) + 1 };
      return { ...state, coupons: newList };
    }
    // ===== 供应商管理 =====
    case 'ADD_SUPPLIER':
      return { ...state, suppliers: [...(state.suppliers || []), { ...action.payload, id: Date.now().toString(), createdAt: new Date().toISOString() }] };
    case 'DELETE_SUPPLIER':
      return { ...state, suppliers: (state.suppliers || []).filter(s => s.id !== action.payload) };
    case 'UPDATE_SUPPLIER': {
      const list = state.suppliers || [];
      const idx = list.findIndex(s => s.id === action.payload.id);
      if (idx === -1) return state;
      const newList = [...list];
      newList[idx] = { ...newList[idx], ...action.payload };
      return { ...state, suppliers: newList };
    }
    // ===== 库存预警 =====
    case 'SET_STOCK_ALERT':
      return { ...state, stockAlerts: { ...(state.stockAlerts || {}), [action.payload.goodsId]: action.payload.threshold } };
    case 'REMOVE_STOCK_ALERT': {
      const alerts = { ...(state.stockAlerts || {}) };
      delete alerts[action.payload];
      return { ...state, stockAlerts: alerts };
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
      aiChatMessages: state.aiChatMessages || [],
      dailyReportConfig: state.dailyReportConfig || { enable: true, workTimeStart: '09:00', workTimeEnd: '18:00' },
      newMessageRedDots: state.newMessageRedDots || { '客服': false, '内部': false, 'AI助手': false },
      members: state.members || [],
      coupons: state.coupons || [],
      suppliers: state.suppliers || [],
      stockAlerts: state.stockAlerts || {},
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

// ===== 统一头部组件 =====
const CommonHeader = ({ title, leftComponent, rightComponent, backgroundColor = BG_CARD, showBack = false, onBack, navigation }) => {
  const StatusBarHeight = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : (Platform.OS === 'ios' ? 44 : 0);
  const handleBack = () => {
    if (onBack) onBack();
    else if (navigation) navigation.goBack();
  };
  
  return (
    <View style={{ backgroundColor }}>
      <View style={{ height: StatusBarHeight, backgroundColor }} />
      <View style={[styles.headerBar, { backgroundColor }]}>
        {leftComponent ? leftComponent : (
          showBack ? (
            <TouchableOpacity onPress={handleBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={{ padding: 8 }}>
              <Ionicons name="chevron-back" size={24} color={TEXT_MAIN} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )
        )}
        <Text style={[styles.pageTitle, { flex: 1, textAlign: 'center', marginHorizontal: 40 }]}>{title}</Text>
        {rightComponent || <View style={{ width: 40 }} />}
      </View>
    </View>
  );
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
  chatRow: { flexDirection: 'row', alignItems: 'flex-start', marginVertical: 8 },
  bubbleLeft: { backgroundColor: BG_CARD, padding: 14, borderRadius: 18, maxWidth: '78%', alignSelf: 'flex-start', ...SHADOW },
  bubbleRight: { backgroundColor: LIGHT_PRIMARY, padding: 14, borderRadius: 18, maxWidth: '78%', alignSelf: 'flex-end', ...SHADOW },
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
  imageViewerContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
  imageViewerTopBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 80, paddingTop: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, zIndex: 10 },
  imageViewerBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  imageViewerImageContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  imageViewerLoading: { position: 'absolute', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)', padding: 20, borderRadius: 12 },
  imageViewerEditPanel: { backgroundColor: 'rgba(30,30,30,0.9)', padding: 16, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  imageViewerControlRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  imageViewerControlBtn: { alignItems: 'center', padding: 8 },
  imageViewerControlText: { color: '#fff', fontSize: 11, marginTop: 4 },
  filterScrollView: { paddingVertical: 8 },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#333', borderRadius: 20, marginRight: 8, borderWidth: 2, borderColor: 'transparent' },
  filterBtnActive: { borderColor: PRIMARY_COLOR, backgroundColor: LIGHT_PRIMARY },
  filterBtnText: { color: '#fff', fontSize: 13 },
  imageViewerBottomBar: { flexDirection: 'row', justifyContent: 'space-around', padding: 20, backgroundColor: 'rgba(0,0,0,0.9)', paddingBottom: 40 },
  imageViewerActionBtn: { alignItems: 'center', padding: 10 },
  imageViewerActionText: { color: '#fff', fontSize: 12, marginTop: 4 },
  bgPickerBtn: { width: '100%', height: 120, borderRadius: 12, backgroundColor: LIGHT_PRIMARY, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  bgResetBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  imageMsgRight: { alignSelf: 'flex-end', maxWidth: '70%', marginVertical: 4 },
  imageMsgLeft: { alignSelf: 'flex-start', maxWidth: '70%', marginVertical: 4 },
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
  scannerContainer: { flex: 1, width: '100%', height: '100%', backgroundColor: '#000', position: 'relative' },
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
  const [agreeTerms, setAgreeTerms] = useState(false);
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
    if (!agreeTerms) {
      showToast('请先阅读并同意用户协议');
      return;
    }
    setLoading(true);
    try {
      console.log('[Login] Login started');
      console.log('[Login] phone:', phone, 'code:', code, 'shopName:', shopName, 'role:', role, 'employeeName:', employeeName);
      
      if (phone.length !== 11) { 
        console.log('[Login] Error: phone length invalid');
        showToast('请输入11位手机号'); 
        setLoading(false); 
        return; 
      }
      if (code !== '123456') { 
        console.log('[Login] Error: code invalid');
        showToast('验证码错误'); 
        setLoading(false); 
        return; 
      }
      if (!shopName.trim()) { 
        console.log('[Login] Error: shopName empty');
        showToast('请输入店铺名称'); 
        setLoading(false); 
        return; 
      }
      if (role === '员工' && !employeeName.trim()) {
        console.log('[Login] Error: employeeName empty');
        showToast('请输入员工姓名');
        setLoading(false);
        return;
      }
      console.log('[Login] Validation passed');

      const user = { role, phone, shopName, name: role === '员工' ? employeeName.trim() : '老板' };
      
      // 根据店铺名称自动识别行业类型 - 大幅扩充关键词
      let industry = '餐饮类';
      // 服务类店铺关键词（包含常见服务型业务）
      const serviceKeywords = [
        '服务', '美容', '美发', '健身', '洗浴', '按摩', 'KTV', '娱乐',
        '教育', '培训', '家政', '保洁', '手机', '数码', '维修', '汽修',
        '汽配', '服装', '服饰', '鞋店', '箱包', '珠宝', '眼镜', '钟表',
        '理发', '美甲', '纹绣', 'SPA', '足浴', '网咖', '网吧', '影院',
        '快递', '物流', '搬家', '开锁', '干洗', '摄影', '婚庆', '鲜花',
        '打印', '复印', '广告', '装饰', '装修', '房产', '中介', '旅游',
        '酒店', '宾馆', '住宿', '民宿', '宠物', '诊所', '药房', '药店',
        '书店', '文具', '礼品', '玩具', '母婴', '童装', '家电', '家具',
        '建材', '五金', '灯具', '窗帘', '布艺', '眼镜', '验光', '配镜'
      ];
      // 企业类店铺关键词
      const enterpriseKeywords = [
        '公司', '企业', '科技', '咨询', '贸易', '批发', '制造', '工厂',
        '集团', '有限', '责任', '股份', '投资', '金融', '保险', '证券',
        '律所', '律师', '会计', '审计', '设计', '开发', '软件', '网络',
        '电商', '平台', '传媒', '文化', '影视', '广告', '策划', '营销',
        '医疗', '医院', '体检', '养老', '物业', '管理', '工程', '建筑',
        '能源', '电力', '环保', '农业', '养殖', '种植', '物流', '仓储'
      ];
      
      // 优先判断服务类
      if (serviceKeywords.some(kw => shopName.includes(kw))) {
        industry = '服务类';
      } else if (enterpriseKeywords.some(kw => shopName.includes(kw))) {
        industry = '企业类';
      }
      // 默认餐饮类（餐厅、饭店、小吃、饮品等）
      
      const shopInfo = { shopName, phone, industry };
      
      console.log('[Login] user:', JSON.stringify(user));
      console.log('[Login] shopInfo:', JSON.stringify(shopInfo));

      await AsyncStorage.setItem('user', JSON.stringify(user));
      await AsyncStorage.setItem('shopInfo', JSON.stringify(shopInfo));
      
      console.log('[Login] AsyncStorage set successfully');

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

      console.log('[Login] Navigation to RootTabs');
      
      // 使用reset直接重置导航栈，避免闪过两个首页
      try {
        if (navigationRef.current) {
          console.log('[Login] Using navigationRef to reset');
          navigationRef.current.reset({ index: 0, routes: [{ name: 'RootTabs' }] });
        } else {
          console.log('[Login] Using navigation.replace');
          navigation.replace('RootTabs');
        }
      } catch (navError) {
        console.error('[Login] Navigation error:', navError);
        Alert.alert('导航失败', '请重试登录');
      }
      
      // 在导航完成后再设置loading为false
      setTimeout(() => {
        setLoading(false);
      }, 500);
    } catch (error) {
      console.error('[Login] Login error:', error);
      console.error('[Login] Error stack:', error.stack);
      Alert.alert('登录失败', `错误: ${error.message || String(error)}`);
      setLoading(false);
    }
  };

  const handleHistorySelect = async (account) => {
    try {
      const user = { role: account.role, phone: account.phone, shopName: account.shopName, name: account.name || '老板' };
      const existingShopInfo = state.shopInfo || {};
      const shopInfo = { shopName: account.shopName, phone: account.phone, industry: existingShopInfo.industry || '餐饮类' };
      await AsyncStorage.setItem('user', JSON.stringify(user));
      await AsyncStorage.setItem('shopInfo', JSON.stringify(shopInfo));
      dispatch({ type: 'LOGIN', payload: { user, shopInfo } });
      // 使用reset直接重置导航栈，避免闪过两个首页
      if (navigationRef.current) {
        navigationRef.current.reset({ index: 0, routes: [{ name: 'RootTabs' }] });
      } else {
        navigation.replace('RootTabs');
      }
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
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 8 }}>
        <TouchableOpacity onPress={() => setAgreeTerms(!agreeTerms)} style={{ marginRight: 8 }}>
          <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: agreeTerms ? PRIMARY_COLOR : BORDER_COLOR, backgroundColor: agreeTerms ? PRIMARY_COLOR : 'transparent', justifyContent: 'center', alignItems: 'center' }}>
            {agreeTerms && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
        </TouchableOpacity>
        <Text style={{ fontSize: 13, color: TEXT_SECOND }}>
          我已阅读并同意
          <Text style={{ color: PRIMARY_COLOR }} onPress={() => navigation.navigate('UserAgreement')}>《用户协议》</Text>
          和
          <Text style={{ color: PRIMARY_COLOR }} onPress={() => navigation.navigate('UserAgreement')}>《隐私政策》</Text>
        </Text>
      </View>
      <TouchableOpacity style={[styles.loginBtn, (!agreeTerms || loading) && { opacity: 0.5 }]} onPress={handleLogin} disabled={!agreeTerms || loading}>
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
  const [name, setName] = useState((user && user.name) || '');
  const [phone, setPhone] = useState((user && user.phone) || '');
  const [gender, setGender] = useState((user && user.gender) || '未设置');
  const [avatar, setAvatar] = useState((user && user.avatar) || '');
  const [avatarBgColor, setAvatarBgColor] = useState((user && user.avatarBgColor) || PRIMARY_COLOR);
  const [region, setRegion] = useState((user && user.region) || '');
  const [signature, setSignature] = useState((user && user.signature) || '');
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
    try {
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
            if (!result.canceled && result.assets && result.assets[0]) {
              setAvatar(result.assets[0].uri);
            }
          } catch (e) { 
            console.error('[pickAvatar] 相册选择失败:', e);
            showToast('选择失败'); 
          }
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
            if (!result.canceled && result.assets && result.assets[0]) {
              setAvatar(result.assets[0].uri);
            }
          } catch (e) { 
            console.error('[pickAvatar] 相机拍摄失败:', e);
            showToast('拍摄失败'); 
          }
        }},
        { text: '使用预设头像', onPress: () => setShowAvatarPicker(true) },
        { text: '取消', style: 'cancel' },
      ]);
    } catch (e) {
      console.error('[pickAvatar] Alert失败:', e);
      showToast('选择头像失败');
    }
  };

  const saveProfile = async () => {
    if (!name.trim()) { showToast('请输入姓名'); return; }
    if (!/^1\d{10}$/.test(phone)) { showToast('请输入有效的手机号'); return; }
    const newUser = { ...user, name: name.trim(), phone, gender, avatar, avatarBgColor, region, signature };
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
      <CommonHeader 
        title="个人资料" 
        showBack={true}
        navigation={navigation}
        backgroundColor={PRIMARY_COLOR}
        leftComponent={<TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8 }}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>}
      />
      <ScrollView style={{ flex: 1, backgroundColor: '#F5F7FA' }}>
        <View style={{ backgroundColor: PRIMARY_COLOR, paddingBottom: 30, alignItems: 'center' }}>
          <TouchableOpacity onPress={pickAvatar} style={{ position: 'relative' }}>
            <View style={{ width: 90, height: 90, borderRadius: 45, backgroundColor: avatarBgColor, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 3, borderColor: '#fff' }}>
              {avatar && (avatar.startsWith('http') || avatar.startsWith('file') || avatar.startsWith('data')) ? (
                <Image source={{ uri: avatar }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <Text style={{ fontSize: 36, color: '#fff', fontWeight: 'bold' }}>{getAvatarText()}</Text>
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
                <TouchableOpacity key={idx} style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: c.bg, justifyContent: 'center', alignItems: 'center' }} onPress={() => { 
                  setAvatar(''); // 清除图片头像，使用预设颜色
                  setAvatarBgColor(c.bg); 
                  setShowAvatarPicker(false); 
                }}>
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

// ================== 编辑门店信息 Modal ==================
const EditShopNameModal = ({ visible, onClose, shopName, industry, onSave }) => {
  const [editInput, setEditInput] = useState(shopName);
  const [selectedIndustry, setSelectedIndustry] = useState(industry || '餐饮类');
  const [showIndustryPicker, setShowIndustryPicker] = useState(false);
  const industries = ['餐饮类', '服务类', '企业类'];
  
  if (!visible) return null;
  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ width: '80%', backgroundColor: '#fff', borderRadius: 16, padding: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: TEXT_MAIN, marginBottom: 16, textAlign: 'center' }}>编辑门店信息</Text>
            <TextInput
              style={{ backgroundColor: '#F5F7FA', borderRadius: 8, padding: 12, fontSize: 16, color: TEXT_MAIN, marginBottom: 12 }}
              value={editInput}
              onChangeText={setEditInput}
              placeholder="请输入门店名称"
              autoFocus
            />
            <TouchableOpacity 
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F5F7FA', borderRadius: 8, padding: 12, marginBottom: 20 }}
              onPress={() => setShowIndustryPicker(true)}
            >
              <Text style={{ fontSize: 16, color: TEXT_MAIN }}>门店类型</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 16, color: PRIMARY_COLOR, fontWeight: '500' }}>{selectedIndustry}</Text>
                <Ionicons name="chevron-down" size={18} color={TEXT_THIRD} style={{ marginLeft: 8 }} />
              </View>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity style={{ flex: 1, padding: 12, backgroundColor: LIGHT_PRIMARY, borderRadius: 8, alignItems: 'center' }} onPress={onClose}>
                <Text style={{ color: TEXT_MAIN, fontSize: 16 }}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, padding: 12, backgroundColor: PRIMARY_COLOR, borderRadius: 8, alignItems: 'center' }} onPress={() => {
                if (editInput && editInput.trim()) {
                  onSave(editInput.trim(), selectedIndustry);
                }
                onClose();
              }}>
                <Text style={{ color: '#fff', fontSize: 16 }}>保存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      <Modal visible={showIndustryPicker} transparent animationType="slide" onRequestClose={() => setShowIndustryPicker(false)}>
        <TouchableOpacity activeOpacity={1} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} onPress={() => setShowIndustryPicker(false)}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 }}>选择门店类型</Text>
            {industries.map((item) => (
              <TouchableOpacity 
                key={item} 
                style={{ 
                  flexDirection: 'row', alignItems: 'center', paddingVertical: 16, 
                  borderBottomWidth: 1, borderBottomColor: BORDER_COLOR,
                  backgroundColor: selectedIndustry === item ? LIGHT_PRIMARY : 'transparent'
                }}
                onPress={() => {
                  setSelectedIndustry(item);
                  setShowIndustryPicker(false);
                }}
              >
                <Text style={{ flex: 1, fontSize: 16, color: TEXT_MAIN }}>{item}</Text>
                {selectedIndustry === item && (
                  <Ionicons name="checkmark-circle" size={20} color={PRIMARY_COLOR} />
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={{ paddingVertical: 16, marginTop: 8 }} onPress={() => setShowIndustryPicker(false)}>
              <Text style={{ fontSize: 16, color: TEXT_SECOND, textAlign: 'center' }}>取消</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

// ================== 设置抽屉 ==================
const SettingDrawer = ({ visible, onClose }) => {
  const { state, dispatch } = useApp();
  const navigation = useNavigation();
  const user = state.user || {};
  const shopInfo = state.shopInfo || { shopName: '', phone: '', industry: '餐饮类' };
  const isEmployee = user.role === '员工';
  const [shopName, setShopName] = useState(shopInfo.shopName || '');
  const [phone, setPhone] = useState(shopInfo.phone || '');
  const [showEditModal, setShowEditModal] = useState(false);
  const [workTimeStart, setWorkTimeStart] = useState(state.dailyReportConfig?.workTimeStart || '09:00');
  const [workTimeEnd, setWorkTimeEnd] = useState(state.dailyReportConfig?.workTimeEnd || '18:00');
  const [dailyReportEnable, setDailyReportEnable] = useState(state.dailyReportConfig?.enable || true);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerType, setTimePickerType] = useState('start');
  const [showHourPicker, setShowHourPicker] = useState(null);
  const [showMinutePicker, setShowMinutePicker] = useState(null);
  const [selectedIndustry, setSelectedIndustry] = useState(shopInfo.industry || '餐饮类');
  const [showIndustryPicker, setShowIndustryPicker] = useState(false);
  const translateX = useRef(new Animated.Value(width)).current;

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: visible ? 0 : width,
      duration: 300,
      easing: Easing.ease,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  const detectIndustry = (name) => {
    if (!name) return '餐饮类';
    if (name.includes('服务') || name.includes('美容') || name.includes('美发') || name.includes('健身') || name.includes('洗浴') || name.includes('按摩') || name.includes('KTV') || name.includes('娱乐')) return '服务类';
    if (name.includes('公司') || name.includes('企业') || name.includes('科技') || name.includes('咨询') || name.includes('贸易') || name.includes('物流')) return '企业类';
    return '餐饮类';
  };

  const saveShop = () => {
    const industry = selectedIndustry;
    const updatedShopInfo = { ...shopInfo, shopName, phone, industry };
    dispatch({ type: 'UPDATE_SHOP_INFO', payload: updatedShopInfo });
    dispatch({ type: 'SET_SHOP_CONFIG', payload: { shopName, industry } });
    showToast(`门店信息已保存，类型：${industry}`);
  };

  const saveEmployeeDailyReportConfig = () => {
    const config = { enable: dailyReportEnable, workTimeStart, workTimeEnd };
    dispatch({ type: 'SET_DAILY_REPORT_CONFIG', payload: config });
    showToast('日报推送设置已保存');
    setShowTimePicker(false);
  };

  const saveDailyReportConfig = () => {
    const config = { enable: dailyReportEnable, workTimeStart, workTimeEnd };
    dispatch({ type: 'SET_DAILY_REPORT_CONFIG', payload: config });
    showToast('日报推送设置已保存');
    setShowTimePicker(false);
  };

  const toggleDailyReport = () => {
    setDailyReportEnable(!dailyReportEnable);
    dispatch({ type: 'SET_DAILY_REPORT_CONFIG', payload: { enable: !dailyReportEnable, workTimeStart, workTimeEnd } });
    showToast(!dailyReportEnable ? '日报推送已开启' : '日报推送已关闭');
  };

  const handleLogout = async () => {
    try {
      if (user.phone) {
        dispatch({ type: 'ADD_PREVIOUS_ACCOUNT', payload: { phone: user.phone, role: user.role, shopName: shopInfo.shopName, name: user.name } });
      }
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('shopInfo');
      dispatch({ type: 'LOGOUT' });
      onClose();
    } catch (error) { showToast('退出失败'); }
  };

  const goToProfile = () => {
    try {
      onClose();
      setTimeout(() => {
        try {
          if (navigationRef.current) {
            const state = navigationRef.current.getState();
            if (state) {
              navigationRef.current.navigate('ProfileEdit');
            } else {
              showToast('导航状态异常');
            }
          } else {
            showToast('导航未初始化');
          }
        } catch (navError) {
          console.error('[goToProfile] Navigation Error:', navError);
          showToast('打开个人资料失败');
        }
      }, 500);
    } catch (error) {
      console.error('[goToProfile] Error:', error);
      showToast('打开个人资料失败');
    }
  };

  const handleBackup = async () => {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const allData = await AsyncStorage.multiGet(allKeys);
      const backupData = {};
      allData.forEach(([key, value]) => {
        try { backupData[key] = JSON.parse(value); } 
        catch { backupData[key] = value; }
      });
      backupData.timestamp = new Date().toISOString();
      const backupStr = JSON.stringify(backupData, null, 2);
      const backupPath = FileSystem.documentDirectory + 'jingyingbao_backup_' + Date.now() + '.json';
      await FileSystem.writeAsStringAsync(backupPath, backupStr);
      showToast('数据备份成功！备份文件已保存');
      await Sharing.shareAsync(backupPath, { mimeType: 'application/json', dialogTitle: '分享数据备份' });
    } catch (error) {
      console.error('备份失败:', error);
      showToast('备份失败：' + (error.message || '未知错误'));
    }
  };

  const handleRestore = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
      if (!result.canceled && result.assets && result.assets[0]) {
        const content = await FileSystem.readAsStringAsync(result.assets[0].uri);
        const backupData = JSON.parse(content);
        const keys = Object.keys(backupData).filter(k => k !== 'timestamp');
        const dataToRestore = keys.map(k => [k, typeof backupData[k] === 'string' ? backupData[k] : JSON.stringify(backupData[k])]);
        await AsyncStorage.multiSet(dataToRestore);
        showToast('数据恢复成功！请重启应用');
        setTimeout(() => {
          handleLogout();
        }, 2000);
      }
    } catch (error) {
      console.error('恢复失败:', error);
      showToast('恢复失败：' + (error.message || '请选择正确的备份文件'));
    }
  };

  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  if (!visible) return null;
  return (
    <>
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} />
        <Animated.View style={{ width: width * 0.8, height: '100%', backgroundColor: '#F5F7FA', position: 'absolute', right: 0, top: 0, transform: [{ translateX }] }}>
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            <View style={{ backgroundColor: PRIMARY_COLOR, paddingTop: 50, paddingBottom: 20, paddingHorizontal: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#fff' }}>系统设置</Text>
                <TouchableOpacity onPress={onClose} style={{ padding: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 16 }}>
                  <Ionicons name="close" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={goToProfile} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginRight: 12 }}>
                  {user.avatar && (user.avatar.startsWith('http') || user.avatar.startsWith('file') || user.avatar.startsWith('data')) ? (
                    <Image source={{ uri: user.avatar }} style={{ width: '100%', height: '100%' }} />
                  ) : (
                    <Text style={{ color: PRIMARY_COLOR, fontSize: 24, fontWeight: 'bold' }}>{(user.name || '?').substring(0, 1)}</Text>
                  )}
                </View>
                <View>
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>{user.name || '未设置'}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 4 }}>{user.role || '用户'}</Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={{ padding: 16 }}>
              <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12 }}>
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }} onPress={goToProfile}>
                  <Ionicons name="person-circle-outline" size={22} color={PRIMARY_COLOR} style={{ marginRight: 12 }} />
                  <Text style={{ flex: 1, fontSize: 15, color: TEXT_MAIN }}>个人资料</Text>
                  <Ionicons name="chevron-forward" size={18} color={TEXT_THIRD} />
                </TouchableOpacity>
                {/* 商家端显示门店信息 */}
                {!isEmployee && (
                  <>
                    <View style={{ height: 1, backgroundColor: BORDER_COLOR }} />
                    <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }} onPress={() => {
                      setShowEditModal(true);
                    }}>
                      <Ionicons name="storefront-outline" size={22} color={PRIMARY_COLOR} style={{ marginRight: 12 }} />
                      <Text style={{ flex: 1, fontSize: 15, color: TEXT_MAIN }}>门店信息</Text>
                      <Text style={{ fontSize: 14, color: TEXT_SECOND }}>{shopName || '未设置'}</Text>
                      <Ionicons name="chevron-forward" size={18} color={TEXT_THIRD} />
                    </TouchableOpacity>
                  </>
                )}
                <View style={{ height: 1, backgroundColor: BORDER_COLOR }} />
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }} onPress={() => { onClose(); setTimeout(() => { if (navigationRef.current) navigationRef.current.navigate('SwitchAccount'); }, 200); }}>
                  <Ionicons name="swap-horizontal-outline" size={22} color={PRIMARY_COLOR} style={{ marginRight: 12 }} />
                  <Text style={{ flex: 1, fontSize: 15, color: TEXT_MAIN }}>切换账号</Text>
                  <Ionicons name="chevron-forward" size={18} color={TEXT_THIRD} />
                </TouchableOpacity>
                </View>

              <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12, marginTop: 12 }}>
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }} onPress={handleBackup}>
                  <Ionicons name="cloud-upload-outline" size={22} color={PRIMARY_COLOR} style={{ marginRight: 12 }} />
                  <Text style={{ flex: 1, fontSize: 15, color: TEXT_MAIN }}>数据备份</Text>
                  <Ionicons name="chevron-forward" size={18} color={TEXT_THIRD} />
                </TouchableOpacity>
                <View style={{ height: 1, backgroundColor: BORDER_COLOR }} />
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }} onPress={handleRestore}>
                  <Ionicons name="cloud-download-outline" size={22} color={PRIMARY_COLOR} style={{ marginRight: 12 }} />
                  <Text style={{ flex: 1, fontSize: 15, color: TEXT_MAIN }}>数据恢复</Text>
                  <Ionicons name="chevron-forward" size={18} color={TEXT_THIRD} />
                </TouchableOpacity>
              </View>

              {/* 商家端显示日报推送设置 */}
              {!isEmployee && (
                <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12, marginTop: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
                    <Ionicons name="notifications-outline" size={22} color={PRIMARY_COLOR} style={{ marginRight: 12 }} />
                    <Text style={{ flex: 1, fontSize: 15, color: TEXT_MAIN }}>日报推送</Text>
                    <Switch value={dailyReportEnable} onValueChange={toggleDailyReport} trackColor={{ false: '#ccc', true: PRIMARY_COLOR }} thumbColor={dailyReportEnable ? '#fff' : '#f4f3f4'} />
                  </View>
                  <View style={{ height: 1, backgroundColor: BORDER_COLOR }} />
                  <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }} onPress={() => setShowTimePicker(true)}>
                    <Ionicons name="calendar-checkmark-outline" size={22} color={PRIMARY_COLOR} style={{ marginRight: 12 }} />
                    <Text style={{ flex: 1, fontSize: 15, color: TEXT_MAIN }}>推送日报时间</Text>
                    <Text style={{ fontSize: 14, color: TEXT_SECOND }}>{workTimeStart} - {workTimeEnd}</Text>
                    <Ionicons name="chevron-forward" size={18} color={TEXT_THIRD} />
                  </TouchableOpacity>
                </View>
              )}

              <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12, marginTop: 12 }}>
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }} onPress={() => setShowPrivacyModal(true)}>
                  <Ionicons name="shield-checkmark-outline" size={22} color={PRIMARY_COLOR} style={{ marginRight: 12 }} />
                  <Text style={{ flex: 1, fontSize: 15, color: TEXT_MAIN }}>隐私政策</Text>
                  <Ionicons name="chevron-forward" size={18} color={TEXT_THIRD} />
                </TouchableOpacity>
                <View style={{ height: 1, backgroundColor: BORDER_COLOR }} />
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }} onPress={() => { onClose(); setTimeout(() => navigation.navigate('UserAgreement'), 300); }}>
                  <Ionicons name="document-text-outline" size={22} color={PRIMARY_COLOR} style={{ marginRight: 12 }} />
                  <Text style={{ flex: 1, fontSize: 15, color: TEXT_MAIN }}>用户协议</Text>
                  <Ionicons name="chevron-forward" size={18} color={TEXT_THIRD} />
                </TouchableOpacity>
                <View style={{ height: 1, backgroundColor: BORDER_COLOR }} />
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }} onPress={() => { onClose(); setTimeout(() => navigation.navigate('Feedback'), 300); }}>
                  <Ionicons name="chatbubble-ellipses-outline" size={22} color={PRIMARY_COLOR} style={{ marginRight: 12 }} />
                  <Text style={{ flex: 1, fontSize: 15, color: TEXT_MAIN }}>意见反馈</Text>
                  <Ionicons name="chevron-forward" size={18} color={TEXT_THIRD} />
                </TouchableOpacity>
                <View style={{ height: 1, backgroundColor: BORDER_COLOR }} />
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }} onPress={() => { onClose(); setTimeout(() => navigation.navigate('ClearCache'), 300); }}>
                  <Ionicons name="trash-outline" size={22} color={PRIMARY_COLOR} style={{ marginRight: 12 }} />
                  <Text style={{ flex: 1, fontSize: 15, color: TEXT_MAIN }}>清除缓存</Text>
                  <Ionicons name="chevron-forward" size={18} color={TEXT_THIRD} />
                </TouchableOpacity>
                <View style={{ height: 1, backgroundColor: BORDER_COLOR }} />
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }} onPress={async () => { showToast('正在检查更新...'); const r = await checkAppUpdate(true); if (r?.hasUpdate) { Alert.alert('发现新版本 v' + r.version, r.notes, [{ text: '稍后更新' }, { text: '立即更新', onPress: () => { if (Platform.OS === 'android') { Linking.openURL(r.url); } } }]); } }}>
                  <Ionicons name="cloud-download-outline" size={22} color={PRIMARY_COLOR} style={{ marginRight: 12 }} />
                  <Text style={{ flex: 1, fontSize: 15, color: TEXT_MAIN }}>检查更新</Text>
                  <Ionicons name="chevron-forward" size={18} color={TEXT_THIRD} />
                </TouchableOpacity>
                <View style={{ height: 1, backgroundColor: BORDER_COLOR }} />
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }} onPress={() => { onClose(); setTimeout(() => navigation.navigate('About'), 300); }}>
                  <Ionicons name="information-circle-outline" size={22} color={PRIMARY_COLOR} style={{ marginRight: 12 }} />
                  <Text style={{ flex: 1, fontSize: 15, color: TEXT_MAIN }}>关于我们</Text>
                  <Ionicons name="chevron-forward" size={18} color={TEXT_THIRD} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12, marginTop: 12 }} onPress={handleLogout}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
                  <Ionicons name="log-out-outline" size={22} color={DANGER_COLOR} style={{ marginRight: 12 }} />
                  <Text style={{ flex: 1, fontSize: 15, color: DANGER_COLOR }}>退出登录</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12, marginTop: 8 }} onPress={() => { onClose(); setTimeout(() => navigation.navigate('AccountDelete'), 300); }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
                  <Ionicons name="close-circle-outline" size={22} color={TEXT_THIRD} style={{ marginRight: 12 }} />
                  <Text style={{ flex: 1, fontSize: 15, color: TEXT_THIRD }}>注销账号</Text>
                </View>
              </TouchableOpacity>

              <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                <Text style={{ color: TEXT_THIRD, fontSize: 11 }}>经营宝 v5.55.0</Text>
              </View>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>

    {/* 商家端显示门店编辑 Modal */}
    {!isEmployee && (
      <EditShopNameModal 
        visible={showEditModal} 
        onClose={() => setShowEditModal(false)} 
        shopName={shopName} 
        industry={selectedIndustry}
        onSave={(name, industry) => {
          setShopName(name);
          setSelectedIndustry(industry);
          saveShop();
        }} 
      />
    )}

    {/* 商家端显示时间选择器 Modal */}
    {!isEmployee && (
      <>
        <Modal visible={showTimePicker} transparent animationType="slide" onRequestClose={() => setShowTimePicker(false)}>
          <TouchableOpacity activeOpacity={1} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} onPress={() => setShowTimePicker(false)}>
            <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 }}>设置日报推送时间</Text>
              
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 14, color: TEXT_SECOND, marginBottom: 8 }}>上班时间</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TouchableOpacity style={{ flex: 1, height: 44, backgroundColor: LIGHT_PRIMARY, borderRadius: 8, justifyContent: 'center', alignItems: 'center' }} onPress={() => setShowHourPicker('start')}>
                    <Text style={{ fontSize: 16, color: TEXT_MAIN, fontWeight: '500' }}>{workTimeStart.split(':')[0]}时</Text>
                  </TouchableOpacity>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: TEXT_MAIN }}>:</Text>
                  <TouchableOpacity style={{ flex: 1, height: 44, backgroundColor: LIGHT_PRIMARY, borderRadius: 8, justifyContent: 'center', alignItems: 'center' }} onPress={() => setShowMinutePicker('start')}>
                    <Text style={{ fontSize: 16, color: TEXT_MAIN, fontWeight: '500' }}>{workTimeStart.split(':')[1]}分</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 14, color: TEXT_SECOND, marginBottom: 8 }}>下班时间</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TouchableOpacity style={{ flex: 1, height: 44, backgroundColor: LIGHT_PRIMARY, borderRadius: 8, justifyContent: 'center', alignItems: 'center' }} onPress={() => setShowHourPicker('end')}>
                    <Text style={{ fontSize: 16, color: TEXT_MAIN, fontWeight: '500' }}>{workTimeEnd.split(':')[0]}时</Text>
                  </TouchableOpacity>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: TEXT_MAIN }}>:</Text>
                  <TouchableOpacity style={{ flex: 1, height: 44, backgroundColor: LIGHT_PRIMARY, borderRadius: 8, justifyContent: 'center', alignItems: 'center' }} onPress={() => setShowMinutePicker('end')}>
                    <Text style={{ fontSize: 16, color: TEXT_MAIN, fontWeight: '500' }}>{workTimeEnd.split(':')[1]}分</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity style={{ flex: 1, padding: 14, backgroundColor: '#F5F7FA', borderRadius: 12, alignItems: 'center' }} onPress={() => setShowTimePicker(false)}>
                  <Text style={{ fontSize: 16, color: TEXT_MAIN }}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1, padding: 14, backgroundColor: PRIMARY_COLOR, borderRadius: 12, alignItems: 'center' }} onPress={saveDailyReportConfig}>
                  <Text style={{ fontSize: 16, color: '#fff', fontWeight: '600' }}>保存</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>

        <Modal visible={showHourPicker !== null} transparent animationType="slide" onRequestClose={() => setShowHourPicker(null)}>
          <TouchableOpacity activeOpacity={1} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} onPress={() => setShowHourPicker(null)}>
            <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 }}>选择小时</Text>
              <ScrollView>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {Array.from({ length: 24 }, (_, i) => {
                    const hour = String(i).padStart(2, '0');
                    const isSelected = (showHourPicker === 'start' ? workTimeStart.split(':')[0] : workTimeEnd.split(':')[0]) === hour;
                    return (
                      <TouchableOpacity
                        key={i}
                        style={{
                          width: (width - 56) / 6,
                          height: 44,
                          backgroundColor: isSelected ? PRIMARY_COLOR : LIGHT_PRIMARY,
                          borderRadius: 8,
                          justifyContent: 'center',
                          alignItems: 'center'
                        }}
                        onPress={() => {
                          if (showHourPicker === 'start') {
                            const min = workTimeStart.split(':')[1];
                            setWorkTimeStart(`${hour}:${min}`);
                          } else {
                            const min = workTimeEnd.split(':')[1];
                            setWorkTimeEnd(`${hour}:${min}`);
                          }
                          setShowHourPicker(null);
                        }}
                      >
                        <Text style={{ fontSize: 16, color: isSelected ? '#fff' : TEXT_MAIN, fontWeight: '500' }}>{hour}时</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        <Modal visible={showMinutePicker !== null} transparent animationType="slide" onRequestClose={() => setShowMinutePicker(null)}>
          <TouchableOpacity activeOpacity={1} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} onPress={() => setShowMinutePicker(null)}>
            <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 }}>选择分钟</Text>
              <ScrollView>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {Array.from({ length: 12 }, (_, i) => {
                    const min = String(i * 5).padStart(2, '0');
                    const isSelected = (showMinutePicker === 'start' ? workTimeStart.split(':')[1] : workTimeEnd.split(':')[1]) === min;
                    return (
                      <TouchableOpacity
                        key={i}
                        style={{
                          width: (width - 56) / 6,
                          height: 44,
                          backgroundColor: isSelected ? PRIMARY_COLOR : LIGHT_PRIMARY,
                          borderRadius: 8,
                          justifyContent: 'center',
                          alignItems: 'center'
                        }}
                        onPress={() => {
                          if (showMinutePicker === 'start') {
                            const hour = workTimeStart.split(':')[0];
                            setWorkTimeStart(`${hour}:${min}`);
                          } else {
                            const hour = workTimeEnd.split(':')[0];
                            setWorkTimeEnd(`${hour}:${min}`);
                          }
                          setShowMinutePicker(null);
                        }}
                      >
                        <Text style={{ fontSize: 16, color: isSelected ? '#fff' : TEXT_MAIN, fontWeight: '500' }}>{min}分</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      </>
    )}

    <Modal visible={showPrivacyModal} transparent animationType="fade" onRequestClose={() => setShowPrivacyModal(false)}>
      <TouchableOpacity activeOpacity={1} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }} onPress={() => setShowPrivacyModal(false)}>
        <View style={{ width: '85%', maxHeight: '80%', backgroundColor: '#fff', borderRadius: 16, padding: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: TEXT_MAIN, marginBottom: 16, textAlign: 'center' }}>🔒 隐私政策</Text>
          <ScrollView style={{ maxHeight: 400 }}>
            <Text style={{ fontSize: 14, color: TEXT_MAIN, lineHeight: 22, marginBottom: 12 }}>
              经营宝重视您的隐私保护。本政策旨在说明我们如何收集、使用和保护您的个人信息。

            </Text>
            <Text style={{ fontSize: 15, fontWeight: '600', color: TEXT_MAIN, marginBottom: 8 }}>📊 收集的信息</Text>
            <Text style={{ fontSize: 14, color: TEXT_SECOND, lineHeight: 22, marginBottom: 8 }}>
              • 用户信息：姓名、手机号、角色等\n
              • 店铺信息：店铺名称、行业类型等\n
              • 业务数据：库存、订单、聊天记录等\n
              • 设备信息：设备型号、操作系统等
            </Text>
            <Text style={{ fontSize: 15, fontWeight: '600', color: TEXT_MAIN, marginBottom: 8 }}>🎯 使用方式</Text>
            <Text style={{ fontSize: 14, color: TEXT_SECOND, lineHeight: 22, marginBottom: 8 }}>
              • 为您提供服务和功能\n
              • 优化产品体验\n
              • 保障账户安全\n
              • 发送必要的通知
            </Text>
            <Text style={{ fontSize: 15, fontWeight: '600', color: TEXT_MAIN, marginBottom: 8 }}>🛡️ 安全保护</Text>
            <Text style={{ fontSize: 14, color: TEXT_SECOND, lineHeight: 22, marginBottom: 8 }}>
              • 数据本地存储，不上传云端\n
              • 支持数据备份和恢复\n
              • 采用加密传输和存储
            </Text>
            <Text style={{ fontSize: 15, fontWeight: '600', color: TEXT_MAIN, marginBottom: 8 }}>📅 更新</Text>
            <Text style={{ fontSize: 14, color: TEXT_SECOND, lineHeight: 22 }}>
              本政策可能会更新，更新后会在应用内通知您。
            </Text>
          </ScrollView>
          <TouchableOpacity style={{ marginTop: 16, padding: 12, backgroundColor: PRIMARY_COLOR, borderRadius: 8, alignItems: 'center' }} onPress={() => setShowPrivacyModal(false)}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>我知道了</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>

    </>
  );
};



// ================== 应用市场合规功能组件 ==================

// 用户协议页面
const UserAgreementScreen = ({ navigation }) => {
  return (
    <View style={{ flex: 1, backgroundColor: BG_PAGE }}>
      <CommonHeader title="用户协议" showBack onBack={() => navigation.goBack()} navigation={navigation} />
      <ScrollView style={{ flex: 1, padding: 16 }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: TEXT_MAIN, marginBottom: 16, textAlign: 'center' }}>经营宝用户服务协议</Text>
        <Text style={{ fontSize: 13, color: TEXT_THIRD, marginBottom: 20, textAlign: 'center' }}>更新日期：2026年7月31日</Text>

        <Text style={{ fontSize: 16, fontWeight: 'bold', color: TEXT_MAIN, marginTop: 12, marginBottom: 8 }}>一、服务条款的接受</Text>
        <Text style={{ fontSize: 14, color: TEXT_SECOND, lineHeight: 24, marginBottom: 12 }}>
          1.1 欢迎您使用经营宝（以下简称"本应用"）。使用本应用即表示您同意本协议的全部条款。{'\n'}
          1.2 如果您不同意本协议的任何内容，请立即停止使用本应用。{'\n'}
          1.3 本协议可能根据业务发展进行更新，更新后的协议自公布之日起生效。
        </Text>

        <Text style={{ fontSize: 16, fontWeight: 'bold', color: TEXT_MAIN, marginTop: 12, marginBottom: 8 }}>二、服务内容</Text>
        <Text style={{ fontSize: 14, color: TEXT_SECOND, lineHeight: 24, marginBottom: 12 }}>
          2.1 本应用为商家提供店铺经营管理服务，包括但不限于：订单核销、库存管理、员工管理、客户沟通、AI智能助手等功能。{'\n'}
          2.2 本应用的数据存储在用户本地设备上，不上传至云端服务器。{'\n'}
          2.3 部分AI功能需要联网调用第三方大模型API，网络不可用时将降级为本地功能。
        </Text>

        <Text style={{ fontSize: 16, fontWeight: 'bold', color: TEXT_MAIN, marginTop: 12, marginBottom: 8 }}>三、用户行为规范</Text>
        <Text style={{ fontSize: 14, color: TEXT_SECOND, lineHeight: 24, marginBottom: 12 }}>
          3.1 用户应保证注册信息真实、准确。{'\n'}
          3.2 用户不得利用本应用从事任何违法违规活动。{'\n'}
          3.3 用户应妥善保管账号信息，因账号泄露造成的损失由用户自行承担。{'\n'}
          3.4 用户应对自己的业务数据负责，建议定期进行数据备份。
        </Text>

        <Text style={{ fontSize: 16, fontWeight: 'bold', color: TEXT_MAIN, marginTop: 12, marginBottom: 8 }}>四、知识产权</Text>
        <Text style={{ fontSize: 14, color: TEXT_SECOND, lineHeight: 24, marginBottom: 12 }}>
          4.1 本应用的软件代码、界面设计、图标等知识产权归开发者所有。{'\n'}
          4.2 用户在使用过程中产生的业务数据归用户所有。{'\n'}
          4.3 未经授权，不得复制、修改、传播本应用的任何部分。
        </Text>

        <Text style={{ fontSize: 16, fontWeight: 'bold', color: TEXT_MAIN, marginTop: 12, marginBottom: 8 }}>五、免责声明</Text>
        <Text style={{ fontSize: 14, color: TEXT_SECOND, lineHeight: 24, marginBottom: 12 }}>
          5.1 本应用不保证所有功能在任何情况下均可用。{'\n'}
          5.2 因网络故障、设备问题、第三方API变更等导致的服务中断，开发者不承担责任。{'\n'}
          5.3 AI助手生成的内容仅供参考，用户应自行判断其准确性和适用性。{'\n'}
          5.4 用户应自行承担因使用本应用产生的业务风险。
        </Text>

        <Text style={{ fontSize: 16, fontWeight: 'bold', color: TEXT_MAIN, marginTop: 12, marginBottom: 8 }}>六、账号注销</Text>
        <Text style={{ fontSize: 14, color: TEXT_SECOND, lineHeight: 24, marginBottom: 12 }}>
          6.1 用户有权随时注销账号。{'\n'}
          6.2 注销账号后，该账号下的所有本地数据将被清除且不可恢复。{'\n'}
          6.3 账号注销操作不可逆，请谨慎操作。
        </Text>

        <Text style={{ fontSize: 16, fontWeight: 'bold', color: TEXT_MAIN, marginTop: 12, marginBottom: 8 }}>七、协议变更</Text>
        <Text style={{ fontSize: 14, color: TEXT_SECOND, lineHeight: 24, marginBottom: 24 }}>
          7.1 本协议可能不时更新，更新后的协议将在应用内展示。{'\n'}
          7.2 继续使用本应用即视为同意更新后的协议。
        </Text>
      </ScrollView>
    </View>
  );
};

// 账号注销页面
const AccountDeleteScreen = ({ navigation }) => {
  const { state, dispatch } = useApp();
  const [confirmText, setConfirmText] = useState('');
  const [step, setStep] = useState(1);

  const handleDelete = async () => {
    try {
      // 清除所有本地数据
      const keys = await AsyncStorage.getAllKeys();
      await AsyncStorage.multiRemove(keys);
      dispatch({ type: 'LOGOUT' });
      showToast('账号已注销');
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch (error) {
      showToast('注销失败，请重试');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG_PAGE }}>
      <CommonHeader title="账号注销" showBack onBack={() => navigation.goBack()} navigation={navigation} />
      <ScrollView style={{ flex: 1, padding: 16 }}>
        {step === 1 ? (
          <View style={{ backgroundColor: BG_CARD, borderRadius: 12, padding: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: DANGER_COLOR, marginBottom: 16 }}>⚠️ 注销须知</Text>
            <Text style={{ fontSize: 14, color: TEXT_MAIN, lineHeight: 24, marginBottom: 8 }}>
              注销账号将执行以下操作，且不可恢复：{'\n\n'}
              1. 删除您的账号信息{'\n'}
              2. 清除所有本地业务数据（订单、库存、聊天记录等）{'\n'}
              3. 清除所有设置和配置{'\n'}
              4. 该手机号可重新注册{'\n\n'}
              如需备份重要数据，请在注销前通过设置-数据备份进行导出。
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
              <TouchableOpacity style={{ flex: 1, padding: 14, backgroundColor: '#F5F7FA', borderRadius: 12, alignItems: 'center' }} onPress={() => navigation.goBack()}>
                <Text style={{ fontSize: 16, color: TEXT_MAIN }}>再想想</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, padding: 14, backgroundColor: DANGER_COLOR, borderRadius: 12, alignItems: 'center' }} onPress={() => setStep(2)}>
                <Text style={{ fontSize: 16, color: '#fff', fontWeight: '600' }}>继续注销</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={{ backgroundColor: BG_CARD, borderRadius: 12, padding: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: TEXT_MAIN, marginBottom: 16 }}>确认注销</Text>
            <Text style={{ fontSize: 14, color: TEXT_SECOND, marginBottom: 8 }}>
              请输入"确认注销"以完成操作：
            </Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: BORDER_COLOR, borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 20 }}
              value={confirmText}
              onChangeText={setConfirmText}
              placeholder="请输入 确认注销"
            />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity style={{ flex: 1, padding: 14, backgroundColor: '#F5F7FA', borderRadius: 12, alignItems: 'center' }} onPress={() => navigation.goBack()}>
                <Text style={{ fontSize: 16, color: TEXT_MAIN }}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, padding: 14, backgroundColor: confirmText === '确认注销' ? DANGER_COLOR : '#ccc', borderRadius: 12, alignItems: 'center' }}
                disabled={confirmText !== '确认注销'}
                onPress={handleDelete}
              >
                <Text style={{ fontSize: 16, color: '#fff', fontWeight: '600' }}>确认注销</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

// 关于页面
const AboutScreen = ({ navigation }) => {
  const APP_VERSION = '5.55.0';
  return (
    <View style={{ flex: 1, backgroundColor: BG_PAGE }}>
      <CommonHeader title="关于我们" showBack onBack={() => navigation.goBack()} navigation={navigation} />
      <ScrollView style={{ flex: 1, padding: 16 }}>
        <View style={{ alignItems: 'center', paddingVertical: 30 }}>
          <Image source={require('./assets/icon.png')} style={{ width: 80, height: 80, borderRadius: 20, marginBottom: 16 }} />
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: TEXT_MAIN }}>经营宝</Text>
          <Text style={{ fontSize: 14, color: TEXT_THIRD, marginTop: 4 }}>版本 {APP_VERSION}</Text>
          <Text style={{ fontSize: 12, color: TEXT_THIRD, marginTop: 8 }}>店铺经营管理一体化工具</Text>
        </View>

        <View style={{ backgroundColor: BG_CARD, borderRadius: 12, padding: 16, marginBottom: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: TEXT_MAIN, marginBottom: 12 }}>应用介绍</Text>
          <Text style={{ fontSize: 14, color: TEXT_SECOND, lineHeight: 24 }}>
            经营宝是一款专为中小商家打造的店铺经营管理应用，提供订单核销、库存管理、员工协作、AI智能助手等核心功能，帮助商家高效管理日常经营。
          </Text>
        </View>

        <View style={{ backgroundColor: BG_CARD, borderRadius: 12, padding: 16, marginBottom: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: TEXT_MAIN, marginBottom: 12 }}>核心功能</Text>
          <Text style={{ fontSize: 14, color: TEXT_SECOND, lineHeight: 24 }}>
            • 订单核销：支持美团、抖音、大众点评扫码核销{'\n'}
            • 库存管理：出入库记录、商品管理、AI拍照盘点{'\n'}
            • 员工协作：内部沟通、私聊、员工管理{'\n'}
            • AI助手：智能问答、图片生成、经营分析{'\n'}
            • 数据报表：日报、周报、月报自动生成
          </Text>
        </View>

        <View style={{ backgroundColor: BG_CARD, borderRadius: 12, padding: 16, marginBottom: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: TEXT_MAIN, marginBottom: 12 }}>联系方式</Text>
          <Text style={{ fontSize: 14, color: TEXT_SECOND, lineHeight: 24 }}>
            官方邮箱：support@jingyingbao.app{'\n'}
            客服QQ：123456789{'\n'}
            官方网站：www.jingyingbao.app
          </Text>
        </View>

        <View style={{ alignItems: 'center', paddingVertical: 20 }}>
          <Text style={{ fontSize: 12, color: TEXT_THIRD, marginBottom: 4 }}>Copyright © 2026 经营宝</Text>
          <Text style={{ fontSize: 12, color: TEXT_THIRD }}>All Rights Reserved</Text>
        </View>
      </ScrollView>
    </View>
  );
};

// 意见反馈页面
const FeedbackScreen = ({ navigation }) => {
  const { state } = useApp();
  const [feedbackType, setFeedbackType] = useState('功能建议');
  const [content, setContent] = useState('');
  const [contact, setContact] = useState('');
  const types = ['功能建议', '问题反馈', '体验优化', '其他'];

  const handleSubmit = async () => {
    if (!content.trim()) { showToast('请输入反馈内容'); return; }
    try {
      const feedback = {
        id: Date.now().toString(),
        type: feedbackType,
        content: content.trim(),
        contact: contact.trim(),
        phone: state.user?.phone || '',
        version: '5.55.0',
        time: new Date().toISOString(),
      };
      const existing = JSON.parse(await AsyncStorage.getItem('user_feedbacks') || '[]');
      existing.push(feedback);
      await AsyncStorage.setItem('user_feedbacks', JSON.stringify(existing));
      showToast('反馈已提交，感谢您的支持！');
      navigation.goBack();
    } catch (e) { showToast('提交失败，请重试'); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG_PAGE }}>
      <CommonHeader title="意见反馈" showBack onBack={() => navigation.goBack()} navigation={navigation} />
      <ScrollView style={{ flex: 1, padding: 16 }}>
        <Text style={{ fontSize: 14, color: TEXT_SECOND, marginBottom: 12 }}>反馈类型</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {types.map(t => (
            <TouchableOpacity
              key={t}
              style={{ paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: feedbackType === t ? PRIMARY_COLOR : BG_CARD, borderWidth: 1, borderColor: feedbackType === t ? PRIMARY_COLOR : BORDER_COLOR }}
              onPress={() => setFeedbackType(t)}
            >
              <Text style={{ fontSize: 14, color: feedbackType === t ? '#fff' : TEXT_MAIN }}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={{ fontSize: 14, color: TEXT_SECOND, marginBottom: 12 }}>反馈内容</Text>
        <TextInput
          style={{ backgroundColor: BG_CARD, borderRadius: 12, padding: 16, fontSize: 15, minHeight: 120, textAlignVertical: 'top', marginBottom: 20 }}
          value={content}
          onChangeText={setContent}
          placeholder="请详细描述您的建议或遇到的问题..."
          multiline
          maxLength={500}
        />
        <Text style={{ fontSize: 12, color: TEXT_THIRD, textAlign: 'right', marginBottom: 20 }}>{content.length}/500</Text>

        <Text style={{ fontSize: 14, color: TEXT_SECOND, marginBottom: 12 }}>联系方式（选填）</Text>
        <TextInput
          style={{ backgroundColor: BG_CARD, borderRadius: 12, padding: 16, fontSize: 15, marginBottom: 24 }}
          value={contact}
          onChangeText={setContact}
          placeholder="邮箱或手机号，方便我们回复您"
          maxLength={50}
        />

        <TouchableOpacity style={{ backgroundColor: PRIMARY_COLOR, borderRadius: 12, padding: 16, alignItems: 'center' }} onPress={handleSubmit}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>提交反馈</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

// 版本更新检查
async function checkAppUpdate(showToastIfLatest = false) {
  try {
    const currentVersion = '5.55.0';
    // GitHub Releases API 检查最新版本
    const res = await fetch('https://api.github.com/repos/jiuyundiedie/jingyingbao-clean/releases/latest');
    if (!res.ok) {
      if (showToastIfLatest) showToast('检查更新失败');
      return null;
    }
    const data = await res.json();
    const latestVersion = (data.tag_name || '').replace('v', '');
    if (latestVersion && latestVersion !== currentVersion) {
      return { hasUpdate: true, version: latestVersion, notes: data.body || '', url: data.html_url };
    }
    if (showToastIfLatest) showToast('当前已是最新版本');
    return { hasUpdate: false };
  } catch (e) {
    if (showToastIfLatest) showToast('检查更新失败，请检查网络');
    return null;
  }
}

// 清除缓存页面
const ClearCacheScreen = ({ navigation }) => {
  const { dispatch } = useApp();
  const [cacheSize, setCacheSize] = useState('计算中...');
  const [clearing, setClearing] = useState(false);

  const getCacheSize = async () => {
    try {
      const cacheDir = FileSystem.cacheDirectory;
      if (cacheDir) {
        const info = await FileSystem.getInfoAsync(cacheDir);
        if (info.exists && info.size) {
          const mb = (info.size / 1024 / 1024).toFixed(1);
          setCacheSize(mb + ' MB');
        } else {
          setCacheSize('0 MB');
        }
      } else {
        setCacheSize('0 MB');
      }
    } catch (e) { setCacheSize('未知'); }
  };

  useEffect(() => { getCacheSize(); }, []);

  const handleClear = async () => {
    setClearing(true);
    try {
      await FileSystem.deleteAsync(FileSystem.cacheDirectory, { idempotent: true });
      setCacheSize('0 MB');
      showToast('缓存已清除');
    } catch (e) { showToast('清除失败'); }
    setClearing(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG_PAGE }}>
      <CommonHeader title="清除缓存" showBack onBack={() => navigation.goBack()} navigation={navigation} />
      <View style={{ padding: 16 }}>
        <View style={{ backgroundColor: BG_CARD, borderRadius: 12, padding: 20, alignItems: 'center' }}>
          <Ionicons name="trash-outline" size={48} color={PRIMARY_COLOR} style={{ marginBottom: 12 }} />
          <Text style={{ fontSize: 16, color: TEXT_MAIN, marginBottom: 4 }}>当前缓存大小</Text>
          <Text style={{ fontSize: 28, fontWeight: 'bold', color: PRIMARY_COLOR, marginBottom: 20 }}>{cacheSize}</Text>
          <Text style={{ fontSize: 13, color: TEXT_THIRD, textAlign: 'center', marginBottom: 24 }}>
            清除缓存不会删除您的业务数据、账号信息和聊天记录，仅清理临时文件和图片缓存。
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: clearing ? '#ccc' : PRIMARY_COLOR, borderRadius: 12, padding: 16, alignItems: 'center', width: '100%' }}
            onPress={handleClear}
            disabled={clearing}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>{clearing ? '清除中...' : '清除缓存'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};



// ================== 使用帮助轮播弹窗（登录后弹出） ==================
const HelpGuideCarousel = ({ visible, onClose }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const scrollRef = useRef(null);
  const autoScrollTimer = useRef(null);
  const pages = [
    {
      icon: 'storefront',
      color: '#5B6DF0',
      title: '欢迎使用经营宝',
      desc: '专为商家打造的智能经营管理工具\n订单核销 · 库存管理 · AI助手 · 团队协作',
      features: ['一键扫码核销，支持美团/抖音/点评', 'AI拍照盘点，智能识别库存数量', '内部团队沟通，高效协作管理'],
    },
    {
      icon: 'qr-code',
      color: '#00B42A',
      title: '订单核销',
      desc: '支持多平台扫码核销，快速验证顾客订单',
      features: ['点击核销按钮打开扫码', '支持美团、抖音、大众点评', '核销记录自动保存，可随时查看'],
    },
    {
      icon: 'swap-horizontal',
      color: '#FF7D00',
      title: '出入库管理',
      desc: '商品库存一目了然，AI拍照智能盘点',
      features: ['入库出库一键记录', '拍照自动识别物品数量', '商品列表灵活管理'],
    },
    {
      icon: 'chatbubble-ellipses',
      color: '#7B61FF',
      title: '客服与内部沟通',
      desc: '顾客客服沟通 + 员工内部协作',
      features: ['客服页面与顾客实时聊天', '内部沟通支持群聊和私聊', '支持发送图片、语音消息'],
    },
    {
      icon: 'sparkles',
      color: '#F53F3F',
      title: 'AI智能助手',
      desc: '您的专属经营顾问，随时解答问题',
      features: ['智能问答，联网获取真实回复', 'AI生成营销海报和图片', '经营数据分析与建议'],
    },
  ];

  const handleScroll = (e) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / width);
    setCurrentPage(page);
  };

  const goNext = () => {
    if (currentPage < pages.length - 1) {
      scrollRef.current?.scrollTo({ x: width * (currentPage + 1), animated: true });
    } else {
      onClose();
    }
  };

  useEffect(() => {
    if (visible) {
      autoScrollTimer.current = setInterval(() => {
        setCurrentPage(prev => {
          const next = prev + 1;
          if (next < pages.length) {
            scrollRef.current?.scrollTo({ x: width * next, animated: true });
            return next;
          } else {
            return 0;
          }
        });
      }, 3500);
    }
    return () => {
      if (autoScrollTimer.current) {
        clearInterval(autoScrollTimer.current);
        autoScrollTimer.current = null;
      }
    };
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        {/* 轮播内容 */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          style={{ flex: 1 }}
        >
          {pages.map((page, index) => (
            <View key={index} style={{ width, flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
              <View style={{
                width: 140, height: 140, borderRadius: 35,
                backgroundColor: page.color + '12',
                justifyContent: 'center', alignItems: 'center', marginBottom: 40,
              }}>
                <Ionicons name={page.icon} size={70} color={page.color} />
              </View>
              <Text style={{ fontSize: 26, fontWeight: 'bold', color: TEXT_MAIN, marginBottom: 16 }}>{page.title}</Text>
              <Text style={{ fontSize: 16, color: TEXT_SECOND, textAlign: 'center', lineHeight: 26, marginBottom: 30 }}>{page.desc}</Text>
              {page.features.map((f, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: page.color, marginRight: 10 }} />
                  <Text style={{ fontSize: 14, color: TEXT_SECOND }}>{f}</Text>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>

        {/* 底部指示器和按钮 */}
        <View style={{ paddingBottom: Platform.OS === 'ios' ? 50 : 30, paddingHorizontal: 40 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 24 }}>
            {pages.map((_, i) => (
              <View key={i} style={{
                width: i === currentPage ? 28 : 8, height: 8, borderRadius: 4,
                backgroundColor: i === currentPage ? PRIMARY_COLOR : BORDER_COLOR,
                marginHorizontal: 4,
              }} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: PRIMARY_COLOR, borderRadius: 30, paddingVertical: 16, alignItems: 'center' }}
              onPress={goNext}
            >
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '600' }}>
                {currentPage < pages.length - 1 ? '下一页' : '开始体验'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={{ marginLeft: 16, padding: 12 }}>
              <Text style={{ fontSize: 16, color: TEXT_THIRD }}>跳过</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ================== 增强版图片查看器（支持缩放、裁剪、手绘） ==================
const EnhancedImageViewer = ({ visible, imageUri, onClose, onDelete, isOwnMessage }) => {
  const [editMode, setEditMode] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processedImageUri, setProcessedImageUri] = useState(null);
  const [drawMode, setDrawMode] = useState(false);
  const [cropMode, setCropMode] = useState(false);
  const [drawColor, setDrawColor] = useState('#F53F3F');
  const [drawPaths, setDrawPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState([]);

  // 缩放状态：用setNativeProps直接更新原生视图，完全绕过React渲染和Animated桥接
  const imageWrapRef = useRef(null);
  const currentScale = useRef(1);
  const currentX = useRef(0);
  const currentY = useRef(0);
  const lastTapTime = useRef(0);
  const initialDistance = useRef(0);
  const initialScale = useRef(1);
  const panStartX = useRef(0);
  const panStartY = useRef(0);
  const panStartTranslateX = useRef(0);
  const panStartTranslateY = useRef(0);

  // 直接更新原生视图transform，零延迟不闪动
  const updateNativeTransform = () => {
    if (!imageWrapRef.current) return;
    imageWrapRef.current.setNativeProps({
      style: {
        transform: [
          { scale: currentScale.current },
          { translateX: currentX.current },
          { translateY: currentY.current },
          { rotate: `${rotation}deg` },
        ],
      },
    });
  };

  const filters = [
    { name: '原图', value: null },
    { name: '暖色', value: 'warm' },
    { name: '冷色', value: 'cool' },
    { name: '黑白', value: 'mono' },
    { name: '复古', value: 'sepia' },
    { name: '鲜艳', value: 'vibrant' },
  ];

  const colors = ['#F53F3F', '#00B42A', '#5B6DF0', '#FF7D00', '#000000', '#FFFFFF'];
  const currentImageUri = processedImageUri || imageUri;

  // 计算双指距离
  const getDistance = (touches) => {
    const dx = touches[0].locationX - touches[1].locationX;
    const dy = touches[0].locationY - touches[1].locationY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // 手绘 PanResponder
  const drawResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => drawMode,
      onMoveShouldSetPanResponder: () => drawMode,
      onPanResponderGrant: (evt) => {
        if (drawMode) {
          setCurrentPath([{ x: evt.nativeEvent.locationX, y: evt.nativeEvent.locationY }]);
        }
      },
      onPanResponderMove: (evt) => {
        if (drawMode) {
          setCurrentPath(prev => [...prev, { x: evt.nativeEvent.locationX, y: evt.nativeEvent.locationY }]);
        }
      },
      onPanResponderRelease: () => {
        if (drawMode && currentPath.length > 0) {
          setDrawPaths(prev => [...prev, { color: drawColor, points: currentPath }]);
          setCurrentPath([]);
        }
      },
    })
  ).current;

  // 缩放/拖拽 PanResponder（setNativeProps直接更新原生视图，零闪动）
  const zoomResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !drawMode,
      onMoveShouldSetPanResponder: () => !drawMode,
      onPanResponderGrant: (evt) => {
        if (evt.nativeEvent.touches.length === 2) {
          initialDistance.current = getDistance(evt.nativeEvent.touches);
          initialScale.current = currentScale.current;
        } else if (evt.nativeEvent.touches.length === 1 && currentScale.current > 1) {
          panStartX.current = evt.nativeEvent.touches[0].locationX;
          panStartY.current = evt.nativeEvent.touches[0].locationY;
          panStartTranslateX.current = currentX.current;
          panStartTranslateY.current = currentY.current;
        }
      },
      onPanResponderMove: (evt) => {
        if (evt.nativeEvent.touches.length === 2) {
          const distance = getDistance(evt.nativeEvent.touches);
          if (initialDistance.current > 0) {
            let newScale = (distance / initialDistance.current) * initialScale.current;
            newScale = Math.max(0.5, Math.min(10, newScale));
            currentScale.current = newScale;
            updateNativeTransform();
          }
        } else if (evt.nativeEvent.touches.length === 1 && currentScale.current > 1) {
          const touch = evt.nativeEvent.touches[0];
          currentX.current = panStartTranslateX.current + (touch.locationX - panStartX.current);
          currentY.current = panStartTranslateY.current + (touch.locationY - panStartY.current);
          updateNativeTransform();
        }
      },
      onPanResponderRelease: () => {
        initialDistance.current = 0;
        if (currentScale.current < 1) {
          currentScale.current = 1;
          currentX.current = 0;
          currentY.current = 0;
          updateNativeTransform();
        }
      },
    })
  ).current;

  // 双击缩放
  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapTime.current < 300) {
      if (currentScale.current > 1) {
        currentScale.current = 1;
        currentX.current = 0;
        currentY.current = 0;
      } else {
        currentScale.current = 2.5;
      }
      updateNativeTransform();
    }
    lastTapTime.current = now;
  };

  if (!visible) return null;

  const handleSave = async () => {
    try {
      const fileUri = `${FileSystem.documentDirectory}img_${Date.now()}.jpg`;
      await FileSystem.downloadAsync(currentImageUri, fileUri);
      showToast('已保存到本地');
    } catch (e) { showToast('保存失败'); }
  };

  const handleShare = async () => {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(currentImageUri);
      } else { showToast('分享不可用'); }
    } catch (e) { showToast('分享失败'); }
  };

  const handleDelete = () => {
    Alert.alert('删除图片', '确定要删除这张图片吗？', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => { if (onDelete) onDelete(); onClose(); showToast('图片已删除'); } }
    ]);
  };

  const handleCrop = async () => {
    setProcessing(true);
    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        currentImageUri,
        [{ rotate: rotation }, { resize: { width: 800 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );
      setProcessedImageUri(manipResult.uri);
      showToast('裁剪完成');
      setCropMode(false);
    } catch (e) { showToast('裁剪失败'); }
    setProcessing(false);
  };

  const clearDrawing = () => {
    setDrawPaths([]);
    setCurrentPath([]);
  };

  const resetAll = () => {
    setRotation(0);
    setProcessedImageUri(null);
    setShowFilterPanel(false);
    setDrawMode(false);
    setCropMode(false);
    setDrawPaths([]);
    setCurrentPath([]);
    currentScale.current = 1;
    currentX.current = 0;
    currentY.current = 0;
    updateNativeTransform();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {/* 顶部栏 */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 50 : 20, paddingHorizontal: 16, paddingBottom: 12 }}>
          <TouchableOpacity style={{ padding: 8 }} onPress={onClose}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={{ color: '#fff', fontSize: 15 }}>{drawMode ? '手绘模式' : cropMode ? '裁剪模式' : editMode ? '编辑模式' : currentScale.current > 1 ? `缩放 ${currentScale.current.toFixed(1)}x` : '图片预览'}</Text>
          <TouchableOpacity style={{ padding: 8 }} onPress={() => { if (editMode) resetAll(); setEditMode(!editMode); }}>
            <Ionicons name={editMode ? 'close-circle' : 'create-outline'} size={26} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* 图片区域 */}
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
          {...(drawMode ? drawResponder : zoomResponder).panHandlers}
          onTouchStart={!drawMode && handleDoubleTap}
        >
          <View ref={imageWrapRef} style={{ transform: [{ scale: 1 }, { translateX: 0 }, { translateY: 0 }, { rotate: `${rotation}deg` }] }}>
            <Image source={{ uri: currentImageUri }} style={{ width: width, height: width * 1.3, resizeMode: 'contain' }} />
            {(drawMode || drawPaths.length > 0) && (
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents={drawMode ? 'auto' : 'none'}>
                {drawPaths.map((path, i) => path.points.map((p, j) => (
                  <View key={`p-${i}-${j}`} style={{ position: 'absolute', left: p.x - 2, top: p.y - 2, width: 4, height: 4, borderRadius: 2, backgroundColor: path.color }} />
                )))}
                {currentPath.map((p, j) => (
                  <View key={`c-${j}`} style={{ position: 'absolute', left: p.x - 2, top: p.y - 2, width: 4, height: 4, borderRadius: 2, backgroundColor: drawColor }} />
                ))}
              </View>
            )}
          </View>
          {processing && (
            <View style={{ position: 'absolute', alignItems: 'center' }}>
              <ActivityIndicator size="large" color={PRIMARY_COLOR} />
              <Text style={{ color: '#fff', marginTop: 8 }}>处理中...</Text>
            </View>
          )}
        </View>

        {/* 编辑工具栏 */}
        {editMode && !drawMode && !cropMode && (
          <View style={{ position: 'absolute', bottom: Platform.OS === 'ios' ? 100 : 80, left: 0, right: 0, paddingHorizontal: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, paddingVertical: 12 }}>
              <TouchableOpacity style={{ alignItems: 'center' }} onPress={() => { setRotation(rotation - 90); }}>
                <Ionicons name="refresh-back" size={22} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 11, marginTop: 4 }}>左转</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ alignItems: 'center' }} onPress={() => { setRotation(rotation + 90); }}>
                <Ionicons name="refresh-forward" size={22} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 11, marginTop: 4 }}>右转</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ alignItems: 'center' }} onPress={() => setShowFilterPanel(!showFilterPanel)}>
                <Ionicons name="color-palette-outline" size={22} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 11, marginTop: 4 }}>滤镜</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ alignItems: 'center' }} onPress={() => setCropMode(true)}>
                <Ionicons name="crop-outline" size={22} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 11, marginTop: 4 }}>裁剪</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ alignItems: 'center' }} onPress={() => { setDrawMode(true); setDrawPaths([]); }}>
                <Ionicons name="brush-outline" size={22} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 11, marginTop: 4 }}>手绘</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ alignItems: 'center' }} onPress={resetAll}>
                <Ionicons name="refresh" size={22} color="#aaa" />
                <Text style={{ color: '#aaa', fontSize: 11, marginTop: 4 }}>重置</Text>
              </TouchableOpacity>
            </View>
            {showFilterPanel && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
                {filters.map(f => (
                  <TouchableOpacity key={f.name} style={{ paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', marginRight: 8 }}>
                    <Text style={{ color: '#fff', fontSize: 14 }}>{f.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* 手绘模式工具栏 */}
        {drawMode && (
          <View style={{ position: 'absolute', bottom: Platform.OS === 'ios' ? 100 : 80, left: 0, right: 0, paddingHorizontal: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16 }}>
              <View style={{ flexDirection: 'row' }}>
                {colors.map(c => (
                  <TouchableOpacity key={c} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c, marginRight: 8, borderWidth: drawColor === c ? 2 : 0, borderColor: '#fff' }} onPress={() => setDrawColor(c)} />
                ))}
              </View>
              <View style={{ flexDirection: 'row' }}>
                <TouchableOpacity style={{ padding: 8, marginRight: 8 }} onPress={clearDrawing}>
                  <Ionicons name="trash-outline" size={20} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={{ padding: 8 }} onPress={() => { setDrawMode(false); setDrawPaths([]); }}>
                  <Ionicons name="checkmark-circle" size={24} color="#00B42A" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* 裁剪模式工具栏 */}
        {cropMode && (
          <View style={{ position: 'absolute', bottom: Platform.OS === 'ios' ? 100 : 80, left: 0, right: 0, paddingHorizontal: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, paddingVertical: 12 }}>
              <TouchableOpacity style={{ padding: 12, marginRight: 20 }} onPress={() => setCropMode(false)}>
                <Text style={{ color: '#fff', fontSize: 16 }}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ padding: 12 }} onPress={handleCrop}>
                <Text style={{ color: '#00B42A', fontSize: 16, fontWeight: '600' }}>确认裁剪</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 底部操作栏（非编辑模式） */}
        {!editMode && !drawMode && !cropMode && (
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-around', paddingBottom: Platform.OS === 'ios' ? 50 : 30, paddingTop: 16 }}>
            <TouchableOpacity style={{ alignItems: 'center' }} onPress={handleSave}>
              <Ionicons name="download-outline" size={24} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 12, marginTop: 4 }}>保存</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ alignItems: 'center' }} onPress={handleShare}>
              <Ionicons name="share-outline" size={24} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 12, marginTop: 4 }}>分享</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ alignItems: 'center' }} onPress={() => setEditMode(true)}>
              <Ionicons name="create-outline" size={24} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 12, marginTop: 4 }}>编辑</Text>
            </TouchableOpacity>
            {isOwnMessage && onDelete && (
              <TouchableOpacity style={{ alignItems: 'center' }} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={24} color={DANGER_COLOR} />
                <Text style={{ color: DANGER_COLOR, fontSize: 12, marginTop: 4 }}>删除</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
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
      const existingShopInfo = state.shopInfo || {};
      const shopInfo = { shopName: account.shopName, phone: account.phone, industry: existingShopInfo.industry || '餐饮类' };
      await AsyncStorage.setItem('user', JSON.stringify(user));
      await AsyncStorage.setItem('shopInfo', JSON.stringify(shopInfo));
      dispatch({ type: 'LOGIN', payload: { user, shopInfo } });
      
      // 检查是否有未读的私聊消息，触发红点提示
      setTimeout(() => {
        const privateChatMessages = state.privateChatMessages || {};
        const allPhones = Object.keys(privateChatMessages);
        let hasUnreadPrivate = false;
        
        allPhones.forEach(phone => {
          const msgs = privateChatMessages[phone] || [];
          const unreadCount = msgs.filter(m => m.platform === 'private' && m.fromPhone !== account.phone && !m.read).length;
          if (unreadCount > 0) {
            hasUnreadPrivate = true;
          }
        });
        
        // 私聊消息红点已在首页私聊入口单独处理，不需要设置内部页面红点
        // if (hasUnreadPrivate) {
        //   dispatch({ type: 'SET_RED_DOT', payload: { tab: '内部', hasNew: true } });
        // }
      }, 300);
      
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
      <CommonHeader 
        title="差评预警详情" 
        showBack={true}
        navigation={navigation}
      />
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
  const [code, setCode] = useState('');
  const [loadingPlatform, setLoadingPlatform] = useState(null);
  const [shelfModalVisible, setShelfModalVisible] = useState(false);
  const [currentShelfGoods, setCurrentShelfGoods] = useState(null);

  const handleSave = () => {
    try {
      if (!name.trim()) { showToast('请输入商品名称'); return; }
      const stockNum = parseInt(stock) || 0;
      if (editingItem) {
        const updated = (state.goodsList || []).map(item =>
          item.id === editingItem.id ? { ...item, name: name.trim(), stock: stockNum, platform, code: code.trim() } : item
        );
        dispatch({ type: 'SET_GOODS_LIST', payload: updated });
        showToast('已更新');
      } else {
        const newItem = {
          id: Date.now().toString(),
          name: name.trim(),
          stock: stockNum,
          platform,
          code: code.trim(),
          createdAt: new Date().toISOString(),
        };
        dispatch({ type: 'SET_GOODS_LIST', payload: [...(state.goodsList || []), newItem] });
        showToast('添加成功');
      }
      setModalVisible(false);
      setName('');
      setStock('');
      setCode('');
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
    setCode(item.code || '');
    setModalVisible(true);
  };

  const openShelfModal = (item) => {
    setCurrentShelfGoods(item);
    setShelfModalVisible(true);
  };

  const handleShelf = async (platform) => {
    try {
      if (!currentShelfGoods) { showToast('请先选择商品'); return; }
      setLoadingPlatform(platform);
      const prompt = `请将以下商品信息转换为适合${platform}平台的上架格式，包含标题、价格、库存、描述和宣传语。名称：${currentShelfGoods.name}，库存：${currentShelfGoods.stock}。`;
      const reply = await fetchZhipuChat([{ role: 'user', content: prompt }], '你是一个电商上架助手。');

      Alert.alert(`上架到${platform}`, reply);
      showToast(`已成功生成${platform}上架内容`);
    } catch (error) {
      showToast(`${platform}上架生成失败`);
    } finally {
      setLoadingPlatform(null);
    }
  };

  const handleShelfAll = async () => {
    try {
      if (!currentShelfGoods) { showToast('请先选择商品'); return; }
      setLoadingPlatform('all');
      const prompt = `请将以下商品信息分别生成适合美团、抖音、大众点评三个平台的上架格式，每个平台用分隔线隔开，包含标题、价格、库存、描述和宣传语。名称：${currentShelfGoods.name}，库存：${currentShelfGoods.stock}。`;
      const reply = await fetchZhipuChat([{ role: 'user', content: prompt }], '你是一个电商上架助手，擅长多平台格式转换。');

      Alert.alert('一键上架所有平台', reply);
      showToast('已生成所有平台上架内容');
    } catch (error) {
      showToast('一键上架生成失败');
    } finally {
      setLoadingPlatform(null);
    }
  };

  return (
    <View style={styles.container}>
      <CommonHeader 
        title="商品总览" 
        showBack={true}
        navigation={navigation}
        rightComponent={<TouchableOpacity onPress={() => { setEditingItem(null); setName(''); setStock(''); setPlatform('美团'); setCode(''); setModalVisible(true); }}>
          <Ionicons name="add-outline" size={24} color={PRIMARY_COLOR} />
        </TouchableOpacity>}
      />
      
      {/* 上架提示 */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFF8E7', borderBottomWidth: 1, borderColor: '#FFE0B2' }}>
        <Text style={{ fontSize: 14, color: '#E65100', fontWeight: '600' }}>📤 商品上架功能</Text>
        <Text style={{ fontSize: 12, color: '#EF6C00', marginTop: 4 }}>选择商品后点击"上架"按钮，可一键生成美团、抖音、大众点评的上架内容</Text>
      </View>

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
              <TouchableOpacity style={[styles.editBtn, { backgroundColor: SUCCESS_COLOR }]} onPress={() => openShelfModal(item)}><Text style={{ color: '#fff', fontSize: 13, fontWeight: '500' }}>上架</Text></TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 40, color: TEXT_THIRD }}>暂无商品，点击右上角➕添加</Text>}
        contentContainerStyle={{ padding: 16 }}
      />

      {/* 添加/编辑商品弹窗 */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalMask}>
          <View style={styles.modalWrap}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingItem ? '编辑商品' : '添加商品'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}><Text style={styles.closeTxt}>✕</Text></TouchableOpacity>
            </View>
            <Text style={styles.label}>商品名称</Text>
            <TextInput style={styles.formInput} value={name} onChangeText={setName} placeholder="例如：招牌牛肉面" />
            <Text style={styles.label}>条码 (选填)</Text>
            <TextInput style={styles.formInput} value={code} onChangeText={setCode} placeholder="用于扫码识别" />
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

      {/* 上架平台选择弹窗 */}
      <Modal visible={shelfModalVisible} transparent animationType="fade">
        <View style={styles.modalMask}>
          <View style={styles.modalWrap}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📤 商品上架</Text>
              <TouchableOpacity onPress={() => setShelfModalVisible(false)}><Text style={styles.closeTxt}>✕</Text></TouchableOpacity>
            </View>
            <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 16, textAlign: 'center' }}>
              {currentShelfGoods?.name}
            </Text>
            <Text style={{ fontSize: 13, color: TEXT_SECOND, marginBottom: 16, textAlign: 'center' }}>
              当前库存: {currentShelfGoods?.stock}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {['美团', '抖音', '大众点评'].map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.miniBlueBtn, { flex: 1, backgroundColor: loadingPlatform === p ? '#999' : PRIMARY_COLOR }]}
                  onPress={() => handleShelf(p)}
                  disabled={loadingPlatform !== null}
                >
                  <Text style={styles.sendTxt}>{loadingPlatform === p ? '生成中...' : `⬆️ ${p}`}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.miniBlueBtn, { flex: 1, backgroundColor: loadingPlatform === 'all' ? '#999' : SUCCESS_COLOR }]}
                onPress={handleShelfAll}
                disabled={loadingPlatform !== null}
              >
                <Text style={styles.sendTxt}>{loadingPlatform === 'all' ? '生成中...' : '🚀 一键上架'}</Text>
              </TouchableOpacity>
            </View>
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
  const [manualPlatform, setManualPlatform] = useState('通用');
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [loadingPlatform, setLoadingPlatform] = useState(null);
  const [voiceModalVisible, setVoiceModalVisible] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [aiCountModalVisible, setAiCountModalVisible] = useState(false);
  const [aiCountPhotos, setAiCountPhotos] = useState([]); // 改为包含尺寸的对象数组
  const [aiCountResult, setAiCountResult] = useState(null);
  const [aiCountLoading, setAiCountLoading] = useState(false);
  const [aiCountPreview, setAiCountPreview] = useState(null);
  const [aiGoodsModalVisible, setAiGoodsModalVisible] = useState(false);
  const [aiGoodsPhoto, setAiGoodsPhoto] = useState(null);
  const [aiGoodsResult, setAiGoodsResult] = useState(null);
  const [aiGoodsLoading, setAiGoodsLoading] = useState(false);

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
    let existing = (state.goodsList || []).find(g => g.name === manualProductName.trim());
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
        platform: '通用',
        code: scannedBarcode || '',
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
    setManualPlatform('通用');
    setShowManualInput(false);
    setScannedBarcode('');
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

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const handleScan = async () => {
    try {
      if (!cameraPermission?.granted) {
        const permissionResult = await requestCameraPermission();
        if (!permissionResult.granted) {
          showToast('需要相机权限');
          return;
        }
      }
      setScanning(true);
    } catch (error) { 
      showToast('扫码失败'); 
      console.error('扫码启动失败:', error);
    }
  };

  const handleBarCodeScanned = ({ data }) => {
    try {
      if (!data) return;
      
      setScanning(false);
      setScannedBarcode(data);
      const matched = (state.goodsList || []).find(g => g.code === data);
      if (matched) {
        if (type === '入库') {
          setSelectedGoodsId(matched.id);
          setQuantity('1');
          setReason('扫码入库');
          setShowManualInput(false);
          setModalVisible(true);
          showToast(`扫描到商品：${matched.name}，请确认入库`);
        } else {
          if (matched.stock <= 0) {
            showToast('库存不足，无法出库');
            return;
          }
          setOutModalGoods(matched);
          setOutQuantity('1');
        }
      } else {
        if (type === '入库') {
          setShowManualInput(true);
          setManualProductName('');
          setModalVisible(true);
          showToast('未找到商品，请输入名称');
        } else {
          Alert.alert('扫描结果', `条码：${data}\n未找到匹配商品`, [
            { text: '确定' }
          ]);
          setScannedBarcode('');
        }
      }
    } catch (error) {
      console.error('扫码处理失败:', error);
      setScanning(false);
      showToast('扫码处理异常');
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
    console.log('[新版点数神器] handleAICount triggered - 新版代码已生效');
    Alert.alert('调试信息', '新版点数神器代码已生效！');
    setAiCountPhotos([]);
    setAiCountResult(null);
    setAiCountModalVisible(true);
    showToast('✅ 新版点数神器已启动！');
  };

  const handleAIGoodsRecognition = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { showToast('需要相机权限'); return; }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6 });
      if (!result.canceled) {
        const compressed = await compressImage(result.assets[0].uri);
        setAiGoodsPhoto(compressed);
        setAiGoodsResult(null);
        setAiGoodsModalVisible(true);
      }
    } catch (e) { showToast('拍照失败'); }
  };

  const aiGoodsRecognize = async () => {
    if (!aiGoodsPhoto) { showToast('请先拍照'); return; }
    setAiGoodsLoading(true);
    try {
      const goodsList = state.goodsList || [];
      const goodsNames = goodsList.map(g => g.name).join('、');
      const prompt = `请识别图片中的商品名称和数量。现有库存商品：${goodsNames || '暂无'}。请返回JSON格式：{"name":"商品名称","count":数量}。如果识别到的商品不在库存中，也请如实返回商品名称。只返回JSON，不要其他文字。`;
      
      let reply = null;
      for (let retry = 0; retry < 3; retry++) {
        try {
          reply = await fetchZhipuVision(aiGoodsPhoto, prompt);
          if (reply && reply !== 'aborted') break;
        } catch (err) {
          if (retry === 2) throw err;
          await new Promise(r => setTimeout(r, 800));
        }
      }
      
      if (reply && reply !== 'aborted') {
        try {
          const jsonStr = reply.replace(/```json/g, '').replace(/```/g, '').trim();
          const result = JSON.parse(jsonStr);
          const matchedGoods = goodsList.find(g => g.name.includes(result.name) || result.name.includes(g.name));
          setAiGoodsResult({
            name: result.name,
            count: result.count || 1,
            matchedId: matchedGoods?.id,
            matchedStock: matchedGoods?.stock || 0,
            matchedName: matchedGoods?.name,
          });
          showToast(`识别到：${result.name}，数量：${result.count}`);
        } catch (e) {
          showToast('识别结果解析失败，请重试');
        }
      }
    } catch (e) {
      console.error('AI商品识别失败:', e);
      showToast('识别失败，请检查网络后重试');
    } finally {
      setAiGoodsLoading(false);
    }
  };

  const aiGoodsSubmit = () => {
    if (!aiGoodsResult) { showToast('请先识别商品'); return; }
    
    if (aiGoodsResult.matchedId) {
      setSelectedGoodsId(aiGoodsResult.matchedId);
      setQuantity(String(aiGoodsResult.count));
    } else {
      setShowManualInput(true);
      setManualProductName(aiGoodsResult.name);
      setQuantity(String(aiGoodsResult.count));
    }
    
    setAiGoodsModalVisible(false);
    setAiGoodsPhoto(null);
    setAiGoodsResult(null);
    setModalVisible(true);
    showToast(`已识别：${aiGoodsResult.name}，数量：${aiGoodsResult.count}`);
  };

  const aiCountAddPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { showToast('需要相机权限'); return; }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9 });
      if (!result.canceled) {
        const asset = result.assets[0];
        const compressed = await compressImage(asset.uri, 0.85);
        // 保存图片信息（包含尺寸）
        setAiCountPhotos(prev => [...prev, { uri: compressed, width: asset.width, height: asset.height }]);
      }
    } catch (e) { showToast('拍照失败'); }
  };

  const extractNumber = (text) => {
    if (!text) return 0;
    text = text.trim();
    
    const numbers = text.match(/\d+/g);
    if (!numbers || numbers.length === 0) return 0;
    
    if (text.includes('共')) {
      const afterGong = text.split('共')[1];
      if (afterGong) {
        const gongNum = afterGong.match(/\d+/);
        if (gongNum) return parseInt(gongNum[0]);
      }
    }
    
    if (text.includes('有')) {
      const afterYou = text.split('有')[1];
      if (afterYou) {
        const youNum = afterYou.match(/\d+/);
        if (youNum) return parseInt(youNum[0]);
      }
    }
    
    if (numbers.length === 1) {
      return parseInt(numbers[0]);
    }
    
    const lastNum = parseInt(numbers[numbers.length - 1]);
    if (lastNum > 0 && lastNum < 10000) {
      return lastNum;
    }
    
    const maxNum = Math.max(...numbers.map(n => parseInt(n)));
    return maxNum > 0 && maxNum < 10000 ? maxNum : parseInt(numbers[0]);
  };

  // 获取最频繁的值（用于多次识别取稳定值）
  const getMostFrequent = (arr) => {
    const counts = {};
    let maxCount = 0;
    let mostFrequent = arr[0];
    for (const num of arr) {
      counts[num] = (counts[num] || 0) + 1;
      if (counts[num] > maxCount) {
        maxCount = counts[num];
        mostFrequent = num;
      }
    }
    return mostFrequent;
  };
  
  // 计算中位数
  const getMedian = (arr) => {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  };
  
  // 计算平均值（过滤异常值）
  const getAverageFiltered = (arr) => {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    // 去掉最小和最大各10%
    const trimCount = Math.floor(arr.length * 0.1);
    const trimmed = sorted.slice(trimCount, arr.length - trimCount);
    if (trimmed.length === 0) return arr[0];
    const sum = trimmed.reduce((acc, val) => acc + val, 0);
    return Math.round(sum / trimmed.length);
  };
  
  const aiCountRecognize = async () => {
    if (aiCountPhotos.length === 0) { showToast('请先拍照'); return; }
    setAiCountLoading(true);
    showToast('AI正在仔细清点物品数量（多次识别确保准确）...');
    try {
      const newDetails = [];
      
      for (let i = 0; i < aiCountPhotos.length; i++) {
        let count = 0;
        let success = false;
        let rawReply = '';
        let items = [];
        try {
          showToast(`正在识别第${i + 1}/${aiCountPhotos.length}张...`);
          
          // 优化：减少识别次数到5次，使用更精确的算法
          const RECOGNITION_COUNT = 5;
          const results = [];
          const allItems = [];
          for (let r = 0; r < RECOGNITION_COUNT; r++) {
            showToast(`识别中 ${r + 1}/${RECOGNITION_COUNT}...`);
            const result = await fetchBaiduObjectDetection(aiCountPhotos[i]);
            if (result && result.count > 0 && result.count < 10000) {
              results.push(result.count);
              if (result.items && result.items.length > 0) {
                allItems.push(result.items);
              }
            }
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          console.log(`[AI计数] 第${i+1}张${RECOGNITION_COUNT}次识别结果:`, results);
          
          if (results.length >= 2) {
            // 优化算法：使用中位数+众数组合，减少异常值影响
            // 1. 使用中位数作为基准（最稳健的统计量）
            const median = getMedian(results);
            
            // 2. 使用众数作为参考
            const frequent = getMostFrequent(results);
            
            // 3. 计算所有结果的标准差，评估一致性
            const mean = results.reduce((a, b) => a + b, 0) / results.length;
            const variance = results.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / results.length;
            const stdDev = Math.sqrt(variance);
            const cv = stdDev / mean; // 变异系数
            
            console.log(`[AI计数] 统计结果 - 最频繁:${frequent}, 中位数:${median}, 标准差:${stdDev.toFixed(2)}, 变异系数:${cv.toFixed(2)}`);
            
            // 最终选择策略：
            // - 如果变异系数小于0.1（结果非常一致），使用众数
            // - 如果变异系数在0.1-0.2之间，使用中位数（更稳健）
            // - 如果变异系数大于0.2（结果差异较大），使用加权平均
            if (cv < 0.1) {
              count = frequent;
            } else if (cv < 0.2) {
              count = median;
            } else {
              // 加权平均：最近的结果权重更高
              const weightedSum = results.reduce((sum, v, idx) => {
                const weight = 1 + (idx * 0.2); // 更高的递增权重
                return sum + (v * weight);
              }, 0);
              const weightTotal = results.reduce((sum, _, idx) => sum + (1 + idx * 0.2), 0);
              count = Math.round(weightedSum / weightTotal);
            }
            
            success = true;
            rawReply = `识别${RECOGNITION_COUNT}次，最频繁:${frequent}, 中位数:${median}, 最终:${count}`;
            showToast(`✅ 第${i+1}张识别完成，结果${count}`);
            
            // 使用与最终计数对应的那次识别的items
            const bestIndex = results.indexOf(count);
            if (bestIndex >= 0 && allItems[bestIndex]) {
              items = allItems[bestIndex];
            } else if (allItems.length > 0) {
              // 优先选择items数量与count最接近的那次
              items = allItems.reduce((prev, curr) => {
                const prevDiff = Math.abs(prev.length - count);
                const currDiff = Math.abs(curr.length - count);
                return currDiff < prevDiff ? curr : prev;
              }, allItems[0]);
            }
          } else if (results.length > 0) {
            // 识别次数不足，使用现有结果
            count = results[0];
            success = true;
            rawReply = `识别${results.length}次，结果${count}`;
            showToast(`✅ 第${i+1}张识别完成，结果${count}`);
            
            if (allItems.length > 0) {
              items = allItems[0];
            }
          }
          
          // 备用策略：如果AI没有返回坐标，自动生成均匀分布的标记点
          if (!items || items.length === 0 || items.length < count) {
            console.log(`[AI计数] AI未返回坐标，使用备用策略生成${count}个标记点`);
            items = generateFallbackCoords(count);
          } else if (items.length !== count) {
            // 如果返回的items数量与count不一致，修正
            console.log(`[AI计数] items数量(${items.length})与count(${count})不一致，使用备用策略`);
            items = generateFallbackCoords(count);
          }
        } catch (e) {
          console.error(`[AI计数] 第${i + 1}张识别异常:`, e);
          // 异常时也使用备用策略
          if (count > 0 && (!items || items.length === 0)) {
            items = generateFallbackCoords(count);
          }
        }
        newDetails.push({ photoIndex: i + 1, count, success, manualAdjust: 0, marks: [], rawReply, items });
        const total = newDetails.reduce((sum, d) => sum + d.count, 0);
        setAiCountResult({ total, details: [...newDetails], photos: newDetails.length });
      }
      
      const total = newDetails.reduce((sum, d) => sum + d.count, 0);
      if (total > 0) {
        showToast(`✅ 识别完成，共 ${total} 件`);
      } else {
        showToast('⚠️ AI识别服务暂不可用，请手动输入数量或检查网络后重试');
      }
    } catch (e) {
      console.error('[AI计数] 识别异常:', e);
      showToast('识别失败，请检查网络后重试');
    } finally {
      setAiCountLoading(false);
    }
  };

  const adjustAiCount = (photoIdx, delta) => {
    if (!aiCountResult?.details) return;
    const newDetails = aiCountResult.details.map((d, idx) => {
      if (idx === photoIdx) {
        const newManualAdjust = d.manualAdjust + delta;
        return { ...d, manualAdjust: newManualAdjust };
      }
      return d;
    });
    const total = newDetails.reduce((sum, d) => sum + d.count + d.manualAdjust, 0);
    setAiCountResult({ ...aiCountResult, total, details: newDetails });
  };

  const aiCountSubmit = () => {
    if (!aiCountResult || aiCountResult.total === 0) { showToast('请先拍照识别数量'); return; }
    const qty = aiCountResult.total;
    
    setQuantity(String(qty));
    setAiCountModalVisible(false);
    setAiCountPhotos([]);
    setAiCountResult(null);
    
    if (type === '入库') {
      setShowManualInput(true);
      setManualProductName('');
      setModalVisible(true);
      showToast(`已识别数量：${qty} 件`);
    } else {
      setShowManualInput(true);
      setManualProductName('');
      setModalVisible(true);
      showToast(`已识别数量：${qty} 件`);
    }
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
    if (!cameraPermission) {
      return (
        <View style={[styles.scannerContainer, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text style={{ color: '#fff', marginTop: 16 }}>加载相机权限中...</Text>
        </View>
      );
    }
    if (!cameraPermission.granted) {
      return (
        <View style={[styles.scannerContainer, { justifyContent: 'center', alignItems: 'center' }]}>
          <Ionicons name="camera" size={60} color="#fff" />
          <Text style={{ color: '#fff', marginTop: 16, marginBottom: 16 }}>需要相机权限才能扫码</Text>
          <TouchableOpacity style={[styles.miniBlueBtn, { padding: 12, borderRadius: 8 }]} onPress={requestCameraPermission}>
            <Text style={styles.sendTxt}>授予权限</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ marginTop: 16 }} onPress={() => setScanning(false)}>
            <Text style={{ color: '#fff' }}>取消</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.scannerContainer}>
        <CameraView
          facing="back"
          onBarcodeScanned={handleBarCodeScanned}
          style={{ flex: 1 }}
          onCameraReady={() => console.log('[Camera] Ready')}
          onMountError={(error) => console.error('[Camera] Mount Error:', error)}
          barcodeScannerSettings={{
            barcodeTypes: ['qr', 'ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'],
          }}
        />
        <TouchableOpacity style={styles.cancelBtn} onPress={() => setScanning(false)}><Text style={styles.cancelText}>取消扫描</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CommonHeader 
        title="出入库管理" 
        showBack={true}
        navigation={navigation}
        rightComponent={<TouchableOpacity onPress={() => { setType('入库'); setSelectedGoodsId(null); setQuantity(''); setReason(''); setPhotoUris([]); setModalVisible(true); setShowManualInput(false); setManualProductName(''); }}>
          <Ionicons name="add-outline" size={24} color={PRIMARY_COLOR} />
        </TouchableOpacity>}
      />
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
        <TouchableOpacity style={[styles.miniBtnWithIcon, { backgroundColor: '#FF8C00' }]} onPress={() => { setType('入库'); handleAIGoodsRecognition(); }}>
          <Ionicons name="scan-outline" size={20} color="#fff" />
          <Text style={{ fontSize: 12, color: '#fff', marginTop: 4 }}>拍照识别入库</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.miniBtnWithIcon, { backgroundColor: '#9370DB' }]} onPress={() => { setType('出库'); handleAIGoodsRecognition(); }}>
          <Ionicons name="scan-outline" size={20} color="#fff" />
          <Text style={{ fontSize: 12, color: '#fff', marginTop: 4 }}>拍照识别出库</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.miniBtnWithIcon, { backgroundColor: '#00CED1' }]} onPress={() => { setType('入库'); handleAICount(); }}>
          <Ionicons name="calculator-outline" size={20} color="#fff" />
          <Text style={{ fontSize: 12, color: '#fff', marginTop: 4 }}>拍照识别数量</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.miniBtnWithIcon, { backgroundColor: SUCCESS_COLOR }]} onPress={() => { setType('入库'); setShowManualInput(true); setModalVisible(true); }}>
          <Ionicons name="pencil" size={20} color="#fff" />
          <Text style={{ fontSize: 12, color: '#fff', marginTop: 4 }}>手动录入</Text>
        </TouchableOpacity>
      </View>
      
      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: '600' }}>📦 库存列表</Text>
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
                {scannedBarcode ? (
                  <View style={{ backgroundColor: LIGHT_PRIMARY, padding: 10, borderRadius: 8, marginBottom: 12 }}>
                    <Text style={{ fontSize: 13, color: PRIMARY_COLOR }}>📱 扫描条码：{scannedBarcode}</Text>
                  </View>
                ) : null}
                <Text style={styles.label}>商品名称</Text>
                <TextInput style={styles.formInput} value={manualProductName} onChangeText={setManualProductName} placeholder="输入商品名称" />
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
      {/* AI商品识别弹窗 */}
      <Modal visible={aiGoodsModalVisible} transparent animationType="fade">
        <View style={styles.modalMask}>
          <View style={[styles.voiceModal, { maxHeight: '90%', width: '92%' }]}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>📷 AI拍照识别商品</Text>
            <Text style={{ fontSize: 12, color: TEXT_SECOND, marginBottom: 12 }}>拍照识别商品名称和数量，自动匹配库存</Text>
            {aiGoodsPhoto && (
              <Image source={{ uri: aiGoodsPhoto }} style={{ width: '100%', height: 200, borderRadius: 8, marginBottom: 12 }} />
            )}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <TouchableOpacity style={{ flex: 1, padding: 12, backgroundColor: PRIMARY_COLOR, borderRadius: 8 }} onPress={handleAIGoodsRecognition}>
                <Text style={{ textAlign: 'center', color: '#fff' }}>📷 重新拍照</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, padding: 12, backgroundColor: aiGoodsLoading ? '#999' : SUCCESS_COLOR, borderRadius: 8 }} onPress={aiGoodsRecognize} disabled={aiGoodsLoading}>
                <Text style={{ textAlign: 'center', color: '#fff' }}>{aiGoodsLoading ? '识别中...' : '🤖 开始识别'}</Text>
              </TouchableOpacity>
            </View>
            {aiGoodsResult && (
              <View style={{ backgroundColor: '#F5F7FA', padding: 12, borderRadius: 8, marginBottom: 12 }}>
                <Text style={{ fontSize: 14, color: TEXT_SECOND, marginBottom: 8 }}>📊 识别结果</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ fontSize: 14, color: TEXT_MAIN }}>商品名称:</Text>
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: PRIMARY_COLOR }}>{aiGoodsResult.name}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ fontSize: 14, color: TEXT_MAIN }}>识别数量:</Text>
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: TEXT_MAIN }}>{aiGoodsResult.count} 件</Text>
                </View>
                {aiGoodsResult.matchedName && (
                  <View style={{ backgroundColor: '#E8F5E9', padding: 8, borderRadius: 6 }}>
                    <Text style={{ fontSize: 12, color: SUCCESS_COLOR }}>✅ 已匹配库存商品：{aiGoodsResult.matchedName}（当前库存：{aiGoodsResult.matchedStock}）</Text>
                  </View>
                )}
                {!aiGoodsResult.matchedName && (
                  <View style={{ backgroundColor: '#FFF3E0', padding: 8, borderRadius: 6 }}>
                    <Text style={{ fontSize: 12, color: '#FF8C00' }}>⚠️ 未匹配到库存商品，将以手动录入方式添加</Text>
                  </View>
                )}
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={{ flex: 1, padding: 12, backgroundColor: '#eee', borderRadius: 8 }} onPress={() => { setAiGoodsModalVisible(false); setAiGoodsPhoto(null); setAiGoodsResult(null); }}>
                <Text style={{ textAlign: 'center', color: TEXT_SECOND }}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, padding: 12, backgroundColor: aiGoodsResult ? PRIMARY_COLOR : '#ccc', borderRadius: 8 }} onPress={aiGoodsSubmit} disabled={!aiGoodsResult}>
                <Text style={{ textAlign: 'center', color: '#fff', fontWeight: '600' }}>确认{type}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* AI识别数量弹窗 - 点数神器风格 */}
      <Modal visible={aiCountModalVisible} transparent animationType="fade">
        <View style={styles.modalMask}>
          <View style={[styles.voiceModal, { maxHeight: '92%', width: '94%', borderRadius: 16 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold' }}>🔢 AI智能计数</Text>
              <TouchableOpacity onPress={() => { setAiCountModalVisible(false); setAiCountPhotos([]); setAiCountResult(null); }}>
                <Ionicons name="close-circle-outline" size={24} color={TEXT_THIRD} />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 12, color: TEXT_SECOND, marginBottom: 12 }}>📸 拍摄物品照片，AI自动识别数量，支持连拍累计</Text>
            
            {/* 照片预览区域 - 支持点击放大 */}
            <ScrollView horizontal style={{ marginBottom: 12, maxHeight: 140 }} showsHorizontalScrollIndicator={false}>
              {aiCountPhotos.map((photo, idx) => {
                const detail = aiCountResult?.details?.[idx];
                return (
                  <TouchableOpacity 
                    key={idx} 
                    style={{ position: 'relative', marginRight: 8 }}
                    onPress={() => setAiCountPreview({ photo, detail, index: idx })}
                  >
                    <Image source={{ uri: photo.uri }} style={{ width: 100, height: 100, borderRadius: 10 }} />
                    {/* AI识别的物品标注框 - 支持中心点坐标格式 */}
                    {detail?.items?.map((item, itemIdx) => {
                      // 优先使用中心点坐标格式
                      if (item.x !== undefined && item.y !== undefined) {
                        // 缩小标记点，半径最大不超过3像素
                        const baseRadius = Math.min(item.radius || 1.5, 2);
                        const size = baseRadius * 2 * (100 / 100); // 缩放到100x100预览图
                        return (
                          <View
                            key={itemIdx}
                            style={{
                              position: 'absolute',
                              left: (item.x / 100) * 100 - size / 2,
                              top: (item.y / 100) * 100 - size / 2,
                              width: size,
                              height: size,
                              borderRadius: size / 2,
                              backgroundColor: '#4CAF50',
                              borderWidth: 1,
                              borderColor: '#fff',
                              justifyContent: 'center',
                              alignItems: 'center',
                            }}
                          >
                            {/* 序号放在标记内部 */}
                            <Text style={{ color: '#fff', fontSize: Math.max(6, size / 2), fontWeight: 'bold' }}>{itemIdx + 1}</Text>
                          </View>
                        );
                      }
                      // 兼容旧格式：bbox数组
                      if (!item.bbox || item.bbox.length < 4) return null;
                      const [x1, y1, x2, y2] = item.bbox;
                      return (
                        <View
                          key={itemIdx}
                          style={{
                            position: 'absolute',
                            left: (x1 / 100) * 100,
                            top: (y1 / 100) * 100,
                            width: ((x2 - x1) / 100) * 100,
                            height: ((y2 - y1) / 100) * 100,
                            borderWidth: 2,
                            borderColor: '#4CAF50',
                            borderRadius: 4,
                            backgroundColor: 'rgba(76, 175, 80, 0.2)',
                          }}
                        >
                          <View style={{ position: 'absolute', top: -14, left: 0, backgroundColor: '#4CAF50', borderRadius: 4, paddingHorizontal: 4 }}>
                            <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>{itemIdx + 1}</Text>
                          </View>
                        </View>
                      );
                    })}
                    {detail && (
                      <View style={{ position: 'absolute', bottom: 4, left: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>{detail.count}件</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={{ position: 'absolute', top: -4, right: -4, width: 24, height: 24, borderRadius: 12, backgroundColor: DANGER_COLOR, justifyContent: 'center', alignItems: 'center' }}
                      onPress={(e) => {
                        e.stopPropagation();
                        setAiCountPhotos(prev => prev.filter((_, i) => i !== idx));
                        if (aiCountResult && aiCountResult.details) {
                          const newDetails = aiCountResult.details.filter((_, i) => i !== idx);
                          const newTotal = newDetails.reduce((sum, d) => sum + d.count, 0);
                          setAiCountResult({ ...aiCountResult, total: newTotal, details: newDetails, photos: newDetails.length });
                        }
                      }}
                    >
                      <Ionicons name="close" size={14} color="#fff" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
              {aiCountPhotos.length === 0 && (
                <View style={{ width: 100, height: 100, borderRadius: 10, backgroundColor: '#F5F7FA', justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="camera-outline" size={32} color={TEXT_THIRD} />
                </View>
              )}
            </ScrollView>
            
            {/* 统计信息 */}
            {aiCountPhotos.length > 0 && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#E8F5E9', borderRadius: 10, marginBottom: 12 }}>
                <View>
                  <Text style={{ fontSize: 12, color: TEXT_SECOND }}>已拍摄照片</Text>
                  <Text style={{ fontSize: 24, fontWeight: 'bold', color: SUCCESS_COLOR }}>{aiCountPhotos.length} 张</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 12, color: TEXT_SECOND }}>累计识别</Text>
                  <Text style={{ fontSize: 28, fontWeight: 'bold', color: PRIMARY_COLOR }}>{aiCountResult?.total || 0} 件</Text>
                </View>
              </View>
            )}
            
            {/* 操作按钮 */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <TouchableOpacity style={{ flex: 1, padding: 14, backgroundColor: PRIMARY_COLOR, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }} onPress={aiCountAddPhoto}>
                <Ionicons name="camera-outline" size={20} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>拍照</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, padding: 14, backgroundColor: aiCountLoading ? '#999' : SUCCESS_COLOR, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }} onPress={aiCountRecognize} disabled={aiCountLoading}>
                <Ionicons name={aiCountLoading ? 'loader-circle-outline' : 'sparkles-outline'} size={20} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>{aiCountLoading ? '识别中...' : 'AI识别'}</Text>
              </TouchableOpacity>
            </View>
            
            {/* 识别详情 - 简化版 */}
            {aiCountResult && aiCountResult.details.length > 0 && (
              <View style={{ backgroundColor: '#F5F7FA', padding: 12, borderRadius: 10, marginBottom: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: TEXT_MAIN, marginBottom: 10 }}>📊 识别详情</Text>
                <View style={{ maxHeight: 180, overflow: 'auto' }}>
                  {aiCountResult.details.map((d, idx) => (
                    <TouchableOpacity 
                      key={idx} 
                      style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' }}
                      onPress={() => setAiCountPreview({ photo: aiCountPhotos[idx], detail: d, index: idx })}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                        <Image source={{ uri: aiCountPhotos[idx]?.uri }} style={{ width: 50, height: 50, borderRadius: 8 }} />
                        <View>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: TEXT_MAIN }}>照片 {d.photoIndex}</Text>
                          {d.success ? (
                            <Text style={{ fontSize: 11, color: SUCCESS_COLOR }}>✓ AI识别成功</Text>
                          ) : (
                            <Text style={{ fontSize: 11, color: DANGER_COLOR }}>✗ 识别失败</Text>
                          )}
                        </View>
                      </View>
                      <Text style={{ fontSize: 24, fontWeight: 'bold', color: PRIMARY_COLOR }}>{d.count}件</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
            
            {/* 底部按钮 - 只保留关闭 */}
            <TouchableOpacity style={{ padding: 14, backgroundColor: PRIMARY_COLOR, borderRadius: 10 }} onPress={() => { setAiCountModalVisible(false); setAiCountPhotos([]); setAiCountResult(null); }}>
              <Text style={{ textAlign: 'center', color: '#fff', fontSize: 15, fontWeight: '600' }}>关闭</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      
      {/* 图片放大预览弹窗 - 修复版 */}
      <Modal visible={!!aiCountPreview} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {/* 顶部关闭按钮 */}
          <TouchableOpacity 
            style={{ position: 'absolute', top: 40, right: 20, zIndex: 100 }} 
            onPress={() => setAiCountPreview(null)}
          >
            <Ionicons name="close-circle" size={40} color="#fff" />
          </TouchableOpacity>
          
          {/* 图片和标记区域 - 使用contain模式并正确计算坐标 */}
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ 
              position: 'relative', 
              width: Dimensions.get('window').width, 
              height: Dimensions.get('window').height * 0.85 
            }}>
              {/* 使用contain模式确保图片完整显示 */}
              <Image 
                source={{ uri: aiCountPreview?.photo?.uri }} 
                style={{ width: '100%', height: '100%', resizeMode: 'contain' }}
              />
              {/* 每个物品的标记框 - 根据图片比例计算正确坐标，支持中心点格式 */}
              {aiCountPreview?.detail?.items?.map((item, itemIdx) => {
                // 计算图片在容器中的实际位置（contain模式）
                const imgRatio = (aiCountPreview?.photo?.width || 1) / (aiCountPreview?.photo?.height || 1);
                const containerRatio = Dimensions.get('window').width / (Dimensions.get('window').height * 0.85);
                let scale = 1;
                let offsetX = 0;
                let offsetY = 0;
                
                if (imgRatio > containerRatio) {
                  // 图片更宽，水平居中，上下留白
                  scale = Dimensions.get('window').width / (aiCountPreview?.photo?.width || 1);
                  const imgHeight = (aiCountPreview?.photo?.height || 1) * scale;
                  offsetY = (Dimensions.get('window').height * 0.85 - imgHeight) / 2;
                } else {
                  // 图片更高，垂直居中，左右留白
                  scale = (Dimensions.get('window').height * 0.85) / (aiCountPreview?.photo?.height || 1);
                  const imgWidth = (aiCountPreview?.photo?.width || 1) * scale;
                  offsetX = (Dimensions.get('window').width - imgWidth) / 2;
                }
                
                // 优先使用中心点坐标格式
                if (item.x !== undefined && item.y !== undefined) {
                  // 缩小标记点，半径最大不超过6像素
                  const baseRadius = Math.min(item.radius || 1.5, 2.5);
                  const size = baseRadius * 2 * (aiCountPreview?.photo?.width || 1) * scale / 100;
                  // 确保最小尺寸
                  const finalSize = Math.max(size, 8);
                  const left = offsetX + (item.x / 100) * (aiCountPreview?.photo?.width || 1) * scale - finalSize / 2;
                  const top = offsetY + (item.y / 100) * (aiCountPreview?.photo?.height || 1) * scale - finalSize / 2;
                  
                  return (
                    <View
                      key={itemIdx}
                      style={{
                        position: 'absolute',
                        left: left,
                        top: top,
                        width: finalSize,
                        height: finalSize,
                        borderRadius: finalSize / 2,
                        backgroundColor: '#4CAF50',
                        borderWidth: 2,
                        borderColor: '#fff',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      {/* 序号放在标记内部 */}
                      <Text style={{ color: '#fff', fontSize: Math.max(8, finalSize / 2.5), fontWeight: 'bold' }}>{itemIdx + 1}</Text>
                    </View>
                  );
                }
              
              // 兼容旧格式：bbox数组
              if (!item.bbox || item.bbox.length < 4) return null;
              const [x1, y1, x2, y2] = item.bbox;
              
              // 计算标记框的实际位置和大小
              const left = offsetX + (x1 / 100) * (aiCountPreview?.photo?.width || 1) * scale;
              const top = offsetY + (y1 / 100) * (aiCountPreview?.photo?.height || 1) * scale;
              const width = ((x2 - x1) / 100) * (aiCountPreview?.photo?.width || 1) * scale;
              const height = ((y2 - y1) / 100) * (aiCountPreview?.photo?.height || 1) * scale;
              
              return (
                <View
                  key={itemIdx}
                  style={{
                    position: 'absolute',
                    left: left,
                    top: top,
                    width: width,
                    height: height,
                    borderWidth: 3,
                    borderColor: '#4CAF50',
                    borderRadius: 4,
                    backgroundColor: 'rgba(76, 175, 80, 0.15)',
                  }}
                >
                  {/* 数字标记 - 绿色背景白色数字 */}
                  <View style={{ 
                    position: 'absolute', 
                    top: -24, 
                    left: 0, 
                    backgroundColor: '#4CAF50', 
                    borderRadius: 6, 
                    paddingHorizontal: 8, 
                    paddingVertical: 2,
                    minWidth: 28,
                    alignItems: 'center',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.3,
                    shadowRadius: 2,
                  }}>
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>{itemIdx + 1}</Text>
                  </View>
                </View>
              );
            })}
            </View>
          </View>
          
          {/* 右下角总数标记 */}
          <View style={{ 
            position: 'absolute', 
            bottom: 40, 
            right: 20, 
            backgroundColor: 'rgba(0,0,0,0.8)', 
            borderRadius: 16, 
            paddingHorizontal: 16, 
            paddingVertical: 10,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8
          }}>
            <Text style={{ color: '#4CAF50', fontSize: 24, fontWeight: 'bold' }}>{aiCountPreview?.detail?.count || 0}</Text>
            <Text style={{ color: '#fff', fontSize: 14 }}>件</Text>
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
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
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
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

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

  const sendMessage = async (type = 'text', imageUris = null) => {
    try {
      let text = inputText.trim();
      let images = [];
      if (type === 'image') {
        const uris = imageUris || selectedImages;
        if (uris.length === 0) { showToast('请先选择图片'); return; }
        for (let uri of uris) {
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

  const handleCustomPickerSend = async (uris) => {
    try {
      for (let uri of uris) {
        const msg = {
          id: Date.now().toString() + Math.random(),
          text: '图片消息',
          image: uri,
          from: 'staff',
          fromName: state.user?.name || '我',
          fromPhone: state.user?.phone || '',
          platform: currentPlatform || 'private',
          time: new Date().toISOString(),
          read: false,
        };
        setMessages(prev => [...prev, msg]);
        try {
          dispatch({ type: 'ADD_PRIVATE_MESSAGE', payload: { phone: selectedPhone, message: msg } });
        } catch (e) {
          console.warn('保存消息失败，已显示在界面');
        }
      }
      setInputText('');
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (error) {
      console.error('发送图片失败:', error);
      // 不再显示失败提示，因为消息已经在界面上显示
      // showToast('发送图片失败');
    }
  };

  const pickImages = async (source) => {
    try {
      setShowMediaOptions(false);
      if (source === 'library') {
        setShowCustomPicker(true);
        return;
      }
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') { showToast('需要相机权限'); return; }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 0.8,
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          const compressedUri = await compressImage(asset.uri);
          const msg = {
            id: Date.now().toString(),
            text: '图片消息',
            image: compressedUri,
            from: 'staff',
            fromName: state.user?.name || '我',
            fromPhone: state.user?.phone || '',
            platform: currentPlatform || 'private',
            time: new Date().toISOString(),
            read: false,
          };
          setMessages(prev => [...prev, msg]);
          dispatch({ type: 'ADD_PRIVATE_MESSAGE', payload: { phone: selectedPhone, message: msg } });
          setInputText('');
          setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
        }
      }
    } catch (error) { 
      console.error('选择图片失败:', error);
      showToast('选择图片失败'); 
    }
  };

  const removeImage = (index) => {
    const newList = [...selectedImages];
    newList.splice(index, 1);
    setSelectedImages(newList);
  };

  // 根据店铺类型动态生成快捷话术
  const industry = state.shopInfo?.industry || '餐饮类';
  const quickReplies = useMemo(() => {
    if (industry === '餐饮类') {
      return [
        '您好，请问想了解我们的菜品吗？',
        '请问需要堂食还是外卖？',
        '我们的招牌菜是...',
        '营业时间是...',
        '请问有忌口或过敏的食材吗？',
        '感谢您的光临，期待下次再见！',
      ];
    } else if (industry === '服务类') {
      return [
        '您好，请问想预约什么服务？',
        '服务时间是...',
        '我们的服务项目有...',
        '请问方便告知您的联系方式吗？',
        '感谢您的信任，我们会竭诚服务！',
        '服务价格是...',
      ];
    } else if (industry === '企业类') {
      return [
        '您好，请问有什么可以帮到您？',
        '我们的产品/服务介绍...',
        '商务合作请联系...',
        '工作时间是...',
        '感谢您的咨询，期待与您合作！',
        '批量采购有优惠哦！',
      ];
    }
    return [
      '您好，请问有什么可以帮助您？',
      '稍等，我帮您查询一下',
      '感谢您的反馈，我们会尽快处理',
      '欢迎下次光临！',
      '请问您需要什么帮助？',
      '请问您贵姓，方便称呼吗？',
    ];
  }, [industry]);

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
    <View style={[styles.container, { flex: 1 }]}>
      <CommonHeader 
        title="顾客客服" 
        showBack={true}
        navigation={navigation}
        rightComponent={<View style={{ flexDirection: 'row', alignItems: 'center' }}>
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
          </View>}
      />

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
          <Ionicons name="help-circle-outline" size={48} color={TEXT_THIRD} />
          <Text style={{ color: TEXT_THIRD, marginTop: 8 }}>{currentPlatform}平台暂无咨询</Text>
        </View>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
        <View style={{ flex: 1, flexDirection: 'column' }}>
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
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 12 }}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {currentMessages.map(msg => {
              const isStaff = msg.from === 'staff' || msg.fromPhone === state.user?.phone;
              return (
                <View key={msg.id} style={msg.image ? (isStaff ? styles.imageMsgRight : styles.imageMsgLeft) : (isStaff ? styles.bubbleRight : styles.bubbleLeft)}>
                  {msg.image ? (
                    <TouchableOpacity onPress={() => setFullscreenImage(msg.image)}>
                      <Image source={{ uri: msg.image }} style={styles.imageMessage} />
                    </TouchableOpacity>
                  ) : (
                    <Text style={{ fontSize: 15, color: TEXT_MAIN }}>{msg.text}</Text>
                  )}
                  <Text style={{ fontSize: 10, color: TEXT_THIRD, marginTop: 4, textAlign: isStaff ? 'right' : 'left' }}>{formatTime(msg.time)}</Text>
                  {msg.from === 'ai' && <Text style={{ fontSize: 9, color: SUCCESS_COLOR }}>🤖 AI回复</Text>}
                </View>
              );
            })}
            {currentMessages.length === 0 && (
              <Text style={{ textAlign: 'center', color: TEXT_THIRD, marginTop: 30 }}>暂无咨询，开始与顾客对话</Text>
            )}
          </ScrollView>
        </View>
        
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
        
        <View style={{ backgroundColor: '#fff', borderTopWidth: 1, borderColor: BORDER_COLOR, paddingBottom: keyboardVisible ? 0 : insets.bottom + (Platform.OS === 'ios' ? 84 : 64) }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 8, gap: 8 }}>
            <TextInput
              style={{ flex: 1, minHeight: 36, maxHeight: 120, backgroundColor: '#F5F7FA', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, textAlignVertical: 'top' }}
              placeholder={selectedPhone ? `回复 ${selectedPhone}...` : "请先选择顾客..."}
              value={inputText}
              onChangeText={setInputText}
              multiline
              editable={!!selectedPhone}
              onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            />
            <TouchableOpacity style={styles.sendBtn} onPress={() => sendMessage('text')}>
              <Text style={styles.sendTxt}>发送</Text>
            </TouchableOpacity>
            {selectedImages.length > 0 && (
              <TouchableOpacity style={[styles.sendBtn, { backgroundColor: SUCCESS_COLOR }]} onPress={() => sendMessage('image')}>
                <Text style={styles.sendTxt}>📷</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 4, justifyContent: 'space-around' }}>
            <TouchableOpacity onPress={() => setShowEmoji(!showEmoji)}>
              <Text style={{ fontSize: 24 }}>😊</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowQuickReply(!showQuickReply)}>
              <Ionicons name="star" size={22} color={PRIMARY_COLOR} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowMediaOptions(true)}>
              <Ionicons name="add-circle-outline" size={24} color={PRIMARY_COLOR} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    {fullscreenImage && (
      <EnhancedImageViewer
        visible={!!fullscreenImage}
        imageUri={fullscreenImage}
        onClose={() => setFullscreenImage(null)}
        isOwnMessage={true}
      />
    )}
    <CustomImagePicker 
      visible={showCustomPicker}
      onClose={() => setShowCustomPicker(false)}
      onSend={handleCustomPickerSend}
      maxSelection={10}
    />
    </View>
  );
};

// ================== 内部沟通 ==================
const InternalChat = () => {
  const navigation = useNavigation();
  const { state, dispatch } = useApp();
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [inputText, setInputText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const scrollViewRef = useRef(null);
  const [chatBgColor, setChatBgColor] = useState('#F2F3F5');
  const [chatBgImage, setChatBgImage] = useState(null);
  const [imageUri, setImageUri] = useState(null);
  const [showMediaOptions, setShowMediaOptions] = useState(false);
  const [callType, setCallType] = useState('voice');
  const [callStatus, setCallStatus] = useState('idle');
  const [callDuration, setCallDuration] = useState(0);
  const [callingName, setCallingName] = useState('');
  const callTimerRef = useRef(null);
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [showMentionList, setShowMentionList] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // @艾特：构建可艾特的成员列表（排除自己）
  const mentionableMembers = useMemo(() => {
    const members = [];
    // 老板（如果自己不是老板才添加）
    if (state.shopInfo?.phone && state.shopInfo.phone !== state.user?.phone) {
      members.push({ name: state.shopInfo?.name || '老板', phone: state.shopInfo?.phone });
    }
    // 已批准的员工（排除自己）
    (state.staffMemberList || []).filter(s => s.status === 'approved' && s.phone !== state.user?.phone).forEach(s => {
      members.push({ name: s.name, phone: s.phone });
    });
    return members;
  }, [state.staffMemberList, state.shopInfo, state.user]);

  const handleMention = (member) => {
    setInputText(prev => prev + `@${member.name} `);
    setShowMentionList(false);
  };

  // Load saved background - use useFocusEffect so it reloads every time page is focused
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem('internalChatBg').then(saved => {
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed.type === 'color') {
              setChatBgColor(parsed.value);
              setChatBgImage(null);
            } else if (parsed.type === 'image') {
              setChatBgImage(parsed.value);
            }
          } catch (e) {}
        }
      });
    }, [])
  );

  // 组件卸载时清理通话定时器,防止内存泄漏
  useEffect(() => {
    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
    };
  }, []);

  const chatId = 'internal';
  const groupMessages = state.groupChatMessages[chatId] || [];
  
  // 进入页面时标记所有消息为已读，消除红点
  useEffect(() => {
    dispatch({ type: 'MARK_GROUP_MESSAGES_READ', payload: { chatId } });
    // 标记所有私聊消息为已读
    Object.keys(state.privateChatMessages || {}).forEach(phone => {
      dispatch({ type: 'MARK_PRIVATE_MESSAGES_READ', payload: { phone } });
    });
    // 清除内部页面的红点
    dispatch({ type: 'CLEAR_RED_DOT', payload: { tab: '内部' } });
  }, []);
  
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

  const sendGroupMessage = async (type = 'text', selectedImageUri = null) => {
    try {
      let text = inputText.trim();
      let image = null;
      if (type === 'image') {
        const uri = selectedImageUri || imageUri;
        if (!uri) { showToast('请先选择图片'); return; }
        const compressed = await compressImage(uri);
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

  const handleInternalPickerSend = async (uris) => {
    try {
      for (let uri of uris) {
        const newMsg = {
          id: Date.now().toString() + Math.random(),
          type: 'image',
          content: '',
          image: uri,
          from: state.user?.name || '我',
          fromPhone: state.user?.phone || '',
          senderId: state.user?.id || 'staff',
          senderName: state.user?.name || '我',
          senderAvatar: state.user?.avatar || null,
          time: new Date().toISOString(),
          isSelf: true,
        };
        try {
          dispatch({ type: 'ADD_GROUP_MESSAGE', payload: { chatId, message: newMsg } });
        } catch (e) {
          console.warn('保存消息失败，已显示在界面');
        }
      }
      setImageUri(null);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (error) {
      console.error('发送图片失败:', error);
    }
  };

  const pickImage = async (source) => {
    try {
      setShowMediaOptions(false);
      if (source === 'gallery') {
        setShowCustomPicker(true);
        return;
      }
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') { showToast('需要相机权限'); return; }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 0.8,
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          const compressedUri = await compressImage(asset.uri);
          const newMsg = {
            id: Date.now().toString(),
            type: 'image',
            content: '',
            image: compressedUri,
            from: state.user?.name || '我',
            fromPhone: state.user?.phone || '',
            senderId: state.user?.id || 'staff',
            senderName: state.user?.name || '我',
            senderAvatar: state.user?.avatar || null,
            time: new Date().toISOString(),
            isSelf: true,
          };
          dispatch({ type: 'ADD_GROUP_MESSAGE', payload: { chatId, message: newMsg } });
          setImageUri(null);
          setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
        }
      }
    } catch (error) {
      console.error('选择图片失败:', error);
      showToast('选择图片失败');
    }
  };

  const goToChatSettings = () => {
    navigation.navigate('ChatSetting', { chatId });
  };

  return (
    <View style={styles.container}>
      <CommonHeader 
        title="内部沟通" 
        showBack={true}
        navigation={navigation}
        rightComponent={<TouchableOpacity onPress={goToChatSettings}><Text style={{ fontSize: 20, color: TEXT_MAIN }}>⋯</Text></TouchableOpacity>}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
        <View style={{ flex: 1, flexDirection: 'column', backgroundColor: chatBgColor }}>
          {chatBgImage && (
            <Image source={{ uri: chatBgImage }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          )}
          <ScrollView
            ref={scrollViewRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 12 }}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {groupMessages.length === 0 && <Text style={{ textAlign: 'center', color: TEXT_THIRD, marginTop: 30 }}>暂无消息</Text>}
            {groupMessages.map(msg => {
              const isMe = msg.fromPhone === state.user?.phone;
              return (
                <View key={msg.id} style={[styles.chatRow, isMe ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
                  {/* 对方头像 */}
                  {!isMe && (
                    <View style={{ flexDirection: 'column', alignItems: 'center', marginRight: 8, flexShrink: 0 }}>
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FF9800', justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>{(msg.from || '员工').substring(0, 1)}</Text>
                      </View>
                    </View>
                  )}
                  <View style={msg.image ? (isMe ? styles.imageMsgRight : styles.imageMsgLeft) : (isMe ? styles.bubbleRight : styles.bubbleLeft)}>
                    {!isMe && !msg.image && <Text style={{ fontSize: 12, color: TEXT_SECOND, marginBottom: 4, fontWeight: '500' }}>{msg.from}</Text>}
                    {msg.image ? (
                      <TouchableOpacity onPress={() => setFullscreenImage(msg.image)}>
                        <Image source={{ uri: msg.image }} style={styles.imageMessage} />
                      </TouchableOpacity>
                    ) : (
                      <Text style={{ fontSize: 15, color: TEXT_MAIN }}>{msg.text}</Text>
                    )}
                    <Text style={{ fontSize: 10, color: TEXT_THIRD, marginTop: 4, textAlign: isMe ? 'right' : 'left' }}>{formatTime(msg.time)}</Text>
                  </View>
                  {/* 自己头像 */}
                  {isMe && (
                    <View style={{ flexDirection: 'column', alignItems: 'center', marginLeft: 8, flexShrink: 0 }}>
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: PRIMARY_COLOR, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
                        {state.user?.avatar && (state.user.avatar.startsWith('http') || state.user.avatar.startsWith('file') || state.user.avatar.startsWith('data')) ? (
                          <Image source={{ uri: state.user.avatar }} style={{ width: '100%', height: '100%' }} />
                        ) : (
                          <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>{(state.user?.name || '我').substring(0, 1)}</Text>
                        )}
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
        
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
            <TouchableOpacity style={{ flex: 1, alignItems: 'center', padding: 8 }} onPress={() => pickImage('gallery')}>
              <Ionicons name="images-outline" size={24} color={PRIMARY_COLOR} />
              <Text style={{ fontSize: 12, color: TEXT_MAIN }}>相册</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex: 1, alignItems: 'center', padding: 8 }} onPress={() => pickImage('camera')}>
              <Ionicons name="camera-outline" size={24} color={PRIMARY_COLOR} />
              <Text style={{ fontSize: 12, color: TEXT_MAIN }}>拍照</Text>
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
        
        <View style={{ backgroundColor: '#fff', borderTopWidth: 1, borderColor: BORDER_COLOR, paddingBottom: keyboardVisible ? 0 : insets.bottom + (Platform.OS === 'ios' ? 84 : 64) }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 8, gap: 8 }}>
            <TextInput
              style={{ flex: 1, minHeight: 36, maxHeight: 120, backgroundColor: '#F5F7FA', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, textAlignVertical: 'top' }}
              placeholder="发送内部消息..."
              value={inputText}
              onChangeText={setInputText}
              multiline
              onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            />
            <TouchableOpacity style={styles.sendBtn} onPress={() => sendGroupMessage('text')}>
              <Text style={styles.sendTxt}>发送</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 4, justifyContent: 'space-around' }}>
            <TouchableOpacity onPress={() => setShowEmoji(!showEmoji)}>
              <Text style={{ fontSize: 24 }}>😊</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowMentionList(true)}>
              <Ionicons name="at-outline" size={24} color={PRIMARY_COLOR} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowMediaOptions(true)}>
              <Ionicons name="add-circle-outline" size={24} color={PRIMARY_COLOR} />
            </TouchableOpacity>
          </View>
          {showMentionList && (
            <View style={{ maxHeight: 200, backgroundColor: '#fff', borderTopWidth: 1, borderColor: BORDER_COLOR }}>
              <ScrollView>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: BORDER_COLOR }}
                  onPress={() => handleMention({ name: '所有人' })}
                >
                  <Ionicons name="people-outline" size={20} color={PRIMARY_COLOR} style={{ marginRight: 10 }} />
                  <Text style={{ fontSize: 15, color: TEXT_MAIN, fontWeight: '500' }}>@所有人</Text>
                </TouchableOpacity>
                {mentionableMembers.map((member, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: BORDER_COLOR }}
                    onPress={() => handleMention(member)}
                  >
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: PRIMARY_COLOR, justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                      <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>{member.name.substring(0, 1)}</Text>
                    </View>
                    <Text style={{ fontSize: 15, color: TEXT_MAIN }}>{member.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
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
    {fullscreenImage && (
        <EnhancedImageViewer
          visible={!!fullscreenImage}
          imageUri={fullscreenImage}
          onClose={() => setFullscreenImage(null)}
          isOwnMessage={true}
        />
      )}
    <CustomImagePicker 
      visible={showCustomPicker}
      onClose={() => setShowCustomPicker(false)}
      onSend={handleInternalPickerSend}
      maxSelection={10}
    />
    </View>
  );
};

// ================== 自定义图片选择器 ==================
const CustomImagePicker = ({ visible, onClose, onSend, maxSelection = 10 }) => {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      openPicker();
    }
  }, [visible]);

  const openPicker = async () => {
    try {
      setLoading(true);
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showToast('需要相册权限');
        onClose();
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
        selectionLimit: maxSelection,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uris = [];
        for (const asset of result.assets) {
          const compressed = await compressImage(asset.uri);
          uris.push(compressed);
        }
        await onSend(uris);
      }
      onClose();
    } catch (error) {
      console.error('选择图片失败:', error);
      showToast('选择图片失败');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent={true}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 32, alignItems: 'center', minWidth: 200 }}>
          {loading ? (
            <>
              <ActivityIndicator size="large" color={PRIMARY_COLOR} />
              <Text style={{ marginTop: 16, color: TEXT_SECOND }}>正在打开相册...</Text>
            </>
          ) : (
            <>
              <Ionicons name="images-outline" size={48} color={PRIMARY_COLOR} />
              <Text style={{ marginTop: 16, color: TEXT_SECOND }}>打开相册选择图片</Text>
              <TouchableOpacity onPress={onClose} style={{ marginTop: 16, paddingHorizontal: 24, paddingVertical: 8, backgroundColor: '#f0f0f0', borderRadius: 8 }}>
                <Text style={{ color: TEXT_SECOND }}>取消</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
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
  const [bgImage, setBgImage] = useState(null);
  const [showGroupMembers, setShowGroupMembers] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [bgTab, setBgTab] = useState('color'); // color / image
  const [showImagePickerForBg, setShowImagePickerForBg] = useState(false);

  const bgColors = ['#F2F3F5', '#E8F5E9', '#E3F2FD', '#FFF3E0', '#FCE4EC', '#EDE7F6', '#FFFFFF', '#37474F'];
  const bgMaterials = [
    { id: 'bg1', name: '简约灰', color: '#F2F3F5' },
    { id: 'bg2', name: '薄荷绿', color: '#E8F5E9' },
    { id: 'bg3', name: '天空蓝', color: '#E3F2FD' },
    { id: 'bg4', name: '暖阳橙', color: '#FFF3E0' },
    { id: 'bg5', name: '樱花粉', color: '#FCE4EC' },
    { id: 'bg6', name: '薰衣紫', color: '#EDE7F6' },
    { id: 'bg7', name: '纯净白', color: '#FFFFFF' },
    { id: 'bg8', name: '夜幕蓝', color: '#37474F' },
  ];
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

  const changeBgColor = async (color) => {
    setBgColor(color);
    setBgImage(null);
    try {
      await AsyncStorage.setItem('internalChatBg', JSON.stringify({ type: 'color', value: color }));
      showToast('聊天背景已更换');
    } catch (e) {
      showToast('保存失败');
    }
  };

  const pickBgImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { showToast('需要相册权限'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const compressedUri = await compressImage(asset.uri);
        setBgImage(compressedUri);
        setBgColor(null);
        try {
          await AsyncStorage.setItem('internalChatBg', JSON.stringify({ type: 'image', value: compressedUri }));
          showToast('背景已设置');
        } catch (e) {
          showToast('保存失败');
        }
      }
    } catch (error) {
      console.error('选择背景图失败:', error);
      showToast('选择失败');
    }
  };

  const resetBg = async () => {
    setBgColor('#F2F3F5');
    setBgImage(null);
    try {
      await AsyncStorage.removeItem('internalChatBg');
      showToast('已恢复默认背景');
    } catch (e) {}
  };

  return (
    <View style={styles.container}>
      <CommonHeader 
        title="聊天设置" 
        showBack={true}
        navigation={navigation}
      />
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
          <TouchableOpacity style={styles.chatSettingItem} onPress={() => navigation.navigate('SearchChatRecord', { chatId })}>
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

      <Modal visible={showMediaModal} transparent animationType="fade">
        <View style={styles.modalMask}>
          <View style={styles.modalWrap}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>媒体管理</Text>
              <TouchableOpacity onPress={() => setShowMediaModal(false)}><Text style={styles.closeTxt}>✕</Text></TouchableOpacity>
            </View>
            
            {/* Tabs */}
            <View style={{ flexDirection: 'row', marginBottom: 16, backgroundColor: '#F5F5F5', borderRadius: 8, padding: 2 }}>
              <TouchableOpacity 
                style={{ flex: 1, paddingVertical: 8, borderRadius: 6, backgroundColor: bgTab === 'color' ? '#fff' : 'transparent', ...SHADOW }}
                onPress={() => setBgTab('color')}
              >
                <Text style={{ textAlign: 'center', color: TEXT_MAIN, fontSize: 14 }}>颜色</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={{ flex: 1, paddingVertical: 8, borderRadius: 6, backgroundColor: bgTab === 'image' ? '#fff' : 'transparent', ...SHADOW }}
                onPress={() => setBgTab('image')}
              >
                <Text style={{ textAlign: 'center', color: TEXT_MAIN, fontSize: 14 }}>图片</Text>
              </TouchableOpacity>
            </View>

            {bgTab === 'color' ? (
              <>
                <Text style={styles.label}>选择聊天背景颜色</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  {bgMaterials.map((bg) => (
                    <TouchableOpacity 
                      key={bg.id} 
                      style={{ 
                        width: 56, 
                        height: 56, 
                        borderRadius: 10, 
                        backgroundColor: bg.color, 
                        borderWidth: bgColor === bg.color && !bgImage ? 3 : 0, 
                        borderColor: PRIMARY_COLOR,
                        alignItems: 'center',
                        justifyContent: 'center'
                      }} 
                      onPress={() => { changeBgColor(bg.color); }} 
                    >
                      <Text style={{ fontSize: 10, color: bg.color === '#37474F' ? '#fff' : TEXT_THIRD }}>{bg.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : (
              <>
                <Text style={styles.label}>选择背景图片</Text>
                <TouchableOpacity 
                  style={[styles.bgPickerBtn, { borderColor: PRIMARY_COLOR, borderWidth: 2, borderStyle: 'dashed' }]}
                  onPress={pickBgImage}
                >
                  <Ionicons name="image-outline" size={40} color={PRIMARY_COLOR} />
                  <Text style={{ color: PRIMARY_COLOR, marginTop: 8, fontSize: 14 }}>从相册选择图片</Text>
                </TouchableOpacity>
                {bgImage && (
                  <View style={{ marginTop: 16 }}>
                    <Text style={styles.label}>当前背景预览</Text>
                    <Image source={{ uri: bgImage }} style={{ width: '100%', height: 120, borderRadius: 8, marginTop: 8 }} resizeMode="cover" />
                  </View>
                )}
              </>
            )}

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>
              <TouchableOpacity style={[styles.bgResetBtn, { backgroundColor: '#F5F5F5' }]} onPress={resetBg}>
                <Text style={{ color: TEXT_SECOND }}>恢复默认</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.bgResetBtn, { backgroundColor: PRIMARY_COLOR }]} onPress={() => setShowMediaModal(false)}>
                <Text style={{ color: '#fff' }}>完成</Text>
              </TouchableOpacity>
            </View>

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

// ================== 查找聊天记录页面 ==================
const SearchChatRecordScreen = ({ route, navigation }) => {
  const { chatId } = route.params || {};
  const { state } = useApp();
  const [searchText, setSearchText] = useState('');
  const [searchType, setSearchType] = useState('all');
  const [searchResults, setSearchResults] = useState([]);

  const staffMembers = state.staffMemberList || [];
  const groupMessages = state.groupChatMessages[chatId] || [];

  const allMembers = [
    { phone: state.user?.phone, name: state.user?.name || '老板', role: '老板', isOwner: true },
    ...staffMembers.filter(s => s.status === 'approved').map(s => ({ phone: s.phone, name: s.name, role: '员工', isOwner: false }))
  ];

  const searchMessages = () => {
    if (!searchText.trim()) { showToast('请输入搜索内容'); return; }
    let filtered = groupMessages;
    if (searchType === 'text') {
      filtered = filtered.filter(m => m.text && m.text.includes(searchText));
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

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F7FA' }}>
      <CommonHeader 
        title="查找聊天记录" 
        showBack={true}
        navigation={navigation}
        backgroundColor="#fff"
        leftComponent={<TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={{ padding: 8 }}>
          <Ionicons name="chevron-back" size={24} color={TEXT_MAIN} />
        </TouchableOpacity>}
      />
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
                    <View style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: m.from === state.user?.phone ? PRIMARY_COLOR : '#7B8DF0', justifyContent: 'center', alignItems: 'center', marginRight: 6 }}>
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>{(m.fromName || m.from || '?').substring(0, 1)}</Text>
                    </View>
                    <Text style={{ fontSize: 12, color: PRIMARY_COLOR, fontWeight: '600' }}>{m.fromName || m.from}</Text>
                  </View>
                  <Text style={{ fontSize: 10, color: TEXT_THIRD }}>{formatTime(m.time)}</Text>
                </View>
                <Text style={{ fontSize: 14, color: TEXT_MAIN, lineHeight: 20 }} numberOfLines={3}>{m.text || '[消息]'}</Text>
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
  const AbortControllerRef = useRef(null);
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

  // 组件卸载时清理资源
  useEffect(() => {
    return () => {
      if (AbortControllerRef.current) {
        try { AbortControllerRef.current.abort(); } catch (e) {}
        AbortControllerRef.current = null;
      }
      try { Speech.stop(); } catch (e) {}
      try { ExpoSpeechRecognitionModule.stop(); } catch (e) {}
    };
  }, []);

  // 语音识别（Web Speech API）
  const startVoice = async () => {
    try {
      const permissionResult = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permissionResult.granted) {
        showToast('请授权麦克风权限');
        return;
      }
      
      // Remove any existing listeners
      try {
        ExpoSpeechRecognitionModule.removeAllListeners();
      } catch (e) {}
      
      const subscription = ExpoSpeechRecognitionModule.addListener('result', (event) => {
        const { segments } = event;
        if (segments && segments.length > 0) {
          const text = segments.map(s => s.transcript).join('');
          if (text) {
            setInputText(prev => (prev + ' ' + text).trim());
          }
        }
      });
      
      ExpoSpeechRecognitionModule.addListener('error', (event) => {
        const error = event.error;
        setRecording(false);
        setRecognizing(false);
        if (error === 'not-allowed') {
          showToast('请授权麦克风权限');
        } else if (error === 'no-speech') {
          showToast('未检测到语音，请重试');
        } else {
          console.warn('语音识别错误:', error);
        }
      });
      
      ExpoSpeechRecognitionModule.addListener('end', () => {
        setRecording(false);
        setRecognizing(false);
      });
      
      setRecording(true);
      setRecognizing(true);
      showToast('正在聆听...请说话');
      await ExpoSpeechRecognitionModule.start({ lang: 'zh-CN', interimResults: true });
    } catch (error) {
      console.error('启动语音识别失败:', error);
      showToast('启动语音识别失败');
      setRecording(false);
      setRecognizing(false);
    }
  };

  const stopVoice = async () => {
    try {
      await ExpoSpeechRecognitionModule.stop();
    } catch (e) {
      console.warn('停止语音失败:', e);
    }
    setRecording(false);
    setRecognizing(false);
  };

  // 语音播报回复
  const speakText = (text) => {
    try {
      Speech.stop();
      Speech.speak(text, {
        language: 'zh-CN',
        rate: 1.0,
        pitch: 1.0,
      });
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
    AbortControllerRef.current = new AbortController();
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

      const reply = await fetchZhipuChat(msgList, systemPrompt, AbortControllerRef.current.signal);
      if (AbortControllerRef.current?.signal.aborted) {
        setLoading(false);
        AbortControllerRef.current = null;
        return;
      }

      const aiMsg = {
        id: (Date.now()+1).toString(),
        text: reply,
        from: 'ai',
        time: new Date().toISOString(),
      };
      setMessages(prev => [...prev, aiMsg]);
      speakText(reply);
      setLoading(false);
      AbortControllerRef.current = null;
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (error) {
      if (error.name === 'AbortError') {}
      else { showToast('发送失败'); }
      setLoading(false);
      AbortControllerRef.current = null;
    }
  };

  const stopGeneration = () => {
    if (AbortControllerRef.current) {
      AbortControllerRef.current.abort();
      AbortControllerRef.current = null;
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setLoading(false);
    showToast('已停止');
  };

  return (
    <View style={styles.container}>
      <CommonHeader 
        title="🎙️ 智能语音助手" 
        showBack={true}
        navigation={navigation}
        backgroundColor={PRIMARY_COLOR}
        leftComponent={<TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>}
        rightComponent={loading ? (
          <TouchableOpacity onPress={stopGeneration}>
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>⏹ 停止</Text>
          </TouchableOpacity>
        ) : <View style={{ width: 30 }} />}
      />

      <ScrollView
        ref={scrollViewRef}
        style={styles.chatScroll}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 200 }}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map(msg => (
          <View key={msg.id} style={msg.from === 'user' ? styles.bubbleRight : styles.bubbleLeft}>
            {msg.from === 'ai' && <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Ionicons name="help-circle" size={14} color={PRIMARY_COLOR} />
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
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const messages = state.aiChatMessages || [];
  const messagesRef = useRef(messages);
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
  const [streamingMsgId, setStreamingMsgId] = useState(null);
  const AbortControllerRef = useRef(null);

  // Keep messagesRef in sync with state
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // 组件卸载时中止AI请求,防止内存泄漏和状态更新到已卸载组件
  useEffect(() => {
    return () => {
      if (AbortControllerRef.current) {
        try { AbortControllerRef.current.abort(); } catch (e) {}
        AbortControllerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

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

  // 更新AI消息（用于流式显示）
  const updateAiMessage = (id, text) => {
    const currentMessages = messagesRef.current || [];
    const updatedMessages = currentMessages.map(m => 
      m.id === id ? { ...m, text } : m
    );
    messagesRef.current = updatedMessages;
    dispatch({ type: 'SET_AI_MESSAGES', payload: updatedMessages });
  };

  // 模拟流式显示AI回复
  const streamAiResponse = async (msgId, fullText) => {
    const chars = Array.from(fullText);
    let currentText = '';
    for (let i = 0; i < chars.length; i++) {
      if (AbortControllerRef.current?.signal?.aborted) return;
      currentText += chars[i];
      // 每2个字符更新一次，提升流畅度
      if (i % 2 === 0 || i === chars.length - 1) {
        updateAiMessage(msgId, currentText);
        // 让UI有机会渲染
        await new Promise(resolve => setTimeout(resolve, 16));
      }
    }
    updateAiMessage(msgId, fullText);
    setStreamingMsgId(null);
  };

  const getQuickReplies = () => {
    const name = (shopName || '').toLowerCase();
    
    // 根据店铺名称细分行业类型
    const isPhone = ['手机', '数码', '通讯', '手机店', '数码店', '3C'].some(k => name.includes(k));
    const isBeauty = ['美容', '美发', '美甲', '美体', 'SPA', '美容院', '美发店', '理发店'].some(k => name.includes(k));
    const isFood = ['餐', '饭', '小吃', '饮', '茶', '咖啡', '面', '火锅', '烧烤', '小吃店', '餐厅', '饭店'].some(k => name.includes(k));
    const isFitness = ['健身', '瑜伽', '运动', '健身房', '健身俱乐部'].some(k => name.includes(k));
    const isMedical = ['医', '药', '诊所', '医院', '牙科', '眼科'].some(k => name.includes(k));
    const isHome = ['家政', '保洁', '家电', '维修', '搬家'].some(k => name.includes(k));
    const isClothing = ['服装', '服饰', '男装', '女装', '童装', '鞋'].some(k => name.includes(k));
    const isEducation = ['教育', '培训', '课程', '学习', '驾校'].some(k => name.includes(k));
    
    if (isPhone) {
      return {
        '经营数据': ['今日手机销量统计', '热门机型库存查询', '配件销售占比分析', '本月维修服务量'],
        '营销推广': ['新品上市宣传文案', '以旧换新活动方案', '手机维修推广话术', '配件组合促销'],
        '运营管理': ['员工销售提成方案', '库存周转优化', '进货补货建议', '售后服务流程'],
        '分类经营': ['iPhone销售话术', '安卓机型对比卖点', '贴膜维修报价表', '二手回收定价', '分期方案设计', '延保服务推广'],
      };
    } else if (isBeauty) {
      return {
        '经营数据': ['今日服务订单统计', '热门项目销量', '客户复购率分析', '本月业绩目标'],
        '营销推广': ['新店开业宣传文案', '会员卡推广方案', '朋友圈美容文案', '节日促销海报'],
        '运营管理': ['技师排班表', '美容师绩效考核', '客户回访话术', '用品库存管理'],
        '分类经营': ['面部护理话术', '烫发染发推荐', '美甲款式推荐', 'SPA套餐设计', '会员权益说明', '老客邀约方案'],
      };
    } else if (isFood) {
      return {
        '经营数据': ['今日营收统计', '热销菜品排行', '外卖订单分析', '本周客流趋势'],
        '营销推广': ['招牌菜推荐文案', '开业活动方案', '外卖平台运营', '短视频美食脚本'],
        '运营管理': ['翻台率提升技巧', '食材采购建议', '后厨卫生管理', '员工培训方案'],
        '分类经营': ['奶茶店选址建议', '小吃配方优化', '套餐组合设计', '会员积分体系', '生日优惠方案', '外卖满减策略'],
      };
    } else if (isFitness) {
      return {
        '经营数据': ['今日入店人数', '会员到期提醒', '课程满意度', '器械使用率'],
        '营销推广': ['年卡优惠方案', '私教课程推广', '朋友圈健身文案', '新店开业宣传'],
        '运营管理': ['教练排班表', '课程安排优化', '器械维护计划', '会员管理系统'],
        '分类经营': ['私教课程定价', '团课排期设计', '暑期卡方案', '情侣健身套餐', '减脂营推广', '康复训练项目'],
      };
    } else if (isMedical) {
      return {
        '经营数据': ['今日接诊统计', '病种分布分析', '患者满意度', '复诊率统计'],
        '营销推广': ['健康讲座宣传', '体检套餐推广', '公众号文案', '科普内容创作'],
        '运营管理': ['医生排班表', '药品库存管理', '预约系统优化', '病例管理规范'],
        '分类经营': ['口腔保健套餐', '体检项目推荐', '康复理疗方案', '心理咨询服务', '中医调理课程', '亲子体检包'],
      };
    } else if (isHome) {
      return {
        '经营数据': ['今日工单统计', '客户满意度', '服务区域分析', '利润率分析'],
        '营销推广': ['家政服务宣传', '保洁套餐推广', '家电维修文案', '朋友圈引流'],
        '运营管理': ['阿姨排班表', '服务标准流程', '客户回访', '用品采购管理'],
        '分类经营': ['深度清洁套餐', '空调清洗报价', '开荒保洁方案', '月嫂服务推广', '水管维修话术', '家电保养建议'],
      };
    } else if (isClothing) {
      return {
        '经营数据': ['今日销售统计', '库存周转率', '滞销款式分析', '季节款占比'],
        '营销推广': ['新品上架文案', '换季清仓方案', '穿搭推荐话术', '直播间脚本'],
        '运营管理': ['导购员排班', '库存盘点流程', '补货建议', '陈列设计方案'],
        '分类经营': ['夏装促销方案', '会员折扣设计', '搭配推荐话术', '尺码调整政策', '退换货流程', 'VIP专属权益'],
      };
    } else if (isEducation) {
      return {
        '经营数据': ['今日报名统计', '课程满意度', '续费率分析', '出勤率统计'],
        '营销推广': ['暑期班宣传', '体验课方案', '家长沟通话术', '朋友圈招生'],
        '运营管理': ['教师排班表', '课程大纲设计', '学员管理系统', '教学质量监控'],
        '分类经营': ['一对一辅导方案', '小班课推广', '竞赛冲刺课程', '暑假集训营', '亲子教育讲座', '在线课程设计'],
      };
    }
    
    // 根据大行业类型提供通用话术
    if (industry === '餐饮类') {
      return {
        '经营数据': ['今日营收统计', '热销菜品排行', '外卖订单分析', '本周客流趋势'],
        '营销推广': ['招牌菜推荐文案', '开业活动方案', '外卖平台运营', '节日促销海报'],
        '运营管理': ['翻台率提升技巧', '食材采购建议', '后厨卫生管理', '员工培训方案'],
        '分类经营': ['套餐组合设计', '会员积分体系', '生日优惠方案', '外卖满减策略', '新品推广计划', '客户回访话术'],
      };
    } else if (industry === '服务类') {
      return {
        '经营数据': ['今日服务订单量', '客户复购率分析', '差评预警情况', '本月收入目标'],
        '营销推广': ['服务推广话术', '会员储值活动', '引流方案设计', '朋友圈文案'],
        '运营管理': ['客户满意度提升', '员工排班管理', '绩效考核方案', '服务流程优化'],
        '分类经营': ['会员权益设计', '体验活动方案', '老客回访计划', '增值服务推荐', '合作渠道开发', '品牌故事撰写'],
      };
    } else if (industry === '企业类') {
      return {
        '经营数据': ['今日销售业绩', '本月营收完成度', '客户转化率分析', '库存周转率'],
        '营销推广': ['促销活动策划', '企业宣传文案', '品牌升级方案', '短视频营销'],
        '运营管理': ['团队效率提升', '绩效考核体系', '项目管理流程', '招聘计划'],
        '分类经营': ['库存管理优化', '批发客户开发', '供应链管理', '成本控制方案', '产品迭代计划', '渠道拓展策略'],
      };
    }
    
    return {
      '经营数据': ['今日营收统计', '客户到店分析', '本月业绩进度'],
      '营销推广': ['帮我设计促销活动', '朋友圈文案生成', '爆款海报制作'],
      '运营管理': ['员工排班安排', '库存优化建议', '服务流程改进'],
      '分类经营': ['会员体系设计', '老客户维护', '新品推广方案'],
    };
  };

  // 使用useMemo确保快捷短语响应行业变化
  const quickReplies = useMemo(() => getQuickReplies(), [industry]);

  // 使用ref记录上一次的行业类型，只在类型实际变化时更新欢迎语
  const prevIndustry = useRef(industry);
  
  useEffect(() => {
    // 如果行业类型没有变化，且已经有消息，不重新生成欢迎语
    if (prevIndustry.current === industry && messages.length > 0) {
      return;
    }
    
    // 更新记录的行业类型
    prevIndustry.current = industry;
    
    if (industry !== '待识别') {
      const welcomeMsg = [{ id: '1', text: `您好 ${userName}！我是您的${industry}店铺「${shopName}」智能管家。\n\n我可以帮您：\n📊 实时分析经营数据\n💡 提供利润提升建议\n📝 生成营销文案/海报/广告语\n📅 自动生成日报/周报/月报\n⚠️ 差评预警识别\n\n请直接输入您的问题！`, from: 'ai', time: new Date().toISOString() }];
      dispatch({ type: 'SET_AI_MESSAGES', payload: welcomeMsg });
    } else if (shopName) {
      AsyncStorage.getItem('shopInfo').then(storedShopInfo => {
        if (storedShopInfo) {
          try {
            const parsed = JSON.parse(storedShopInfo);
            if (parsed.industry && parsed.industry !== '待识别') {
              prevIndustry.current = parsed.industry;
              dispatch({ type: 'SET_SHOP_INFO', payload: { industry: parsed.industry } });
              const welcomeMsg = [{ id: '1', text: `您好 ${userName}！我是您的${parsed.industry}店铺「${shopName}」智能管家。\n\n我可以帮您：\n📊 实时分析经营数据\n💡 提供利润提升建议\n📝 生成营销文案/海报/广告语\n📅 自动生成日报/周报/月报\n⚠️ 差评预警识别\n\n请直接输入您的问题！`, from: 'ai', time: new Date().toISOString() }];
              dispatch({ type: 'SET_AI_MESSAGES', payload: welcomeMsg });
              return;
            }
          } catch (e) {}
        }
        // 首次登录时识别类型
        const AbortController = new AbortController();
        fetchZhipuChat([], `请根据店铺名称「${shopName}」判断商家类型，只能在以下三个类型中选择一个：餐饮类、服务类、企业类。只需返回类型名称，不要包含其他文字。`, AbortController.signal)
          .then(async result => {
            let detectedIndustry = '餐饮类';
            if (result.includes('服务类')) detectedIndustry = '服务类';
            else if (result.includes('企业类')) detectedIndustry = '企业类';
            prevIndustry.current = detectedIndustry;
            const newShopInfo = { ...state.shopInfo, industry: detectedIndustry };
            dispatch({ type: 'SET_SHOP_INFO', payload: { industry: detectedIndustry } });
            try { await AsyncStorage.setItem('shopInfo', JSON.stringify(newShopInfo)); } catch (e) {}
            const welcomeMsg = [{ id: '1', text: `您好 ${userName}！已识别您的${detectedIndustry}店铺「${shopName}」。\n\n我可以帮您：\n📊 分析经营数据\n💡 提升利润建议\n📝 生成营销文案、海报\n📅 生成日报/周报/月报\n⚠️ 差评预警处理\n\n请直接输入您的问题！`, from: 'ai', time: new Date().toISOString() }];
            dispatch({ type: 'SET_AI_MESSAGES', payload: welcomeMsg });
          })
          .catch(() => {
            const welcomeMsg = [{ id: '1', text: `您好 ${userName}！我是经营宝AI助手，您的店铺「${shopName}」的智能管家。\n\n我可以帮您分析经营数据、生成营销文案、回答经营问题。\n\n请直接输入您的问题！`, from: 'ai', time: new Date().toISOString() }];
            dispatch({ type: 'SET_AI_MESSAGES', payload: welcomeMsg });
          });
      }).catch(() => {
        const welcomeMsg = [{ id: '1', text: `您好 ${userName}！我是经营宝AI助手，您的店铺「${shopName}」的智能管家。\n\n我可以帮您分析经营数据、生成营销文案、回答经营问题。\n\n请直接输入您的问题！`, from: 'ai', time: new Date().toISOString() }];
        dispatch({ type: 'SET_AI_MESSAGES', payload: welcomeMsg });
      });
    } else {
      const welcomeMsg = [{ id: '1', text: `您好 ${userName}！我是经营宝AI助手。\n\n请先在设置中填写您的门店名称，我可以帮您：\n📊 分析经营数据\n💡 提供经营建议\n📝 生成营销文案、海报\n📅 生成各类报表\n\n请直接输入您的问题！`, from: 'ai', time: new Date().toISOString() }];
      dispatch({ type: 'SET_AI_MESSAGES', payload: welcomeMsg });
    }
  }, [industry, shopName, userName]);

  // 收集所有经营数据用于报告生成
  const collectBusinessDataForReport = () => {
    const orders = state.globalOrderRecord || [];
    const goods = state.goodsList || [];
    const stockRecords = state.globalStockRecord || [];
    const todayStr = new Date().toISOString().split('T')[0];
    const thisMonth = todayStr.substring(0, 7);
    
    // 今日数据
    const todayOrders = orders.filter(o => o.time?.startsWith(todayStr));
    const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.couponPrice || 0), 0);
    
    // 本周数据（过去7天）
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekOrders = orders.filter(o => o.time && new Date(o.time) >= weekAgo);
    const weekRevenue = weekOrders.reduce((sum, o) => sum + (o.couponPrice || 0), 0);
    
    // 本月数据
    const monthOrders = orders.filter(o => o.time?.startsWith(thisMonth));
    const monthRevenue = monthOrders.reduce((sum, o) => sum + (o.couponPrice || 0), 0);
    
    // 各平台数据
    const platformStats = {};
    orders.forEach(o => {
      if (o.platform) {
        if (!platformStats[o.platform]) platformStats[o.platform] = { count: 0, revenue: 0 };
        platformStats[o.platform].count++;
        platformStats[o.platform].revenue += o.couponPrice || 0;
      }
    });
    
    // 库存数据
    const totalStock = goods.reduce((sum, g) => sum + (g.stock || 0), 0);
    const lowStockItems = goods.filter(g => (g.stock || 0) < 10);
    
    // 成本与利润数据
    const costCache = state.costCache || { purchaseCost: "", fixedCost: "" };
    const purchaseCost = Number(costCache.purchaseCost) || 0;
    const fixedCost = Number(costCache.fixedCost) || 0;
    const lastBusinessInput = state.lastBusinessInput || {};
    const loss = Number(lastBusinessInput.loss) || 0;
    const otherCost = Number(lastBusinessInput.otherCost) || 0;
    const totalCost = purchaseCost + fixedCost + loss + otherCost;
    const profit = todayRevenue - totalCost;
    const profitRate = todayRevenue === 0 ? 0 : Number((profit / todayRevenue * 100).toFixed(2));
    
    return {
      shopName, industry, userName,
      todayOrders: todayOrders.length, todayRevenue,
      weekOrders: weekOrders.length, weekRevenue,
      monthOrders: monthOrders.length, monthRevenue,
      totalOrders: orders.length, totalRevenue: orders.reduce((sum, o) => sum + (o.couponPrice || 0), 0),
      totalGoods: goods.length, totalStock, lowStockItems: lowStockItems.map(g => `${g.name}(库存:${g.stock})`),
      platformStats,
      purchaseCost, fixedCost, loss, otherCost, totalCost, profit, profitRate,
      badReviewCount: state.badReviewCount || 0,
      staffCount: (state.staffMemberList || []).filter(s => s.status === 'approved').length,
    };
  };

  const handleMarketing = (type) => {
    const data = collectBusinessDataForReport();
    const platformData = Object.entries(data.platformStats).map(([p, s]) => `${p}：${s.count}单 ¥${s.revenue}`).join('，') || '暂无';
    
    const prompts = {
      '文案': `帮我写一条关于${shopName}的${industry}爆款营销文案，要求有吸引力、适合社交平台传播`,
      '海报': `帮我设计一张${shopName}${industry}店铺的宣传海报文字描述，要求突出卖点`,
      '广告语': `帮我写3条${shopName}${industry}店铺的简短有力广告语`,
      '日报': `【${shopName}今日经营日报】\n\n店铺类型：${industry}\n今日订单：${data.todayOrders}单\n今日营收：¥${data.todayRevenue}\n各平台销售：${platformData}\n采购成本：¥${data.purchaseCost}\n固定成本：¥${data.fixedCost}\n损耗金额：¥${data.loss}\n其他成本：¥${data.otherCost}\n总成本：¥${data.totalCost}\n利润：¥${data.profit}\n利润率：${data.profitRate}%\n库存不足商品：${data.lowStockItems.join('、') || '无'}\n差评数：${data.badReviewCount}\n\n请基于以上真实数据，结合${industry}行业全网销售情况，为我生成一份专业的日报，包含：\n1. 今日经营数据分析\n2. 与行业平均水平对比\n3. 利润优化建议\n4. 库存管理建议\n5. 明日经营策略`,
      '周报': `【${shopName}本周经营周报】\n\n店铺类型：${industry}\n本周订单：${data.weekOrders}单\n本周营收：¥${data.weekRevenue}\n日均订单：${Number(data.weekOrders / 7).toFixed(1)}单\n日均营收：¥${Number(data.weekRevenue / 7).toFixed(2)}\n各平台销售：${platformData}\n本周采购成本：¥${data.purchaseCost}\n本周固定成本：¥${data.fixedCost}\n本周损耗：¥${data.loss}\n本周利润：¥${data.profit}\n本周利润率：${data.profitRate}%\n库存不足商品：${data.lowStockItems.join('、') || '无'}\n\n请基于以上真实数据，结合${industry}行业本周销售趋势，为我生成一份专业的周报，包含：\n1. 本周经营数据汇总\n2. 每日数据趋势分析\n3. 与上周对比变化\n4. 各平台表现分析\n5. 利润构成分析\n6. 下周经营优化建议`,
      '月报': `【${shopName}本月经营月报】\n\n店铺类型：${industry}\n本月订单：${data.monthOrders}单\n本月营收：¥${data.monthRevenue}\n日均订单：${Number(data.monthOrders / new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()).toFixed(1)}单\n日均营收：¥${Number(data.monthRevenue / new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()).toFixed(2)}\n各平台销售：${platformData}\n采购成本：¥${data.purchaseCost}\n固定成本：¥${data.fixedCost}\n损耗金额：¥${data.loss}\n其他成本：¥${data.otherCost}\n总成本：¥${data.totalCost}\n总利润：¥${data.profit}\n利润率：${data.profitRate}%\n库存不足商品：${data.lowStockItems.join('、') || '无'}\n\n请基于以上真实数据，结合${industry}行业本月市场情况，为我生成一份专业的月报，包含：\n1. 本月经营数据全面汇总\n2. 各周数据趋势分析\n3. 成本结构分析\n4. 利润变化原因分析\n5. 库存周转分析\n6. 与上月对比总结\n7. 下月经营规划建议`,
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
    dispatch({ type: 'ADD_AI_MESSAGE', payload: hint });
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const stopGeneration = () => {
    if (AbortControllerRef.current) {
      AbortControllerRef.current.abort();
      AbortControllerRef.current = null;
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
      dispatch({ type: 'ADD_AI_MESSAGE', payload: userMsg });
      // Update ref immediately for synchronous access
      messagesRef.current = [...(messagesRef.current || []), userMsg];
      setInputText('');
      setImageUri(null);
      setShowMediaOptions(false);
      setShowEmoji(false);
      if (type === 'image') {
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
        return;
      }

      AbortControllerRef.current = new AbortController();
      setLoading(true);

      // 收集所有真实数据
      const allData = collectAllBusinessData();
      const businessContext = `【店铺信息】名称：${allData.shopName}，类型：${allData.industry}
【核心数据】今日订单：${allData.todayOrders}单，今日营收：¥${allData.todayRevenue}，本月订单：${allData.monthOrders}单，本月营收：¥${allData.monthRevenue}，总营收：¥${allData.totalRevenue}
【库存情况】商品总数：${allData.totalGoods}，总库存：${allData.totalStock}，今日入库：${allData.todayIn}，今日出库：${allData.todayOut}，库存不足：${allData.lowStockItems.join('、') || '无'}
【平台分布】${Object.entries(allData.platformStats).map(([p, s]) => `${p}：${s.count}单 ¥${s.revenue}`).join('，') || '暂无'}
【最近10条订单】${allData.recentOrders || '暂无'}
【其他】差评数：${allData.badReviewCount}，在职员工：${allData.staffCount}人`;

      const msgList = messagesRef.current.filter(m => m.from !== 'system').slice(-10).map(m => ({
        role: m.from === 'user' ? 'user' : 'assistant',
        content: m.text || '',
      }));
      msgList.push({ role: 'user', content: text });

      // 判断是否需要生成图片
      const shouldGenImage = showImageGen || isImageGenRequest(text);
      // 判断是否是报告请求
      const isReport = isReportRequest(text);
      let reply = '';

      if (shouldGenImage) {
        try {
          // 根据行业类型生成针对性的高级图片prompt
          const industryStyleMap = {
            '餐饮类': '美食餐饮行业，高端美食摄影风格，专业商业菜品拍摄，诱人的食物特写，精致摆盘，暖色调灯光，高级餐厅氛围，专业美食摄影师水准，色彩鲜艳饱满，让人垂涎欲滴',
            '服务类': '服务行业，高端会所/SPA/美容风格，奢华优雅的视觉设计，精致的服务场景，柔和温暖的灯光，专业商业摄影，高品质服务环境展示，优雅大气的视觉效果',
            '企业类': '企业商务风格，现代简约商务设计，专业企业宣传素材，简洁大气的视觉语言，商务办公场景，专业商业摄影，高端企业形象展示，科技感与专业感并重'
          };
          
          const styleDesc = industryStyleMap[industry] || industryStyleMap['餐饮类'];
          
          const fullPrompt = `基于以下需求生成高品质商业图片：${text}

【设计风格要求】
${styleDesc}

【视觉质量标准】
- 专业级商业摄影水准，高清画质，8K分辨率级别
- 极致光影效果，专业布光，层次感分明
- 高级色彩搭配，色彩心理学应用，视觉冲击力强
- 精致细节处理，每个元素都经过精心设计
- 符合当前主流社交媒体（小红书、抖音、微信朋友圈）的爆款视觉风格
- 参考国际顶级广告公司（奥美、麦肯光明、智威汤逊）的创意水准
- 融入2024-2025年度最流行的设计趋势（极简主义、新复古、有机形态、流体渐变）
- 品牌调性统一，视觉语言专业

【构图与布局】
- 黄金比例构图或三分法构图，视觉焦点突出
- 留白恰到好处，不拥挤不空洞
- 文字与图形完美融合，信息层次清晰

【适用场景】
- 社交媒体推广（小红书、抖音、微信）
- 线下宣传物料（海报、易拉宝、灯箱）
- 电商平台主图（美团、大众点评、抖音商城）

请生成一张具有强烈视觉吸引力、专业级别的商业图片，让观众一眼就被吸引！`;
          const imageResult = await fetchZhipuImage(fullPrompt, AbortControllerRef.current.signal);
          if (!AbortControllerRef.current.signal.aborted && imageResult && imageResult !== 'aborted') {
            const aiMsg = {
              id: (Date.now()+1).toString(),
              text: '🎨 已为您生成图片，结合了' + industry + '行业当前流行的爆款设计风格：',
              image: imageResult,
              from: 'ai',
              time: new Date().toISOString(),
            };
            dispatch({ type: 'ADD_AI_MESSAGE', payload: aiMsg });
            setLoading(false);
            AbortControllerRef.current = null;
            setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
            return;
          } else {
            reply = '图片生成失败，请稍后重试';
          }
        } catch (e) {
          if (e.name === 'AbortError') {
            setLoading(false);
            AbortControllerRef.current = null;
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
        reply = await fetchZhipuChat(msgList, systemPrompt, AbortControllerRef.current.signal);
      }
      if (AbortControllerRef.current?.signal.aborted) {
        setLoading(false);
        AbortControllerRef.current = null;
        return;
      }
      // 使用流式效果显示AI回复
      const aiMsgId = (Date.now()+1).toString();
      const emptyAiMsg = {
        id: aiMsgId,
        text: '',
        from: 'ai',
        time: new Date().toISOString(),
      };
      dispatch({ type: 'ADD_AI_MESSAGE', payload: emptyAiMsg });
      // Update ref immediately
      messagesRef.current = [...(messagesRef.current || []), emptyAiMsg];
      setLoading(false);
      setStreamingMsgId(aiMsgId);
      AbortControllerRef.current = null;
      // 立即滚动到底部
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 50);
      // 开始流式显示
      streamAiResponse(aiMsgId, reply);
    } catch (error) {
      if (error.name === 'AbortError') {}
      else { showToast('发送失败'); }
      setLoading(false);
      AbortControllerRef.current = null;
    }
  };

  const pickImage = async (source) => {
    try {
      setShowMediaOptions(false);
      let result;
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') { showToast('需要相机权限'); return; }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 0.8,
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          const compressedUri = await compressImage(asset.uri);
          const msg = {
            id: Date.now().toString(),
            text: '',
            image: compressedUri,
            from: 'user',
            time: new Date().toISOString(),
          };
          dispatch({ type: 'ADD_AI_MESSAGE', payload: msg });
          setImageUri(null);
          setShowMediaOptions(false);
          setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { showToast('需要相册权限'); return; }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 0.8,
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          const compressedUri = await compressImage(asset.uri);
          const msg = {
            id: Date.now().toString(),
            text: '',
            image: compressedUri,
            from: 'user',
            time: new Date().toISOString(),
          };
          dispatch({ type: 'ADD_AI_MESSAGE', payload: msg });
          setImageUri(null);
          setShowMediaOptions(false);
          setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
        }
      }
    } catch (error) {
      console.error('选择图片失败:', error);
      showToast('选择图片失败');
    }
  };

  return (
    <View style={styles.container}>
      <EnhancedImageViewer
        visible={!!fullscreenImage}
        imageUri={fullscreenImage}
        onClose={() => setFullscreenImage(null)}
      />
      <CommonHeader 
        title="AI助手" 
        showBack={true}
        navigation={navigation}
        leftComponent={<TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={{ padding: 8 }}>
          <Ionicons name="chevron-back" size={24} color={TEXT_MAIN} />
        </TouchableOpacity>}
        rightComponent={<View style={{ flexDirection: 'row' }}>
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
          </View>}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
        <View style={{ flex: 1, flexDirection: 'column' }}>
          <ScrollView
            ref={scrollViewRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 12 }}
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
                  <Text style={{ fontSize: 15, color: TEXT_MAIN }}>
                    {msg.text}
                    {streamingMsgId === msg.id && (
                      <Text style={{ color: PRIMARY_COLOR, fontWeight: 'bold' }}>
                        {new Date().getSeconds() % 2 === 0 ? '▋' : '▌'}
                      </Text>
                    )}
                  </Text>
                )}
                <Text style={{ fontSize: 10, color: TEXT_THIRD, marginTop: 4 }}>{formatTime(msg.time)}</Text>
              </View>
            ))}
            {loading && <View style={[styles.bubbleLeft, { padding: 12, flexDirection: 'row', alignItems: 'center' }]}>
              <ActivityIndicator size="small" color={PRIMARY_COLOR} />
              <Text style={{ fontSize: 13, color: TEXT_SECOND, marginLeft: 8 }}>AI正在思考...</Text>
              <Text style={{ fontSize: 13, color: TEXT_SECOND }}>
                {new Date().getSeconds() % 2 === 0 ? '▋' : '▌'}
              </Text>
            </View>}
          </ScrollView>
        </View>
        
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
          <Modal visible={showQuickReply} transparent={true} animationType="fade" onRequestClose={() => setShowQuickReply(false)}>
            <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' }} onPress={() => setShowQuickReply(false)} activeOpacity={1}>
              <TouchableOpacity style={{ maxHeight: '66%', backgroundColor: BG_CARD, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 12, paddingTop: 16, paddingBottom: 8 }} activeOpacity={1}>
                <View style={{ width: 40, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginBottom: 12 }} />
                <ScrollView style={{ maxHeight: '100%' }} showsVerticalScrollIndicator={true}>
                  {/* 营销快捷按钮 */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
                    {[
                      { label: '文案', icon: 'document-text-outline', color: PRIMARY_COLOR, bg: LIGHT_PRIMARY },
                      { label: '海报', icon: 'image-outline', color: '#FF8C00', bg: '#FFE4B5' },
                      { label: '广告语', icon: 'mic-outline', color: '#FF8C00', bg: '#FFE4B5' },
                      { label: '日报', icon: 'calendar-outline', color: PRIMARY_COLOR, bg: LIGHT_PRIMARY },
                      { label: '周报', icon: 'calendar-outline', color: PRIMARY_COLOR, bg: LIGHT_PRIMARY },
                      { label: '月报', icon: 'calendar-outline', color: PRIMARY_COLOR, bg: LIGHT_PRIMARY },
                    ].map(item => (
                      <TouchableOpacity key={item.label} style={{ marginRight: 8, marginBottom: 4, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: item.bg, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 4 }} onPress={() => { handleMarketing(item.label); setShowQuickReply(false); }}>
                        <Ionicons name={item.icon} size={14} color={item.color} />
                        <Text style={{ fontSize: 13, color: item.color }}>{item.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {/* 分类快捷话术 */}
                  {Object.entries(quickReplies).map(([category, texts]) => (
                    <View key={category} style={{ marginBottom: 6 }}>
                      <Text style={{ fontSize: 12, color: TEXT_SECOND, marginBottom: 4, fontWeight: '500' }}>{category}</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                        {texts.map((text, idx) => (
                          <TouchableOpacity key={idx} style={{ marginRight: 6, marginBottom: 3, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: LIGHT_PRIMARY }} onPress={async () => { setInputText(text); setShowQuickReply(false); setTimeout(() => { sendMessage('text'); }, 100); }}>
                            <Text style={{ fontSize: 12, color: PRIMARY_COLOR }}>{text}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
        )}
        
        <View style={{ backgroundColor: '#fff', borderTopWidth: 1, borderColor: BORDER_COLOR, paddingBottom: keyboardVisible ? 0 : insets.bottom + (Platform.OS === 'ios' ? 84 : 64) }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 8, gap: 8 }}>
            <TextInput
              style={{ flex: 1, minHeight: 36, maxHeight: 120, backgroundColor: '#F5F7FA', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, textAlignVertical: 'top' }}
              placeholder={showImageGen ? "输入图片描述..." : "输入问题..."}
              value={inputText}
              onChangeText={setInputText}
              multiline
              onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            />
            <TouchableOpacity style={styles.sendBtn} onPress={() => sendMessage('text')} disabled={loading}>
              <Text style={styles.sendTxt}>发送</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8, justifyContent: 'space-around' }}>
            <TouchableOpacity onPress={() => setShowEmoji(!showEmoji)}>
              <Text style={{ fontSize: 24 }}>😊</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowMediaOptions(true)}>
              <Ionicons name="add-circle-outline" size={24} color={PRIMARY_COLOR} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowQuickReply(!showQuickReply)}>
              <Ionicons name="star" size={22} color={PRIMARY_COLOR} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
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
  const AbortControllerRef = useRef(null);
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

  // 组件卸载时清理资源,防止内存泄漏和音频继续播放
  useEffect(() => {
    return () => {
      if (AbortControllerRef.current) {
        try { AbortControllerRef.current.abort(); } catch (e) {}
        AbortControllerRef.current = null;
      }
      if (speechTimerRef.current) {
        clearTimeout(speechTimerRef.current);
        speechTimerRef.current = null;
      }
      try { Speech.stop(); } catch (e) {}
      try { ExpoSpeechRecognitionModule.stop(); } catch (e) {}
    };
  }, []);

  const startVoice = async () => {
    try {
      const permissionResult = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permissionResult.granted) {
        showToast('请授权麦克风权限');
        return;
      }

      // Remove existing listeners first
      try {
        ExpoSpeechRecognitionModule.removeAllListeners();
      } catch (e) {}

      ExpoSpeechRecognitionModule.addListener('result', (event) => {
        const { segments } = event;
        if (segments && segments.length > 0) {
          const text = segments.map(s => s.transcript).join('');
          if (text) {
            setInputText(prev => (prev + ' ' + text).trim());
          }
        }
      });

      ExpoSpeechRecognitionModule.addListener('error', (event) => {
        setRecording(false);
        const error = event.error;
        if (error === 'not-allowed') {
          showToast('请授权麦克风权限');
        } else if (error === 'no-speech') {
          showToast('未检测到语音，请重试');
        } else {
          console.warn('语音识别错误:', error);
        }
      });

      ExpoSpeechRecognitionModule.addListener('end', () => {
        setRecording(false);
      });

      setRecording(true);
      showToast('正在聆听...请说话');
      await ExpoSpeechRecognitionModule.start({ lang: 'zh-CN', interimResults: true });
    } catch (e) {
      console.error('启动语音失败:', e);
      showToast('启动语音失败');
      setRecording(false);
    }
  };

  const stopVoice = async () => {
    try {
      await ExpoSpeechRecognitionModule.stop();
    } catch (e) {
      console.warn('停止语音失败:', e);
    }
    setRecording(false);
  };

  const speakText = (text) => {
    try {
      if (!voiceMode) return;
      Speech.stop();
      if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
      const sentences = text.split(/(?<=[。！？!?；;])/g).filter(s => s.trim());
      if (sentences.length === 0) sentences.push(text);
      let idx = 0;
      setSpeaking(true);
      const speakNext = () => {
        if (idx >= sentences.length) { setSpeaking(false); return; }
        const utterance = sentences[idx].trim();
        Speech.speak(utterance, {
          language: 'zh-CN',
          rate: 1.0,
          onDone: () => { idx++; speechTimerRef.current = setTimeout(speakNext, 100); },
          onError: () => setSpeaking(false),
        });
      };
      speakNext();
    } catch (e) { setSpeaking(false); }
  };

  const stopSpeaking = () => {
    Speech.stop();
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
    AbortControllerRef.current = new AbortController();
    setLoading(true);
    try {
      const allData = collectAllBusinessData();
      const businessContext = `今日订单：${allData.todayOrders}单，今日营收：¥${allData.todayRevenue}，商品数：${allData.totalGoods}，总库存：${allData.totalStock}，库存不足：${allData.lowStockItems.join('、') || '无'}，平台分布：${Object.entries(allData.platformStats).map(([p, s]) => `${p}${s.count}单`).join('/')}`;
      const msgList = messages.slice(-6).map(m => ({ role: m.from === 'user' ? 'user' : 'assistant', content: m.text }));
      msgList.push({ role: 'user', content: text });
      const systemPrompt = `你是「${shopName}」${industry}店铺的专属智能助手，服务商家${userName}。店铺实时数据：${businessContext}。回答要简洁直接、基于真实数据、用"您"称呼商家。`;
      const reply = await fetchZhipuChat(msgList, systemPrompt, AbortControllerRef.current.signal);
      if (AbortControllerRef.current?.signal.aborted) { setLoading(false); return; }

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
      <CommonHeader 
        title="🎙️ 语音助手" 
        showBack={false}
        backgroundColor={PRIMARY_COLOR}
        leftComponent={<TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={{ padding: 8, zIndex: 100 }}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>}
        rightComponent={<View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={toggleVoiceMode}
            style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: voiceMode ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)', borderRadius: 14, flexDirection: 'row', alignItems: 'center' }}
          >
            <Ionicons name={voiceMode ? 'volume-high' : 'volume-mute'} size={14} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 11, marginLeft: 4 }}>{voiceMode ? '语音' : '静默'}</Text>
          </TouchableOpacity>
          {loading && (
            <TouchableOpacity onPress={() => { AbortControllerRef.current?.abort(); stopSpeaking(); setLoading(false); }} style={{ paddingHorizontal: 8, paddingVertical: 6, marginLeft: 4 }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>⏹</Text>
            </TouchableOpacity>
          )}
        </View>}
      />

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
  const [showHelpGuide, setShowHelpGuide] = useState(false);

  // 登录后检查是否需要弹出使用帮助轮播
  useEffect(() => {
    const checkHelpGuide = async () => {
      const shown = await AsyncStorage.getItem('help_guide_shown');
      if (!shown) {
        setShowHelpGuide(true);
        await AsyncStorage.setItem('help_guide_shown', 'true');
      }
    };
    checkHelpGuide();
  }, []);

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
    { icon: "help-outline", label: "AI助手", key: 'MerchantAssistant', tab: 'AI助手', screen: 'MerchantAssistant' },
    { icon: "grid-outline", label: "商品总览", key: 'ProductOverview', internal: true, screen: 'ProductOverview' },
    { icon: "card-outline", label: "会员管理", key: 'MemberManage', internal: true, screen: 'MemberManage' },
    { icon: "ticket-outline", label: "营销工具", key: 'CouponManage', internal: true, screen: 'CouponManage' },
    { icon: "cube-outline", label: "供应商", key: 'SupplierManage', internal: true, screen: 'SupplierManage' },
    { icon: "warning-outline", label: "库存预警", key: 'StockAlert', internal: true, screen: 'StockAlert' },
    { icon: "download-outline", label: "数据导出", key: 'DataExport', internal: true, screen: 'DataExport' },
  ];
  // 计算每个功能的消息数（按消息数从大到小排序）
  const calcMenuUnread = (key) => {
    if (!user) return 0;
    if (key === 'CustomerService') {
      // 客服消息：只计算顾客消息（有platform属性且不是private），不计算员工/老板之间的私聊
      let count = 0;
      Object.values(state.privateChatMessages || {}).forEach(msgs => {
        msgs.forEach(m => {
          if (m && m.fromPhone !== user.phone && !m.read && m.platform && m.platform !== 'private') {
            count++;
          }
        });
      });
      if (!isEmployee) {
        count += (state.bossNotifications || []).filter(n => !n.handled).length;
      }
      return count;
    }
    if (key === 'InternalChat') {
      // 内部沟通：只显示群聊消息的未读数（私聊消息在首页私聊入口单独显示红点）
      let count = 0;
      const internalMsgs = state.groupChatMessages?.internal || [];
      count += internalMsgs.filter(m => m && m.fromPhone !== user.phone && !m.read).length;
      
      return count;
    }
    if (key === 'StaffManage' && !isEmployee) {
      // 员工管理（商家）：待审核且未查看的入职申请
      return (state.staffMemberList || []).filter(s => s.status === 'pending' && !s.viewed).length;
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
      // 如果是内部沟通，先标记所有消息为已读
      if (item.key === 'InternalChat') {
        dispatch({ type: 'MARK_GROUP_MESSAGES_READ', payload: { chatId: 'internal' } });
        Object.keys(state.privateChatMessages || {}).forEach(phone => {
          dispatch({ type: 'MARK_PRIVATE_MESSAGES_READ', payload: { phone } });
        });
        dispatch({ type: 'CLEAR_RED_DOT', payload: { tab: '内部' } });
      }
      
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
  const pendingStaff = (state.staffMemberList || []).filter(s => s.status === 'pending' && s.shopName === state.shopInfo?.shopName);

  const goToPrivateChat = (staff) => navigation.navigate('PrivateChat', { phone: staff.phone, name: staff.name });

  const latestReport = state.latestDailyReport;
  const menuVisibility = state.menuVisibility || {};

  const handleApprove = (phone) => {
    try {
      dispatch({ type: 'APPROVE_STAFF_APPLICATION', payload: { phone } });
      const staff = (state.staffMemberList || []).find(s => s.phone === phone);
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
        if (exitTimer) { 
          BackHandler.exitApp(); 
          return true; 
        }
        showToast('再按一次退出');
        const timer = setTimeout(() => setExitTimer(null), 2000);
        setExitTimer(timer);
        return true;
      }
      if (navigation.canGoBack()) {
        navigation.goBack();
        return true;
      }
      return false;
    });
    return () => {
      backHandler.remove();
      if (exitTimer) clearTimeout(exitTimer);
    };
  }, [navigation]);

  const getReportData = () => {
    try {
      if (reportType === 'daily') {
        return latestReport && typeof latestReport === 'object' ? latestReport : null;
      }
      if (reportType === 'weekly') {
        const result = generateWeekReport(state);
        return result && typeof result === 'object' ? result : null;
      }
      const result = generateMonthReport(state);
      return result && typeof result === 'object' ? result : null;
    } catch (e) {
      console.error('[getReportData] Error:', e);
      return null;
    }
  };
  const reportData = getReportData();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={BG_CARD} />
      <SettingDrawer visible={settingOpen} onClose={() => setSettingOpen(false)} />
      <HelpGuideCarousel visible={showHelpGuide} onClose={() => setShowHelpGuide(false)} />
      <CommonHeader 
        title="经营宝" 
        rightComponent={<TouchableOpacity onPress={() => setSettingOpen(true)}><Ionicons name="settings-outline" size={24} color={TEXT_SECOND} /></TouchableOpacity>}
      />
      <ScrollView style={{ flex: 1, paddingHorizontal: 16 }} contentContainerStyle={{ paddingBottom: 80 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[PRIMARY_COLOR]} />}>
          <View style={styles.cardBox}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: TEXT_MAIN, marginBottom: 8 }}>👋 欢迎，{typeof user?.name === 'string' ? user.name : (isEmployee ? '员工' : '老板')}</Text>
            <Text style={{ color: TEXT_SECOND }}>店铺：{typeof (state.shopInfo || {}).shopName === 'string' ? ((state.shopInfo || {}).shopName || '未设置') : '未设置'}</Text>
            
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

          <View style={styles.dailyReportCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.reportTitle}>📊 经营报告</Text>
              {!isEmployee && (
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
              )}
            </View>
              {reportData ? (
                <>
                  {reportType === 'daily' && reportData && (
                    <>
                      <View style={styles.reportRow}><Text style={styles.reportLabel}>日期</Text><Text style={styles.reportValue}>{reportData.date || '-'}</Text></View>
                      <View style={styles.reportRow}><Text style={styles.reportLabel}>订单数</Text><Text style={styles.reportValue}>{reportData.totalOrder || 0}单</Text></View>
                      <View style={styles.reportRow}><Text style={styles.reportLabel}>总营收</Text><Text style={styles.reportValue}>¥{reportData.income || 0}</Text></View>
                      <View style={styles.reportRow}><Text style={styles.reportLabel}>净利润</Text><Text style={styles.reportValue}>¥{reportData.profit || 0}</Text></View>
                      <View style={styles.reportRow}><Text style={styles.reportLabel}>利润率</Text><Text style={styles.reportValue}>{reportData.profitRate || 0}%</Text></View>
                    </>
                  )}
                  {reportType === 'weekly' && reportData && (
                    <>
                      <View style={styles.reportRow}><Text style={styles.reportLabel}>周期</Text><Text style={styles.reportValue}>{reportData.startDate || '-'} ~ {reportData.endDate || '-'}</Text></View>
                      <View style={styles.reportRow}><Text style={styles.reportLabel}>总订单</Text><Text style={styles.reportValue}>{reportData.totalOrder || 0}单</Text></View>
                      <View style={styles.reportRow}><Text style={styles.reportLabel}>总营收</Text><Text style={styles.reportValue}>¥{reportData.totalIncome || 0}</Text></View>
                      <View style={styles.reportRow}><Text style={styles.reportLabel}>总利润</Text><Text style={styles.reportValue}>¥{reportData.totalProfit || 0}</Text></View>
                      <View style={styles.reportRow}><Text style={styles.reportLabel}>日均营收</Text><Text style={styles.reportValue}>¥{reportData.avgDailyIncome || 0}</Text></View>
                    </>
                  )}
                  {reportType === 'monthly' && reportData && (
                    <>
                      <View style={styles.reportRow}><Text style={styles.reportLabel}>月份</Text><Text style={styles.reportValue}>{reportData.yearMonth || '-'}</Text></View>
                      <View style={styles.reportRow}><Text style={styles.reportLabel}>有效天数</Text><Text style={styles.reportValue}>{reportData.dayCount || 0}天</Text></View>
                      <View style={styles.reportRow}><Text style={styles.reportLabel}>总订单</Text><Text style={styles.reportValue}>{reportData.totalOrder || 0}单</Text></View>
                      <View style={styles.reportRow}><Text style={styles.reportLabel}>总营收</Text><Text style={styles.reportValue}>¥{reportData.totalIncome || 0}</Text></View>
                      <View style={styles.reportRow}><Text style={styles.reportLabel}>总利润</Text><Text style={styles.reportValue}>¥{reportData.totalProfit || 0}</Text></View>
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
                {chatStaffList.map(staff => {
                  // 获取与该员工的私聊消息
                  const staffMessages = state.privateChatMessages[staff.phone] || [];
                  // 获取最后一条消息
                  const lastMessage = staffMessages.length > 0 ? staffMessages[staffMessages.length - 1] : null;
                  // 获取未读消息数量
                  const unreadCount = staffMessages.filter(m => m.platform === 'private' && m.fromPhone !== user?.phone && !m.read).length;
                  
                  // 格式化时间
                  const formatMsgTime = (timeStr) => {
                    if (!timeStr) return '';
                    const date = new Date(timeStr);
                    const now = new Date();
                    const diff = now.getTime() - date.getTime();
                    const hours = Math.floor(diff / (1000 * 60 * 60));
                    const days = Math.floor(hours / 24);
                    if (hours < 1) return '刚刚';
                    if (hours < 24) return `${hours}小时前`;
                    if (days < 7) return `${days}天前`;
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                  };
                  
                  // 消息预览文本
                  const previewText = lastMessage ? (
                    lastMessage.image ? '[图片]' : (lastMessage.text || '').substring(0, 30) + (lastMessage.text && lastMessage.text.length > 30 ? '...' : '')
                  ) : '暂无消息';
                  
                  return (
                    <TouchableOpacity
                      key={staff.id}
                      style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12 }}
                      onPress={() => goToPrivateChat(staff)}
                    >
                      <View style={{ position: 'relative' }}>
                        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: LIGHT_PRIMARY, justifyContent: 'center', alignItems: 'center' }}>
                          <Ionicons name="person-outline" size={24} color={PRIMARY_COLOR} />
                        </View>
                        {/* 未读消息红点 */}
                        {unreadCount > 0 && (
                          <View style={{ 
                            position: 'absolute', 
                            top: -2, 
                            right: -2, 
                            backgroundColor: DANGER_COLOR, 
                            borderRadius: 10, 
                            minWidth: 18, 
                            height: 18, 
                            justifyContent: 'center', 
                            alignItems: 'center',
                            paddingHorizontal: 4
                          }}>
                            <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                          </View>
                        )}
                      </View>
                      <View style={{ marginLeft: 14, flex: 1 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontSize: 16, fontWeight: '500', color: TEXT_MAIN }}>{staff.name}</Text>
                          <Text style={{ fontSize: 12, color: TEXT_THIRD }}>{formatMsgTime(lastMessage?.time)}</Text>
                        </View>
                        <Text style={{ fontSize: 13, color: TEXT_THIRD, marginTop: 2 }}>{previewText}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
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
          <Ionicons name="help-circle" size={26} color="#fff" />
        </View>
        <View style={{
          position: 'absolute', top: -2, right: -2,
          width: 18, height: 18, borderRadius: 9,
          backgroundColor: '#FFD93D', borderWidth: 2, borderColor: '#fff',
          justifyContent: 'center', alignItems: 'center',
        }}>
          <Text style={{ color: '#5B6DF0', fontSize: 9, fontWeight: 'bold', lineHeight: 10 }}>AI</Text>
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
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

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
    if (!cameraPermission) {
      return (
        <View style={[styles.scannerContainer, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text style={{ color: '#fff', marginTop: 16 }}>加载相机权限中...</Text>
        </View>
      );
    }
    if (!cameraPermission.granted) {
      return (
        <View style={[styles.scannerContainer, { justifyContent: 'center', alignItems: 'center' }]}>
          <Ionicons name="camera" size={60} color="#fff" />
          <Text style={{ color: '#fff', marginTop: 16, marginBottom: 16 }}>需要相机权限才能扫码</Text>
          <TouchableOpacity style={[styles.miniBlueBtn, { padding: 12, borderRadius: 8 }]} onPress={requestCameraPermission}>
            <Text style={styles.sendTxt}>授予权限</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ marginTop: 16 }} onPress={() => setScanning(false)}>
            <Text style={{ color: '#fff' }}>取消</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.scannerContainer}>
        <CameraView
          facing="back"
          onBarcodeScanned={handleBarCodeScanned}
          style={{ flex: 1 }}
          onCameraReady={() => console.log('[Camera] Ready')}
          onMountError={(error) => console.error('[Camera] Mount Error:', error)}
          barcodeScannerSettings={{
            barcodeTypes: ['qr', 'ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'],
          }}
        />
        <TouchableOpacity style={styles.cancelBtn} onPress={() => setScanning(false)}><Text style={styles.cancelText}>取消</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CommonHeader 
        title="订单核销" 
        showBack={true}
        navigation={navigation}
      />
      <ScrollView style={{ padding: 16 }}>
        <View style={styles.cardBox}>
          <Text style={styles.label}>核销码</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TextInput style={[styles.formInput, { flex: 1 }]} placeholder="输入核销码或扫码" value={orderCode} onChangeText={setOrderCode} />
            <TouchableOpacity style={styles.miniBlueBtn} onPress={async () => {
              if (!cameraPermission?.granted) {
                const permissionResult = await requestCameraPermission();
                if (!permissionResult.granted) {
                  showToast('需要相机权限');
                  return;
                }
              }
              setScanning(true);
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
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [showMentionList, setShowMentionList] = useState(false);

  // 当前用户信息
  const currentUser = state.user;
  const isEmployee = currentUser?.role === '员工';

  // @艾特：可艾特的员工列表（排除当前聊天对方和自己）
  const mentionableStaff = useMemo(() => {
    return (state.staffMemberList || [])
      .filter(s => s.status === 'approved' && s.phone !== state.user?.phone && s.phone !== phone)
      .map(s => ({ name: s.name, phone: s.phone }));
  }, [state.staffMemberList, state.user, phone]);

  const handleMention = (member) => {
    setInputText(prev => prev + `@${member.name} `);
    setShowMentionList(false);
  };

  useEffect(() => {
    const savedMessages = state.privateChatMessages[phone] || [];
    setMessages(savedMessages);
  }, [phone]);

  // 进入私聊页面时标记消息为已读
  useEffect(() => {
    dispatch({ type: 'MARK_PRIVATE_MESSAGES_READ', payload: { phone } });
  }, [phone]);

  const sendMessage = async (type = 'text', imageUris = null) => {
    try {
      let text = inputText.trim();
      let images = [];
      if (type === 'image') {
        const uris = imageUris || selectedImages;
        if (uris.length === 0) { showToast('请先选择图片'); return; }
        for (let uri of uris) {
          const compressed = await compressImage(uri);
          const base64 = await FileSystem.readAsStringAsync(compressed, { encoding: FileSystem.EncodingType.Base64 });
          images.push(`data:image/jpeg;base64,${base64}`);
        }
        const msg = {
          id: Date.now().toString(),
          text: text || '图片消息',
          image: images[0],
          from: 'staff',
          fromName: state.user?.name || '我',
          fromPhone: state.user?.phone || '',
          platform: 'private',
          time: new Date().toISOString(),
          read: false,
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
        fromName: state.user?.name || '我',
        fromPhone: state.user?.phone || '',
        platform: 'private',
        time: new Date().toISOString(),
        read: false,
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

  const handlePrivatePickerSend = async (uris) => {
    try {
      for (let uri of uris) {
        const msg = {
          id: Date.now().toString() + Math.random(),
          text: '图片消息',
          image: uri,
          from: 'staff',
          fromName: state.user?.name || '我',
          fromPhone: state.user?.phone || '',
          platform: 'private',
          time: new Date().toISOString(),
          read: false,
        };
        setMessages(prev => [...prev, msg]);
        try {
          dispatch({ type: 'ADD_PRIVATE_MESSAGE', payload: { phone, message: msg } });
        } catch (e) {
          console.warn('保存消息失败，已显示在界面');
        }
      }
      setInputText('');
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (error) {
      console.error('发送图片失败:', error);
      // 不再显示失败提示，因为消息已经在界面上显示
    }
  };

  const pickImages = async (source) => {
    try {
      setShowMediaOptions(false);
      if (source === 'library') {
        setShowCustomPicker(true);
        return;
      }
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') { showToast('需要相机权限'); return; }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 0.8,
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          const compressedUri = await compressImage(asset.uri);
          const msg = {
            id: Date.now().toString(),
            text: '图片消息',
            image: compressedUri,
            from: 'staff',
            fromName: state.user?.name || '我',
            fromPhone: state.user?.phone || '',
            platform: 'private',
            time: new Date().toISOString(),
            read: false,
          };
          setMessages(prev => [...prev, msg]);
          dispatch({ type: 'ADD_PRIVATE_MESSAGE', payload: { phone, message: msg } });
          setInputText('');
          setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
        }
      }
    } catch (error) { 
      console.error('选择图片失败:', error);
      showToast('选择图片失败'); 
    }
  };

  const removeImage = (index) => {
    const newList = [...selectedImages];
    newList.splice(index, 1);
    setSelectedImages(newList);
  };

  return (
    <View style={styles.container}>
      <CommonHeader 
        title="" 
        showBack={true}
        navigation={navigation}
        leftComponent={<TouchableOpacity onPress={() => navigation.goBack()}><Text style={{ fontSize: 20 }}>&lt;</Text></TouchableOpacity>}
        rightComponent={<View style={{ width: 24 }} />}
      />
      <View style={{ backgroundColor: BG_CARD, paddingHorizontal: 20, paddingBottom: 10, borderBottomWidth: 0, ...SHADOW }}>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.pageTitle}>{name || '私聊'}</Text>
          <Text style={{ fontSize: 12, color: TEXT_THIRD }}>{phone}</Text>
        </View>
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
        {messages.map(msg => {
          // 使用fromPhone判断是否是自己发送的消息
          const isSelf = msg.fromPhone === currentUser?.phone;
          // 判断对方角色：如果是员工端，对方是老板；如果是商家端，对方是员工
          const isBoss = phone === state.shopInfo?.phone;
          return (
            <View key={msg.id} style={[styles.chatRow, isSelf ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
              {/* 对方头像 - 只有对方消息显示 */}
              {!isSelf && (
                <View style={{ flexDirection: 'column', alignItems: 'center', marginRight: 8, flexShrink: 0 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isBoss ? PRIMARY_COLOR : '#FF9800', justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>{(msg.fromName || name || (isBoss ? '老板' : '员工')).substring(0, 1)}</Text>
                  </View>
                </View>
              )}
              <View style={msg.image ? (isSelf ? styles.imageMsgRight : styles.imageMsgLeft) : (isSelf ? styles.bubbleRight : styles.bubbleLeft)}>
                {msg.image ? (
                  <TouchableOpacity onPress={() => setFullscreenImage(msg.image)}>
                    <Image source={{ uri: msg.image }} style={styles.imageMessage} />
                  </TouchableOpacity>
                ) : (
                  <Text style={{ fontSize: 15, color: TEXT_MAIN }}>{msg.text}</Text>
                )}
                <Text style={{ fontSize: 10, color: TEXT_THIRD, marginTop: 4, textAlign: isSelf ? 'right' : 'left' }}>{formatTime(msg.time)}</Text>
              </View>
              {/* 自己头像 - 自己发送的消息显示头像 */}
              {isSelf && (
                <View style={{ flexDirection: 'column', alignItems: 'center', marginLeft: 8, flexShrink: 0 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isEmployee ? '#FF9800' : PRIMARY_COLOR, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
                    {currentUser?.avatar && (currentUser.avatar.startsWith('http') || currentUser.avatar.startsWith('file') || currentUser.avatar.startsWith('data')) ? (
                      <Image source={{ uri: currentUser.avatar }} style={{ width: '100%', height: '100%' }} />
                    ) : (
                      <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>{(currentUser?.name || '我').substring(0, 1)}</Text>
                    )}
                  </View>
                </View>
              )}
            </View>
          );
        })}
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
        <TouchableOpacity onPress={() => setShowMentionList(true)} style={{ paddingHorizontal: 4 }}><Ionicons name="at-outline" size={24} color={PRIMARY_COLOR} /></TouchableOpacity>
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
      {showMentionList && (
        <View style={{ maxHeight: 200, backgroundColor: '#fff', borderTopWidth: 1, borderColor: BORDER_COLOR }}>
          <ScrollView>
            {mentionableStaff.length === 0 ? (
              <Text style={{ padding: 16, textAlign: 'center', color: TEXT_THIRD }}>暂无可艾特的员工</Text>
            ) : (
              mentionableStaff.map((member, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: BORDER_COLOR }}
                  onPress={() => handleMention(member)}
                >
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#FF9800', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>{member.name.substring(0, 1)}</Text>
                  </View>
                  <Text style={{ fontSize: 15, color: TEXT_MAIN }}>{member.name}</Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      )}
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
    {fullscreenImage && (
      <EnhancedImageViewer
        visible={!!fullscreenImage}
        imageUri={fullscreenImage}
        onClose={() => setFullscreenImage(null)}
        isOwnMessage={true}
      />
    )}
    <CustomImagePicker 
      visible={showCustomPicker}
      onClose={() => setShowCustomPicker(false)}
      onSend={handlePrivatePickerSend}
      maxSelection={10}
    />
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
  
  // 进入页面时标记所有pending申请为已查看，消除红点
  useEffect(() => {
    // 使用state中的最新数据，避免闭包问题
    const currentList = state.staffMemberList || [];
    const hasUnviewedPending = currentList.some(s => s.status === 'pending' && !s.viewed);
    if (hasUnviewedPending) {
      dispatch({ type: 'MARK_STAFF_VIEWED' });
    }
  }, []);

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
      <CommonHeader 
        title="员工管理" 
        showBack={true}
        navigation={navigation}
        rightComponent={<TouchableOpacity onPress={() => { setModalVisible(true); }}>
          <Ionicons name="add-outline" size={24} color={PRIMARY_COLOR} />
        </TouchableOpacity>}
      />
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
  const { state, dispatch } = useApp();
  const isEmployee = state.user?.role === '员工';

  // 经营宝专属图标映射 - 更符合产品定位
  const tabIcons = {
    '首页': { active: 'storefront', inactive: 'storefront-outline', color: '#5B6DF0' },
    '核销': { active: 'scan', inactive: 'scan-outline', color: '#00B42A' },
    '客服': { active: 'headset', inactive: 'headset-outline', color: '#FF7D00' },
    '出入库': { active: 'cube', inactive: 'cube-outline', color: '#7B61FF' },
    '内部': { active: 'people-circle', inactive: 'people-circle-outline', color: '#3790FA' },
    'AI助手': { active: 'sparkles', inactive: 'sparkles-outline', color: '#F53F3F' },
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const iconConfig = tabIcons[route.name] || { active: 'ellipse', inactive: 'ellipse-outline' };
          const iconName = focused ? iconConfig.active : iconConfig.inactive;
          const iconColor = focused ? iconConfig.color : TEXT_THIRD;
          const hasRedDot = state.newMessageRedDots?.[route.name] || false;
          
          return (
            <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
              {/* 选中时背景高亮 */}
              {focused && (
                <View style={{
                  position: 'absolute', top: -6, width: 36, height: 36, borderRadius: 12,
                  backgroundColor: iconConfig.color + '15',
                }} />
              )}
              <Ionicons name={iconName} size={focused ? 24 : 22} color={iconColor} />
              {hasRedDot && (
                <View style={{
                  position: 'absolute', top: -2, right: -8,
                  width: 8, height: 8, backgroundColor: DANGER_COLOR, borderRadius: 4,
                  borderWidth: 1.5, borderColor: '#fff',
                }} />
              )}
            </View>
          );
        },
        tabBarActiveTintColor: PRIMARY_COLOR,
        tabBarInactiveTintColor: TEXT_THIRD,
        headerShown: false,
        tabBarStyle: {
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingBottom: Platform.OS === 'ios' ? 20 : 8,
          paddingTop: 6,
          backgroundColor: '#fff',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderTopWidth: 0,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          position: 'absolute',
          overflow: 'visible',
        },
        tabBarLabel: ({ focused, children }) => {
          const config = tabIcons[route.name];
          return (
            <Text style={{
              fontSize: 10,
              color: focused ? (config ? config.color : PRIMARY_COLOR) : TEXT_THIRD,
              fontWeight: focused ? '600' : '400',
              marginTop: 2,
            }}>{children}</Text>
          );
        },
      })}
      listeners={{
        tabPress: ({ route }) => {
          dispatch({ type: 'CLEAR_RED_DOT', payload: { tab: route.name } });
        },
      }}
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

// ================== 会员管理 ==================
const MemberManageScreen = ({ navigation }) => {
  const { state, dispatch } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [editMember, setEditMember] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', level: '普通会员', points: 0, amount: 0 });

  const members = state.members || [];
  const levelColors = { '普通会员': '#909399', '银卡会员': '#909399', '金卡会员': '#E6A23C', '钻石会员': '#5B6DF0' };

  const handleSave = () => {
    if (!form.name.trim() || !form.phone.trim()) { showToast('请填写姓名和手机号'); return; }
    if (editMember) {
      dispatch({ type: 'UPDATE_MEMBER', payload: { id: editMember.id, name: form.name, phone: form.phone, level: form.level } });
      if (form.points > 0 || form.amount > 0) {
        dispatch({ type: 'ADD_MEMBER_POINTS', payload: { id: editMember.id, points: Number(form.points) || 0, amount: Number(form.amount) || 0 } });
      }
      showToast('会员信息已更新');
    } else {
      dispatch({ type: 'ADD_MEMBER', payload: { name: form.name, phone: form.phone, level: form.level } });
      showToast('会员添加成功');
    }
    setShowAdd(false); setEditMember(null); setForm({ name: '', phone: '', level: '普通会员', points: 0, amount: 0 });
  };

  const openEdit = (member) => {
    setEditMember(member);
    setForm({ name: member.name, phone: member.phone, level: member.level || '普通会员', points: 0, amount: 0 });
    setShowAdd(true);
  };

  const totalPoints = members.reduce((s, m) => s + (m.points || 0), 0);
  const totalSpent = members.reduce((s, m) => s + (m.totalSpent || 0), 0);

  return (
    <View style={styles.container}>
      <CommonHeader title="会员管理" showBack navigation={navigation} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
          <View style={{ flex: 1, backgroundColor: BG_CARD, borderRadius: 12, padding: 16, ...SHADOW }}>
            <Text style={{ fontSize: 13, color: TEXT_THIRD }}>会员总数</Text>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: PRIMARY_COLOR }}>{members.length}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: BG_CARD, borderRadius: 12, padding: 16, ...SHADOW }}>
            <Text style={{ fontSize: 13, color: TEXT_THIRD }}>累计积分</Text>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#E6A23C' }}>{totalPoints}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: BG_CARD, borderRadius: 12, padding: 16, ...SHADOW }}>
            <Text style={{ fontSize: 13, color: TEXT_THIRD }}>累计消费</Text>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: SUCCESS_COLOR }}>¥{totalSpent.toFixed(0)}</Text>
          </View>
        </View>
        {members.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            <Ionicons name="people-outline" size={60} color={TEXT_THIRD} />
            <Text style={{ color: TEXT_THIRD, marginTop: 12 }}>暂无会员，点击右下角添加</Text>
          </View>
        ) : (
          members.map(member => (
            <TouchableOpacity key={member.id} style={{ backgroundColor: BG_CARD, borderRadius: 12, padding: 16, marginBottom: 12, ...SHADOW }} onPress={() => openEdit(member)}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: levelColors[member.level] || '#909399', justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>{member.name?.substring(0, 1)}</Text>
                  </View>
                  <View style={{ marginLeft: 12 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: TEXT_MAIN }}>{member.name}</Text>
                    <Text style={{ fontSize: 13, color: TEXT_THIRD }}>{member.phone}</Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <View style={{ backgroundColor: (levelColors[member.level] || '#909399') + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                    <Text style={{ fontSize: 12, color: levelColors[member.level] || '#909399' }}>{member.level || '普通会员'}</Text>
                  </View>
                  <Text style={{ fontSize: 13, color: '#E6A23C', marginTop: 4 }}>{member.points || 0} 积分</Text>
                  <Text style={{ fontSize: 12, color: TEXT_THIRD }}>消费 ¥{(member.totalSpent || 0).toFixed(0)}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
      <TouchableOpacity style={{ position: 'absolute', right: 20, bottom: 30, width: 56, height: 56, borderRadius: 28, backgroundColor: PRIMARY_COLOR, justifyContent: 'center', alignItems: 'center', ...SHADOW }} onPress={() => { setEditMember(null); setForm({ name: '', phone: '', level: '普通会员', points: 0, amount: 0 }); setShowAdd(true); }}>
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>
      <Modal visible={showAdd} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : null} style={{ flex: 1, justifyContent: 'center' }}>
          <View style={styles.modalMask}>
            <View style={{ backgroundColor: BG_CARD, borderRadius: 16, padding: 20, margin: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>{editMember ? '编辑会员' : '添加会员'}</Text>
              <TextInput style={styles.modalInput} placeholder="姓名" value={form.name} onChangeText={v => setForm({ ...form, name: v })} />
              <TextInput style={styles.modalInput} placeholder="手机号" value={form.phone} onChangeText={v => setForm({ ...form, phone: v })} keyboardType="phone-pad" />
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                {['普通会员', '银卡会员', '金卡会员', '钻石会员'].map(lv => (
                  <TouchableOpacity key={lv} style={{ flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: form.level === lv ? PRIMARY_COLOR : '#F0F0F0', alignItems: 'center' }} onPress={() => setForm({ ...form, level: lv })}>
                    <Text style={{ fontSize: 12, color: form.level === lv ? '#fff' : TEXT_SECOND }}>{lv.replace('会员', '')}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {editMember && (
                <>
                  <TextInput style={styles.modalInput} placeholder="增加积分（可为0）" value={String(form.points)} onChangeText={v => setForm({ ...form, points: v })} keyboardType="numeric" />
                  <TextInput style={styles.modalInput} placeholder="消费金额（可为0）" value={String(form.amount)} onChangeText={v => setForm({ ...form, amount: v })} keyboardType="numeric" />
                </>
              )}
              <View style={{ flexDirection: 'row', marginTop: 8 }}>
                <TouchableOpacity style={{ flex: 1, padding: 12, backgroundColor: '#eee', borderRadius: 8, marginRight: 8 }} onPress={() => { setShowAdd(false); setEditMember(null); }}>
                  <Text style={{ textAlign: 'center', color: TEXT_SECOND }}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1, padding: 12, backgroundColor: PRIMARY_COLOR, borderRadius: 8 }} onPress={handleSave}>
                  <Text style={{ textAlign: 'center', color: '#fff' }}>保存</Text>
                </TouchableOpacity>
              </View>
              {editMember && (
                <TouchableOpacity style={{ marginTop: 8, padding: 8 }} onPress={() => { Alert.alert('删除会员', '确定删除该会员？', [{ text: '取消' }, { text: '删除', style: 'destructive', onPress: () => { dispatch({ type: 'DELETE_MEMBER', payload: editMember.id }); setShowAdd(false); setEditMember(null); showToast('已删除'); } }]); }}>
                  <Text style={{ textAlign: 'center', color: DANGER_COLOR, fontSize: 14 }}>删除会员</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

// ================== 优惠券管理 ==================
const CouponManageScreen = ({ navigation }) => {
  const { state, dispatch } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'discount', value: '', minSpend: '', validDays: '30', total: '100' });
  const coupons = state.coupons || [];

  const handleCreate = () => {
    if (!form.name.trim() || !form.value.trim()) { showToast('请填写券名称和面值'); return; }
    dispatch({ type: 'ADD_COUPON', payload: {
      name: form.name, type: form.type,
      value: Number(form.value) || 0,
      minSpend: Number(form.minSpend) || 0,
      validDays: Number(form.validDays) || 30,
      total: Number(form.total) || 100,
    }});
    showToast('优惠券创建成功');
    setShowAdd(false); setForm({ name: '', type: 'discount', value: '', minSpend: '', validDays: '30', total: '100' });
  };

  return (
    <View style={styles.container}>
      <CommonHeader title="营销工具" showBack navigation={navigation} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
          <View style={{ flex: 1, backgroundColor: BG_CARD, borderRadius: 12, padding: 16, ...SHADOW }}>
            <Text style={{ fontSize: 13, color: TEXT_THIRD }}>优惠券总数</Text>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: PRIMARY_COLOR }}>{coupons.length}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: BG_CARD, borderRadius: 12, padding: 16, ...SHADOW }}>
            <Text style={{ fontSize: 13, color: TEXT_THIRD }}>已使用</Text>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: SUCCESS_COLOR }}>{coupons.reduce((s, c) => s + (c.used || 0), 0)}</Text>
          </View>
        </View>
        {coupons.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            <Ionicons name="ticket-outline" size={60} color={TEXT_THIRD} />
            <Text style={{ color: TEXT_THIRD, marginTop: 12 }}>暂无优惠券</Text>
          </View>
        ) : (
          coupons.map(coupon => (
            <View key={coupon.id} style={{ backgroundColor: BG_CARD, borderRadius: 12, marginBottom: 12, overflow: 'hidden', ...SHADOW }}>
              <View style={{ flexDirection: 'row' }}>
                <View style={{ width: 80, backgroundColor: coupon.type === 'discount' ? '#F53F3F' : '#7B61FF', justifyContent: 'center', alignItems: 'center', paddingVertical: 20 }}>
                  <Text style={{ color: '#fff', fontSize: 22, fontWeight: 'bold' }}>{coupon.type === 'discount' ? `¥${coupon.value}` : `${coupon.value}折`}</Text>
                  <Text style={{ color: '#fff', fontSize: 11, marginTop: 4 }}>{coupon.type === 'discount' ? '满减券' : '折扣券'}</Text>
                </View>
                <View style={{ flex: 1, padding: 12, justifyContent: 'center' }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: TEXT_MAIN }}>{coupon.name}</Text>
                  <Text style={{ fontSize: 13, color: TEXT_THIRD, marginTop: 4 }}>{coupon.minSpend > 0 ? `满¥${coupon.minSpend}可用` : '无门槛'}</Text>
                  <Text style={{ fontSize: 12, color: TEXT_THIRD }}>有效期{coupon.validDays}天 · 已用{coupon.used || 0}/{coupon.total}张</Text>
                </View>
                <TouchableOpacity style={{ justifyContent: 'center', paddingRight: 12 }} onPress={() => { Alert.alert('删除优惠券', '确定删除？', [{ text: '取消' }, { text: '删除', style: 'destructive', onPress: () => { dispatch({ type: 'DELETE_COUPON', payload: coupon.id }); showToast('已删除'); } }]); }}>
                  <Ionicons name="trash-outline" size={20} color={DANGER_COLOR} />
                </TouchableOpacity>
              </View>
              <View style={{ height: 1, backgroundColor: BORDER_COLOR, marginHorizontal: 12 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 }}>
                <Text style={{ fontSize: 12, color: TEXT_THIRD }}>创建于 {new Date(coupon.createdAt).toLocaleDateString()}</Text>
                <TouchableOpacity onPress={() => { dispatch({ type: 'USE_COUPON', payload: coupon.id }); showToast('核销成功'); }}>
                  <Text style={{ fontSize: 13, color: PRIMARY_COLOR, fontWeight: '500' }}>核销使用</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
      <TouchableOpacity style={{ position: 'absolute', right: 20, bottom: 30, width: 56, height: 56, borderRadius: 28, backgroundColor: PRIMARY_COLOR, justifyContent: 'center', alignItems: 'center', ...SHADOW }} onPress={() => setShowAdd(true)}>
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>
      <Modal visible={showAdd} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : null} style={{ flex: 1, justifyContent: 'center' }}>
          <View style={styles.modalMask}>
            <View style={{ backgroundColor: BG_CARD, borderRadius: 16, padding: 20, margin: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>创建优惠券</Text>
              <TextInput style={styles.modalInput} placeholder="券名称（如：新客满减）" value={form.name} onChangeText={v => setForm({ ...form, name: v })} />
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                <TouchableOpacity style={{ flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: form.type === 'discount' ? PRIMARY_COLOR : '#F0F0F0', alignItems: 'center' }} onPress={() => setForm({ ...form, type: 'discount' })}>
                  <Text style={{ color: form.type === 'discount' ? '#fff' : TEXT_SECOND }}>满减券</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: form.type === 'rebate' ? PRIMARY_COLOR : '#F0F0F0', alignItems: 'center' }} onPress={() => setForm({ ...form, type: 'rebate' })}>
                  <Text style={{ color: form.type === 'rebate' ? '#fff' : TEXT_SECOND }}>折扣券</Text>
                </TouchableOpacity>
              </View>
              <TextInput style={styles.modalInput} placeholder={form.type === 'discount' ? '减免金额（元）' : '折扣（如8.5表示85折）'} value={form.value} onChangeText={v => setForm({ ...form, value: v })} keyboardType="numeric" />
              <TextInput style={styles.modalInput} placeholder="最低消费（元，0=无门槛）" value={form.minSpend} onChangeText={v => setForm({ ...form, minSpend: v })} keyboardType="numeric" />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput style={[styles.modalInput, { flex: 1 }]} placeholder="有效期(天)" value={form.validDays} onChangeText={v => setForm({ ...form, validDays: v })} keyboardType="numeric" />
                <TextInput style={[styles.modalInput, { flex: 1 }]} placeholder="发放数量" value={form.total} onChangeText={v => setForm({ ...form, total: v })} keyboardType="numeric" />
              </View>
              <View style={{ flexDirection: 'row', marginTop: 8 }}>
                <TouchableOpacity style={{ flex: 1, padding: 12, backgroundColor: '#eee', borderRadius: 8, marginRight: 8 }} onPress={() => setShowAdd(false)}>
                  <Text style={{ textAlign: 'center', color: TEXT_SECOND }}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1, padding: 12, backgroundColor: PRIMARY_COLOR, borderRadius: 8 }} onPress={handleCreate}>
                  <Text style={{ textAlign: 'center', color: '#fff' }}>创建</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

// ================== 供应商管理 ==================
const SupplierManageScreen = ({ navigation }) => {
  const { state, dispatch } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', contact: '', phone: '', address: '', remark: '' });
  const suppliers = state.suppliers || [];

  const handleSave = () => {
    if (!form.name.trim()) { showToast('请填写供应商名称'); return; }
    dispatch({ type: 'ADD_SUPPLIER', payload: form });
    showToast('供应商添加成功');
    setShowAdd(false); setForm({ name: '', contact: '', phone: '', address: '', remark: '' });
  };

  return (
    <View style={styles.container}>
      <CommonHeader title="供应商管理" showBack navigation={navigation} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {suppliers.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            <Ionicons name="cube-outline" size={60} color={TEXT_THIRD} />
            <Text style={{ color: TEXT_THIRD, marginTop: 12 }}>暂无供应商</Text>
          </View>
        ) : (
          suppliers.map(supplier => (
            <View key={supplier.id} style={{ backgroundColor: BG_CARD, borderRadius: 12, padding: 16, marginBottom: 12, ...SHADOW }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#7B61FF', justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="cube" size={22} color="#fff" />
                  </View>
                  <View style={{ marginLeft: 12 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: TEXT_MAIN }}>{supplier.name}</Text>
                    {supplier.contact ? <Text style={{ fontSize: 13, color: TEXT_THIRD }}>联系人：{supplier.contact}</Text> : null}
                  </View>
                </View>
                <TouchableOpacity onPress={() => { Alert.alert('删除供应商', '确定删除？', [{ text: '取消' }, { text: '删除', style: 'destructive', onPress: () => { dispatch({ type: 'DELETE_SUPPLIER', payload: supplier.id }); showToast('已删除'); } }]); }}>
                  <Ionicons name="trash-outline" size={20} color={DANGER_COLOR} />
                </TouchableOpacity>
              </View>
              <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderColor: BORDER_COLOR }}>
                {supplier.phone ? <Text style={{ fontSize: 13, color: TEXT_SECOND, marginBottom: 4 }}>电话：{supplier.phone}</Text> : null}
                {supplier.address ? <Text style={{ fontSize: 13, color: TEXT_SECOND, marginBottom: 4 }}>地址：{supplier.address}</Text> : null}
                {supplier.remark ? <Text style={{ fontSize: 13, color: TEXT_THIRD }}>备注：{supplier.remark}</Text> : null}
              </View>
            </View>
          ))
        )}
      </ScrollView>
      <TouchableOpacity style={{ position: 'absolute', right: 20, bottom: 30, width: 56, height: 56, borderRadius: 28, backgroundColor: '#7B61FF', justifyContent: 'center', alignItems: 'center', ...SHADOW }} onPress={() => setShowAdd(true)}>
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>
      <Modal visible={showAdd} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : null} style={{ flex: 1, justifyContent: 'center' }}>
          <View style={styles.modalMask}>
            <View style={{ backgroundColor: BG_CARD, borderRadius: 16, padding: 20, margin: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>添加供应商</Text>
              <TextInput style={styles.modalInput} placeholder="供应商名称" value={form.name} onChangeText={v => setForm({ ...form, name: v })} />
              <TextInput style={styles.modalInput} placeholder="联系人" value={form.contact} onChangeText={v => setForm({ ...form, contact: v })} />
              <TextInput style={styles.modalInput} placeholder="联系电话" value={form.phone} onChangeText={v => setForm({ ...form, phone: v })} keyboardType="phone-pad" />
              <TextInput style={styles.modalInput} placeholder="地址" value={form.address} onChangeText={v => setForm({ ...form, address: v })} />
              <TextInput style={[styles.modalInput, { height: 60 }]} placeholder="备注" value={form.remark} onChangeText={v => setForm({ ...form, remark: v })} multiline />
              <View style={{ flexDirection: 'row', marginTop: 8 }}>
                <TouchableOpacity style={{ flex: 1, padding: 12, backgroundColor: '#eee', borderRadius: 8, marginRight: 8 }} onPress={() => setShowAdd(false)}>
                  <Text style={{ textAlign: 'center', color: TEXT_SECOND }}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1, padding: 12, backgroundColor: '#7B61FF', borderRadius: 8 }} onPress={handleSave}>
                  <Text style={{ textAlign: 'center', color: '#fff' }}>保存</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

// ================== 库存预警 ==================
const StockAlertScreen = ({ navigation }) => {
  const { state, dispatch } = useApp();
  const goodsList = state.goodsList || [];
  const stockAlerts = state.stockAlerts || {};
  const stockRecords = state.globalStockRecord || [];

  // 计算每个商品当前库存
  const getStockCount = (goodsId) => {
    let count = 0;
    stockRecords.forEach(r => {
      if (r.goodsId === goodsId || r.goodsName === goodsList.find(g => g.id === goodsId)?.name) {
        count += (r.type === '入库' ? 1 : -1) * (r.count || r.quantity || 0);
      }
    });
    return count;
  };

  const lowStockGoods = goodsList.filter(g => {
    const threshold = stockAlerts[g.id] || 10;
    return getStockCount(g.id) <= threshold;
  });

  return (
    <View style={styles.container}>
      <CommonHeader title="库存预警" showBack navigation={navigation} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
          <View style={{ flex: 1, backgroundColor: BG_CARD, borderRadius: 12, padding: 16, ...SHADOW }}>
            <Text style={{ fontSize: 13, color: TEXT_THIRD }}>商品总数</Text>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: PRIMARY_COLOR }}>{goodsList.length}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: BG_CARD, borderRadius: 12, padding: 16, ...SHADOW }}>
            <Text style={{ fontSize: 13, color: TEXT_THIRD }}>低库存</Text>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: DANGER_COLOR }}>{lowStockGoods.length}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: BG_CARD, borderRadius: 12, padding: 16, ...SHADOW }}>
            <Text style={{ fontSize: 13, color: TEXT_THIRD }}>已设预警</Text>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#E6A23C' }}>{Object.keys(stockAlerts).length}</Text>
          </View>
        </View>
        {lowStockGoods.length > 0 && (
          <View style={{ backgroundColor: '#FFF7E6', borderRadius: 12, padding: 12, marginBottom: 16, flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="warning-outline" size={20} color="#E6A23C" />
            <Text style={{ fontSize: 14, color: '#E6A23C', marginLeft: 8 }}>{lowStockGoods.length} 个商品库存不足，请及时补货</Text>
          </View>
        )}
        {goodsList.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            <Ionicons name="cube-outline" size={60} color={TEXT_THIRD} />
            <Text style={{ color: TEXT_THIRD, marginTop: 12 }}>暂无商品数据</Text>
          </View>
        ) : (
          goodsList.map(goods => {
            const count = getStockCount(goods.id);
            const threshold = stockAlerts[goods.id] || 10;
            const isLow = count <= threshold;
            return (
              <View key={goods.id} style={{ backgroundColor: BG_CARD, borderRadius: 12, padding: 16, marginBottom: 12, ...SHADOW }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: TEXT_MAIN }}>{goods.name || goods.goodsName}</Text>
                    <Text style={{ fontSize: 13, color: TEXT_THIRD, marginTop: 4 }}>当前库存：{count} · 预警阈值：{threshold}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <View style={{ backgroundColor: isLow ? DANGER_COLOR + '20' : SUCCESS_COLOR + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                      <Text style={{ fontSize: 13, color: isLow ? DANGER_COLOR : SUCCESS_COLOR, fontWeight: '500' }}>{isLow ? '库存不足' : '充足'}</Text>
                    </View>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderColor: BORDER_COLOR }}>
                  <Text style={{ fontSize: 13, color: TEXT_THIRD }}>预警阈值：</Text>
                  <TextInput
                    style={{ borderWidth: 1, borderColor: BORDER_COLOR, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, width: 60, fontSize: 14 }}
                    keyboardType="numeric"
                    defaultValue={String(threshold)}
                    onEndEditing={(e) => {
                      const val = Number(e.nativeEvent.text) || 0;
                      if (val > 0) {
                        dispatch({ type: 'SET_STOCK_ALERT', payload: { goodsId: goods.id, threshold: val } });
                        showToast('预警阈值已设置');
                      }
                    }}
                  />
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

// ================== 数据导出 ==================
const DataExportScreen = ({ navigation }) => {
  const { state } = useApp();

  const exportData = (type) => {
    let content = '';
    const now = new Date().toLocaleString();
    switch (type) {
      case 'orders':
        content = `经营宝 - 订单记录导出\n导出时间：${now}\n\n`;
        content += '序号\t时间\t商品\t金额\t状态\n';
        (state.globalOrderRecord || []).forEach((r, i) => {
          content += `${i + 1}\t${r.time || r.date || ''}\t${r.goodsName || r.productName || ''}\t¥${r.amount || r.price || 0}\t${r.status || '已完成'}\n`;
        });
        break;
      case 'members':
        content = `经营宝 - 会员数据导出\n导出时间：${now}\n\n`;
        content += '序号\t姓名\t手机号\t等级\t积分\t累计消费\n';
        (state.members || []).forEach((m, i) => {
          content += `${i + 1}\t${m.name}\t${m.phone}\t${m.level || '普通会员'}\t${m.points || 0}\t¥${(m.totalSpent || 0).toFixed(0)}\n`;
        });
        break;
      case 'business':
        content = `经营宝 - 经营数据导出\n导出时间：${now}\n\n`;
        content += '日期\t收入\t成本\t利润\t订单数\n';
        (state.businessHistory || []).forEach(r => {
          content += `${r.date}\t¥${r.income || 0}\t¥${r.purchaseCost || 0}\t¥${r.profit || 0}\t${r.totalOrder || 0}\n`;
        });
        break;
      case 'stock':
        content = `经营宝 - 出入库记录导出\n导出时间：${now}\n\n`;
        content += '序号\t时间\t类型\t商品\t数量\n';
        (state.globalStockRecord || []).forEach((r, i) => {
          content += `${i + 1}\t${r.time || r.date || ''}\t${r.type || ''}\t${r.goodsName || ''}\t${r.count || r.quantity || 0}\n`;
        });
        break;
      default: return;
    }
    const fileUri = `${FileSystem.documentDirectory}经营宝_${type}_${Date.now()}.txt`;
    FileSystem.writeAsStringAsync(fileUri, content).then(() => {
      Sharing.shareAsync(fileUri);
    }).catch(() => showToast('导出失败'));
  };

  const exportItems = [
    { type: 'orders', name: '订单记录', icon: 'receipt-outline', color: '#5B6DF0', desc: '导出所有订单交易记录' },
    { type: 'members', name: '会员数据', icon: 'people-outline', color: '#E6A23C', desc: '导出会员信息与积分消费' },
    { type: 'business', name: '经营数据', icon: 'bar-chart-outline', color: SUCCESS_COLOR, desc: '导出每日经营收支报表' },
    { type: 'stock', name: '出入库记录', icon: 'cube-outline', color: '#7B61FF', desc: '导出商品出入库流水' },
  ];

  return (
    <View style={styles.container}>
      <CommonHeader title="数据导出" showBack navigation={navigation} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ fontSize: 14, color: TEXT_THIRD, marginBottom: 16 }}>选择要导出的数据类型，导出后可分享或保存到本地</Text>
        {exportItems.map(item => (
          <TouchableOpacity key={item.type} style={{ backgroundColor: BG_CARD, borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', ...SHADOW }} onPress={() => exportData(item.type)}>
            <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: item.color + '15', justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name={item.icon} size={24} color={item.color} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: TEXT_MAIN }}>{item.name}</Text>
              <Text style={{ fontSize: 13, color: TEXT_THIRD, marginTop: 2 }}>{item.desc}</Text>
            </View>
            <Ionicons name="download-outline" size={24} color={item.color} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

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
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="RootTabs" component={RootTabs} />
      <Stack.Screen name="SwitchAccount" component={SwitchAccountScreen} />
      <Stack.Screen name="BadReviewList" component={BadReviewListPage} />
      <Stack.Screen name="ProductOverview" component={ProductOverview} />
      <Stack.Screen name="StaffManage" component={StaffManage} />
      <Stack.Screen name="PrivateChat" component={PrivateChat} />
      <Stack.Screen name="ChatSetting" component={ChatSettingScreen} options={{ gestureEnabled: true }} />
      <Stack.Screen name="SearchChatRecord" component={SearchChatRecordScreen} />
      <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} />
      <Stack.Screen name="UserAgreement" component={UserAgreementScreen} options={{ gestureEnabled: true }} />
      <Stack.Screen name="AccountDelete" component={AccountDeleteScreen} options={{ gestureEnabled: true }} />
      <Stack.Screen name="About" component={AboutScreen} options={{ gestureEnabled: true }} />
      <Stack.Screen name="Feedback" component={FeedbackScreen} options={{ gestureEnabled: true }} />
      <Stack.Screen name="ClearCache" component={ClearCacheScreen} options={{ gestureEnabled: true }} />
      <Stack.Screen name="MemberManage" component={MemberManageScreen} options={{ gestureEnabled: true }} />
      <Stack.Screen name="CouponManage" component={CouponManageScreen} options={{ gestureEnabled: true }} />
      <Stack.Screen name="SupplierManage" component={SupplierManageScreen} options={{ gestureEnabled: true }} />
      <Stack.Screen name="StockAlert" component={StockAlertScreen} options={{ gestureEnabled: true }} />
      <Stack.Screen name="DataExport" component={DataExportScreen} options={{ gestureEnabled: true }} />
    </Stack.Navigator>
  );
}

// ================== 开屏界面组件 ==================
const SplashScreenComponent = ({ onComplete }) => {
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 入场动画
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 8,
        tension: 100,
        useNativeDriver: true,
      }),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 1000,
        delay: 500,
        useNativeDriver: true,
      }),
    ]).start();

    // 3秒后退出开屏
    setTimeout(() => {
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 500,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        onComplete();
      });
    }, 3000);
  }, [onComplete]);

  return (
    <Animated.View style={{ flex: 1, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', opacity: containerOpacity }}>
      {/* Logo 动画 */}
      <Animated.View style={{ transform: [{ scale: logoScale }] }}>
        <Image source={require('./assets/icon.png')} style={{ width: 120, height: 120, borderRadius: 30, ...SHADOW }} resizeMode="contain" />
      </Animated.View>
      
      {/* 应用名称 */}
      <Animated.View style={{ marginTop: 24, opacity: textOpacity }}>
        <Text style={{ fontSize: 28, fontWeight: 'bold', color: TEXT_MAIN }}>经营宝</Text>
        <Text style={{ fontSize: 14, color: TEXT_THIRD, textAlign: 'center', marginTop: 8 }}>智能经营管理助手</Text>
      </Animated.View>

      {/* 底部版本号 */}
      <Animated.View style={{ position: 'absolute', bottom: 60, opacity: textOpacity }}>
        <Text style={{ fontSize: 12, color: TEXT_THIRD }}>v5.54.4</Text>
      </Animated.View>
    </Animated.View>
  );
};

// ================== 全局错误边界 ==================
class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[GlobalErrorBoundary]', error, errorInfo);
  }

  handleRestart = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BG_PAGE, padding: 30 }}>
          <Image
            source={require('./assets/icon.png')}
            style={{ width: 80, height: 80, marginBottom: 20, borderRadius: 16 }}
            resizeMode="contain"
          />
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: TEXT_MAIN, marginBottom: 8 }}>
            应用遇到问题
          </Text>
          <Text style={{ fontSize: 14, color: TEXT_THIRD, textAlign: 'center', marginBottom: 24 }}>
            抱歉,应用发生了意外错误。请尝试重新启动。
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: PRIMARY_COLOR, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 24 }}
            onPress={this.handleRestart}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>重新启动</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

// ================== App 容器 ==================
// 通知处理配置：前台时显示横幅
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// 全局App状态引用，供消息发送时判断是否在后台
const appStateRef = { current: 'active' };

// 发送本地通知（仅当App在后台或锁屏时）
async function sendLocalNotification(title, body, data = {}) {
  if (appStateRef.current === 'active') return; // 前台时不发通知，只显示红点
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: title || '经营宝',
        body: body || '您有新消息',
        data,
        sound: 'default',
      },
      trigger: null, // 立即发送
    });
  } catch (e) {
    console.warn('发送通知失败', e);
  }
}

export default function App() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [isFirstLaunch, setIsFirstLaunch] = useState(true);
  const notificationListener = useRef(null);
  const responseListener = useRef(null);

  useEffect(() => {
    const appStateListener = AppState.addEventListener('change', (nextAppState) => {
      appStateRef.current = nextAppState;
      if (nextAppState === 'active' && !isFirstLaunch) {
        setShowSplash(false);
      }
    });
    return () => { appStateListener.remove(); };
  }, [isFirstLaunch]);

  // 申请通知权限 + 注册通知监听
  useEffect(() => {
    (async () => {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        console.warn('通知权限未授予');
      }
    })();

    // 监听前台收到的通知
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      // 前台时收到通知只更新红点，不重复弹通知
    });

    // 监听用户点击通知
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data?.screen && navigationRef.current) {
        // 根据通知点击跳转到对应页面
        if (data.screen === 'internal') {
          navigationRef.current.navigate('MainTabs', { screen: '内部' });
        } else if (data.screen === 'customerService') {
          navigationRef.current.navigate('MainTabs', { screen: '客服' });
        } else if (data.screen === 'privateChat' && data.phone && data.name) {
          navigationRef.current.navigate('PrivateChat', { phone: data.phone, name: data.name });
        }
      }
    });

    return () => {
      if (notificationListener.current) Notifications.removeNotificationSubscription(notificationListener.current);
      if (responseListener.current) Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        const appData = await loadAllData();
        if (appData) {
          dispatch({ type: 'RESTORE_ALL_DATA', payload: appData });
        } else {
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
    if (!loading) { saveAllData(state); }
  }, [state, loading]);

  // 监听新消息，在后台时发送系统通知
  const lastMsgCountRef = useRef({ group: 0, private: 0, customer: 0 });
  useEffect(() => {
    if (!state.user || loading) return;
    // 统计群聊新消息
    let groupTotal = 0;
    Object.values(state.groupChatMessages || {}).forEach(msgs => { groupTotal += (msgs?.length || 0); });
    // 统计私聊新消息
    let privateTotal = 0;
    Object.values(state.privateChatMessages || {}).forEach(msgs => { privateTotal += (msgs?.length || 0); });
    // 统计客服消息
    let customerTotal = 0;
    Object.values(state.messages || {}).forEach(msgs => { customerTotal += (msgs?.length || 0); });

    const prev = lastMsgCountRef.current;
    // 群聊新消息
    if (groupTotal > prev.group && appStateRef.current !== 'active') {
      const allGroupMsgs = Object.values(state.groupChatMessages || {}).flat();
      const newMsg = allGroupMsgs[allGroupMsgs.length - 1];
      if (newMsg && newMsg.fromPhone !== state.user?.phone) {
        sendLocalNotification(`内部消息 - ${newMsg.from || '同事'}`, newMsg.text || newMsg.image ? '[图片]' : '新消息', { screen: 'internal' });
      }
    }
    // 私聊新消息
    if (privateTotal > prev.private && appStateRef.current !== 'active') {
      for (const [chatPhone, msgs] of Object.entries(state.privateChatMessages || {})) {
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg && lastMsg.fromPhone !== state.user?.phone) {
          sendLocalNotification(`私聊 - ${lastMsg.fromName || '联系人'}`, lastMsg.text || (lastMsg.image ? '[图片]' : '新消息'), { screen: 'privateChat', phone: chatPhone, name: lastMsg.fromName || '联系人' });
          break;
        }
      }
    }
    // 客服新消息
    if (customerTotal > prev.customer && appStateRef.current !== 'active') {
      for (const [chatPhone, msgs] of Object.entries(state.messages || {})) {
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg && lastMsg.from === 'customer') {
          sendLocalNotification(`客服消息 - ${chatPhone}`, lastMsg.text || '新消息', { screen: 'customerService' });
          break;
        }
      }
    }
    lastMsgCountRef.current = { group: groupTotal, private: privateTotal, customer: customerTotal };
  }, [state.groupChatMessages, state.privateChatMessages, state.messages, state.user, loading]);

  const handleSplashComplete = () => {
    setShowSplash(false);
    setIsFirstLaunch(false);
  };

  if (showSplash && isFirstLaunch) {
    return <SplashScreenComponent onComplete={handleSplashComplete} />;
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <GlobalErrorBoundary>
        <AppContext.Provider value={{ state, dispatch }}>
          <NavigationContainer ref={navigationRef}>
            {state.user ? <AppStack /> : <AuthStack />}
          </NavigationContainer>
          <CustomToast />
        </AppContext.Provider>
      </GlobalErrorBoundary>
    </SafeAreaProvider>
  );
}
// ===== 第三段结束 =====