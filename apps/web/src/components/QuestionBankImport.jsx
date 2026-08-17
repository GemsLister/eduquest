import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient.js";
import { useAuth } from "../context/AuthContext.jsx";

export const QuestionBankImport = ({ selectedQuestions, setSelectedQuestions }) => {
  const { user } = useAuth();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Subject and exam filter state
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [selectedQuizId, setSelectedQuizId] = useState(null);
  const [sections, setSections] = useState([]);
  const [quizzesFromSection, setQuizzesFromSection] = useState([]);
  const [sectionsLoading, setSectionsLoading] = useState(true);

  // Pagination state
  const ITEMS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchSections();
  }, [user]);

  useEffect(() => {
    fetchQuestionBank();
  }, [selectedSectionId, selectedQuizId, user]);

  // Reset pagination when filters or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedSectionId, selectedQuizId, searchTerm]);

  // Fetch sections/subjects
  const fetchSections = async () => {
    try {
      setSectionsLoading(true);
      if (!user) return;

      const { data, error } = await supabase
        .from("sections")
        .select("id, name")
        .eq("instructor_id", user.id)
        .eq("is_archived", false)
        .order("name", { ascending: true });

      if (error) throw error;
      setSections(data || []);
    } catch (err) {
      console.error("Error fetching sections:", err);
    } finally {
      setSectionsLoading(false);
    }
  };

  // Fetch quizzes when section changes
  useEffect(() => {
    if (!selectedSectionId) {
      setQuizzesFromSection([]);
      setSelectedQuizId(null);
      return;
    }

    const fetchQuizzes = async () => {
      try {
        const { data, error } = await supabase
          .from("quizzes")
          .select("id, title")
          .eq("section_id", selectedSectionId)
          .eq("instructor_id", user.id) // Filter by owner
          .or("is_archived.eq.false,is_published.eq.true");

        if (error) throw error;
        setQuizzesFromSection(data || []);
      } catch (err) {
        console.error("Error fetching quizzes:", err);
      }
    };

    fetchQuizzes();
  }, [selectedSectionId]);

  const fetchQuestionBank = async () => {
    try {
      setLoading(true);
      if (!user) return;

      // First, get all quiz IDs belonging to the current instructor
      const { data: userQuizzes } = await supabase
        .from("quizzes")
        .select("id")
        .eq("instructor_id", user.id);

      const userQuizIds = userQuizzes?.map(q => q.id) || [];

      if (userQuizIds.length === 0) {
        setQuestions([]);
        setLoading(false);
        return;
      }

      // Filter by user's quizzes to ensure ownership
      let query = supabase
        .from("questions")
        .select(`
          id, text, type, options, correct_answer, points, created_at, quiz_id, is_archived,
          quizzes (title, section_id, is_published)
        `)
        .in("quiz_id", userQuizIds)
        .order("created_at", { ascending: false });

      if (selectedQuizId) {
        query = query.eq("quiz_id", selectedQuizId);
      } else if (selectedSectionId) {
        // We already filtered by user's quizzes, so we can just filter by section
        const { data: sectionQuizzes } = await supabase
          .from("quizzes")
          .select("id")
          .eq("section_id", selectedSectionId)
          .eq("instructor_id", user.id); // Ensure we only get current user's quizzes in this section

        const quizIds = sectionQuizzes?.map(q => q.id) || [];
        if (quizIds.length > 0) {
          query = query.in("quiz_id", quizIds);
        } else {
          setQuestions([]);
          setLoading(false);
          return;
        }
      }

      const { data: allData, error: allError } = await query;
      if (allError) throw allError;

      // Logic: Ipakita lang ang archived, standalone, o gikan sa published exams
      const recyclableQuestions = (allData || []).filter(q =>
        q.is_archived === true ||
        q.quiz_id === null ||
        q.quizzes?.is_published === true
      );

      setQuestions(recyclableQuestions);
    } catch (err) {
      console.error("Error fetching question bank:", err);
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredQuestions = questions.filter(q =>
    q.text?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filteredQuestions.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedQuestions = filteredQuestions.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const toggleQuestionSelection = (question) => {
    setSelectedQuestions(prev => {
      const isSelected = prev.some(q => q.id === question.id);
      return isSelected
        ? prev.filter(q => q.id !== question.id)
        : [...prev, question];
    });
  };

  const handleSelectAll = () => {
    const newSelected = [...selectedQuestions];
    paginatedQuestions.forEach(q => {
      if (!newSelected.some(sq => sq.id === q.id)) newSelected.push(q);
    });
    setSelectedQuestions(newSelected);
  };

  const handleDeselectAll = () => {
    const pageIds = new Set(paginatedQuestions.map(q => q.id));
    setSelectedQuestions(selectedQuestions.filter(q => !pageIds.has(q.id)));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-gold"></div>
        <p className="mt-4 text-gray-500 font-medium">Loading questions...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-6">
      {/* Filters Section */}
      <div>
        <div className="flex justify-between w-full gap-4">
          <select
            value={selectedSectionId || ""}
            onChange={(e) => setSelectedSectionId(e.target.value || null)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold/20"
            disabled={sectionsLoading}
          >
            <option value="">📚 -- Filter by Subject --</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {selectedSectionId && (
            <select
              value={selectedQuizId || ""}
              onChange={(e) => setSelectedQuizId(e.target.value || null)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">📝 -- All Exams in Subject --</option>
              {quizzesFromSection.map((q) => (
                <option key={q.id} value={q.id}>{q.title}</option>
              ))}
            </select>
          )}
        </div>  
      </div>
      <div className="relative">
          <input
            type="text"
            placeholder="Search within results..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2.5 pl-10 border border-gray-300 rounded-lg text-sm"
          />
          <span className="absolute left-3 top-3 text-gray-400">🔍</span>
        </div>

      {/* Action Bar */}
      <div className="flex flex-wrap justify-between items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
        <div className="space-x-2">
          <button
            onClick={handleSelectAll}
            className="px-4 py-2 bg-brand-gold text-white text-sm font-semibold rounded-lg hover:bg-brand-gold-dark transition-colors"
          >
            Select All Page
          </button>
          <button
            onClick={handleDeselectAll}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50"
          >
            Clear Page
          </button>
        </div>
        <span className="text-sm font-medium text-gray-600">
          Selected: <span className="text-brand-gold">{selectedQuestions.length}</span> questions
        </span>
      </div>

      {/* List */}
      <div className="grid gap-3">
        {paginatedQuestions.length === 0 ? (
          <div className="text-center py-10 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
            <p className="text-gray-500">No questions found matching your criteria.</p>
          </div>
        ) : (
          paginatedQuestions.map((q) => {
            const isSelected = selectedQuestions.some(sq => sq.id === q.id);
            return (
              <div
                key={q.id}
                onClick={() => toggleQuestionSelection(q)}
                className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${isSelected ? "border-brand-gold bg-brand-gold/5 ring-1 ring-brand-gold" : "border-gray-100 hover:border-gray-200 bg-white"
                  }`}
              >
                <div className="flex gap-4">
                  <div className={`mt-1 h-5 w-5 rounded border-2 flex items-center justify-center ${isSelected ? "bg-brand-gold border-brand-gold" : "border-gray-300"}`}>
                    {isSelected && <span className="text-white text-xs">✓</span>}
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-800 font-medium mb-3">{q.text}</p>

                    {/* MCQ Options Display */}
                    {q.type === 'mcq' && q.options && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                        {q.options.map((opt, idx) => {
                          const letter = String.fromCharCode(65 + idx);
                          const isCorrect =
                            opt === q.correct_answer ||
                            idx === q.correct_answer ||
                            letter === String(q.correct_answer).toUpperCase();

                          return (
                            <div key={idx} className={`text-sm p-2 rounded border ${isCorrect ? 'bg-green-50 border-green-200 text-green-700 font-semibold' : 'bg-gray-50 border-gray-100 text-gray-600'}`}>
                              {letter}. {opt}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="flex gap-3 items-center text-[11px] uppercase tracking-wider font-bold text-gray-400">
                      <span className="bg-gray-100 px-2 py-1 rounded">{q.type}</span>
                      <span>•</span>
                      <span>{q.points} Points</span>
                      {q.quizzes?.title && (
                        <>
                          <span>•</span>
                          <span className="text-brand-gold">Source: {q.quizzes.title}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 pt-4">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
            className="px-4 py-2 border rounded-lg disabled:opacity-30"
          >
            Prev
          </button>
          <span className="px-4 py-2 font-medium">
            Page {currentPage} of {totalPages}
          </span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => p + 1)}
            className="px-4 py-2 border rounded-lg disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};