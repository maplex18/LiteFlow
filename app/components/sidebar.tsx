import React, { useEffect, useRef, useMemo, useState, Fragment } from "react";

import styles from "./home.module.scss";
import sidebarStyles from "./sidebar.module.scss";

import { IconButton } from "./button";
import SettingsIcon from "../icons/settings.svg";
// import GithubIcon from "../icons/github.svg";
import LeoGptIcon from "../icons/Leosys Logo.svg";
import AddIcon from "../icons/add.svg";
import DeleteIcon from "../icons/delete.svg";
import DragIcon from "../icons/drag.svg";
import DiscoveryIcon from "../icons/discovery.svg";
import LogoutIcon from "../icons/logout.svg";
import CloudSuccessIcon from "../icons/cloud-success.svg";
import CloudFailIcon from "../icons/cloud-fail.svg";
import LoadingIcon from "../icons/three-dots.svg";
import ResetIcon from "../icons/reload.svg";
import TemplateIcon from "../icons/mask.svg";

import Locale from "../locales";

import {
  useAppConfig,
  useChatStore,
  useSyncStore,
  useAccessStore,
} from "../store";

import {
  DEFAULT_SIDEBAR_WIDTH,
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  NARROW_SIDEBAR_WIDTH,
  Path,
  PLUGINS,
  // REPO_URL,
} from "../constant";

import { Link, useNavigate } from "react-router-dom";
import { isIOS, useMobileScreen } from "../utils";
import dynamic from "lite/dynamic";
import { showConfirm, Selector, showToast } from "./ui-lib";
import clsx from "clsx";
import { handleLogout } from "./auth";
import { NotificationModal, useNotifications } from "./notification";
import { NotificationButton } from "./notification-button";

const ChatList = dynamic(async () => (await import("./chat-list")).ChatList, {
  loading: () => null,
});

export function useHotKey() {
  const chatStore = useChatStore();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey) {
        if (e.key === "ArrowUp") {
          chatStore.liteSession(-1);
        } else if (e.key === "ArrowDown") {
          chatStore.liteSession(1);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });
}

export function useDragSideBar() {
  const limit = (x: number) => Math.min(MAX_SIDEBAR_WIDTH, x);

  const config = useAppConfig();
  const startX = useRef(0);
  const startDragWidth = useRef(config.sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH);
  const lastUpdateTime = useRef(Date.now());

  const toggleSideBar = () => {
    config.update((config) => {
      if (config.sidebarWidth < MIN_SIDEBAR_WIDTH) {
        config.sidebarWidth = DEFAULT_SIDEBAR_WIDTH;
      } else {
        config.sidebarWidth = NARROW_SIDEBAR_WIDTH;
      }
    });
  };

  const onDragStart = (e: MouseEvent) => {
    // Remembers the initial width each time the mouse is pressed
    startX.current = e.clientX;
    startDragWidth.current = config.sidebarWidth;
    const dragStartTime = Date.now();

    const handleDragMove = (e: MouseEvent) => {
      if (Date.now() < lastUpdateTime.current + 20) {
        return;
      }
      lastUpdateTime.current = Date.now();
      const d = e.clientX - startX.current;
      const liteWidth = limit(startDragWidth.current + d);
      config.update((config) => {
        if (liteWidth < MIN_SIDEBAR_WIDTH) {
          config.sidebarWidth = NARROW_SIDEBAR_WIDTH;
        } else {
          config.sidebarWidth = liteWidth;
        }
      });
    };

    const handleDragEnd = () => {
      // In useRef the data is non-responsive, so `config.sidebarWidth` can't get the dynamic sidebarWidth
      window.removeEventListener("pointermove", handleDragMove);
      window.removeEventListener("pointerup", handleDragEnd);

      // if user click the drag icon, should toggle the sidebar
      const shouldFireClick = Date.now() - dragStartTime < 300;
      if (shouldFireClick) {
        toggleSideBar();
      }
    };

    window.addEventListener("pointermove", handleDragMove);
    window.addEventListener("pointerup", handleDragEnd);
  };

  const isMobileScreen = useMobileScreen();
  const shouldNarrow =
    !isMobileScreen && config.sidebarWidth < MIN_SIDEBAR_WIDTH;

  useEffect(() => {
    const barWidth = shouldNarrow
      ? NARROW_SIDEBAR_WIDTH
      : limit(config.sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH);
    const sideBarWidth = isMobileScreen ? "100vw" : `${barWidth}px`;
    document.documentElement.style.setProperty("--sidebar-width", sideBarWidth);
  }, [config.sidebarWidth, isMobileScreen, shouldNarrow]);

  return {
    onDragStart,
    shouldNarrow,
  };
}

export function SideBarContainer(props: {
  children: React.ReactNode;
  onDragStart: (e: MouseEvent) => void;
  shouldNarrow: boolean;
  className?: string;
}) {
  const isMobileScreen = useMobileScreen();
  const isIOSMobile = useMemo(
    () => isIOS() && isMobileScreen,
    [isMobileScreen],
  );
  const { children, className, onDragStart, shouldNarrow } = props;
  return (
    <div
      className={clsx(styles.sidebar, className, {
        [styles["narrow-sidebar"]]: shouldNarrow,
      })}
      style={{
        // #3016 disable transition on ios mobile screen
        transition: isMobileScreen && isIOSMobile ? "none" : undefined,
      }}
    >
      {children}
      <div
        className={styles["sidebar-drag"]}
        onPointerDown={(e) => onDragStart(e as any)}
      >
        <DragIcon />
      </div>
    </div>
  );
}

export function SideBarHeader(props: {
  title?: string | React.ReactNode;
  subTitle?: string | React.ReactNode;
  logo?: React.ReactNode;
  children?: React.ReactNode;
  shouldNarrow?: boolean;
}) {
  const { title, subTitle, logo, children, shouldNarrow } = props;
  const accessStore = useAccessStore();
  const syncStore = useSyncStore();
  const username = accessStore.userInfo?.user?.username;
  const [hasInitialSync, setHasInitialSync] = useState(false);

  // 當使用者登入後只自動同步一次
  useEffect(() => {
    const autoSync = async () => {
      if (username && !hasInitialSync) {
        try {
          console.log("[Auto Sync] Starting initial sync after login");
          await syncStore.sync();
          setHasInitialSync(true);
          showToast(Locale.Settings.Sync.Success);
        } catch (e) {
          console.error("[Auto Sync] Failed:", e);
          showToast(Locale.Settings.Sync.Fail);
        }
      }
    };
    autoSync();
  }, [username, syncStore, hasInitialSync]);

  return (
    <Fragment>
      <div
        className={clsx(styles["sidebar-header"], {
          [styles["sidebar-header-narrow"]]: shouldNarrow,
        })}
        data-tauri-drag-region
      >
        <div className={styles["sidebar-title-container"]}>
          <div className={styles["sidebar-title"]} data-tauri-drag-region>
            {title}
          </div>
          {/* <div className={styles["sidebar-sub-title"]}>{subTitle}</div> */}
          {username && (
            <div className={sidebarStyles["sidebar-user-card"]}>
              <div className={sidebarStyles["sidebar-user-avatar"]}>
                {username.charAt(0).toUpperCase()}
              </div>
              <div className={sidebarStyles["sidebar-user-info"]}>
                <div className={sidebarStyles["sidebar-username"]}>{username}</div>
                <div className={sidebarStyles["sidebar-user-status"]}>Online</div>
              </div>
            </div>
          )}
        </div>
        <div className={clsx(styles["sidebar-logo"], "no-dark")}>{logo}</div>
      </div>
      {children}
    </Fragment>
  );
}

export function SideBarBody(props: {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
}) {
  const { onClick, children } = props;
  return (
    <div className={styles["sidebar-body"]} onClick={onClick}>
      {children}
    </div>
  );
}

function ConnectionStatus() {
  const syncStore = useSyncStore();
  const [status, setStatus] = useState<
    "connected" | "disconnected" | "checking"
  >("checking");

  useEffect(() => {
    const checkConnection = async () => {
      try {
        setStatus("checking");

        const isConnected = await syncStore.check();
        setStatus(isConnected ? "connected" : "disconnected");
      } catch (error) {
        // console.error("[Upstash] Connection error:", error);
        setStatus("disconnected");
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 300000);

    return () => clearInterval(interval);
  }, [syncStore]);

  const getIcon = () => {
    switch (status) {
      case "connected":
        return <CloudSuccessIcon />;
      case "disconnected":
        return <CloudFailIcon />;
      case "checking":
        return <LoadingIcon />;
    }
  };

  return (
    <div className={styles["connection-status"]}>
      <IconButton
        icon={getIcon()}
        text={
          status === "connected"
            ? "已連線"
            : status === "checking"
            ? "檢查中..."
            : "未連線"
        }
        className={clsx(styles["connection-icon"], {
          [styles.connected]: status === "connected",
          [styles.disconnected]: status === "disconnected",
          [styles.checking]: status === "checking",
        })}
        onClick={() => {
          // console.log("[Upstash] Current connection status:", status);
          // console.log("[Upstash] Current config:", {
          //   endpoint: syncStore.upstash.endpoint,
          //   username: syncStore.upstash.username,
          //   hasApiKey: !!syncStore.upstash.apiKey,
          // });
        }}
      />
    </div>
  );
}

function SidebarSyncButton() {
  const syncStore = useSyncStore();
  const [syncState, setSyncState] = useState<
    "none" | "syncing" | "success" | "failed"
  >("none");

  const sync = async () => {
    if (syncState === "syncing") return; // 如果正在同步中，不執行任何操作

    setSyncState("syncing");
    try {
      await syncStore.sync();
      setSyncState("success");
      showToast(Locale.Settings.Sync.Success);
      setTimeout(() => setSyncState("none"), 2000);
    } catch (e) {
      setSyncState("failed");
      showToast(Locale.Settings.Sync.Fail);
      console.error("[Sync]", e);
      setTimeout(() => setSyncState("none"), 2000);
    }
  };

  return (
    <div className={styles["sidebar-action"]}>
      <IconButton
        icon={
          syncState === "none" ? (
            <ResetIcon />
          ) : syncState === "syncing" ? (
            <div className={styles["sync-loading-icon"]}>
              <ResetIcon />
            </div>
          ) : syncState === "success" ? (
            <CloudSuccessIcon />
          ) : (
            <CloudFailIcon />
          )
        }
        onClick={sync}
        bordered
        disabled={syncState === "syncing"}
        title={
          syncState === "syncing"
            ? "同步中..."
            : Locale.Settings.Sync.Config.Modal.Title
        }
      />
    </div>
  );
}

export function SideBarTail(props: {
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
}) {
  const navigate = useNavigate();
  const chatStore = useChatStore();

  const { primaryAction, secondaryAction } = props;

  return (
    <div className={styles["sidebar-tail"]}>
      <div className={styles["sidebar-actions"]}>
        {primaryAction}
        <div className={styles["sidebar-action"]}>
          <IconButton
            text="登出"
            onClick={handleLogout}
            shadow
          />
        </div>
      </div>
      <div className={styles["sidebar-actions"]}>
        <ConnectionStatus />
        {secondaryAction}
      </div>
    </div>
  );
}

export function SideBar(props: { className?: string }) {
  useHotKey();
  const chatStore = useChatStore();
  const accessStore = useAccessStore();
  const syncStore = useSyncStore();

  const config = useAppConfig();
  const navigate = useNavigate();
  const isMobileScreen = useMobileScreen();
  const isLogin = accessStore.isAuthorized();

  const { shouldNarrow, onDragStart } = useDragSideBar();

  // 使用通知 hook
  const {
    notifications,
    showModal,
    unreadCount,
    toggleModal,
    closeModal,
    handleMarkAsRead,
    handleMarkAllAsRead,
    handleClearAll,
  } = useNotifications();
  
  // 添加回被刪除的狀態
  const [showPluginSelector, setShowPluginSelector] = useState(false);
  
  const shouldHideBarWithMask = useMemo(
    () => isMobileScreen,
    [isMobileScreen],
  );

  return (
    <>
      <SideBarContainer
        onDragStart={onDragStart}
        shouldNarrow={shouldNarrow}
        {...props}
      >
        <SideBarHeader
          title="LeoPilot Lite"
          subTitle="建立專屬你的 AI 行銷大獅"
          logo={<LeoGptIcon />}
          shouldNarrow={shouldNarrow}
        >
          <div className={styles["sidebar-header-bar"]}>
            <div onClick={toggleModal}>
              <NotificationButton 
                text={shouldNarrow ? undefined : "通知"}
                className={styles["sidebar-bar-button"]}
              />
            </div>
            <IconButton
              icon={<AddIcon />}
              text={shouldNarrow ? undefined : Locale.Home.NewChat}
              className={styles["sidebar-bar-button"]}
              onClick={() => {
                navigate(Path.NewChat);
              }}
              shadow
            />
            <IconButton
              icon={<TemplateIcon />}
              text={shouldNarrow ? undefined : "大師範本"}
              className={styles["sidebar-bar-button"]}
              onClick={() => {
                // 導航到範本頁面
                navigate(Path.Masks);
              }}
              shadow
            />
          </div>
        </SideBarHeader>
        <SideBarBody
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              navigate(Path.Home);
            }
          }}
        >
          <ChatList narrow={shouldNarrow} />
        </SideBarBody>
        <SideBarTail
          primaryAction={
            <>
              <div className={clsx(styles["sidebar-action"], styles.mobile)}>
                <IconButton
                  icon={<DeleteIcon />}
                  onClick={async () => {
                    if (await showConfirm(Locale.Home.DeleteChat)) {
                      chatStore.deleteSession(chatStore.currentSessionIndex);
                    }
                  }}
                />
              </div>
              {/* <div className={styles["sidebar-action"]}>
                <Link to={Path.Masks}>
                  <IconButton
                    icon={<TemplateIcon />}
                    text={shouldNarrow ? undefined : "模板"}
                    shadow
                    title="模板庫"
                  />
                </Link>
              </div> */}
              <div className={styles["sidebar-action"]}>
                <Link to={Path.Settings}>
                  <IconButton
                    aria={Locale.Settings.Title}
                    icon={<SettingsIcon />}
                    shadow
                  />
                </Link>
              </div>
              <SidebarSyncButton />
            </>
          }
          // secondaryAction={<ConnectionStatus />}
        />
      </SideBarContainer>
      
      {/* 將通知模態框移到 SideBar 組件外部 */}
      {showModal && (
        <NotificationModal
          notifications={notifications}
          onClose={closeModal}
          onMarkAsRead={handleMarkAsRead}
          onMarkAllAsRead={handleMarkAllAsRead}
          onClearAll={handleClearAll}
        />
      )}
    </>
  );
}
