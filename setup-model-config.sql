-- 刪除已存在的配置（可選）
-- DELETE FROM model WHERE use_for IN (
--   'OPENAI_API_KEY', 'OPENAI_API_KEY_ADMIN', 'OPENAI_ORG_ID', 'OPENAI_URL',
--   'GOOGLE_API_KEY', 'GOOGLE_API_VERSION', 'GOOGLE_URL',
--   'ANTHROPIC_API_KEY', 'ANTHROPIC_API_VERSION', 'ANTHROPIC_URL'
-- );

-- OpenAI 配置
INSERT INTO model (id, supplier, use_for, api_key)
VALUES (UUID(), 'openai', 'OPENAI_URL', 'https://api.openai.com')
ON DUPLICATE KEY UPDATE api_key = VALUES(api_key), updated_at = CURRENT_TIMESTAMP;

INSERT INTO model (id, supplier, use_for, api_key)
VALUES (UUID(), 'openai', 'OPENAI_ORG_ID', 'org-Ea1AOS31Ar8pDXZWitrqBw1f')
ON DUPLICATE KEY UPDATE api_key = VALUES(api_key), updated_at = CURRENT_TIMESTAMP;

-- Google 配置
INSERT INTO model (id, supplier, use_for, api_key)
VALUES (UUID(), 'gemini', 'GOOGLE_API_VERSION', 'v1beta')
ON DUPLICATE KEY UPDATE api_key = VALUES(api_key), updated_at = CURRENT_TIMESTAMP;

INSERT INTO model (id, supplier, use_for, api_key)
VALUES (UUID(), 'gemini', 'GOOGLE_URL', 'https://generativelanguage.googleapis.com/')
ON DUPLICATE KEY UPDATE api_key = VALUES(api_key), updated_at = CURRENT_TIMESTAMP;

-- Anthropic 配置
INSERT INTO model (id, supplier, use_for, api_key)
VALUES (UUID(), 'anthropic', 'ANTHROPIC_API_VERSION', '2023-06-01')
ON DUPLICATE KEY UPDATE api_key = VALUES(api_key), updated_at = CURRENT_TIMESTAMP;

INSERT INTO model (id, supplier, use_for, api_key)
VALUES (UUID(), 'anthropic', 'ANTHROPIC_URL', 'https://api.anthropic.com')
ON DUPLICATE KEY UPDATE api_key = VALUES(api_key), updated_at = CURRENT_TIMESTAMP; 