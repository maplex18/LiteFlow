import { liteResponse } from "lite/server";
import { withDbConnection } from "@/app/utils/db";
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

interface StatsItem {
    item: string;
    value: number;
}

export const runtime = "nodejs";

export async function POST(request: Request) {
    try {
        const { stats } = await request.json();

        return await withDbConnection(async (connection) => {
            const currentTime = toZonedTime(new Date(), 'Asia/Taipei');
            const formattedTime = format(currentTime, 'yyyy-MM-dd HH:mm:ss');

            // 先獲取當日的使用量
            const [dailyStats] = await connection.execute(
                `SELECT daily_item, SUM(daily_value) as total_value 
                 FROM daily_usage 
                 WHERE DATE(time) = DATE(?) 
                 GROUP BY daily_item`,
                [currentTime]
            );

            // 計算當日累計使用量
            const dailyTotalRequests = stats.find((stat: StatsItem) => stat.item === 'daily_net_commands')?.value || 0;

            // 將當日總使用量加入到 stats 中
            stats.push({
                item: 'daily_total_requests',
                value: dailyTotalRequests
            });

            // 修改 placeholders 以包含三個欄位
            const placeholders = stats.map(() => '(?, ?, ?)').join(', ');

            // 為每個記錄建立包含時間的值陣列
            const flatValues = stats.flatMap((stat: StatsItem) => [
                currentTime,
                stat.item,
                stat.value
            ]);

            const [result] = await connection.execute(
                `REPLACE INTO daily_usage (time, daily_item, daily_value) VALUES ${placeholders}`,
                flatValues
            );

            return liteResponse.json({
                message: "統計資料儲存成功",
                result,
                dailyStats
            });
        });
    } catch (error) {
        console.error("Error storing stats:", error);
        return liteResponse.json(
            {
                message: "儲存統計資料失敗",
                error: error instanceof Error ? error.message : "未知錯誤"
            },
            { status: 500 }
        );
    }
} 