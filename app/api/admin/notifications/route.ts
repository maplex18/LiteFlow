import { NextResponse } from "next/server";
import { withDbConnection } from "@/app/utils/db";
import { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import cache from "@/app/utils/cache";

export const runtime = "nodejs";

interface NotificationRow extends RowDataPacket {
  notification_id: number;
  title: string;
  content: string;
  created_at: Date;
  sender_id: number;
  recipient_id: number | null;
  read: boolean;
  sender_username?: string;
  recipient_username?: string;
}

// 緩存鍵
const CACHE_KEYS = {
  ALL_NOTIFICATIONS: 'admin:all_notifications',
};

// 定義全局類型
declare global {
  var notificationClients: Map<number, Set<{
    send: (data: string) => void;
    isActive: boolean;
    lastActivity?: number;
  }>>;
}

// 初始化全局 notification clients 管理
if (!global.notificationClients) {
  global.notificationClients = new Map();
}

// GET: 獲取所有通知 (管理員用)
export async function GET(request: Request) {
  try {
    // 獲取請求 URL 參數
    const url = new URL(request.url);
    const timestamp = url.searchParams.get("t"); // 獲取時間戳參數，用於緩存破壞
    
    // 生成唯一的緩存鍵，包含時間戳
    const cacheKey = timestamp 
      ? `${CACHE_KEYS.ALL_NOTIFICATIONS}:${timestamp}` 
      : CACHE_KEYS.ALL_NOTIFICATIONS;
    
    // 嘗試從緩存獲取通知列表
    return await cache.getOrSet(
      cacheKey,
      async () => {
        // 緩存未命中，從數據庫獲取
        return await withDbConnection(async (connection) => {
          try {
            console.log("Cache miss for key:", cacheKey, "fetching data...");
            const [rows] = await connection.execute<NotificationRow[]>(
              `SELECT n.*, 
               s.username as sender_username, 
               r.username as recipient_username 
               FROM Notifications n
               JOIN Account s ON n.sender_id = s.user_id
               LEFT JOIN Account r ON n.recipient_id = r.user_id
               ORDER BY n.created_at DESC`
            );
            
            // 確保返回的是有效的 JSON 數據
            return NextResponse.json({ 
              notifications: rows,
              timestamp: Date.now(),
              success: true
            }, {
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store, max-age=0'
              }
            });
          } catch (error) {
            console.error("獲取通知列表錯誤:", error);
            throw error;
          }
        });
      },
      15 // 緩存 15 秒
    );
  } catch (error) {
    console.error("獲取通知列表失敗:", error);
    return NextResponse.json(
      {
        message: "獲取通知列表失敗",
        error: error instanceof Error ? error.message : "未知錯誤",
        timestamp: Date.now(),
        success: false,
        notifications: [] // 返回空數組而不是 undefined
      },
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, max-age=0'
        }
      },
    );
  }
}

// POST: 創建新通知
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const { title, content, sender_id, recipient_id } = body;

    // 驗證必要欄位
    if (!title || !content || !sender_id) {
      return NextResponse.json(
        { message: "標題、內容和發送者ID為必填欄位" },
        { status: 400 }
      );
    }

    return await withDbConnection(async (connection) => {
      // 檢查發送者是否存在且為管理員
      const [senders] = await connection.execute<RowDataPacket[]>(
        "SELECT user_id, role FROM Account WHERE user_id = ?",
        [sender_id]
      ); 

      if (senders.length === 0) {
        return NextResponse.json(
          { message: "發送者不存在" },
          { status: 404 }
        );
      }

      const sender = senders[0];
      if (sender.role !== "admin") {
        return NextResponse.json(
          { message: "只有管理員可以發送通知" },
          { status: 403 }
        );
      }

      // 如果指定了接收者，檢查接收者是否存在
      if (recipient_id) {
        const [recipients] = await connection.execute<RowDataPacket[]>(
          "SELECT user_id FROM Account WHERE user_id = ?",
          [recipient_id]
        );

        if (recipients.length === 0) {
          return NextResponse.json(
            { message: "接收者不存在" },
            { status: 404 }
          );
        }
      }

      // 創建通知
      const insertQuery = `INSERT INTO Notifications (
        title, content, sender_id, recipient_id, created_at
      ) VALUES (?, ?, ?, ?, NOW())`;
      
      const [result] = await connection.execute<ResultSetHeader>(
        insertQuery,
        [title, content, sender_id, recipient_id]
      );

      // 獲取新創建的通知
      const selectQuery = `SELECT n.*, 
       s.username as sender_username, 
       r.username as recipient_username 
       FROM Notifications n
       JOIN Account s ON n.sender_id = s.user_id
       LEFT JOIN Account r ON n.recipient_id = r.user_id
       WHERE n.notification_id = ?`;
      
      const [newNotification] = await connection.execute<NotificationRow[]>(
        selectQuery,
        [(result as any).insertId]
      );

      // 通過 SSE 通知客戶端
      const notification = (newNotification as any)[0];
      
      // 如果是特定用戶的通知
      if (recipient_id && global.notificationClients.has(recipient_id)) {
        const clients = global.notificationClients.get(recipient_id);
        if (clients) {
          const invalidClients = new Set<{send: (data: string) => void, isActive: boolean}>();
          
          clients.forEach(client => {
            try {
              // 只向活動的客戶端發送通知
              if (client.isActive) {
                client.send(JSON.stringify({
                  type: 'new_notification',
                  notification
                }));
              } else {
                // 如果客戶端不活躍，標記為無效
                invalidClients.add(client);
              }
            } catch (err) {
              console.error("發送通知到特定客戶端失敗:", err);
              // 如果發送失敗，標記為無效
              client.isActive = false;
              invalidClients.add(client);
            }
          });
          
          // 清理無效客戶端
          invalidClients.forEach(client => {
            clients.delete(client);
          });
          
          // 如果該用戶沒有有效客戶端，從全局映射中移除
          if (clients.size === 0) {
            global.notificationClients.delete(recipient_id);
          }
        }
      } 
      // 如果是廣播通知，發送給所有連接的客戶端
      else if (!recipient_id) {
        global.notificationClients.forEach((clients, userId) => {
          const invalidClients = new Set<{send: (data: string) => void, isActive: boolean}>();
          
          clients.forEach(client => {
            try {
              // 只向活動的客戶端發送通知
              if (client.isActive) {
                client.send(JSON.stringify({
                  type: 'new_notification',
                  notification
                }));
              } else {
                // 如果客戶端不活躍，標記為無效
                invalidClients.add(client);
              }
            } catch (err) {
              console.error(`發送通知到用戶 ${userId} 的客戶端失敗:`, err);
              // 標記無效客戶端
              client.isActive = false;
              invalidClients.add(client);
            }
          });
          
          // 清理無效客戶端
          invalidClients.forEach(client => {
            clients.delete(client);
          });
          
          // 如果該用戶沒有有效客戶端，從全局映射中移除
          if (clients.size === 0) {
            global.notificationClients.delete(userId);
          }
        });
      }

      // 清除通知列表緩存
      cache.delete(CACHE_KEYS.ALL_NOTIFICATIONS);

      return NextResponse.json({
        message: "通知創建成功",
        notification
      });
    });
  } catch (error) {
    console.error("Error creating notification:", error);
    return NextResponse.json(
      {
        message: "創建通知失敗",
        error: error instanceof Error ? error.message : "未知錯誤"
      },
      { status: 500 }
    );
  }
}

// DELETE: 刪除通知
export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { message: "通知ID為必填參數" },
        { status: 400 }
      );
    }

    return await withDbConnection(async (connection) => {
      // 檢查通知是否存在
      const [notifications] = await connection.execute<NotificationRow[]>(
        "SELECT * FROM Notifications WHERE notification_id = ?",
        [id]
      );

      if (notifications.length === 0) {
        return NextResponse.json(
          { message: "通知不存在" },
          { status: 404 }
        );
      }

      // 刪除通知
      await connection.execute(
        "DELETE FROM Notifications WHERE notification_id = ?",
        [id]
      );

      // 通知所有客戶端通知已被刪除
      global.notificationClients.forEach((clients, userId) => {
        const invalidClients = new Set<{send: (data: string) => void, isActive: boolean}>();
        
        clients.forEach(client => {
          try {
            // 只向活動的客戶端發送通知
            if (client.isActive) {
              client.send(JSON.stringify({
                type: 'notification_deleted',
                notification_id: id
              }));
            } else {
              // 如果客戶端不活躍，標記為無效
              invalidClients.add(client);
            }
          } catch (err) {
            console.error(`發送刪除通知到用戶 ${userId} 的客戶端失敗:`, err);
            // 標記無效客戶端
            client.isActive = false;
            invalidClients.add(client);
          }
        });
        
        // 清理無效客戶端
        invalidClients.forEach(client => {
          clients.delete(client);
        });
        
        // 如果該用戶沒有有效客戶端，從全局映射中移除
        if (clients.size === 0) {
          global.notificationClients.delete(userId);
        }
      });

      // 清除通知列表緩存
      cache.delete(CACHE_KEYS.ALL_NOTIFICATIONS);

      return NextResponse.json({
        message: "通知刪除成功",
        notification_id: id
      });
    });
  } catch (error) {
    console.error("Error deleting notification:", error);
    return NextResponse.json(
      {
        message: "刪除通知失敗",
        error: error instanceof Error ? error.message : "未知錯誤"
      },
      { status: 500 }
    );
  }
} 