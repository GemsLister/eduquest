import { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient.js";
import { useAuth } from "../../context/AuthContext.jsx";

export const QuizVersions = () => {
  const { user: authUser } = useAuth();
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState("");
  const [quizVersions, setQuizVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(null);

  // Fetch sections on mount
  useEffect(() => {
    const fetchSections = async () => {
      if (!authUser) return;
      try {
        setUserId(authUser.id);

        const { data: sectionsData } = await supabase
          .from("sections")
          .select("*")
          .eq("instructor_id", authUser.id)
          .eq("is_archived", false)
          .order("name", { ascending: true });

        setSections(sectionsData || []);
      } catch (err) {
        console.error("Error fetching sections:", err);
      }
    };
    fetchSections();
  }, []);

  // Fetch quiz versions when section is selected
  useEffect(() => {
    if (!selectedSection) {
      setQuizVersions([]);
      return;
    }

    const fetchQuizVersions = async () => {
      setLoading(true);
      try {
        // Get all quizzes in this section
        const { data: allQuizzes } = await supabase
          .from("quizzes")
          .select("*")
          .eq("section_id", selectedSection)
          .eq("is_archived", false)
          .order("created_at", { ascending: false });

        // Group by parent_quiz_id or id
        const groupedQuizzes = {};
        
        allQuizzes?.forEach((quiz) => {
          const parentId = quiz.parent_quiz_id || quiz.id;
          if (!groupedQuizzes[parentId]) {
            groupedQuizzes[parentId] = {
              original: null,
              versions: [],
            };
          }

          if (quiz.parent_quiz_id) {
            // This is a revised version
            groupedQuizzes[parentId].versions.push(quiz);
          } else {
            // This is the original
            groupedQuizzes[parentId].original = quiz;
          }
        });

        // Convert to array and sort
        const result = Object.values(groupedQuizzes)
          .filter((group) => group.original)
          .sort((a, b) => new Date(b.original.created_at) - new Date(a.original.created_at));

        setQuizVersions(result);
      } catch (err) {
        console.error("Error fetching quiz versions:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchQuizVersions();
  }, [selectedSection]);

  const publishQuiz = async (quizId) => {
    try {
      const { error } = await supabase
        .from("quizzes")
        .update({ is_published: true })
        .eq("id", quizId);

      if (error) throw error;

      // Refresh the list
      setQuizVersions(
        quizVersions.map((group) => ({
          ...group,
          versions: group.versions.map((v) =>
            v.id === quizId ? { ...v, is_published: true } : v
          ),
        }))
      );

      alert("Quiz published successfully!");
    } catch (err) {
      console.error("Error publishing quiz:", err);
      alert("Failed to publish quiz");
    }
  };

  const deleteVersion = async (quizId) => {
    if (confirm("Are you sure you want to delete this quiz version?")) {
      try {
        const { error } = await supabase
          .from("quizzes")
          .delete()
          .eq("id", quizId);

        if (error) throw error;

        setQuizVersions(
          quizVersions.map((group) => ({
            ...group,
            versions: group.versions.filter((v) => v.id !== quizId),
          }))
        );

        alert("Quiz version deleted successfully!");
      } catch (err) {
        console.error("Error deleting quiz:", err);
        alert("Failed to delete quiz version");
      }
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-authentic-white">
      {/* Header */}
      <div className="bg-brand-navy px-6 py-8 text-white">
        <h1 className="text-3xl font-black mb-2">Quiz Versions</h1>
        <p className="text-white/70">
          Manage original quizzes and their revised versions from Item Analysis
        </p>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Section Selection */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Select Section
          </label>
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="">-- Select a Section --</option>
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.name}
              </option>
            ))}
          </select>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-gold"></div>
            <p className="mt-2 text-gray-600">Loading quizzes...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !selectedSection && (
          <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-600">
            Select a section to view quiz versions
          </div>
        )}

        {!loading && selectedSection && quizVersions.length === 0 && (
          <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-600">
            No quizzes found in this section
          </div>
        )}

        {/* Quiz Versions */}
        {!loading && selectedSection && quizVersions.length > 0 && (
          <div className="space-y-6">
            {quizVersions.map((group) => (
              <div
                key={group.original.id}
                className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden"
              >
                {/* Original Quiz */}
                <div className="bg-gradient-to-r from-brand-navy to-brand-indigo px-6 py-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-white">
                        {group.original.title}
                      </h3>
                      <p className="text-white/70 text-sm mt-1">
                        {group.original.description}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold text-white ${
                          group.original.is_published
                            ? "bg-green-500"
                            : "bg-yellow-500"
                        }`}
                      >
                        {group.original.is_published ? "PUBLISHED" : "DRAFT"}
                      </span>
                      {group.versions.length > 0 && (
                        <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold text-white">
                          {group.versions.length} revision{group.versions.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Revised Versions */}
                {group.versions.length > 0 && (
                  <div className="bg-gray-50 p-6 border-t border-gray-200">
                    <h4 className="font-semibold text-gray-800 mb-4">
                      Revised Versions
                    </h4>
                    <div className="space-y-3">
                      {group.versions.map((version) => (
                        <div
                          key={version.id}
                          className="bg-white border border-blue-200 rounded-lg p-4"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-800">
                                {version.title}
                              </p>
                              <p className="text-sm text-gray-600 mt-1">
                                {version.description}
                              </p>
                              <div className="flex gap-2 mt-2">
                                <span
                                  className={`text-xs px-2 py-1 rounded font-bold ${
                                    version.is_published
                                      ? "bg-green-100 text-green-700"
                                      : "bg-yellow-100 text-yellow-700"
                                  }`}
                                >
                                  {version.is_published ? "PUBLISHED" : "DRAFT"}
                                </span>
                                <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 font-bold">
                                  v{version.version_number}
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col gap-2 ml-4">
                              {!version.is_published && (
                                <button
                                  onClick={() => publishQuiz(version.id)}
                                  className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded text-sm transition-colors"
                                >
                                  Publish
                                </button>
                              )}
                              <button
                                onClick={() => deleteVersion(version.id)}
                                className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded text-sm transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No Versions */}
                {group.versions.length === 0 && (
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 text-center text-gray-500 text-sm">
                    No revised versions yet. Run Item Analysis to create one.
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
