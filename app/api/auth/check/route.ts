import { liteResponse } from "lite/server";
import { withDbConnection } from "@/app/utils/db";
import { RowDataPacket } from "mysql2/promise";

export const runtime = "nodejs";

interface UserRow extends RowDataPacket {
  user_id: number;
  username: string;
  sessionToken: string;
}

export async function POST(request: Request) {
  try {
    const { userId, sessionToken } = await request.json();

    return await withDbConnection(async (connection) => {
      // 檢查 session token 是否有效
      const [rows] = await connection.execute<UserRow[]>(
        "SELECT * FROM Account WHERE user_id = ? AND sessionToken = ?",
        [userId, sessionToken],
      );

      if (!Array.isArray(rows) || rows.length === 0) {
        return liteResponse.json({ valid: false }, { status: 401 });
      }

      return liteResponse.json({ valid: true });
    });
  } catch (error) {
    console.error("Session check error:", error);
    return liteResponse.json(
      {
        message: "服務器錯誤",
        error: error instanceof Error ? error.message : "未知錯誤",
      },
      { status: 500 },
    );
  }
} 