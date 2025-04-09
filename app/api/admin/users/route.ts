import { NextResponse } from "next/server";
import { withDbConnection } from "@/app/utils/db";
import sha256 from "crypto-js/sha256";
import { v4 as uuidv4 } from "uuid";
import { Connection, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import cache from "@/app/utils/cache";

export const runtime = "nodejs";

interface UserRow extends RowDataPacket {
  user_id: number;
  username: string;
  role: string;
  upstashName: string;
  sessionToken: string;
  createdAt: Date;
  lastLogin: Date;
}

// 緩存鍵
const CACHE_KEYS = {
  ALL_USERS: 'admin:all_users',
};

// GET: 獲取所有用戶 (管理員用)
export async function GET(request: Request) {
  try {
    // 獲取請求 URL 參數
    const url = new URL(request.url);
    const timestamp = url.searchParams.get("t"); // 獲取時間戳參數，用於緩存破壞
    
    // 生成唯一的緩存鍵，包含時間戳
    const cacheKey = timestamp 
      ? `${CACHE_KEYS.ALL_USERS}:${timestamp}` 
      : CACHE_KEYS.ALL_USERS;
    
    // 嘗試從緩存獲取用戶列表
    return await cache.getOrSet(
      cacheKey,
      async () => {
        // 緩存未命中，從數據庫獲取
        return await withDbConnection(async (connection) => {
          try {
            console.log("Cache miss for key:", cacheKey, "fetching data...");
            const [rows] = await connection.execute<UserRow[]>(
              `SELECT user_id, username, role, createdAt, lastLogin 
               FROM Account 
               ORDER BY role = 'admin' DESC, username ASC`
            );
            return NextResponse.json({ 
              users: rows,
              timestamp: Date.now(),
              success: true
            }, {
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store, max-age=0'
              }
            });
          } catch (error) {
            console.error("獲取用戶列表錯誤:", error);
            throw error;
          }
        });
      },
      30 // 緩存 30 秒
    );
  } catch (error) {
    console.error("獲取用戶列表失敗:", error);
    return NextResponse.json(
      {
        message: "獲取用戶列表失敗",
        error: error instanceof Error ? error.message : "未知錯誤",
        timestamp: Date.now(),
        success: false,
        users: [] // 返回空數組而不是 undefined
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

// 生成隨機 upstash 名稱
function generateUpstashName() {
  return `upstash_${uuidv4().substring(0, 8)}`;
}

// 檢查 upstash 名稱是否已存在
async function isUpstashNameExists(
  connection: Connection,
  upstashName: string,
) {
  const [rows] = await connection.execute(
    "SELECT COUNT(*) as count FROM Account WHERE upstashName = ?",
    [upstashName],
  );
  return (rows as any)[0].count > 0;
}

// POST: 創建新使用者
export async function POST(request: Request) {
  try {
    const { username, password, role } = await request.json();

    return await withDbConnection(async (connection) => {
      // 檢查用戶名是否已存在
      const [existingUsers] = await connection.execute<UserRow[]>(
        "SELECT username FROM Account WHERE username = ?",
        [username]
      );

      if (existingUsers.length > 0) {
        return NextResponse.json(
          { 
            message: "使用者名稱已存在",
            success: false
          },
          { 
            status: 400,
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
      }

      const hashedPassword = sha256(password).toString();
      let upstashName = generateUpstashName();

      // 檢查 upstash 名稱是否存在
      while (await isUpstashNameExists(connection, upstashName)) {
        upstashName = generateUpstashName();
      }

      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO Account (
          username, password, role, upstashName,
          createdAt, lastLogin
        ) VALUES (?, ?, ?, ?, NOW(), NOW())`,
        [username, hashedPassword, role, upstashName]
      );

      const [newUser] = await connection.execute<UserRow[]>(
        "SELECT user_id, username, role, upstashName, createdAt, lastLogin FROM Account WHERE user_id = ?",
        [(result as any).insertId]
      );

      // 清除用戶列表緩存
      cache.delete(CACHE_KEYS.ALL_USERS);

      return NextResponse.json({
        message: "使用者創建成功",
        user: (newUser as any)[0],
        success: true
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
    });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      {
        message: "創建使用者失敗",
        error: error instanceof Error ? error.message : "未知錯誤",
        success: false
      },
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}
