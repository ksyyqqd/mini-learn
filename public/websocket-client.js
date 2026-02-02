/**
 * 浏览器端WebSocket客户端模块
 * 提供WebSocket连接管理、消息处理和重连机制
 */

class BrowserWebSocketClient {
  /**
   * 构造函数
   * @param {string} url - WebSocket服务器地址
   */
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.messageHandlers = new Map();
    this.connectionHandlers = {
      open: [],
      close: [],
      error: []
    };
  }

  /**
   * 连接到WebSocket服务器
   */
  connect() {
    try {
      this.ws = new WebSocket(this.url);
      this._setupEventListeners();
    } catch (error) {
      console.error('[BrowserWebSocketClient] Connection failed:', error);
      this._handleReconnect();
    }
  }

  /**
   * 设置事件监听器
   */
  _setupEventListeners() {
    this.ws.onopen = (event) => {
      console.log('[BrowserWebSocketClient] Connected to server');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.connectionHandlers.open.forEach(handler => handler(event));
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const { type, payload } = message;
        
        const handler = this.messageHandlers.get(type);
        if (handler) {
          handler(payload);
        } else {
          console.warn(`[BrowserWebSocketClient] No handler for message type: ${type}`);
        }
      } catch (error) {
        console.error('[BrowserWebSocketClient] Error parsing message:', error);
      }
    };

    this.ws.onclose = (event) => {
      console.log('[BrowserWebSocketClient] Connection closed');
      this.isConnected = false;
      this.connectionHandlers.close.forEach(handler => handler(event));
      this._handleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('[BrowserWebSocketClient] Connection error:', error);
      this.connectionHandlers.error.forEach(handler => handler(error));
    };
  }

  /**
   * 处理重连逻辑
   */
  _handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`[BrowserWebSocketClient] Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('[BrowserWebSocketClient] Max reconnection attempts reached');
    }
  }

  /**
   * 发送消息到服务器
   * @param {Object} message - 消息对象 {type, payload, timestamp}
   * @returns {boolean} 是否发送成功
   */
  send(message) {
    if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error('[BrowserWebSocketClient] Error sending message:', error);
        return false;
      }
    } else {
      console.warn('[BrowserWebSocketClient] Not connected, cannot send message');
      return false;
    }
  }

  /**
   * 注册消息处理器
   * @param {string} messageType - 消息类型
   * @param {Function} handler - 处理函数 (payload) => {}
   */
  onMessage(messageType, handler) {
    this.messageHandlers.set(messageType, handler);
    console.log(`[BrowserWebSocketClient] Registered handler for: ${messageType}`);
  }

  /**
   * 注册连接事件处理器
   * @param {string} eventType - 事件类型 ('open'|'close'|'error')
   * @param {Function} handler - 处理函数
   */
  onConnection(eventType, handler) {
    if (this.connectionHandlers[eventType]) {
      this.connectionHandlers[eventType].push(handler);
    }
  }

  /**
   * 关闭连接
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  /**
   * 获取连接状态
   * @returns {boolean}
   */
  getConnected() {
    return this.isConnected;
  }

  /**
   * 获取重连尝试次数
   * @returns {number}
   */
  getReconnectAttempts() {
    return this.reconnectAttempts;
  }
}

// 导出模块（支持AMD、CommonJS和全局变量）
(function (global, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define([], factory);
  } else if (typeof module !== 'undefined' && module.exports) {
    // CommonJS
    module.exports = factory();
  } else {
    // Global variable
    global.BrowserWebSocketClient = factory();
  }
})(this, function () {
  return BrowserWebSocketClient;
});