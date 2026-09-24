CREATE TABLE IF NOT EXISTS click_stats (
  button_id TEXT PRIMARY KEY,
  total_clicks INTEGER NOT NULL DEFAULT 0 CHECK (total_clicks >= 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO click_stats (button_id, total_clicks)
VALUES ('claim-offer', 0);

CREATE TABLE IF NOT EXISTS daily_clicks (
  click_date TEXT PRIMARY KEY,
  total_clicks INTEGER NOT NULL DEFAULT 0 CHECK (total_clicks >= 0)
);

CREATE TABLE IF NOT EXISTS daily_country_clicks (
  click_date TEXT NOT NULL,
  country_code TEXT NOT NULL,
  total_clicks INTEGER NOT NULL DEFAULT 0 CHECK (total_clicks >= 0),
  PRIMARY KEY (click_date, country_code)
);

CREATE TABLE IF NOT EXISTS site_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL
);

INSERT OR IGNORE INTO site_settings (setting_key, setting_value)
VALUES ('bannersPublished', 'false'), ('whatsappNumber', '8801762050353');

CREATE TABLE IF NOT EXISTS site_banners (
  banner_id TEXT PRIMARY KEY,
  banner_data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
