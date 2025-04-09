import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import styles from "./admin.module.scss";
import { IconButton } from "./button";
import { useNavigate } from "react-router-dom";
import { Path } from "../constant";
import LogoutIcon from "../icons/logout.svg";
import { showToast } from "./ui-lib";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  ComposedChart,
  Area,
} from "recharts";
import { format } from "date-fns-tz";
import HomeIcon from "../icons/home.svg";
import UsersIcon from "../icons/users.svg";
import StatsIcon from "../icons/stats.svg";
import SearchIcon from "../icons/search.svg";
import Image from "next/image";
import AddIcon from "../icons/add.svg";
import { AdminNotifications } from "./admin-notifications";

interface User {
  user_id: number;
  username: string;
  role: string;
  upstashName: string;
  sessionToken: string;
  createdAt: string;
  lastLogin: string;
  isOnline?: boolean;
}

interface UpstashStats {
  // 基本統計
  daily_net_commands: number;
  total_monthly_storage: number;
  current_storage: number;
  timestamp: string;
  total_monthly_bandwidth: number;

  // 請求統計
  total_monthly_requests: number;
  total_monthly_read_requests: number;
  total_monthly_write_requests: number;
  total_monthly_billing: number;

  // 最近的性能指標
  current_throughput: number;
  current_read: number;
  current_write: number;
  current_latency: number;

  // 每日數據;
  dailyRequests: Array<{ x: string; y: number }>;
  dailyBilling: Array<{ x: string; y: number }>;
  dailyBandwidth: Array<{ x: string; y: number }>;
  days: string[];
}

interface ChartData {
  time: string;
  total_value: number;
  diff_value: number;
}

interface OpenAIUsage {
  total_tokens: number;
  total_requests: number;
  total_input_tokens: number;
  total_output_tokens: number;
  models_usage: Array<{
    name: string;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    requests: number;
    color: string;
  }>;
  daily_usage: Array<{
    timestamp: number;
    total_tokens: number;
    input_tokens: number;
    output_tokens: number;
    total_requests: number;
    line_items: Array<{
      name: string;
      input_tokens: number;
      output_tokens: number;
      total_tokens: number;
      requests: number;
      color: string;
    }>;
  }>;
}

interface OpenAIUsageResponse {
  object: string;
  data: Array<{
    object: string;
    start_time: number;
    end_time: number;
    results: Array<{
      object: string;
      input_tokens: number;
      output_tokens: number;
      input_cached_tokens: number;
      input_audio_tokens: number;
      output_audio_tokens: number;
      num_model_requests: number;
      project_id: string | null;
      user_id: string | null;
      api_key_id: string | null;
      model: string | null;
      batch: string | null;
    }>;
  }>;
  has_more: boolean;
  next_page: string;
}

interface OpenAICostData {
  total_cost: number;
  daily_costs: Array<{
    timestamp: number;
    cost: number;
    line_items: Array<{
      name: string;
      cost: number;
    }>;
  }>;
}

// Add new function to store stats in MySQL
const storeStatsToMySQL = async (stats: UpstashStats) => {
  try {
    const dailyData = [
      { item: "daily_net_commands", value: stats.daily_net_commands },
      { item: "daily_read_requests", value: stats.total_monthly_read_requests },
      {
        item: "daily_write_requests",
        value: stats.total_monthly_write_requests,
      },
      {
        item: "monthly_bandwidth_mb",
        value:
          Math.round((stats.total_monthly_bandwidth / 1073741824) * 100) / 100,
      },
      { item: "monthly_requests", value: stats.total_monthly_requests },
      {
        item: "monthly_read_requests",
        value: stats.total_monthly_read_requests,
      },
      {
        item: "monthly_write_requests",
        value: stats.total_monthly_write_requests,
      },
      {
        item: "monthly_storage_mb",
        value: Math.round((stats.total_monthly_storage / 1048576) * 100) / 100,
      },
      {
        item: "current_storage_kb",
        value: Math.round((stats.current_storage / 1024) * 100) / 100,
      },
      { item: "monthly_billing", value: stats.total_monthly_billing },
    ];
    // console.log("dailyData", dailyData);
    const response = await fetch("/api/admin/store-stats", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({
        stats: dailyData,
        updateExisting: true, // 新增此參數告訴後端使用 UPSERT
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `儲存失敗 (${response.status}): ${
          errorData.message || response.statusText
        }`,
      );
    }

    // console.log("Stats stored successfully:", dailyData);
  } catch (error) {
    console.error("Error storing stats:", error);
    showToast(
      `儲存統計資料失敗: ${
        error instanceof Error ? error.message : "未知錯誤"
      }`,
    );
  }
};

// 新增基礎元件
interface AdminModalProps {
  title: string;
  children: React.ReactNode;
  onClose?: () => void;
  footer?: React.ReactNode;
  width?: string | number;
}

const AdminModal: React.FC<AdminModalProps> = ({
  title,
  children,
  onClose,
  footer,
  width = "500px",
}) => {
  return (
    <div className={styles["admin-modal-overlay"]} onClick={onClose}>
      <div
        className={styles["admin-modal"]}
        style={{ width }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles["admin-modal-header"]}>
          <h3>{title}</h3>
          <button onClick={onClose}>&times;</button>
        </div>
        <div className={styles["admin-modal-content"]}>{children}</div>
        {footer && <div className={styles["admin-modal-footer"]}>{footer}</div>}
      </div>
    </div>
  );
};

interface AdminButtonProps {
  text: string;
  onClick?: () => void;
  type?: "primary" | "danger" | "default";
  icon?: React.ReactNode;
  disabled?: boolean;
}

const AdminButton: React.FC<AdminButtonProps> = ({
  text,
  onClick,
  type = "default",
  icon,
  disabled,
}) => {
  return (
    <button
      className={`${styles["admin-button"]} ${styles[`admin-button-${type}`]}`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon && <span className={styles["admin-button-icon"]}>{icon}</span>}
      {text}
    </button>
  );
};

// Add new interface for password change
interface PasswordChangeModal {
  isOpen: boolean;
  userId: number | null;
  username: string;
  newPassword: string;
  confirmPassword: string;
  error: string;
  showPassword: boolean;
}

// Add helper functions at the top of the file
function getDefaultStartDate() {
  const date = new Date();
  date.setDate(date.getDate() - 29); // Get date from 29 days ago
  return date.toISOString().split('T')[0];
}

function getDefaultEndDate() {
  return new Date().toISOString().split('T')[0]; // Get current date
}

// Add a NotificationsIcon component
const NotificationsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
  </svg>
);

export function AdminPage() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<"users" | "stats" | "notifications">("users");
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    role: "user",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageVisible, setMessageVisible] = useState(false);
  const [stats, setStats] = useState<UpstashStats | null>(null);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [timeRange, setTimeRange] = useState<number>(24);
  const chartRef = useRef<any>(null);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [openAIUsage, setOpenAIUsage] = useState<OpenAIUsage | null>(null);
  const [costData, setCostData] = useState<OpenAICostData | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: getDefaultStartDate(),
    endDate: getDefaultEndDate(),
  });
  const [passwordChangeModal, setPasswordChangeModal] = useState<{
    isOpen: boolean;
    userId: number | null;
    username: string;
    newPassword: string;
    confirmPassword: string;
    error: string;
    showPassword: boolean;
  }>({
    isOpen: false,
    userId: null,
    username: '',
    newPassword: '',
    confirmPassword: '',
    error: '',
    showPassword: false,
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [currentUserLoading, setCurrentUserLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<number[]>([]);

  // 設置提示訊息並自動淡出
  const showMessage = useCallback((msg: string) => {
    setMessage(msg);
    setMessageVisible(true);
    setTimeout(() => {
      setMessageVisible(false);
      setTimeout(() => setMessage(""), 300); // 等待淡出動畫完成後清除訊息
    }, 3000);
  }, []);

  // 獲取當前用戶信息
  const fetchCurrentUser = useCallback(async (retryCount = 0, maxRetries = 3) => {
    try {
      setCurrentUserLoading(true);
      
      // 從localStorage獲取用戶信息
      const userInfo = localStorage.getItem("userInfo");
      if (!userInfo) {
        console.error("No user info found in localStorage");
        return;
      }
      
      const response = await fetch("/api/admin/current-user", {
        headers: {
          "X-User-Info": userInfo
        }
      });
      
      if (!response.ok) {
        if (response.status === 503) {
          throw new Error("數據庫連接失敗，正在嘗試重新連接...");
        }
        throw new Error("Failed to get current user");
      }
      
      const data = await response.json();
      // console.log("Current user data:", data);
      setCurrentUser(data);
    } catch (error) {
      console.error("Error getting current user:", error);
      
      // 如果是數據庫連接錯誤或其他錯誤，嘗試重新連接
      if (retryCount < maxRetries) {
        const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 10000); // 指數退避，最大10秒
        // console.log(`嘗試重新獲取當前用戶... (${retryCount + 1}/${maxRetries}) 延遲: ${retryDelay}ms`);
        
        setTimeout(() => {
          fetchCurrentUser(retryCount + 1, maxRetries);
        }, retryDelay);
      }
    } finally {
      setCurrentUserLoading(false);
    }
  }, []);

  // 獲取用戶列表
  const fetchUsers = useCallback(async (retryCount = 0, maxRetries = 3) => {
    try {
      setUsersLoading(true);
      
      const response = await fetch("/api/admin/users");
      
      if (!response.ok) {
        if (response.status === 503) {
          throw new Error("數據庫連接失敗，正在嘗試重新連接...");
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setUsers(data.users);
    } catch (error) {
      console.error("Error fetching users:", error);
      
      // 如果是數據庫連接錯誤或其他錯誤，嘗試重新連接
      if (retryCount < maxRetries) {
        const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 10000); // 指數退避，最大10秒
        // console.log(`嘗試重新獲取用戶列表... (${retryCount + 1}/${maxRetries}) 延遲: ${retryDelay}ms`);
        
        setTimeout(() => {
          fetchUsers(retryCount + 1, maxRetries);
        }, retryDelay);
      }
    } finally {
      setUsersLoading(false);
    }
  }, []);

  // 獲取統計數據
  const fetchStats = useCallback(async (retryCount = 0, maxRetries = 3) => {
    try {
      setStatsLoading(true);
      
      const response = await fetch("/api/admin/stats");
      
      if (!response.ok) {
        if (response.status === 503) {
          throw new Error("數據庫連接失敗，正在嘗試重新連接...");
        }
        throw new Error(`連線失敗 (${response.status}): 獲取統計數據失敗`);
      }
      
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error("Error fetching stats:", error);
      
      // 如果是數據庫連接錯誤或其他錯誤，嘗試重新連接
      if (retryCount < maxRetries) {
        const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 10000); // 指數退避，最大10秒
        // console.log(`嘗試重新獲取統計數據... (${retryCount + 1}/${maxRetries}) 延遲: ${retryDelay}ms`);
        
        setTimeout(() => {
          fetchStats(retryCount + 1, maxRetries);
        }, retryDelay);
      }
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // 添加新使用者
  const handleAddUser = async () => {
    if (!newUser.username || !newUser.password) {
      showMessage("請填寫完整資料");
        return;
      }
      
    const existingUser = users.find(u => u.username === newUser.username);
    if (existingUser) {
      showMessage("使用者名稱已存在");
        return;
      }
      
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        credentials: "include",
        body: JSON.stringify({
          ...newUser,
          skipUpstash: true // Always skip upstash for all users created by admin
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        showMessage("使用者創建成功");
        setNewUser({ username: "", password: "", role: "user" });
        setShowAddUserModal(false);
        fetchUsers();
      } else {
        showMessage(data.message || "創建使用者失敗");
      }
    } catch (error) {
      showMessage("連接服務器失敗");
      console.error("Error adding user:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 刪除使用者
  const handleDeleteUser = async (userId: number) => {
    if (!currentUser) {
      showMessage("無法驗證當前用戶身份");
        return;
      }
      
    const userToDelete = users.find(u => u.user_id === userId);
    if (!userToDelete) {
      showMessage("找不到要刪除的使用者");
        return;
      }
      
    if (userToDelete.username === currentUser.username) {
      showMessage("無法刪除當前登入的管理員帳號");
        return;
      }
      
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        credentials: "include",
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || "刪除使用者失敗");
      }

      showMessage("使用者刪除成功");
      await fetchUsers(); // Refresh the user list
    } catch (error) {
      console.error("Error deleting user:", error);
      showMessage(error instanceof Error ? error.message : "刪除使用者失敗");
    }
  };

  const handleLogout = async () => {
    try {
      const userInfo = JSON.parse(localStorage.getItem("userInfo") || "{}");
      const token = localStorage.getItem("token");

      if (userInfo.user_id && token) {
        // 呼叫登出 API 刪除 sessionToken
        const response = await fetch("/api/auth", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            userId: userInfo.user_id,
            sessionToken: token,
          }),
        });

        if (!response.ok) {
          console.error("Logout failed:", response.statusText);
        }
      }

      // 清除本地存儲
      localStorage.removeItem("isAuthed");
      localStorage.removeItem("userInfo");
      localStorage.removeItem("token");
      
      // 重定向到登入頁面
      navigate(Path.Auth);
    } catch (error) {
      console.error("Logout error:", error);
      // 即使發生錯誤，仍然清除本地存儲並重定向
      localStorage.removeItem("isAuthed");
      localStorage.removeItem("userInfo");
      localStorage.removeItem("token");
      navigate(Path.Auth);
    }
  };

  // Function to handle zooming in and out
  const handleZoom = (direction: "in" | "out") => {
    setTimeRange((prev) => {
      if (direction === "in" && prev > 1) return prev - 1; // Min 1 hour
      if (direction === "out" && prev < 24) return prev + 1; // Max 24 hours
      return prev;
    });
  };

  // 獲取歷史數據
  const fetchHistoricalData = useCallback(async () => {
    try {
      // 清除暫存的圖表數據
      setChartData([]);

      const response = await fetch(
        `/api/admin/historical-stats?hours=${timeRange}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          cache: "no-store", // 禁用快取
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const formattedData = data.map((item: any) => ({
        time: format(new Date(item.time), "HH:mm", { timeZone: "Asia/Taipei" }),
        total_value: item.total_value,
        diff_value: item.diff_value,
        day: new Date(item.time).toLocaleDateString("zh-TW"),
      }));

      setChartData(formattedData);
    } catch (error) {
      console.error("Error fetching historical data:", error);
    }
  }, [timeRange]);

  // Resetting data at 23:59
  useEffect(() => {
    const now = new Date();
    if (now.getHours() === 23 && now.getMinutes() === 59) {
      fetchStats(); // Reset stats
    }
  }, [fetchStats]);

  const handleTabChange = (tab: "users" | "stats" | "notifications") => {
    if (showAddUserModal) {
      setShowAddUserModal(false);
      setNewUser({ username: "", password: "", role: "user" });
    }
    setActiveSection(tab);
  };

  // 修改 fetchOpenAIUsage 函數
  const fetchOpenAIUsage = useCallback(async () => {
    try {
      setIsLoadingStats(true);
      // console.log("[OpenAI Usage] Starting fetch with date range:", dateRange);

      // Fetch usage data
      const usageResponse = await fetch(
        `/api/admin/openai-usage?start_date=${dateRange.startDate}&end_date=${dateRange.endDate}`
      );
      
      if (!usageResponse.ok) {
        throw new Error(`Failed to fetch usage data: ${usageResponse.statusText}`);
      }
      
      const usageData = await usageResponse.json();
      // console.log("[OpenAI Usage] Received usage data:", usageData);

      // Fetch cost data
      const costResponse = await fetch(
        `/api/admin/openai-costs?start_date=${dateRange.startDate}&end_date=${dateRange.endDate}`
      );

      if (!costResponse.ok) {
        throw new Error(`Failed to fetch cost data: ${costResponse.statusText}`);
      }

      const costData = await costResponse.json();
      // console.log("[OpenAI Usage] Received cost data:", costData);

      // Update the state with usage data
      setOpenAIUsage({
        total_tokens: usageData.total_tokens || 0,
        total_requests: usageData.total_requests || 0,
        total_input_tokens: usageData.total_input_tokens || 0,
        total_output_tokens: usageData.total_output_tokens || 0,
        models_usage: usageData.models_usage || [],
        daily_usage: usageData.daily_usage.map((day: any) => ({
          timestamp: day.timestamp,
          total_tokens: day.total_tokens || 0,
          input_tokens: day.input_tokens || 0,
          output_tokens: day.output_tokens || 0,
          total_requests: day.total_requests || 0,
          line_items: day.line_items || []
        }))
      });

      // Update the state with cost data
      setCostData({
        total_cost: costData.total_cost || 0,
        daily_costs: costData.daily_costs || []
      });

    } catch (error) {
      console.error("[OpenAI Usage] Error fetching data:", error);
      showToast(
        `Error fetching OpenAI usage data: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      setIsLoadingStats(false);
    }
  }, [dateRange]);

  // 修改 useEffect
  useEffect(() => {
    if (activeSection === "stats") {
      fetchOpenAIUsage();
    }
    // 只在切換到統計頁面時更新數據，而不是每小時更新
  }, [activeSection, fetchOpenAIUsage]);

  // 處理密碼修改
  const handlePasswordChange = async () => {
    // Validate password
    if (!passwordChangeModal.newPassword) {
      setPasswordChangeModal(prev => ({ ...prev, error: 'Password cannot be empty' }));
      return;
    }

    if (passwordChangeModal.newPassword.length < 6) {
      setPasswordChangeModal(prev => ({ ...prev, error: 'Password must be at least 6 characters' }));
        return;
      }

    if (passwordChangeModal.newPassword !== passwordChangeModal.confirmPassword) {
      setPasswordChangeModal(prev => ({ ...prev, error: 'Passwords do not match' }));
      return;
    }

    try {
      const response = await fetch('/api/admin/users/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: passwordChangeModal.userId,
          newPassword: passwordChangeModal.newPassword,
        }),
      });

      if (response.ok) {
        showToast('Password changed successfully');
        setPasswordChangeModal({
          isOpen: false,
          userId: null,
          username: '',
          newPassword: '',
          confirmPassword: '',
          error: '',
          showPassword: false,
        });
      } else {
        const data = await response.json();
        setPasswordChangeModal(prev => ({ ...prev, error: data.error || 'Failed to change password' }));
      }
    } catch (error) {
      console.error('Error changing password:', error);
      setPasswordChangeModal(prev => ({ ...prev, error: 'An error occurred while changing the password' }));
    }
  };

  // Add new function to filter users
  const filteredUsers = users.filter(user => 
    user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Update validate date range function to allow up to 31 days
  const validateDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 31;
  };

  // Update date input change handler
  const handleDateChange = (date: string, type: 'start' | 'end') => {
    const newDateRange = { ...dateRange };
    if (type === 'start') {
      newDateRange.startDate = date;
      // If the new range would be more than 31 days, adjust the end date
      const start = new Date(date);
      const end = new Date(dateRange.endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 31) {
        const newEnd = new Date(date);
        newEnd.setDate(newEnd.getDate() + 30);
        newDateRange.endDate = newEnd.toISOString().split('T')[0];
      }
    } else {
      newDateRange.endDate = date;
      // If the new range would be more than 31 days, adjust the start date
      const start = new Date(dateRange.startDate);
      const end = new Date(date);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 31) {
        const newStart = new Date(date);
        newStart.setDate(newStart.getDate() - 30);
        newDateRange.startDate = newStart.toISOString().split('T')[0];
      }
    }
    setDateRange(newDateRange);
  };

  // Update keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeSection !== "stats") return;
      
      if (e.key === "ArrowLeft") {
        const newStartDate = new Date(dateRange.startDate);
        const newEndDate = new Date(dateRange.endDate);
        newStartDate.setMonth(newStartDate.getMonth() - 1);
        newEndDate.setMonth(newEndDate.getMonth() - 1);
        setDateRange({
          startDate: newStartDate.toISOString().split('T')[0],
          endDate: newEndDate.toISOString().split('T')[0]
        });
        fetchOpenAIUsage();
      } else if (e.key === "ArrowRight") {
        const newStartDate = new Date(dateRange.startDate);
        const newEndDate = new Date(dateRange.endDate);
        newStartDate.setMonth(newStartDate.getMonth() + 1);
        newEndDate.setMonth(newEndDate.getMonth() + 1);
        // 不允許超過當前日期
        if (newEndDate > new Date()) {
          return;
        }
        setDateRange({
          startDate: newStartDate.toISOString().split('T')[0],
          endDate: newEndDate.toISOString().split('T')[0]
        });
        fetchOpenAIUsage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSection, dateRange, fetchOpenAIUsage]);

  // Process chart data
  const processChartData = useCallback(() => {
    if (!openAIUsage?.daily_usage) return [];
    
    return openAIUsage.daily_usage.map((day) => ({
      time: new Date(day.timestamp * 1000).toLocaleDateString(),
      input_tokens: day.input_tokens,
      output_tokens: day.output_tokens,
      total_requests: day.total_requests,
      cost: costData?.daily_costs.find(
        (cost) => cost.timestamp === day.timestamp
      )?.cost || 0,
    }));
  }, [openAIUsage, costData]);

  const usageChartData = useMemo(() => processChartData(), [processChartData]);

  // Update the model usage display
  {Object.entries(openAIUsage?.models_usage || []).map(([model, usage]) => (
    <div key={model} className={styles["model-usage"]}>
      <div className={styles["model-name"]}>{model}</div>
      <div className={styles["usage-stats"]}>
        <div>Input Tokens: {usage.input_tokens.toLocaleString()}</div>
        <div>Output Tokens: {usage.output_tokens.toLocaleString()}</div>
        <div>Total Tokens: {usage.total_tokens.toLocaleString()}</div>
        <div>Requests: {usage.requests.toLocaleString()}</div>
      </div>
    </div>
  ))}

  const renderUsageStats = () => (
      <div className={styles["stats-section"]}>
      <h3>Usage Statistics</h3>
      <div className={styles["stats-grid"]}>
        <div className={styles["stat-card"]}>
          <div className={styles["stat-icon"]}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM9 17H7V10H9V17ZM13 17H11V7H13V17ZM17 17H15V13H17V17Z" fill="currentColor"/>
            </svg>
          </div>
          <div className={styles["stat-content"]}>
            <h4>Total Tokens</h4>
            <div className={styles["stat-value"]}>{openAIUsage?.total_tokens.toLocaleString()}</div>
        </div>
          </div>
        <div className={styles["stat-card"]}>
          <div className={styles["stat-icon"]}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H5.17L4 17.17V4H20V16Z" fill="currentColor"/>
            </svg>
        </div>
          <div className={styles["stat-content"]}>
            <h4>Input Tokens</h4>
            <div className={styles["stat-value"]}>{openAIUsage?.total_input_tokens.toLocaleString()}</div>
          </div>
        </div>
        <div className={styles["stat-card"]}>
          <div className={styles["stat-icon"]}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 2H4C2.9 2 2.01 2.9 2.01 4L2 22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM8 14H6V12H8V14ZM8 11H6V9H8V11ZM8 8H6V6H8V8ZM15 14H10V12H15V14ZM18 11H10V9H18V11ZM18 8H10V6H18V8Z" fill="currentColor"/>
            </svg>
          </div>
          <div className={styles["stat-content"]}>
            <h4>Output Tokens</h4>
            <div className={styles["stat-value"]}>{openAIUsage?.total_output_tokens.toLocaleString()}</div>
        </div>
          </div>
        <div className={styles["stat-card"]}>
          <div className={styles["stat-icon"]}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 3H5C3.89 3 3 3.9 3 5V19C3 20.1 3.89 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM19 19H5V5H19V19ZM17 17H7V16H17V17ZM17 15H7V14H17V15ZM17 12H7V7H17V12Z" fill="currentColor"/>
            </svg>
        </div>
          <div className={styles["stat-content"]}>
            <h4>Total Requests</h4>
            <div className={styles["stat-value"]}>{openAIUsage?.total_requests.toLocaleString()}</div>
      </div>
          </div>
        <div className={styles["stat-card"]}>
          <div className={styles["stat-icon"]}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M11.8 10.9C9.53 10.31 8.8 9.7 8.8 8.75C8.8 7.66 9.81 6.9 11.5 6.9C13.28 6.9 13.94 7.75 14 9H16.21C16.14 7.28 15.09 5.7 13 5.19V3H10V5.16C8.06 5.58 6.5 6.84 6.5 8.77C6.5 11.08 8.41 12.23 11.2 12.9C13.7 13.5 14.2 14.38 14.2 15.31C14.2 16 13.71 17.1 11.5 17.1C9.44 17.1 8.63 16.18 8.5 15H6.32C6.44 17.19 8.08 18.42 10 18.83V21H13V18.85C14.95 18.48 16.5 17.35 16.5 15.3C16.5 12.46 14.07 11.49 11.8 10.9Z" fill="currentColor"/>
            </svg>
        </div>
          <div className={styles["stat-content"]}>
            <h4>Total Cost (USD) </h4>
            <div className={styles["stat-value"]}>${costData?.total_cost.toFixed(4)} </div>
          </div>
        </div>
      </div>

      <div className={styles["chart-container"]}>
        <div className={styles["chart-header"]}>
          <h3>Usage & Cost Trends</h3>
          <div className={styles["chart-legend"]}>
            <div className={styles["legend-item"]}>
              <div className={styles["legend-color"]} style={{ background: "var(--chart-color-1)" }}></div>
              <span>Input Tokens</span>
            </div>
            <div className={styles["legend-item"]}>
              <div className={styles["legend-color"]} style={{ background: "var(--chart-color-2)" }}></div>
              <span>Output Tokens</span>
            </div>
            <div className={styles["legend-item"]}>
              <div className={styles["legend-color"]} style={{ background: "var(--chart-color-3)" }}></div>
              <span>Cost</span>
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={400}>
              <ComposedChart
            data={usageChartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
          >
            <defs>
              <linearGradient id="colorInput" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-color-1)" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="var(--chart-color-1)" stopOpacity={0.2}/>
              </linearGradient>
              <linearGradient id="colorOutput" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-color-2)" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="var(--chart-color-2)" stopOpacity={0.2}/>
              </linearGradient>
              <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-color-3)" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="var(--chart-color-3)" stopOpacity={0.2}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis
              dataKey="time"
              angle={-45}
              textAnchor="end"
              height={60}
              tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
              axisLine={{ stroke: 'var(--border-color)' }}
              tickLine={{ stroke: 'var(--border-color)' }}
                />
                <YAxis
                  yAxisId="left"
              tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
              axisLine={{ stroke: 'var(--border-color)' }}
              tickLine={{ stroke: 'var(--border-color)' }}
              tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
              tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
              axisLine={{ stroke: 'var(--border-color)' }}
              tickLine={{ stroke: 'var(--border-color)' }}
              tickFormatter={(value) => `$${value.toFixed(3)}`}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'var(--card-bg)', 
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
              }}
              itemStyle={{ color: 'var(--text-primary)' }}
              labelStyle={{ color: 'var(--text-primary)', fontWeight: 'bold', marginBottom: '5px' }}
              formatter={(value: number, name: string) => {
                if (name === "Cost") {
                  return [`$${value.toFixed(4)}`, name];
                }
                return [value.toLocaleString(), name];
              }}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Legend 
              wrapperStyle={{ 
                paddingTop: '20px',
                color: 'var(--text-secondary)'
              }}
              iconType="circle"
              iconSize={10}
            />
            <Area
                  yAxisId="left"
              type="monotone"
              dataKey="input_tokens"
              name="Input Tokens"
              stroke="var(--chart-color-1)"
              strokeWidth={2}
              fill="url(#colorInput)"
              activeDot={{ r: 6, stroke: 'var(--chart-color-1)', strokeWidth: 2, fill: '#fff' }}
            />
            <Area
                  yAxisId="left"
              type="monotone"
              dataKey="output_tokens"
              name="Output Tokens"
              stroke="var(--chart-color-2)"
              strokeWidth={2}
              fill="url(#colorOutput)"
              activeDot={{ r: 6, stroke: 'var(--chart-color-2)', strokeWidth: 2, fill: '#fff' }}
            />
            <Bar
                  yAxisId="right"
              dataKey="cost"
              name="Cost"
              fill="url(#colorCost)"
              barSize={20}
              radius={[4, 4, 0, 0]}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

      {/* <div className={styles["model-usage-section"]}>
        <h3>Model Usage Breakdown</h3>
        <div className={styles["model-usage-grid"]}>
          {openAIUsage?.models_usage.map((model) => (
            <div key={model.name} className={styles["model-usage-card"]}>
              <h4>{model.name}</h4>
              <div className={styles["usage-stats"]}>
                <div>Input Tokens: {model.input_tokens.toLocaleString()}</div>
                <div>Output Tokens: {model.output_tokens.toLocaleString()}</div>
                <div>Total Tokens: {model.total_tokens.toLocaleString()}</div>
                <div>Requests: {model.requests.toLocaleString()}</div>
        </div>
            </div>
          ))}
        </div>
      </div> */}
    </div>
  );

  const renderUserManagement = () => {
    const filteredUsers = users.filter(user => 
      user.username.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const adminUsers = filteredUsers.filter(user => user.role === "admin");
    const regularUsers = filteredUsers.filter(user => user.role !== "admin");

    return (
      <div className={styles["user-management"]}>
        <div className={styles["section-title"]}>
          <h2>User Management</h2>
          <div className={styles["title-actions"]}>
            <IconButton
              icon={<AddIcon />}
              text="Add User"
              onClick={() => setShowAddUserModal(true)}
            />
          </div>
        </div>

        {/* Admin Users Section */}
        <div className={styles["admin-users"]}>
          <div className={styles["section-header"]}>
            <h2>Administrators</h2>
            <div className={styles["user-count"]}>
              {adminUsers.length} users
            </div>
          </div>
          <div className={styles["user-grid"]}>
            {adminUsers.map((user) => (
              <div key={user.user_id} className={styles["user-card"]}>
                <div className={styles["user-card-header"]}>
                  <div className={styles["avatar"]}>
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <div className={styles["user-status"]} title={onlineUsers.includes(user.user_id) ? "Online" : "Offline"}>
                    <span className={`${styles["status-indicator"]} ${onlineUsers.includes(user.user_id) ? styles["online"] : styles["offline"]}`}></span>
                  </div>
                </div>
                <div className={styles["user-card-content"]}>
                  <div className={styles["username"]}>{user.username}</div>
                  <div className={styles["role"]}>
                    <span className={`${styles["role-badge"]} ${styles["admin"]}`}>
                      Admin
                    </span>
                  </div>
                  <div className={styles["time-info"]}>
                    <div className={styles["time-item"]}>
                      <span className={styles["time-label"]}>Created:</span>
                      <span className={styles["time-value"]}>{new Date(user.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className={styles["time-item"]}>
                      <span className={styles["time-label"]}>Last Login:</span>
                      <span className={styles["time-value"]}>{new Date(user.lastLogin).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div className={styles["user-card-actions"]}>
                  {currentUser && user.username !== currentUser.username && (
                    <button
                      className={styles["password-btn"]}
                      onClick={() => {
                        setPasswordChangeModal({
                          isOpen: true,
                          userId: user.user_id,
                          username: user.username,
                          newPassword: "",
                          confirmPassword: "",
                          error: "",
                          showPassword: false,
                        });
                      }}
                    >
                      Change Password
                    </button>
                  )}
                  <button
                    className={styles["delete-btn"]}
                    onClick={() => handleDeleteUser(user.user_id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Regular Users Section */}
        <div className={styles["regular-users"]}>
          <div className={styles["section-header"]}>
            <h2>Regular Users</h2>
            <div className={styles["user-count"]}>
              {regularUsers.length} users
            </div>
          </div>
          <div className={styles["user-grid"]}>
            {regularUsers.map((user) => (
              <div key={user.user_id} className={styles["user-card"]}>
                <div className={styles["user-card-header"]}>
                  <div className={styles["avatar"]}>
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <div className={styles["user-status"]} title={onlineUsers.includes(user.user_id) ? "Online" : "Offline"}>
                    <span className={`${styles["status-indicator"]} ${onlineUsers.includes(user.user_id) ? styles["online"] : styles["offline"]}`}></span>
                  </div>
                </div>
                <div className={styles["user-card-content"]}>
                  <div className={styles["username"]}>{user.username}</div>
                  <div className={styles["role"]}>
                    <span className={`${styles["role-badge"]} ${styles["user"]}`}>
                      User
                    </span>
                  </div>
                  <div className={styles["time-info"]}>
                    <div className={styles["time-item"]}>
                      <span className={styles["time-label"]}>Created:</span>
                      <span className={styles["time-value"]}>{new Date(user.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className={styles["time-item"]}>
                      <span className={styles["time-label"]}>Last Login:</span>
                      <span className={styles["time-value"]}>{new Date(user.lastLogin).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div className={styles["user-card-actions"]}>
                  {currentUser && user.username !== currentUser.username && (
                    <button
                      className={styles["password-btn"]}
                      onClick={() => {
                        setPasswordChangeModal({
                          isOpen: true,
                          userId: user.user_id,
                          username: user.username,
                          newPassword: "",
                          confirmPassword: "",
                          error: "",
                          showPassword: false,
                        });
                      }}
                    >
                      Change Password
                    </button>
                  )}
                  <button
                    className={styles["delete-btn"]}
                    onClick={() => handleDeleteUser(user.user_id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderHeader = () => (
    <div className={styles["admin-header"]}>
      <div className={styles["search-bar"]}>
        <input
          type="text"
          placeholder="Search users..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.currentTarget.value)}
        />
                    </div>
                    <div className={styles["user-info"]}>
        <span className={styles["username"]}>admin</span>
        <button className={styles["logout-button"]} onClick={handleLogout}>登出</button>
                      </div>
                    </div>
  );

  const renderStats = () => (
    <div className={styles["stats-container"]}>
      <div className={styles["stat-card"]}>
        <div className={styles["stat-icon"]}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="currentColor"/>
          </svg>
                    </div>
        <div className={styles["stat-content"]}>
          <h4>Total Users</h4>
          <div className={styles["stat-value"]}>{users.length}</div>
          <div className={styles["stat-description"]}>Active accounts on the platform</div>
                  </div>
              </div>
      <div className={styles["stat-card"]}>
        <div className={styles["stat-icon"]}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 11C17.66 11 18.99 9.66 18.99 8C18.99 6.34 17.66 5 16 5C14.34 5 13 6.34 13 8C13 9.66 14.34 11 16 11ZM8 11C9.66 11 10.99 9.66 10.99 8C10.99 6.34 9.66 5 8 5C6.34 5 5 6.34 5 8C5 9.66 6.34 11 8 11ZM8 13C5.67 13 1 14.17 1 16.5V19H15V16.5C15 14.17 10.33 13 8 13ZM16 13C15.71 13 15.38 13.02 15.03 13.05C16.19 13.89 17 15.02 17 16.5V19H23V16.5C23 14.17 18.33 13 16 13Z" fill="currentColor"/>
          </svg>
            </div>
        <div className={styles["stat-content"]}>
          <h4>Regular Users</h4>
          <div className={styles["stat-value"]}>{users.filter(u => u.role === 'user').length}</div>
          <div className={styles["stat-description"]}>Standard access accounts</div>
        </div>
      </div>
      <div className={styles["stat-card"]}>
        <div className={styles["stat-icon"]}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 5C13.66 5 15 6.34 15 8C15 9.66 13.66 11 12 11C10.34 11 9 9.66 9 8C9 6.34 10.34 5 12 5ZM12 19.2C9.5 19.2 7.29 17.92 6 15.98C6.03 13.99 10 12.9 12 12.9C13.99 12.9 17.97 13.99 18 15.98C16.71 17.92 14.5 19.2 12 19.2Z" fill="currentColor"/>
          </svg>
        </div>
        <div className={styles["stat-content"]}>
          <h4>Admin Users</h4>
          <div className={styles["stat-value"]}>{users.filter(u => u.role === 'admin').length}</div>
          <div className={styles["stat-description"]}>Privileged administrator accounts</div>
        </div>
      </div>
    </div>
  );

  const renderDateRangeSelector = () => (
    <div className={styles["date-range-selector"]}>
      <div className={styles["date-range-header"]}>
        <h3>Date Range</h3>
        <div className={styles["date-navigation"]}>
          <button 
            className={styles["nav-button"]} 
            onClick={() => {
              const newStartDate = new Date(dateRange.startDate);
              const newEndDate = new Date(dateRange.endDate);
              newStartDate.setDate(newStartDate.getDate() - 7);
              newEndDate.setDate(newEndDate.getDate() - 7);
              setDateRange({
                startDate: newStartDate.toISOString().split('T')[0],
                endDate: newEndDate.toISOString().split('T')[0]
              });
              fetchOpenAIUsage();
            }}
            title="Previous Week"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15.41 7.41L14 6L8 12L14 18L15.41 16.59L10.83 12L15.41 7.41Z" fill="currentColor"/>
            </svg>
          </button>
          <button 
            className={styles["refresh-button"]} 
            onClick={() => fetchOpenAIUsage()}
            title="Refresh Data"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4C7.58 4 4.01 7.58 4.01 12C4.01 16.42 7.58 20 12 20C15.73 20 18.84 17.45 19.73 14H17.65C16.83 16.33 14.61 18 12 18C8.69 18 6 15.31 6 12C6 8.69 8.69 6 12 6C13.66 6 15.14 6.69 16.22 7.78L13 11H20V4L17.65 6.35Z" fill="currentColor"/>
            </svg>
          </button>
          <button 
            className={styles["nav-button"]} 
            onClick={() => {
              const newStartDate = new Date(dateRange.startDate);
              const newEndDate = new Date(dateRange.endDate);
              newStartDate.setDate(newStartDate.getDate() + 7);
              newEndDate.setDate(newEndDate.getDate() + 7);
              // Don't allow future dates
              if (newEndDate > new Date()) {
                return;
              }
              setDateRange({
                startDate: newStartDate.toISOString().split('T')[0],
                endDate: newEndDate.toISOString().split('T')[0]
              });
              fetchOpenAIUsage();
            }}
            title="Next Week"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 6L8.59 7.41L13.17 12L8.59 16.59L10 18L16 12L10 6Z" fill="currentColor"/>
            </svg>
          </button>
                    </div>
                      </div>
      <div className={styles["date-inputs"]}>
        <div className={styles["date-input-group"]}>
          <label htmlFor="start-date">Start Date</label>
          <div className={styles["date-input-wrapper"]}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 3H18V1H16V3H8V1H6V3H5C3.89 3 3.01 3.9 3.01 5L3 19C3 20.1 3.89 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM19 19H5V8H19V19ZM7 10H12V15H7V10Z" fill="currentColor"/>
            </svg>
            <input
              id="start-date"
              type="date"
              value={dateRange.startDate}
              onChange={(e) => handleDateChange(e.target.value, 'start')}
              max={new Date().toISOString().split('T')[0]}
            />
                    </div>
        </div>
        <div className={styles["date-input-group"]}>
          <label htmlFor="end-date">End Date</label>
          <div className={styles["date-input-wrapper"]}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 3H18V1H16V3H8V1H6V3H5C3.89 3 3.01 3.9 3.01 5L3 19C3 20.1 3.89 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM19 19H5V8H19V19ZM7 10H12V15H7V10Z" fill="currentColor"/>
            </svg>
            <input
              id="end-date"
              type="date"
              value={dateRange.endDate}
              onChange={(e) => handleDateChange(e.target.value, 'end')}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderStatsSection = () => (
    <div className={styles["openai-stats-page"]}>
      <div className={styles["section-title"]}>
        <h2>OpenAI Usage Statistics</h2>
        <div className={styles["title-description"]}>
          View and analyze your OpenAI API usage and costs
        </div>
      </div>

      {renderDateRangeSelector()}

      {!openAIUsage ? (
        <div className={styles["loading-container"]}>
          <div className={styles["loading-spinner"]}></div>
          <p>Loading usage statistics...</p>
        </div>
      ) : (
        <>
          {renderUsageStats()}
          
          {costData && costData.daily_costs.length > 0 && (
            <div className={styles["model-breakdown"]}>
              <h3>Model Usage Breakdown</h3>
              <div className={styles["model-cards"]}>
                {Object.entries(openAIUsage?.models_usage || {}).map(([model, usage]) => (
                  <div key={model} className={styles["model-card"]}>
                    <div className={styles["model-header"]}>
                      <div className={styles["model-name"]}>{model}</div>
                      <div className={styles["model-badge"]}>
                        {model.includes('gpt-4') ? 'GPT-4' : 
                         model.includes('gpt-3.5') ? 'GPT-3.5' : 
                         model.includes('dall-e') ? 'DALL-E' : 'Other'}
                      </div>
                    </div>
                    <div className={styles["model-stats"]}>
                      <div className={styles["stat-row"]}>
                        <span>Input Tokens:</span>
                        <span>{usage.input_tokens.toLocaleString()}</span>
                      </div>
                      <div className={styles["stat-row"]}>
                        <span>Output Tokens:</span>
                        <span>{usage.output_tokens.toLocaleString()}</span>
                      </div>
                      <div className={styles["stat-row"]}>
                        <span>Total Tokens:</span>
                        <span>{usage.total_tokens.toLocaleString()}</span>
                      </div>
                      <div className={styles["stat-row"]}>
                        <span>Requests:</span>
                        <span>{usage.requests.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          </>
        )}
      </div>
    );

  // Add function to fetch online users
  const fetchOnlineUsers = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/online-users");
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setOnlineUsers(data.onlineUserIds || []);
    } catch (error) {
      console.error("Error fetching online users:", error);
    }
  }, []);

  // 初始加載
  useEffect(() => {
    // 使用延遲加載，避免同時發起多個請求
    const loadData = async () => {
      try {
        // 先加載當前用戶信息
        await fetchCurrentUser();
        
        // 然後加載用戶列表
        await fetchUsers();
        
        // 最後加載統計數據
        await fetchStats();
      } catch (error) {
        console.error("初始加載錯誤:", error);
      }
    };
    
    loadData();
    
    // 定期刷新統計數據
    const statsInterval = setInterval(() => {
      fetchStats();
    }, 60000); // 每分鐘刷新一次
    
    // Fetch online users initially and then every 30 seconds
    fetchOnlineUsers();
    const onlineUsersInterval = setInterval(() => {
      fetchOnlineUsers();
    }, 30000); // Every 30 seconds
    
    return () => {
      clearInterval(statsInterval);
      clearInterval(onlineUsersInterval);
    };
  }, [fetchCurrentUser, fetchUsers, fetchStats, fetchOnlineUsers]);

  return (
    <div className={`${styles["admin-container"]} ${styles["theme-vars"]}`}>
      <div className={`${styles["admin-sidebar"]} ${isSidebarCollapsed ? styles["collapsed"] : ""}`}>
        <div className={styles["toggle-button"]} onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>
          {isSidebarCollapsed ? ">" : "<"}
        </div>
        <div className={styles["logo"]}>
          <Image
            src="/icons/LeosysLogo.png"
            alt="Leosys Logo"
            width={40}
            height={40}
            priority
          />
        </div>
        <div className={styles["nav-items"]}>
          <a 
            href="#" 
            className={`${styles["nav-item"]} ${activeSection === "users" ? styles["active"] : ""}`}
            onClick={(e) => {
              e.preventDefault();
              handleTabChange("users");
            }}
          >
            <UsersIcon />
            <span>Users</span>
          </a>
          <a 
            href="#" 
            className={`${styles["nav-item"]} ${activeSection === "stats" ? styles["active"] : ""}`}
            onClick={(e) => {
              e.preventDefault();
              handleTabChange("stats");
            }}
          >
            <StatsIcon />
            <span>Statistics</span>
          </a>
          <a 
            href="#" 
            className={`${styles["nav-item"]} ${activeSection === "notifications" ? styles["active"] : ""}`}
            onClick={(e) => {
              e.preventDefault();
              handleTabChange("notifications");
            }}
          >
            <NotificationsIcon />
            <span>Notifications</span>
          </a>
          </div>
      </div>

      <div className={styles["admin-content"]}>

          {renderHeader()}

        {activeSection === "users" ? (
          <>
            {renderStats()}
            {renderUserManagement()}
          </>
        ) : activeSection === "notifications" ? (
          <AdminNotifications currentUser={currentUser} />
        ) : (
          renderStatsSection()
        )}

        {/* Password Change Modal */}
        {passwordChangeModal.isOpen && (
          <AdminModal
            title={`修改 ${passwordChangeModal.username} 的密碼`}
            onClose={() =>
              setPasswordChangeModal({
                isOpen: false,
                userId: null,
                username: '',
                newPassword: '',
                confirmPassword: '',
                error: '',
                showPassword: false,
              })
            }
            width="450px"
            footer={
              <div className={styles["modal-footer"]}>
                <AdminButton
                  text="取消"
                  type="default"
                  onClick={() =>
                    setPasswordChangeModal({
                      isOpen: false,
                      userId: null,
                      username: '',
                      newPassword: '',
                      confirmPassword: '',
                      error: '',
                      showPassword: false,
                    })
                  }
                />
                <AdminButton
                  text="確認修改"
                  type="primary"
                  onClick={handlePasswordChange}
                />
              </div>
            }
          >
            <div className={styles["password-change-form"]}>
              {passwordChangeModal.error && (
                <div className={styles["form-error"]}>
                  {passwordChangeModal.error}
          </div>
              )}
              
              <div className={styles["form-group"]}>
                <label htmlFor="newPassword">新密碼</label>
                <div className={styles["password-input-wrapper"]}>
                  <input
                    id="newPassword"
                    type={passwordChangeModal.showPassword ? "text" : "password"}
                    value={passwordChangeModal.newPassword}
                    onChange={(e) =>
                      setPasswordChangeModal((prev) => ({
                        ...prev,
                        newPassword: e.target.value,
                        error: '',
                      }))
                    }
                    placeholder="請輸入新密碼"
                    className={styles["enhanced-input"]}
                  />
                  <button 
                    type="button"
                    className={styles["toggle-password"]}
                    onClick={() => setPasswordChangeModal(prev => ({
                      ...prev,
                      showPassword: !prev.showPassword
                    }))}
                  >
                    {passwordChangeModal.showPassword ? "隱藏" : "顯示"}
                  </button>
                </div>
                <div className={styles["password-strength"]}>
                  <div 
                    className={`${styles["strength-bar"]} ${
                      passwordChangeModal.newPassword.length === 0 
                        ? styles["strength-none"] 
                        : passwordChangeModal.newPassword.length < 6 
                          ? styles["strength-weak"] 
                          : passwordChangeModal.newPassword.length < 10 
                            ? styles["strength-medium"] 
                            : styles["strength-strong"]
                    }`}
                  ></div>
                  <span className={styles["strength-text"]}>
                    {passwordChangeModal.newPassword.length === 0 
                      ? "" 
                      : passwordChangeModal.newPassword.length < 6 
                        ? "弱" 
                        : passwordChangeModal.newPassword.length < 10 
                          ? "中" 
                          : "強"}
            </span>
          </div>
              </div>
              
              <div className={styles["form-group"]}>
                <label htmlFor="confirmPassword">確認密碼</label>
                <input
                  id="confirmPassword"
                  type={passwordChangeModal.showPassword ? "text" : "password"}
                  value={passwordChangeModal.confirmPassword}
                  onChange={(e) =>
                    setPasswordChangeModal((prev) => ({
                      ...prev,
                      confirmPassword: e.target.value,
                      error: '',
                    }))
                  }
                  placeholder="請再次輸入新密碼"
                  className={styles["enhanced-input"]}
                />
              </div>
              
              <div className={styles["password-tips"]}>
                <p>密碼提示：</p>
                <ul>
                  <li className={passwordChangeModal.newPassword.length >= 6 ? styles["tip-met"] : ""}>
                    至少 6 個字符
                  </li>
                  <li className={/[A-Z]/.test(passwordChangeModal.newPassword) ? styles["tip-met"] : ""}>
                    包含大寫字母
                  </li>
                  <li className={/[0-9]/.test(passwordChangeModal.newPassword) ? styles["tip-met"] : ""}>
                    包含數字
                  </li>
                </ul>
              </div>
            </div>
          </AdminModal>
        )}

        {/* Add User Modal */}
        {showAddUserModal && (
          <AdminModal
            title="新增使用者"
            onClose={() => {
              setShowAddUserModal(false);
              setNewUser({ username: "", password: "", role: "user" });
            }}
            width="400px"
            footer={
              <div className={styles["modal-footer"]}>
                <AdminButton
                  text="取消"
                  type="default"
                  onClick={() => {
                    setShowAddUserModal(false);
                    setNewUser({ username: "", password: "", role: "user" });
                  }}
                />
                <AdminButton
                  text={isLoading ? "新增中..." : "確認新增"}
                  type="primary"
                  onClick={handleAddUser}
                  disabled={isLoading}
                />
              </div>
            }
          >
            <div className={styles["add-user-form-modal"]}>
              <input
                type="text"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                placeholder="使用者名稱"
              />
              <input
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                placeholder="密碼"
              />
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
              >
                <option value="user">一般使用者</option>
                <option value="admin">管理員</option>
              </select>
          </div>
          </AdminModal>
        )}

        {message && (
          <div className={`${styles["message"]} ${messageVisible ? styles["visible"] : styles["hidden"]}`}>
            {message}
        </div>
        )}
        </div>
      </div>
  );
}