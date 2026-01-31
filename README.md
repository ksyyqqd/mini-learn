# Miniapp Container Demo

这是一个极简的“小程序容器”示例，实现了宿主（Host）、JS 运行时沙箱（Runtime）、消息桥（Bridge）与简易渲染器（Renderer）。用于演示小程序底座中的核心数据流：JS -> Bridge -> Native 渲染。


运行：

```bash
npm install
npm start
```

运行后：
- 控制台会显示启动日志；
- 打开浏览器访问 `http://localhost:3002` 可以实时看到渲染器输出（采用 Server-Sent Events）。

如果没有打开浏览器，渲染器会降级在控制台打印数据。

结构说明：

- `src/host.js`：宿主入口，连接 Bridge/Runtime/Renderer。
- `src/runtime.js`：使用 Node `vm` 模块运行示例小程序，注入 `setData` API。
- `src/bridge.js`：事件驱动的简易 Bridge（基于 EventEmitter）。
- `src/renderer.js`：把收到的数据渲染到控制台（模拟原生渲染层）。
- `sample-app`：示例小程序。

