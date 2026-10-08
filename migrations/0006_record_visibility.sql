ALTER TABLE transactions ADD COLUMN visibility TEXT NOT NULL DEFAULT 'PRIVATE' CHECK(visibility IN ('PRIVATE','PUBLIC'));
ALTER TABLE transactions ADD COLUMN reason_visibility TEXT NOT NULL DEFAULT 'PRIVATE' CHECK(reason_visibility IN ('PRIVATE','PUBLIC'));
ALTER TABLE transactions ADD COLUMN memo_visibility TEXT NOT NULL DEFAULT 'PRIVATE' CHECK(memo_visibility IN ('PRIVATE','PUBLIC'));
ALTER TABLE investment_notes ADD COLUMN visibility TEXT NOT NULL DEFAULT 'PRIVATE' CHECK(visibility IN ('PRIVATE','PUBLIC'));
