// 后台脚本 - 跟踪标签页访问时间

console.log('后台脚本启动');

// 监听扩展安装事件
chrome.runtime.onInstalled.addListener(() => {
  console.log('扩展已安装');
  // 初始化所有现有标签页的访问时间
  initializeExistingTabs();
});

// 初始化现有标签页的访问时间
async function initializeExistingTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    const now = Date.now();
    const data = await chrome.storage.local.get(['tabAccessTimes']);
    const tabAccessTimes = data.tabAccessTimes || {};
    
    tabs.forEach(tab => {
      // 只为还没有记录的标签页设置时间
      if (!tabAccessTimes[tab.id]) {
        tabAccessTimes[tab.id] = now;
      }
    });
    
    await chrome.storage.local.set({ tabAccessTimes });
    console.log('已初始化现有标签页访问时间');
  } catch (error) {
    console.error('初始化标签页访问时间失败:', error);
  }
}

// 监听标签页创建事件
chrome.tabs.onCreated.addListener((tab) => {
  recordTabAccessTime(tab.id);
  console.log('标签页创建:', tab.id);
});

// 监听标签页激活事件
chrome.tabs.onActivated.addListener((activeInfo) => {
  recordTabAccessTime(activeInfo.tabId);
  console.log('标签页激活:', activeInfo.tabId);
});

// 监听标签页更新事件（用户访问新URL）
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    recordTabAccessTime(tabId);
    console.log('标签页更新:', tabId);
  }
});

// 监听标签页关闭事件
chrome.tabs.onRemoved.addListener((tabId) => {
  removeTabAccessTime(tabId);
  console.log('标签页关闭:', tabId);
});

// 记录标签页访问时间
async function recordTabAccessTime(tabId) {
  try {
    const data = await chrome.storage.local.get(['tabAccessTimes']);
    const tabAccessTimes = data.tabAccessTimes || {};
    tabAccessTimes[tabId] = Date.now();
    await chrome.storage.local.set({ tabAccessTimes });
  } catch (error) {
    console.error('记录标签页访问时间失败:', error);
  }
}

// 删除标签页访问时间记录
async function removeTabAccessTime(tabId) {
  try {
    const data = await chrome.storage.local.get(['tabAccessTimes']);
    const tabAccessTimes = data.tabAccessTimes || {};
    delete tabAccessTimes[tabId];
    await chrome.storage.local.set({ tabAccessTimes });
  } catch (error) {
    console.error('删除标签页访问时间失败:', error);
  }
}

// 定期清理已关闭标签页的记录（每小时执行一次）
setInterval(async () => {
  try {
    const data = await chrome.storage.local.get(['tabAccessTimes']);
    const tabAccessTimes = data.tabAccessTimes || {};
    const allTabs = await chrome.tabs.query({});
    const existingTabIds = new Set(allTabs.map(tab => tab.id));
    
    // 删除不存在的标签页记录
    let cleaned = 0;
    for (const tabId in tabAccessTimes) {
      if (!existingTabIds.has(parseInt(tabId))) {
        delete tabAccessTimes[tabId];
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      await chrome.storage.local.set({ tabAccessTimes });
      console.log(`清理了 ${cleaned} 个已关闭标签页的记录`);
    }
  } catch (error) {
    console.error('清理标签页记录失败:', error);
  }
}, 60 * 60 * 1000); // 每小时执行一次

console.log('后台脚本加载完成');