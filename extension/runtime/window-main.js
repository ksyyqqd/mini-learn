class MiniAppWindow {
  constructor() {
    this.websocket = null;
    this.isConnected = false;
    this.currentData = null;
    this.initializeElements();
    this.bindEvents();
    this.connectToService();
  }

  initializeElements() {
    this.elements = {
      placeholder: document.getElementById("placeholder"),
      loadingIndicator: document.getElementById("loadingIndicator"),
      statusText: document.getElementById("statusText"),
      refreshBtn: document.getElementById("refreshBtn"),
      closeBtn: document.getElementById("closeBtn"),
    };
  }

  bindEvents() {
    this.elements.refreshBtn.addEventListener("click", () =>
      this.refreshData(),
    );
    this.elements.closeBtn.addEventListener("click", () => this.closeWindow());
    document.addEventListener;
    // 监听键盘事件
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.closeWindow();
      }
    });
  }

  // 动态绑定onclick事件
  bindBtnEvents() {
    const buttons = document.querySelectorAll("button[onTap]");
    buttons.forEach((button) => {
      const onclickAttr = button.getAttribute("onTap");
      if (onclickAttr) {
        const methodName = onclickAttr.replace(/\(.*\)$/, "").trim();
        if (methodName) {
          button.onclick =  (e)=> {
            e.preventDefault();
            console.log("Button clicked, calling method:", methodName);
            this.callMethod(methodName);
          };
        }
      }
    });
  }

  connectToService() {
    try {
      this.updateStatus("正在连接...", "connecting");

      this.websocket = new WebSocket("ws://localhost:3003");

      this.websocket.onopen = () => {
        this.isConnected = true;
        this.updateStatus("已连接到小程序服务", "connected");
        console.log("[MiniApp Window] WebSocket connected");
      };

      this.websocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error("[MiniApp Window] Error parsing message:", error);
        }
      };

      this.websocket.onerror = (error) => {
        console.error("[MiniApp Window] WebSocket error:", error);
        this.updateStatus("连接错误", "disconnected");
      };

      this.websocket.onclose = () => {
        this.isConnected = false;
        this.updateStatus("连接已断开", "disconnected");
        console.log("[MiniApp Window] WebSocket disconnected");
        // 尝试重连
        setTimeout(() => {
          if (!this.isConnected) {
            this.connectToService();
          }
        }, 3000);
      };
    } catch (error) {
      console.error("[MiniApp Window] Connection failed:", error);
      this.updateStatus("连接失败: " + error.message, "disconnected");
    }
  }

  handleMessage(message) {
    switch (message.type) {
      case "render":
        this.renderData(message.payload);
        break;
      case "console":
        this.handleConsoleMessage(message.payload);
        break;
      case "connection":
        console.log("[MiniApp Window] Connection confirmed:", message.payload);
        break;
      default:
        console.log("[MiniApp Window] Unknown message type:", message.type);
    }
  }

  renderData(payload) {
    const { html, data } = payload;
    this.currentData = data;

    const content = document.querySelector(".miniapp-content");

    if (html) {
      // 如果有HTML内容，优先显示渲染后的HTML
      content.innerHTML = `
        <div class="miniapp-rendered">
          <div class="miniapp-html-content">${html}</div>
          <div class="action-buttons">
            <button class="action-btn" id="updateDataBtn">更新数据</button>
            <button class="action-btn secondary" id="refreshDataBtn">刷新</button>
          </div>
        </div>
      `;
    } else if (data && Object.keys(data).length > 0) {
      // 如果没有HTML但有数据，显示JSON数据
      content.innerHTML = `
        <div class="miniapp-data">
          <h3>小程序数据</h3>
          <pre>${JSON.stringify(data, null, 2)}</pre>
          <div class="action-buttons">
            <button class="action-btn" id="updateDataBtn">更新数据</button>
            <button class="action-btn secondary" id="refreshDataBtn">刷新</button>
          </div>
        </div>
      `;
    } else {
      // 如果都没有，显示占位符
      content.innerHTML = `
        <div class="miniapp-placeholder">
          暂无数据<br>
          <small>请确保小程序已在后台运行</small>
        </div>
      `;
    }


    this.bindBtnEvents();

    // 动态绑定事件处理器，避免内联onclick违反CSP
    const updateBtn = document.getElementById("updateDataBtn");
    const refreshBtn = document.getElementById("refreshDataBtn");

    if (updateBtn) {
      updateBtn.addEventListener("click", () => {
        this.callMethod("handleUpdate");
      });
    }

    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        this.refreshData();
      });
    }
  }

  handleConsoleMessage(payload) {
    const { level, args } = payload;
    const message = args.join(" ");

    // 在控制台输出
    switch (level) {
      case "log":
        console.log("[MiniApp]", message);
        break;
      case "warn":
        console.warn("[MiniApp]", message);
        break;
      case "error":
        console.error("[MiniApp]", message);
        break;
      default:
        console.info("[MiniApp]", message);
    }

    // 可以在这里添加UI上的日志显示
  }

  async callMethod(methodName, args = []) {
    if (!this.isConnected) {
      console.warn("[MiniApp Window] Not connected to service");
      return;
    }

    try {
      const message = {
        type: "callMethod",
        payload: { methodName, args },
      };

      this.websocket.send(JSON.stringify(message));
      console.log(`[MiniApp Window] Called method: ${methodName}`);
    } catch (error) {
      console.error("[MiniApp Window] Error calling method:", error);
    }
  }

  refreshData() {
    if (this.isConnected) {
      // 请求刷新数据
      this.callMethod("refresh");
    } else {
      // 重新连接
      this.connectToService();
    }
  }

  updateStatus(text, status) {
    this.elements.statusText.textContent = text;

    // 移除所有状态类
    this.elements.statusText.classList.remove(
      "status-connected",
      "status-disconnected",
    );

    switch (status) {
      case "connected":
        this.elements.statusText.classList.add("status-connected");
        this.elements.loadingIndicator.style.display = "none";
        break;
      case "disconnected":
        this.elements.statusText.classList.add("status-disconnected");
        this.elements.loadingIndicator.style.display = "inline-block";
        break;
      default:
        this.elements.loadingIndicator.style.display = "inline-block";
    }
  }

  closeWindow() {
    if (this.websocket) {
      this.websocket.close();
    }
    window.close();
  }
}

// 初始化小程序窗口
const miniAppWindow = new MiniAppWindow();

// 全局暴露方法供HTML调用
window.miniAppWindow = miniAppWindow;

// 页面加载完成后的初始化
document.addEventListener("DOMContentLoaded", () => {
  console.log("[MiniApp Window] Window loaded and initialized");
});
