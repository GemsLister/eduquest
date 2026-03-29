import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient.js";

export const StudentPerformanceAnalysis = ({ 
  sectionId, 
  quizId, 
  instructorId 
}) => {
  const [studentsData, setStudentsData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [studentSearch, setStudentSearch] = useState("");

  // Load student performance data when section and quiz are selected
  useEffect(() => {
    if (sectionId && quizId) {
      loadStudentPerformance();
    }
  }, [sectionId, quizId]);

  const loadStudentPerformance = async () => {
    if (!sectionId || !quizId) return;

    setLoading(true);
    setError("");
    try {
      // Fetch quiz attempts for this specific quiz (include all statuses to see what exists)
      const { data: attemptsData, error: attemptsError } = await supabase
        .from("quiz_attempts")
        .select(`
          id,
          user_id,
          score,
          started_at,
          completed_at,
          status
        `)
        .eq("quiz_id", quizId)
        .order("completed_at", { ascending: false });

      if (attemptsError) {
        console.error("Error fetching quiz attempts:", attemptsError);
        
        // Handle foreign key constraint errors
        if (attemptsError.message?.includes('foreign key constraint') || 
            attemptsError.message?.includes('23503')) {
          setError("Database integrity issue detected. Please run the database migration to fix user references in quiz attempts.");
          setLoading(false);
          return;
        }
        
        // Handle missing column errors
        if (attemptsError.message?.includes('user_id') || attemptsError.message?.includes('column')) {
          setError("Database schema needs to be updated. Please apply the latest migrations to enable user identification.");
          setLoading(false);
          return;
        }
        
        throw attemptsError;
      }

      // Debug: Log what we found
      console.log("Quiz attempts found:", attemptsData?.length || 0);
      console.log("Attempts data:", attemptsData);

      // Filter for completed attempts but also show other statuses for debugging
      const completedAttempts = (attemptsData || []).filter(attempt => 
        attempt.status === 'completed' || attempt.status === 'finished' || attempt.status === 'submitted'
      );
      
      console.log("Completed attempts:", completedAttempts.length);
      
      // For each attempt, get the student profile information
      const studentsWithPerformance = await Promise.all(
        completedAttempts.map(async (attempt) => {
          // Get student profile from studentprofile table (only students, not instructors)
          const { data: profileData, error: profileError } = await supabase
            .from("studentprofile")
            .select("first_name, last_name, email")
            .eq("id", attempt.user_id)
            .single();

          if (profileError) {
            console.warn("Student profile not found for user:", attempt.user_id);
            // Skip if not a student or profile not found
            return null;
          }

          // Get quiz responses for this attempt
          const { data: responsesData, error: responsesError } = await supabase
            .from("quiz_responses")
            .select(`
              answer,
              is_correct,
              points_earned,
              questions!quiz_responses_question_id_fkey (
                text,
                cognitive_level,
                points
              )
            `)
            .eq("attempt_id", attempt.id);

          if (responsesError) throw responsesError;

          // Calculate performance by cognitive domain
          const cognitiveDomains = {
            'LOTS': { correct: 0, total: 0, percentage: 0 },
            'HOTS': { correct: 0, total: 0, percentage: 0 }
          };

          // Map cognitive levels to domains
          const domainMapping = {
            'LOTS': ['Remembering', 'Understanding', 'Applying'],
            'HOTS': ['Analyzing', 'Evaluating', 'Creating']
          };

          // Process each response
          (responsesData || []).forEach(response => {
            const question = response.questions;
            if (!question) return;

            const cognitiveLevel = question.cognitive_level || 'LOTS';
            let domain = 'LOTS'; // default

            // Determine which domain this cognitive level belongs to
            Object.entries(domainMapping).forEach(([domainName, levels]) => {
              if (levels.includes(cognitiveLevel)) {
                domain = domainName;
              }
            });

            cognitiveDomains[domain].total += 1;
            if (response.is_correct) {
              cognitiveDomains[domain].correct += 1;
            }
          });

          // Calculate percentages
          Object.keys(cognitiveDomains).forEach(domain => {
            const { correct, total } = cognitiveDomains[domain];
            cognitiveDomains[domain].percentage = total > 0 ? (correct / total) * 100 : 0;
          });

          // Find strength and weakness
          const domains = Object.entries(cognitiveDomains);
          const strengthDomain = domains.reduce((max, curr) => 
            curr[1].percentage > max[1].percentage ? curr : max
          );
          const weaknessDomain = domains.reduce((min, curr) => 
            curr[1].percentage < min[1].percentage ? curr : min
          );

          const studentName = profileData 
            ? `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim() || 'Unknown Student'
            : 'Unknown Student';
          
          return {
            id: attempt.id,
            studentId: attempt.user_id,
            name: studentName,
            email: profileData?.email || 'N/A',
            score: attempt.score || 0,
            completedAt: attempt.completed_at,
            cognitiveDomains,
            strength: {
              domain: strengthDomain[0],
              percentage: strengthDomain[1].percentage
            },
            weakness: {
              domain: weaknessDomain[0],
              percentage: weaknessDomain[1].percentage
            }
          };
        })
      );

      // Filter out null results (instructors or users without student profiles)
      const validStudents = studentsWithPerformance.filter(student => student !== null);
      
      setStudentsData(validStudents);
    } catch (err) {
      setError(err.message || "Failed to load student performance data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getDomainColor = (domain) => {
    return domain === 'HOTS' 
      ? 'bg-purple-100 text-purple-800 border-purple-300'
      : 'bg-blue-100 text-blue-800 border-blue-300';
  };

  const getPerformanceColor = (percentage) => {
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const filteredStudents = studentsData.filter(student =>
    studentSearch === "" || 
    student.name.toLowerCase().includes(studentSearch.toLowerCase())
  );

  if (!sectionId || !quizId) {
    return (
      <div className="bg-gray-50 rounded-lg p-8 text-center">
        <p className="text-gray-600">Select a section and quiz to view student performance analysis</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Search */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Student Performance Analysis</h3>
          <p className="text-sm text-gray-600 mt-1">
            Cognitive domain strengths and weaknesses analysis
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-600">
            <span className="font-semibold">{filteredStudents.length}</span> students
          </div>
          <input
            type="text"
            placeholder="Search students..."
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold focus:ring-opacity-50"
          />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600">
          <p className="font-semibold">Error</p>
          <p>{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand-gold"></div>
            <p className="mt-4 text-brand-navy font-semibold">Loading student performance...</p>
          </div>
        </div>
      )}

      {/* Students Performance Cards */}
      {!loading && filteredStudents.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <p className="text-gray-600">
            {studentSearch ? "No students match your search" : "No students have attempted this quiz yet"}
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          {filteredStudents.map((student) => (
            <div key={student.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Student Header */}
              <div className="bg-gradient-to-r from-brand-navy to-brand-indigo p-6 text-white">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-xl font-bold">{student.name}</h4>
                    <p className="text-white/80 text-sm mt-1">{student.email}</p>
                    <div className="mt-3 flex items-center gap-4">
                      <div className="text-sm">
                        <span className="text-white/60">Quiz Score: </span>
                        <span className="font-semibold text-lg">{student.score.toFixed(1)}%</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-white/60">Completed: </span>
                        <span className="font-semibold">
                          {new Date(student.completedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cognitive Domain Performance */}
              <div className="p-6">
                <h5 className="text-lg font-semibold text-gray-800 mb-6">Cognitive Domain Performance</h5>
                
                {/* Domain Performance Bars */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                  {Object.entries(student.cognitiveDomains).map(([domain, data]) => (
                    <div key={domain} className="text-center">
                      <div className={`inline-flex items-center px-3 py-2 rounded-full text-sm font-semibold mb-2 ${getDomainColor(domain)}`}>
                        {domain}
                      </div>
                      <div className="text-2xl font-bold text-gray-800">
                        {data.percentage.toFixed(0)}%
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {data.correct}/{data.total} correct
                      </div>
                    </div>
                  ))}
                </div>

                {/* Strengths and Weaknesses */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Strength */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <h6 className="font-semibold text-green-800">Strength</h6>
                    </div>
                    <div className="space-y-2">
                      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${getDomainColor(student.strength.domain)}`}>
                        {student.strength.domain}
                      </div>
                      <div className="text-lg font-bold text-green-700">
                        {student.strength.percentage.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  {/* Weakness */}
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <h6 className="font-semibold text-red-800">Weakness</h6>
                    </div>
                    <div className="space-y-2">
                      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${getDomainColor(student.weakness.domain)}`}>
                        {student.weakness.domain}
                      </div>
                      <div className="text-lg font-bold text-red-700">
                        {student.weakness.percentage.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Performance Summary */}
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div>
                      <div className="text-xs text-gray-500">Remembering</div>
                      <div className={`text-sm font-semibold ${getPerformanceColor(student.cognitiveDomains.LOTS.percentage * 0.33)}`}>
                        {(student.cognitiveDomains.LOTS.percentage * 0.33).toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Understanding</div>
                      <div className={`text-sm font-semibold ${getPerformanceColor(student.cognitiveDomains.LOTS.percentage * 0.33)}`}>
                        {(student.cognitiveDomains.LOTS.percentage * 0.33).toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Applying</div>
                      <div className={`text-sm font-semibold ${getPerformanceColor(student.cognitiveDomains.LOTS.percentage * 0.34)}`}>
                        {(student.cognitiveDomains.LOTS.percentage * 0.34).toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Analyzing</div>
                      <div className={`text-sm font-semibold ${getPerformanceColor(student.cognitiveDomains.HOTS.percentage * 0.5)}`}>
                        {(student.cognitiveDomains.HOTS.percentage * 0.5).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
