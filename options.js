const RULES_KEY = 'rh_rules';

let rules = [];
let currentRuleIndex = -1;
let currentResponseId = null;

const rulesList = document.getElementById('rulesList');
const detailHeader = document.getElementById('detailHeader');
const ruleDetail = document.getElementById('ruleDetail');
const emptyDetail = document.getElementById('emptyDetail');
const ruleForm = document.getElementById('ruleForm');

const addRuleBtn = document.getElementById('addRuleBtn');
const saveRuleBtn = document.getElementById('saveRuleBtn');
const deleteRuleBtn = document.getElementById('deleteRuleBtn');
const formatJsonBtn = document.getElementById('formatJsonBtn');
const addTabBtn = document.getElementById('addTabBtn');
const deleteTabBtn = document.getElementById('deleteTabBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');

const fullscreenOverlay = document.getElementById('fullscreenOverlay');
const fullscreenTextarea = document.getElementById('fullscreenTextarea');
const fullscreenSave = document.getElementById('fullscreenSave');
const fullscreenCancel = document.getElementById('fullscreenCancel');

const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');

const ruleNameInput = document.getElementById('ruleName');
const ruleEnabledInput = document.getElementById('ruleEnabled');
const urlPatternInput = document.getElementById('urlPattern');
const responseTabs = document.getElementById('responseTabs');
const tabNameInput = document.getElementById('tabName');
const tabContentInput = document.getElementById('tabContent');

// ========== 初始化 ==========
async function init() {
  await loadRules();
  renderRulesList();
  bindEvents();
}

async function loadRules() {
  const data = await chrome.storage.local.get(RULES_KEY);
  rules = data[RULES_KEY] || [];
  // 兼容旧数据：将单个 response 字符串迁移为 responses 数组
  rules.forEach(rule => {
    if (!rule.responses && rule.response) {
      rule.responses = [{
        id: generateId('resp'),
        name: '默认',
        content: rule.response
      }];
      rule.selectedResponseId = rule.responses[0].id;
      delete rule.response;
    }
    if (!rule.responses) {
      rule.responses = [];
    }
  });
}

async function saveRules() {
  await chrome.storage.local.set({ [RULES_KEY]: rules });
}

function generateId(prefix) {
  return prefix + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
}

// ========== 规则列表渲染 ==========
function renderRulesList() {
  if (rules.length === 0) {
    rulesList.innerHTML = `
      <div class="empty-state">
        <p>暂无规则</p>
        <p class="hint">点击"新建规则"开始</p>
      </div>
    `;
    return;
  }

  rulesList.innerHTML = rules.map((rule, index) => {
    const selectedResp = getSelectedResponse(rule);
    return `
      <div class="rule-item ${index === currentRuleIndex ? 'active' : ''}" data-index="${index}">
        <div class="rule-item-header">
          <div class="rule-item-name">${escapeHtml(rule.name || '未命名规则')}</div>
          <div class="rule-item-toggle ${rule.enabled ? 'enabled' : ''}" data-index="${index}"></div>
        </div>
        <div class="rule-item-url">${escapeHtml(rule.urlPattern || '未设置 URL')}</div>
        <div class="rule-item-tab">${selectedResp ? escapeHtml(selectedResp.name) : '无配置'}</div>
      </div>
    `;
  }).join('');

  document.querySelectorAll('.rule-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (!e.target.classList.contains('rule-item-toggle')) {
        const index = parseInt(item.dataset.index);
        selectRule(index);
      }
    });
  });

  document.querySelectorAll('.rule-item-toggle').forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(toggle.dataset.index);
      toggleRule(index);
    });
  });
}

function toggleRule(index) {
  rules[index].enabled = !rules[index].enabled;
  saveRules();
  renderRulesList();
  if (currentRuleIndex === index) {
    ruleEnabledInput.checked = rules[index].enabled;
  }
}

// ========== 规则选中 ==========
function selectRule(index) {
  currentRuleIndex = index;
  const rule = rules[index];

  emptyDetail.style.display = 'none';
  detailHeader.style.display = 'flex';
  ruleDetail.style.display = 'block';

  ruleNameInput.value = rule.name || '';
  ruleEnabledInput.checked = rule.enabled || false;
  urlPatternInput.value = rule.urlPattern || '';

  // 选中默认 response
  if (rule.responses && rule.responses.length > 0) {
    const selected = rule.responses.find(r => r.id === rule.selectedResponseId) || rule.responses[0];
    currentResponseId = selected.id;
  } else {
    currentResponseId = null;
  }

  renderTabs();
  renderTabContent();
  renderRulesList();
}

// ========== Tab 渲染 ==========
function renderTabs() {
  const rule = rules[currentRuleIndex];
  if (!rule || !rule.responses || rule.responses.length === 0) {
    responseTabs.innerHTML = '';
    deleteTabBtn.disabled = true;
    return;
  }

  responseTabs.innerHTML = rule.responses.map(resp => `
    <div class="tab-item ${resp.id === currentResponseId ? 'active' : ''}" data-id="${resp.id}">
      ${escapeHtml(resp.name || '未命名')}
    </div>
  `).join('');

  document.querySelectorAll('.tab-item').forEach(tab => {
    tab.addEventListener('click', () => {
      const id = tab.dataset.id;
      selectResponseTab(id);
    });
  });

  deleteTabBtn.disabled = rule.responses.length <= 1;
}

function renderTabContent() {
  const rule = rules[currentRuleIndex];
  if (!rule) return;

  const resp = rule.responses.find(r => r.id === currentResponseId);
  if (resp) {
    tabNameInput.value = resp.name || '';
    tabContentInput.value = resp.content || '';
  } else {
    tabNameInput.value = '';
    tabContentInput.value = '';
  }
}

// 暂存当前 tab 的未保存更改到内存
function stashCurrentTab() {
  if (currentRuleIndex !== -1 && currentResponseId) {
    const rule = rules[currentRuleIndex];
    const resp = rule.responses.find(r => r.id === currentResponseId);
    if (resp) {
      resp.name = tabNameInput.value.trim() || resp.name;
      resp.content = tabContentInput.value;
    }
  }
}

function selectResponseTab(id) {
  stashCurrentTab();

  currentResponseId = id;
  if (currentRuleIndex !== -1) {
    rules[currentRuleIndex].selectedResponseId = id;
  }
  renderTabs();
  renderTabContent();
  renderRulesList(); // 更新列表中显示的选中 tab
}

function addResponseTab() {
  if (currentRuleIndex === -1) return;
  const rule = rules[currentRuleIndex];
  if (!rule.responses) rule.responses = [];

  stashCurrentTab();

  const newResp = {
    id: generateId('resp'),
    name: '配置 ' + (rule.responses.length + 1),
    content: '{"code": 200, "message": "ok"}'
  };
  rule.responses.push(newResp);
  currentResponseId = newResp.id;
  rule.selectedResponseId = newResp.id;

  renderTabs();
  renderTabContent();
  renderRulesList();
  saveRules();
  saveRuleBtn.style.background = '#ff9800';
}

function deleteResponseTab() {
  if (currentRuleIndex === -1) return;
  const rule = rules[currentRuleIndex];
  if (!rule.responses || rule.responses.length <= 1) return;

  stashCurrentTab();

  const idx = rule.responses.findIndex(r => r.id === currentResponseId);
  if (idx === -1) return;

  rule.responses.splice(idx, 1);
  currentResponseId = rule.responses[0].id;
  rule.selectedResponseId = currentResponseId;

  renderTabs();
  renderTabContent();
  renderRulesList();
  saveRules();
  saveRuleBtn.style.background = '#ff9800';
}

// ========== 规则 CRUD ==========
function addRule() {
  const newRule = {
    name: '新规则',
    enabled: true,
    urlPattern: '',
    responses: [{
      id: generateId('resp'),
      name: '默认',
      content: '{"code": 200, "message": "ok"}'
    }],
    selectedResponseId: null
  };
  newRule.selectedResponseId = newRule.responses[0].id;

  rules.push(newRule);
  saveRules();
  renderRulesList();
  selectRule(rules.length - 1);
}

async function saveCurrentRule() {
  if (currentRuleIndex === -1) return;

  const rule = rules[currentRuleIndex];

  // 验证 JSON
  try {
    JSON.parse(tabContentInput.value);
  } catch (e) {
    alert('返回内容不是有效的 JSON 格式！\n\n' + e.message);
    return;
  }

  // 更新当前选中的 response
  const resp = rule.responses.find(r => r.id === currentResponseId);
  if (resp) {
    resp.name = tabNameInput.value.trim() || '未命名';
    resp.content = tabContentInput.value.trim();
  }

  rule.name = ruleNameInput.value.trim() || '未命名规则';
  rule.enabled = ruleEnabledInput.checked;
  rule.urlPattern = urlPatternInput.value.trim();
  rule.selectedResponseId = currentResponseId;

  await saveRules();
  renderRulesList();
  renderTabs();

  const originalText = saveRuleBtn.textContent;
  saveRuleBtn.textContent = '已保存';
  saveRuleBtn.style.background = '#4caf50';
  setTimeout(() => {
    saveRuleBtn.textContent = originalText;
    saveRuleBtn.style.background = '';
  }, 1500);
}

async function deleteCurrentRule() {
  if (currentRuleIndex === -1) return;
  if (!confirm('确定要删除这个规则吗？')) return;

  rules.splice(currentRuleIndex, 1);
  await saveRules();

  currentRuleIndex = -1;
  currentResponseId = null;
  emptyDetail.style.display = 'flex';
  detailHeader.style.display = 'none';
  ruleDetail.style.display = 'none';

  renderRulesList();
}

// ========== 全屏编辑 ==========
function openFullscreen() {
  if (currentRuleIndex === -1) return;
  fullscreenTextarea.value = tabContentInput.value;
  fullscreenOverlay.style.display = 'flex';
  fullscreenTextarea.focus();
}

function saveFullscreen() {
  tabContentInput.value = fullscreenTextarea.value;
  closeFullscreen();
  saveRuleBtn.style.background = '#ff9800';
}

function closeFullscreen() {
  fullscreenOverlay.style.display = 'none';
}

// ========== 工具函数 ==========
function formatJson() {
  try {
    const json = JSON.parse(tabContentInput.value);
    tabContentInput.value = JSON.stringify(json, null, 2);
  } catch (e) {
    alert('JSON 格式错误！\n\n' + e.message);
  }
}

function getSelectedResponse(rule) {
  if (!rule.responses || rule.responses.length === 0) return null;
  return rule.responses.find(r => r.id === rule.selectedResponseId) || rule.responses[0];
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ========== 导出 / 导入 ==========
async function exportRules() {
  const data = JSON.stringify(rules, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'request-hacker-rules-' + new Date().toISOString().slice(0, 19).replace(/:/g, '-') + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importRules() {
  importFile.click();
}

importFile.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const imported = JSON.parse(text);

    if (!Array.isArray(imported)) {
      alert('导入文件格式错误：必须是规则数组');
      return;
    }

    // 增量导入：同名覆盖，不同名追加
    let added = 0;
    let overwritten = 0;
    imported.forEach(importedRule => {
      const existingIdx = rules.findIndex(r => r.name === importedRule.name);
      if (existingIdx !== -1) {
        rules[existingIdx] = importedRule;
        overwritten++;
      } else {
        rules.push(importedRule);
        added++;
      }
    });

    await saveRules();
    renderRulesList();
    alert(`导入完成！新增 ${added} 条，覆盖 ${overwritten} 条。`);
  } catch (err) {
    alert('导入失败：' + err.message);
  }

  importFile.value = ''; // 重置以便重复导入同一文件
});

// ========== 事件绑定 ==========
function bindEvents() {
  addRuleBtn.addEventListener('click', addRule);
  saveRuleBtn.addEventListener('click', saveCurrentRule);
  deleteRuleBtn.addEventListener('click', deleteCurrentRule);
  formatJsonBtn.addEventListener('click', formatJson);
  addTabBtn.addEventListener('click', addResponseTab);
  deleteTabBtn.addEventListener('click', deleteResponseTab);

  // Tab 输入变化时标记未保存
  tabNameInput.addEventListener('input', () => {
    if (currentRuleIndex !== -1) {
      saveRuleBtn.style.background = '#ff9800';
    }
  });
  tabContentInput.addEventListener('input', () => {
    if (currentRuleIndex !== -1) {
      saveRuleBtn.style.background = '#ff9800';
    }
  });

  ruleForm.addEventListener('input', (e) => {
    if (e.target.id !== 'tabName' && e.target.id !== 'tabContent' && currentRuleIndex !== -1) {
      saveRuleBtn.style.background = '#ff9800';
    }
  });

  exportBtn.addEventListener('click', exportRules);
  importBtn.addEventListener('click', importRules);

  fullscreenBtn.addEventListener('click', openFullscreen);

  fullscreenSave.addEventListener('click', saveFullscreen);
  fullscreenCancel.addEventListener('click', closeFullscreen);
  fullscreenOverlay.addEventListener('click', (e) => {
    if (e.target === fullscreenOverlay) closeFullscreen();
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveCurrentRule();
    }
    if (e.key === 'Escape' && fullscreenOverlay.style.display === 'flex') {
      closeFullscreen();
    }
  });
}

init();
