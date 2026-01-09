-- Initialize database schema for Cash-Flow-Ledger

-- Users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  role TEXT NOT NULL DEFAULT 'preparer',
  created_at TIMESTAMP DEFAULT now()
);

-- Chart of Accounts
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- Petty Cash Fund
CREATE TABLE IF NOT EXISTS petty_cash_fund (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  imprest_amount NUMERIC(15,2) NOT NULL,
  current_balance NUMERIC(15,2) NOT NULL,
  manager_id INTEGER REFERENCES users(id),
  last_replenishment_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Vouchers
CREATE TABLE IF NOT EXISTS vouchers (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  voucher_number VARCHAR(50) NOT NULL UNIQUE,
  date TIMESTAMP NOT NULL,
  payee VARCHAR(255) NOT NULL,
  total_amount NUMERIC(15,2) NOT NULL,
  requested_by_id INTEGER REFERENCES users(id),
  approved_by_id INTEGER REFERENCES users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  supporting_docs_submitted TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Voucher Items
CREATE TABLE IF NOT EXISTS voucher_items (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  voucher_id INTEGER NOT NULL REFERENCES vouchers(id),
  description TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  chart_of_account_id INTEGER REFERENCES chart_of_accounts(id),
  invoice_number VARCHAR(100),
  vat_amount NUMERIC(15,2),
  amount_withheld NUMERIC(15,2),
  created_at TIMESTAMP DEFAULT now()
);

-- Replenishment Requests
CREATE TABLE IF NOT EXISTS replenishment_requests (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  request_date TIMESTAMP NOT NULL DEFAULT now(),
  total_amount NUMERIC(15,2) NOT NULL,
  total_vat NUMERIC(15,2) NOT NULL,
  total_withheld NUMERIC(15,2) NOT NULL,
  total_net_amount NUMERIC(15,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  requested_by_id INTEGER REFERENCES users(id),
  approved_by_id INTEGER REFERENCES users(id),
  voucher_ids INTEGER[],
  created_at TIMESTAMP DEFAULT now()
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL,
  old_value JSONB,
  new_value JSONB,
  user_id INTEGER REFERENCES users(id),
  ip_address VARCHAR(50),
  timestamp TIMESTAMP NOT NULL DEFAULT now(),
  description TEXT
);

-- Account Budgets
CREATE TABLE IF NOT EXISTS account_budgets (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  chart_of_account_id INTEGER NOT NULL REFERENCES chart_of_accounts(id),
  budget_amount NUMERIC(15,2) NOT NULL,
  period VARCHAR(20) NOT NULL,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  alert_threshold NUMERIC(5,2) DEFAULT 80,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Voucher Attachments
CREATE TABLE IF NOT EXISTS voucher_attachments (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  voucher_id INTEGER NOT NULL REFERENCES vouchers(id),
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(100) NOT NULL,
  file_size INTEGER NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  uploaded_by_id INTEGER REFERENCES users(id),
  uploaded_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Optional indexes
CREATE INDEX IF NOT EXISTS idx_vouchers_date ON vouchers (date DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs (timestamp DESC);
