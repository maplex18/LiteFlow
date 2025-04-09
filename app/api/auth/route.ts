import { liteResponse } from "lite/server";
import { withDbConnection, getApiKeyFromDb } from "@/app/utils/db";
import { RowDataPacket } from "mysql2/promise";
import { v4 as uuidv4 } from 'uuid';

interface UserRow extends RowDataPacket {
  user_id: number;
  username: string;
  password: string;
  role: string;
  language: string;
  upstashName: string;
  sessionToken: string;
}

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { username, password, forceLogin } = await request.json();

    return await withDbConnection(async (connection) => {
      // 檢查使用者是否存在
      const [rows] = await connection.execute<UserRow[]>(
        "SELECT * FROM Account WHERE username = ?",
        [username],
      );

      if (!Array.isArray(rows) || rows.length === 0) {
        // 記錄登入失敗
        await connection.execute(
          `INSERT INTO login_logs (
            id, user_id, username, ip_address, 
            user_agent, status, failure_reason
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            0, // 未知用戶ID
            username,
            request.headers.get("x-forwarded-for") || "unknown",
            request.headers.get("user-agent") || null,
            "failed",
            "User not found"
          ]
        );

        return liteResponse.json(
          { message: "使用者名或密碼錯誤" },
          { status: 401 },
        );
      }

      const user = rows[0];
      if (password !== user.password) {
        // 記錄登入失敗
        await connection.execute(
          `INSERT INTO login_logs (
            id, user_id, username, ip_address, 
            user_agent, status, failure_reason
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            user.user_id,
            username,
            request.headers.get("x-forwarded-for") || "unknown",
            request.headers.get("user-agent") || null,
            "failed",
            "Invalid password"
          ]
        );

        return liteResponse.json(
          { message: "使用者名或密碼錯誤" },
          { status: 401 },
        );
      }

      // 檢查是否有其他裝置登入
      if (user.sessionToken && !forceLogin) {
        return liteResponse.json(
          { 
            message: "此帳號已在其他裝置登入",
            requireForceLogin: true,
            userId: user.user_id
          },
          { status: 409 }
        );
      }

      // 如果是強制登入，先觸發舊 session 的登出事件
      if (forceLogin && user.sessionToken) {
        // 這裡可以觸發 SSE 事件通知舊的 session 登出
        global.sessionClients?.get(user.user_id)?.forEach(client => {
          client.send("session_invalidated");
        });
      }

      // 生成新的 session token
      const newSessionToken = uuidv4();

      // 更新 session token 和最後登入時間
      await connection.execute(
        "UPDATE Account SET sessionToken = ?, lastLogin = NOW() WHERE user_id = ?",
        [newSessionToken, user.user_id],
      );

      // 記錄登入成功
      await connection.execute(
        `INSERT INTO login_logs (
          id, user_id, username, ip_address, 
          user_agent, status
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          user.user_id,
          username,
          request.headers.get("x-forwarded-for") || "unknown",
          request.headers.get("user-agent") || null,
          "success"
        ]
      );

      // 獲取 OpenAI API key
      const openaiApiKey = await getApiKeyFromDb("OPENAI_API_KEY");
      console.log("[Auth API] OpenAI API Key from database:", openaiApiKey ? "有值" : "無值", "長度:", openaiApiKey.length);

      return liteResponse.json({
        user: {
          ...rows[0],
          password: undefined,
          sessionToken: newSessionToken
        },
        upstash: {
          username: user.upstashName,
          endpoint: process.env.UPSTASH_REDIS_REST_URL,
          apiKey: process.env.UPSTASH_REDIS_REST_TOKEN,
        },
        openaiApiKey: openaiApiKey,
      });
    });
  } catch (error) {
    console.error("Login error:", error);
    return liteResponse.json(
      {
        message: "服務器錯誤",
        error: error instanceof Error ? error.message : "未知錯誤",
      },
      { status: 500 },
    );
  }
}

// 新增登出 API
export async function DELETE(request: Request) {
  try {
    const { userId, sessionToken } = await request.json();

    return await withDbConnection(async (connection) => {
      // 驗證 session token
      const [rows] = await connection.execute<UserRow[]>(
        "SELECT * FROM Account WHERE user_id = ? AND sessionToken = ?",
        [userId, sessionToken],
      );

      if (!Array.isArray(rows) || rows.length === 0) {
        return liteResponse.json(
          { message: "無效的 session" },
          { status: 401 },
        );
      }

      // 清除 session token
      await connection.execute(
        "UPDATE Account SET sessionToken = NULL WHERE user_id = ?",
        [userId],
      );

      return liteResponse.json({ message: "登出成功" });
    });
  } catch (error) {
    console.error("Logout error:", error);
    return liteResponse.json(
      {
        message: "服務器錯誤",
        error: error instanceof Error ? error.message : "未知錯誤",
      },
      { status: 500 },
    );
  }
}
