# 小程序容器浏览器插件

这是一个将小程序运行环境集成到浏览器插件中的演示项目。

## 功能特点

- 🎯 **多小程序支持**：可以在插件中选择不同的小程序运行
- 🖼️ **页面内渲染**：小程序以浮动窗口形式显示在当前网页中
- 🔧 **完整控制**：通过插件弹窗控制小程序的启动、显示、隐藏和刷新
- 📊 **实时数据**：在插件中实时查看小程序的数据状态
- 📝 **操作日志**：详细的运行日志帮助调试

## 支持的小程序

1. **示例小程序** (`sample-app`) - 基础计数功能
2. **计数器小程序** (`counter-app`) - 带自动递增的计数器
3. **待办事项小程序** (`todo-app`) - 任务管理功能

## 安装和使用

### 1. 构建插件

```bash
npm run build-extension
```

这会在 `dist-extension` 目录下生成插件文件。

### 2. 安装到Chrome浏览器

1. 打开Chrome浏览器
2. 访问 `chrome://extensions/`
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择 `dist-extension` 目录

### 3. 启动后端服务

```bash
npm start
```

确保Node.js服务在端口3000上运行。

### 4. 使用插件

1. 打开任意网页（不能是chrome://或edge://等浏览器内置页面）
2. 点击浏览器工具栏中的插件图标
3. 在弹窗中选择要运行的小程序
4. 点击"启动"按钮
5. 使用"显示"/"隐藏"按钮控制小程序显示

## 项目架构

```
extension/
├── manifest.json          # 插件配置文件
├── popup/                 # 插件弹窗界面
│   ├── popup.html         # 弹窗HTML
│   ├── popup.js           # 弹窗逻辑
│   └── styles.css         # 弹窗样式
├── content/               # 页面注入脚本
│   ├── content.js         # Content Script主文件
│   └── styles.css         # 注入样式
├── background/            # 后台脚本
│   └── background.js      # 后台逻辑
└── assets/                # 静态资源
```

## 通信流程

1. **用户操作** → 插件弹窗
2. **弹窗** → 后台脚本 (chrome.runtime.connect)
3. **后台脚本** → Node.js服务 (HTTP API)
4. **Node.js服务** → 小程序运行时
5. **运行时** → 渲染层 (WebSocket)
6. **渲染层** → Content Script (chrome.runtime.sendMessage)
7. **Content Script** → 页面显示

## API接口

Node.js服务提供以下API：

- `POST /api/launch-app` - 启动指定小程序
- `POST /api/show-app` - 显示小程序
- `POST /api/hide-app` - 隐藏小程序
- `POST /api/refresh-app` - 刷新小程序数据
- `GET /api/apps` - 获取可用小程序列表

## 开发调试

### 查看日志

- **插件日志**：在插件弹窗中查看操作日志
- **Content Script日志**：打开网页控制台，查看`[MiniApp]`前缀的日志
- **后台脚本日志**：在Chrome扩展管理页面点击"检查视图"查看
- **Node.js日志**：在终端中查看服务日志

### 测试页面

项目包含测试页面 `test-plugin.html`，可以用来验证插件功能：

```bash
# 在浏览器中打开测试页面
open test-plugin.html
```

## 注意事项

1. **页面限制**：插件不能在浏览器内置页面（chrome://, edge://）上工作
2. **端口占用**：确保端口3000、3002、3003未被其他程序占用
3. **CORS设置**：Node.js服务已配置允许跨域请求
4. **WebSocket连接**：后台脚本会自动连接到Node.js的WebSocket服务

## 故障排除

### 常见问题

1. **插件无法加载**
   - 检查是否开启了开发者模式
   - 确认选择了正确的插件目录

2. **小程序无法启动**
   - 确保Node.js服务正在运行
   - 检查控制台是否有错误信息

3. **小程序不显示**
   - 确认当前页面不是浏览器内置页面
   - 检查Content Script是否成功注入

4. **数据不同步**
   - 检查WebSocket连接状态
   - 查看后台脚本和Node.js服务日志

## 扩展开发

### 添加新的小程序

1. 在项目根目录创建新的小程序文件夹
2. 创建 `app.js` 文件实现小程序逻辑
3. 在 `src/host.js` 中添加小程序配置
4. 在插件弹窗的选择器中添加选项

### 自定义渲染样式

修改 `extension/content/styles.css` 来改变小程序在页面中的显示样式。

### 扩展API功能

在 `src/host.js` 中添加新的API端点，在 `extension/background/background.js` 中添加对应的处理逻辑。

## 许可证

MIT License