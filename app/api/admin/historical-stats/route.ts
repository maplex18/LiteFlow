import { NextResponse } from "next/server";
import { withDbConnection } from "@/app/utils/db";

export const runtime = "nodejs";

export async function GET() {
    try {
        return await withDbConnection(async (connection) => {
            // 獲取最近24小時的數據，包含差異值和總值
            const [rows] = await connection.execute(`
                WITH hourly_data AS (
                    SELECT 
                        DATE_FORMAT(time, '%Y-%m-%d %H:00:00') as hour_start,
                        daily_item,
                        daily_value,
                        LAG(daily_value) OVER (PARTITION BY daily_item ORDER BY time) as prev_value
                    FROM daily_usage 
                    WHERE daily_item = 'monthly_requests'
                    AND time >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                )
                SELECT 
                    hour_start as time,
                    daily_value as total_value,
                    CASE 
                        WHEN prev_value IS NULL THEN daily_value
                        ELSE daily_value - prev_value 
                    END as diff_value
                FROM hourly_data
                ORDER BY hour_start ASC
            `);

            return NextResponse.json(rows);
        });
    } catch (error) {
        console.error("Error fetching historical stats:", error);
        return NextResponse.json(
            {
                message: "獲取歷史數據失敗",
                error: error instanceof Error ? error.message : "未知錯誤"
            },
            { status: 500 }
        );
    }
} 