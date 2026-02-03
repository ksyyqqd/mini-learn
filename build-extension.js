const fs = require('fs');
const path = require('path');

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('开始构建浏览器插件...');

// 清理目标目录
const distDir = path.join(__dirname, 'dist-extension');
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}

// 复制extension目录到dist-extension
const srcDir = path.join(__dirname, 'extension');
copyDir(srcDir, distDir);

console.log('浏览器插件构建完成！');
console.log('插件位置:', distDir);
console.log('\n安装步骤:');
console.log('1. 打开Chrome浏览器');
console.log('2. 访问 chrome://extensions/');
console.log('3. 开启"开发者模式"');
console.log('4. 点击"加载已解压的扩展程序"');
console.log('5. 选择此目录:', distDir);