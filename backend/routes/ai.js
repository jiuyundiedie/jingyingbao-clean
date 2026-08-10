const express = require('express');
const axios = require('axios');
const db = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

const AI_PROVIDERS = {
  zhipu: {
    url: process.env.ZHIPU_URL || 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    key: process.env.ZHIPU_API_KEY,
    model: 'glm-4-flash',
  },
  siliconflow: {
    url: 'https://api.siliconflow.cn/v1/chat/completions',
    key: process.env.SILICONFLOW_API_KEY,
  },
  siliconflow_img: {
    url: 'https://api.siliconflow.cn/v1/images/generations',
    key: process.env.SILICONFLOW_API_KEY,
  },
  bigmodel_img: {
    url: 'https://open.bigmodel.cn/api/paas/v4/images/generations',
    key: process.env.BAIDU_API_KEY,
  }
};

// ========== AI 对话代理 ==========
router.post('/chat', authRequired, async (req, res) => {
  try {
    const { messages, provider, system_prompt } = req.body;
    const providerKey = provider || 'zhipu';
    const config = AI_PROVIDERS[providerKey] || AI_PROVIDERS.zhipu;

    if (!config.key || config.key.length < 5) {
      return res.status(500).json({ error: 'AI 服务密钥未配置' });
    }

    const systemMsg = system_prompt || '你是经营宝AI助手，帮助中小商家解答经营问题。';
    const fullMessages = [{ role: 'system', content: systemMsg }, ...messages];

    const response = await axios.post(config.url, {
      model: config.model || 'glm-4-flash',
      messages: fullMessages,
      temperature: 0.7,
      max_tokens: 2000,
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + config.key,
      },
      timeout: 30000,
    });

    const content = response.data?.choices?.[0]?.message?.content || '';

    // 记录到 ai_conversations
    const shop = db.prepare('SELECT * FROM shops WHERE owner_id = ?').get(req.user.id);
    if (shop) {
      const convKey = Date.now();
      db.prepare(
        'INSERT INTO ai_conversations (user_id, shop_id, messages, industry) VALUES (?, ?, ?, ?)'
      ).run(req.user.id, shop.id, JSON.stringify(messages), '餐饮类');
    }

    res.json({ success: true, content });
  } catch (error) {
    console.error('[AI Chat Error]', error.message);
    res.status(500).json({ error: 'AI 服务调用失败: ' + error.message });
  }
});

// ========== AI 图片生成代理 ==========
router.post('/image', authRequired, async (req, res) => {
  try {
    const { prompt, provider, size, quality } = req.body;
    const providerKey = provider || 'siliconflow_img';
    const config = AI_PROVIDERS[providerKey];
    const qualityLevel = quality || 'standard';

    if (!config || !config.key) {
      return res.status(500).json({ error: '图片服务密钥未配置' });
    }

    // 根据画质选择模型和参数
    let model, steps, imageSize;
    if (providerKey === 'siliconflow_img') {
      const modelMap = {
        standard: 'black-forest-labs/FLUX.1-schnell',
        hd: 'black-forest-labs/FLUX.1-dev',
        ultra: 'black-forest-labs/FLUX.1-dev'
      };
      const stepsMap = { standard: 4, hd: 20, ultra: 28 };
      const sizeMap = { standard: '1024x1024', hd: '1024x1024', ultra: '1440x1024' };
      model = modelMap[qualityLevel] || modelMap.standard;
      steps = stepsMap[qualityLevel] || 4;
      imageSize = size || sizeMap[qualityLevel] || '1024x1024';
    } else {
      model = providerKey === 'bigmodel_img' ? 'ernie-vilg-v2' : 'stable-diffusion-xl';
      imageSize = size || '1024x1024';
    }

    const reqBody = providerKey === 'siliconflow_img' ? {
      model,
      prompt,
      image_size: imageSize,
      num_inference_steps: steps,
    } : {
      model,
      prompt,
      size: imageSize,
      n: 1,
      response_format: 'url',
      quality: qualityLevel === 'ultra' ? 'hd' : 'standard',
    };

    const timeout = qualityLevel === 'ultra' ? 120000 : qualityLevel === 'hd' ? 60000 : 60000;

    const response = await axios.post(config.url, reqBody, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + config.key,
      },
      timeout,
    });

    const imageUrl = response.data?.data?.[0]?.url || response.data?.images?.[0]?.url || '';
    res.json({ success: true, imageUrl });
  } catch (error) {
    console.error('[AI Image Error]', error.message);
    res.status(500).json({ error: '图片生成失败: ' + error.message });
  }
});

// ========== 语音转文字代理 ==========
router.post('/speech', authRequired, async (req, res) => {
  try {
    // 暂未实现, 保留接口
    res.json({ success: false, error: '语音识别接口暂未实现' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
