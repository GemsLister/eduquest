import { supabase } from "../../supabaseClient";

/**
 * Calculate auto-flag based on difficulty status
 * @param {string} difficultyStatus - "Easy", "Moderate", "Difficult", or "N/A"
 * @returns {string} - "approved", "needs_revision", or "discard"
 */
const calculateAutoFlag = (difficultyStatus) => {
  switch (difficultyStatus) {
    case "Easy":
      return "approved";
    case "Moderate":
      return "needs_revision";
    case "Difficult":
      return "needs_revision";
    default:
      return "pending";
  }
};

const normalizeDifficultyStatus = (status) => {
  const value = (status || "").toString().trim().toLowerCase();
  if (value === "easy") return "Easy";
  if (value === "moderate") return "Moderate";
  if (value === "difficult") return "Difficult";
  return null;
};

const normalizeDiscriminationStatus = (status) => {
  const value = (status || "").toString().trim().toLowerCase();
  if (value === "excellent") return "Excellent";
  if (value === "good") return "Good";
  if (value === "acceptable") return "Acceptable";
  if (value === "poor") return "Poor";
  return null;
};

/**
 * Save item analysis results for a quiz
 * @param {string} quizId - Quiz ID
 * @param {Array} analysisResults - Array of analysis results
 * @returns {Promise<{data, error}>}
 */
export const saveItemAnalysis = async (quizId, analysisResults) => {
  try {
    const results = [];

    for (const item of analysisResults) {
      const normalizedDifficultyStatus = normalizeDifficultyStatus(item.status);
      const normalizedDiscriminationStatus = normalizeDiscriminationStatus(
        item.discStatus,
      );

      // Calculate auto-flag based on difficulty status (Easy/Moderate/Difficult)
      const autoFlag = calculateAutoFlag(normalizedDifficultyStatus);

      // First, try to delete existing analysis for this question
      await supabase
        .from("item_analysis")
        .delete()
        .eq("quiz_id", quizId)
        .eq("question_id", item.question_id);

      // Insert item analysis
      const { data: analysisData, error: analysisError } = await supabase
        .from("item_analysis")
        .insert({
          quiz_id: quizId,
          question_id: item.question_id,
          difficulty_index: Number.isFinite(parseFloat(item.difficulty))
            ? parseFloat(item.difficulty)
            : null,
          difficulty_status: normalizedDifficultyStatus,
          discrimination_index: Number.isFinite(parseFloat(item.discrimination))
            ? parseFloat(item.discrimination)
            : null,
          discrimination_status: normalizedDiscriminationStatus,
          total_takers: Number.isFinite(Number(item.total))
            ? Number(item.total)
            : null,
          correct_takers:
            Number.isFinite(Number(item.total)) &&
            Number.isFinite(parseFloat(item.difficulty))
              ? Math.round(Number(item.total) * parseFloat(item.difficulty))
              : null,
          auto_flag: autoFlag,
        })
        .select()
        .single();

      if (analysisError) {
        console.error(
          "Error saving item analysis for question:",
          item.question_id,
          analysisError,
        );
        continue;
      }

      // Update the question's flag based on analysis
      const { error: flagError } = await supabase
        .from("questions")
        .update({
          flag: autoFlag,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.question_id);

      if (flagError) {
        console.error(
          "Error updating question flag:",
          item.question_id,
          flagError,
        );
      }

      // Insert distractor analysis if available
      if (item.distractorAnalysis && analysisData) {
        const distractorInserts = Object.entries(item.distractorAnalysis)
          .filter(([key]) => key !== "distractors")
          .map(([key, value]) => ({
            item_analysis_id: analysisData.id,
            option_identifier: key,
            taker_count: value.count,
            taker_percentage: parseFloat(value.percentage),
            is_correct_answer: key === "correct",
          }));

        if (distractorInserts.length > 0) {
          const { error: distractorError } = await supabase
            .from("item_distractor_analysis")
            .insert(distractorInserts);

          if (distractorError) {
            console.error("Error saving distractors:", distractorError);
          }
        }
      }

      results.push({
        questionId: item.question_id,
        id: analysisData?.id,
        autoFlag: autoFlag,
      });
    }

    // Also sync a review submission so admins can see newly saved analysis.
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.id) {
      const analysisPayload = {
        quizId,
        analysis: analysisResults.map((item) => ({
          questionId: item.question_id,
          questionText: item.text || "",
          bloomsLevel: item.status || "N/A",
          thinkingOrder:
            (item.status || "").toLowerCase() === "difficult" ? "HOTS" : "LOTS",
          confidence: 1,
          needsReview: (item.autoFlag || "").toLowerCase() === "needs_revision",
        })),
        summary: {
          totalQuestions: analysisResults.length,
          distribution: {
            Easy: analysisResults.filter(
              (i) => (i.status || "").toLowerCase() === "easy",
            ).length,
            Moderate: analysisResults.filter(
              (i) => (i.status || "").toLowerCase() === "moderate",
            ).length,
            Difficult: analysisResults.filter(
              (i) => (i.status || "").toLowerCase() === "difficult",
            ).length,
          },
          lotsCount: analysisResults.filter(
            (i) => (i.status || "").toLowerCase() !== "difficult",
          ).length,
          hotsCount: analysisResults.filter(
            (i) => (i.status || "").toLowerCase() === "difficult",
          ).length,
          lotsPercentage:
            analysisResults.length > 0
              ? Math.round(
                  (analysisResults.filter(
                    (i) => (i.status || "").toLowerCase() !== "difficult",
                  ).length /
                    analysisResults.length) *
                    100,
                )
              : 0,
          hotsPercentage:
            analysisResults.length > 0
              ? Math.round(
                  (analysisResults.filter(
                    (i) => (i.status || "").toLowerCase() === "difficult",
                  ).length /
                    analysisResults.length) *
                    100,
                )
              : 0,
          flaggedCount: analysisResults.filter(
            (i) => (i.autoFlag || "").toLowerCase() === "needs_revision",
          ).length,
        },
      };

      const { data: existingSubmission } = await supabase
        .from("quiz_analysis_submissions")
        .select("id")
        .eq("quiz_id", quizId)
        .eq("instructor_id", user.id)
        .order("created_at", { ascending: false })
        .maybeSingle();

      if (existingSubmission?.id) {
        await supabase
          .from("quiz_analysis_submissions")
          .update({
            analysis_results: analysisPayload,
            status: "pending",
            admin_feedback: null,
            reviewed_by: null,
            reviewed_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingSubmission.id);
      } else {
        await supabase.from("quiz_analysis_submissions").insert({
          quiz_id: quizId,
          instructor_id: user.id,
          analysis_results: analysisPayload,
          status: "pending",
        });
      }
    }

    // Dispatch event to notify question list to refresh
    window.dispatchEvent(new Event("questions-updated"));

    return { data: results, error: null };
  } catch (error) {
    console.error("Error in saveItemAnalysis:", error);
    return { data: null, error };
  }
};
