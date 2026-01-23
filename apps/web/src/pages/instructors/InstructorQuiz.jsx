import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient.js";

const QUESTION_TYPES = [
  { value: "mcq", label: "Multiple Choice" },
  { value: "short_answer", label: "Short Answer" },
  { value: "true_false", label: "True/False" },
];

export const InstructorQuiz = () => {
  const navigate = useNavigate();
  const [quizTitle, setQuizTitle] = useState("");
  const [quizDescription, setQuizDescription] = useState("");
  const [quizDuration, setQuizDuration] = useState("");
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Add new question
  const addQuestion = () => {
    const newQuestion = {
      id: Date.now(),
      type: "mcq",
      text: "",
      options: ["", ""],
      correctAnswer: 0,
      points: 1,
    };
    setQuestions([...questions, newQuestion]);
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

  // Delete question
  const deleteQuestion = (id) => {
    setQuestions(questions.filter((q) => q.id !== id));
  };

  // Save quiz
  const handleSaveQuiz = async () => {
    setError("");

    // Validation
    if (!quizTitle.trim()) {
      setError("Quiz title is required");
      return;
    }
    if (questions.length === 0) {
      setError("Add at least one question");
      return;
    }

    // Validate all questions
    for (let q of questions) {
      if (!q.text.trim()) {
        setError("All questions must have text");
        return;
      }
      if (q.type === "mcq" && q.options.some((opt) => !opt.trim())) {
        setError("All options must be filled in MCQ questions");
        return;
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
        return;
      }

      // Save quiz to Supabase
      const { data: quiz, error: quizError } = await supabase
        .from("quizzes")
        .insert([
          {
            instructor_id: user.id,
            title: quizTitle,
            description: quizDescription || null,
            duration: quizDuration ? parseInt(quizDuration) : null,
            is_published: false,
          },
        ])
        .select();

      if (quizError) throw quizError;
      if (!quiz || quiz.length === 0) throw new Error("Failed to create quiz");

      const quizId = quiz[0].id;

      // Save questions to Supabase
      const questionsData = questions.map((q) => ({
        quiz_id: quizId,
        type: q.type,
        text: q.text,
        options: q.type === "mcq" ? q.options : null,
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

      alert("Quiz saved successfully!");
      navigate("/instructor-dashboard");
    } catch (err) {
      setError(err.message || "Failed to save quiz");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-authentic-white p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-hornblende-green mb-2">
          Create Quiz
        </h1>
        <p className="text-gray-600">
          Build a new quiz with questions and answers
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          {error}
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
                    Question {idx + 1}
                  </h3>
                  <button
                    onClick={() => deleteQuestion(question.id)}
                    className="text-red-500 hover:text-red-700 text-sm font-semibold"
                  >
                    Delete
                  </button>
                </div>

                {/* Question Type */}
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Question Type
                  </label>
                  <select
                    value={question.type}
                    onChange={(e) =>
                      updateQuestion(question.id, "type", e.target.value)
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-casual-green"
                  >
                    {QUESTION_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
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
                        <div key={optIdx} className="flex gap-2">
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
                            className="mt-3"
                          />
                          <input
                            type="text"
                            value={option}
                            onChange={(e) =>
                              updateOption(question.id, optIdx, e.target.value)
                            }
                            placeholder={`Option ${optIdx + 1}`}
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
          onClick={handleSaveQuiz}
          disabled={loading}
          className="flex-1 bg-casual-green text-white px-6 py-3 rounded-lg font-semibold hover:bg-hornblende-green transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Saving..." : "Save Quiz"}
        </button>
        <button
          onClick={() => navigate("/instructor-dashboard")}
          className="flex-1 bg-gray-300 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:bg-gray-400 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
