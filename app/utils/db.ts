import mysql from 'mysql2/promise';
import { Pool, Connection } from 'mysql2/promise';

// 數據庫連接配置
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT || '3306'),
    connectTimeout: 10000,     // 增加連接超時時間
    connectionLimit: 20,       // 增加連接池大小
    queueLimit: 0,             // 隊列無限制
    waitForConnections: true,  // 等待連接
    enableKeepAlive: true,     // 保持連接活躍
    keepAliveInitialDelay: 10000, // 保持連接活躍的初始延遲
    namedPlaceholders: true,   // 使用命名佔位符
};

// 創建連接池
let pool: Pool | null = null;

// 獲取連接池
const getPool = (): Pool => {
    if (!pool) {
        console.log("Creating new database connection pool");
        pool = mysql.createPool(dbConfig);
        
        // 監聽連接池事件
        pool.on('connection', () => {
            console.log('New connection established in the pool');
        });
        
        // 使用 process.on 來處理未捕獲的錯誤
        process.on('unhandledRejection', (err) => {
            console.error('Database pool unhandled rejection:', err);
            // 如果連接池出錯，重置連接池
            if (err instanceof Error && 
                (err.message.includes('ETIMEDOUT') || 
                 err.message.includes('ECONNREFUSED') ||
                 err.message.includes('Connection lost'))) {
                console.log('Resetting connection pool due to connection error');
                pool = null;
            }
        });
    }
    return pool;
};

// 創建數據庫連接，帶有重試機制
const createDbConnection = async (retries = 3, delay = 1000): Promise<Connection> => {
    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        console.log('Database connection established successfully');
        return connection;
    } catch (error) {
        console.error(`Database connection error (retries left: ${retries}):`, error);
        
        if (retries <= 0) {
            throw error;
        }
        
        // 等待一段時間後重試
        await new Promise(resolve => setTimeout(resolve, delay));
        return createDbConnection(retries - 1, delay * 1.5);
    }
};

// 使用數據庫連接執行操作
export const withDbConnection = async <T>(
    callback: (connection: Connection) => Promise<T>
): Promise<T> => {
    let connection: Connection | null = null;
    
    try {
        connection = await createDbConnection();
        return await callback(connection);
    } catch (error) {
        console.error("Database operation error:", error);
        
        // 如果是連接錯誤，重置連接池
        if (error instanceof Error && 
            (error.message.includes('ETIMEDOUT') || 
             error.message.includes('ECONNREFUSED') ||
             error.message.includes('Connection lost'))) {
            console.log('Resetting connection pool due to connection error');
            pool = null;
        }
        
        throw error;
    } finally {
        if (connection) {
            try {
                (connection as any).release();
                console.log('Database connection released back to the pool');
            } catch (releaseError) {
                console.error("Error releasing connection:", releaseError);
            }
        }
    }
};

// 關閉連接池
export const closePool = async (): Promise<void> => {
    if (pool) {
        try {
            await pool.end();
            pool = null;
            console.log("Database connection pool closed");
        } catch (error) {
            console.error("Error closing database connection pool:", error);
            throw error;
        }
    }
};

// 簡單查詢函數，用於快速執行簡單查詢
export const executeQuery = async <T>(
    query: string, 
    params: any[] = []
): Promise<T> => {
    return withDbConnection(async (connection) => {
        const [results] = await connection.execute(query, params);
        return results as T;
    });
};

// 從 model 資料表獲取 API key
export const getApiKeyFromDb = async (useFor: string): Promise<string> => {
    try {
        return await withDbConnection(async (connection) => {
            const [rows] = await connection.execute(
                'SELECT api_key FROM model WHERE use_for = ? ORDER BY updated_at DESC LIMIT 1',
                [useFor]
            );
            
            const result = rows as any[];
            if (result.length > 0 && result[0].api_key) {
                console.log(`[DB] 從資料庫獲取 ${useFor} API key 成功，長度:`, result[0].api_key.length);
                return result[0].api_key;
            }
            
            console.log(`[DB] 資料庫中沒有找到 ${useFor} 的 API key`);
            return '';
        });
    } catch (error) {
        console.error(`[DB] 獲取 ${useFor} API key 時發生錯誤:`, error);
        return '';
    }
}; 