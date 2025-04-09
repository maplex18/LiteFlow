import { NextResponse } from "next/server";
import { withDbConnection } from "@/app/utils/db";
import sha256 from "crypto-js/sha256";

export async function PUT(
    request: Request,
    { params }: { params: { userId: string } }
) {
    try {
        const userId = params.userId;
        const { password } = await request.json();

        if (!password) {
            return NextResponse.json(
                { message: "密碼不能為空" },
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
                        { message: "找不到要修改的使用者" },
                        { status: 404 }
                    );
                }

                // 更新密碼
                const hashedPassword = sha256(password).toString();
                await connection.execute(
                    "UPDATE Account SET password = ? WHERE user_id = ?",
                    [hashedPassword, userId]
                );

                // Commit the transaction
                await connection.commit();

                return NextResponse.json({ message: "密碼修改成功" });
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
                message: "修改密碼失敗",
                error: error instanceof Error ? error.message : "未知錯誤"
            },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: { userId: string } }
) {
    try {
        const userId = params.userId;

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
                        { message: "找不到要刪除的使用者" },
                        { status: 404 }
                    );
                }

                // 檢查是否為管理員
                const user = (users as any[])[0];
                if (user.role === 'admin') {
                    await connection.rollback();
                    return NextResponse.json(
                        { message: "無法刪除管理員帳號" },
                        { status: 403 }
                    );
                }

                // 執行刪除操作
                await connection.execute(
                    "DELETE FROM Account WHERE user_id = ?",
                    [userId]
                );

                // Commit the transaction
                await connection.commit();

                return NextResponse.json({ message: "使用者刪除成功" });
            } catch (error) {
                // Rollback on error
                await connection.rollback();
                throw error;
            }
        });
    } catch (error) {
        console.error("Error deleting user:", error);
        return NextResponse.json(
            {
                message: "刪除使用者失敗",
                error: error instanceof Error ? error.message : "未知錯誤"
            },
            { status: 500 }
        );
    }
}

export const runtime = "nodejs"; 