const express = require('express');
const db = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

// ========== 版本检查 ==========
router.post('/check', (req, res) => {
  const { platform, currentVersion } = req.body;
  if (!platform) return res.status(400).json({ error: '缺少 platform 参数' });

  const latest = db.prepare(`
    SELECT * FROM app_versions
    WHERE platform = ? AND status = 'active'
    ORDER BY id DESC LIMIT 1
  `).get(platform);

  if (!latest) {
    return res.json({ hasUpdate: false });
  }

  // 比较版本（简化字符串比较，实际可用语义版本）
  const currentParts = (currentVersion || '0.0.0').split('.').map(Number);
  const latestParts = latest.version.split('.').map(Number);
  
  let hasUpdate = false;
  for (let i = 0; i < 3; i++) {
    if ((latestParts[i] || 0) > (currentParts[i] || 0)) { hasUpdate = true; break; }
    if ((latestParts[i] || 0) < (currentParts[i] || 0)) break;
  }

  res.json({
    hasUpdate,
    version: latest.version,
    isMandatory: latest.is_mandatory === 1,
    downloadUrl: latest.download_url,
    releaseNotes: latest.release_notes,
    content: JSON.parse(latest.content || '[]'),
  });
});

// ========== 版本管理（管理端）==========
router.get('/versions', authRequired, (req, res) => {
  const versions = db.prepare('SELECT * FROM app_versions ORDER BY id DESC').all();
  res.json({ data: versions });
});

router.post('/versions', authRequired, (req, res) => {
  const { version, platform, isMandatory, downloadUrl, releaseNotes, content, status } = req.body;
  if (!version || !platform) {
    return res.status(400).json({ error: '缺少版本号或平台参数' });
  }
  const result = db.prepare(`
    INSERT INTO app_versions (version, platform, is_mandatory, download_url, release_notes, content, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    version, platform,
    isMandatory ? 1 : 0,
    downloadUrl || '',
    releaseNotes || '',
    JSON.stringify(content || []),
    status || 'active'
  );
  res.json({ success: true, id: result.lastInsertRowid });
});

router.put('/versions/:id', authRequired, (req, res) => {
  const data = req.body;
  const sets = [];
  const vals = [];
  const allowed = ['version', 'platform', 'download_url', 'release_notes', 'status'];
  allowed.forEach(key => {
    if (data[key] !== undefined) { sets.push(`${key.replace(/_([a-z])/g, (_,c)=>c.toUpperCase())} = ?`); vals.push(data[key]); }
  });
  if (data.isMandatory !== undefined) { sets.push('is_mandatory = ?'); vals.push(data.isMandatory ? 1 : 0); }
  if (data.content !== undefined) { sets.push('content = ?'); vals.push(JSON.stringify(data.content)); }
  if (sets.length === 0) return res.json({ success: true });
  vals.push(req.params.id);
  db.prepare(`UPDATE app_versions SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  res.json({ success: true });
});

router.delete('/versions/:id', authRequired, (req, res) => {
  db.prepare('DELETE FROM app_versions WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ========== 远程配置 ==========
router.get('/config', (req, res) => {
  const { platform } = req.query;
  let sql = 'SELECT config_key, config_value, description FROM remote_configs WHERE 1=1';
  const params = [];
  if (platform) { sql += ' AND (platform = ? OR platform = "all")'; params.push(platform); }
  const configs = db.prepare(sql).all(...params);
  const result = {};
  configs.forEach(c => { result[c.config_key] = c.config_value; });
  res.json({ data: result });
});

router.post('/config', authRequired, (req, res) => {
  const { key, value, description, platform } = req.body;
  if (!key) return res.status(400).json({ error: '缺少 key 参数' });
  db.prepare(`
    INSERT INTO remote_configs (config_key, config_value, description, platform)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(config_key) DO UPDATE SET
      config_value = excluded.config_value,
      description = excluded.description,
      updated_at = CURRENT_TIMESTAMP
  `).run(key, value || '', description || '', platform || 'all');
  res.json({ success: true });
});

// 初始化默认远程配置
const initDefaultConfigs = () => {
  const defaults = [
    { key: 'feature_membership_enabled', value: 'false', description: '商家会员功能开关', platform: 'all' },
    { key: 'feature_coupons_enabled', value: 'true', description: '优惠券功能开关', platform: 'all' },
    { key: 'feature_ai_enabled', value: 'true', description: 'AI助手功能开关', platform: 'all' },
    { key: 'feature_analytics_enabled', value: 'true', description: '用户行为分析开关', platform: 'all' },
    { key: 'maintenance_mode', value: 'false', description: '维护模式', platform: 'all' },
    { key: 'force_update_version', value: '', description: '强制更新的最低版本', platform: 'all' },
  ];
  const upsert = db.prepare(`
    INSERT INTO remote_configs (config_key, config_value, description, platform)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(config_key) DO UPDATE SET
      config_value = excluded.config_value,
      description = excluded.description,
      updated_at = CURRENT_TIMESTAMP
  `);
  defaults.forEach(d => upsert.run(d.key, d.value, d.description, d.platform));
  console.log('[Config] 默认远程配置已初始化');
};

initDefaultConfigs();

module.exports = router;
