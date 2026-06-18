// background.js

const RULES_KEY = 'rh_rules';

chrome.runtime.onInstalled.addListener(() => {
  console.log('request-hacker installed');
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes[RULES_KEY]) {
    const newRules = changes[RULES_KEY].newValue || [];
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          type: 'RULES_UPDATED',
          rules: newRules
        }).catch(() => {});
      });
    });
  }
});
