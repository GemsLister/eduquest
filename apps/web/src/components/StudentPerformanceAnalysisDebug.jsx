import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient.js";
import { populateStudentBloomsPerformance } from "../utils/populateStudentBloomsPerformance.js";

export const StudentPerformanceAnalysisDebug = ({ 
  sectionId, 
  quizId, 
  instructorId 
}) => {
  const [studentsData, setStudentsData] = useState([]);
  const [allAttempts, setAllAttempts] = useState([]);
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
      // Get quiz attempts directly
      const { data: attemptsData, error: attemptsError } = await supabase
        .from('quiz_attempts')
        .select(`
          id,
          user_id,
          quiz_id,
          score,
          started_at,
          completed_at,
          status
        `)
        .eq('section_id', sectionId)
        .eq('quiz_id', quizId)
        .eq('status', 'completed');

      if (attemptsError) {
        console.error("Error fetching quiz attempts:", attemptsError);
        throw attemptsError;
      }

      console.log("Quiz attempts found:", attemptsData?.length || 0);
      console.log("Attempt user IDs:", attemptsData?.map(a => a.user_id));

      if (!attemptsData || attemptsData.length === 0) {
        setStudentsData([]);
        setAllAttempts([]);
        return;
      }

      // Get quiz responses with questions
      const { data: responsesData, error: responsesError } = await supabase
        .from('quiz_responses')
        .select(`
          attempt_id,
          answer,
          is_correct,
          points_earned,
          questions!quiz_responses_question_id_fkey (
            id,
            text,
            cognitive_level,
            points
          )
        `)
        .in('attempt_id', attemptsData.map(a => a.id));

      if (responsesError) {
        console.error("Error fetching quiz responses:", responsesError);
        throw responsesError;
      }

      console.log("Quiz responses found:", responsesData?.length || 0);

      // Get instructor's quiz analysis data (existing table)
      const { data: quizAnalysisData, error: analysisError } = await supabase
        .from('quiz_analysis')
        .select('*')
        .eq('quiz_id', quizId);

      if (analysisError) {
        console.log("Quiz analysis data not found, using question cognitive levels");
      } else {
        console.log("Quiz analysis data found:", quizAnalysisData?.length || 0);
        console.log("Quiz analysis sample data:", quizAnalysisData?.[0]);
        console.log("Quiz analysis columns:", quizAnalysisData?.[0] ? Object.keys(quizAnalysisData[0]) : 'No data');
      }

      // Get student profiles
      const userIds = [...new Set(attemptsData.map(a => a.user_id))];
      console.log("Looking for student profiles with user IDs:", userIds);
      
      // Since user_id column doesn't exist, we need to find the correct relationship
      // Let's try to match students by checking if they have any quiz attempts
      const { data: profiles, error: profilesError } = await supabase
        .from('student_profile')
        .select('id, student_name, student_email');

      console.log("Student profiles found:", profiles?.length || 0);
      console.log("Profile data:", profiles);

      if (profilesError) {
        console.error("Error fetching student profiles:", profilesError);
        throw profilesError;
      }

      // Create profile map using id as key for now
      const profileMap = {};
      profiles.forEach(profile => {
        profileMap[profile.id] = {
          first_name: profile.student_name?.split(' ')[0] || 'Unknown',
          last_name: profile.student_name?.split(' ')[1] || 'Student',
          email: profile.student_email || 'N/A'
        };
      });

      // For debugging, let's see if we can match by checking quiz attempts first
      console.log("Profile map created with keys:", Object.keys(profileMap));

      // Process each attempt
      const processedStudents = attemptsData.map(async (attempt, attemptIndex) => {
        console.log(`Processing attempt ${attemptIndex} for user_id: ${attempt.user_id}`);
        console.log('Available profiles:', profiles.map(p => ({ id: p.id, name: p.student_name })));
        
        // Use actual account name from the quiz attempt
        // Extract name from user_id or use a clean format
        const accountName = attempt.user_id ? 
          attempt.user_id.substring(0, 8) : // First 8 chars of UUID
          `Student ${attemptIndex + 1}`;
        
        // Create student profile using account name
        const studentProfile = {
          first_name: accountName,
          last_name: '',  // No last name needed for account display
          email: attempt.user_id ? `${attempt.user_id}@example.com` : 'N/A'
        };

        console.log(`Using account name: ${studentProfile.first_name} (from user_id: ${attempt.user_id})`);

        // Get responses for this attempt
        const attemptResponses = responsesData.filter(r => r.attempt_id === attempt.id);

        // Initialize cognitive domain counters
        const cognitiveDomains = {
          'Remembering': { correct: 0, total: 0, percentage: 0 },
          'Understanding': { correct: 0, total: 0, percentage: 0 },
          'Applying': { correct: 0, total: 0, percentage: 0 },
          'Analyzing': { correct: 0, total: 0, percentage: 0 },
          'Evaluating': { correct: 0, total: 0, percentage: 0 },
          'Creating': { correct: 0, total: 0, percentage: 0 }
        };

        // Process responses using existing quiz analysis or question cognitive levels
        let totalQuestionsProcessed = 0;
        
        // Create a map of question_id to bloom_level
        const bloomsMap = {};
        const questionDistribution = {
          'Remembering': { total: 0, correct: 0 },
          'Understanding': { total: 0, correct: 0 },
          'Applying': { total: 0, correct: 0 },
          'Analyzing': { total: 0, correct: 0 },
          'Evaluating': { total: 0, correct: 0 },
          'Creating': { total: 0, correct: 0 }
        };
        
        // Try to use quiz analysis data first, then fall back to question cognitive levels
        if (quizAnalysisData && quizAnalysisData.length > 0) {
          console.log('Using quiz analysis data');
          quizAnalysisData.forEach(analysis => {
            // Parse the analysis_data JSON to get Bloom's Taxonomy information
            console.log('Raw analysis_data type:', typeof analysis.analysis_data);
            console.log('Raw analysis_data value:', analysis.analysis_data);
            
            if (analysis.analysis_data) {
              try {
                const analysisJson = typeof analysis.analysis_data === 'string' 
                  ? JSON.parse(analysis.analysis_data) 
                  : analysis.analysis_data;
                
                console.log('Successfully parsed JSON');
                console.log('Full analysis JSON structure:', JSON.stringify(analysisJson, null, 2));
                console.log('Available keys in analysis JSON:', Object.keys(analysisJson));
                
                // Check if the JSON itself contains the bloom data directly
                const possibleKeys = ['blooms_taxonomy', 'bloomsData', 'cognitive_levels', 'distribution', 'bloom_levels', 'levels', 'taxonomy'];
                let foundData = null;
                let foundKey = null;
                
                possibleKeys.forEach(key => {
                  if (analysisJson[key]) {
                    foundData = analysisJson[key];
                    foundKey = key;
                    console.log(`Found bloom data in key: ${key}`, foundData);
                  }
                });
                
                // If no specific key found, check if the main object contains bloom levels directly
                if (!foundData) {
                  console.log('Checking if main object contains bloom levels...');
                  const bloomLevels = ['Remembering', 'Understanding', 'Applying', 'Analyzing', 'Evaluating', 'Creating'];
                  const hasBloomLevels = bloomLevels.some(level => level in analysisJson);
                  
                  if (hasBloomLevels) {
                    foundData = analysisJson;
                    foundKey = 'main_object';
                    console.log('Found bloom levels in main object');
                  }
                }
                
                if (foundData) {
                  console.log(`Processing bloom data from ${foundKey}:`, foundData);
                  console.log('Type of bloomsData:', typeof foundData);
                  console.log('Is array:', Array.isArray(foundData));
                  
                  // Handle different formats of blooms data
                  if (Array.isArray(foundData)) {
                    console.log('Processing as array format');
                    foundData.forEach((item, index) => {
                      console.log(`Array item ${index}:`, item);
                      const questionId = item.question_id || item.questionId || item.id;
                      const bloomLevel = item.bloom_level || item.level || item.cognitive_level || item.domain;
                      
                      if (questionId && bloomLevel && questionDistribution[bloomLevel]) {
                        bloomsMap[questionId] = bloomLevel;
                        questionDistribution[bloomLevel].total++;
                        console.log(`Mapped question ${questionId} to ${bloomLevel}`);
                      }
                    });
                  } else if (typeof foundData === 'object') {
                    console.log('Processing as object format');
                    Object.entries(foundData).forEach(([level, data]) => {
                      console.log(`Object entry: ${level} =`, data);
                      if (questionDistribution[level]) {
                        if (typeof data === 'number') {
                          // Simple count: { "Remembering": 2, "Evaluating": 6 }
                          console.log(`Setting ${level} total to ${data}`);
                          questionDistribution[level].total = data;
                        } else if (data && typeof data === 'object') {
                          // Detailed object: { "Remembering": { count: 2, questions: [...] } }
                          const count = data.count || data.total || data.questions?.length || 0;
                          console.log(`Setting ${level} total to ${count} from object`);
                          questionDistribution[level].total = count;
                          
                          // Map questions if available
                          if (data.questions) {
                            data.questions.forEach(questionId => {
                              if (questionId) {
                                bloomsMap[questionId] = level;
                              }
                            });
                          }
                        }
                      }
                    });
                  }
                } else {
                  console.log('No bloom data found anywhere in the analysis JSON');
                  console.log('Full JSON content for manual inspection:', JSON.stringify(analysisJson, null, 2));
                }
              } catch (parseError) {
                console.error('Error parsing analysis_data JSON:', parseError);
                console.error('Raw analysis_data:', analysis.analysis_data);
              }
            } else {
              console.log('No analysis_data found in this record');
            }
          });
        } else {
          console.log('Using question cognitive levels from responses (analysis_data was null)');
          // Count questions by cognitive level from the responses
          attemptResponses.forEach(response => {
            const question = response.questions;
            if (question) {
              const cognitiveLevel = question.cognitive_level || 'Remembering';
              bloomsMap[question.id] = cognitiveLevel;
              if (questionDistribution[cognitiveLevel]) {
                questionDistribution[cognitiveLevel].total++;
                console.log(`Question ${question.id} assigned to ${cognitiveLevel} (from question.cognitive_level)`);
              }
            }
          });
        }
        
        console.log('Bloom\'s Taxonomy mapping:', bloomsMap);
        console.log('Question distribution by domain:', questionDistribution);
        
        // Process each response and count correct answers
        attemptResponses.forEach((response, index) => {
          const question = response.questions;
          if (!question) return;
          
          // Get the bloom level from our mapping
          const bloomLevel = bloomsMap[question.id] || question.cognitive_level || 'Remembering';
          
          console.log(`Response ${index}: question_id = ${question.id}, bloom_level = ${bloomLevel}, is_correct = ${response.is_correct}`);
          
          if (questionDistribution[bloomLevel]) {
            totalQuestionsProcessed++;
            if (response.is_correct) {
              questionDistribution[bloomLevel].correct++;
            }
          }
        });

        console.log(`Processed ${totalQuestionsProcessed} questions`);
        console.log('Final question distribution:', questionDistribution);

        // Calculate overall score
        const totalQuestions = attemptResponses.length;
        const totalCorrect = attemptResponses.filter(r => r.is_correct).length;
        const overallPercentage = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;

        // Calculate percentages based on actual question distribution
        Object.keys(questionDistribution).forEach(domain => {
          const { correct, total } = questionDistribution[domain];
          cognitiveDomains[domain].correct = correct;
          cognitiveDomains[domain].total = total;
          cognitiveDomains[domain].percentage = total > 0 ? (correct / total) * 100 : 0;
        });

        console.log('Final cognitive domains before save:', cognitiveDomains);

        // Create a copy to ensure proper assignment
        const finalCognitiveDomains = JSON.parse(JSON.stringify(cognitiveDomains));
        console.log('Final cognitive domains copy:', finalCognitiveDomains);

        // Save performance results to database
        await saveStudentPerformanceToDatabase(attempt.user_id, attempt.quiz_id, finalCognitiveDomains, studentProfile);

        // Find strength and weakness
        const domains = Object.entries(finalCognitiveDomains);
        const strengthDomain = domains.length > 0 
          ? domains.reduce((max, curr) => 
              (curr[1].total > 0 && curr[1].percentage > max[1].percentage) ? curr : max
            )
          : ['Remembering', { correct: 0, total: 0, percentage: 0 }];
        
        const weaknessDomain = domains.length > 0
          ? domains.reduce((min, curr) => 
              (curr[1].total > 0 && curr[1].percentage < min[1].percentage) ? curr : min
            )
          : ['Remembering', { correct: 0, total: 0, percentage: 0 }];

        return {
          id: attempt.id,
          name: studentProfile.first_name + ' ' + studentProfile.last_name,
          email: studentProfile.email,
          score: overallPercentage,
          status: attempt.status || 'completed',
          hasProfile: !!studentProfile, // Use studentProfile instead of profile
          cognitiveDomains: finalCognitiveDomains, // Use the copy with calculated percentages
          strength: {
            domain: strengthDomain[0],
            percentage: strengthDomain[1].percentage
          },
          weakness: {
            domain: weaknessDomain[0],
            percentage: weaknessDomain[1].percentage
          }
        };
      });

      // Wait for all processing to complete
      const resolvedStudents = await Promise.all(processedStudents);
      const validStudents = resolvedStudents.filter(student => student !== null);
      
      console.log("Processed Students:", validStudents);
      console.log("Sample student cognitive domains:", validStudents[0]?.cognitiveDomains);
      
      // Force multiple state updates to ensure React recognizes changes
      setStudentsData([]);
      setAllAttempts([]);
      
      setTimeout(() => {
        console.log("Setting students data after clear:", validStudents);
        setStudentsData(validStudents);
        setAllAttempts(validStudents);
      }, 50);

    } catch (err) {
      console.error("Error in loadStudentPerformance:", err);
      setError(err.message || "Failed to load student performance");
    } finally {
      setLoading(false);
    }
  };

  const saveStudentPerformanceToDatabase = async (studentId, quizId, cognitiveDomains, profile) => {
    try {
      // Calculate totals
      const totalQuestions = Object.values(cognitiveDomains).reduce((sum, data) => sum + data.total, 0);
      const totalCorrect = Object.values(cognitiveDomains).reduce((sum, data) => sum + data.correct, 0);
      const overallPercentage = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;

      // Create performance record for the new student_blooms_performance table
      const performanceRecord = {
        student_id: studentId,
        quiz_id: quizId,
        section_id: sectionId,
        student_name: `${profile.first_name} ${profile.last_name}`,
        student_email: profile.email,
        
        // Bloom's Taxonomy Performance Data
        remembering_correct: cognitiveDomains['Remembering'].correct,
        remembering_total: cognitiveDomains['Remembering'].total,
        remembering_percentage: cognitiveDomains['Remembering'].percentage,
        
        understanding_correct: cognitiveDomains['Understanding'].correct,
        understanding_total: cognitiveDomains['Understanding'].total,
        understanding_percentage: cognitiveDomains['Understanding'].percentage,
        
        applying_correct: cognitiveDomains['Applying'].correct,
        applying_total: cognitiveDomains['Applying'].total,
        applying_percentage: cognitiveDomains['Applying'].percentage,
        
        analyzing_correct: cognitiveDomains['Analyzing'].correct,
        analyzing_total: cognitiveDomains['Analyzing'].total,
        analyzing_percentage: cognitiveDomains['Analyzing'].percentage,
        
        evaluating_correct: cognitiveDomains['Evaluating'].correct,
        evaluating_total: cognitiveDomains['Evaluating'].total,
        evaluating_percentage: cognitiveDomains['Evaluating'].percentage,
        
        creating_correct: cognitiveDomains['Creating'].correct,
        creating_total: cognitiveDomains['Creating'].total,
        creating_percentage: cognitiveDomains['Creating'].percentage,
        
        // Metadata
        total_questions: totalQuestions,
        total_correct: totalCorrect,
        overall_percentage: overallPercentage,
        attempt_date: new Date().toISOString()
      };

      console.log('Attempting to save performance record:', performanceRecord);

      // First check if table exists
      const { data: tableCheck, error: tableError } = await supabase
        .from('student_blooms_performance')
        .select('id')
        .limit(1);

      if (tableError) {
        console.error('Table does not exist or access error:', tableError);
        console.log('Table creation may have failed. Please check the migration.');
        return;
      }

      // Insert into student_blooms_performance table
      console.log('Attempting to save to student_blooms_performance table...');
      console.log('Performance record to save:', JSON.stringify(performanceRecord, null, 2));
      
      const { data: insertData, error: insertError } = await supabase
        .from('student_blooms_performance')
        .insert(performanceRecord)
        .select();

      if (insertError) {
        console.error('❌ Error saving student performance to student_blooms_performance:', insertError);
        console.error('❌ Error details:', insertError.details);
        console.error('❌ Error hint:', insertError.hint);
        console.error('❌ Error code:', insertError.code);
        console.error('❌ Full error object:', JSON.stringify(insertError, null, 2));
        
        // Check if table exists by trying to query it
        console.log('🔍 Checking if student_blooms_performance table exists...');
        const { data: checkData, error: checkError } = await supabase
          .from('student_blooms_performance')
          .select('id')
          .limit(1);
          
        if (checkError) {
          console.error('❌ Table does not exist or access error:', checkError);
          console.log('📋 You may need to run the migration: 20260329_create_student_blooms_performance.sql');
        } else {
          console.log('✅ Table exists but insert failed');
        }
      } else {
        console.log('🎉 SUCCESS! Saved performance record to database!');
        console.log('🎉 Saved data:', insertData);
        console.log('🎉 Record ID:', insertData?.[0]?.id);
        console.log(`📊 Overall: ${overallPercentage.toFixed(1)}% (${totalCorrect}/${totalQuestions})`);
        console.log(`🌱 Remembering: ${cognitiveDomains['Remembering'].percentage.toFixed(1)}% (${cognitiveDomains['Remembering'].correct}/${cognitiveDomains['Remembering'].total})`);
        console.log(`💡 Understanding: ${cognitiveDomains['Understanding'].percentage.toFixed(1)}% (${cognitiveDomains['Understanding'].correct}/${cognitiveDomains['Understanding'].total})`);
        console.log(`⚙️ Applying: ${cognitiveDomains['Applying'].percentage.toFixed(1)}% (${cognitiveDomains['Applying'].correct}/${cognitiveDomains['Applying'].total})`);
        console.log(`🔍 Analyzing: ${cognitiveDomains['Analyzing'].percentage.toFixed(1)}% (${cognitiveDomains['Analyzing'].correct}/${cognitiveDomains['Analyzing'].total})`);
        console.log(`⚖️ Evaluating: ${cognitiveDomains['Evaluating'].percentage.toFixed(1)}% (${cognitiveDomains['Evaluating'].correct}/${cognitiveDomains['Evaluating'].total})`);
        console.log(`🎨 Creating: ${cognitiveDomains['Creating'].percentage.toFixed(1)}% (${cognitiveDomains['Creating'].correct}/${cognitiveDomains['Creating'].total})`);
      }
    } catch (error) {
      console.error('Error in saveStudentPerformanceToDatabase:', error);
    }
  };

  const getDomainColor = (domain) => {
    const colors = {
      'Remembering': 'bg-blue-100 text-blue-800 border-blue-300',
      'Understanding': 'bg-green-100 text-green-800 border-green-300',
      'Applying': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'Analyzing': 'bg-purple-100 text-purple-800 border-purple-300',
      'Evaluating': 'bg-red-100 text-red-800 border-red-300',
      'Creating': 'bg-indigo-100 text-indigo-800 border-indigo-300',
      'LOTS': 'bg-blue-100 text-blue-800 border-blue-300',
      'HOTS': 'bg-purple-100 text-purple-800 border-purple-300'
    };
    return colors[domain] || 'bg-gray-100 text-gray-800 border-gray-300';
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Debug Info - Top Left */}
        <div className="lg:col-span-1">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-800 mb-2">Debug Information</h3>
            <div className="text-sm text-blue-700 space-y-1">
              <p><strong>Total Attempts:</strong> {allAttempts.length}</p>
              <p><strong>Valid Students:</strong> {studentsData.length}</p>
              <p><strong>Quiz ID:</strong> {quizId}</p>
              <p><strong>Section ID:</strong> {sectionId}</p>
            </div>
            
            {/* Show all attempts for debugging */}
            {allAttempts.length > 0 && (
              <div className="mt-3">
                <p className="font-semibold text-blue-800 mb-2">All Attempts:</p>
                <div className="text-xs text-blue-700 space-y-1 max-h-32 overflow-y-auto">
                  {allAttempts.map((attempt, index) => (
                    <div key={attempt.id}>
                      {index + 1}. User: {attempt.user_id?.substring(0, 8)}... | 
                      Status: {attempt.status || 'NULL'} | 
                      Score: {attempt.score || 0}%
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Header with Search - Top Right */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Student Performance Analysis (Debug Mode)</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Cognitive domain strengths and weaknesses analysis
                </p>
                <div className="mt-2 text-sm text-gray-600">
                  <span className="font-semibold">{filteredStudents.length}</span> students
                </div>
              </div>
              <input
                type="text"
                placeholder="Search students..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="w-full sm:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold focus:ring-opacity-50"
              />
            </div>
          </div>
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
          {filteredStudents.map((student, index) => {
            console.log(`Rendering student ${index}:`, student.name, 'cognitiveDomains:', student.cognitiveDomains);
            return (
              <div key={student.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Student Header - Dark Blue Compact */}
              <div className="bg-blue-900 p-4 text-white">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-lg font-bold">Name: {student.name}</h4>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                      <div>
                        <span className="text-white/70">Quiz Score: </span>
                        <span className="font-semibold">{student.score.toFixed(1)}%</span>
                      </div>
                      <div>
                        <span className="text-white/70">Status: </span>
                        <span className="font-semibold">{student.status || 'completed'}</span>
                      </div>
                      <div>
                        <span className="text-white/70">Profile: </span>
                        <span className={`font-semibold ${student.hasProfile ? 'text-green-300' : 'text-yellow-300'}`}>
                          {student.hasProfile ? 'Found' : 'Missing'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cognitive Domain Performance */}
              <div className="p-6">
                <h5 className="text-lg font-semibold text-gray-800 mb-4">Cognitive Domain Performance</h5>
                
                {/* New Table - Direct Display */}
                <div className="overflow-x-auto mb-6">
                  <table key={`performance-${student.id}`} className="min-w-full bg-white border border-gray-200 rounded-lg">
                    <thead>
                      <tr className="bg-gray-100 border-b">
                        {Object.keys(student.cognitiveDomains).map((domain) => (
                          <th key={domain} className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                            {domain}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {Object.entries(student.cognitiveDomains).map(([domain, data]) => {
                          const percentage = parseFloat(data.percentage) || 0;
                          const correct = parseInt(data.correct) || 0;
                          const total = parseInt(data.total) || 0;
                          
                          console.log(`Direct display - ${domain}:`, { percentage, correct, total });
                          
                          return (
                          <td key={`${domain}-${percentage}-${correct}-${total}`} className="text-left py-3 px-4 text-sm text-gray-800">
                            <div>
                              <div className="font-semibold text-blue-600">
                                {percentage.toFixed(1)}%
                              </div>
                              <div className="text-xs text-gray-500">
                                {correct}/{total}
                              </div>
                            </div>
                          </td>
                        );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Debug Display - Show calculated values directly */}
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
                  <h6 className="font-semibold text-yellow-800 mb-2">Debug: Calculated Values</h6>
                  <div className="text-sm text-yellow-700">
                    {Object.entries(student.cognitiveDomains).map(([domain, data]) => (
                      <div key={domain} className="mb-1">
                        <strong>{domain}:</strong> {data.percentage?.toFixed(1) || '0.0'}% ({data.correct}/{data.total})
                      </div>
                    ))}
                  </div>
                </div>

                {/* Strengths and Weaknesses */}
                <div className="flex flex-wrap gap-4">
                  {/* Strength */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2 mb-3">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <h6 className="font-semibold text-green-800">Strength</h6>
                    </div>
                    <div className="space-y-2">
                      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${getDomainColor(student.strength.domain)}`}>
                        {student.strength.domain}
                      </div>
                      <div className="text-xl font-bold text-green-700">
                        {student.strength.percentage.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  {/* Weakness */}
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2 mb-3">
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <h6 className="font-semibold text-red-800">Weakness</h6>
                    </div>
                    <div className="space-y-2">
                      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${getDomainColor(student.weakness.domain)}`}>
                        {student.weakness.domain}
                      </div>
                      <div className="text-xl font-bold text-red-700">
                        {student.weakness.percentage.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        </div>
      )}
    </div>
  );
};
