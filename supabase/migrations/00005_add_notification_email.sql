-- Add notification_email to tenants
-- When set, outbound emails show "TenantName via TradeTap" with reply-to set to this address
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS notification_email VARCHAR(255);
