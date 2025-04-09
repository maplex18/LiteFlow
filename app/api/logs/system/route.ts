import { liteResponse } from "lite/server";
import { withDbConnection } from "@/app/utils/db";
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: Request) {
  try {
    const { logType, component, message, stackTrace } = await request.json();

    if (!logType || !component || !message) {
      return liteResponse.json(
        { message: "缺少必要參數" },
        { status: 400 }
      );
    }

    return await withDbConnection(async (connection) => {
      await connection.execute(
        `INSERT INTO system_logs (
          id, log_type, component, message, stack_trace
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          logType,
          component,
          message,
          stackTrace || null
        ]
      );

      return liteResponse.json({ 
        message: "系統記錄已保存",
        success: true 
      });
    });
  } catch (error) {
    console.error("Error logging system event:", error);
    return liteResponse.json(
      {
        message: "記錄系統事件失敗",
        error: error instanceof Error ? error.message : "未知錯誤",
        success: false
      },
      { status: 500 }
    );
  }
}

// GET: 獲取系統記錄
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const logType = url.searchParams.get("logType");
    const component = url.searchParams.get("component");
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    return await withDbConnection(async (connection) => {
      let query = "SELECT * FROM system_logs WHERE 1=1";
      const params: any[] = [];

      if (logType) {
        query += " AND log_type = ?";
        params.push(logType);
      }

      if (component) {
        query += " AND component = ?";
        params.push(component);
      }

      if (startDate) {
        query += " AND created_at >= ?";
        params.push(startDate);
      }

      if (endDate) {
        query += " AND created_at <= ?";
        params.push(endDate);
      }

      query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
      params.push(limit, offset);

      const [rows] = await connection.execute(query, params);

      return liteResponse.json({
        logs: rows,
        success: true
      });
    });
  } catch (error) {
    console.error("Error fetching system logs:", error);
    return liteResponse.json(
      {
        message: "獲取系統記錄失敗",
        error: error instanceof Error ? error.message : "未知錯誤",
        success: false
      },
      { status: 500 }
    );
  }
} 