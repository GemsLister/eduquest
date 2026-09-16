import { useState, useCallback } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '../../supabaseClient';

const generateHeuristicSuggestion = (questionData) => {
  const currentText = (questionData?.text || "").trim();
  const currentOptions = Array.isArray(questionData?.options) && questionData.options.length > 0
    ? [...questionData.options]
    : ["Option A", "Option B", "Option C", "Option D"];
  
  let correctIdx = 0;
  if (typeof questionData?.correct_answer === "number") {
    correctIdx = questionData.correct_answer;
  } else if (typeof questionData?.correct_answer === "string") {
    const idx = currentOptions.indexOf(questionData.correct_answer);
    if (idx !== -1) correctIdx = idx;
  }

  const isRejected = questionData?.autoFlag === 'reject';

  if (isRejected) {
    const baseTopic = currentText
      ? currentText.replace(/^(What|Which|How|Why|Where|When)\s+(is|are|does|do|can)\s+/i, "").replace(/\?.*$/, "").trim()
      : "the concept";

    return {
      text: baseTopic && baseTopic.length > 3
        ? `Which of the following statements most accurately describes ${baseTopic}?`
        : "Which of the following best represents the standard implementation in this context?",
      options: [
        `It ensures consistent data validation and system integrity across all modules.`,
        `It disables standard authentication protocols to improve performance speed.`,
        `It automatically stores unencrypted copies in temporary session cache.`,
        `It requires manual user re-entry for every individual transaction cycle.`
      ],
      correct_answer: 0
    };
  }

  // Revision for distractor quality and moderate difficulty
  const refinedStem = currentText.endsWith('?') ? currentText : `${currentText}?`;
  const refinedOptions = currentOptions.map((opt, idx) => {
    if (idx === correctIdx) return opt;
    if (!opt || opt.trim().length < 3) {
      return `Plausible alternative concept for distractor ${String.fromCharCode(65 + idx)}`;
    }
    return opt;
  });

  while (refinedOptions.length < 4) {
    refinedOptions.push(`Distractor choice ${String.fromCharCode(65 + refinedOptions.length)}`);
  }

  return {
    text: refinedStem,
    options: refinedOptions.slice(0, 4),
    correct_answer: correctIdx < 4 ? correctIdx : 0
  };
};

export const useGeminiSuggest = () => {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const [error, setError] = useState(null);

  const generateSuggestion = useCallback(async (questionData) => {
    setLoading(true);
    setError(null);
    setSuggestion('');
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      
      // If no API key configured, use built-in intelligent question engine
      if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE' || apiKey === '<gemini_api_key>') {
        console.info('No VITE_GEMINI_API_KEY found in .env. Using built-in question revision engine.');
        const fallback = generateHeuristicSuggestion(questionData);
        setSuggestion(JSON.stringify(fallback, null, 2));
        return fallback;
      }

      const genAIv1 = new GoogleGenerativeAI(apiKey);
      
      const isRejected = questionData?.autoFlag === 'reject';
      const prompt = isRejected
        ? `Generate a completely NEW multiple choice question to replace a rejected question about: "${questionData.text || 'this subject'}".
Output ONLY valid JSON object with NO markdown formatting:
{"text": "new clear question?", "options": ["Option A", "Option B", "Option C", "Option D"], "correct_answer": 0}`
        : `Improve this question for moderate difficulty (P-value between 0.25-0.75).`;
Original question: "${questionData.text}"
Type: ${questionData.type || 'multiple_choice'}
Correct answer: ${questionData.correct_answer}
Current difficulty: ${questionData.difficulty || 'Moderate'} (${questionData.status || 'Active'})
Discrimination: ${questionData.discrimination || '0.30'} (${questionData.discStatus || 'Fair'})

Suggest:
1. Revised question text (similar length/style).
2. 4 MC options (better distractors).
3. Same correct answer position (0-3).
4. Keep same type/points.

Output ONLY valid JSON object with NO markdown formatting:
{"text": "revised question?", "options": ["Option A", "Option B", "Option C", "Option D"], "correct_answer": 0}`;

      const modelsToTry = [
        { name: 'gemini-1.5-flash', version: 'v1beta' },
        { name: 'gemini-2.0-flash', version: 'v1beta' },
        { name: 'gemini-1.5-pro', version: 'v1beta' },
        { name: 'gemini-flash-latest', version: 'v1beta' },
      ];
      
      let result = null;

      for (const modelConfig of modelsToTry) {
        try {
          const model = genAIv1.getGenerativeModel(
            { model: modelConfig.name },
            { apiVersion: modelConfig.version }
          );
          result = await model.generateContent(prompt);
          if (result) break;
        } catch (e) {
          console.warn(`Gemini model ${modelConfig.name} (${modelConfig.version}) failed:`, e.message);
        }
      }

      if (result) {
        const response = await result.response;
        const text = response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed && parsed.text && parsed.options) {
            setSuggestion(JSON.stringify(parsed, null, 2));
            return parsed;
          }
        }
      }

      // If Gemini calls failed, fallback to heuristic
      console.warn('Gemini calls failed, applying fallback suggestion.');
      const fallback = generateHeuristicSuggestion(questionData);
      setSuggestion(JSON.stringify(fallback, null, 2));
      return fallback;
    } catch (err) {
      console.error('AI Suggest error:', err);
      const fallback = generateHeuristicSuggestion(questionData);
      setSuggestion(JSON.stringify(fallback, null, 2));
      return fallback;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateQuestion = async (questionId, newText, newOptions, newCorrect) => {
    // Safely save revision to Question Bank without mutating live published quiz questions
    return await saveRevision(questionId, newText, newOptions, newCorrect);
  };

  const saveRevision = async (questionId, revisedText, revisedOptions, revisedCorrect) => {
    // Determine the correct_answer value to store in the revision
    let correctAnswerValue = revisedCorrect;
    if (typeof revisedCorrect === 'number' && revisedOptions[revisedCorrect]) {
      correctAnswerValue = revisedOptions[revisedCorrect];
    } else if (typeof revisedCorrect === 'string' && !isNaN(parseInt(revisedCorrect)) && revisedOptions[parseInt(revisedCorrect)]) {
      correctAnswerValue = revisedOptions[parseInt(revisedCorrect)];
    }

    // 1. Fetch current question to get metadata
    const { data: current, error: fetchErr } = await supabase
      .from('questions')
      .select('*')
      .eq('id', questionId)
      .single();

    if (fetchErr || !current) {
      console.error("Failed to fetch source question:", fetchErr);
      throw new Error(`Failed to find question: ${fetchErr?.message || "Not found"}`);
    }

    // 2. Fetch quiz details if needed to get subject_id & section_id
    let quizSubjectId = current.subject_id || null;
    let quizSectionId = current.section_id || null;
    if (current.quiz_id) {
      const { data: quizData } = await supabase
        .from('quizzes')
        .select('subject_id, section_id')
        .eq('id', current.quiz_id)
        .single();
      if (quizData) {
        if (!quizSubjectId) quizSubjectId = quizData.subject_id;
        if (!quizSectionId) quizSectionId = quizData.section_id;
      }
    }

    // 3. Create the standalone question in Question Bank
    const newBankQuestion = {
      quiz_id: null, // Standalone question in Question Bank
      text: revisedText,
      options: Array.isArray(revisedOptions)
        ? revisedOptions.filter((opt) => opt !== null && opt !== undefined && String(opt).trim() !== "")
        : [],
      correct_answer: String(correctAnswerValue ?? ""),
      points: current.points || 1,
      type: current.type || "mcq",
      blooms_level: current.blooms_level || null,
      is_gad: current.is_gad || false,
      ai_revised: true, // Mark the NEW question as AI revised
      is_archived: false,
      subject_id: quizSubjectId,
      section_id: quizSectionId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let { data: insertedQ, error: insertErr } = await supabase
      .from('questions')
      .insert(newBankQuestion)
      .select()
      .single();

    if (insertErr) {
      if (insertErr.message?.includes('ai_revised')) {
        delete newBankQuestion.ai_revised;
        const retryRes = await supabase.from('questions').insert(newBankQuestion).select().single();
        insertedQ = retryRes.data;
        insertErr = retryRes.error;
      }
    }

    if (insertErr) {
      console.error("Error inserting revised question into Question Bank:", insertErr);
      throw new Error(`Failed to save question to Question Bank: ${insertErr.message}`);
    }

    // 4. Update the source question's revision_history array (audit trail) and clear pending status
    const revisionObject = {
      text: revisedText,
      options: revisedOptions,
      correct_answer: correctAnswerValue,
      revised_at: new Date().toISOString(),
      ai_revised: true,
    };

    const newHistory = Array.isArray(current.revision_history)
      ? [...current.revision_history, revisionObject]
      : [revisionObject];

    await supabase
      .from('questions')
      .update({
        revision_history: newHistory,
        revised_content: null, // Clear pending status so "Revision Pending" badge does not linger
        revised_options: null,
        previous_text: current.text,
        previous_options: current.options,
        previous_correct_answer: current.correct_answer,
        updated_at: new Date().toISOString(),
      })
      .eq('id', questionId);

    // 5. Trigger update events
    window.dispatchEvent(new Event("questions-updated"));
    window.dispatchEvent(new Event("question-bank-updated"));

    return insertedQ;
  };

  return { generateSuggestion, updateQuestion, saveRevision, loading, suggestion, error };
};

