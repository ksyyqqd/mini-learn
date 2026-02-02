const path = require('path');
const Bridge = require('./bridge');
const Runtime = require('./runtime');
const Renderer = require('./renderer');

const bridge = new Bridge();
const renderer = new Renderer(3002);
const runtime = new Runtime(bridge);

// 设置renderer的bridge引用
renderer.setBridge(bridge);

// 当 runtime 调用 setData 时，bridge 转发给渲染器
bridge.on('setData', (payload) => {
  renderer.render(payload);
  renderer.setInitialData(payload);
  if (typeof runtime.triggerLifecycle === 'function') {
    runtime.triggerLifecycle('onUpdate', { data: payload });
  }
});

// 监听来自前端的方法调用请求
bridge.on('toJS', (payload) => {
  if (payload.cmd === 'callMethod') {
    const { methodName, args } = payload.payload;
    console.log(`[Host] Received method call: ${methodName}`, args);
    
    // 调用runtime中App对象的对应方法
    if (runtime.app && typeof runtime.app[methodName] === 'function') {
      try {
        runtime.app[methodName].call(runtime.app, args);
        console.log(`[Host] Method ${methodName} executed successfully`);
      } catch (error) {
        console.error(`[Host] Error executing method ${methodName}:`, error);
      }
    } else {
      console.warn(`[Host] Method ${methodName} not found in App object`);
    }
  }
});

// 将 runtime 中的 console 事件转发到 renderer，让浏览器端也能看到日志
bridge.on('console', (payload) => {
  if (renderer && typeof renderer.sendConsole === 'function') {
    renderer.sendConsole(payload);
  } else {
    // fallback: 在宿主终端打印
    console.log('[Host] console', payload);
  }
});

const appPath = path.join(__dirname, '..', 'sample-app', 'app.js');
console.log('Starting miniapp container. Running sample app:', appPath);
//初始化执行
runtime.run(appPath);
// 设置初始数据
renderer.setInitialData(runtime.app.data);