import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.16";

// Called by the notifications INSERT trigger (see 20261029_email_notifications.sql),
// not by the browser, so it authenticates with a shared secret instead of a JWT.
// Every in-app notification is mirrored to the recipient's account email.

const jsonHeaders = { "Content-Type": "application/json" };

const ACCENT: Record<string, string> = {
  info: "#2563eb",
  success: "#16a34a",
  warning: "#d97706",
  error: "#dc2626",
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Revision copies are stored as "Title (Revised)" (v2) or "Title (Revised N)"
// (v N+1); show the version like the app's V2 badge instead
const withVersionLabels = (text: string) =>
  text.replace(
    /"([^"]*?)\s*\(Revised(?:\s+(\d+))?\)"/gi,
    (_, title, n) => `"${title}" (Version ${n ? Number(n) + 1 : 2})`,
  );

// Same wording as the bell's formatNotificationMessage: subject-request
// notifications store a JSON payload in `message`
const formatMessage = (message: string) => {
  if (!message.trim().startsWith("{")) return withVersionLabels(message);
  try {
    const p = JSON.parse(message);
    const name = p.subject_name ? `"${p.subject_name}"` : "A subject";
    if (p.request_status === "approved") return `${name} was approved and added to your subjects.`;
    if (p.request_status === "rejected") {
      return `${name} was not approved${p.rejection_reason ? `: ${p.rejection_reason}` : "."}`;
    }
    if (p.request_status === "pending") {
      return `${p.requester_name || "An instructor"} requested ${name}${p.grade_level ? ` (${p.grade_level} year)` : ""}.`;
    }
    return message;
  } catch {
    return message;
  }
};

// The requester's own copy of a subject request is tracking storage, not news;
// the bell hides it, so don't email it either
const SELF_TRACKING_PREFIX = "my subject request:";

const renderHtml = (
  name: string,
  title: string,
  message: string,
  type: string,
  url: string | null,
) => {
  const accent = ACCENT[type] || ACCENT.info;
  const button = url
    ? `<p style="margin:24px 0 0">
         <a href="${escapeHtml(url)}"
            style="background:${accent};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;display:inline-block;font-weight:600">
           Open in SmartQuiz
         </a>
       </p>`
    : "";

  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827">
    <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;border-top:4px solid ${accent}">
      <tr>
        <td style="padding:24px">
          <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">SmartQuiz Notification</p>
          <h2 style="margin:0 0 16px;font-size:20px">${escapeHtml(title)}</h2>
          <p style="margin:0 0 12px">Hi ${escapeHtml(name)},</p>
          <p style="margin:0;line-height:1.5;white-space:pre-line">${escapeHtml(message)}</p>
          ${button}
          <p style="margin:24px 0 0;font-size:12px;color:#9ca3af">
            This is an automated message from SmartQuiz. Please do not reply to this email.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Function secrets win; Vault (get_email_config) covers projects where the
  // deployer can't manage function secrets
  const { data: vaultConfig, error: configError } =
    await adminClient.rpc("get_email_config");
  if (configError) {
    console.warn("Could not read email config from Vault:", configError.message);
  }
  const setting = (envName: string) =>
    Deno.env.get(envName) || vaultConfig?.[envName.toLowerCase()] || "";

  const expectedSecret = setting("EMAIL_WEBHOOK_SECRET");
  if (!expectedSecret || req.headers.get("x-webhook-secret") !== expectedSecret) {
    console.warn("Rejected: x-webhook-secret does not match EMAIL_WEBHOOK_SECRET");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  try {
    const { notification_id } = await req.json();
    if (!notification_id) {
      return new Response(
        JSON.stringify({ error: "notification_id is required" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    // Re-read the row rather than trusting the request body
    const { data: notification, error: notifError } = await adminClient
      .from("notifications")
      .select("id, user_id, title, message, type, link")
      .eq("id", notification_id)
      .maybeSingle();

    if (notifError) throw notifError;
    if (!notification) {
      console.log(`Skipped ${notification_id}: notification not found`);
      return new Response(JSON.stringify({ skipped: "notification not found" }), {
        status: 200,
        headers: jsonHeaders,
      });
    }

    if (notification.title.toLowerCase().startsWith(SELF_TRACKING_PREFIX)) {
      console.log(`Skipped ${notification_id}: subject request tracking row`);
      return new Response(JSON.stringify({ skipped: "tracking row" }), {
        status: 200,
        headers: jsonHeaders,
      });
    }

    const { data: profile } = await adminClient
      .from("profiles")
      .select("first_name, last_name, username, is_disabled")
      .eq("id", notification.user_id)
      .maybeSingle();

    if (profile?.is_disabled) {
      console.log(`Skipped ${notification_id}: account disabled`);
      return new Response(JSON.stringify({ skipped: "account disabled" }), {
        status: 200,
        headers: jsonHeaders,
      });
    }

    // The auth account's email is the address the user signs in with
    const { data: userData, error: userError } =
      await adminClient.auth.admin.getUserById(notification.user_id);
    if (userError) throw userError;

    const email = userData.user?.email;
    if (!email) {
      console.log(`Skipped ${notification_id}: no email on account`);
      return new Response(JSON.stringify({ skipped: "no email on account" }), {
        status: 200,
        headers: jsonHeaders,
      });
    }

    const name =
      `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() ||
      profile?.username ||
      email;

    const appUrl = setting("APP_URL").replace(/\/+$/, "");
    const url =
      appUrl && notification.link ? `${appUrl}${notification.link}` : null;

    const gmailUser = setting("GMAIL_USER");
    // Supabase blocks outbound ports 25 and 587, so use implicit TLS on 465
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: gmailUser, pass: setting("GMAIL_APP_PASSWORD") },
    });

    const title = withVersionLabels(notification.title);
    const message = formatMessage(notification.message);

    await transporter.sendMail({
      from: `"SmartQuiz" <${gmailUser}>`,
      to: email,
      subject: `SmartQuiz: ${title}`,
      text: `Hi ${name},\n\n${message}${url ? `\n\nOpen in SmartQuiz: ${url}` : ""}`,
      html: renderHtml(name, title, message, notification.type, url),
    });

    console.log(`Sent "${notification.title}" to ${email}`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    console.error("send-notification-email failed:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
