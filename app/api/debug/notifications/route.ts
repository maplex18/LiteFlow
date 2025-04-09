import { NextResponse } from "next/server";
import { withDbConnection } from "@/app/utils/db";
import { RowDataPacket } from "mysql2/promise";

// GET: 獲取所有通知（調試用）
export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  
  return await withDbConnection(async (connection) => {
    let query = `
      SELECT n.*, 
      s.username as sender_username, 
      r.username as recipient_username 
      FROM Notifications n
      JOIN Account s ON n.sender_id = s.user_id
      LEFT JOIN Account r ON n.recipient_id = r.user_id
    `;
    
    const params = [];
    
    if (userId) {
      query += ` WHERE n.recipient_id = ? OR n.recipient_id IS NULL`;
      params.push(userId);
    }
    
    query += ` ORDER BY n.created_at DESC`;
    
 
    
    const [rows] = await connection.execute<RowDataPacket[]>(query, params);
    

    
    // 獲取所有用戶
    const [users] = await connection.execute<RowDataPacket[]>(
      `SELECT user_id, username FROM Account`
    );
    
    return NextResponse.json({ 
      notifications: rows,
      users,
      query,
      params
    });
  }).catch((error) => {
    console.error("Database error:", error);
    return NextResponse.json(
      {
        message: "獲取通知列表失敗",
        error: error instanceof Error ? error.message : "未知錯誤",
      },
      { status: 500 },
    );
  });
}

export const runtime = "nodejs"; 