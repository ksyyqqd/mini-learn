// 计数器小程序示例
App({
  data: {
    count: 0,
    step: 1
  },
  
  onLaunch() {
    console.log('计数器小程序启动');
    this.startAutoIncrement();
  },
  
  onUpdate(opts) {
    console.log('计数器数据更新', opts);
  },

  // 增加计数
  increment() {
    const newCount = this.data.count + this.data.step;
    setData({ data: { count: newCount } });
  },

  // 减少计数
  decrement() {
    const newCount = this.data.count - this.data.step;
    setData({ data: { count: newCount } });
  },

  // 重置计数
  reset() {
    setData({ data: { count: 0 } });
  },

  // 设置步长
  setStep(step) {
    setData({ data: { step: parseInt(step) || 1 } });
  },

  // 开始自动递增
  startAutoIncrement() {
    this.autoTimer = setInterval(() => {
      this.increment();
    }, 2000); // 每2秒自动增加
  },

  // 停止自动递增
  stopAutoIncrement() {
    if (this.autoTimer) {
      clearInterval(this.autoTimer);
      this.autoTimer = null;
    }
  }
});