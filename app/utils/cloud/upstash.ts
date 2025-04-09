import { STORAGE_KEY } from "@/app/constant";
import { SyncStore } from "@/app/store/sync";
import { chunks } from "../format";

export type UpstashConfig = SyncStore["upstash"];
export type UpStashClient = ReturnType<typeof createUpstashClient>;

export function createUpstashClient(store: SyncStore) {
  const config = store.upstash;
  const storeKey = config.username.length === 0 ? STORAGE_KEY : config.username;
  const chunkCountKey = `${storeKey}-chunk-count`;
  const chunkIndexKey = (i: number) => `${storeKey}-chunk-${i}`;

  console.log("[Upstash Client] 創建客戶端:", {
    hasEndpoint: !!config.endpoint,
    endpointLength: config.endpoint ? config.endpoint.length : 0,
    hasUsername: !!config.username,
    usernameLength: config.username ? config.username.length : 0,
    hasApiKey: !!config.apiKey,
    apiKeyLength: config.apiKey ? config.apiKey.length : 0,
    storeKey,
    useProxy: store.useProxy,
    proxyUrl: store.proxyUrl
  });

  const proxyUrl =
    store.useProxy && store.proxyUrl.length > 0 ? store.proxyUrl : undefined;

  return {
    async check() {
      try {
        console.log("[Upstash] 開始檢查連接...");
        
        // 檢查配置
        if (!config.endpoint) {
          console.error("[Upstash] 檢查失敗: endpoint 未設置");
          return false;
        }
        
        if (!config.apiKey) {
          console.error("[Upstash] 檢查失敗: apiKey 未設置");
          return false;
        }
        
        const url = this.path(`get/${storeKey}`, proxyUrl);
        // console.log("[Upstash] 檢查連接:", { 
        //   url,
        //   storeKey,
        //   hasApiKey: !!config.apiKey,
        //   apiKeyLength: config.apiKey ? config.apiKey.length : 0
        // });

        // 添加超時處理
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超時
        
        try {
          // console.log("[Upstash] 發送檢查請求...");
          const res = await fetch(url, {
            method: "GET",
            headers: this.headers(),
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          // console.log("[Upstash] 收到檢查響應:", {
          //   status: res.status,
          //   statusText: res.statusText,
          //   headers: Object.fromEntries(res.headers.entries())
          // });

          if (res.status === 401) {
            console.error("[Upstash] Authentication failed - please check your API key");
            return false;
          }
          
          // 嘗試讀取響應體
          let responseText = "";
          try {
            responseText = await res.text();
            // console.log("[Upstash] 響應體:", {
            //   length: responseText.length,
            //   preview: responseText.substring(0, 100) + (responseText.length > 100 ? "..." : "")
            // });
          } catch (textError) {
            console.error("[Upstash] 無法讀取響應體:", textError);
          }
          
          const isSuccess = [200].includes(res.status);
          // console.log("[Upstash] 檢查結果:", { 
          //   status: res.status, 
          //   isSuccess,
          //   responseText: responseText ? "有響應體" : "無響應體"
          // });
          return isSuccess;
        } catch (fetchError) {
          clearTimeout(timeoutId);
          
          if ((fetchError as any).name === 'AbortError') {
            console.error("[Upstash] 檢查請求超時");
            return false;
          }
          
          console.error("[Upstash] 檢查請求失敗:", {
            error: fetchError instanceof Error ? fetchError.message : String(fetchError),
            stack: fetchError instanceof Error ? fetchError.stack : undefined
          });
          return false;
        }
      } catch (e) {
        console.error("[Upstash] Check failed:", {
          error: e instanceof Error ? e.message : String(e),
          stack: e instanceof Error ? e.stack : undefined,
          url: this.path(`get/${storeKey}`, proxyUrl)
        });
        return false;
      }
    },

    async redisGet(key: string) {
      try {
        const url = this.path(`get/${key}`, proxyUrl);
        
        const res = await fetch(url, {
          method: "GET",
          headers: this.headers(),
        });

        if (!res.ok) {
          console.error("[Upstash] Get failed:", {
            status: res.status,
            statusText: res.statusText,
            key,
            url
          });
          
          if (res.status === 401) {
            throw new Error("Authentication failed - please check your API key");
          }
          
          throw new Error(`Failed to get key ${key}: ${res.statusText}`);
        }

        const resJson = (await res.json()) as { result: string };
        return resJson.result;
      } catch (e) {
        console.error("[Upstash] Get error:", {
          error: e instanceof Error ? e.message : String(e),
          key
        });
        throw e;
      }
    },

    async redisSet(key: string, value: string) {
      try {
        const res = await fetch(this.path(`set/${key}`, proxyUrl), {
          method: "POST",
          headers: this.headers(),
          body: value,
        });

        if (!res.ok) {
          console.error("[Upstash] set failed:", {
            status: res.status,
            statusText: res.statusText,
            key
          });
          throw new Error(`Failed to set key ${key}: ${res.statusText}`);
        }

      } catch (e) {
        console.error("[Upstash] set error:", e);
        throw e;
      }
    },

    async get() {
      const chunkCount = Number(await this.redisGet(chunkCountKey));
      if (!Number.isInteger(chunkCount)) return;

      const chunks = await Promise.all(
        new Array(chunkCount)
          .fill(0)
          .map((_, i) => this.redisGet(chunkIndexKey(i))),
      );
      return chunks.join("");
    },

    async set(_: string, value: string) {
      // upstash limit the max request size which is 1Mb for "Free" and "Pay as you go"
      // so we need to split the data to chunks
      let index = 0;
      for await (const chunk of chunks(value)) {
        await this.redisSet(chunkIndexKey(index), chunk);
        index += 1;
      }
      await this.redisSet(chunkCountKey, index.toString());
    },

    headers() {
      return {
        Authorization: `Bearer ${config.apiKey}`,
      };
    },
    path(path: string, proxyUrl: string = "") {
      console.log("[Upstash] path 方法開始:", {
        originalPath: path,
        originalProxyUrl: proxyUrl
      });

      if (!path.endsWith("/")) {
        path += "/";
        console.log("[Upstash] 添加結尾斜線到 path:", path);
      }
      if (path.startsWith("/")) {
        path = path.slice(1);
        console.log("[Upstash] 移除開頭斜線從 path:", path);
      }

      // 確保 proxyUrl 正確格式化
      if (proxyUrl) {
        console.log("[Upstash] 原始 proxyUrl:", proxyUrl);
        
        // 移除結尾斜線
        while (proxyUrl.endsWith("/")) {
          proxyUrl = proxyUrl.slice(0, -1);
          console.log("[Upstash] 移除結尾斜線從 proxyUrl:", proxyUrl);
        }
        // 確保開頭有斜線
        if (!proxyUrl.startsWith("/") && !proxyUrl.startsWith("http")) {
          proxyUrl = "/" + proxyUrl;
          console.log("[Upstash] 添加開頭斜線到 proxyUrl:", proxyUrl);
        }
      }

      // 直接使用 api/upstash 路由，不通過 proxy
      const pathPrefix = "api/upstash/";
      let url: string;
      
      console.log("[Upstash] 構建 URL 參數:", {
        path,
        proxyUrl: proxyUrl || "未使用代理",
        endpoint: config.endpoint,
        pathPrefix
      });

      try {
        // 獲取當前頁面的 origin
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        // console.log("[Upstash] 當前 origin:", origin);
        
        // 直接使用 api/upstash 路由
        let fullUrl = `${origin}/api/upstash/${path}`;
        
        // 規範化 URL，避免雙斜線
        fullUrl = fullUrl.replace(/(https?:\/\/)|(\/)+/g, (match) => {
          if (match === "http://" || match === "https://") return match;
          return "/";
        });
        
        // 添加查詢參數
        const u = new URL(fullUrl);
        u.searchParams.append("endpoint", config.endpoint);
        url = u.toString();
        
        console.log("[Upstash] 成功構建 URL:", { 
          url,
          method: "直接使用 api/upstash 路由"
        });
      } catch (e) {
        console.error("[Upstash] 構建 URL 失敗，使用備用方法:", e);
        
        // 備用方法：使用相對路徑
        try {
          // 獲取當前頁面的 origin
          const origin = typeof window !== 'undefined' ? window.location.origin : '';
          let backupUrl = `${origin}/api/upstash/${path}`;
          
          // 規範化路徑，避免雙斜線
          backupUrl = backupUrl.replace(/(https?:\/\/)|(\/)+/g, (match) => {
            if (match === "http://" || match === "https://") return match;
            return "/";
          });
          
          // 添加查詢參數
          url = `${backupUrl}?endpoint=${encodeURIComponent(config.endpoint)}`;
          console.log("[Upstash] 備用 URL:", { 
            url,
            method: "備用方法"
          });
        } catch (backupError) {
          // 如果備用方法也失敗，使用最簡單的方法
          console.error("[Upstash] 備用方法也失敗:", backupError);
          url = `/api/upstash/${path}?endpoint=${encodeURIComponent(config.endpoint)}`;
          // console.log("[Upstash] 最終備用 URL:", { 
          //   url,
          //   method: "最終備用方法"
          // });
        }
      }

      return url;
    },
  };
}
