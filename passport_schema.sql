CREATE TABLE users (
    uid TEXT PRIMARY KEY,
    passport_id VARCHAR(64) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    public_key TEXT,
    pin_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_users_passport_id ON users (passport_id);
CREATE INDEX idx_users_email ON users (email);
