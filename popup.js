(function() {
  'use strict';

  const RULES_KEY = 'rh_rules';
  const container = document.getElementById('rulesContainer');

  async function loadRules() {
    const data = await chrome.storage.local.get(RULES_KEY);
    return data[RULES_KEY] || [];
  }

  async function saveRules(rules) {
    await chrome.storage.local.set({ [RULES_KEY]: rules });
  }

  function getSelectedResponse(rule) {
    if (!rule.responses || rule.responses.length === 0) return null;
    return rule.responses.find(r => r.id === rule.selectedResponseId) || rule.responses[0];
  }

  function renderRules(rules) {
    if (rules.length === 0) {
      container.innerHTML = '<div class="empty-state">暂无规则，点击配置页面创建</div>';
      return;
    }

    container.innerHTML = rules.map((rule, index) => {
      const selectedResp = getSelectedResponse(rule);
      const tagsHtml = (rule.responses || []).map(resp => {
        const isActive = resp.id === rule.selectedResponseId;
        return `<span class="tag ${isActive ? 'active' : ''} ${!rule.enabled ? 'disabled' : ''}" data-rule="${index}" data-id="${resp.id}">${escapeHtml(resp.name || '未命名')}</span>`;
      }).join('');

      return `
        <div class="rule-card ${rule.enabled ? '' : 'disabled'}">
          <div class="rule-header">
            <div class="rule-name">${escapeHtml(rule.name || '未命名规则')}</div>
            <div class="toggle ${rule.enabled ? 'on' : ''}" data-index="${index}"></div>
          </div>
          <div class="rule-url">${escapeHtml(rule.urlPattern || '')}</div>
          <div class="tags">${tagsHtml}</div>
        </div>
      `;
    }).join('');

    bindEvents(rules);
  }

  function bindEvents(rules) {
    // Toggle 开关
    document.querySelectorAll('.toggle').forEach(toggle => {
      toggle.addEventListener('click', async () => {
        const index = parseInt(toggle.dataset.index);
        rules[index].enabled = !rules[index].enabled;
        await saveRules(rules);
        renderRules(rules);
      });
    });

    // Tag 切换
    document.querySelectorAll('.tag').forEach(tag => {
      tag.addEventListener('click', async () => {
        const index = parseInt(tag.dataset.rule);
        const respId = tag.dataset.id;
        if (!rules[index].enabled) return; // 禁用规则时不能切换
        rules[index].selectedResponseId = respId;
        await saveRules(rules);
        renderRules(rules);
      });
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // 打开配置页
  document.getElementById('openOptionsBtn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // 初始化
  async function init() {
    const rules = await loadRules();
    renderRules(rules);

    // 监听 storage 变化，实时更新 popup
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[RULES_KEY]) {
        renderRules(changes[RULES_KEY].newValue || []);
      }
    });
  }

  init();
})();
