import styles from "./auth.module.scss";
import { IconButton } from "./button";
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Path } from "../constant";
import BotIcon from "../icons/bot.svg";
import { Input } from "./ui-lib";
import LoadingIcon from "../icons/three-dots.svg";
import sha256 from "crypto-js/sha256";
import { useAccessStore, SESSION_CHECK_INTERVAL } from "../store/access";
import { PasswordInput } from "./ui-lib";
import { showToast } from "./ui-lib";
import { useSyncStore } from "../store/sync";
import { StoreKey } from "../constant";
import { getLocalAppState, AppState } from "../utils/sync";
import Image from "next/image";
import { safeLocalStorage } from "../utils";

interface UserInfo {
  user_id: number;
  username: string;
  role: string;
  language: string;
  email?: string;
  phone?: string;
  created_at?: string;
  last_login?: string;
  status?: string;
  department?: string;
  position?: string;
}

function LoadingAnimation({ message }: { message: string }) {
  const [dots, setDots] = useState("");
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev.length >= 3) return "";
        return prev + ".";
      });
    }, 500);
    
    return () => clearInterval(interval);
  }, []);
  
  // 根據消息設置進度
  useEffect(() => {
    if (message.includes("驗證登入")) {
      setProgress(20);
    } else if (message.includes("儲存登入")) {
      setProgress(40);
    } else if (message.includes("初始化")) {
      setProgress(60);
    } else if (message.includes("同步")) {
      setProgress(80);
    } else if (message.includes("載入完成")) {
      setProgress(100);
    }
  }, [message]);
  
  return (
    <div className={styles["loading-container"]}>
      <div className={styles["loading-content"]}>
        <div className={styles["loading-icon"]}>
          <BotIcon />
        </div>
        <div className={styles["loading-spinner"]}>
          <LoadingIcon />
        </div>
        <div className={styles["loading-text"]}>
          {message}{dots}
        </div>
        <div className={styles["loading-progress"]}>
          <div 
            className={styles["loading-progress-bar"]} 
            style={{ 
              width: `${progress}%`,
              animation: progress === 100 ? 'none' : undefined,
              left: 0
            }}
          ></div>
        </div>
      </div>
    </div>
  );
}

export function AuthPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("正在同步您的資料...");
  const [connectionStatus, setConnectionStatus] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const accessStore = useAccessStore();
  const [showForceLoginModal, setShowForceLoginModal] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<number | null>(null);
  const [loadingStage, setLoadingStage] = useState<string>("");
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");

  // 添加 session 檢查
  useEffect(() => {
    const accessStore = useAccessStore.getState();
    const cleanup = accessStore.startSessionCheck();
    return () => cleanup();
  }, []);

  const handleLogin = async (forceLogin: boolean = false) => {
    if (!username || !password) {
      setErrorMessage("請輸入使用者名稱和密碼");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    setConnectionStatus("正在連線...");
    setShowLoadingOverlay(true);

    try {
      // 對密碼進行 SHA-256 加密
      const hashedPassword = sha256(password).toString();

      // 第一階段：驗證登入
      setLoadingStage("驗證登入資訊");
      setLoadingMessage("驗證登入資訊");
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          username, 
          password: hashedPassword, 
          forceLogin 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409 && data.requireForceLogin) {
          setShowForceLoginModal(true);
          setPendingUserId(data.userId);
          setConnectionStatus("");
          setIsLoading(false);
          setShowLoadingOverlay(false);
          return;
        }
        throw new Error(data.message || "登入失敗");
      }

      // 第二階段：儲存登入資訊
      setLoadingStage("儲存登入資訊");
      setLoadingMessage("儲存登入資訊");
      
      // 使用 safeLocalStorage 儲存登入資訊
      const storage = safeLocalStorage();
      
      if (!data.user || !data.user.sessionToken) {
        console.error("[Auth] 登入回應缺少 sessionToken");
        throw new Error("登入失敗：缺少 session token");
      }
      
      // 記錄 token 資訊以便追蹤
      console.log("[Auth] 儲存 token 資訊:", {
        tokenLength: data.user.sessionToken.length,
        tokenPrefix: data.user.sessionToken.substring(0, 5) + "..." + data.user.sessionToken.substring(data.user.sessionToken.length - 5)
      });
      
      storage.setItem("token", data.user.sessionToken);
      storage.setItem("isAuthed", "true");
      storage.setItem("userInfo", JSON.stringify({
        ...data.user,
        upstashName: data.upstash?.username,
        upstashEndpoint: data.upstash?.endpoint,
        upstashToken: data.upstash?.apiKey,
      }));

      console.log("[Auth] 登錄成功，獲取到的數據:", {
        hasUser: !!data.user,
        hasUpstash: !!data.upstash,
        hasOpenAIKey: !!data.openaiApiKey,
        openAIKeyLength: data.openaiApiKey ? data.openaiApiKey.length : 0
      });

      const accessStore = useAccessStore.getState();
      await accessStore.setIsAuthed(true);
      await accessStore.setUserInfo(data);

      // 確保 API key 被正確設置
      if (data.openaiApiKey) {
        console.log("[Auth] 設置 OpenAI API key，長度:", data.openaiApiKey.length);
        accessStore.update((state) => {
          state.defaultOpenaiApiKey = data.openaiApiKey;
        });
        
        // 記錄 API key 來源
        console.log("[Auth] API key 來源: MySQL 數據庫 (通過登錄獲取)");
        console.log("[Auth] API key 優先級: 數據庫 key > 自定義 key");
      } else {
        console.log("[Auth] 沒有從服務器獲取到 OpenAI API key，嘗試從 API 獲取");
        
        // 嘗試從 API 獲取
        try {
          const apiResponse = await fetch('/api/config', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            }
          });
          
          if (apiResponse.ok) {
            const apiData = await apiResponse.json();
            if (apiData.apiKey) {
              console.log("[Auth] 從 API 獲取到 API key，長度:", apiData.apiKey.length);
              accessStore.update((state) => {
                state.defaultOpenaiApiKey = apiData.apiKey;
              });
              
              // 記錄 API key 來源
              console.log("[Auth] API key 來源: MySQL 數據庫 (通過 API 請求)");
              console.log("[Auth] API key 優先級: 數據庫 key > 自定義 key");
            } else {
              console.log("[Auth] API 返回的數據中沒有 API key");
            }
          } else {
            console.log("[Auth] API 請求失敗:", apiResponse.status);
          }
        } catch (error) {
          console.error("[Auth] API 請求出錯:", error);
        }
      }

      // 顯示當前有效的 API key 信息
      const effectiveKey = accessStore.getEffectiveOpenAIKey();
      console.log("[Auth] 當前有效的 API key 長度:", effectiveKey ? effectiveKey.length : 0);
      console.log("[Auth] 是否使用自定義配置:", accessStore.useCustomConfig);
      console.log("[Auth] 是否有自定義 key:", !!accessStore.openaiApiKey);

      // 第三階段：開始檢查 session
      setLoadingStage("初始化系統");
      setLoadingMessage("初始化系統");
      const cleanup = accessStore.startSessionCheck();

      // 第四階段：同步資料
      setLoadingStage("同步使用者資料");
      setLoadingMessage("同步使用者資料");
      setIsSyncing(true);
      try {
        const syncStore = useSyncStore.getState();
        
        // 設置 Upstash 配置
        if (data.upstash) {
          console.log("[Auth] 設置 Upstash 配置");
          syncStore.setUpstashConfig(
            data.upstash.endpoint,
            data.upstash.username,
            data.upstash.apiKey
          );
        }
        
        // 記錄當前 API key 狀態
        console.log("[Auth] 同步前的 API Key 狀態:", {
          hasDefaultKey: !!accessStore.defaultOpenaiApiKey,
          defaultKeyLength: accessStore.defaultOpenaiApiKey ? accessStore.defaultOpenaiApiKey.length : 0,
          useCustomConfig: accessStore.useCustomConfig,
          hasCustomKey: !!accessStore.openaiApiKey,
          customKeyLength: accessStore.openaiApiKey ? accessStore.openaiApiKey.length : 0
        });
        
        // 初始化同步
        console.log("[Auth] 初始化同步");
        await syncStore.init();
        
        // 執行同步
        if (syncStore.cloudSync()) {
          console.log("[Auth] 執行同步");
          await syncStore.sync();
          console.log("[Auth] 同步完成");
        }
      } catch (error) {
        console.error("Sync error:", error);
        // 即使同步失敗，也繼續登入流程
      }
      
      // 第五階段：載入完成，導向頁面
      setLoadingStage("載入完成");
      setLoadingMessage("載入完成");
      
      // 根據角色導向不同頁面
      if (data.user.role === "admin") {
        navigate(Path.Admin);
      } else {
        navigate(Path.Home);
      }
      
    } catch (error) {
      console.error("[Auth] 登入失敗:", error);
      setErrorMessage(error instanceof Error ? error.message : "登入失敗，請稍後再試");
      setConnectionStatus("");
      setIsLoading(false);
      setShowLoadingOverlay(false);
    }
  };

  const handleForceLogin = async () => {
    setShowForceLoginModal(false);
    await handleLogin(true);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading) {
      handleLogin();
    }
  };

  return (
    <div className={styles["auth-container"]}>
        <div className={styles["auth-left"]}>
           
            <div className={styles["headline"]}>
                <h1>LeoPilot</h1>
            </div>
            <div className={styles["social-links"]}>
                <div className={styles["ai-services"]}>
                    <Image
                        src="/icons/claude-96.png"
                        alt="Claude AI"
                        width={40}
                        height={40}
                        className={styles["ai-icon"]}
                    />
                    <Image
                        src="/icons/chatgpt.svg"
                        alt="ChatGPT"
                        width={40}
                        height={40}
                        className={styles["ai-icon"]}
                    />
                    <Image
                        src="/icons/google-gemini.png"
                        alt="Google Gemini"
                        width={40}
                        height={40}
                        className={styles["ai-icon"]}
                    />
                </div>
            </div>
        </div>

        <div className={styles["auth-right"]}>
            <div className={styles["auth-card"]}>
                <div className={styles["auth-card-header"]}>
                    <Image
                        src="/icons/LeosysLogo.png"
                        alt="Leosys Logo"
                        width={100}
                        height={100}
                        priority
                        className={styles["auth-logo"]}
                    />
                    <h1>Sign In</h1>
                </div>
                <div className={styles["auth-form"]}>
                    <Input
                        className={styles["auth-input"]}
                        value={username}
                        type="text"
                        placeholder="Username"
                        onChange={(e) => setUsername(e.currentTarget.value)}
                        onKeyPress={handleKeyPress}
                        disabled={isLoading}
                    />

                    <PasswordInput
                        className={styles["auth-input"]}
                        value={password}
                        placeholder="Password"
                        onChange={(e) => setPassword(e.currentTarget.value)}
                        onKeyPress={handleKeyPress}
                        disabled={isLoading}
                    />

                    <IconButton
                        text={isLoading ? "登入中..." : "Sign in"}
                        type="primary"
                        onClick={() => handleLogin()}
                        disabled={isLoading}
                        icon={isLoading ? <LoadingIcon /> : undefined}
                        className={styles["login-button"]}
                    />

                    {errorMessage && (
                        <div className={styles["auth-error"]}>{errorMessage}</div>
                    )}

                    {connectionStatus && (
                        <div className={styles["auth-status"]}>{connectionStatus}</div>
                    )}

                    <div className={styles["ai-disclaimer"]}>
                        無自動決策功能宣告，AI系統僅作為輔助工具，提供建議決策參考，最終決策，仍須由客戶使用者(人類)做最終決策
                    </div>

                    <div className={styles["auth-footer"]}>
                        <div 
                            className={styles["privacy-link"]}
                            onClick={() => {
                                console.log("[Privacy Link] Clicked");
                                console.log("[Privacy Link] Current Path:", window.location.pathname);
                                console.log("[Privacy Link] Target Path:", Path.Privacy);
                                navigate(Path.Privacy);
                                console.log("[Privacy Link] Navigation triggered");
                            }}
                            role="button"
                            tabIndex={0}
                        >
                            隱私政策
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Loading Overlay */}
        {showLoadingOverlay && (
          <LoadingAnimation message={loadingMessage} />
        )}

        {/* Force Login Modal */}
        {showForceLoginModal && (
          <div className={styles["force-login-modal-overlay"]}>
            <div className={styles["force-login-modal"]}>
              <div className={styles["modal-header"]}>
                <h3>此帳號已在其他裝置登入</h3>
                <button onClick={() => setShowForceLoginModal(false)}>&times;</button>
              </div>
              <div className={styles["modal-content"]}>
                <p>是否要強制登入？這將會導致其他裝置被登出。</p>
              </div>
              <div className={styles["modal-footer"]}>
                <button 
                  className={styles["cancel-button"]} 
                  onClick={() => setShowForceLoginModal(false)}
                >
                  取消
                </button>
                <button 
                  className={styles["force-button"]}
                  onClick={handleForceLogin}
                >
                  強制登入
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

export async function handleLogout() {
  try {
    const storage = safeLocalStorage();
    const userInfo = JSON.parse(storage.getItem("userInfo") || "{}");
    const sessionToken = storage.getItem("token");

    if (userInfo.role !== "admin") {
      showToast("正在同步資料...");
      const syncStore = useSyncStore.getState();
      await syncStore.sync();
    }
    
    // 清除 session token
    try {
      await fetch("/api/auth", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: userInfo.user_id,
          sessionToken
        }),
      });
    } catch (error) {
      console.error("Error clearing session:", error);
    }
    
    // Clear localStorage
    storage.clear();
    
    // Clear IndexedDB stores
    const stores = [StoreKey.Config, StoreKey.Chat, StoreKey.Access, StoreKey.Mask, StoreKey.Prompt, StoreKey.Sync];
    
    // Clear each store's data
    const clearStoreData = async (storeName: string) => {
      return new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(storeName);
        
        request.onerror = () => {
          console.error(`[Logout] Failed to open IndexedDB store: ${storeName}`);
          resolve();
        };
        
        request.onsuccess = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          try {
            const transaction = db.transaction(storeName, 'readwrite');
            const objectStore = transaction.objectStore(storeName);
            const clearRequest = objectStore.clear();
            
            clearRequest.onsuccess = () => {
              console.log(`[Logout] Cleared IndexedDB store: ${storeName}`);
              db.close();
              resolve();
            };
            
            clearRequest.onerror = () => {
              console.error(`[Logout] Failed to clear IndexedDB store: ${storeName}`);
              db.close();
              resolve();
            };
          } catch (e) {
            console.error(`[Logout] Error clearing IndexedDB store ${storeName}:`, e);
            db.close();
            resolve();
          }
        };
      });
    };
    
    // Clear all stores
    await Promise.all(stores.map(clearStoreData));
    
    const accessStore = (await import("../store/access")).useAccessStore.getState();
    accessStore.setIsAuthed(false);
    accessStore.setUserInfo(null);
    
    const chatStore = (await import("../store/chat")).useChatStore.getState();
    chatStore.clearAllData();
    
    const promptStore = (await import("../store/prompt")).usePromptStore.getState();
    const userPrompts = promptStore.getUserPrompts();
    userPrompts.forEach(prompt => {
      if (prompt.id) promptStore.remove(prompt.id);
    });
    
    showToast("登出成功");
    
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  } catch (error) {
    console.error("[Logout] Error:", error);
    showToast("登出時發生錯誤，請重試");
  }
}
