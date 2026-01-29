const path = require('path');
const Bridge = require('./bridge');
const Runtime = require('./runtime');
const Renderer = require('./renderer');

const bridge = new Bridge();
const renderer = new Renderer(3002);
const runtime = new Runtime(bridge);

// 当 runtime 调用 setData 时，bridge 转发给渲染器
bridge.on('setData', (payload) => {
  renderer.render(payload);
  if (typeof runtime.triggerLifecycle === 'function') {
    runtime.triggerLifecycle('onUpdate', { data: payload });
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
runtime.run(appPath);

