// 弹出窗口脚本 - 标签页去重

document.addEventListener('DOMContentLoaded', function() {
    const cleanCurrentBtn = document.getElementById('cleanCurrentBtn');
    const cleanAllBtn = document.getElementById('cleanAllBtn');
    const cleanOldTabsBtn = document.getElementById('cleanOldTabsBtn');
    const resultDiv = document.getElementById('result');
    const statsDiv = document.getElementById('stats');
    const lastCleanDiv = document.getElementById('lastClean');

    // 显示当前窗口统计和上次清理时间
    updateTabStats();
    updateLastCleanTime();

    // 清理当前窗口按钮
    cleanCurrentBtn.addEventListener('click', async function() {
        await cleanTabs(false);
    });

    // 清理所有窗口按钮
    cleanAllBtn.addEventListener('click', async function() {
        await cleanTabs(true);
    });

    // 清理旧标签页按钮
    cleanOldTabsBtn.addEventListener('click', async function() {
        await cleanOldTabs();
    });

    // 清理旧标签页函数
    async function cleanOldTabs() {
        cleanCurrentBtn.disabled = true;
        cleanAllBtn.disabled = true;
        cleanOldTabsBtn.disabled = true;
        resultDiv.style.display = 'none';

        try {
            const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
            const now = Date.now();
            
            // 获取所有标签页
            const allTabs = await chrome.tabs.query({});
            
            // 获取标签页访问时间记录
            const data = await chrome.storage.local.get(['tabAccessTimes']);
            const tabAccessTimes = data.tabAccessTimes || {};
            
            const tabsToClose = [];
            
            for (const tab of allTabs) {
                // 跳过固定标签页
                if (tab.pinned) {
                    continue;
                }
                
                // 跳过正在播放音频的标签页
                if (tab.audible) {
                    continue;
                }
                
                // 跳过Chrome内部页面
                if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
                    continue;
                }
                
                // 检查最后访问时间
                const lastAccessTime = tabAccessTimes[tab.id];
                if (lastAccessTime) {
                    const timeSinceAccess = now - lastAccessTime;
                    if (timeSinceAccess > sevenDaysInMs) {
                        tabsToClose.push(tab.id);
                    }
                }
            }
            
            // 关闭旧标签页
            if (tabsToClose.length > 0) {
                for (const tabId of tabsToClose) {
                    try {
                        await chrome.tabs.remove(tabId);
                    } catch (error) {
                        console.warn(`无法关闭标签页 ${tabId}:`, error);
                    }
                }
                
                showResult(`已清理 ${tabsToClose.length} 个7天未访问的标签页`, 'success');
                
                // 记录清理时间
                await saveLastCleanTime();
                updateLastCleanTime();
                
                setTimeout(() => {
                    window.close();
                }, 2000);
            } else {
                showResult('没有发现7天未访问的标签页', 'success');
            }
            
            updateTabStats();
        } catch (error) {
            showResult('发生错误：' + error.message, 'error');
        } finally {
            cleanCurrentBtn.disabled = false;
            cleanAllBtn.disabled = false;
            cleanOldTabsBtn.disabled = false;
        }
    }

    // 清理标签页函数
    async function cleanTabs(cleanAllWindows) {
        cleanCurrentBtn.disabled = true;
        cleanAllBtn.disabled = true;
        resultDiv.style.display = 'none';

        try {
            let totalDuplicates = 0;
            let totalTabsClosed = 0;
            let message = '';

            if (cleanAllWindows) {
                // 清理所有窗口
                const windows = await chrome.windows.getAll({ populate: true });
                
                for (const window of windows) {
                    const result = await cleanWindowTabs(window.id);
                    totalDuplicates += result.duplicatesFound;
                    totalTabsClosed += result.tabsClosed;
                }
                
                message = totalDuplicates > 0 
                    ? `已清理 ${totalDuplicates} 个重复标签页（所有窗口）`
                    : '所有窗口都没有发现重复标签页';
            } else {
                // 只清理当前窗口
                const currentWindow = await chrome.windows.getCurrent({ populate: true });
                const result = await cleanWindowTabs(currentWindow.id);
                
                message = result.message;
                totalDuplicates = result.duplicatesFound;
                totalTabsClosed = result.tabsClosed;
            }

            showResult(message, 'success');
            
            // 记录清理时间
            if (totalTabsClosed > 0) {
                await saveLastCleanTime();
                updateLastCleanTime();
                
                setTimeout(() => {
                    window.close();
                }, 2000);
            }

            updateTabStats();
        } catch (error) {
            showResult('发生错误：' + error.message, 'error');
        } finally {
            cleanCurrentBtn.disabled = false;
            cleanAllBtn.disabled = false;
        }
    }

    // 清理指定窗口的标签页
    async function cleanWindowTabs(windowId) {
        try {
            const tabs = await chrome.tabs.query({ windowId: windowId });
            
            const seenUrls = new Map();
            const tabsToClose = [];
            let duplicateCount = 0;

            for (const tab of tabs) {
                // 跳过正在播放音频的标签页
                if (tab.audible) {
                    continue;
                }

                // 跳过Chrome内部页面
                if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
                    continue;
                }

                try {
                    const url = new URL(tab.url);
                    const cleanUrl = url.origin + url.pathname + url.search;
                    
                    if (seenUrls.has(cleanUrl)) {
                        tabsToClose.push(tab.id);
                        duplicateCount++;
                    } else {
                        seenUrls.set(cleanUrl, tab.id);
                    }
                } catch (error) {
                    console.warn('跳过无效URL:', tab.url);
                }
            }

            if (tabsToClose.length > 0) {
                for (const tabId of tabsToClose) {
                    try {
                        await chrome.tabs.remove(tabId);
                    } catch (error) {
                        console.warn(`无法关闭标签页 ${tabId}:`, error);
                    }
                }
            }

            return {
                success: true,
                duplicatesFound: duplicateCount,
                tabsClosed: tabsToClose.length,
                message: duplicateCount > 0 
                    ? `已清理 ${duplicateCount} 个重复标签页`
                    : '没有发现重复标签页'
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                message: '清理过程中出现错误'
            };
        }
    }

    // 更新标签页统计信息
    async function updateTabStats() {
        try {
            const currentWindow = await chrome.windows.getCurrent({ populate: true });
            const allTabs = currentWindow.tabs;
            
            // 计算重复标签页数量
            const seenUrls = new Set();
            let duplicates = 0;
            
            for (const tab of allTabs) {
                try {
                    const url = new URL(tab.url);
                    const cleanUrl = url.origin + url.pathname + url.search;
                    
                    if (seenUrls.has(cleanUrl)) {
                        duplicates++;
                    } else {
                        seenUrls.add(cleanUrl);
                    }
                } catch (error) {
                    // 跳过无效URL
                }
            }

            statsDiv.textContent = `当前窗口：${allTabs.length} 个标签页，${duplicates} 个重复`;
        } catch (error) {
            statsDiv.textContent = '无法获取标签页信息';
        }
    }

    // 显示结果消息
    function showResult(message, type) {
        resultDiv.textContent = message;
        resultDiv.className = 'result ' + type;
        resultDiv.style.display = 'block';
    }

    // 保存最后清理时间
    async function saveLastCleanTime() {
        try {
            await chrome.storage.local.set({
                lastCleanTime: Date.now()
            });
        } catch (error) {
            console.warn('无法保存清理时间:', error);
        }
    }

    // 更新最后清理时间显示
    async function updateLastCleanTime() {
        try {
            const result = await chrome.storage.local.get(['lastCleanTime']);
            if (result.lastCleanTime) {
                const timeStr = formatRelativeTime(result.lastCleanTime);
                lastCleanDiv.textContent = `上次清理：${timeStr}`;
            } else {
                lastCleanDiv.textContent = '尚未进行过清理';
            }
        } catch (error) {
            lastCleanDiv.textContent = '';
        }
    }

    // 格式化相对时间
    function formatRelativeTime(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / (1000 * 60));
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (minutes < 1) {
            return '刚刚';
        } else if (minutes < 60) {
            return `${minutes}分钟前`;
        } else if (hours < 24) {
            return `${hours}小时前`;
        } else if (days < 7) {
            return `${days}天前`;
        } else {
            const date = new Date(timestamp);
            return date.toLocaleDateString('zh-CN', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    }
});