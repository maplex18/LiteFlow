import { liteResponse } from 'lite/server';
import { withDbConnection } from "@/app/utils/db";
import { RowDataPacket } from "mysql2/promise";
import cache from "@/app/utils/cache";

// 緩存鍵
const CACHE_KEYS = {
  ADMIN_STATS: 'admin:stats',
};

// GET: 獲取管理員統計數據
export async function GET() {
  try {
    // 嘗試從緩存獲取統計數據
    return await cache.getOrSet(
      CACHE_KEYS.ADMIN_STATS,
      async () => {
        // 緩存未命中，從數據庫獲取
        return await withDbConnection(async (connection) => {
          try {
            // 獲取用戶總數
            const [userCountResult] = await connection.execute<RowDataPacket[]>(
              "SELECT COUNT(*) as count FROM Account"
            );
            const userCount = userCountResult[0].count;

            // 獲取管理員數量
            const [adminCountResult] = await connection.execute<RowDataPacket[]>(
              "SELECT COUNT(*) as count FROM Account WHERE role = 'admin'"
            );
            const adminCount = adminCountResult[0].count;

            // 獲取普通用戶數量
            const [userRoleCountResult] = await connection.execute<RowDataPacket[]>(
              "SELECT COUNT(*) as count FROM Account WHERE role = 'user'"
            );
            const userRoleCount = userRoleCountResult[0].count;

            // 獲取通知總數
            const [notificationCountResult] = await connection.execute<RowDataPacket[]>(
              "SELECT COUNT(*) as count FROM Notifications"
            );
            const notificationCount = notificationCountResult[0].count;

            // 獲取未讀通知數量
            const [unreadNotificationCountResult] = await connection.execute<RowDataPacket[]>(
              "SELECT COUNT(*) as count FROM Notifications WHERE `read` = 0"
            );
            const unreadNotificationCount = unreadNotificationCountResult[0].count;

            // 獲取最近 7 天的新用戶數量
            const [newUsersResult] = await connection.execute<RowDataPacket[]>(
              "SELECT COUNT(*) as count FROM Account WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)"
            );
            const newUsersCount = newUsersResult[0].count;

            // 獲取最近 7 天的活躍用戶數量
            const [activeUsersResult] = await connection.execute<RowDataPacket[]>(
              "SELECT COUNT(*) as count FROM Account WHERE lastLogin >= DATE_SUB(NOW(), INTERVAL 7 DAY)"
            );
            const activeUsersCount = activeUsersResult[0].count;

            // 獲取最近 7 天的新通知數量
            const [newNotificationsResult] = await connection.execute<RowDataPacket[]>(
              "SELECT COUNT(*) as count FROM Notifications WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)"
            );
            const newNotificationsCount = newNotificationsResult[0].count;

            // 返回統計數據
            return liteResponse.json({
              users: {
                total: userCount,
                admin: adminCount,
                user: userRoleCount,
                newUsers: newUsersCount,
                activeUsers: activeUsersCount,
              },
              notifications: {
                total: notificationCount,
                unread: unreadNotificationCount,
                newNotifications: newNotificationsCount,
              },
              timestamp: new Date().toISOString(),
            });
          } catch (error) {
            console.error("獲取統計數據錯誤:", error);
            throw error;
          }
        });
      },
      60 // 緩存 60 秒
    );
  } catch (error) {
    console.error("獲取統計數據失敗:", error);
    return liteResponse.json(
      {
        message: "獲取統計數據失敗",
        error: error instanceof Error ? error.message : "未知錯誤",
      },
      { status: 500 },
    );
  }
}

// 清除統計數據緩存
export async function POST() {
  try {
    // 清除統計數據緩存
    cache.delete(CACHE_KEYS.ADMIN_STATS);
    
    return liteResponse.json({
      message: "統計數據緩存已清除",
      success: true,
    });
  } catch (error) {
    console.error("清除統計數據緩存失敗:", error);
    return liteResponse.json(
      {
        message: "清除統計數據緩存失敗",
        error: error instanceof Error ? error.message : "未知錯誤",
      },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs'; 