import React, { useState, useEffect } from "react";
import { supabase } from "../../../supabaseClient";

export const QuizRevisionHistory = ({ parentQuizId, currentQuizId }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!parentQuizId && !currentQuizId) return;

    const fetchHistory = async () => {
      setLoading(true);
      try {
        // Find the root parent quiz to get the full lineage
        let rootQuizId = parentQuizId || currentQuizId;
        
        // This is a simplified approach assuming a max depth of a few versions.
        // For a full tree, a recursive query might be needed, but for now we fetch by parent_quiz_id or id
        const { data: allRelatedQuizzes } = await supabase
          .from("quizzes")
          .select("id, title, created_at, parent_quiz_id")
          .or(`id.eq.${rootQuizId},parent_quiz_id.eq.${rootQuizId}`)
          .order("created_at", { ascending: false });

        if (!allRelatedQuizzes) {
          setLoading(false);
          return;
        }

        // Filter out current quiz
        const previousVersions = allRelatedQuizzes.filter(q => q.id !== currentQuizId);

        // Fetch attempts for previous versions
        const versionsWithAttempts = await Promise.all(
           previousVersions.map(async (quiz) => {
             const { data: attempts } = await supabase
               .from("quiz_attempts")
               .select(`
                 id, score, started_at, completed_at, status,
                 profiles!quiz_attempts_user_id_fkey(first_name, last_name)
               `)
               .eq("quiz_id", quiz.id)
               .order("started_at", { ascending: false });

             return {
               ...quiz,
               attempts: attempts || []
             };
           })
        );

        setHistory(versionsWithAttempts);
      } catch (err) {
        console.error("Error fetching revision history:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [parentQuizId, currentQuizId]);

  if (!parentQuizId && history.length === 0) return null;
  if (loading) return <div className="text-gray-500 text-sm py-4">Loading revision history...</div>;
  if (history.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-8 border border-gray-200">
      <h2 className="text-xl font-bold text-brand-navy mb-4 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Revision History
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        This quiz is a revised version. Below are the previous versions and the students who took them. Note: This new version has reset attempts to 0.
      </p>

      <div className="space-y-4">
        {history.map((version) => (
          <div key={version.id} className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 font-semibold text-gray-700 flex justify-between items-center">
              <span>{version.title}</span>
              <span className="text-xs text-gray-500 font-normal">
                Created: {new Date(version.created_at).toLocaleDateString()}
              </span>
            </div>
            <div className="p-4">
              <h4 className="text-sm font-bold text-gray-600 mb-2">Students who took this version ({version.attempts.length}):</h4>
              {version.attempts.length > 0 ? (
                <div className="max-h-40 overflow-y-auto">
                  <ul className="space-y-2">
                    {version.attempts.map(attempt => (
                      <li key={attempt.id} className="text-sm text-gray-700 flex justify-between bg-gray-50 p-2 rounded">
                        <span>
                          {attempt.profiles?.first_name} {attempt.profiles?.last_name}
                        </span>
                        <span className="text-gray-500 font-mono text-xs">
                          Score: {attempt.score}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">No students took this version.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
