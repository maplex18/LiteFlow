import { getClientConfigSync } from "../config/client";
import { STORAGE_KEY, StoreKey } from "../constant";
import { createPersistStore } from "../utils/store";
import {
  AppState,
  getLocalAppState,
  GetStoreState,
  mergeAppState,
  setLocalAppState,
} from "../utils/sync";
import { downloadAs, readFromFile } from "../utils";
import { showToast } from "../components/ui-lib";
import Locale from "../locales";
import { createSyncClient, ProviderType } from "../utils/cloud";

export interface WebDavConfig {
  server: string;
  username: string;
  password: string;
}

// Get isApp with a default value of false
const isApp = getClientConfigSync("isApp", false);

export type SyncStore = GetStoreState<typeof useSyncStore>;

const DEFAULT_SYNC_STATE = {
  provider: ProviderType.UpStash,
  useProxy: true,
  proxyUrl: "/api/proxy",

  webdav: {
    endpoint: "",
    username: "",
    password: "",
  },

  upstash: {
    endpoint: "",
    username: STORAGE_KEY,
    apiKey: "",
  },

  lastSyncTime: 0,
  lastProvider: "",
};

interface SyncConfig {
  provider: ProviderType;
  upstash: {
    endpoint: string;
    username: string;
    apiKey: string;
  };
  webdav: {
    endpoint: string;
    username: string;
    password: string;
  };
  useProxy: boolean;
  proxyUrl: string;
}

interface AppStateWithSync extends AppState {
  syncConfig?: SyncConfig;
}

export const useSyncStore = createPersistStore(
  DEFAULT_SYNC_STATE,
  (set, get) => ({
    cloudSync() {
      // 如果是管理頁面則禁用同步
      if (typeof window !== 'undefined' && window.localStorage && window.localStorage.getItem("skip_sync_on_admin")) {
        // console.log("[Sync Store] 檢測到管理頁面標記，禁用同步");
        return false;
      }
      
      const config = get()[get().provider];
      return Object.values(config).every((c) => c.toString().length > 0);
    },

    markSyncTime() {
      set({ lastSyncTime: Date.now(), lastProvider: get().provider });
    },

    setUpstashConfig(endpoint: string, username: string, apiKey: string) {
      // console.log("[Sync Store] 設置 Upstash 配置:", {
      //   hasEndpoint: !!endpoint,
      //   endpointLength: endpoint ? endpoint.length : 0,
      //   hasUsername: !!username,
      //   usernameLength: username ? username.length : 0,
      //   hasApiKey: !!apiKey,
      //   apiKeyLength: apiKey ? apiKey.length : 0
      // });
      
      set((state) => ({
        provider: ProviderType.UpStash,
        upstash: {
          ...state.upstash,
          endpoint,
          username,
          apiKey,
        },
      }));
      
      // 檢查配置是否有效
      if (!endpoint?.trim()) {
        console.warn("[Sync Store] 設置的 Upstash endpoint 為空");
      }
      if (!apiKey?.trim()) {
        console.warn("[Sync Store] 設置的 Upstash apiKey 為空");
      }
    },

    export() {
      const state = getLocalAppState();
      const datePart = isApp
        ? `${new Date().toLocaleDateString().replace(/\//g, "_")} ${new Date()
            .toLocaleTimeString()
            .replace(/:/g, "_")}`
        : new Date().toLocaleString();

      const fileName = `Backup-${datePart}.json`;
      downloadAs(JSON.stringify(state), fileName);
    },

    async import() {
      const rawContent = await readFromFile();

      try {
        const remoteState = JSON.parse(rawContent) as AppState;
        const localState = getLocalAppState();
        mergeAppState(localState, remoteState);
        setLocalAppState(localState);
        location.reload();
      } catch (e) {
        console.error("[Import]", e);
        showToast(Locale.Settings.Sync.ImportFailed);
      }
    },

    getClient() {
      const provider = get().provider;
      const client = createSyncClient(provider, get());
      return client;
    },

    async sync() {
      // console.log("[Sync Store] sync 方法開始執行");
      
      // 如果是管理頁面則跳過同步
      if (typeof window !== 'undefined' && window.localStorage && window.localStorage.getItem("skip_sync_on_admin")) {
        // console.log("[Sync Store] 檢測到管理頁面標記，跳過同步");
        return;
      }
      
      const localState = getLocalAppState();
      const provider = get().provider;
      const config = get()[provider];
      const accessStore = (await import("./access")).useAccessStore.getState();
      const appConfig = (await import("./config")).useAppConfig.getState();

      // 記錄當前 API key 狀態
      // console.log("[Sync Store] 同步前的 API Key 狀態:", {
      //   hasDefaultKey: !!accessStore.defaultOpenaiApiKey,
      //   defaultKeyLength: accessStore.defaultOpenaiApiKey ? accessStore.defaultOpenaiApiKey.length : 0,
      //   useCustomConfig: accessStore.useCustomConfig,
      //   hasCustomKey: !!accessStore.openaiApiKey,
      //   customKeyLength: accessStore.openaiApiKey ? accessStore.openaiApiKey.length : 0
      // });

      // 確保 defaultOpenaiApiKey 有值
      if (!accessStore.defaultOpenaiApiKey) {
        // console.log("[Sync Store] defaultOpenaiApiKey 為空，嘗試從 API 獲取");
        // 嘗試從 API 獲取
        try {
          const response = await fetch('/api/config', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            }
          });
          if (response.ok) {
            const data = await response.json();
            if (data.apiKey) {
              // console.log("[Sync Store] 從 API 獲取到 API key");
              accessStore.update((state) => {
                state.defaultOpenaiApiKey = data.apiKey;
              });
            }
          }
        } catch (error) {
          console.error("[Sync Store] API 請求出錯:", error);
        }
      }

      // 保存從數據庫獲取的 API key
      const dbApiKey = accessStore.defaultOpenaiApiKey;
      // console.log("[Sync Store] 保存從數據庫獲取的 API key:", dbApiKey ? "有值" : "無值");
      // if (dbApiKey) {
      //   console.log("[Sync Store] 數據庫 API key 長度:", dbApiKey.length);
      // }

      // 檢查 Upstash 配置
      if (!config?.endpoint?.trim()) {
        // console.log("[Sync Store] endpoint 配置為空，嘗試從環境變量獲取");
        // 嘗試從環境變量獲取 Upstash 配置
        const upstashEndpoint = process.env.UPSTASH_REDIS_REST_URL || '';
        const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN || '';
        
        if (upstashEndpoint && upstashToken) {
          // console.log("[Sync Store] 從環境變量獲取到 Upstash 配置");
          // 更新 Upstash 配置
          set((state) => ({
            upstash: {
              ...state.upstash,
              endpoint: upstashEndpoint,
              apiKey: upstashToken,
            },
          }));
          
          // 重新獲取配置和客戶端
          const updatedConfig = get()[get().provider];
          if (!updatedConfig?.endpoint?.trim()) {
            console.error("[Sync Store] 無效的 endpoint 配置");
            throw new Error("Invalid endpoint configuration");
          }
        } else {
          console.error("[Sync Store] 無法從環境變量獲取 Upstash 配置");
          throw new Error("Invalid endpoint configuration");
        }
      }
      
      // 重新獲取客戶端，確保使用最新的配置
      const client = this.getClient();
      // console.log("[Sync Store] 獲取到客戶端:", {
      //   type: provider,
      //   hasEndpoint: !!config?.endpoint,
      //   endpointLength: config?.endpoint?.length || 0,
      //   hasUsername: !!config?.username,
      //   usernameLength: config?.username?.length || 0,
      //   hasApiKey: provider === ProviderType.UpStash ? !!(config as any)?.apiKey : false,
      //   apiKeyLength: provider === ProviderType.UpStash ? (config as any)?.apiKey?.length || 0 : 0
      // });

      // Validate config before proceeding
      if (!config?.endpoint?.trim()) {
        console.error("[Sync Store] 無效的 endpoint 配置");
        throw new Error("Invalid endpoint configuration");
      }
      
      // 嘗試連接 Upstash
      let connectionAttempts = 0;
      const maxAttempts = 3;
      let couldConnect = false;

      // console.log("[Sync Store] 開始嘗試連接 Upstash...");
      while (connectionAttempts < maxAttempts && !couldConnect) {
        try {
          // console.log(`[Sync Store] 連接嘗試 ${connectionAttempts + 1}/${maxAttempts}`);
          couldConnect = await client.check();
          if (couldConnect) {
            // console.log("[Sync Store] 連接成功!");
            break;
          } else {
            console.warn(`[Sync Store] 連接嘗試 ${connectionAttempts + 1} 失敗，但沒有拋出錯誤`);
          }
        } catch (e) {
          console.warn(`[Sync Store] 連接嘗試 ${connectionAttempts + 1} 失敗:`, e);
        }
        connectionAttempts++;
        if (connectionAttempts < maxAttempts) {
          // console.log(`[Sync Store] 等待 ${1000 * connectionAttempts}ms 後重試...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * connectionAttempts));
        }
      }

      if (!couldConnect) {
        console.error("[Sync Store] 多次嘗試後無法連接到 upstash");
        throw new Error("Failed to connect to upstash");
      }

      try {
        // console.log("[Sync Store] 正在獲取遠程狀態...");
        const remoteState = await client.get(config.username);
        // console.log("[Sync Store] 獲取遠程狀態結果:", {
        //   hasRemoteState: !!remoteState,
        //   remoteStateLength: remoteState ? remoteState.length : 0
        // });

        // 添加分類順序到同步狀態
        try {
          const categoryOrder = localStorage.getItem("mask-category-order");
          if (categoryOrder && localState[StoreKey.Mask]) {
            // 將分類順序添加到 mask 狀態的元數據中
            localState[StoreKey.Mask].categoryOrder = JSON.parse(categoryOrder);
          }
        } catch (e) {
          console.error("[Sync Store] 無法將分類順序添加到同步狀態", e);
        }

        // 創建一個可修改的 localState 副本
        const mutableLocalState = JSON.parse(JSON.stringify(localState));
        
        // 確保 mutableLocalState 中的 Access 存在
        if (!mutableLocalState[StoreKey.Access]) {
          mutableLocalState[StoreKey.Access] = {};
        }

        // 記錄 API key 狀態
        // console.log("[Sync Store] 準備同步的 API Key 狀態:", 
        //   dbApiKey ? "有值" : "無值", 
        //   "長度:", dbApiKey ? dbApiKey.length : 0
        // );

        // 確保同步到 Upstash 的狀態中包含數據庫的 API key
        if (dbApiKey) {
          // console.log("[Sync Store] 將數據庫 API key 添加到同步狀態");
          mutableLocalState[StoreKey.Access].defaultOpenaiApiKey = dbApiKey;
        }

        // Create state to sync with current config
        const stateToSync = {
          ...mutableLocalState,
          [StoreKey.Access]: {
            ...(mutableLocalState[StoreKey.Access] || {}),
            // 確保使用從數據庫獲取的 API key
            defaultOpenaiApiKey: dbApiKey || accessStore.defaultOpenaiApiKey
          },
          "app-config": {
            ...appConfig,
            lastUpdate: Date.now()
          }
        };

        // Always sync the current state to ensure latest config is saved
        // console.log("[Sync Store] 正在同步狀態到 upstash...");
        await client.set(config.username, JSON.stringify(stateToSync));
        this.markSyncTime();
        // console.log("[Sync Store] 同步完成");
      } catch (e) {
        console.error("[Sync Store] 同步失敗:", {
          error: e instanceof Error ? e.message : String(e),
          stack: e instanceof Error ? e.stack : undefined
        });
        throw e;
      }
    },

    async check() {
      const client = this.getClient();
      return await client.check();
    },

    async init() {
      // console.log("[Sync Store] init 方法開始執行");
      
      // 如果是管理頁面則跳過初始化同步
      if (typeof window !== 'undefined' && window.localStorage && window.localStorage.getItem("skip_sync_on_admin")) {
        // console.log("[Sync Store] 檢測到管理頁面標記，跳過同步初始化");
        return;
      }
      
      const provider = get().provider;
      const client = createSyncClient(provider, get());
      const config = get()[provider];
      const accessStore = (await import("./access")).useAccessStore.getState();

      // 記錄當前 API key 狀態
      // console.log("[Sync Store] 初始化前的 API Key 狀態:", {
      //   hasDefaultKey: !!accessStore.defaultOpenaiApiKey,
      //   defaultKeyLength: accessStore.defaultOpenaiApiKey ? accessStore.defaultOpenaiApiKey.length : 0,
      //   useCustomConfig: accessStore.useCustomConfig,
      //   hasCustomKey: !!accessStore.openaiApiKey,
      //   customKeyLength: accessStore.openaiApiKey ? accessStore.openaiApiKey.length : 0
      // });

      // 如果沒有默認 API key，嘗試從 API 獲取
      if (!accessStore.defaultOpenaiApiKey) {
        // console.log("[Sync Store] 初始化時沒有默認 API key，嘗試從 API 獲取");
        // 嘗試從 API 獲取
        try {
          const response = await fetch('/api/config', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            }
          });
          if (response.ok) {
            const data = await response.json();
            if (data.apiKey) {
              // console.log("[Sync Store] 從 API 獲取到 API key");
              accessStore.update((state) => {
                state.defaultOpenaiApiKey = data.apiKey;
              });
            }
          }
        } catch (error) {
          console.error("[Sync Store] API 請求出錯:", error);
        }
      }

      // 保存從數據庫獲取的 API key
      const dbApiKey = accessStore.defaultOpenaiApiKey;
      // console.log("[Sync Store] 保存從數據庫獲取的 API key:", dbApiKey ? "有值" : "無值");

      // 檢查 Upstash 配置
      if (!config?.endpoint?.trim()) {
        // console.log("[Sync Store] endpoint 配置為空，嘗試從環境變量獲取");
        // 嘗試從環境變量獲取 Upstash 配置
        const upstashEndpoint = process.env.UPSTASH_REDIS_REST_URL || '';
        const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN || '';
        
        if (upstashEndpoint && upstashToken) {
          // console.log("[Sync Store] 從環境變量獲取到 Upstash 配置");
          // 更新 Upstash 配置
          set((state) => ({
            upstash: {
              ...state.upstash,
              endpoint: upstashEndpoint,
              apiKey: upstashToken,
            },
          }));
          
          // 重新獲取配置和客戶端
          const updatedConfig = get()[get().provider];
          if (!updatedConfig?.endpoint?.trim()) {
            // console.log("[Sync Store] 無法設置有效的 endpoint 配置，初始化終止");
            return;
          }
        } else {
          // console.log("[Sync Store] 無法從環境變量獲取 Upstash 配置，初始化終止");
          return;
        }
      }

      const couldConnect = await client.check();
      if (!couldConnect) {
        console.error("[Sync Store] 無法連接到同步服務");
        return;
      }
      // console.log("[Sync Store] 成功連接到同步服務");

      // Fetch remote state
      // console.log("[Sync Store] 正在獲取遠程狀態...");
      const remoteState = await client.get(config.username);
      if (remoteState && remoteState !== "") {
        // console.log("[Sync Store] 找到遠程狀態，正在恢復...");
        const parsedRemoteState = JSON.parse(remoteState) as AppState;

        // 在恢復遠程狀態前，先保存當前的 defaultOpenaiApiKey
        const currentDbApiKey = accessStore.defaultOpenaiApiKey;
        // console.log("[Sync Store] 當前數據庫 API key 狀態:", 
        //   currentDbApiKey ? "有值" : "無值", 
        //   "長度:", currentDbApiKey ? currentDbApiKey.length : 0
        // );

        // Restore API settings to access store
        if (parsedRemoteState[StoreKey.Access]) {
          // console.log("[Sync Store] 正在恢復 API 設置...");
          accessStore.update((state) => {
            // 恢復其他設置
            state.openaiApiKey = parsedRemoteState[StoreKey.Access]?.openaiApiKey || state.openaiApiKey;
            state.openaiUrl = parsedRemoteState[StoreKey.Access]?.openaiUrl || state.openaiUrl;
            state.googleApiKey = parsedRemoteState[StoreKey.Access]?.googleApiKey || state.googleApiKey;
            state.googleUrl = parsedRemoteState[StoreKey.Access]?.googleUrl || state.googleUrl;
            state.azureApiKey = parsedRemoteState[StoreKey.Access]?.azureApiKey || state.azureApiKey;
            state.azureUrl = parsedRemoteState[StoreKey.Access]?.azureUrl || state.azureUrl;
            state.anthropicApiKey = parsedRemoteState[StoreKey.Access]?.anthropicApiKey || state.anthropicApiKey;
            state.anthropicUrl = parsedRemoteState[StoreKey.Access]?.anthropicUrl || state.anthropicUrl;
            state.provider = parsedRemoteState[StoreKey.Access]?.provider || state.provider;
            state.customModels = parsedRemoteState[StoreKey.Access]?.customModels || state.customModels;
            state.defaultModel = parsedRemoteState[StoreKey.Access]?.defaultModel || state.defaultModel;
            
            // 始終優先使用從數據庫獲取的 API key
            if (currentDbApiKey && currentDbApiKey.trim().length > 0) {
              // console.log("[Sync Store] 保留數據庫 API key，不使用遠程狀態中的 key");
              // 不更改 defaultOpenaiApiKey，保留數據庫中的值
            } else {
              // console.log("[Sync Store] 沒有數據庫 API key，使用遠程狀態中的 key");
              state.defaultOpenaiApiKey = parsedRemoteState[StoreKey.Access]?.defaultOpenaiApiKey || state.defaultOpenaiApiKey;
            }
          });

          // Log restored settings
          // console.log("[Sync Store] API 設置已恢復:", {
          //   hasOpenAIKey: !!parsedRemoteState[StoreKey.Access]?.openaiApiKey,
          //   hasOpenAIUrl: !!parsedRemoteState[StoreKey.Access]?.openaiUrl,
          //   provider: parsedRemoteState[StoreKey.Access]?.provider,
          //   usingDbApiKey: !!(currentDbApiKey && currentDbApiKey.trim().length > 0)
          // });
        } else {
          // console.log("[Sync Store] 遠程狀態中沒有 API 設置");
        }

        // 修改遠程狀態中的 API key 設置，確保不會覆蓋數據庫 API key
        if (currentDbApiKey && currentDbApiKey.trim().length > 0 && parsedRemoteState[StoreKey.Access]) {
          // console.log("[Sync Store] 修改遠程狀態，保留數據庫 API key");
          parsedRemoteState[StoreKey.Access].defaultOpenaiApiKey = currentDbApiKey;
        }

        // Set local state
        setLocalAppState(parsedRemoteState);
        // console.log("[Sync Store] 本地狀態已設置");
      } else {
        // console.log("[Sync Store] 沒有找到遠程狀態，使用本地狀態");
      }
      
      // 記錄初始化後的 API key 狀態
      // console.log("[Sync Store] 初始化後的 API Key 狀態:", {
      //   hasDefaultKey: !!accessStore.defaultOpenaiApiKey,
      //   defaultKeyLength: accessStore.defaultOpenaiApiKey ? accessStore.defaultOpenaiApiKey.length : 0,
      //   useCustomConfig: accessStore.useCustomConfig,
      //   hasCustomKey: !!accessStore.openaiApiKey,
      //   customKeyLength: accessStore.openaiApiKey ? accessStore.openaiApiKey.length : 0
      // });
    },
  }),
  {
    name: StoreKey.Sync,
    version: 1.2,

    migrate(persistedState, version) {
      const newState = persistedState as typeof DEFAULT_SYNC_STATE;

      if (version < 1.1) {
        newState.upstash.username = STORAGE_KEY;
      }

      if (version < 1.2) {
        if (
          (persistedState as typeof DEFAULT_SYNC_STATE).proxyUrl ===
          "/api/cors/"
        ) {
          newState.proxyUrl = "";
        }
      }

      return newState as any;
    },
  },
);
