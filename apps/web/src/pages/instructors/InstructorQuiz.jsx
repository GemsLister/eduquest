import { useState, useEffect, startTransition } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../supabaseClient.js";

const QUESTION_TYPES = [{ value: "mcq", label: "Multiple Choice" }];

export const InstructorQuiz = () => {
  const navigate = useNavigate();
  const { quizId } = useParams();
  const [quizTitle, setQuizTitle] = useState("");
  const [quizDescription, setQuizDescription] = useState("");
  const [quizDuration, setQuizDuration] = useState("");
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(quizId ? true : false);
  const [error, setError] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [sectionId, setSectionId] = useState(null);
  const [saveStatus, setSaveStatus] = useState(""); // For auto-save feedback
  const [deletingQuestionId, setDeletingQuestionId] = useState(null);
  const [shareToken, setShareToken] = useState("");
  const [showShareUrl, setShowShareUrl] = useState(false);
  const [showAddQuestionPopup, setShowAddQuestionPopup] = useState(false);
  const [questionCount, setQuestionCount] = useState(1);

  // Load existing quiz if editing
  useEffect(() => {
    if (quizId) {
      loadQuiz();
    }
  }, [quizId]);

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
      setSectionId(quiz.section_id);
      setShareToken(quiz.share_token || "");

      // Load questions
      const { data: questionsData, error: questionsError } = await supabase
        .from("questions")
        .select("*")
        .eq("quiz_id", quizId)
        .order("created_at", { ascending: true });

      if (questionsError) throw questionsError;

      // Transform questions to match state format
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

  // Show popup to select how many questions to add
  const addQuestion = () => {
    setQuestionCount(1);
    setShowAddQuestionPopup(true);
  };

  // Add multiple questions at once
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

  // Update question
  const updateQuestion = (id, field, value) => {
    setQuestions(
      questions.map((q) => (q.id === id ? { ...q, [field]: value } : q)),
    );
  };

  // Update option
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

  // Add option to MCQ question
  const addOption = (questionId) => {
    setQuestions(
      questions.map((q) =>
        q.id === questionId ? { ...q, options: [...q.options, ""] } : q,
      ),
    );
  };

  // Remove option from MCQ question
  const removeOption = (questionId, optionIndex) => {
    setQuestions(
      questions.map((q) =>
        q.id === questionId
          ? {
              ...q,
              options: q.options.filter((_, idx) => idx !== optionIndex),
            }
          : q,
      ),
    );
  };

  // Generate share token
  const generateShareToken = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let token = "";
    for (let i = 0; i < 8; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  };

  // Copy URL to clipboard
  const copyToClipboard = () => {
    const url = `${window.location.origin}/quiz/${shareToken}`;
    navigator.clipboard.writeText(url).then(() => {
      setSaveStatus("URL copied to clipboard!");
      setTimeout(() => setSaveStatus(""), 2000);
    });
  };

  // Delete question
  const deleteQuestion = async (id) => {
    setDeletingQuestionId(id);
    console.log("deleteQuestion called with ID:", id, "Type:", typeof id);

    // If it's a new question (temp ID from Date.now()), just remove from state
    if (typeof id === "number" && id > 10000000000) {
      console.log("Deleting unsaved question from state");
      startTransition(() => {
        setQuestions(questions.filter((q) => q.id !== id));
        setDeletingQuestionId(null);
      });
      return;
    }

    // If it's a saved question from database, delete from DB
    try {
      console.log("Attempting to delete saved question from DB with ID:", id);
      const { error } = await supabase.from("questions").delete().eq("id", id);

      console.log("Delete response - error:", error);

      if (error) {
        console.error("Delete error details:", error);
        throw new Error(`Delete failed: ${error.message}`);
      }

      console.log("Question deleted successfully from DB");
      // Remove from local state immediately for instant UI feedback
      startTransition(() => {
        setQuestions((prevQuestions) => {
          const filtered = prevQuestions.filter((q) => q.id !== id);
          console.log("Updated questions state, removed ID:", id);
          return filtered;
        });
      });
    } catch (err) {
      console.error("Error deleting question - full error:", err);
      alert("❌ Error deleting question:\n" + err.message);
    } finally {
      setDeletingQuestionId(null);
    }
  };

  // Save quiz (as draft or update existing)
  const handleSaveQuiz = async (publish = false) => {
    setError("");
    setSaveStatus("Saving...");

    // Validation
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

    // Validate all questions
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
        // Update existing quiz
        // Generate token if publishing and doesn't have one yet
        if (publish && !shareToken) {
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

        // Delete old questions and insert new ones
        await supabase.from("questions").delete().eq("quiz_id", quizId);
      } else {
        // Create new quiz
        newToken = publish ? generateShareToken() : null;

        const { data: newQuiz, error: quizError } = await supabase
          .from("quizzes")
          .insert([
            {
              instructor_id: user.id,
              section_id: sectionId || null,
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
      }

      // Update state with new token
      if (newToken) {
        setShareToken(newToken);
      }

      // Save questions to Supabase
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

      if (publish) {
        setShowShareUrl(true);
        setSaveStatus("Quiz published! Share URL generated.");
        setTimeout(() => {
          setSaveStatus("");
        }, 3000);
      } else {
        setSaveStatus("Draft saved!");
        setTimeout(() => {
          setSaveStatus("");
        }, 2000);
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
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate(-1)}
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
                className={`px-4 py-2 rounded-lg font-semibold text-sm ${
                  isPublished
                    ? "bg-green-100 text-green-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {isPublished ? "Published" : "Draft"}
              </span>
              {isPublished && (
                <button
                  onClick={() =>
                    navigate(`/instructor-dashboard/quiz-results/${quizId}`)
                  }
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                >
                  📊 View Results
                </button>
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

      {/* Share URL Section */}
      {showShareUrl && shareToken && (
        <div className="mb-6 p-6 bg-blue-50 border-2 border-blue-300 rounded-lg">
          <h3 className="text-lg font-bold text-blue-900 mb-3">
            ✅ Quiz Published Successfully!
          </h3>
          <p className="text-blue-800 mb-4">
            Share this link with students so they can take the quiz from the
            computer lab:
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

      {/* Quiz Info Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-bold text-hornblende-green mb-4">
          Quiz Information
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Quiz Title *
            </label>
            <input
              type="text"
              value={quizTitle}
              onChange={(e) => setQuizTitle(e.target.value)}
              placeholder="e.g., Biology Chapter 5 Test"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-casual-green focus:ring-2 focus:ring-casual-green focus:ring-opacity-20"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={quizDescription}
              onChange={(e) => setQuizDescription(e.target.value)}
              placeholder="Describe the quiz purpose and content"
              rows="3"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-casual-green focus:ring-2 focus:ring-casual-green focus:ring-opacity-20"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Duration (minutes)
            </label>
            <input
              type="number"
              value={quizDuration}
              onChange={(e) => setQuizDuration(e.target.value)}
              placeholder="Leave blank for unlimited"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-casual-green focus:ring-2 focus:ring-casual-green focus:ring-opacity-20"
            />
          </div>
        </div>
      </div>

      {/* Add Question Count Popup */}
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

      {/* Questions Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-hornblende-green">
            Questions ({questions.length})
          </h2>
          <button
            onClick={addQuestion}
            className="bg-casual-green text-white px-4 py-2 rounded-lg font-semibold hover:bg-hornblende-green transition-colors"
          >
            + Add Question
          </button>
        </div>

        {questions.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-gray-500 mb-4">No questions added yet</p>
            <button
              onClick={addQuestion}
              className="bg-casual-green text-white px-6 py-2 rounded-lg font-semibold hover:bg-hornblende-green transition-colors"
            >
              Add First Question
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {questions.map((question, idx) => (
              <div
                key={question.id}
                className="border-2 border-gray-200 rounded-lg p-5 hover:border-casual-green transition-colors"
              >
                {/* Question Header */}
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">
                    {idx + 1}. Question {idx + 1}
                  </h3>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      deleteQuestion(question.id).catch((err) => {
                        console.error("Failed to delete question:", err);
                      });
                    }}
                    disabled={deletingQuestionId === question.id}
                    className={`${
                      deletingQuestionId === question.id
                        ? "text-gray-400 cursor-not-allowed"
                        : "text-red-500 hover:text-red-700"
                    } text-sm font-semibold transition-colors`}
                  >
                    {deletingQuestionId === question.id ? "..." : "Delete"}
                  </button>
                </div>

                {/* Question Text */}
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-casual-green focus:ring-2 focus:ring-casual-green focus:ring-opacity-20"
                  />
                </div>

                {/* Options for MCQ */}
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

                {/* True/False */}
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

                {/* Short Answer */}
                {question.type === "short_answer" && (
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Expected Answer (for reference)
                    </label>
                    <textarea
                      value={
                        typeof question.correctAnswer === "string"
                          ? question.correctAnswer
                          : ""
                      }
                      onChange={(e) =>
                        updateQuestion(
                          question.id,
                          "correctAnswer",
                          e.target.value,
                        )
                      }
                      placeholder="Enter the expected answer"
                      rows="2"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-casual-green"
                    />
                  </div>
                )}

                {/* Points */}
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

      {/* Action Buttons */}
      <div className="flex gap-4 mb-8">
        <button
          onClick={() => handleSaveQuiz(false)}
          disabled={loading}
          className="flex-1 bg-blue-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Saving..." : "Save as Draft"}
        </button>
        <button
          onClick={() => handleSaveQuiz(true)}
          disabled={loading || questions.length === 0}
          className="flex-1 bg-casual-green text-white px-6 py-3 rounded-lg font-semibold hover:bg-hornblende-green transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={
            questions.length === 0 ? "Add at least one question to publish" : ""
          }
        >
          {loading
            ? "Publishing..."
            : isPublished
              ? "Update & Publish"
              : "Publish Quiz"}
        </button>
        <button
          onClick={() => navigate(-1)}
          className="flex-1 bg-gray-300 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:bg-gray-400 transition-colors"
        >
          {quizId ? "Close" : "Cancel"}
        </button>
      </div>
    </div>
  );
};
