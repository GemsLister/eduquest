import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ycebpvxbvlztyoysjwvx.supabase.co";
const supabaseKey = "sb_publishable_BhGuMuHVrGtsITIoPaRIoA_SCcNbIHm";

const supabase = createClient(supabaseUrl, supabaseKey);

async function findQuizzes() {
  console.log("Searching quizzes table for 123r, wer, erter...");
  const { data: qData, error: qErr } = await supabase
    .from("quizzes")
    .select("*")
    .or("title.ilike.%123r%,title.ilike.%wer%,title.ilike.%erter%");

  console.log("Quizzes found:", qData?.map(q => ({ id: q.id, title: q.title, parent_quiz_id: q.parent_quiz_id })));

  if (qData) {
    for (const quiz of qData) {
      // Check questions count in 'questions' table
      const { data: questions, count: qCount } = await supabase
        .from("questions")
        .select("*", { count: "exact" })
        .eq("quiz_id", quiz.id);

      console.log(`\nQuiz "${quiz.title}" (${quiz.id}):`);
      console.log(`  - questions count in 'questions' table:`, qCount);
      console.log(`  - questions fetched:`, questions?.map(q => ({ id: q.id, text: q.text })));

      // Check quiz_analysis_submissions
      const { data: subs } = await supabase
        .from("quiz_analysis_submissions")
        .select("*")
        .eq("quiz_id", quiz.id);

      console.log(`  - submissions count:`, subs?.length);
      if (subs && subs.length > 0) {
        subs.forEach((s, idx) => {
          const items = s.analysis_results?.analysis || s.analysis_results?.questionSnapshots || [];
          console.log(`    Submission [${idx}] ID: ${s.id}, status: ${s.status}, payload questions count: ${items.length}`);
        });
      }
    }
  }
}

findQuizzes();
