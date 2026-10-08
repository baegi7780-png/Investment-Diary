CREATE TABLE app_settings (key TEXT PRIMARY KEY, value INTEGER NOT NULL CHECK(value >= 0));
INSERT INTO app_settings (key, value) VALUES ('account_limit', 5);
DROP TRIGGER user_limit;
CREATE TRIGGER user_limit BEFORE INSERT ON users
WHEN (SELECT value FROM app_settings WHERE key='account_limit') > 0
 AND (SELECT COUNT(*) FROM users) >= (SELECT value FROM app_settings WHERE key='account_limit')
BEGIN SELECT RAISE(ABORT,'계정은 최대 인원에 도달했습니다'); END;
