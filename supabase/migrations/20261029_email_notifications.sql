-- ============================================================
-- Email every in-app notification
--
-- Each INSERT on public.notifications (peer / Senior Faculty review
-- requests, forwards to the Department Head, revision requests,
-- approvals, subject requests, ...) also calls the
-- send-notification-email Edge Function, which mails the recipient's
-- account address through Gmail.
--
-- The call goes out through pg_net, which queues it and sends it after the
-- transaction commits, so a slow or failing mail server never blocks or
-- rolls back the notification itself.
--
-- The project URL and shared secret live in Supabase Vault. Until both are
-- set, the trigger does nothing and notifications stay in-app only:
--
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<random string>', 'email_webhook_secret');
--
-- email_webhook_secret must match the EMAIL_WEBHOOK_SECRET function secret.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.email_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_project_url TEXT;
  v_secret TEXT;
BEGIN
  SELECT decrypted_secret INTO v_project_url
  FROM vault.decrypted_secrets WHERE name = 'project_url';

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets WHERE name = 'email_webhook_secret';

  IF v_project_url IS NULL OR v_secret IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := rtrim(v_project_url, '/') || '/functions/v1/send-notification-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', v_secret
    ),
    body := jsonb_build_object('notification_id', NEW.id)
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Email is best-effort; never lose the in-app notification over it
  RAISE WARNING 'email_notification failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.email_notification() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_email_notification ON public.notifications;
CREATE TRIGGER trg_email_notification
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.email_notification();
