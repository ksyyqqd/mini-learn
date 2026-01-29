// 小程序示例：注册生命周期并定期更新数据
App({
  onLaunch() {
    console.log('App onLaunch');
  },
  onUpdate(opts) {
    console.log('App onUpdate', opts);
  },

  handleUpdate(){
    update();
  }
});

let count = 0;

function update() {
  count++;
  // setData 在 runtime 的沙箱中会被桥接到宿主/渲染层
  setData({ page: { data: { count } } });
}

setInterval(update, 3000);
// update();
