const WebSocketServer = require('./websocket-server');
const WebSocketClient = require('./websocket-client');
const WebSocketProtocol = require('./websocket-protocol');

/**
 * WebSocket Package
 * 导出所有WebSocket相关模块
 */

module.exports = {
  WebSocketServer,
  WebSocketClient,
  WebSocketProtocol
};