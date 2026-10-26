-- ============================================================
-- Email settings from Vault
--
-- send-notification-email reads EMAIL_WEBHOOK_SECRET, GMAIL_USER,
-- GMAIL_APP_PASSWORD and APP_URL from its function secrets, falling back
-- to these Vault entries (lowercase names) for accounts that can't manage
-- function secrets:
--
--   select vault.create_secret('<same as email_webhook_secret>', 'email_webhook_secret');
--   select vault.create_secret('sender@gmail.com', 'gmail_user');
--   select vault.create_secret('<16-char app password>', 'gmail_app_password');
--   select vault.create_secret('https://your-site', 'app_url');
--
-- Only the service role (the Edge Function) may call this.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_email_config()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(jsonb_object_agg(name, decrypted_secret), '{}'::jsonb)
  FROM vault.decrypted_secrets
  WHERE name IN ('email_webhook_secret', 'gmail_user', 'gmail_app_password', 'app_url');
$$;

REVOKE ALL ON FUNCTION public.get_email_config() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_email_config() TO service_role;
