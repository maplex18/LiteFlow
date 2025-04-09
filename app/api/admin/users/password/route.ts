import { NextResponse } from "next/server";
import { withDbConnection } from "@/app/utils/db";
import sha256 from "crypto-js/sha256";

export async function PUT(request: Request) {
    try {
        const { userId, newPassword } = await request.json();

        // Validate inputs
        if (!userId) {
            return NextResponse.json(
                { error: "使用者 ID 不能為空" },
                { status: 400 }
            );
        }

        if (!newPassword) {
            return NextResponse.json(
                { error: "密碼不能為空" },
                { status: 400 }
            );
        }

        if (newPassword.length < 6) {
            return NextResponse.json(
                { error: "密碼長度必須至少為 6 個字符" },
                { status: 400 }
            );
        }

        return await withDbConnection(async (connection) => {
            // Start a transaction
            await connection.beginTransaction();

            try {
                // 檢查用戶是否存在
                const [users] = await connection.execute(
                    "SELECT * FROM Account WHERE user_id = ?",
                    [userId]
                );

                if (!(users as any[])[0]) {
                    await connection.rollback();
                    return NextResponse.json(
                        { error: "找不到要修改的使用者" },
                        { status: 404 }
                    );
                }

                // 更新密碼
                const hashedPassword = sha256(newPassword).toString();
                await connection.execute(
                    "UPDATE Account SET password = ? WHERE user_id = ?",
                    [hashedPassword, userId]
                );

                // 記錄密碼修改時間
                await connection.execute(
                    "UPDATE Account SET updated_at = NOW() WHERE user_id = ?",
                    [userId]
                );

                // Commit the transaction
                await connection.commit();

                return NextResponse.json({ 
                    message: "密碼修改成功",
                    success: true
                });
            } catch (error) {
                // Rollback on error
                await connection.rollback();
                throw error;
            }
        });
    } catch (error) {
        console.error("Error updating password:", error);
        return NextResponse.json(
            {
                error: "修改密碼失敗",
                message: error instanceof Error ? error.message : "未知錯誤",
                success: false
            },
            { status: 500 }
        );
    }
}

export const runtime = "nodejs"; 