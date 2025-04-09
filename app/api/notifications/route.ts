import { liteResponse } from "lite/server";
import { withDbConnection } from "@/app/utils/db";
import { RowDataPacket, ResultSetHeader } from "mysql2/promise";

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
}

// GET: 獲取用戶的通知
export async function GET(request: Request) {
  try {
    // 從 header 獲取用戶信息
    const userInfoStr = request.headers.get("X-User-Info");

    
    if (!userInfoStr) {
      return liteResponse.json(
        { message: "未找到用戶信息" },
        { status: 401 }
      );
    }

    let userInfo;
    try {
      userInfo = JSON.parse(userInfoStr);
    } catch (error) {
      console.error("解析用戶信息失敗:", error);
      return liteResponse.json(
        { message: "用戶信息格式錯誤" },
        { status: 400 }
      );
    }
    
    const username = userInfo.username;
 

    return await withDbConnection(async (connection) => {
      // 獲取用戶 ID
      const [users] = await connection.execute<RowDataPacket[]>(
        "SELECT user_id FROM Account WHERE username = ?",
        [username]
      );
      


      if (users.length === 0) {
        return liteResponse.json(
          { message: "用戶不存在" },
          { status: 404 }
        );
      }

      const userId = users[0].user_id;

      // 獲取用戶的通知 (包括廣播通知和專門發給該用戶的通知)
      const query = `SELECT n.*, s.username as sender_username
         FROM Notifications n
         JOIN Account s ON n.sender_id = s.user_id
         WHERE n.recipient_id IS NULL OR n.recipient_id = ?
         ORDER BY n.created_at DESC`;
      

      
      const [notifications] = await connection.execute<NotificationRow[]>(query, [userId]);
      

      return liteResponse.json({ notifications });
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return liteResponse.json(
      {
        message: "獲取通知失敗",
        error: error instanceof Error ? error.message : "未知錯誤"
      },
      { status: 500 }
    );
  }
}

// PUT: 標記通知為已讀
export async function PUT(request: Request) {
  try {
    const { notification_id } = await request.json();
    const userInfoStr = request.headers.get("X-User-Info");
    
    if (!userInfoStr) {
      return liteResponse.json(
        { message: "未找到用戶信息" },
        { status: 401 }
      );
    }

    const userInfo = JSON.parse(userInfoStr);
    const username = userInfo.username;

    return await withDbConnection(async (connection) => {
      // 獲取用戶 ID
      const [users] = await connection.execute<RowDataPacket[]>(
        "SELECT user_id FROM Account WHERE username = ?",
        [username]
      );

      if (users.length === 0) {
        return liteResponse.json(
          { message: "用戶不存在" },
          { status: 404 }
        );
      }

      const userId = users[0].user_id;

      // 檢查通知是否存在且屬於該用戶
      const [notifications] = await connection.execute<NotificationRow[]>(
        `SELECT * FROM Notifications 
         WHERE notification_id = ? AND (recipient_id IS NULL OR recipient_id = ?)`,
        [notification_id, userId]
      );

      if (notifications.length === 0) {
        return liteResponse.json(
          { message: "通知不存在或不屬於該用戶" },
          { status: 404 }
        );
      }

      // 標記通知為已讀
      await connection.execute(
        "UPDATE Notifications SET `read` = TRUE WHERE notification_id = ?",
        [notification_id]
      );

      return liteResponse.json({ message: "通知已標記為已讀" });
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return liteResponse.json(
      {
        message: "標記通知失敗",
        error: error instanceof Error ? error.message : "未知錯誤"
      },
      { status: 500 }
    );
  }
}

// PATCH: 標記所有通知為已讀
export async function PATCH(request: Request) {
  try {
    const userInfoStr = request.headers.get("X-User-Info");
    
    if (!userInfoStr) {
      return liteResponse.json(
        { message: "未找到用戶信息" },
        { status: 401 }
      );
    }

    const userInfo = JSON.parse(userInfoStr);
    const username = userInfo.username;

    return await withDbConnection(async (connection) => {
      // 獲取用戶 ID
      const [users] = await connection.execute<RowDataPacket[]>(
        "SELECT user_id FROM Account WHERE username = ?",
        [username]
      );

      if (users.length === 0) {
        return liteResponse.json(
          { message: "用戶不存在" },
          { status: 404 }
        );
      }

      const userId = users[0].user_id;

      // 標記所有通知為已讀
      await connection.execute(
        `UPDATE Notifications SET \`read\` = TRUE 
         WHERE (recipient_id IS NULL OR recipient_id = ?) AND \`read\` = FALSE`,
        [userId]
      );

      return liteResponse.json({ message: "所有通知已標記為已讀" });
    });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    return liteResponse.json(
      {
        message: "標記所有通知失敗",
        error: error instanceof Error ? error.message : "未知錯誤"
      },
      { status: 500 }
    );
  }
} 