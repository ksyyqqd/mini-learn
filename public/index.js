 // 初始化WebSocket客户端
      const wsClient = new BrowserWebSocketClient('ws://localhost:3003');
      const renderEl = document.getElementById('render');
      const dataEl = document.getElementById('data');
      const statusEl = document.getElementById('connection-status');
      
      // 更新连接状态显示
      function updateConnectionStatus(status) {
        switch (status) {
          case 'connected':
            statusEl.className = 'status connected';
            statusEl.textContent = 'WebSocket: Connected';
            break;
          case 'disconnected':
            statusEl.className = 'status disconnected';
            statusEl.textContent = 'WebSocket: Disconnected';
            break;
          case 'reconnecting':
            statusEl.className = 'status reconnecting';
            statusEl.textContent = `WebSocket: Reconnecting (${wsClient.getReconnectAttempts()}/${wsClient.maxReconnectAttempts})`;
            break;
          case 'error':
            statusEl.className = 'status disconnected';
            statusEl.textContent = 'WebSocket: Connection Error';
            break;
        }
      }
      
      // 注册连接事件处理器
      wsClient.onConnection('open', () => {
        updateConnectionStatus('connected');
      });

      wsClient.onConnection('close', () => {
        updateConnectionStatus('disconnected');
      });

      wsClient.onConnection('error', () => {
        updateConnectionStatus('error');
      });

      // 注册消息处理器
      wsClient.onMessage('render', (payload) => {
        const { html, data } = payload;
        if (html) {
          renderEl.innerHTML = html;
          console.log('HTML updated, binding events...');
          setTimeout(bindEvents, 10);
        }
        dataEl.textContent = JSON.stringify(data, null, 2);
      });

      wsClient.onMessage('console', (payload) => {
        const c = document.getElementById('app-console');
        const { level, args } = payload;
        const text = (args || []).map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
        const line = `[${level}] ${text}\n`;
        c.textContent = (c.textContent === '(waiting...)' ? '' : c.textContent) + line;
        if (console && console[level]) console[level].apply(console, args || []);
      });

      wsClient.onMessage('methodCallResponse', (payload) => {
        const { success, methodName, error } = payload;
        if (success) {
          console.log('Method call success:', methodName);
        } else {
          console.error('Method call failed:', error);
        }
      });

      wsClient.onMessage('connection', (payload) => {
        console.log('Connection status:', payload.status);
      });

      wsClient.onMessage('error', (payload) => {
        console.error('Server error:', payload.message);
      });

      // 添加全局方法调用函数
      window.callAppMethod = async function(methodName, args = {}) {
        console.log('Calling app method:', methodName, args);
        if (!wsClient.getConnected()) {
          console.error('WebSocket not connected');
          return;
        }
        
        try {
          const message = {
            type: 'callMethod',
            payload: {
              methodName: methodName,
              args: args
            },
            timestamp: Date.now()
          };
          const success = wsClient.send(message);
          if (success) {
            console.log('Method call sent to server');
          }
        } catch (error) {
          console.error('Method call error:', error);
        }
      };
      
      // 动态绑定onclick事件
      function bindEvents() {
        const buttons = document.querySelectorAll('button[onTap]');
        buttons.forEach(button => {
          const onclickAttr = button.getAttribute('onTap');
          if (onclickAttr) {
            const methodName = onclickAttr.replace(/\(.*\)$/, '').trim();
            if (methodName) {
              button.onclick = function(e) {
                e.preventDefault();
                console.log('Button clicked, calling method:', methodName);
                window.callAppMethod(methodName);
              };
            }
          }
        });
      }
      
      // 连接WebSocket
      wsClient.connect();
      
      // 初始绑定事件
      setTimeout(bindEvents, 100);