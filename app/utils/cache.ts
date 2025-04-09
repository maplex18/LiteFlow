/**
 * 簡單的內存緩存實現
 */

interface CacheItem<T> {
  value: T;
  expiry: number;
}

class MemoryCache {
  private cache: Map<string, CacheItem<any>> = new Map();
  
  /**
   * 設置緩存項
   * @param key 緩存鍵
   * @param value 緩存值
   * @param ttlSeconds 過期時間（秒）
   */
  set<T>(key: string, value: T, ttlSeconds: number = 60): void {
    const expiry = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, { value, expiry });
    
    // 定期清理過期項
    this.cleanup();
  }
  
  /**
   * 獲取緩存項
   * @param key 緩存鍵
   * @returns 緩存值或 null（如果不存在或已過期）
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    
    // 如果項目不存在或已過期
    if (!item || item.expiry < Date.now()) {
      if (item) this.cache.delete(key); // 刪除過期項
      return null;
    }
    
    return item.value as T;
  }
  
  /**
   * 刪除緩存項
   * @param key 緩存鍵
   */
  delete(key: string): void {
    this.cache.delete(key);
  }
  
  /**
   * 清空所有緩存
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * 清理過期的緩存項
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (item.expiry < now) {
        this.cache.delete(key);
      }
    }
  }
  
  /**
   * 獲取或設置緩存項
   * @param key 緩存鍵
   * @param fetchFn 獲取數據的函數
   * @param ttlSeconds 過期時間（秒）
   * @returns 緩存值或獲取的新值
   */
  async getOrSet<T>(
    key: string, 
    fetchFn: () => Promise<T>, 
    ttlSeconds: number = 60
  ): Promise<T> {
    // 嘗試從緩存獲取
    const cachedValue = this.get<T>(key);
    if (cachedValue !== null) {
      console.log(`Cache hit for key: ${key}`);
      return cachedValue;
    }
    
    // 緩存未命中，獲取新數據
    console.log(`Cache miss for key: ${key}, fetching data...`);
    try {
      const newValue = await fetchFn();
      this.set(key, newValue, ttlSeconds);
      return newValue;
    } catch (error) {
      console.error(`Error fetching data for cache key ${key}:`, error);
      throw error;
    }
  }
}

// 創建單例實例
const cache = new MemoryCache();

export default cache; 