import {
  GoogleSafetySettingsThreshold,
  ServiceProvider,
  StoreKey,
  ApiPath,
  OPENAI_BASE_URL,
  ANTHROPIC_BASE_URL,
  GEMINI_BASE_URL,
  BYTEDANCE_BASE_URL,
  TENCENT_BASE_URL,
  MOONSHOT_BASE_URL,
  STABILITY_BASE_URL,
  IFLYTEK_BASE_URL,
  XAI_BASE_URL,
  CHATGLM_BASE_URL,
} from "../constant";

interface DangerConfig {
  needCode: boolean;
  hideUserApiKey: boolean;
  hideBalanceQuery: boolean;
  disableGPT4: boolean;
  [key: string]: any;
}

import { getHeaders } from "../client/api";
import { getClientConfigSync } from "../config/client";
import { createPersistStore } from "../utils/store";
// import { ensure } from "../utils/clone";
import { DEFAULT_CONFIG } from "./config";
import { getModelProvider } from "../utils/model";
import { handleLogout } from "../components/auth";

let fetchState = 0; // 0 not fetch, 1 fetching, 2 done

const isApp = getClientConfigSync("buildMode", "standalone") === "export";

const DEFAULT_OPENAI_URL = isApp ? OPENAI_BASE_URL : ApiPath.OpenAI;

const DEFAULT_ACCESS_STATE = {
  accessCode: "",
  useCustomConfig: false,

  provider: ServiceProvider.OpenAI,

  // openai
  openaiUrl: DEFAULT_OPENAI_URL,
  openaiApiKey: "",
  defaultOpenaiApiKey: process.env.OPENAI_API_KEY || "",

  // azure
  azureUrl: "",
  azureApiKey: "",
  azureApiVersion: "2023-08-01-preview",

  // google ai studio
  googleUrl: GEMINI_BASE_URL,
  googleApiKey: "",
  googleApiVersion: "v1",
  googleSafetySettings: GoogleSafetySettingsThreshold.BLOCK_ONLY_HIGH,
  defaultGoogleApiKey: process.env.GOOGLE_API_KEY || "",

  // anthropic
  anthropicUrl: ANTHROPIC_BASE_URL,
  anthropicApiKey: "",
  anthropicApiVersion: "2023-06-01",
  defaultAnthropicApiKey: process.env.ANTHROPIC_API_KEY || "",

  // baidu

  // bytedance
  bytedanceUrl: BYTEDANCE_BASE_URL,
  bytedanceApiKey: "",


  // moonshot
  moonshotUrl: MOONSHOT_BASE_URL,
  moonshotApiKey: "",

  //stability
  stabilityUrl: STABILITY_BASE_URL,
  stabilityApiKey: "",

  // tencent
  tencentUrl: TENCENT_BASE_URL,
  tencentSecretKey: "",
  tencentSecretId: "",

  // iflytek
  iflytekUrl: IFLYTEK_BASE_URL,
  iflytekApiKey: "",
  iflytekApiSecret: "",

  // xai
  xaiUrl: XAI_BASE_URL,
  xaiApiKey: "",

  // chatglm
  chatglmUrl: CHATGLM_BASE_URL,
  chatglmApiKey: "",

  // server config
  needCode: true,
  hideUserApiKey: false,
  hideBalanceQuery: false,
  disableGPT4: false,
  disableFastLink: false,
  customModels: "",
  defaultModel: "",

  // tts config
  edgeTTSVoiceName: "zh-CN-YunxiNeural",

  // user info
  isAuthed: false,
  userInfo: null as any,
};

export const SESSION_CHECK_INTERVAL = 30000; // 每30秒檢查一次

export const useAccessStore = createPersistStore(
  { 
    ...DEFAULT_ACCESS_STATE,
    checkSession: async () => {
      const token = localStorage.getItem("token");
      const userInfo = JSON.parse(localStorage.getItem("userInfo") || "{}");
      
      if (!token || !userInfo.user_id) return;

      try {
        const response = await fetch("/api/auth/check", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: userInfo.user_id,
            sessionToken: token,
          }),
        });

        if (!response.ok) {
          // Session 無效，強制登出
          console.log("[Session] Invalid session, forcing logout");
          await handleLogout();
          return;
        }

        const data = await response.json();
        if (!data.valid) {
         
        }
      } catch (error) {
        console.error("[Session] Check failed:", error);
      }
    },
    startSessionCheck: () => {
      const userInfo = JSON.parse(localStorage.getItem("userInfo") || "{}");
      const token = localStorage.getItem("token");
      
      if (!userInfo.user_id || !token) return () => {};

      // 建立 SSE 連接，使用 URL 參數傳遞認證資訊
      const eventSource = new EventSource(
        `/api/auth/session?userId=${userInfo.user_id}&sessionToken=${token}`,
        { withCredentials: true }
      );

      eventSource.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "session_invalidated") {
          console.log("[Session] Session invalidated by server");
          await handleLogout();
          eventSource.close();
        }
      };

      eventSource.onerror = (error) => {
        console.error("[Session] SSE Error:", error);
        eventSource.close();
      };

      return () => {
        eventSource.close();
      };
    }
  },
  (set, get) => ({
    enabledAccessControl() {
      this.fetch();
      return get().needCode;
    },

    isAuthorized() {
      return get().isAuthed;
    },

    async setIsAuthed(authed: boolean) {
      set(() => ({ isAuthed: authed }));
      
      // 如果是登出操作，清除 sessionToken
      if (!authed) {
        localStorage.removeItem("token");
        localStorage.removeItem("userInfo");
      }
      
      try {
        const { useSyncStore } = await import("./sync");
        const syncStore = useSyncStore.getState();
        if (syncStore.cloudSync()) {
          syncStore.sync().catch(console.error);
        }
      } catch (e) {
        console.error("[Auth] failed to sync on auth change", e);
      }
    },

    async setUserInfo(info: any) {
      console.log("[Access Store] setUserInfo 被調用，info:", {
        hasUser: !!info.user,
        hasUpstash: !!info.upstash,
        hasOpenAIKey: !!info.openaiApiKey,
        openAIKeyLength: info.openaiApiKey ? info.openaiApiKey.length : 0,
        hasGoogleKey: !!info.googleApiKey,
        googleKeyLength: info.googleApiKey ? info.googleApiKey.length : 0,
        hasAnthropicKey: !!info.anthropicApiKey,
        anthropicKeyLength: info.anthropicApiKey ? info.anthropicApiKey.length : 0
      });

      // 設置 userInfo
      set((state) => ({ 
        userInfo: info,
        // 如果 info 中有 API keys，則設置為默認值
        defaultOpenaiApiKey: info.openaiApiKey || state.defaultOpenaiApiKey,
        defaultGoogleApiKey: info.googleApiKey || state.defaultGoogleApiKey,
        defaultAnthropicApiKey: info.anthropicApiKey || state.defaultAnthropicApiKey
      }));

      // 如果沒有從登入獲取到 API key，嘗試從 API 獲取
      if (!info.openaiApiKey && !info.googleApiKey && !info.anthropicApiKey) {
        console.log("[Access Store] 沒有從登入獲取到任何 API key，嘗試從 API 獲取");
        await this.fetchApiKeysFromDb();
      } else {
        if (info.openaiApiKey) {
          console.log("[Access Store] 從登入獲取到 OpenAI API key，長度:", info.openaiApiKey.length);
        }
        if (info.googleApiKey) {
          console.log("[Access Store] 從登入獲取到 Google API key，長度:", info.googleApiKey.length);
        }
        if (info.anthropicApiKey) {
          console.log("[Access Store] 從登入獲取到 Anthropic API key，長度:", info.anthropicApiKey.length);
        }
      }

      // 記錄設置後的狀態
      const currentState = get();
      console.log("[Access Store] 設置後的 API Key 狀態:", {
        hasDefaultOpenAIKey: !!currentState.defaultOpenaiApiKey,
        defaultOpenAIKeyLength: currentState.defaultOpenaiApiKey ? currentState.defaultOpenaiApiKey.length : 0,
        hasDefaultGoogleKey: !!currentState.defaultGoogleApiKey,
        defaultGoogleKeyLength: currentState.defaultGoogleApiKey ? currentState.defaultGoogleApiKey.length : 0,
        hasDefaultAnthropicKey: !!currentState.defaultAnthropicApiKey,
        defaultAnthropicKeyLength: currentState.defaultAnthropicApiKey ? currentState.defaultAnthropicApiKey.length : 0,
        useCustomConfig: currentState.useCustomConfig
      });

      try {
        if (info?.upstash) {
          const { useSyncStore } = await import("./sync");
          const syncStore = useSyncStore.getState();
          
          // 設置 Upstash 配置
          syncStore.setUpstashConfig(
            info.upstash.endpoint,
            info.upstash.username,
            info.upstash.apiKey,
          );

          console.log("[Access Store] Upstash 配置已設置，準備初始化同步");

          // 初始化同步
          await syncStore.init();
          
          // 執行首次同步
          if (syncStore.cloudSync()) {
            console.log("[Access Store] 執行首次同步");
            await syncStore.sync();
            console.log("[Access Store] 首次同步完成");
          }
        }
      } catch (e) {
        console.error("[Access Store] failed to set upstash config or sync:", e);
      }
    },

    fetch() {
      if (fetchState > 0 || getClientConfigSync("buildMode", "standalone") === "export") return;
      fetchState = 1;
      
      const handleError = (error: any) => {
        console.error("[Config] failed to fetch config:", error);
        // 設置默認配置
        set(() => ({
          needCode: false,
          hideUserApiKey: false,
          hideBalanceQuery: false,
          disableGPT4: false,
          disableFastLink: false,
        }));
        fetchState = 2;
      };

      try {
        fetch("/api/config", {
          method: "post",
          body: null,
          headers: {
            ...getHeaders(),
          },
        })
          .then((res) => {
            if (!res.ok) {
              throw new Error(`HTTP error! status: ${res.status}`);
            }
            return res.json();
          })
          .then((res) => {
            const defaultModel = res.defaultModel ?? "";
            if (defaultModel !== "") {
              const [model, providerName] = getModelProvider(defaultModel);
              DEFAULT_CONFIG.modelConfig.model = model;
              DEFAULT_CONFIG.modelConfig.providerName = providerName as any;
            }
            return res;
          })
          .then((res: DangerConfig) => {
            set(() => ({ ...res }));
            fetchState = 2;
          })
          .catch(handleError);
      } catch (error) {
        handleError(error);
      }
    },

    getEffectiveOpenAIKey(): string {
      const state = get();
      
      // 檢查 key 是否為免責聲明文本
      const isDisclaimerText = (key: string) => {
        return key.includes("本AI服務使用") || key.includes("OpenAI和GoogleGemini");
      };
      
      console.log("[Access Store] 獲取有效的 OpenAI API key:", {
        useCustomConfig: state.useCustomConfig,
        hasCustomKey: !!state.openaiApiKey,
        customKeyLength: state.openaiApiKey ? state.openaiApiKey.length : 0,
        hasDefaultKey: !!state.defaultOpenaiApiKey,
        defaultKeyLength: state.defaultOpenaiApiKey ? state.defaultOpenaiApiKey.length : 0,
        isCustomKeyDisclaimer: state.openaiApiKey ? isDisclaimerText(state.openaiApiKey) : false
      });
      
      // 在開發環境中才嘗試從數據庫獲取最新的 API key
      // 在生產環境中避免無限循環
      const isDev = process.env.NODE_ENV === 'development';
      if (isDev && !state.defaultOpenaiApiKey) {
        // 嘗試從數據庫獲取最新的 API key
        // 注意：這是一個同步方法，所以我們不能直接使用 async/await
        // 我們將在後台獲取最新的 API key，並在下一次調用時使用
        this.fetchApiKeysFromDb().catch(error => {
          console.error("[Access Store] 獲取 API keys 失敗:", error);
        });
      }
      
      // 修改優先級：始終優先使用從數據庫獲取的 API key
      if (state.defaultOpenaiApiKey && state.defaultOpenaiApiKey.trim().length > 0) {
        console.log("[Access Store] 使用數據庫 API key");
        return state.defaultOpenaiApiKey.trim();
      }

      // 如果數據庫 key 不可用，且用戶設置了自定義 key，且不是免責聲明文本，則使用自定義 key
      if (state.useCustomConfig && state.openaiApiKey && 
          state.openaiApiKey.trim().length > 0 && 
          !isDisclaimerText(state.openaiApiKey)) {
        console.log("[Access Store] 使用自定義 API key (數據庫 key 不可用)");
        return state.openaiApiKey.trim();
      }

      // 如果都沒有可用的 key，返回空字符串
      console.log("[Access Store] 沒有可用的 OpenAI API key");
      return "";
    },

    // 從資料庫獲取 API key 並更新 defaultOpenaiApiKey
    async fetchApiKeyFromDb() {
      try {
        // 通過 API 請求獲取 API key，而不是直接從數據庫獲取
        const response = await fetch('/api/config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.apiKey && data.apiKey.trim().length > 0) {
            console.log("[Access Store] 從 API 獲取 OpenAI API key 成功，長度:", data.apiKey.length);
            set((state) => ({
              ...state,
              defaultOpenaiApiKey: data.apiKey.trim()
            }));
            return true;
          }
        } else {
          console.error("[Access Store] API 請求失敗:", response.status);
        }
        return false;
      } catch (error) {
        console.error("[Access Store] 從 API 獲取 API key 失敗:", error);
        return false;
      }
    },

    // 從資料庫獲取所有 API keys 並更新
    async fetchApiKeysFromDb() {
      try {
        // 通過 API 請求獲取 API keys
        const response = await fetch('/api/config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          const updates: any = {};
          
          // OpenAI 配置
          if (data.apiKey && data.apiKey.trim().length > 0) {
            console.log("[Access Store] 從 API 獲取 OpenAI API key 成功，長度:", data.apiKey.length);
            updates.defaultOpenaiApiKey = data.apiKey.trim();
          }
          
          if (data.openaiUrl && data.openaiUrl.trim().length > 0) {
            console.log("[Access Store] 從 API 獲取 OpenAI URL 成功:", data.openaiUrl);
            updates.openaiUrl = data.openaiUrl.trim();
          }
          
          if (data.openaiOrgId && data.openaiOrgId.trim().length > 0) {
            console.log("[Access Store] 從 API 獲取 OpenAI Org ID 成功:", data.openaiOrgId);
            updates.openaiOrgId = data.openaiOrgId.trim();
          }
          
          // Google 配置
          if (data.googleApiKey && data.googleApiKey.trim().length > 0) {
            console.log("[Access Store] 從 API 獲取 Google API key 成功，長度:", data.googleApiKey.length);
            updates.defaultGoogleApiKey = data.googleApiKey.trim();
          }
          
          if (data.googleUrl && data.googleUrl.trim().length > 0) {
            console.log("[Access Store] 從 API 獲取 Google URL 成功:", data.googleUrl);
            updates.googleUrl = data.googleUrl.trim();
          }
          
          if (data.googleApiVersion && data.googleApiVersion.trim().length > 0) {
            console.log("[Access Store] 從 API 獲取 Google API 版本成功:", data.googleApiVersion);
            updates.googleApiVersion = data.googleApiVersion.trim();
          }
          
          // Anthropic 配置
          if (data.anthropicApiKey && data.anthropicApiKey.trim().length > 0) {
            console.log("[Access Store] 從 API 獲取 Anthropic API key 成功，長度:", data.anthropicApiKey.length);
            updates.defaultAnthropicApiKey = data.anthropicApiKey.trim();
          }
          
          if (data.anthropicUrl && data.anthropicUrl.trim().length > 0) {
            console.log("[Access Store] 從 API 獲取 Anthropic URL 成功:", data.anthropicUrl);
            updates.anthropicUrl = data.anthropicUrl.trim();
          }
          
          if (data.anthropicApiVersion && data.anthropicApiVersion.trim().length > 0) {
            console.log("[Access Store] 從 API 獲取 Anthropic API 版本成功:", data.anthropicApiVersion);
            updates.anthropicApiVersion = data.anthropicApiVersion.trim();
          }
          
          if (Object.keys(updates).length > 0) {
            console.log("[Access Store] 更新配置:", Object.keys(updates).join(", "));
            set((state) => ({
              ...state,
              ...updates
            }));
            return true;
          }
        } else {
          console.error("[Access Store] API 請求失敗:", response.status);
        }
        return false;
      } catch (error) {
        console.error("[Access Store] 從 API 獲取配置失敗:", error);
        return false;
      }
    },

    getEffectiveGoogleKey(): string {
      const state = get();
      
      // 檢查 key 是否為免責聲明文本
      const isDisclaimerText = (key: string) => {
        return key.includes("本AI服務使用") || key.includes("OpenAI和GoogleGemini");
      };
      
      console.log("[Access Store] 獲取有效的 Google API key:", {
        useCustomConfig: state.useCustomConfig,
        hasCustomKey: !!state.googleApiKey,
        customKeyLength: state.googleApiKey ? state.googleApiKey.length : 0,
        hasDefaultKey: !!state.defaultGoogleApiKey,
        defaultKeyLength: state.defaultGoogleApiKey ? state.defaultGoogleApiKey.length : 0,
        isCustomKeyDisclaimer: state.googleApiKey ? isDisclaimerText(state.googleApiKey) : false
      });
      
      // 在開發環境中才嘗試從數據庫獲取最新的 API key
      // 在生產環境中避免無限循環
      const isDev = process.env.NODE_ENV === 'development';
      if (isDev && !state.defaultGoogleApiKey) {
        // 嘗試從數據庫獲取最新的 API key
        // 注意：這是一個同步方法，所以我們不能直接使用 async/await
        // 我們將在後台獲取最新的 API key，並在下一次調用時使用
        this.fetchApiKeysFromDb().catch(error => {
          console.error("[Access Store] 獲取 API keys 失敗:", error);
        });
      }
      
      // 修改優先級：始終優先使用從數據庫獲取的 API key
      if (state.defaultGoogleApiKey && state.defaultGoogleApiKey.trim().length > 0) {
        console.log("[Access Store] 使用數據庫 Google API key，長度:", state.defaultGoogleApiKey.trim().length);
        return state.defaultGoogleApiKey.trim();
      }

      // 如果數據庫 key 不可用，且用戶設置了自定義 key，且不是免責聲明文本，則使用自定義 key
      if (state.useCustomConfig && state.googleApiKey && 
          state.googleApiKey.trim().length > 0 && 
          !isDisclaimerText(state.googleApiKey)) {
        console.log("[Access Store] 使用自定義 Google API key (數據庫 key 不可用)，長度:", state.googleApiKey.trim().length);
        return state.googleApiKey.trim();
      }

      // 如果都沒有可用的 key，返回空字符串
      console.log("[Access Store] 沒有可用的 Google API key");
      return "";
    },

    getEffectiveAnthropicKey(): string {
      const state = get();
      
      // 檢查 key 是否為免責聲明文本
      const isDisclaimerText = (key: string) => {
        return key.includes("本AI服務使用") || key.includes("OpenAI和GoogleGemini");
      };
      
      console.log("[Access Store] 獲取有效的 Anthropic API key:", {
        useCustomConfig: state.useCustomConfig,
        hasCustomKey: !!state.anthropicApiKey,
        customKeyLength: state.anthropicApiKey ? state.anthropicApiKey.length : 0,
        hasDefaultKey: !!state.defaultAnthropicApiKey,
        defaultKeyLength: state.defaultAnthropicApiKey ? state.defaultAnthropicApiKey.length : 0,
        isCustomKeyDisclaimer: state.anthropicApiKey ? isDisclaimerText(state.anthropicApiKey) : false
      });
      
      // 在開發環境中才嘗試從數據庫獲取最新的 API key
      // 在生產環境中避免無限循環
      const isDev = process.env.NODE_ENV === 'development';
      if (isDev && !state.defaultAnthropicApiKey) {
        // 嘗試從數據庫獲取最新的 API key
        // 注意：這是一個同步方法，所以我們不能直接使用 async/await
        // 我們將在後台獲取最新的 API key，並在下一次調用時使用
        this.fetchApiKeysFromDb().catch(error => {
          console.error("[Access Store] 獲取 API keys 失敗:", error);
        });
      }
      
      // 修改優先級：始終優先使用從數據庫獲取的 API key
      if (state.defaultAnthropicApiKey && state.defaultAnthropicApiKey.trim().length > 0) {
        console.log("[Access Store] 使用數據庫 Anthropic API key，長度:", state.defaultAnthropicApiKey.trim().length);
        return state.defaultAnthropicApiKey.trim();
      }

      // 如果數據庫 key 不可用，且用戶設置了自定義 key，且不是免責聲明文本，則使用自定義 key
      if (state.useCustomConfig && state.anthropicApiKey && 
          state.anthropicApiKey.trim().length > 0 && 
          !isDisclaimerText(state.anthropicApiKey)) {
        console.log("[Access Store] 使用自定義 Anthropic API key (數據庫 key 不可用)，長度:", state.anthropicApiKey.trim().length);
        return state.anthropicApiKey.trim();
      }

      // 如果都沒有可用的 key，返回空字符串
      console.log("[Access Store] 沒有可用的 Anthropic API key");
      return "";
    },

    getEffectiveApiKey(): string {
      const state = get();
      switch (state.provider) {
        case ServiceProvider.OpenAI:
          return this.getEffectiveOpenAIKey();
        case ServiceProvider.Google:
          return this.getEffectiveGoogleKey();
        case ServiceProvider.Anthropic:
          return this.getEffectiveAnthropicKey();
        default:
          return "";
      }
    },

    isValidOpenAI(): boolean {
      return this.getEffectiveOpenAIKey().length > 0;
    },

    isValidGoogle(): boolean {
      return this.getEffectiveGoogleKey().length > 0;
    },

    isValidAnthropic(): boolean {
      return this.getEffectiveAnthropicKey().length > 0;
    },

    isValidBaidu(): boolean {
      return (this as any).baiduApiKey.length > 0 && (this as any).baiduSecretKey.length > 0;
    },

    isValidAzure(): boolean {
      return (this as any).azureApiKey.length > 0 && (this as any).azureUrl.length > 0;
    },

    startSessionCheck: () => {
      // 開始定期檢查 session
      const check = get().checkSession;
      const intervalId = setInterval(check, SESSION_CHECK_INTERVAL);
      return () => clearInterval(intervalId);
    },
  }),
  {
    name: StoreKey.Access,
    version: 2,
    migrate(persistedState, version) {
      if (version < 2) {
        const state = persistedState as {
          token: string;
          openaiApiKey: string;
          azureApiVersion: string;
          googleApiKey: string;
        };
        state.openaiApiKey = state.token;
        state.azureApiVersion = "2023-08-01-preview";
      }

      return persistedState as any;
    },
  },
);
