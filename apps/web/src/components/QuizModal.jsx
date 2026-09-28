import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { notify } from "../utils/notify.jsx";
import { supabase } from "../supabaseClient.js";

export const QuizModal = ({ userId, sectionId = null, id = "quiz-modal" }) => {
  const [term, setTerm] = useState("Prelims");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const modal = document.getElementById(id);
    const handleClose = (e) => {
      if (e.target === modal || e.key === 'Escape') {
        modal.close();
      }
    };
    modal?.addEventListener('close', () => {
      setTitle('');
      setTerm('Prelims');
      setVisibility('private');
    });
    document.addEventListener('keydown', handleClose);
    document.addEventListener('click', handleClose);

    return () => {
      document.removeEventListener('keydown', handleClose);
      document.removeEventListener('click', handleClose);
    };
  }, [id]);

  const handleCreateQuiz = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      notify.error("Assessment title is required");
      return;
    }

    setLoading(true);

    try {
      const isPrivate = visibility === "private";
      const isShared = visibility === "shared";
      const visibilityVal = visibility;

      const rawDesc = (description || "").replace(/\s*\[vis:(private|shared|public)\]\s*/gi, "").trim();
      const taggedDescription = rawDesc ? `${rawDesc}\n[vis:${visibilityVal}]` : `[vis:${visibilityVal}]`;

      const basePayload = {
        instructor_id: userId,
        section_id: sectionId || null,
        title: title.trim(),
        description: taggedDescription,
        duration: duration ? parseInt(duration) : null,
        is_private: isPrivate,
      };

      let newQuiz;
      const resA = await supabase
        .from("quizzes")
        .insert([{ ...basePayload, term: term || "Prelims", is_shared: isShared, visibility: visibilityVal }])
        .select()
        .single();

      if (resA.error) {
        const resB = await supabase
          .from("quizzes")
          .insert([{ ...basePayload, term: term || "Prelims", is_shared: isShared }])
          .select()
          .single();

        if (resB.error) {
          const resC = await supabase
            .from("quizzes")
            .insert([{ ...basePayload, is_shared: isShared }])
            .select()
            .single();

          if (resC.error) {
            const resD = await supabase
              .from("quizzes")
              .insert([basePayload])
              .select()
              .single();
            if (resD.error) throw resD.error;
            newQuiz = resD.data;
          } else {
            newQuiz = resC.data;
          }
        } else {
          newQuiz = resB.data;
        }
      } else {
        newQuiz = resA.data;
      }

      document.getElementById(id).close();
      setTitle('');
      setDescription('');
      setDuration('');
      setVisibility('private');
      notify.success(`Assessment "${newQuiz.title}" created successfully!`);
      navigate(`/instructor-dashboard/instructor-quiz/${newQuiz.id}`);
    } catch (err) {
      notify.error(err.message || "Failed to create assessment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <dialog id={id} className="bg-transparent p-0 m-0 backdrop:bg-black/50">
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
          <div className="p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-hornblende-green">
                Create New Assessment / Exam
              </h2>
              <button
                onClick={() => document.getElementById(id).close()}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateQuiz}>
              <div className="space-y-4">
                {/* Term selector */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Assessment Term *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "Prelims", label: "Prelims", icon: "📝" },
                      { id: "Midterms", label: "Midterms", icon: "📘" },
                      { id: "Final Term", label: "Final Term", icon: "🎓" },
                    ].map((item) => {
                      const active = term === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setTerm(item.id);
                            if (
                              !title.trim() ||
                              ["Prelims Examination", "Midterms Examination", "Final Term Examination"].includes(title.trim())
                            ) {
                              setTitle(`${item.label} Examination`);
                            }
                          }}
                          className={`py-2 px-2.5 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                            active
                              ? "bg-brand-navy text-white border-brand-navy shadow-xs ring-2 ring-brand-navy/20"
                              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          <span>{item.icon}</span>
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Assessment Title *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Midterms Examination"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-casual-green focus:ring-2 focus:ring-casual-green/20 text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Description / Instructions
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional instructions for examinees"
                    rows="3"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-casual-green focus:ring-2 focus:ring-casual-green/20 resize-vertical text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="Unlimited if blank"
                    min="1"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-casual-green focus:ring-2 focus:ring-casual-green/20 text-sm"
                  />
                </div>

                {/* Visibility options */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Assessment Visibility &amp; Sharing
                  </label>
                  <div className="flex flex-col gap-2.5">
                    <label
                      className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                        visibility === "private"
                          ? "border-brand-navy bg-brand-navy/5 ring-1 ring-brand-navy shadow-sm"
                          : "border-gray-200 bg-white hover:bg-gray-50/80 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="quiz_modal_visibility"
                        checked={visibility === "private"}
                        onChange={() => setVisibility("private")}
                        className="mt-1 text-brand-navy focus:ring-brand-navy shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-gray-900 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                            Private
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full border border-gray-200 shrink-0">Default</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                          Only you can see and manage this assessment.
                        </p>
                      </div>
                    </label>

                    <label
                      className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                        visibility === "shared"
                          ? "border-brand-navy bg-brand-navy/5 ring-1 ring-brand-navy shadow-sm"
                          : "border-gray-200 bg-white hover:bg-gray-50/80 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="quiz_modal_visibility"
                        checked={visibility === "shared"}
                        onChange={() => setVisibility("shared")}
                        className="mt-1 text-brand-navy focus:ring-brand-navy shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-gray-900 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Shared
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                          Shared with instructors teaching the same subject or sections.
                        </p>
                      </div>
                    </label>

                    <label
                      className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                        visibility === "public"
                          ? "border-brand-navy bg-brand-navy/5 ring-1 ring-brand-navy shadow-sm"
                          : "border-gray-200 bg-white hover:bg-gray-50/80 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="quiz_modal_visibility"
                        checked={visibility === "public"}
                        onChange={() => setVisibility("public")}
                        className="mt-1 text-brand-navy focus:ring-brand-navy shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-gray-900 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <circle cx="12" cy="12" r="10" />
                              <line x1="2" y1="12" x2="22" y2="12" />
                              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                            </svg>
                            Public
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                          Visible to all instructors; questions added to Question Bank.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 mt-8">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-casual-green text-white py-3 px-6 rounded-lg font-semibold hover:bg-hornblende-green transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {loading ? "Creating..." : "Create Assessment"}
                </button>
                <button
                  type="button"
                  onClick={() => document.getElementById(id).close()}
                  disabled={loading}
                  className="flex-1 bg-gray-300 text-gray-800 py-3 px-6 rounded-lg font-semibold hover:bg-gray-400 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </dialog>
  );
};

