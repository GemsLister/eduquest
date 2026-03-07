import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { itemAnalysisService } from "../../services/itemAnalysisService";

export const ItemDifficulty = () => {
  const navigate = useNavigate();
  
  // State for section and quiz selection
  const [sections, setSections] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedQuiz, setSelectedQuiz] = useState("");
  
  // State for analysis data
  const [analysis, setAnalysis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingSections, setLoadingSections] = useState(true);
  const [loadingQuizzes, setLoadingQuizzes] = useState(false);
  const [user, setUser] = useState(null);
  const [savingAnalysis, setSavingAnalysis] = useState(false);
  const [analysisSaved, setAnalysisSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [expandedQuestion, setExpandedQuestion] = useState(null);
  const [takersPage, setTakersPage] = useState({});

  // Fetch user and sections on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get current user
        const {
          data: { user: authUser },
          error: authError,
        } = await supabase.auth.getUser();
        
        if (authError) throw authError;
        setUser(authUser);
        
        if (authUser) {
          // Fetch instructor's sections
          const { data: sectionsData, error: sectionsError } = await supabase
            .from("sections")
            .select("id, name, description")
            .eq("instructor_id", authUser.id)
            .order("created_at", { ascending: false });
          
          if (sectionsError) {
            console.error("Error fetching sections:", sectionsError);
          } else {
            setSections(sectionsData || []);
          }
        }
      } catch (err) {
        console.error("Error fetching sections:", err);
      } finally {
        setLoadingSections(false);
      }
    };
    
    fetchData();
  }, []);

  // Fetch quizzes when section is selected
  useEffect(() => {
    const fetchQuizzes = async () => {
      if (!selectedSection) {
        setQuizzes([]);
        return;
      }
      
      setLoadingQuizzes(true);
      try {
        const { data: quizzesData, error: quizzesError } = await supabase
          .from("quizzes")
          .select("id, title, is_published")
          .eq("section_id", selectedSection)
          .order("created_at", { ascending: false });
        
        if (quizzesError) throw quizzesError;
        setQuizzes(quizzesData || []);
      } catch (err) {
        console.error("Error fetching quizzes:", err);
      } finally {
        setLoadingQuizzes(false);
      }
    };
    
    fetchQuizzes();
  }, [selectedSection]);

  // Fetch analysis when quiz is selected
  useEffect(() => {
    if (selectedQuiz) {
      fetchAndAnalyze(selectedQuiz);
    } else {
      setAnalysis([]);
    }
  }, [selectedQuiz]);

  // Simple flagging based on difficulty status only
  const calculateAutoFlag = (difficultyStatus) => {
    // difficultyStatus can be: "Easy", "Moderate", "Difficult", "N/A"
    switch (difficultyStatus) {
      case "Easy":
        return "retain";
      case "Moderate":
        return "needs_revision";
      case "Difficult":
        return "discard";
      default:
        return "pending";
    }
  };

  const fetchAndAnalyze = async (quizId) => {
    try {
      setLoading(true);

      // 1. Get Questions with options
      const { data: questions, error: qError } = await supabase
        .from("questions")
        .select("id, text, type, options, correct_answer")
        .eq("quiz_id", quizId);

      if (qError) console.error("Question Error:", qError);

      if (!questions || questions.length === 0) {
        setAnalysis([]);
        return;
      }

      // 2. Get all attempts for this quiz (include all statuses)
      const { data: attempts, error: aError } = await supabase
        .from("quiz_attempts")
        .select("id, score, user_id, guest_name")
        .eq("quiz_id", quizId);

      if (aError) console.error("Attempts Error:", aError);
      
      // Store total attempts count
      const attemptsCount = attempts?.length || 0;
      setTotalAttempts(attemptsCount);

      // Get unique user IDs from attempts
      const userIds = attempts?.filter(a => a.user_id).map(a => a.user_id) || [];
      
      // Fetch profile info for users (including email)
      let profilesMap = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username, first_name, last_name, email")
          .in("id", [...new Set(userIds)]);
        
        if (profiles) {
          profiles.forEach(p => {
            profilesMap[p.id] = p;
          });
        }
      }

      // Create a map of attempt_id to taker info (including email)
      const takersMap = {};
      attempts?.forEach(att => {
        const profile = profilesMap[att.user_id];
        let takerName = att.guest_name || "Anonymous";
        let takerEmail = "";
        
        if (profile) {
          takerEmail = profile.email || "";
          if (profile.first_name || profile.last_name) {
            takerName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim();
          } else if (profile.username) {
            takerName = profile.username;
          }
        }
        takersMap[att.id] = {
          id: att.id,
          name: takerName,
          email: takerEmail,
          score: att.score
        };
      });

      // 3. Get all responses for this quiz's questions
      const questionIds = questions.map((q) => q.id);
      
      const { data: responses, error: rError } = await supabase
        .from("quiz_responses")
        .select("id, question_id, is_correct, attempt_id, answer")
        .in("question_id", questionIds);

      if (rError) console.error("Response Error:", rError);

      // 4. Calculate item analysis
      const results = questions.map((q) => {
        const qResponses = responses
          ? responses.filter((r) => r.question_id === q.id)
          : [];
        
        const total = qResponses.length;
        const correct = qResponses.filter((r) => r.is_correct).length;
        const hasResponses = qResponses.length > 0;
        
        // Difficulty: proportion of correct answers
        let fi = 0;
        if (hasResponses) {
          fi = correct / qResponses.length;
        } else if (attemptsCount > 0 && qResponses.length === 0) {
          fi = -1;
        }

        // Determine difficulty status
        let level = "N/A";
        if (fi >= 0.75) level = "Easy";
        else if (fi >= 0.3) level = "Moderate";
        else if (fi >= 0) level = "Difficult";

        // Calculate Discrimination Index
        let discrimination = 0;
        let discStatus = "N/A";
        
        if (qResponses && qResponses.length >= 2) {
          const allStudentsWhoAnswered = qResponses.map(r => {
            const taker = takersMap[r.attempt_id];
            return {
              attemptId: r.attempt_id,
              score: taker ? taker.score : 0
            };
          });
          
          allStudentsWhoAnswered.sort((a, b) => b.score - a.score);
          
          const totalAnswered = allStudentsWhoAnswered.length;
          const upperCount = Math.max(1, Math.floor(totalAnswered * 0.27));
          const lowerCount = Math.max(1, Math.floor(totalAnswered * 0.27));

          const upperGroup = allStudentsWhoAnswered.slice(0, upperCount);
          const lowerGroup = allStudentsWhoAnswered.slice(-lowerCount);

          let upperCorrect = 0;
          let lowerCorrect = 0;
          
          upperCorrect = qResponses.filter(
            r => upperGroup.some(u => u.attemptId === r.attempt_id) && r.is_correct
          ).length;
          lowerCorrect = qResponses.filter(
            r => lowerGroup.some(l => l.attemptId === r.attempt_id) && r.is_correct
          ).length;
          
          if (upperCount > 0 && lowerCount > 0) {
            discrimination = (upperCorrect / upperCount) - (lowerCorrect / lowerCount);
          }
          
          if (discrimination >= 0.4) discStatus = "Excellent";
          else if (discrimination >= 0.3) discStatus = "Good";
          else if (discrimination >= 0.2) discStatus = "Acceptable";
          else if (discrimination > -1) discStatus = "Poor";
        }

        // Calculate auto-flag based on difficulty status ONLY
        const autoFlag = calculateAutoFlag(level);

        // Distractor Analysis for MCQ
        let distractorAnalysis = null;
        if (q.type === "mcq" && q.options && qResponses.length > 0) {
          distractorAnalysis = {};
          
          q.options.forEach((opt, idx) => {
            distractorAnalysis[`option_${idx}`] = { 
              label: opt, 
              count: 0, 
              percentage: 0 
            };
          });
          distractorAnalysis.no_answer = { label: "No Answer", count: 0, percentage: 0 };
          
          qResponses.forEach(r => {
            if (r.is_correct) {
              if (!distractorAnalysis.correct) {
                distractorAnalysis.correct = { label: "Correct Answer", count: 0, percentage: 0 };
              }
              distractorAnalysis.correct.count++;
            } else if (r.answer !== undefined && r.answer !== null) {
              const optKey = `option_${r.answer}`;
              if (distractorAnalysis[optKey]) {
                distractorAnalysis[optKey].count++;
              } else {
                distractorAnalysis.no_answer.count++;
              }
            } else {
              distractorAnalysis.no_answer.count++;
            }
          });

          Object.keys(distractorAnalysis).forEach(key => {
            distractorAnalysis[key].percentage = qResponses.length > 0
              ? ((distractorAnalysis[key].count / qResponses.length) * 100).toFixed(1)
              : 0;
          });
        }

        // Get takers details with email
        const takersDetails = qResponses.map(r => {
          const taker = takersMap[r.attempt_id];
          let answerText = r.answer;
          
          if (q.type === "mcq" && q.options && r.answer !== null && r.answer !== undefined) {
            const optionIndex = parseInt(r.answer);
            if (!isNaN(optionIndex) && q.options[optionIndex]) {
              answerText = q.options[optionIndex];
            }
          } else if (q.type === "true_false") {
            answerText = r.answer === "true" ? "True" : r.answer === "false" ? "False" : r.answer;
          }
          
          return {
            id: r.attempt_id,
            name: taker ? taker.name : "Anonymous",
            email: taker ? taker.email : "",
            answer: answerText,
            isCorrect: r.is_correct
          };
        });

        return {
          question_id: q.id,
          text: q.text,
          type: q.type,
          difficulty: fi >= 0 ? fi.toFixed(2) : "N/A",
          status: level,
          total: total,
          responsesCount: qResponses.length,
          discrimination: discrimination.toFixed(2),
          discStatus: discStatus,
          autoFlag: autoFlag,
          distractorAnalysis: distractorAnalysis,
          options: q.options,
          correct_answer: q.correct_answer,
          takersDetails: takersDetails
        };
      });

      setAnalysis(results);
      setAnalysisSaved(false);
    } catch (err) {
      console.error("System Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAnalysis = async () => {
    if (!selectedQuiz || analysis.length === 0) return;
    
    setSavingAnalysis(true);
    setSaveError(null);
    
    try {
      const { data, error } = await itemAnalysisService.saveItemAnalysis(
        selectedQuiz,
        analysis
      );
      
      if (error) {
        setSaveError(error.message || "Failed to save analysis");
        alert("Failed to save analysis: " + (error.message || "Unknown error"));
      } else {
        setAnalysisSaved(true);
        alert("Analysis saved successfully!");
      }
    } catch (err) {
      setSaveError(err.message);
      alert("Failed to save analysis. Please check console for details.");
    } finally {
      setSavingAnalysis(false);
    }
  };

  const toggleDetails = (questionId) => {
    setExpandedQuestion(expandedQuestion === questionId ? null : questionId);
  };

  const getFlagBadge = (flag) => {
    const flagConfig = {
      pending: { label: "Pending", className: "bg-yellow-100 text-yellow-700 border-yellow-300" },
      retain: { label: "Retain", className: "bg-green-100 text-green-700 border-green-300" },
      needs_revision: { label: "Needs Revision", className: "bg-orange-100 text-orange-700 border-orange-300" },
      discard: { label: "Discard", className: "bg-red-100 text-red-700 border-red-300" },
    };
    
    const config = flagConfig[flag] || flagConfig.pending;
    return (
      <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase border ${config.className}`}>
        {config.label}
      </span>
    );
  };

  // Show loading state while fetching sections
  if (loadingSections) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-casual-green"></div>
          <p className="mt-4 text-hornblende-green font-semibold">Loading sections...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white shadow-lg rounded-xl overflow-hidden mb-6">
          <div className="p-6 bg-indigo-600 text-white">
            <h1 className="text-2xl font-bold uppercase tracking-wider">
              Item Analysis Report
            </h1>
            <p className="opacity-80 text-sm">
              Analyze question difficulty and discrimination based on student responses
            </p>
          </div>

          {/* Selection Controls */}
          <div className="p-6 bg-gray-50 border-b border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Section Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Select Section *
                </label>
                <select
                  value={selectedSection}
                  onChange={(e) => {
                    setSelectedSection(e.target.value);
                    setSelectedQuiz("");
                    setAnalysis([]);
                    setAnalysisSaved(false);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                >
                  <option value="">-- Select a Section --</option>
                  {sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name}
                      {section.description ? ` - ${section.description}` : ""}
                    </option>
                  ))}
                </select>
                {sections.length === 0 && (
                  <p className="text-sm text-gray-500 mt-1">
                    No sections found. Create a section first.
                  </p>
                )}
              </div>

              {/* Quiz/Subject Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Select Quiz/Subject *
                </label>
                <select
                  value={selectedQuiz}
                  onChange={(e) => {
                    setSelectedQuiz(e.target.value);
                    setAnalysisSaved(false);
                  }}
                  disabled={!selectedSection || loadingQuizzes}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {loadingQuizzes 
                      ? "Loading quizzes..." 
                      : !selectedSection 
                        ? "Select a section first" 
                        : "-- Select a Quiz --"}
                  </option>
                  {quizzes.map((quiz) => (
                    <option key={quiz.id} value={quiz.id}>
                      {quiz.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Analysis Results */}
        {selectedQuiz && (
          <div className="bg-white shadow-lg rounded-xl overflow-hidden">
            {/* Action Buttons */}
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-700">
                  Analysis Results
                  {analysis.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      ({analysis.length} questions)
                    </span>
                  )}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Total Students Who Took Quiz: {totalAttempts}
                </p>
              </div>
              <div className="flex gap-2">
                {saveError && (
                  <span className="text-red-500 text-sm self-center">
                    {saveError}
                  </span>
                )}
                <button
                  onClick={handleSaveAnalysis}
                  disabled={savingAnalysis || analysis.length === 0}
                  className={`px-6 py-2 rounded-lg font-semibold text-white transition-colors ${
                    savingAnalysis || analysis.length === 0
                      ? "bg-gray-400 cursor-not-allowed"
                      : analysisSaved
                        ? "bg-green-500 hover:bg-green-600"
                        : "bg-indigo-600 hover:bg-indigo-700"
                  }`}
                >
                  {savingAnalysis 
                    ? "Saving..." 
                    : analysisSaved 
                      ? "Saved ✓" 
                      : "Save Analysis"}
                </button>
              </div>
            </div>

            {!loading && analysis.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-500 text-lg">
                  No analysis data available for this quiz.
                </p>
                <p className="text-gray-400 text-sm mt-2">
                  Students need to take the quiz first to generate analysis data.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100 text-gray-600 text-xs uppercase">
                    <tr>
                      <th className="p-4 text-left w-1/4">Question</th>
                      <th className="p-4 text-center">Takers</th>
                      <th className="p-4 text-center">Difficulty</th>
                      <th className="p-4 text-center">Status</th>
                      <th className="p-4 text-center">Discrimination</th>
                      <th className="p-4 text-center">Disc. Status</th>
                      <th className="p-4 text-center">Flag</th>
                      <th className="p-4 text-center">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.map((item, idx) => (
                      <>
                        <tr key={idx} className="border-b hover:bg-gray-50 transition">
                          <td className="p-4 text-sm text-gray-700">
                            <div className="flex justify-between items-center">
                              <span className="truncate max-w-xs">{item.text}</span>
                            </div>
                          </td>
                          <td className="p-4 text-center font-mono">{item.total}</td>
                          <td className="p-4 text-center font-bold text-indigo-600">
                            {item.difficulty}
                          </td>
                          <td className="p-4 text-center">
                            <span
                              className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                                item.status === "Easy"
                                  ? "bg-green-100 text-green-700"
                                  : item.status === "Moderate"
                                    ? "bg-yellow-100 text-yellow-700"
                                    : item.status === "Difficult"
                                      ? "bg-red-100 text-red-700"
                                      : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td className="p-4 text-center font-mono text-indigo-600">
                            {item.discStatus !== "N/A" ? item.discrimination : "N/A"}
                          </td>
                          <td className="p-4 text-center">
                            <span
                              className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                                item.discStatus === "Excellent"
                                  ? "bg-green-100 text-green-700"
                                  : item.discStatus === "Good"
                                    ? "bg-blue-100 text-blue-700"
                                    : item.discStatus === "Acceptable"
                                      ? "bg-yellow-100 text-yellow-700"
                                      : item.discStatus === "Poor"
                                        ? "bg-red-100 text-red-700"
                                        : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {item.discStatus}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            {getFlagBadge(item.autoFlag)}
                          </td>
                          <td className="p-4 text-center">
                            {(item.distractorAnalysis || item.takersDetails) && item.takersDetails.length > 0 ? (
                              <button
                                onClick={() => toggleDetails(item.question_id)}
                                className="px-3 py-1 bg-indigo-100 text-indigo-700 text-xs rounded hover:bg-indigo-200 transition"
                              >
                                {expandedQuestion === item.question_id ? "Hide" : "View"}
                              </button>
                            ) : (
                              <span className="text-xs text-gray-400">N/A</span>
                            )}
                          </td>
                        </tr>
                        {expandedQuestion === item.question_id && (
                          <tr key={`${idx}-expanded`} className="bg-indigo-50">
                            <td colSpan="8" className="p-4">
                              <div className="ml-4 space-y-4">
                                {/* Student Answers Table */}
                                {item.takersDetails && item.takersDetails.length > 0 && (
                                  <div>
                                    <h4 className="font-semibold text-sm text-gray-700 mb-2">
                                      Student Answers ({item.takersDetails.length} takers)
                                    </h4>
                                    {(() => {
                                      const currentPage = takersPage[item.question_id] || 1;
                                      const itemsPerPage = 10;
                                      const totalPages = Math.ceil(item.takersDetails.length / itemsPerPage);
                                      const startIndex = (currentPage - 1) * itemsPerPage;
                                      const endIndex = startIndex + itemsPerPage;
                                      const paginatedTakers = item.takersDetails.slice(startIndex, endIndex);
                                      
                                      return (
                                        <>
                                          <div className="overflow-x-auto">
                                            <table className="w-full bg-white rounded-lg border border-gray-200">
                                              <thead className="bg-gray-100 text-gray-600 text-xs uppercase">
                                                <tr>
                                                  <th className="p-3 text-left">#</th>
                                                  <th className="p-3 text-left">Student's Email</th>
                                                  <th className="p-3 text-left">Answer</th>
                                                  <th className="p-3 text-center">Result</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {paginatedTakers.map((taker, takerIdx) => (
                                                  <tr key={takerIdx} className="border-t border-gray-100">
                                                    <td className="p-3 text-sm text-gray-600">
                                                      {startIndex + takerIdx + 1}
                                                    </td>
                                                    <td className="p-3 text-sm font-medium text-gray-700">
                                                      {taker.name}
                                                    </td>
                                                    <td className="p-3 text-sm text-gray-600">
                                                      {taker.email || "N/A"}
                                                    </td>
                                                    <td className="p-3 text-sm text-gray-700">
                                                      {taker.answer || "No answer"}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                      <span className={`px-2 py-1 text-xs rounded ${
                                                        taker.isCorrect 
                                                          ? 'bg-green-100 text-green-700 font-semibold' 
                                                          : 'bg-red-100 text-red-700 font-semibold'
                                                      }`}>
                                                        {taker.isCorrect ? 'Correct' : 'Incorrect'}
                                                      </span>
                                                    </td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                          {totalPages > 1 && (
                                            <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-200">
                                              <span className="text-xs text-gray-500">
                                                Showing {startIndex + 1}-{Math.min(endIndex, item.takersDetails.length)} of {item.takersDetails.length}
                                              </span>
                                              <div className="flex gap-2">
                                                <button
                                                  onClick={() => setTakersPage({...takersPage, [item.question_id]: currentPage - 1})}
                                                  disabled={currentPage === 1}
                                                  className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                  Previous
                                                </button>
                                                <span className="text-xs text-gray-600 self-center">
                                                  Page {currentPage} of {totalPages}
                                                </span>
                                                <button
                                                  onClick={() => setTakersPage({...takersPage, [item.question_id]: currentPage + 1})}
                                                  disabled={currentPage === totalPages}
                                                  className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                  Next
                                                </button>
                                              </div>
                                            </div>
                                          )}
                                        </>
                                      );
                                    })()}
                                  </div>
                                )}
                                
                                {/* Distractor Analysis Section */}
                                {item.distractorAnalysis && (
                                  <div>
                                    <h4 className="font-semibold text-sm text-gray-700 mb-2">
                                      Distractor Analysis
                                    </h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                      {Object.entries(item.distractorAnalysis)
                                        .filter(([key]) => key !== 'distractors')
                                        .map(([key, data]) => (
                                          <div 
                                            key={key} 
                                            className={`p-2 rounded ${key === 'correct' ? 'bg-green-100 border border-green-300' : 'bg-white border border-gray-200'}`}
                                          >
                                            <div className="text-xs font-semibold text-gray-600">
                                              {data.label || key}
                                            </div>
                                            <div className="text-lg font-bold text-gray-800">
                                              {data.count} <span className="text-xs font-normal">({data.percentage}%)</span>
                                            </div>
                                          </div>
                                        ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Empty State - No Selection */}
        {!selectedQuiz && (
          <div className="bg-white shadow-lg rounded-xl overflow-hidden p-12 text-center">
            <div className="text-6xl mb-4">📊</div>
            <h2 className="text-xl font-bold text-gray-700 mb-2">
              Select a Section and Quiz
            </h2>
            <p className="text-gray-500 max-w-md mx-auto">
              Choose a section from the dropdown, then select a quiz to view its 
              item difficulty analysis based on student performance.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
