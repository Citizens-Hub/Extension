// 自定义错误接口
interface AxiosError extends Error {
  config?: any;
  code?: string;
  request?: any;
  response?: any;
  isAxiosError?: boolean;
  toJSON?: () => any;
}

// 扩展端口类型
interface ExtendedPort extends chrome.runtime.Port {
  _timer?: NodeJS.Timeout;
}

// 定义 Cookie 类型
interface Cookie {
  value: string;
  [key: string]: any;
}

// 导入 axios
import axios from 'axios';

// 当用户点击扩展图标时打开网页
(chrome.action || chrome.browserAction).onClicked.addListener(() => {
  chrome.tabs.create({ url: "https://citizenshub.app" });
});

// 定义存储键名常量
const CSRF_KEY = "_lastcsrf";
const RSI_TOKEN_KEY = "_lastrsi";

// 创建自定义的 axios 实例，使用自定义适配器
const axiosInstance = axios.create({
  adapter: async function(config) {
    // 将 axios 配置转换为 fetch 请求
    const request = createRequest(config);
    const promises = [performFetch(request, config)];

    // 处理超时
    if (config.timeout && config.timeout > 0) {
      promises.push(
        new Promise((resolve) => {
          setTimeout(() => {
            const message = config.timeoutErrorMessage 
              ? config.timeoutErrorMessage 
              : `timeout of ${config.timeout}ms exceeded`;
            resolve(createError(message, config, "ECONNABORTED", request, null));
          }, config.timeout);
        })
      );
    }

    // 竞争 promises
    const response = await Promise.race(promises);

    // 处理结果
    return new Promise((resolve, reject) => {
      if (response instanceof Error) {
        reject(response);
      } else {
        // 移除对 config.settle 的引用，因为 InternalAxiosRequestConfig 类型中不存在此属性
        handleResponse(resolve, reject, response);
      }
    });
  }
});

// 创建 fetch 请求
function createRequest(config) {
  const headers = new Headers(config.headers);

  // 设置基本认证
  if (config.auth) {
    const username = config.auth.username || '';
    const password = config.auth.password ? decodeURI(encodeURIComponent(config.auth.password)) : '';
    headers.set('Authorization', `Basic ${btoa(username + ":" + password)}`);
  }

  const method = config.method.toUpperCase();
  const requestConfig: RequestInit = {
    headers,
    method
  };

  // 添加请求体
  if (method !== 'GET' && method !== 'HEAD') {
    requestConfig.body = config.data;
    
    // 如果是 FormData，移除 Content-Type 头，让浏览器自动设置
    if (isFormData(requestConfig.body) && isStandardBrowserEnv()) {
      headers.delete('Content-Type');
    }
  }

  // 添加其他 fetch 配置
  if (config.mode) requestConfig.mode = config.mode;
  if (config.cache) requestConfig.cache = config.cache;
  if (config.integrity) requestConfig.integrity = config.integrity;
  if (config.redirect) requestConfig.redirect = config.redirect;
  if (config.referrer) requestConfig.referrer = config.referrer;
  
  // 设置认证凭据
  if (!isUndefined(config.withCredentials)) {
    requestConfig.credentials = config.withCredentials ? 'include' : 'omit';
  }

  // 构建完整 URL
  const baseURL = combineURLs(config.baseURL, config.url);
  const url = buildURL(baseURL, config.params, config.paramsSerializer);

  return new Request(url, requestConfig);
}

// 执行 fetch 请求
async function performFetch(request, config) {
  let response;
  try {
    response = await fetch(request);
  } catch (error) {
    return createError("Network Error", config, "ERR_NETWORK", request, null);
  }

  // 创建响应对象
  const responseObject: any = {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    headers: new Headers(response.headers),
    config,
    request
  };

  // 解析响应数据
  if (response.status >= 200 && response.status !== 204) {
    switch (config.responseType) {
      case 'arraybuffer':
        responseObject.data = await response.arrayBuffer();
        break;
      case 'blob':
        responseObject.data = await response.blob();
        break;
      case 'json':
        responseObject.data = await response.json();
        break;
      case 'formData':
        responseObject.data = await response.formData();
        break;
      default:
        responseObject.data = await response.text();
    }
  }

  return responseObject;
}

// 创建错误
function createError(message, config, code, request, response) {
  if (axios.AxiosError && typeof axios.AxiosError === 'function') {
    return new axios.AxiosError(message, axios.AxiosError[code], config, request, response);
  }

  const error = new Error(message) as AxiosError;
  error.config = config;
  if (code) {
    error.code = code;
  }
  error.request = request;
  error.response = response;
  error.isAxiosError = true;
  error.toJSON = function() {
    return {
      message: this.message,
      name: this.name,
      description: this.description,
      number: this.number,
      fileName: this.fileName,
      lineNumber: this.lineNumber,
      columnNumber: this.columnNumber,
      stack: this.stack,
      config: this.config,
      code: this.code,
      status: this.response && this.response.status ? this.response.status : null
    };
  };
  
  return error;
}

// 处理响应结果
function handleResponse(resolve, reject, response) {
  const validateStatus = response.config.validateStatus;
  if (response.status && validateStatus && !validateStatus(response.status)) {
    const statusCategory = Math.floor(response.status / 100) - 4;
    const errorType = [
      axios.AxiosError.ERR_BAD_REQUEST,
      axios.AxiosError.ERR_BAD_RESPONSE
    ][statusCategory];
    
    reject(
      new axios.AxiosError(
        `Request failed with status code ${response.status}`,
        errorType,
        response.config,
        response.request,
        response
      )
    );
  } else {
    resolve(response);
  }
}

// 连接端口管理
function disconnectPort(port: ExtendedPort) {
  clearTimer(port);
  port.disconnect();
}

function clearTimer(port: ExtendedPort) {
  if (port._timer) {
    clearTimeout(port._timer);
    delete port._timer;
  }
}

// 监听连接请求
chrome.runtime.onConnect.addListener((port: ExtendedPort) => {
  // 处理消息
  port.onMessage.addListener(async (message, sender) => {
    switch (message.type) {
      case "connect":
        // 返回版本信息
        port.postMessage({
          requestId: message.requestId,
          value: { 
            version: 4, 
            extensionVersion: "6.1.0" 
          }
        });
        break;
        
      case "clearTokens":
        // 清除存储的令牌
        chrome.storage.local.remove([CSRF_KEY, RSI_TOKEN_KEY]);
        break;
        
      case "httpRequest":
        try {
          // 处理 HTTP 请求
          const response = await handleHttpRequest(message.request);
          port.postMessage({
            requestId: message.requestId,
            value: JSON.parse(JSON.stringify(response))
          });
        } catch (error) {
          port.postMessage({
            requestId: message.requestId,
            error: { message: error.message }
          });
        }
        break;
        
      default:
        port.postMessage({
          requestId: message.requestId,
          error: { message: "unknown request type" }
        });
    }
  });
  
  // 处理断开连接
  port.onDisconnect.addListener(clearTimer);
  
  // 设置连接超时（250秒 = 250000毫秒）
  port._timer = setTimeout(disconnectPort, 250000, port);
});

// 处理 HTTP 请求
async function handleHttpRequest(request) {
  // 获取 RSI 令牌
  const rsiCookie = await getRsiCookie();
  if (rsiCookie == null) {
    console.error("cookie not found");
    throw new Error("You are not logged in on robertsspaceindustries.com");
  }

  // 获取存储的 CSRF 令牌和 RSI 令牌
  const csrfToken = await getStoredCsrfToken();
  const storedRsiToken = await getStoredRsiToken();

  // 如果令牌不存在或已更改，则获取新的 CSRF 令牌
  if (csrfToken == null || storedRsiToken !== rsiCookie.value) {
    // 存储新的 RSI 令牌
    await chrome.storage.local.set({ [RSI_TOKEN_KEY]: rsiCookie.value });

    // 从 RSI 网站获取新的 CSRF 令牌
    const response = await axiosInstance.get(
      "https://robertsspaceindustries.com/store/pledge/browse/extras", 
      { responseType: "text" }
    );

    if (response.status === 200) {
      // 从响应中提取 CSRF 令牌
      const csrfMatch = response.data.match(/meta\s+name="csrf-token"\s+content="([^"]+)"/);
      if (csrfMatch == null) {
        console.error("Could not acquire CSRF token, RSI cart won't work");
      } else {
        // 存储新的 CSRF 令牌
        await new Promise<void>(resolve => 
          chrome.storage.local.set({ [CSRF_KEY]: csrfMatch[1] }, resolve)
        );
      }
    } else {
      console.error(
        `Could not acquire CSRF token, RSI cart won't work; status: ${response.status} ${response.statusText}`
      );
    }
  }

  // 发送带认证的请求
  return await axiosInstance.request({
    ...request,
    headers: {
      "x-rsi-token": rsiCookie.value,
      "x-csrf-token": csrfToken,
      ...request.headers
    }
  });
}

// 辅助函数
async function getRsiCookie(): Promise<Cookie | null> {
  return await new Promise((resolve, reject) => {
    chrome.cookies.get(
      {
        url: "https://robertsspaceindustries.com/",
        name: "Rsi-Token"
      }, 
      (cookie) => {
        resolve(cookie as Cookie | null);
      }
    );
  });
}

async function getStoredCsrfToken() {
  return new Promise<string | undefined>(resolve => {
    chrome.storage.local.get(CSRF_KEY, (result) => {
      resolve(result[CSRF_KEY]);
    });
  });
}

async function getStoredRsiToken() {
  return new Promise<string | undefined>(resolve => {
    chrome.storage.local.get(RSI_TOKEN_KEY, (result) => {
      resolve(result[RSI_TOKEN_KEY]);
    });
  });
}

// Axios 辅助函数
function isFormData(val) {
  const formDataTag = '[object FormData]';
  return val && (
    (typeof FormData === 'function' && val instanceof FormData) ||
    Object.prototype.toString.call(val) === formDataTag ||
    (typeof val.toString === 'function' && val.toString() === formDataTag)
  );
}

function isStandardBrowserEnv() {
  return (
    typeof navigator !== 'undefined' &&
    (navigator.product !== 'ReactNative' &&
     navigator.product !== 'NativeScript' &&
     navigator.product !== 'NS') &&
    typeof window !== 'undefined' &&
    typeof document !== 'undefined'
  );
}

function isUndefined(val) {
  return typeof val === 'undefined';
}

function combineURLs(baseURL, relativeURL) {
  if (!baseURL) {
    return relativeURL;
  }
  
  if (!relativeURL) {
    return baseURL;
  }
  
  return baseURL.replace(/\/+$/, '') + '/' + relativeURL.replace(/^\/+/, '');
}

function buildURL(url, params, paramsSerializer) {
  if (!params) {
    return url;
  }
  
  let serializedParams;
  if (paramsSerializer) {
    serializedParams = paramsSerializer(params);
  } else if (typeof URLSearchParams !== 'undefined' && params instanceof URLSearchParams) {
    serializedParams = params.toString();
  } else {
    const parts: string[] = [];
    
    Object.keys(params).forEach(key => {
      const val = params[key];
      if (val === null || typeof val === 'undefined') {
        return;
      }
      
      let values: any[] = [];
      if (Array.isArray(val)) {
        values = val;
        key += '[]';
      } else {
        values = [val];
      }
      
      values.forEach(v => {
        if (Object.prototype.toString.call(v) === '[object Date]') {
          v = v.toISOString();
        } else if (typeof v === 'object') {
          v = JSON.stringify(v);
        }
        parts.push(encodeParam(key) + '=' + encodeParam(v));
      });
    });
    
    serializedParams = parts.join('&');
  }
  
  if (serializedParams) {
    const hashmarkIndex = url.indexOf('#');
    if (hashmarkIndex !== -1) {
      url = url.slice(0, hashmarkIndex);
    }
    
    url += (url.indexOf('?') === -1 ? '?' : '&') + serializedParams;
  }
  
  return url;
}

function encodeParam(val) {
  return encodeURIComponent(val)
    .replace(/%3A/gi, ':')
    .replace(/%24/g, '$')
    .replace(/%2C/gi, ',')
    .replace(/%20/g, '+')
    .replace(/%5B/gi, '[')
    .replace(/%5D/gi, ']');
} 