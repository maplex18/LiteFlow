import { liteResponse } from "lite/server";
import { withDbConnection } from "@/app/utils/db";

export async function GET(request: Request) {
    try {
        // 從 localStorage 獲取用戶信息
        const userInfoStr = request.headers.get("X-User-Info");
        if (!userInfoStr) {
            return liteResponse.json(
                { message: "未找到用戶信息" },
                { status: 401 }
            );
        }

        return await withDbConnection(async (connection) => {
            // 從數據庫獲取最新的用戶信息
            const [users] = await connection.execute(
                "SELECT user_id, username, role, createdAt, lastLogin FROM Account WHERE username = ?",
                [JSON.parse(userInfoStr).username]
            );

            if (!(users as any[])[0]) {
                return liteResponse.json(
                    { message: "未找到用戶" },
                    { status: 404 }
                );
            }

            return liteResponse.json((users as any[])[0]);
        });
    } catch (error) {
        console.error("Error getting current user:", error);
        return liteResponse.json(
            {
                message: "獲取當前用戶失敗",
                error: error instanceof Error ? error.message : "未知錯誤"
            },
            { status: 500 }
        );
    }
}

export const runtime = "nodejs"; 