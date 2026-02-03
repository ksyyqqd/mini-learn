class PopupManager {
  constructor() {
    this.currentApp = null;
    this.isConnected = false;
    this.openWindows = new Set();
    this.initializeElements();
    this.bindEvents();
    this.connectToBackground();
  }

  initializeElements() {
    this.elements = {
      appSelect: document.getElementById('appSelect'),
      launchBtn: document.getElementById('launchBtn'),
      showBtn: document.getElementById('showBtn'),
      showWindowBtn: document.getElementById('showWindowBtn'),
      hideBtn: document.getElementById('hideBtn'),
      refreshBtn: document.getElementById('refreshBtn'),
      dataDisplay: document.getElementById('dataDisplay'),
      logContainer: document.getElementById('logContainer')
    };
    
    // 初始化按钮状态
    this.updateButtonStates(false);
  }

  bindEvents() {
    this.elements.launchBtn.addEventListener('click', () => this.launchApp());
    this.elements.showBtn.addEventListener('click', () => this.showApp());
    this.elements.showWindowBtn.addEventListener('click', () => this.showAppWindow());
    this.elements.hideBtn.addEventListener('click', () => this.hideApp());
    this.elements.refreshBtn.addEventListener('click', () => this.refreshApp());
  }

  connectToBackground() {
    this.port = chrome.runtime.connect({ name: 'popup' });
    
    this.port.onMessage.addListener((message) => {
      this.handleMessage(message);
    });

    this.port.onDisconnect.addListener(() => {
      this.isConnected = false;
      this.log('与后台脚本断开连接', 'error');
      this.updateButtonStates(false);
    });

    this.isConnected = true;
    this.log('已连接到后台脚本', 'success');
  }

  handleMessage(message) {
    switch (message.type) {
      case 'APP_LAUNCHED':
        this.currentApp = message.payload.appName;
        this.log(`小程序 "${message.payload.appName}" 已启动`, 'success');
        this.updateButtonStates(true);
        this.updateDataDisplay(message.payload.data);
        break;
        
      case 'APP_DATA_UPDATE':
        this.updateDataDisplay(message.payload.data);
        break;
        
      case 'APP_SHOWN':
        this.log('小程序已显示', 'info');
        break;
        
      case 'APP_WINDOW_SHOWN':
        this.log(`已打开独立窗口 (ID: ${message.payload.windowId})`, 'success');
        this.openWindows.add(message.payload.windowId);
        break;
        
      case 'APP_HIDDEN':
        this.log('小程序已隐藏', 'info');
        break;
        
      case 'ERROR':
        this.log(`错误: ${message.payload.message}`, 'error');
        break;
        
      default:
        this.log(`收到未知消息类型: ${message.type}`, 'info');
    }
  }

  async launchApp() {
    const appName = this.elements.appSelect.value;
    if (!appName) {
      this.log('请选择要启动的小程序', 'error');
      return;
    }

    try {
      this.log(`正在启动小程序: ${appName}`, 'info');
      this.elements.launchBtn.disabled = true;
      
      this.port.postMessage({
        type: 'LAUNCH_APP',
        payload: { appName }
      });
      
    } catch (error) {
      this.log(`启动失败: ${error.message}`, 'error');
      this.elements.launchBtn.disabled = false;
    }
  }

  showApp() {
    if (!this.currentApp) {
      this.log('请先启动小程序', 'error');
      return;
    }

    this.port.postMessage({
      type: 'SHOW_APP'
    });
  }

  showAppWindow() {
    if (!this.currentApp) {
      this.log('请先启动小程序', 'error');
      return;
    }

    this.port.postMessage({
      type: 'SHOW_APP_WINDOW'
    });
  }

  hideApp() {
    if (!this.currentApp) {
      this.log('请先启动小程序', 'error');
      return;
    }

    this.port.postMessage({
      type: 'HIDE_APP'
    });
  }

  refreshApp() {
    if (!this.currentApp) {
      this.log('请先启动小程序', 'error');
      return;
    }

    this.log('正在刷新小程序...', 'info');
    this.port.postMessage({
      type: 'REFRESH_APP'
    });
  }

  updateDataDisplay(data) {
    if (data) {
      this.elements.dataDisplay.textContent = JSON.stringify(data, null, 2);
    } else {
      this.elements.dataDisplay.textContent = '暂无数据';
    }
  }

  updateButtonStates(isRunning) {
    this.elements.launchBtn.disabled = isRunning;
    this.elements.showBtn.disabled = !isRunning;
    this.elements.showWindowBtn.disabled = !isRunning;
    this.elements.hideBtn.disabled = !isRunning;
    this.elements.refreshBtn.disabled = !isRunning;
    
    if (isRunning) {
      this.elements.launchBtn.textContent = '已启动';
    } else {
      this.elements.launchBtn.textContent = '启动';
      this.elements.dataDisplay.textContent = '未启动任何小程序';
      this.currentApp = null;
      this.openWindows.clear();
    }
  }

  log(message, type = 'info') {
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-${type}`;
    logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    this.elements.logContainer.appendChild(logEntry);
    this.elements.logContainer.scrollTop = this.elements.logContainer.scrollHeight;
  }
}

// 初始化弹窗管理器
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});