ALTER TABLE users ADD COLUMN nickname TEXT CHECK(nickname IS NULL OR length(nickname) BETWEEN 2 AND 20);
ALTER TABLE users ADD COLUMN nickname_key TEXT;
CREATE UNIQUE INDEX user_nickname_unique ON users(nickname_key) WHERE nickname_key IS NOT NULL;
