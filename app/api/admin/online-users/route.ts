import { NextResponse } from "next/server";
import { withDbConnection } from "@/app/utils/db";
import { RowDataPacket } from "mysql2/promise";
import cache from "@/app/utils/cache";

export const runtime = "nodejs";

interface OnlineUserRow extends RowDataPacket {
  user_id: number;
  last_activity: Date;
}

// Cache key for online users
const ONLINE_USERS_CACHE_KEY = 'admin:online_users';

// Time threshold for considering a user online (in minutes)
const ONLINE_THRESHOLD_MINUTES = 5;

// GET: Get all online users
export async function GET(request: Request) {
  try {
    // Try to get from cache first
    return await cache.getOrSet(
      ONLINE_USERS_CACHE_KEY,
      async () => {
        // Cache miss, fetch from database
        return await withDbConnection(async (connection) => {
          try {
            console.log("Fetching online users from database...");
            
            // Get users with recent activity (within the last 5 minutes)
            const [rows] = await connection.execute<OnlineUserRow[]>(
              `SELECT user_id 
               FROM Account 
               WHERE lastLogin > DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
              [ONLINE_THRESHOLD_MINUTES]
            );
            
            // Extract user IDs
            const onlineUserIds = rows.map(row => row.user_id);
            
            return NextResponse.json({ 
              onlineUserIds,
              count: onlineUserIds.length,
              timestamp: Date.now(),
              success: true
            }, {
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store, max-age=0'
              }
            });
          } catch (error) {
            console.error("Error fetching online users:", error);
            throw error;
          }
        });
      },
      15 // Cache for 15 seconds
    );
  } catch (error) {
    console.error("Failed to get online users:", error);
    return NextResponse.json(
      {
        message: "Failed to get online users",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: Date.now(),
        success: false,
        onlineUserIds: [] // Return empty array instead of undefined
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

// POST: Update user's last activity time
export async function POST(request: Request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { 
          message: "User ID is required",
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

    return await withDbConnection(async (connection) => {
      // Update the user's last activity time
      await connection.execute(
        "UPDATE Account SET lastLogin = NOW() WHERE user_id = ?",
        [userId]
      );

      // Clear the online users cache
      cache.delete(ONLINE_USERS_CACHE_KEY);

      return NextResponse.json({
        message: "User activity updated",
        success: true
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
    });
  } catch (error) {
    console.error("Error updating user activity:", error);
    return NextResponse.json(
      {
        message: "Failed to update user activity",
        error: error instanceof Error ? error.message : "Unknown error",
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