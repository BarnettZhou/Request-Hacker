// content.js - 桥接 storage 和 MAIN world 的 injected.js

const RULES_KEY = 'rh_rules';
const GLOBAL_ENABLED_KEY = 'rh_enabled';

// 同步规则到 MAIN world 的页面脚本
function syncRulesToPage(rules, enabled) {
  window.postMessage({
    source: 'request-hacker-content',
    type: 'UPDATE_RULES',
    rules: rules || [],
    enabled: enabled !== false
  }, '*');
}

// 初始加载规则
function loadAndSync() {
  chrome.storage.local.get([RULES_KEY, GLOBAL_ENABLED_KEY]).then(data => {
    syncRulesToPage(data[RULES_KEY] || [], data[GLOBAL_ENABLED_KEY]);
  });
}

// 立即加载一次
loadAndSync();

// 多次尝试，确保 MAIN world 脚本能收到（处理时序问题）
let attempts = 0;
const initInterval = setInterval(() => {
  loadAndSync();
  attempts++;
  if (attempts >= 5) clearInterval(initInterval);
}, 100);

// 监听存储变化
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && (changes[RULES_KEY] || changes[GLOBAL_ENABLED_KEY])) {
    loadAndSync();
  }
});

// 监听来自 background 的主动广播
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'RULES_UPDATED') {
    syncRulesToPage(message.rules, message.enabled);
  }
});

// 监听来自 MAIN world 的请求
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.source !== 'request-hacker-injected') return;

  if (event.data.type === 'REQUEST_RULES') {
    loadAndSync();
  }
});
