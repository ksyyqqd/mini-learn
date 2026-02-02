/**
 * WebSocketProtocol 类
 * - 定义WebSocket通信的消息协议
 * - 提供消息构建和解析的标准化方法
 */

class WebSocketProtocol {
  /**
   * 构建通用消息格式
   * @param {string} type - 消息类型
   * @param {Object} payload - 消息负载
   * @param {number} timestamp - 时间戳（可选）
   * @returns {Object} 标准消息对象
   */
  static buildMessage(type, payload, timestamp = Date.now()) {
    return {
      type,
      payload,
      timestamp
    };
  }

  /**
   * 构建渲染更新消息
   * @param {string} html - HTML内容
   * @param {Object} data - 数据对象
   * @returns {Object} 渲染消息
   */
  static buildRenderMessage(html, data) {
    return this.buildMessage('render', { html, data });
  }

  /**
   * 构建控制台消息
   * @param {string} level - 日志级别 ('log'|'info'|'warn'|'error')
   * @param {Array} args - 日志参数
   * @returns {Object} 控制台消息
   */
  static buildConsoleMessage(level, args) {
    return this.buildMessage('console', { level, args });
  }

  /**
   * 构建方法调用消息
   * @param {string} methodName - 方法名
   * @param {Object} args - 方法参数
   * @returns {Object} 方法调用消息
   */
  static buildCallMethodMessage(methodName, args = {}) {
    return this.buildMessage('callMethod', { methodName, args });
  }

  /**
   * 构建方法调用响应消息
   * @param {boolean} success - 是否成功
   * @param {string} methodName - 方法名
   * @param {Object} result - 结果数据（可选）
   * @param {string} error - 错误信息（可选）
   * @returns {Object} 方法调用响应消息
   */
  static buildMethodCallResponse(success, methodName, result = null, error = null) {
    const payload = { success, methodName };
    if (result !== null) payload.result = result;
    if (error !== null) payload.error = error;
    return this.buildMessage('methodCallResponse', payload);
  }

  /**
   * 构建连接状态消息
   * @param {boolean} connected - 连接状态
   * @returns {Object} 连接状态消息
   */
  static buildConnectionMessage(connected) {
    return this.buildMessage('connection', { status: connected ? 'connected' : 'disconnected' });
  }

  /**
   * 构建错误消息
   * @param {string} message - 错误信息
   * @param {string} code - 错误代码（可选）
   * @returns {Object} 错误消息
   */
  static buildErrorMessage(message, code = null) {
    const payload = { message };
    if (code) payload.code = code;
    return this.buildMessage('error', payload);
  }

  /**
   * 验证消息格式
   * @param {Object} message - 消息对象
   * @returns {boolean} 是否为有效消息
   */
  static isValidMessage(message) {
    return (
      message &&
      typeof message === 'object' &&
      typeof message.type === 'string' &&
      typeof message.payload === 'object' &&
      typeof message.timestamp === 'number'
    );
  }

  /**
   * 解析消息类型
   * @param {Object} message - 消息对象
   * @returns {string|null} 消息类型
   */
  static getMessageType(message) {
    return this.isValidMessage(message) ? message.type : null;
  }

  /**
   * 解析消息负载
   * @param {Object} message - 消息对象
   * @returns {Object|null} 消息负载
   */
  static getMessagePayload(message) {
    return this.isValidMessage(message) ? message.payload : null;
  }

  /**
   * 定义标准消息类型常量
   */
  static MESSAGE_TYPES = {
    RENDER: 'render',
    CONSOLE: 'console',
    CALL_METHOD: 'callMethod',
    METHOD_CALL_RESPONSE: 'methodCallResponse',
    CONNECTION: 'connection',
    ERROR: 'error'
  };

  /**
   * 定义控制台日志级别常量
   */
  static LOG_LEVELS = {
    LOG: 'log',
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error'
  };
}

module.exports = WebSocketProtocol;