import React, { useState, useEffect, useCallback, useRef } from "react";
import styles from "./admin.module.scss";
import { IconButton } from "./button";
import AddIcon from "../icons/add.svg";
import DeleteIcon from "../icons/delete.svg";
import { format, formatDistanceToNow } from 'date-fns';
import { zhTW } from 'date-fns/locale';

// Debounce utility function
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

interface User {
  user_id: number;
  username: string;
  role: string;
}

interface Notification {
  notification_id: number;
  title: string;
  content: string;
  created_at: string;
  sender_id: number;
  recipient_id: number | null;
  read: boolean;
  sender_username: string;
  recipient_username: string | null;
}

interface AdminNotificationsProps {
  currentUser: User | null;
}

export function AdminNotifications({ currentUser }: AdminNotificationsProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<number | null>(null);
  
  // Track API request states
  const isRequestInProgressRef = useRef({
    fetchNotifications: false,
    fetchUsers: false,
    deleteNotification: false,
    sendNotification: false
  });
  
  // Track last request time to prevent too frequent calls
  const lastRequestTimeRef = useRef({
    fetchNotifications: 0,
    fetchUsers: 0,
    deleteNotification: 0,
    sendNotification: 0
  });
  
  // 新通知表單
  const [showAddModal, setShowAddModal] = useState(false);
  const [newNotification, setNewNotification] = useState({
    title: "",
    content: "",
    recipient_id: "",
  });
  
  // Throttle helper function
  const shouldThrottle = (action: keyof typeof lastRequestTimeRef.current, minInterval = 2000) => {
    const now = Date.now();
    if (now - lastRequestTimeRef.current[action] < minInterval) {
      console.log(`[Notifications] Throttling ${action}, too frequent`);
      return true;
    }
    
    if (isRequestInProgressRef.current[action]) {
      console.log(`[Notifications] ${action} already in progress`);
      return true;
    }
    
    lastRequestTimeRef.current[action] = now;
    isRequestInProgressRef.current[action] = true;
    return false;
  };

  // 獲取所有通知
  const fetchNotifications = useCallback(async (retryCount = 0, maxRetries = 3) => {
    if (shouldThrottle('fetchNotifications')) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // 添加時間戳防止緩存
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/admin/notifications?t=${timestamp}`);
      
      if (!response.ok) {
        throw new Error(`獲取通知失敗: ${response.status}`);
      }
      
      // 檢查內容類型
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(`無效的響應格式: ${contentType}`);
      }
      
      const data = await response.json();
      setNotifications(data.notifications || []);
    } catch (err) {
      console.error("獲取通知錯誤:", err);
      setError(err instanceof Error ? err.message : "未知錯誤");
      
      // 重試機制
      if (retryCount < maxRetries) {
        const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 10000);
        console.log(`嘗試重新獲取通知... (${retryCount + 1}/${maxRetries}) 延遲: ${retryDelay}ms`);
        
        setTimeout(() => {
          // Reset the in-progress state before retry
          isRequestInProgressRef.current.fetchNotifications = false;
          fetchNotifications(retryCount + 1, maxRetries);
        }, retryDelay);
      }
    } finally {
      setLoading(false);
      // Reset after a delay
      setTimeout(() => {
        isRequestInProgressRef.current.fetchNotifications = false;
      }, 500);
    }
  }, []);

  // Create debounced version
  const debouncedFetchNotifications = useCallback(
    debounce(() => {
      fetchNotifications();
    }, 300),
    [fetchNotifications]
  );

  // 獲取用戶列表
  const fetchUsers = useCallback(async (retryCount = 0, maxRetries = 3) => {
    if (shouldThrottle('fetchUsers')) return;
    
    try {
      // 添加時間戳防止緩存
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/admin/users?t=${timestamp}`);
      
      if (!response.ok) {
        throw new Error(`獲取用戶失敗: ${response.status}`);
      }
      
      // 檢查內容類型
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(`無效的響應格式: ${contentType}`);
      }
      
      const data = await response.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error("獲取用戶錯誤:", err);
      
      // 如果是數據庫連接錯誤或其他錯誤，嘗試重新連接
      if (retryCount < maxRetries) {
        const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 10000); // 指數退避，最大10秒
        console.log(`嘗試重新獲取用戶... (${retryCount + 1}/${maxRetries}) 延遲: ${retryDelay}ms`);
        
        setTimeout(() => {
          // Reset the in-progress state before retry
          isRequestInProgressRef.current.fetchUsers = false;
          fetchUsers(retryCount + 1, maxRetries);
        }, retryDelay);
      }
    } finally {
      // Reset after a delay
      setTimeout(() => {
        isRequestInProgressRef.current.fetchUsers = false;
      }, 500);
    }
  }, []);

  // Create debounced version
  const debouncedFetchUsers = useCallback(
    debounce(() => {
      fetchUsers();
    }, 300),
    [fetchUsers]
  );

  // 設置 SSE 連接
  useEffect(() => {
    if (!currentUser) return;
    
    console.log("設置 SSE 連接");
    const token = localStorage.getItem("token") || "";
    let eventSource: EventSource | null = null;
    let isComponentMounted = true;
    let retryTimeout: NodeJS.Timeout | null = null;
    
    // Add a retry mechanism with exponential backoff
    const connectSSE = (retryCount = 0) => {
      // Clear any existing retry timeout
      if (retryTimeout) {
        clearTimeout(retryTimeout);
        retryTimeout = null;
      }
      
      // Close any existing connection first
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      
      // Don't reconnect if component is unmounted
      if (!isComponentMounted) return;
      
      // Create a new connection with a unique timestamp to prevent caching
      const timestamp = new Date().getTime();
      try {
        eventSource = new EventSource(`/api/notifications/sse?userId=${currentUser.user_id}&token=${token}&t=${timestamp}`);

        eventSource.onmessage = (event) => {
          if (!isComponentMounted) return;
          
          try {
            const data = JSON.parse(event.data);
            console.log("SSE 事件:", data);

            if (data.type === "new_notification") {
              // 添加新通知到列表
              setNotifications(prev => [data.notification, ...prev]);
            } else if (data.type === "notification_deleted") {
              // 從列表中移除已刪除的通知
              setNotifications(prev => 
                prev.filter(n => n.notification_id !== parseInt(data.notification_id))
              );
            }
          } catch (err) {
            console.error("處理 SSE 事件錯誤:", err);
          }
        };

        eventSource.onerror = (error) => {
          console.error("SSE 連接錯誤:", error);
          
          // Close the current connection
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          
          // Retry with exponential backoff
          if (isComponentMounted && retryCount < 5) {
            const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 30000); // Max 30 seconds
            console.log(`SSE 連接失敗，${retryDelay}ms 後重試...`);
            
            retryTimeout = setTimeout(() => {
              connectSSE(retryCount + 1);
            }, retryDelay);
          } else if (isComponentMounted) {
            console.error("SSE 連接重試次數過多，停止重試");
          }
        };
        
        eventSource.onopen = () => {
          console.log("SSE 連接已建立");
        };
      } catch (error) {
        console.error("創建 SSE 連接錯誤:", error);
        
        // Retry with exponential backoff
        if (isComponentMounted && retryCount < 5) {
          const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 30000);
          retryTimeout = setTimeout(() => {
            connectSSE(retryCount + 1);
          }, retryDelay);
        }
      }
    };
    
    // Start the connection
    connectSSE();

    return () => {
      console.log("關閉 SSE 連接");
      isComponentMounted = false;
      
      if (retryTimeout) {
        clearTimeout(retryTimeout);
        retryTimeout = null;
      }
      
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };
  }, [currentUser]);

  // 初始加載
  useEffect(() => {
    console.log("管理員通知組件 - useEffect 初始化");
    
    // 使用延遲加載，避免同時發起多個請求
    const loadData = async () => {
      try {
        // 先加載用戶列表
        await debouncedFetchUsers();
        
        // 然後加載通知列表
        await debouncedFetchNotifications();
      } catch (error) {
        console.error("初始加載錯誤:", error);
      }
    };
    
    loadData();
    
    return () => {
      console.log("管理員通知組件 - useEffect 清理");
    };
  }, [debouncedFetchNotifications, debouncedFetchUsers]);

  // 發送新通知
  const handleSendNotification = async () => {
    if (shouldThrottle('sendNotification')) return;
    
    try {
      if (!currentUser) {
        setError("未找到當前用戶信息");
        return;
      }

      if (!newNotification.title || !newNotification.content) {
        setError("標題和內容為必填欄位");
        return;
      }

      const payload = {
        title: newNotification.title,
        content: newNotification.content,
        sender_id: currentUser.user_id,
        recipient_id: newNotification.recipient_id ? parseInt(newNotification.recipient_id) : null,
      };

      console.log("發送通知 - 發送數據:", payload);

      const response = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      console.log("發送通知 - 響應狀態:", response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error("發送通知 - 錯誤響應:", errorData);
        throw new Error(`發送通知失敗: ${response.status} - ${errorData.message || ''}`);
      }

      const responseData = await response.json();
      console.log("發送通知 - 成功響應:", responseData);

      // 重置表單並刷新通知列表
      setNewNotification({
        title: "",
        content: "",
        recipient_id: "",
      });
      setShowAddModal(false);
      
      // Use setTimeout to avoid rapid state changes
      setTimeout(() => {
        debouncedFetchNotifications();
      }, 300);
    } catch (err) {
      console.error("發送通知錯誤:", err);
      setError(err instanceof Error ? err.message : "未知錯誤");
    } finally {
      // Reset after a delay
      setTimeout(() => {
        isRequestInProgressRef.current.sendNotification = false;
      }, 500);
    }
  };

  // 刪除通知
  const handleDeleteNotification = async (notificationId: number) => {
    if (shouldThrottle('deleteNotification')) return;
    
    try {
      setDeleteLoading(notificationId);
      setError(null);
      
      const response = await fetch(`/api/admin/notifications?id=${notificationId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`刪除通知失敗: ${response.status} - ${errorData.message || ''}`);
      }
      
      // 從列表中移除已刪除的通知 - use functional update to avoid potential state issues
      setNotifications(prev => prev.filter(n => n.notification_id !== notificationId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知錯誤");
    } finally {
      setDeleteLoading(null);
      // Reset after a delay
      setTimeout(() => {
        isRequestInProgressRef.current.deleteNotification = false;
      }, 500);
    }
  };

  // 格式化日期
  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return format(date, 'yyyy/MM/dd HH:mm:ss', { locale: zhTW });
    } catch (err) {
      console.error('日期格式錯誤:', err);
      return '未知時間';
    }
  };

  // Format the time ago
  const timeAgo = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return formatDistanceToNow(date, { addSuffix: true, locale: zhTW });
    } catch (err) {
      console.error('日期格式錯誤:', err);
      return '未知時間';
    }
  };

  // Debounced form updates
  const handleTitleChange = debounce((value: string) => {
    setNewNotification(prev => ({...prev, title: value}));
  }, 100);
  
  const handleContentChange = debounce((value: string) => {
    setNewNotification(prev => ({...prev, content: value}));
  }, 100);
  
  const handleRecipientChange = debounce((value: string) => {
    setNewNotification(prev => ({...prev, recipient_id: value}));
  }, 100);

  return (
    <div className={styles["notification-container"]}>
      <div className={styles["notification-header"]}>
        <h2>通知管理</h2>
        <div className={styles["notification-actions"]}>
          <button 
            className={`${styles["admin-button"]} ${styles["admin-button-primary"]}`}
            onClick={() => setShowAddModal(true)}
          >
            <span className={styles["admin-button-icon"]}><AddIcon /></span>
            新增通知
          </button>
        </div>
      </div>

      {loading ? (
        <div className={styles["loading-container"]}>
          <div className={styles["loading-spinner"]}></div>
          <p>加載中...</p>
        </div>
      ) : error ? (
        <div className={styles["no-notifications"]}>
          <p>錯誤: {error}</p>
          <button 
            className={`${styles["admin-button"]} ${styles["admin-button-primary"]}`}
            onClick={() => debouncedFetchNotifications()}
          >
            重試
          </button>
        </div>
      ) : notifications.length === 0 ? (
        <div className={styles["no-notifications"]}>
          <p>暫無通知</p>
        </div>
      ) : (
        <div className={styles["notification-list"]}>
          {notifications.map((notification) => (
            <div key={notification.notification_id} className={styles["notification-item"]}>
              <div className={styles["notification-header"]}>
                <h3>{notification.title}</h3>
                <div className={styles["notification-actions"]}>
                  <button
                    className={`${styles["admin-button"]} ${styles["admin-button-danger"]}`}
                    onClick={() => handleDeleteNotification(notification.notification_id)}
                    disabled={deleteLoading === notification.notification_id}
                  >
                    {deleteLoading === notification.notification_id ? (
                      <span>刪除中...</span>
                    ) : (
                      <>
                        <span className={styles["admin-button-icon"]}><DeleteIcon /></span>
                        刪除
                      </>
                    )}
                  </button>
                </div>
              </div>
              <div className={styles["notification-content"]}>
                {notification.content}
              </div>
              <div className={styles["notification-footer"]}>
                <div className={styles["notification-time"]}>
                  <span>{formatDate(notification.created_at)}</span>
                  <span>({timeAgo(notification.created_at)})</span>
                </div>
                <div className={styles["notification-meta"]}>
                  <span>發送者: {notification.sender_username}</span>
                  <span>接收者: {notification.recipient_username || '所有用戶'}</span>
                  <span className={`${styles["notification-status"]} ${notification.read ? styles["read"] : styles["unread"]}`}>
                    {notification.read ? '已讀' : '未讀'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal for adding new notification */}
      {showAddModal && (
        <div className={styles["admin-modal-overlay"]} onClick={() => setShowAddModal(false)}>
          <div className={styles["admin-modal"]} onClick={(e) => e.stopPropagation()}>
            <div className={styles["admin-modal-header"]}>
              <h3>發送新通知</h3>
              <button onClick={() => setShowAddModal(false)}>&times;</button>
            </div>
            <div className={styles["admin-modal-content"]}>
              <div className={styles["notification-form"]}>
                <div className={styles["form-group"]}>
                  <label htmlFor="notification-title">標題</label>
                  <input
                    id="notification-title"
                    type="text"
                    defaultValue={newNotification.title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="請輸入通知標題"
                    className={styles["enhanced-input"]}
                  />
                </div>
                <div className={styles["form-group"]}>
                  <label htmlFor="notification-content">內容</label>
                  <textarea
                    id="notification-content"
                    defaultValue={newNotification.content}
                    onChange={(e) => handleContentChange(e.target.value)}
                    placeholder="請輸入通知內容"
                    className={styles["enhanced-input"]}
                  />
                </div>
                <div className={styles["form-group"]}>
                  <label htmlFor="notification-recipient">接收者</label>
                  <select
                    id="notification-recipient"
                    defaultValue={newNotification.recipient_id}
                    onChange={(e) => handleRecipientChange(e.target.value)}
                    className={styles["enhanced-input"]}
                  >
                    <option value="">所有用戶</option>
                    {users.map((user) => (
                      <option key={user.user_id} value={user.user_id}>
                        {user.username} ({user.role})
                      </option>
                    ))}
                  </select>
                </div>
                
                {error && (
                  <div className={styles["form-error"]}>
                    {error}
                  </div>
                )}
              </div>
            </div>
            <div className={styles["admin-modal-footer"]}>
              <button
                className={`${styles["admin-button"]} ${styles["admin-button-default"]}`}
                onClick={() => setShowAddModal(false)}
              >
                取消
              </button>
              <button
                className={`${styles["admin-button"]} ${styles["admin-button-primary"]}`}
                onClick={handleSendNotification}
                disabled={!newNotification.title || !newNotification.content || isRequestInProgressRef.current.sendNotification}
              >
                發送通知
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 