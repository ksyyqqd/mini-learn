/**
 * WebSocketClient 类
 * - 提供 WebSocket 客户端功能
 * - 封装连接管理、消息发送和事件处理
 */
class WebSocketClient {
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
      console.error('[WebSocketClient] Connection failed:', error);
      this._handleReconnect();
    }
  }

  /**
   * 设置事件监听器
   */
  _setupEventListeners() {
    this.ws.onopen = (event) => {
      console.log('[WebSocketClient] Connected to server');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // 执行连接成功回调
      this.connectionHandlers.open.forEach(handler => handler(event));
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const { type, payload } = message;
        
        // 查找对应的处理器
        const handler = this.messageHandlers.get(type);
        if (handler) {
          handler(payload);
        } else {
          console.warn(`[WebSocketClient] No handler for message type: ${type}`);
        }
      } catch (error) {
        console.error('[WebSocketClient] Error parsing message:', error);
      }
    };

    this.ws.onclose = (event) => {
      console.log('[WebSocketClient] Connection closed');
      this.isConnected = false;
      
      // 执行连接关闭回调
      this.connectionHandlers.close.forEach(handler => handler(event));
      
      // 尝试重连
      this._handleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('[WebSocketClient] Connection error:', error);
      
      // 执行错误回调
      this.connectionHandlers.error.forEach(handler => handler(error));
    };
  }

  /**
   * 处理重连逻辑
   */
  _handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`[WebSocketClient] Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('[WebSocketClient] Max reconnection attempts reached');
    }
  }

  /**
   * 发送消息到服务器
   * @param {Object} message - 消息对象 {type, payload}
   * @returns {boolean} 是否发送成功
   */
  send(message) {
    if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error('[WebSocketClient] Error sending message:', error);
        return false;
      }
    } else {
      console.warn('[WebSocketClient] Not connected, cannot send message');
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
    console.log(`[WebSocketClient] Registered handler for: ${messageType}`);
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
}

// 为了在Node.js环境中使用，需要提供WebSocket实现
// 在浏览器环境中，WebSocket是全局对象
if (typeof window === 'undefined') {
  // Node.js环境
  global.WebSocket = require('ws');
}

module.exports = WebSocketClient;