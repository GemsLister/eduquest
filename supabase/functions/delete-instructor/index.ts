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

    // Verify the caller is an admin using the service role client + explicit token
    const token = authHeader.replace("Bearer ", "");
    const adminVerifyClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

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

    const { userId } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: "userId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Safety guard: never allow deleting an admin account
    const { data: targetProfile } = await adminVerifyClient
      .from("profiles")
      .select("is_admin")
      .eq("id", userId)
      .single();

    if (targetProfile?.is_admin) {
      return new Response(
        JSON.stringify({ error: "Cannot delete an admin account" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Use service role to delete the user (reuse adminVerifyClient already created above)
    const adminClient = adminVerifyClient;

    // Fetch quiz IDs and attempt IDs first so we can delete children
    const { data: quizzes } = await adminClient
      .from("quizzes")
      .select("id")
      .eq("instructor_id", userId);
    const quizIds = (quizzes ?? []).map((q: { id: string }) => q.id);

    const { data: attempts } = await adminClient
      .from("quiz_attempts")
      .select("id")
      .eq("user_id", userId);
    const attemptIds = (attempts ?? []).map((a: { id: string }) => a.id);

    // Delete all related data in order
    if (attemptIds.length > 0) {
      await adminClient
        .from("quiz_responses")
        .delete()
        .in("attempt_id", attemptIds);
    }
    await adminClient
      .from("item_distractor_analysis")
      .delete()
      .eq("user_id", userId);
    await adminClient.from("item_analysis").delete().eq("user_id", userId);
    await adminClient.from("quiz_attempts").delete().eq("user_id", userId);
    if (quizIds.length > 0) {
      await adminClient.from("questions").delete().in("quiz_id", quizIds);
    }
    await adminClient.from("quizzes").delete().eq("instructor_id", userId);
    await adminClient.from("sections").delete().eq("user_id", userId);
    await adminClient.from("profiles").delete().eq("id", userId);

    // Delete auth user
    const { error: deleteError } =
      await adminClient.auth.admin.deleteUser(userId);

    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
