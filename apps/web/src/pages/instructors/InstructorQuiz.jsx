import { useState, useEffect, startTransition } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useConfirm } from "../../components/ui/ConfirmModal.jsx";
import { supabase } from "../../supabaseClient.js";

const QUESTION_TYPES = [{ value: "mcq", label: "Multiple Choice" }];

export const InstructorQuiz = () => {
  const navigate = useNavigate();
  const { quizId } = useParams();
  const confirm = useConfirm();
  const [quizTitle, setQuizTitle] = useState("");
  const [quizDescription, setQuizDescription] = useState("");
  const [quizDuration, setQuizDuration] = useState("");
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(quizId ? true : false);
  const [error, setError] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [selectedSectionIds, setSelectedSectionIds] = useState([]);
  const [availableSections, setAvailableSections] = useState([]);
  const [saveStatus, setSaveStatus] = useState("");
  const [deletingQuestionId, setDeletingQuestionId] = useState(null);
  const [shareToken, setShareToken] = useState("");
  const [showShareUrl, setShowShareUrl] = useState(false);
  const [showAddQuestionPopup, setShowAddQuestionPopup] = useState(false);
  const [questionCount, setQuestionCount] = useState(1);
  const [showSectionModal, setShowSectionModal] = useState(false);

  useEffect(() => {
    loadSections();
    if (quizId) {
      loadQuiz();
    } else {
      setLoading(false);
    }
  }, [quizId]);

  const loadSections = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("sections")
        .select("*")
        .eq("instructor_id", user.id);
      if (data) setAvailableSections(data);
    } catch (e) {
      console.error("Failed to load sections", e);
    }
  };

  const loadQuiz = async () => {
    try {
      const { data: quiz, error: quizError } = await supabase
        .from("quizzes")
        .select("*")
        .eq("id", quizId)
        .single();

      if (quizError) throw quizError;
      if (!quiz) throw new Error("Quiz not found");

      setQuizTitle(quiz.title);
      setQuizDescription(quiz.description || "");
      setQuizDuration(quiz.duration || "");
      setIsPublished(quiz.is_published || false);
      setShareToken(quiz.share_token || "");

      const { data: qsData, error: qsError } = await supabase
        .from("quiz_sections")
        .select("section_id")
        .eq("quiz_id", quizId);
      if (!qsError && qsData && qsData.length > 0) {
        setSelectedSectionIds(qsData.map((d) => d.section_id));
      } else if (quiz.section_id) {
        setSelectedSectionIds([quiz.section_id]); // fallback for old data
      }

      const { data: questionsData, error: questionsError } = await supabase
        .from("questions")
        .select("*")
        .eq("quiz_id", quizId)
        .or("is_archived.is.null,is_archived.eq.false")
        .order("created_at", { ascending: true });

      if (questionsError) throw questionsError;

      const transformedQuestions = questionsData.map((q) => {
        let correctAnswerValue;
        if (q.type === "mcq") {
          correctAnswerValue = q.options.indexOf(q.correct_answer);
        } else if (q.type === "true_false") {
          correctAnswerValue = q.correct_answer === "true" ? 0 : 1;
        } else {
          correctAnswerValue = q.correct_answer;
        }
        return {
          id: q.id,
          type: q.type,
          text: q.text,
          options: q.type === "mcq" ? q.options : [""],
          correctAnswer: correctAnswerValue,
          points: q.points || 1,
        };
      });

      setQuestions(transformedQuestions);
    } catch (err) {
      setError(err.message || "Failed to load quiz");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const addQuestion = () => {
    setQuestionCount(1);
    setShowAddQuestionPopup(true);
  };

  const addMultipleQuestions = (count) => {
    const newQuestions = Array.from({ length: count }, (_, i) => ({
      id: Date.now() + i,
      type: "mcq",
      text: "",
      options: ["", ""],
      correctAnswer: 0,
      points: 1,
    }));
    setQuestions([...questions, ...newQuestions]);
    setShowAddQuestionPopup(false);
  };

  const updateQuestion = (id, field, value) => {
    setQuestions(
      questions.map((q) => (q.id === id ? { ...q, [field]: value } : q)),
    );
  };

  const updateOption = (questionId, optionIndex, value) => {
    setQuestions(
      questions.map((q) =>
        q.id === questionId
          ? {
              ...q,
              options: q.options.map((opt, idx) =>
                idx === optionIndex ? value : opt,
              ),
            }
          : q,
      ),
    );
  };

  const addOption = (questionId) => {
    setQuestions(
      questions.map((q) =>
        q.id === questionId ? { ...q, options: [...q.options, ""] } : q,
      ),
    );
  };

  const removeOption = (questionId, optionIndex) => {
    setQuestions(
      questions.map((q) =>
        q.id === questionId
          ? { ...q, options: q.options.filter((_, idx) => idx !== optionIndex) }
          : q,
      ),
    );
  };

  const generateShareToken = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let token = "";
    for (let i = 0; i < 12; i++) {
      // Increased length for better uniqueness
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  };

  const copyToClipboard = () => {
    const url = `${window.location.origin}/quiz/${shareToken}`;
    navigator.clipboard.writeText(url).then(() => {
      setSaveStatus("URL copied to clipboard!");
      setTimeout(() => setSaveStatus(""), 2000);
    });
  };

  const archiveQuestion = async (id) => {
    setDeletingQuestionId(id);

    // If it's a new question (temp ID from Date.now()), just remove from state
    if (typeof id === "number" && id > 10000000000) {
      setQuestions(questions.filter((q) => q.id !== id));
      setDeletingQuestionId(null);
      return;
    }

    // If it's a saved question from database, archive it instead of deleting
    try {
      const { error } = await supabase
        .from("questions")
        .update({ is_archived: true, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;

      // Remove from local state for instant UI feedback
      setQuestions((prevQuestions) => prevQuestions.filter((q) => q.id !== id));
      toast.success(
        "Question archived to Question Bank! You can restore it from there.",
      );
    } catch (err) {
      console.error("Error archiving question:", err);
      toast.error("Error archiving question: " + err.message);
    } finally {
      setDeletingQuestionId(null);
    }
  };

  const handleSaveQuiz = async (publish = false) => {
    setError("");
    setSaveStatus("Saving...");

    if (!quizTitle.trim()) {
      setError("Quiz title is required");
      setSaveStatus("");
      return;
    }

    if (publish && questions.length === 0) {
      setError("Add at least one question before publishing");
      setSaveStatus("");
      return;
    }

    for (let q of questions) {
      if (!q.text.trim()) {
        setError("All questions must have text");
        setSaveStatus("");
        return;
      }
      if (
        q.type === "mcq" &&
        q.options.filter((opt) => opt.trim()).length < 2
      ) {
        setError(
          publish
            ? "MCQ questions must have at least 2 options to publish"
            : "Warning: MCQ questions should have at least 2 options",
        );
        if (publish) {
          setSaveStatus("");
          return;
        }
      }
    }

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("User not authenticated");
        setLoading(false);
        setSaveStatus("");
        return;
      }

      let quizData;
      let newToken = shareToken;

      if (quizId) {
        // Always generate a new share token when publishing, even if one exists
        if (publish) {
          newToken = generateShareToken();
        }

        const { data, error: updateError } = await supabase
          .from("quizzes")
          .update({
            title: quizTitle,
            description: quizDescription || null,
            duration: quizDuration ? parseInt(quizDuration) : null,
            is_published: publish || isPublished,
            share_token: publish ? newToken : shareToken,
          })
          .eq("id", quizId)
          .select();

        if (updateError) throw updateError;
        quizData = data[0];

        const { data: existingQuestions } = await supabase
          .from("questions")
          .select("id")
          .eq("quiz_id", quizId);
        const existingQuestionIds = new Set(
          existingQuestions?.map((q) => q.id) || [],
        );

        for (const q of questions) {
          if (typeof q.id !== "number" && existingQuestionIds.has(q.id)) {
            const { error: updateQuestionError } = await supabase
              .from("questions")
              .update({
                text: q.text,
                options:
                  q.type === "mcq"
                    ? q.options.filter((opt) => opt.trim())
                    : null,
                correct_answer:
                  q.type === "mcq"
                    ? q.options[q.correctAnswer]
                    : q.type === "true_false"
                      ? q.correctAnswer === 0
                        ? "true"
                        : "false"
                      : q.correctAnswer,
                points: q.points,
              })
              .eq("id", q.id);
            if (updateQuestionError) throw updateQuestionError;
          }
        }

        const questionsToAdd = questions
          .filter((q) => typeof q.id === "number" && q.id > 10000000000)
          .map((q) => ({
            quiz_id: quizData.id,
            type: q.type,
            text: q.text,
            options:
              q.type === "mcq" ? q.options.filter((opt) => opt.trim()) : null,
            correct_answer:
              q.type === "mcq"
                ? q.options[q.correctAnswer]
                : q.type === "true_false"
                  ? q.correctAnswer === 0
                    ? "true"
                    : "false"
                  : q.correctAnswer,
            points: q.points,
          }));

        if (questionsToAdd.length > 0) {
          const { error: questionsError } = await supabase
            .from("questions")
            .insert(questionsToAdd);
          if (questionsError) throw questionsError;
        }
      } else {
        newToken = publish ? generateShareToken() : null;

        const { data: newQuiz, error: quizError } = await supabase
          .from("quizzes")
          .insert([
            {
              instructor_id: user.id,
              section_id: selectedSectionIds[0] || null,
              title: quizTitle,
              description: quizDescription || null,
              duration: quizDuration ? parseInt(quizDuration) : null,
              is_published: publish,
              share_token: newToken,
            },
          ])
          .select();

        if (quizError) throw quizError;
        if (!newQuiz || newQuiz.length === 0)
          throw new Error("Failed to create quiz");
        quizData = newQuiz[0];

        if (questions.length > 0) {
          const questionsData = questions.map((q) => ({
            quiz_id: quizData.id,
            type: q.type,
            text: q.text,
            options:
              q.type === "mcq" ? q.options.filter((opt) => opt.trim()) : null,
            correct_answer:
              q.type === "mcq"
                ? q.options[q.correctAnswer]
                : q.type === "true_false"
                  ? q.correctAnswer === 0
                    ? "true"
                    : "false"
                  : q.correctAnswer,
            points: q.points,
          }));
          const { error: questionsError } = await supabase
            .from("questions")
            .insert(questionsData);
          if (questionsError) throw questionsError;
        }
      }

      // Sync the many-to-many relationship in quiz_sections
      if (quizData) {
        try {
          const { error: deleteError } = await supabase
            .from("quiz_sections")
            .delete()
            .eq("quiz_id", quizData.id);

          // If no error deleting (meaning table exists)
          if (!deleteError && selectedSectionIds.length > 0) {
            const sectionInserts = selectedSectionIds.map((sId) => ({
              quiz_id: quizData.id,
              section_id: sId,
            }));
            await supabase.from("quiz_sections").insert(sectionInserts);
          }
        } catch (tableError) {
          console.warn("quiz_sections table might not exist yet:", tableError);
        }

        await supabase
          .from("quizzes")
          .update({
            section_id:
              selectedSectionIds.length > 0 ? selectedSectionIds[0] : null,
          })
          .eq("id", quizData.id);
      }

      if (newToken) setShareToken(newToken);

      if (publish) {
        setShowShareUrl(true);
        setSaveStatus("Quiz published! Share URL generated.");
        setTimeout(() => setSaveStatus(""), 3000);
      } else {
        setSaveStatus("Draft saved!");
        setTimeout(() => {
          setSaveStatus("");
          navigate("/instructor-dashboard/quizzes");
        }, 1000);
      }
    } catch (err) {
      setError(err.message || "Failed to save quiz");
      setSaveStatus("");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-casual-green"></div>
          <p className="mt-4 text-hornblende-green font-semibold">
            Loading quiz...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-authentic-white p-6">
      <div className="mb-8">
        <button
          onClick={() => navigate("/instructor-dashboard/quizzes")}
          className="text-casual-green font-semibold mb-4 hover:underline"
        >
          ← Back
        </button>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-hornblende-green mb-2">
              {quizId ? "Edit Quiz" : "Create Quiz"}
            </h1>
            <p className="text-gray-600">
              {quizId
                ? isPublished
                  ? "Published - Changes will be saved"
                  : "Draft - Finish and publish when ready"
                : "Build a new quiz with questions and answers"}
            </p>
          </div>
          {quizId && (
            <div className="flex gap-4 items-center">
              <span
                className={`px-4 py-2 rounded-lg font-semibold text-sm ${isPublished ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}
              >
                {isPublished ? "Published" : "Draft"}
              </span>
              {isPublished && (
                <>
                  <button
                    onClick={() =>
                      navigate(`/instructor-dashboard/quiz-results/${quizId}`)
                    }
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                  >
                    📊 View Results
                  </button>
                  <button
                    onClick={() =>
                      navigate(`/instructor-dashboard/question-bank/${quizId}`)
                    }
                    className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                  >
                    📚 Question Bank
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          {error}
        </div>
      )}
      {saveStatus && (
        <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
          {saveStatus}
        </div>
      )}

      {(showShareUrl || isPublished) && shareToken && (
        <div className="mb-6 p-6 bg-blue-50 border-2 border-blue-300 rounded-lg">
          <h3 className="text-lg font-bold text-blue-900 mb-3">
            ✅ Quiz Published Successfully!
          </h3>
          <p className="text-blue-800 mb-4">
            Share this link with students so they can take the quiz:
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={`${window.location.origin}/quiz/${shareToken}`}
              readOnly
              className="flex-1 px-4 py-3 bg-white border border-blue-300 rounded-lg font-mono text-sm"
            />
            <button
              onClick={copyToClipboard}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition"
            >
              Copy Link
            </button>
          </div>
          <p className="text-sm text-blue-700 mt-3 bg-white p-3 rounded">
            📌 <strong>Share Code:</strong>{" "}
            <code className="bg-gray-100 px-2 py-1 rounded">{shareToken}</code>
          </p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-bold text-hornblende-green mb-4">
          Quiz Information
        </h2>

        {isPublished && (
          <div className="mb-4 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700 font-semibold">
            🔒 This quiz is published and cannot be edited.
          </div>
        )}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Quiz Title *
            </label>
            <input
              required
              type="text"
              value={quizTitle}
              onChange={(e) => setQuizTitle(e.target.value)}
              placeholder="e.g., Biology Chapter 5 Test"
              disabled={isPublished}
              className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-casual-green focus:ring-2 focus:ring-casual-green focus:ring-opacity-20 ${isPublished ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Duration (minutes)
            </label>
            <input
              required
              type="number"
              value={quizDuration}
              onChange={(e) => setQuizDuration(e.target.value)}
              placeholder="Leave blank for unlimited"
              disabled={isPublished}
              className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-casual-green focus:ring-2 focus:ring-casual-green focus:ring-opacity-20 ${isPublished ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
            />
          </div>
        </div>
      </div>

      {showAddQuestionPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-[340px]">
            <h3 className="text-lg font-bold text-hornblende-green mb-4">
              How many questions do you want to add?
            </h3>
            <input
              type="number"
              min="1"
              max="100"
              value={questionCount}
              onChange={(e) =>
                setQuestionCount(Math.max(1, parseInt(e.target.value) || 1))
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-casual-green focus:ring-2 focus:ring-casual-green focus:ring-opacity-20 mb-4 text-center text-lg"
            />
            <div className="flex gap-3">
              <button
                onClick={() => addMultipleQuestions(questionCount)}
                className="flex-1 bg-casual-green text-white py-2 rounded-lg font-semibold hover:bg-hornblende-green transition-colors"
              >
                Add {questionCount} Question{questionCount > 1 ? "s" : ""}
              </button>
              <button
                onClick={() => setShowAddQuestionPopup(false)}
                className="flex-1 bg-gray-300 text-gray-800 py-2 rounded-lg font-semibold hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section Selection Modal */}
      {showSectionModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowSectionModal(false)}
          />
          <div className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-gray-800 mb-1">
              Assign to Sections
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Select which sections this quiz should appear in.
            </p>

            {availableSections.length === 0 ? (
              <div className="text-sm text-gray-500 py-4 text-center">
                No sections available. Create one first!
              </div>
            ) : (
              <>
                {/* Select All */}
                <label className="flex items-center gap-3 border-b border-gray-200 pb-3 mb-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={
                      selectedSectionIds.length === availableSections.length
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedSectionIds(
                          availableSections.map((s) => s.id),
                        );
                      } else {
                        setSelectedSectionIds([]);
                      }
                    }}
                    disabled={isPublished}
                    className="form-checkbox h-4 w-4 text-casual-green border-gray-300 rounded"
                  />
                  <span className="text-sm font-semibold text-gray-800">
                    Select All
                  </span>
                  <span className="ml-auto text-xs text-gray-400">
                    {selectedSectionIds.length}/{availableSections.length}
                  </span>
                </label>

                {/* Section List */}
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {availableSections.map((sec) => (
                    <label
                      key={sec.id}
                      className={`flex items-center gap-3 border p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedSectionIds.includes(sec.id)
                          ? "border-casual-green bg-green-50"
                          : "border-gray-200 hover:bg-gray-50"
                      } ${isPublished ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedSectionIds.includes(sec.id)}
                        onChange={(e) => {
                          if (e.target.checked)
                            setSelectedSectionIds([
                              ...selectedSectionIds,
                              sec.id,
                            ]);
                          else
                            setSelectedSectionIds(
                              selectedSectionIds.filter((id) => id !== sec.id),
                            );
                        }}
                        disabled={isPublished}
                        className="form-checkbox h-4 w-4 text-casual-green border-gray-300 rounded"
                      />
                      <div>
                        <span className="block text-sm font-medium text-gray-800">
                          {sec.section_name}
                        </span>
                        <span className="block text-xs text-gray-500">
                          Code: {sec.exam_code}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </>
            )}

            <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-gray-200">
              <button
                onClick={() => setShowSectionModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex justify-between items-center mb-6 gap-4">
          <div>
            <h2 className="text-xl font-bold text-hornblende-green">
              Questions ({questions.length})
            </h2>
          </div>
          {!isPublished && (
            <div className="flex gap-2">
              <button
                onClick={addQuestion}
                className="bg-casual-green text-white px-4 py-2 rounded-lg font-semibold hover:bg-hornblende-green transition-colors text-sm"
              >
                + Add Question
              </button>
              <button
                onClick={() => {
                  const shuffled = [...questions].sort(
                    () => Math.random() - 0.5,
                  );
                  setQuestions(shuffled);
                }}
                className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold transition-colors text-sm flex items-center gap-1"
                title="Randomize question order for students"
              >
                🔀 Shuffle
              </button>
            </div>
          )}
        </div>

        {questions.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-gray-500 mb-4">No questions added yet</p>
            {!isPublished && (
              <button
                onClick={addQuestion}
                className="bg-casual-green text-white px-6 py-2 rounded-lg font-semibold hover:bg-hornblende-green transition-colors"
              >
                Add First Question
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {questions.map((question, idx) => (
              <div
                key={question.id}
                className="border-2 border-gray-200 rounded-lg p-5 hover:border-casual-green transition-colors"
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">
                    {idx + 1}. {question.text.substring(0, 50)}...
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={async (e) => {
                        e.preventDefault();
                        const confirmed = await confirm({
                          title: "Archive Question",
                          message:
                            "Archive this question to Question Bank? You can restore it later.",
                          confirmText: "Archive",
                          cancelText: "Cancel",
                          variant: "warning",
                        });
                        if (confirmed) {
                          archiveQuestion(question.id).catch((err) =>
                            console.error("Failed to archive question:", err),
                          );
                        }
                      }}
                      disabled={deletingQuestionId === question.id}
                      className={`${deletingQuestionId === question.id ? "text-gray-400 cursor-not-allowed" : "text-yellow-600 hover:text-yellow-800"} text-sm font-semibold px-3 py-1 transition-colors`}
                    >
                      {deletingQuestionId === question.id
                        ? "..."
                        : "📁 Archive"}
                    </button>
                    <button
                      onClick={async (e) => {
                        e.preventDefault();
                        const confirmed = await confirm({
                          title: "Delete Question",
                          message:
                            "Delete this question permanently? This cannot be undone.",
                          confirmText: "Delete",
                          cancelText: "Cancel",
                          variant: "danger",
                        });
                        if (confirmed) {
                          if (
                            typeof question.id === "number" &&
                            question.id > 10000000000
                          ) {
                            setQuestions(
                              questions.filter((q) => q.id !== question.id),
                            );
                          } else {
                            supabase
                              .from("questions")
                              .delete()
                              .eq("id", question.id)
                              .then(({ error }) => {
                                if (error) {
                                  console.error("Delete error:", error);
                                  toast.error(
                                    "Delete failed: " + error.message,
                                  );
                                } else {
                                  setQuestions(
                                    questions.filter(
                                      (q) => q.id !== question.id,
                                    ),
                                  );
                                }
                              });
                          }
                        }
                      }}
                      className="text-red-600 hover:text-red-800 text-sm font-semibold px-3 py-1 transition-colors"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Question Text *
                  </label>
                  <textarea
                    value={question.text}
                    onChange={(e) =>
                      updateQuestion(question.id, "text", e.target.value)
                    }
                    placeholder="Enter the question"
                    rows="2"
                    disabled={isPublished}
                    className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-casual-green focus:ring-2 focus:ring-casual-green focus:ring-opacity-20 ${isPublished ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
                  />
                </div>

                {question.type === "mcq" && (
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Options *
                    </label>
                    <div className="space-y-2">
                      {question.options.map((option, optIdx) => (
                        <div key={optIdx} className="flex gap-2 items-center">
                          <input
                            type="radio"
                            name={`correct-${question.id}`}
                            checked={question.correctAnswer === optIdx}
                            onChange={() =>
                              updateQuestion(
                                question.id,
                                "correctAnswer",
                                optIdx,
                              )
                            }
                            className="mt-0.5"
                          />
                          <span className="text-sm font-semibold text-gray-500 w-5">
                            ({String.fromCharCode(97 + optIdx)})
                          </span>
                          <input
                            type="text"
                            value={option}
                            onChange={(e) =>
                              updateOption(question.id, optIdx, e.target.value)
                            }
                            placeholder={`Option ${String.fromCharCode(97 + optIdx)}`}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-casual-green"
                          />
                          {question.options.length > 2 && (
                            <button
                              onClick={() => removeOption(question.id, optIdx)}
                              className="text-red-500 hover:text-red-700 px-3 py-2"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => addOption(question.id)}
                      className="text-sm text-casual-green font-semibold mt-2 hover:text-hornblende-green"
                    >
                      + Add Option
                    </button>
                  </div>
                )}

                {question.type === "true_false" && (
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Correct Answer *
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name={`tf-${question.id}`}
                          checked={question.correctAnswer === 0}
                          onChange={() =>
                            updateQuestion(question.id, "correctAnswer", 0)
                          }
                          className="mr-2"
                        />
                        <span className="text-gray-700">True</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name={`tf-${question.id}`}
                          checked={question.correctAnswer === 1}
                          onChange={() =>
                            updateQuestion(question.id, "correctAnswer", 1)
                          }
                          className="mr-2"
                        />
                        <span className="text-gray-700">False</span>
                      </label>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Points
                  </label>
                  <input
                    type="number"
                    value={question.points}
                    onChange={(e) =>
                      updateQuestion(
                        question.id,
                        "points",
                        parseInt(e.target.value),
                      )
                    }
                    min="1"
                    className="w-20 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-casual-green"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-4 mb-8">
        {!isPublished && (
          <>
            <button
              onClick={() => handleSaveQuiz(false)}
              disabled={loading}
              className="flex-1 bg-blue-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Saving..." : "Save as Draft"}
            </button>
            <button
              onClick={() => setShowSectionModal(true)}
              className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors relative"
            >
              Assign to Sections
              {selectedSectionIds.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-white text-orange-600 border-2 border-orange-500 text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                  {selectedSectionIds.length}
                </span>
              )}
            </button>
            <button
              onClick={() => handleSaveQuiz(true)}
              disabled={loading || questions.length === 0}
              className="flex-1 bg-casual-green text-white px-6 py-3 rounded-lg font-semibold hover:bg-hornblende-green transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                questions.length === 0
                  ? "Add at least one question to publish"
                  : ""
              }
            >
              {loading ? "Publishing..." : "Publish Quiz"}
            </button>
          </>
        )}
        {quizId && (
          <>
            <button
              onClick={() =>
                navigate(`/instructor-dashboard/question-bank/${quizId}`)
              }
              className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              📚 Load from Archive
            </button>
            {isPublished && (
              <button
                onClick={() =>
                  navigate(`/instructor-dashboard/quiz-results/${quizId}`)
                }
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                📊 View Results
              </button>
            )}
          </>
        )}
        <button
          onClick={() => navigate("/instructor-dashboard/quizzes")}
          className="bg-gray-300 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:bg-gray-400 transition-colors"
        >
          {quizId ? "Close" : "Cancel"}
        </button>
      </div>
    </div>
  );
};
