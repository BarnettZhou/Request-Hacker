// injected.js - 注入到页面，拦截 fetch 和 XMLHttpRequest

(function() {
  'use strict';

  let rules = [];

  // 监听来自 content script 的规则更新
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data?.source !== 'request-hacker-content') return;

    if (event.data.type === 'UPDATE_RULES') {
      rules = event.data.rules || [];
      console.log('[request-hacker] Rules updated:', rules.length);
    }
  });

  // 请求规则
  window.postMessage({
    source: 'request-hacker-injected',
    type: 'REQUEST_RULES'
  }, '*');

  // 通配符匹配 URL
  function matchUrl(url, pattern) {
    if (!pattern) return false;

    try {
      const regex = new RegExp(
        '^' + pattern
          .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
          .replace(/\*/g, '.*') + '$'
      );
      return regex.test(url);
    } catch (e) {
      return false;
    }
  }

  // 查找匹配的规则
  function findMatchedRule(url) {
    return rules.find(rule =>
      rule.enabled &&
      rule.urlPattern &&
      matchUrl(url, rule.urlPattern)
    );
  }

  // 获取规则当前选中的 response 内容
  function getRuleResponse(rule) {
    if (rule.responses && rule.responses.length > 0) {
      const selected = rule.responses.find(r => r.id === rule.selectedResponseId);
      if (selected) return selected.content;
      return rule.responses[0].content;
    }
    // 兼容旧格式
    return rule.response || '';
  }

  // ============ 拦截 fetch ============
  const originalFetch = window.fetch;

  window.fetch = function(input, init) {
    const url = typeof input === 'string' ? input : (input?.url || '');
    const matchedRule = findMatchedRule(url);

    if (matchedRule) {
      console.log('[request-hacker] Intercepted fetch:', url, '->', matchedRule.name);

      const responseBody = getRuleResponse(matchedRule);
      const response = new Response(responseBody, {
        status: 200,
        statusText: 'OK',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Hacker': 'true'
        }
      });

      return Promise.resolve(response);
    }

    return originalFetch.apply(this, arguments);
  };

  // ============ 拦截 XMLHttpRequest ============
  const OriginalXHR = window.XMLHttpRequest;

  function HackedXHR() {
    const xhr = new OriginalXHR();
    let requestUrl = '';
    let requestMethod = '';
    let matchedRule = null;

    const originalOpen = xhr.open;
    const originalSend = xhr.send;
    const originalSetRequestHeader = xhr.setRequestHeader;

    xhr.open = function(method, url, ...rest) {
      requestMethod = method;
      requestUrl = url;
      matchedRule = findMatchedRule(url);
      return originalOpen.call(this, method, url, ...rest);
    };

    xhr.send = function(...args) {
      if (matchedRule) {
        console.log('[request-hacker] Intercepted XHR:', requestUrl, '->', matchedRule.name);

        const response = getRuleResponse(matchedRule);

        setTimeout(() => {
          Object.defineProperty(xhr, 'readyState', { value: 4, configurable: true });
          Object.defineProperty(xhr, 'status', { value: 200, configurable: true });
          Object.defineProperty(xhr, 'statusText', { value: 'OK', configurable: true });
          Object.defineProperty(xhr, 'responseText', { value: response, configurable: true });
          Object.defineProperty(xhr, 'response', { value: response, configurable: true });
          Object.defineProperty(xhr, 'responseURL', { value: requestUrl, configurable: true });

          const events = ['readystatechange', 'load', 'loadend'];
          events.forEach(eventType => {
            const event = new ProgressEvent(eventType, {
              lengthComputable: true,
              loaded: response.length,
              total: response.length
            });

            const handler = xhr['on' + eventType];
            if (typeof handler === 'function') {
              try {
                handler.call(xhr, event);
              } catch (e) {
                console.error('[request-hacker] Handler error:', e);
              }
            }

            xhr.dispatchEvent(event);
          });
        }, 0);

        return;
      }

      return originalSend.apply(this, args);
    };

    return xhr;
  }

  HackedXHR.prototype = OriginalXHR.prototype;
  Object.setPrototypeOf(HackedXHR, OriginalXHR);

  ['UNSENT', 'OPENED', 'HEADERS_RECEIVED', 'LOADING', 'DONE'].forEach(key => {
    if (key in OriginalXHR) {
      try {
        Object.defineProperty(HackedXHR, key, {
          value: OriginalXHR[key],
          writable: false,
          enumerable: true,
          configurable: true
        });
      } catch (e) {}
    }
  });

  window.XMLHttpRequest = HackedXHR;

  console.log('[request-hacker] Initialized');
})();
