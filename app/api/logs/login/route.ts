import { liteResponse } from "lite/server";
import { withDbConnection } from "@/app/utils/db";
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: Request) {
  try {
    const { userId, username, ipAddress, userAgent, status, failureReason } = await request.json();

    if (!userId || !username || !ipAddress || !status) {
      return liteResponse.json(
        { message: "缺少必要參數" },
        { status: 400 }
      );
    }

    return await withDbConnection(async (connection) => {
      await connection.execute(
        `INSERT INTO login_logs (
          id, user_id, username, ip_address, 
          user_agent, status, failure_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          userId,
          username,
          ipAddress,
          userAgent || null,
          status,
          failureReason || null
        ]
      );

      return liteResponse.json({ 
        message: "登入記錄已保存",
        success: true 
      });
    });
  } catch (error) {
    console.error("Error logging login:", error);
    return liteResponse.json(
      {
        message: "記錄登入失敗",
        error: error instanceof Error ? error.message : "未知錯誤",
        success: false
      },
      { status: 500 }
    );
  }
}

// GET: 獲取登入記錄
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const status = url.searchParams.get("status");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    return await withDbConnection(async (connection) => {
      let query = "SELECT * FROM login_logs WHERE 1=1";
      const params: any[] = [];

      if (userId) {
        query += " AND user_id = ?";
        params.push(userId);
      }

      if (startDate) {
        query += " AND login_time >= ?";
        params.push(startDate);
      }

      if (endDate) {
        query += " AND login_time <= ?";
        params.push(endDate);
      }

      if (status) {
        query += " AND status = ?";
        params.push(status);
      }

      query += " ORDER BY login_time DESC LIMIT ? OFFSET ?";
      params.push(limit, offset);

      const [rows] = await connection.execute(query, params);

      return liteResponse.json({
        logs: rows,
        success: true
      });
    });
  } catch (error) {
    console.error("Error fetching login logs:", error);
    return liteResponse.json(
      {
        message: "獲取登入記錄失敗",
        error: error instanceof Error ? error.message : "未知錯誤",
        success: false
      },
      { status: 500 }
    );
  }
} 