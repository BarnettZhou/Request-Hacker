// background.js

const RULES_KEY = 'rh_rules';
const GLOBAL_ENABLED_KEY = 'rh_enabled';

chrome.runtime.onInstalled.addListener(() => {
  console.log('request-hacker installed');
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && (changes[RULES_KEY] || changes[GLOBAL_ENABLED_KEY])) {
    chrome.storage.local.get([RULES_KEY, GLOBAL_ENABLED_KEY]).then(data => {
      const rules = data[RULES_KEY] || [];
      const enabled = data[GLOBAL_ENABLED_KEY] !== false;
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, {
            type: 'RULES_UPDATED',
            rules: rules,
            enabled: enabled
          }).catch(() => {});
        });
      });
    });
  }
});
