-- 修改 Account 表，添加登入嘗試相關欄位
ALTER TABLE Account
ADD COLUMN last_login_attempt TIMESTAMP NULL,
ADD COLUMN login_attempts INT DEFAULT 0,
ADD COLUMN last_ip_address VARCHAR(45) NULL,
ADD COLUMN last_user_agent TEXT NULL;

-- 創建登入記錄表
CREATE TABLE IF NOT EXISTS login_logs (
    id CHAR(36) PRIMARY KEY,
    user_id INT NOT NULL,
    username VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT,
    login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('success', 'failed', 'logout', 'force_logout') NOT NULL,
    failure_reason VARCHAR(255),
    INDEX idx_user_id (user_id),
    INDEX idx_login_time (login_time),
    INDEX idx_status (status),
    FOREIGN KEY (user_id) REFERENCES Account(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 創建系統運作記錄表
CREATE TABLE IF NOT EXISTS system_logs (
    id CHAR(36) PRIMARY KEY,
    log_type ENUM('error', 'warning', 'info') NOT NULL,
    component VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    stack_trace TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_log_type (log_type),
    INDEX idx_created_at (created_at),
    INDEX idx_component (component)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 創建事件來定期清理舊記錄（3個月前的記錄）
DELIMITER //

CREATE EVENT IF NOT EXISTS cleanup_old_logs
ON SCHEDULE EVERY 1 DAY
DO
BEGIN
    -- 刪除3個月前的登入記錄
    DELETE FROM login_logs 
    WHERE login_time < DATE_SUB(NOW(), INTERVAL 3 MONTH);
    
    -- 刪除3個月前的系統記錄
    DELETE FROM system_logs 
    WHERE created_at < DATE_SUB(NOW(), INTERVAL 3 MONTH);
END //

DELIMITER ;

-- 創建觸發器來記錄登入失敗
DELIMITER //

CREATE TRIGGER after_login_failure
AFTER UPDATE ON Account
FOR EACH ROW
BEGIN
    IF NEW.last_login_attempt = OLD.last_login_attempt AND NEW.login_attempts > OLD.login_attempts THEN
        INSERT INTO login_logs (id, user_id, username, ip_address, user_agent, status, failure_reason)
        VALUES (
            UUID(),
            NEW.user_id,
            NEW.username,
            NEW.last_ip_address,
            NEW.last_user_agent,
            'failed',
            'Invalid credentials'
        );
    END IF;
END //

DELIMITER ; 