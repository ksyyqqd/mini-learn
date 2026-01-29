const EventEmitter = require('events');

class Bridge extends EventEmitter {
  constructor() {
    super();
  }

  // 从 JS 发送到 Native（宿主/渲染层）
  sendToNative(cmd, payload) {
    this.emit(cmd, payload);
  }

  // 从 Native 发送到 JS
  sendToJS(cmd, payload) {
    this.emit('toJS', { cmd, payload });
  }
}

module.exports = Bridge;
