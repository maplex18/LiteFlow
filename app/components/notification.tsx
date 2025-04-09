import { useState, useEffect, useRef, useCallback } from "react";
import styles from "./notification.module.scss";
import { IconButton } from "./button";
import CloseIcon from "../icons/close.svg";
import ExpandIcon from "../icons/expand.svg";
import CollapseIcon from "../icons/collapse.svg";
import { formatDistanceToNow } from 'date-fns';
import { zhTW } from 'date-fns/locale';

export interface Notification {
  notification_id: string;
  title: string;
  content: string;
  created_at: string;
  read: boolean;
  sender_username?: string;
}

export function NotificationModal(props: {
  notifications: Notification[];
  onClose: () => void;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
}) {
  const { notifications, onClose, onMarkAsRead, onMarkAllAsRead, onClearAll } = props;
  const modalRef = useRef<HTMLDivElement>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  // 格式化時間
  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: zhTW });
    } catch (error) {
      return dateString;
    }
  };

  // 處理點擊通知
  const handleNotificationClick = (id: string) => {
    // 如果已經展開，則收起；否則展開
    setExpandedId(expandedId === id ? null : id);
    // 標記為已讀
    if (!notifications.find(n => n.notification_id === id)?.read) {
      onMarkAsRead(id);
    }
  };

  return (
    <div className={styles["notification-overlay"]}>
      <div className={styles["notification-modal"]} ref={modalRef}>
        <div className={styles["notification-header"]}>
          <div className={styles["notification-title"]}>通知</div>
          <div className={styles["notification-actions"]}>
            <button 
              className={styles["action-button"]} 
              onClick={onMarkAllAsRead}
            >
              全部已讀
            </button>

            <IconButton
              icon={<CloseIcon />}
              onClick={onClose}
              bordered
            />
          </div>
        </div>
        <div className={styles["notification-content"]}>
          {notifications.length === 0 ? (
            <div className={styles["no-notifications"]}>
              目前沒有通知
            </div>
          ) : (
            notifications.map((notification) => (
              <div 
                key={notification.notification_id} 
                className={`${styles["notification-item"]} ${notification.read ? styles["read"] : styles["unread"]} ${expandedId === notification.notification_id ? styles["expanded"] : ""}`}
                onClick={() => handleNotificationClick(notification.notification_id)}
              >
                <div className={styles["notification-item-header"]}>
                  <div className={styles["notification-item-title"]}>{notification.title}</div>
                  <div className={styles["notification-item-time"]}>{formatTime(notification.created_at)}</div>
                </div>
                <div className={styles["notification-item-content"]}>
                  {notification.content}
                </div>
                {notification.sender_username && (
                  <div className={styles["notification-item-sender"]}>
                    來自: {notification.sender_username}
                  </div>
                )}
                {/* Show expand/collapse button only if content is likely to be truncated */}
                {notification.content.length > 80 && (
                  <div 
                    className={styles["notification-item-action"]}
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedId(expandedId === notification.notification_id ? null : notification.notification_id);
                      if (!notification.read) {
                        onMarkAsRead(notification.notification_id);
                      }
                    }}
                  >
                    {expandedId === notification.notification_id ? "▲ 收起" : "▼ 展開"}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 從服務器獲取通知
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 從 localStorage 獲取用戶信息
      const userInfo = localStorage.getItem("userInfo");

      
      if (!userInfo) {
        setError("未找到用戶信息");
        return;
      }

      // 檢查用戶信息格式
      try {
        const parsedUserInfo = JSON.parse(userInfo);
      } catch (error) {
        setError("用戶信息格式錯誤");
        return;
      }

      const response = await fetch("/api/notifications", {
        headers: {
          "X-User-Info": userInfo,
        },
      });


      
      if (!response.ok) {
        throw new Error(`獲取通知失敗: ${response.status}`);
      }

      const data = await response.json();

      
      setNotifications(data.notifications);
      updateUnreadCount(data.notifications);
    } catch (err) {

      setError(err instanceof Error ? err.message : "未知錯誤");
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始加載和設置SSE連接
  useEffect(() => {
    console.log("通知組件 - useEffect 初始化");
    
    // 初始加載通知
    fetchNotifications();

    // 從 localStorage 獲取用戶信息
    const userInfoStr = localStorage.getItem("userInfo");
    const tokenStr = localStorage.getItem("token");
    
    if (!userInfoStr || !tokenStr) {
      console.log("通知組件 - 未找到用戶信息或token，不建立SSE連接");
      return;
    }

    try {
      const userInfo = JSON.parse(userInfoStr);
      const userId = userInfo.user_id;
      
      if (!userId) {
        console.log("通知組件 - 用戶ID不存在，不建立SSE連接");
        return;
      }

      console.log("通知組件 - 建立SSE連接，用戶ID:", userId);
      
      // 建立SSE連接
      const eventSource = new EventSource(
        `/api/notifications/sse?userId=${userId}&token=${tokenStr}`,
        { withCredentials: true }
      );

      // 連接成功
      eventSource.onopen = () => {
        console.log("通知組件 - SSE連接已建立");
      };

      // 接收消息
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("通知組件 - 收到SSE消息:", data);
          
          if (data.type === "new_notification") {
            console.log("通知組件 - 收到新通知:", data.notification);
            // 更新通知列表
            setNotifications(prev => [data.notification, ...prev]);
            // 更新未讀數量
            setUnreadCount(prev => prev + 1);
          }
        } catch (err) {
          console.error("通知組件 - 解析SSE消息錯誤:", err);
        }
      };

      // 錯誤處理
      eventSource.onerror = (error) => {
        console.error("通知組件 - SSE連接錯誤:", error);
        eventSource.close();
      };

      return () => {
        console.log("通知組件 - useEffect 清理，關閉SSE連接");
        eventSource.close();
      };
    } catch (err) {
      console.error("通知組件 - 建立SSE連接錯誤:", err);
    }
  }, [fetchNotifications]);

  const updateUnreadCount = (notifs: Notification[]) => {
    const count = notifs.filter(n => !n.read).length;
    setUnreadCount(count);
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      // 從 localStorage 獲取用戶信息
      const userInfo = localStorage.getItem("userInfo");
      if (!userInfo) {
        setError("未找到用戶信息");
        return;
      }

      const response = await fetch("/api/notifications", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-User-Info": userInfo,
        },
        body: JSON.stringify({ notification_id: id }),
      });

      if (!response.ok) {
        throw new Error(`標記通知失敗: ${response.status}`);
      }

      // 更新本地狀態
      const updatedNotifications = notifications.map(notification => 
        notification.notification_id === id ? { ...notification, read: true } : notification
      );
      setNotifications(updatedNotifications);
      updateUnreadCount(updatedNotifications);
    } catch (err) {
      console.error("標記通知錯誤:", err);
      setError(err instanceof Error ? err.message : "未知錯誤");
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      // 從 localStorage 獲取用戶信息
      const userInfo = localStorage.getItem("userInfo");
      if (!userInfo) {
        setError("未找到用戶信息");
        return;
      }

      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: {
          "X-User-Info": userInfo,
        },
      });

      if (!response.ok) {
        throw new Error(`標記所有通知失敗: ${response.status}`);
      }

      // 更新本地狀態
      const updatedNotifications = notifications.map(notification => ({ ...notification, read: true }));
      setNotifications(updatedNotifications);
      updateUnreadCount(updatedNotifications);
    } catch (err) {
      console.error("標記所有通知錯誤:", err);
      setError(err instanceof Error ? err.message : "未知錯誤");
    }
  };

  const handleClearAll = () => {
    // 目前僅清除前端顯示，不刪除數據庫中的通知
    setNotifications([]);
    updateUnreadCount([]);
  };

  const toggleModal = () => {
    setShowModal(!showModal);
    if (!showModal) {
      // 打開模態框時刷新通知
      fetchNotifications();
    }
  };

  return {
    notifications,
    showModal,
    unreadCount,
    loading,
    error,
    toggleModal,
    handleMarkAsRead,
    handleMarkAllAsRead,
    handleClearAll,
    refreshNotifications: fetchNotifications,
    closeModal: () => setShowModal(false),
  };
} 