(function() {
  'use strict';

  const RULES_KEY = 'rh_rules';
  const GLOBAL_ENABLED_KEY = 'rh_enabled';
  const container = document.getElementById('rulesContainer');
  const globalToggle = document.getElementById('globalToggle');

  async function loadData() {
    const data = await chrome.storage.local.get([RULES_KEY, GLOBAL_ENABLED_KEY]);
    return {
      rules: data[RULES_KEY] || [],
      enabled: data[GLOBAL_ENABLED_KEY] !== false
    };
  }

  async function saveRules(rules) {
    await chrome.storage.local.set({ [RULES_KEY]: rules });
  }

  async function saveGlobalEnabled(enabled) {
    await chrome.storage.local.set({ [GLOBAL_ENABLED_KEY]: enabled });
  }

  function getSelectedResponse(rule) {
    if (!rule.responses || rule.responses.length === 0) return null;
    return rule.responses.find(r => r.id === rule.selectedResponseId) || rule.responses[0];
  }

  function render(rules, globalEnabled) {
    globalToggle.classList.toggle('on', globalEnabled);

    if (rules.length === 0) {
      container.innerHTML = '<div class="empty-state">暂无规则，点击配置页面创建</div>';
      return;
    }

    container.innerHTML = rules.map((rule, index) => {
      const selectedResp = getSelectedResponse(rule);
      const cardDisabled = !globalEnabled || !rule.enabled;
      const tagsHtml = (rule.responses || []).map(resp => {
        const isActive = resp.id === rule.selectedResponseId;
        const tagDisabled = cardDisabled;
        return `<span class="tag ${isActive ? 'active' : ''} ${tagDisabled ? 'disabled' : ''}" data-rule="${index}" data-id="${resp.id}">${escapeHtml(resp.name || '未命名')}</span>`;
      }).join('');

      return `
        <div class="rule-card ${cardDisabled ? 'disabled' : ''}">
          <div class="rule-header">
            <div class="rule-name">${escapeHtml(rule.name || '未命名规则')}</div>
            <div class="toggle ${rule.enabled ? 'on' : ''}" data-index="${index}"></div>
          </div>
          <div class="rule-url">${escapeHtml(rule.urlPattern || '')}</div>
          <div class="tags">${tagsHtml}</div>
        </div>
      `;
    }).join('');

    bindEvents(rules, globalEnabled);
  }

  function bindEvents(rules, globalEnabled) {
    // Toggle 开关
    document.querySelectorAll('.toggle').forEach(toggle => {
      toggle.addEventListener('click', async () => {
        if (!globalEnabled) return;
        const index = parseInt(toggle.dataset.index);
        rules[index].enabled = !rules[index].enabled;
        await saveRules(rules);
        const data = await loadData();
        render(data.rules, data.enabled);
      });
    });

    // Tag 切换
    document.querySelectorAll('.tag').forEach(tag => {
      tag.addEventListener('click', async () => {
        const index = parseInt(tag.dataset.rule);
        const respId = tag.dataset.id;
        if (!globalEnabled || !rules[index].enabled) return;
        rules[index].selectedResponseId = respId;
        await saveRules(rules);
        const data = await loadData();
        render(data.rules, data.enabled);
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

  // 总开关
  globalToggle.addEventListener('click', async () => {
    const data = await loadData();
    const newEnabled = !data.enabled;
    await saveGlobalEnabled(newEnabled);
    render(data.rules, newEnabled);
  });

  // 初始化
  async function init() {
    const data = await loadData();
    render(data.rules, data.enabled);

    // 监听 storage 变化，实时更新 popup
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && (changes[RULES_KEY] || changes[GLOBAL_ENABLED_KEY])) {
        loadData().then(data => render(data.rules, data.enabled));
      }
    });
  }

  init();
})();
