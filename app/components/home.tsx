"use client";

require("../polyfill");

import { useState, useEffect } from "react";
import styles from "./home.module.scss";

import BotIcon from "../icons/bot.svg";
import LoadingIcon from "../icons/three-dots.svg";

import { getCSSVar, useMobileScreen, safeLocalStorage } from "../utils";

import dynamic from "next/dynamic";
import { Path, SlotID } from "../constant";
import { ErrorBoundary } from "./error";

import { getISOLang, getLang } from "../locales";

import {
  HashRouter as Router,
  Routes,
  Route,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { SideBar } from "./sidebar";
import { useAppConfig } from "../store/config";
import { AuthPage } from "./auth";
import { getClientConfig } from "../config/client";
import { type ClientApi, getClientApi } from "../client/api";
import { useAccessStore } from "../store";
import clsx from "clsx";
import { AdminPage } from "./admin";
import { SMERegisterPage } from "./sme_register";
import { PrivacyPolicy } from "./privacy-policy";
import { OnlineStatusTracker } from "./online-status-tracker";

export function Loading(props: { noLogo?: boolean }) {
  return (
    <div className={clsx("no-dark", styles["loading-content"])}>
      {!props.noLogo && <BotIcon />}
      <LoadingIcon />
    </div>
  );
}

const Artifacts = dynamic(async () => (await import("./artifacts")).Artifacts, {
  loading: () => <Loading noLogo />,
});

const Settings = dynamic(async () => (await import("./settings")).Settings, {
  loading: () => <Loading noLogo />,
});

const Chat = dynamic(async () => (await import("./chat")).Chat, {
  loading: () => <Loading noLogo />,
});

const NewChat = dynamic(async () => (await import("./new-chat")).NewChat, {
  loading: () => <Loading noLogo />,
});

const MaskPage = dynamic(async () => (await import("./mask")).MaskPage, {
  loading: () => <Loading noLogo />,
});

const PluginPage = dynamic(async () => (await import("./plugin")).PluginPage, {
  loading: () => <Loading noLogo />,
});

const SearchChat = dynamic(
  async () => (await import("./search-chat")).SearchChatPage,
  {
    loading: () => <Loading noLogo />,
  },
);

const Sd = dynamic(async () => (await import("./sd")).Sd, {
  loading: () => <Loading noLogo />,
});

export function useSwitchTheme() {
  const config = useAppConfig();

  useEffect(() => {
    document.body.classList.remove("light");
    document.body.classList.remove("dark");

    if (config.theme === "dark") {
      document.body.classList.add("dark");
    } else if (config.theme === "light") {
      document.body.classList.add("light");
    }

    const metaDescriptionDark = document.querySelector(
      'meta[name="theme-color"][media*="dark"]',
    );
    const metaDescriptionLight = document.querySelector(
      'meta[name="theme-color"][media*="light"]',
    );

    if (config.theme === "auto") {
      metaDescriptionDark?.setAttribute("content", "#151515");
      metaDescriptionLight?.setAttribute("content", "#fafafa");
    } else {
      const themeColor = getCSSVar("--theme-color");
      metaDescriptionDark?.setAttribute("content", themeColor);
      metaDescriptionLight?.setAttribute("content", themeColor);
    }
  }, [config.theme]);
}

function useHtmlLang() {
  useEffect(() => {
    const lang = getISOLang();
    const htmlLang = document.documentElement.lang;

    if (lang !== htmlLang) {
      document.documentElement.lang = lang;
    }
  }, []);
}

const useHasHydrated = () => {
  const [hasHydrated, setHasHydrated] = useState<boolean>(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  return hasHydrated;
};

const loadAsyncGoogleFont = async () => {
  const linkEl = document.createElement("link");
  const proxyFontUrl = "/google-fonts";
  const remoteFontUrl = "https://fonts.googleapis.com";
  
  try {
    const config = await getClientConfig();
    const googleFontUrl = config.buildMode === "export" ? remoteFontUrl : proxyFontUrl;
    
    linkEl.rel = "stylesheet";
    linkEl.href =
      googleFontUrl +
      "/css2?family=" +
      encodeURIComponent("Noto Sans:wght@300;400;700;900") +
      "&display=swap";
    document.head.appendChild(linkEl);
  } catch (e) {
    console.error("[Font] failed to load Google Font:", e);
  }
};

export function WindowContent(props: { children: React.ReactNode }) {
  return (
    <div className={styles["window-content"]} id={SlotID.AppBody}>
      {props?.children}
    </div>
  );
}

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
  upstashName?: string;
  upstashEndpoint?: string;
  upstashToken?: string;
}

function Screen() {
  const config = useAppConfig();
  const location = useLocation();
  const navigate = useNavigate();
  const isArtifact = location.pathname.includes(Path.Artifacts);
  const isHome = location.pathname === Path.Home;
  const isAuth = location.pathname === Path.Auth;
  const isSd = location.pathname === Path.Sd;
  const [userRole, setUserRole] = useState<string>("");
  const [isAppMode, setIsAppMode] = useState<boolean>(false);
  const [userId, setUserId] = useState<number | null>(null);

  const isMobileScreen = useMobileScreen();
  const shouldTightBorder = isAppMode || (config.tightBorder && !isMobileScreen);

  useEffect(() => {
    const initConfig = async () => {
      try {
        const clientConfig = await getClientConfig();
        setIsAppMode(!!clientConfig.isApp);
        await loadAsyncGoogleFont();
        
        // 只在開發環境或首次加載時從數據庫獲取 API key
        const accessStore = useAccessStore.getState();
        const isDev = process.env.NODE_ENV === 'development';
        const isFirstLoad = !accessStore.defaultOpenaiApiKey && !accessStore.defaultGoogleApiKey;
        
        // 檢查是否已經有 API key
        if (isDev || isFirstLoad) {
          console.log("[Home] 嘗試從 API 獲取 API keys");
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
                console.log("[Home] 從 API 獲取到 API key，長度:", data.apiKey.length);
                accessStore.update((state) => {
                  state.defaultOpenaiApiKey = data.apiKey;
                });
                console.log("[Home] API key 來源: MySQL 數據庫 (通過 API 獲取)");
                console.log("[Home] API key 優先級: 數據庫 key > 自定義 key");
              } else {
                console.log("[Home] API 返回的數據中沒有 API key");
              }
            } else {
              console.log("[Home] API 請求失敗:", response.status);
            }
          } catch (error) {
            console.error("[Home] 獲取 API key 失敗:", error);
          }
        } else {
          console.log("[Home] 已有默認 API key，跳過 API 獲取");
          if (accessStore.defaultOpenaiApiKey) {
            console.log("[Home] 已有默認 OpenAI API key，長度:", accessStore.defaultOpenaiApiKey.length);
          }
          if (accessStore.defaultGoogleApiKey) {
            console.log("[Home] 已有默認 Google API key，長度:", accessStore.defaultGoogleApiKey.length);
          }
        }
        
        // 顯示當前有效的 API key 信息
        const effectiveKey = accessStore.getEffectiveOpenAIKey();
        console.log("[Home] 當前有效的 API key 長度:", effectiveKey ? effectiveKey.length : 0);
        console.log("[Home] 是否使用自定義配置:", accessStore.useCustomConfig);
        console.log("[Home] 是否有自定義 key:", !!accessStore.openaiApiKey);
      } catch (e) {
        console.error("[Home] init config error:", e);
      }
    };

    initConfig();
  }, [navigate, location.pathname]);

  // Get user ID for online status tracking
  useEffect(() => {
    const userInfo = localStorage.getItem("userInfo");
    if (userInfo) {
      try {
        const parsedUserInfo = JSON.parse(userInfo);
        setUserId(parsedUserInfo.user_id || null);
      } catch (error) {
        console.error("Failed to parse user info:", error);
      }
    }
  }, []);

  // 路由保護
  useEffect(() => {
    console.log("[Route Protection] Checking route:", location.pathname);
    console.log("[Route Protection] Is Privacy page:", location.pathname === Path.Privacy);
    
    // 允許訪問隱私政策頁面
    if (location.pathname === Path.Privacy) {
      console.log("[Route Protection] Allowing access to privacy policy");
      return;
    }

    // 允許訪問註冊和登入頁面
    if (location.pathname === Path.Register || location.pathname === Path.Auth) {
      console.log("[Route Protection] Allowing access to auth/register page");
      return;
    }

    const isAuthed = localStorage.getItem("isAuthed");
    const userInfo = localStorage.getItem("userInfo");
    
    console.log("[Route Protection] Auth status:", { isAuthed, hasUserInfo: !!userInfo });

    // 其他頁面需要登入
    if (!isAuthed || !userInfo) {
      console.log("[Route Protection] No auth/userInfo, redirecting to auth");
      navigate(Path.Auth);
    }
  }, [location.pathname, navigate]);

  const renderContent = () => {
    const storage = safeLocalStorage();
    const isAuthed = storage.getItem("isAuthed") === "true";
    const userInfoStr = storage.getItem("userInfo");
    const userInfo = userInfoStr ? JSON.parse(userInfoStr) : {};
    
    console.log("[Home] Auth check:", {
      isAuthed, 
      path: location.pathname,
      hasUserInfo: !!userInfoStr,
      userRole: userInfo.role
    });

    // 允許訪問隱私政策頁面，不需要登入
    if (location.pathname === Path.Privacy) {
      return <PrivacyPolicy />;
    }

    // 未登入用戶只能訪問登入和註冊頁面
    if (!isAuthed) {
      if (location.pathname === Path.Register) {
        return <SMERegisterPage />;
      }

      return <AuthPage />;
    }

    // 已登入用戶的路由處理
    if (userInfo.role === "admin") {
      if (location.pathname !== Path.Admin) {
        navigate(Path.Admin);
        return null;
      }
      return <AdminPage />;
    }

    if (location.pathname === Path.Admin) {
      navigate(Path.Home);
      return null;
    }

    if (isSd) return <Sd />;

    return (
      <>
        <SideBar
          className={clsx({
            [styles["sidebar-show"]]: isHome,
          })}
        />
        <WindowContent>
          <Routes>
            <Route path={Path.Home} element={<Chat />} />
            <Route path={Path.NewChat} element={<NewChat />} />
            <Route path={Path.Masks} element={<MaskPage />} />
            <Route path={Path.Plugins} element={<PluginPage />} />
            <Route path={Path.SearchChat} element={<SearchChat />} />
            <Route path={Path.Chat} element={<Chat />} />
            <Route path={Path.Settings} element={<Settings />} />
            <Route path={Path.Auth} element={<AuthPage />} />
            <Route path={Path.Admin} element={<AdminPage />} />
            <Route path={Path.Register} element={<SMERegisterPage />} />
            <Route path={Path.Artifacts} element={<Artifacts />} />
            <Route path={Path.Sd} element={<Sd />} />
            <Route path={Path.SearchChat} element={<SearchChat />} />
            <Route path={Path.Privacy} element={<PrivacyPolicy />} />
          </Routes>
        </WindowContent>
      </>
    );
  };

  return (
    <div
      className={clsx(styles.container, {
        [styles["tight-container"]]: shouldTightBorder,
        [styles["rtl-screen"]]: getLang() === "ar",
      })}
    >
      {userId && <OnlineStatusTracker userId={userId} />}
      {renderContent()}
    </div>
  );
}

export function useLoadData() {
  const config = useAppConfig();

  const api: ClientApi = getClientApi(config.modelConfig.providerName);

  useEffect(() => {
    (async () => {
      const models = await api.llm.models();
      config.mergeModels(models);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function Home() {
  useSwitchTheme();
  useLoadData();
  useHtmlLang();

  useEffect(() => {
    console.log("[Config] got config from build time", getClientConfig());
    useAccessStore.getState().fetch();
  }, []);

  if (!useHasHydrated()) {
    return <Loading />;
  }

  return (
    <ErrorBoundary>
      <Router>
        <Screen />
      </Router>
    </ErrorBoundary>
  );
}
