const WebSocket = require('ws');

/**
 * WebSocketServer 类
 * - 提供 WebSocket 服务端功能
 * - 管理客户端连接和消息处理
 */
class WebSocketServer {
  /**
   * 构造函数
   * @param {number} port - WebSocket 服务端口
   */
  constructor(port) {
    this.port = port;
    this.clients = new Set();
    this.messageHandlers = new Map();
    this.clientConnectedHandler = null; // 专门处理客户端连接的处理器
    this._initServer();
  }

  /**
   * 初始化 WebSocket 服务器
   */
  _initServer() {
    this.wss = new WebSocket.Server({ port: this.port });
    
    this.wss.on('connection', (ws) => {
      console.log(`[WebSocketServer] Client connected on port ${this.port}`);
      this.clients.add(ws);
      
      // 通知renderer有新客户端连接
      this._notifyClientConnected(ws);
      
      // 注册消息处理
      ws.on('message', (message) => {
        this._handleMessage(ws, message);
      });
      
      // 处理连接关闭
      ws.on('close', () => {
        console.log('[WebSocketServer] Client disconnected');
        this.clients.delete(ws);
      });
      
      // 处理错误
      ws.on('error', (error) => {
        console.error('[WebSocketServer] Client error:', error);
        this.clients.delete(ws);
      });
      
      // 发送连接确认消息
      this._sendToClient(ws, {
        type: 'connection',
        payload: { status: 'connected', timestamp: Date.now() }
      });
    });

    console.log(`[WebSocketServer] Started on port ${this.port}`);
  }

  /**
   * 通知renderer有新客户端连接
   * @param {WebSocket} ws - 新连接的WebSocket客户端
   */
  _notifyClientConnected(ws) {
    // 直接调用客户端连接处理器
    if (this.clientConnectedHandler) {
      const payload = { clientId: Date.now(), timestamp: Date.now() };
      this.clientConnectedHandler(ws, payload);
    }
  }

  /**
   * 处理客户端消息
   * @param {WebSocket} ws - WebSocket连接
   * @param {string|Buffer} message - 消息内容
   */
  _handleMessage(ws, message) {
    try {
      const data = JSON.parse(message);
      const { type, payload } = data;
      
      console.log(`[WebSocketServer] Received message type: ${type}`);
      
      // 查找对应的处理器
      const handler = this.messageHandlers.get(type);
      if (handler) {
        handler(ws, payload);
      } else {
        console.warn(`[WebSocketServer] No handler for message type: ${type}`);
        this._sendToClient(ws, {
          type: 'error',
          payload: { message: `Unknown message type: ${type}` }
        });
      }
    } catch (error) {
      console.error('[WebSocketServer] Error parsing message:', error);
      this._sendToClient(ws, {
        type: 'error',
        payload: { message: 'Invalid message format' }
      });
    }
  }

  /**
   * 注册普通消息处理器
   * @param {string} messageType - 消息类型
   * @param {Function} handler - 处理函数 (ws, payload) => {}
   */
  registerHandler(messageType, handler) {
    this.messageHandlers.set(messageType, handler);
    console.log(`[WebSocketServer] Registered handler for: ${messageType}`);
  }

  /**
   * 注册客户端连接处理器（特殊处理器）
   * @param {Function} handler - 处理函数 (ws, payload) => {}
   */
  registerClientConnectedHandler(handler) {
    this.clientConnectedHandler = handler;
    console.log('[WebSocketServer] Registered client connected handler');
  }

  /**
   * 向指定客户端发送消息
   * @param {WebSocket} ws - WebSocket连接
   * @param {Object} message - 消息对象
   */
  _sendToClient(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('[WebSocketServer] Error sending to client:', error);
        this.clients.delete(ws);
      }
    }
  }

  /**
   * 向所有客户端广播消息
   * @param {Object} message - 消息对象
   */
  broadcast(message) {
    const messageStr = JSON.stringify(message);
    let disconnectedClients = [];
    
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageStr);
        } catch (error) {
          console.error('[WebSocketServer] Error broadcasting to client:', error);
          disconnectedClients.push(client);
        }
      } else {
        disconnectedClients.push(client);
      }
    }
    
    // 清理断开的连接
    disconnectedClients.forEach(client => this.clients.delete(client));
  }

  /**
   * 获取当前连接的客户端数量
   * @returns {number}
   */
  getClientCount() {
    return this.clients.size;
  }

  /**
   * 关闭服务器
   */
  close() {
    this.wss.close(() => {
      console.log('[WebSocketServer] Server closed');
    });
  }
}

module.exports = WebSocketServer;