import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const adminVerifyClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Verify caller is admin
    const {
      data: { user: callerUser },
      error: callerError,
    } = await adminVerifyClient.auth.getUser(token);

    if (callerError || !callerUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId, newPassword } = await req.json();

    // Allow if: (a) caller is admin, or (b) caller is setting their OWN password
    const isSelf = callerUser.id === userId;

    if (!isSelf) {
      const { data: callerProfile } = await adminVerifyClient
        .from("profiles")
        .select("is_admin")
        .eq("id", callerUser.id)
        .single();

      if (!callerProfile?.is_admin) {
        return new Response(
          JSON.stringify({ error: "Forbidden: Admin access only" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    if (!userId || !newPassword) {
      return new Response(
        JSON.stringify({ error: "userId and newPassword are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (newPassword.length < 6) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 6 characters" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Pass email alongside password to ensure an email identity is created
    // (needed for OAuth-only users to enable signInWithPassword)
    const targetEmail = isSelf ? callerUser.email : undefined;
    const updatePayload: Record<string, string> = { password: newPassword };
    if (targetEmail) updatePayload.email = targetEmail;

    const { error: updateError } =
      await adminVerifyClient.auth.admin.updateUserById(userId, updatePayload);

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ message: "Password updated successfully" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
