import { supabase } from '../../supabaseClient';

export const duplicateQuizWithRevisions = async (originalQuizId, analysis) => {
  try {
    // 1. Get original quiz details
    const { data: originalQuiz, error: quizError } = await supabase
      .from('quizzes')
      .select('id, title, section_id, is_open, instructor_id, points')
      .eq('id', originalQuizId)
      .single();
    
    if (quizError || !originalQuiz) {
      throw new Error('Original quiz not found');
    }

    // 2. Create new "v2" quiz
    const newTitle = `${originalQuiz.title} v2 (Revised)`;
    const { data: newQuiz, error: newQuizError } = await supabase
      .from('quizzes')
      .insert({
        title: newTitle,
        section_id: originalQuiz.section_id,
        instructor_id: originalQuiz.instructor_id,
        points: originalQuiz.points,
        is_open: false  // Start closed
      })
      .select()
      .single();

    if (newQuizError) throw newQuizError;

    // 3. Create revised questions
    const revisedQuestions = analysis.map(item => {
      // Smart logic: use revised if flagged, original if approved
      const useRevised = item.autoFlag === 'revise' && item.revised_content;
      
      return {
        quiz_id: newQuiz.id,
        text: useRevised ? item.revised_content.text || item.text : item.text,
        type: item.type || 'mcq',
        options: useRevised ? item.revised_options || item.options : item.options,
        correct_answer: useRevised ? item.revised_content.correct_answer || item.correct_answer : item.correct_answer,
        points: item.points || 1
      };
    });

    const { error: questionsError } = await supabase
      .from('questions')
      .insert(revisedQuestions);

    if (questionsError) throw questionsError;

    // 4. Copy item analysis (optional - for v2 tracking)
    const analysisRecords = analysis.map(item => ({
      quiz_id: newQuiz.id,
      question_id: null,  // Will need mapping if copying responses
      ...item  // Preserve metrics
    }));

    await supabase.from('item_analysis').insert(analysisRecords);

    return {
      success: true,
      newQuizId: newQuiz.id,
      newQuizTitle: newTitle,
      revisedQuestionsCount: revisedQuestions.length
    };
  } catch (error) {
    console.error('Error duplicating revised quiz:', error);
    return { success: false, error: error.message };
  }
};

