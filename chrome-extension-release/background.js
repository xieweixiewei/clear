// 简化版后台脚本 - 无快捷键功能

console.log('简化版后台脚本启动');

// 监听安装事件
chrome.runtime.onInstalled.addListener(() => {
  console.log('扩展已安装');
});

console.log('简化版后台脚本加载完成');