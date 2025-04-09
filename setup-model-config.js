require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

// 數據庫連接配置
const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

async function main() {
  let connection;
  try {
    console.log('正在連接到數據庫...');
    connection = await mysql.createConnection(dbConfig);
    console.log('數據庫連接成功！');

    // 從 SQL 文件讀取並執行基本配置
    const sqlScript = fs.readFileSync('./setup-model-config.sql', 'utf8');
    console.log('執行基本配置 SQL 腳本...');
    await connection.query(sqlScript);
    console.log('基本配置 SQL 腳本執行完成！');

    // 從環境變數中獲取 API 密鑰並更新數據庫
    const apiConfigs = [
      { supplier: 'openai', use_for: 'OPENAI_API_KEY', value: process.env.OPENAI_API_KEY },
      { supplier: 'openai', use_for: 'OPENAI_API_KEY_ADMIN', value: process.env.OPENAI_API_KEY_ADMIN },
      { supplier: 'gemini', use_for: 'GOOGLE_API_KEY', value: process.env.GOOGLE_API_KEY },
      { supplier: 'anthropic', use_for: 'ANTHROPIC_API_KEY', value: process.env.ANTHROPIC_API_KEY },
    ];

    console.log('正在更新 API 密鑰...');
    for (const config of apiConfigs) {
      if (config.value) {
        await connection.query(
          `INSERT INTO model (id, supplier, use_for, api_key) 
           VALUES (?, ?, ?, ?) 
           ON DUPLICATE KEY UPDATE api_key = VALUES(api_key), updated_at = CURRENT_TIMESTAMP`,
          [uuidv4(), config.supplier, config.use_for, config.value]
        );
        console.log(`已更新 ${config.use_for}`);
      } else {
        console.log(`警告: ${config.use_for} 在環境變數中未找到`);
      }
    }

    console.log('所有配置已成功更新到數據庫！');

    // 檢查所有配置
    const [rows] = await connection.query('SELECT supplier, use_for, api_key FROM model');
    console.log('\n當前數據庫中的配置:');
    console.table(rows.map(row => ({
      supplier: row.supplier,
      use_for: row.use_for,
      api_key: row.use_for.includes('API_KEY') ? `${row.api_key.substring(0, 5)}...` : row.api_key
    })));

  } catch (error) {
    console.error('錯誤:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('數據庫連接已關閉');
    }
  }
}

main(); 