import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ycebpvxbvlztyoysjwvx.supabase.co";
const supabaseKey = "sb_publishable_BhGuMuHVrGtsITIoPaRIoA_SCcNbIHm";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTargetQuizzes() {
  console.log("=== Checking Quizzes with ilike ===");
  
  const { data: quizzes, error: qErr } = await supabase
    .from("quizzes")
    .select("id, title, version_number, parent_quiz_id, is_archived, created_at, instructor_id")
    .order("created_at", { ascending: false })
    .limit(20);

  console.log("Quizzes count:", quizzes?.length);
  quizzes?.forEach((q) => {
    console.log(`Quiz: "${q.title}" (ID: ${q.id})`);
  });

  for (const q of quizzes || []) {
    // Questions directly linked by quiz_id
    const { count: countDirect } = await supabase
      .from("questions")
      .select("*", { count: "exact", head: true })
      .eq("quiz_id", q.id);

    // Check quiz_analysis_submissions for this quiz
    const { data: subs } = await supabase
      .from("quiz_analysis_submissions")
      .select("id, quiz_id, status, analysis_results")
      .eq("quiz_id", q.id);

    let payloadCount = 0;
    if (subs && subs.length > 0) {
      const payload = subs[0].analysis_results?.analysis || subs[0].analysis_results?.questionSnapshots || [];
      payloadCount = payload.length;
    }

    if (countDirect === 0 && payloadCount > 0) {
      console.log(`\n⚠️ DISCREPANCY FOUND for Quiz "${q.title}" (ID: ${q.id}):`);
      console.log(`   - questions table count: ${countDirect}`);
      console.log(`   - quiz_analysis_submissions payload count: ${payloadCount}`);
    }
  }
}

checkTargetQuizzes();
