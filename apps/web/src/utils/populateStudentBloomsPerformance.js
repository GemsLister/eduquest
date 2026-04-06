import { supabase } from '../supabaseClient.js';

/**
 * Populates the student_blooms_performance table with data from quiz attempts
 * This should be run to generate the Bloom's Taxonomy performance data
 */
export const populateStudentBloomsPerformance = async (sectionId = null, quizId = null) => {
  try {
    console.log('Starting to populate student_blooms_performance table...');
    
    // Get quiz attempts
    let attemptsQuery = supabase
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
      .eq('status', 'completed');
    
    if (sectionId) {
      attemptsQuery = attemptsQuery.eq('section_id', sectionId);
    }
    
    if (quizId) {
      attemptsQuery = attemptsQuery.eq('quiz_id', quizId);
    }
    
    const { data: attempts, error: attemptsError } = await attemptsQuery;
    
    if (attemptsError) {
      console.error('Error fetching quiz attempts:', attemptsError);
      throw attemptsError;
    }
    
    console.log(`Found ${attempts?.length || 0} quiz attempts`);
    
    if (!attempts || attempts.length === 0) {
      console.log('No quiz attempts found');
      return { success: false, message: 'No quiz attempts found' };
    }
    
    // Get quiz responses with questions
    const { data: responses, error: responsesError } = await supabase
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
      .in('attempt_id', attempts.map(a => a.id));
    
    if (responsesError) {
      console.error('Error fetching quiz responses:', responsesError);
      throw responsesError;
    }
    
    console.log(`Found ${responses?.length || 0} quiz responses`);
    
    // Get student profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('student_profile')
      .select('id, student_name, student_email')
      .in('id', [...new Set(attempts.map(a => a.user_id))]);
    
    if (profilesError) {
      console.error('Error fetching student profiles:', profilesError);
      throw profilesError;
    }
    
    // Create profile map
    const profileMap = {};
    profiles.forEach(profile => {
      profileMap[profile.id] = {
        first_name: profile.student_name?.split(' ')[0] || 'Unknown',
        last_name: profile.student_name?.split(' ')[1] || 'Student',
        email: profile.student_email || 'N/A'
      };
    });
    
    // Process each attempt and generate blooms performance data
    const performanceData = [];
    
    for (const attempt of attempts) {
      const profile = profileMap[attempt.user_id];
      if (!profile) continue;
      
      // Get responses for this attempt
      const attemptResponses = responses.filter(r => r.attempt_id === attempt.id);
      
      // Initialize cognitive domain counters
      const cognitiveDomains = {
        'Remembering': { correct: 0, total: 0, percentage: 0 },
        'Understanding': { correct: 0, total: 0, percentage: 0 },
        'Applying': { correct: 0, total: 0, percentage: 0 },
        'Analyzing': { correct: 0, total: 0, percentage: 0 },
        'Evaluating': { correct: 0, total: 0, percentage: 0 },
        'Creating': { correct: 0, total: 0, percentage: 0 }
      };
      
      // Process responses
      attemptResponses.forEach(response => {
        const question = response.questions;
        if (!question) return;
        
        const cognitiveLevel = question.cognitive_level || 'Remembering';
        if (cognitiveDomains[cognitiveLevel]) {
          cognitiveDomains[cognitiveLevel].total++;
          if (response.is_correct) {
            cognitiveDomains[cognitiveLevel].correct++;
          }
        }
      });
      
      // Calculate percentages
      Object.keys(cognitiveDomains).forEach(domain => {
        const { correct, total } = cognitiveDomains[domain];
        cognitiveDomains[domain].percentage = total > 0 ? (correct / total) * 100 : 0;
      });
      
      // Create performance records for each cognitive domain
      Object.entries(cognitiveDomains).forEach(([domain, data]) => {
        if (data.total > 0) { // Only include domains that have questions
          performanceData.push({
            student_id: attempt.user_id,
            student_name: `${profile.first_name} ${profile.last_name}`,
            student_email: profile.email,
            section_id: sectionId,
            quiz_id: attempt.quiz_id,
            blooms_level: domain,
            correct_answers: data.correct,
            total_questions: data.total,
            percentage: data.percentage,
            attempt_id: attempt.id,
            created_at: new Date().toISOString()
          });
        }
      });
    }
    
    console.log(`Generated ${performanceData.length} performance records`);
    
    // Clear existing data for this section/quiz
    if (sectionId || quizId) {
      const deleteQuery = supabase.from('student_blooms_performance').delete();
      
      if (sectionId) {
        deleteQuery.eq('section_id', sectionId);
      }
      
      if (quizId) {
        deleteQuery.eq('quiz_id', quizId);
      }
      
      const { error: deleteError } = await deleteQuery;
      
      if (deleteError) {
        console.error('Error clearing existing data:', deleteError);
        throw deleteError;
      }
    }
    
    // Insert new performance data
    if (performanceData.length > 0) {
      const { error: insertError } = await supabase
        .from('student_blooms_performance')
        .insert(performanceData);
      
      if (insertError) {
        console.error('Error inserting performance data:', insertError);
        throw insertError;
      }
    }
    
    console.log('Successfully populated student_blooms_performance table');
    
    return { 
      success: true, 
      message: `Successfully processed ${attempts.length} attempts and generated ${performanceData.length} performance records`,
      attemptsProcessed: attempts.length,
      recordsGenerated: performanceData.length
    };
    
  } catch (error) {
    console.error('Error populating student_blooms_performance:', error);
    return { 
      success: false, 
      message: error.message,
      error: error
    };
  }
};
