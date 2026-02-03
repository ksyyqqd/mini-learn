class MiniAppRenderer {
  constructor() {
    this.container = null;
    this.isVisible = false;
    this.currentData = null;
    this.initialize();
  }

  initialize() {
    this.createContainer();
    this.setupMessageListener();
    console.log('[MiniApp] Content Script已初始化');
  }

  createContainer() {
    // 移除已存在的容器
    const existingContainer = document.querySelector('.miniapp-container');
    if (existingContainer) {
      existingContainer.remove();
    }

    // 创建新的容器
    this.container = document.createElement('div');
    this.container.className = 'miniapp-container';
    
    this.container.innerHTML = `
      <div class="miniapp-header">
        <h2 class="miniapp-title">小程序</h2>
        <button class="miniapp-close">×</button>
      </div>
      <div class="miniapp-content">
        <div class="miniapp-placeholder">等待小程序启动...</div>
      </div>
    `;

    document.body.appendChild(this.container);

    // 绑定关闭按钮事件
    const closeButton = this.container.querySelector('.miniapp-close');
    closeButton.addEventListener('click', () => {
      this.hide();
    });
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sendResponse);
      return true; // 保持消息通道开放
    });
  }

  handleMessage(message, sendResponse) {
    switch (message.type) {
      case 'SHOW_MINIAPP':
        this.show(message.payload);
        sendResponse({ success: true });
        break;
        
      case 'HIDE_MINIAPP':
        this.hide();
        sendResponse({ success: true });
        break;
        
      case 'UPDATE_MINIAPP_DATA':
        this.updateData(message.payload.data);
        sendResponse({ success: true });
        break;
        
      case 'SET_MINIAPP_TITLE':
        this.setTitle(message.payload.title);
        sendResponse({ success: true });
        break;
        
      default:
        sendResponse({ success: false, error: '未知消息类型' });
    }
  }

  show(payload = {}) {
    if (!this.container) return;

    this.isVisible = true;
    this.container.classList.add('visible');
    
    if (payload.title) {
      this.setTitle(payload.title);
    }

    if (payload.data) {
      this.updateData(payload.data);
    }

    console.log('[MiniApp] 小程序已显示');
  }

  hide() {
    if (!this.container) return;

    this.isVisible = false;
    this.container.classList.remove('visible');
    console.log('[MiniApp] 小程序已隐藏');
  }

  updateData(data) {
    if (!this.container || !this.isVisible) return;

    this.currentData = data;
    const content = this.container.querySelector('.miniapp-content');
    
    if (data) {
      content.innerHTML = `
        <div class="miniapp-data">
          <h3>数据状态</h3>
          <pre>${JSON.stringify(data, null, 2)}</pre>
        </div>
      `;
    } else {
      content.innerHTML = '<div class="miniapp-placeholder">暂无数据</div>';
    }
  }

  setTitle(title) {
    if (!this.container) return;
    
    const titleElement = this.container.querySelector('.miniapp-title');
    if (titleElement) {
      titleElement.textContent = title;
    }
  }

  isVisible() {
    return this.isVisible;
  }

  getCurrentData() {
    return this.currentData;
  }
}

// 全局暴露MiniApp对象
window.MiniApp = {
  show: (options = {}) => {
    chrome.runtime.sendMessage({
      type: 'SHOW_MINIAPP',
      payload: options
    });
  },
  
  hide: () => {
    chrome.runtime.sendMessage({
      type: 'HIDE_MINIAPP'
    });
  },
  
  updateData: (data) => {
    chrome.runtime.sendMessage({
      type: 'UPDATE_MINIAPP_DATA',
      payload: { data }
    });
  },
  
  setTitle: (title) => {
    chrome.runtime.sendMessage({
      type: 'SET_MINIAPP_TITLE',
      payload: { title }
    });
  }
};

// 初始化渲染器
const miniAppRenderer = new MiniAppRenderer();

// 页面加载完成后检查是否需要显示小程序
document.addEventListener('DOMContentLoaded', () => {
  // 可以在这里添加自动显示逻辑
});

console.log('[MiniApp] 小程序容器已就绪，可以通过 window.MiniApp 访问');