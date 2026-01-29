const fs = require('fs');
const vm = require('vm');

/**
 * Runtime - 运行小程序逻辑的沙箱执行器
 * - 提供 `App` 注册函数，允许小程序通过 `App({ onLaunch, onShow, onHide, ... })` 注册生命周期方法
 * - 在加载小程序脚本后会自动触发 `onLaunch`（如果存在）
 * - 提供 `triggerLifecycle(name, ...args)` 方法，可由宿主在合适时机触发其他生命周期
 */
class Runtime {
  constructor(bridge) {
    this.bridge = bridge;
    // 存放通过 App() 注册或 module.exports 导出的应用对象
    this.app = null;
  }

  /**
   * 运行指定的脚本文件（例如 sample-app/app.js）
   * @param {string} filePath
   */
  run(filePath) {
    const code = fs.readFileSync(filePath, 'utf8');
    const runtime = this;

   
    // 自定义 console：既写入宿主终端，也通过 bridge 转发到渲染器/浏览器
    const sandboxConsole = {
      log: (...args) => {
        if (runtime.bridge && typeof runtime.bridge.sendToNative === 'function') {
          runtime.bridge.sendToNative('console', { level: 'log', args });
        }
      },
      info: (...args) => {
        if (runtime.bridge && typeof runtime.bridge.sendToNative === 'function') {
          runtime.bridge.sendToNative('console', { level: 'info', args });
        }
      },
      warn: (...args) => {
        if (runtime.bridge && typeof runtime.bridge.sendToNative === 'function') {
          runtime.bridge.sendToNative('console', { level: 'warn', args });
        }
      },
      error: (...args) => {
        if (runtime.bridge && typeof runtime.bridge.sendToNative === 'function') {
          runtime.bridge.sendToNative('console', { level: 'error', args });
        }
      }
    };

    const sandbox = {
      console: sandboxConsole,
      // 小程序常用 API：把数据发到宿主/渲染层（由 bridge 转发）
      setData: (data) => {
        if (runtime.bridge && typeof runtime.bridge.sendToNative === 'function') {
          runtime.bridge.sendToNative('setData', data);
        }
      },
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      // 通过 App 注册生命周期对象
      App: function(appDef) {
        runtime.app = appDef || {};
        // 立即触发 onLaunch（兼容惯例）
        if (typeof runtime.app.onLaunch === 'function') {
          try {
            runtime.app.onLaunch.call(runtime.app);
          } catch (e) {
            console.error('[Runtime] App.onLaunch error', e);
          }
        }
      },
      // 提供 module.exports/exports 兼容
      module: { exports: {} },
      exports: {},
      // 限制性空 global 对象，避免暴露敏感能力
      global: {}
    };

    vm.createContext(sandbox);
    try {
      const wrapped = `(function(){\n${code}\n})();`;
      vm.runInContext(wrapped, sandbox, { filename: filePath });
    } catch (e) {
      console.error('[Runtime] error running script', e);
    }
  }

  /**
   * 触发任意生命周期方法（宿主调用）
   * 例如：runtime.triggerLifecycle('onShow', { path: '/index' })
   */
  triggerLifecycle(name, ...args) {
    if (this.app && typeof this.app[name] === 'function') {
      try {
        this.app[name].apply(this.app, args);
      } catch (e) {
        console.error(`[Runtime] lifecycle ${name} error`, e);
      }
    }
  }
}

module.exports = Runtime;
