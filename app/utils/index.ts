export function safeLocalStorage() {
  // 創建一個緩存對象來存儲從 localStorage 讀取的值，允許 null 值
  const cache: Record<string, string | null> = {};

  const storage = {
    getItem: (key: string): string | null => {
      try {
        // 檢查是否已緩存
        if (cache[key] !== undefined) {
          return cache[key];
        }
        
        // 首次讀取時，從 localStorage 獲取並緩存
        if (typeof window !== "undefined" && window.localStorage) {
          const value = window.localStorage.getItem(key);
          cache[key] = value;
          
          // 除了 token 外，添加額外的日誌
          if (key === 'token') {
            console.log(`[SafeStorage] 獲取 token: ${value ? '成功 (長度: ' + value.length + ')' : '失敗 (未找到)'}`);
          } else {
            console.log(`[SafeStorage] 獲取 ${key}: ${value ? '成功' : '失敗 (未找到)'}`);
          }
          
          return value;
        }
      } catch (error) {
        console.error(`[SafeStorage] 從 localStorage 獲取 ${key} 時出錯:`, error);
      }
      return null;
    },
    
    setItem: (key: string, value: string): void => {
      try {
        // 更新緩存
        cache[key] = value;
        
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem(key, value);
          
          // 除了 token 外，添加額外的日誌
          if (key === 'token') {
            console.log(`[SafeStorage] 設置 token: 成功 (長度: ${value.length})`);
          } else {
            console.log(`[SafeStorage] 設置 ${key}: 成功`);
          }
        }
      } catch (error) {
        console.error(`[SafeStorage] 設置 localStorage ${key} 時出錯:`, error);
      }
    },
    
    removeItem: (key: string): void => {
      try {
        // 從緩存中刪除
        delete cache[key];
        
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.removeItem(key);
          console.log(`[SafeStorage] 移除 ${key}: 成功`);
        }
      } catch (error) {
        console.error(`[SafeStorage] 從 localStorage 移除 ${key} 時出錯:`, error);
      }
    },
    
    clear: (): void => {
      try {
        // 清空緩存
        Object.keys(cache).forEach(key => {
          delete cache[key];
        });
        
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.clear();
          console.log(`[SafeStorage] 清空 localStorage: 成功`);
        }
      } catch (error) {
        console.error(`[SafeStorage] 清空 localStorage 時出錯:`, error);
      }
    }
  };
  
  return storage;
} 