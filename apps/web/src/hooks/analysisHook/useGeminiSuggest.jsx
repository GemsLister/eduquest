import { useState, useCallback } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '../../supabaseClient';

const generateHeuristicSuggestion = (questionData, subjectName = '') => {
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
  const isNew = questionData?.isNew || !currentText;

  if (isRejected || isNew) {
    const topicLabel = subjectName || (currentText
      ? currentText.replace(/^(What|Which|How|Why|Where|When)\s+(is|are|does|do|can)\s+/i, "").replace(/\?.*$/, "").trim()
      : "the subject");

    return {
      text: `Which of the following statements best illustrates a fundamental concept in ${topicLabel}?`,
      options: [
        `It establishes core principles and structured execution within ${topicLabel}.`,
        `It bypasses standard verification rules to maximize speed.`,
        `It relies solely on unstructured temporary cache without schema integrity.`,
        `It requires repetitive manual reconciliation for each individual cycle.`
      ],
      correct_answer: 0
    };
  }

  // Revision for distractor quality and moderate difficulty
  const refinedStem = currentText.endsWith('?') ? currentText : `${currentText}?`;
  const refinedOptions = currentOptions.map((opt, idx) => {
    if (idx === correctIdx) return opt;
    if (!opt || opt.trim().length < 3) {
      return `Plausible alternative distractor ${String.fromCharCode(65 + idx)} ${subjectName ? `in ${subjectName}` : ''}`.trim();
    }
    return opt;
  });

  while (refinedOptions.length < 4) {
    refinedOptions.push(`Alternative distractor ${String.fromCharCode(65 + refinedOptions.length)}`);
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
      
      // Resolve subject information for context-aware generation
      let subjectName = questionData?.subject_name 
        || (typeof questionData?.subject === 'string' ? questionData?.subject : questionData?.subject?.name)
        || questionData?.subject_code
        || questionData?.quiz_title
        || '';

      if (!subjectName && questionData?.subject_id) {
        try {
          const { data: sData } = await supabase
            .from('subjects')
            .select('name, code')
            .eq('id', questionData.subject_id)
            .maybeSingle();
          if (sData) {
            subjectName = sData.name + (sData.code ? ` (${sData.code})` : '');
          }
        } catch (err) {
          console.warn('Could not fetch subject name:', err);
        }
      }

      if (!subjectName && questionData?.quiz_id) {
        try {
          const { data: qData } = await supabase
            .from('quizzes')
            .select('title, subject_id, subjects(name, code)')
            .eq('id', questionData.quiz_id)
            .maybeSingle();
          if (qData) {
            if (qData.subjects?.name) {
              subjectName = qData.subjects.name + (qData.subjects.code ? ` (${qData.subjects.code})` : '');
            } else if (qData.title) {
              subjectName = qData.title;
            }
          }
        } catch (err) {
          console.warn('Could not fetch quiz subject:', err);
        }
      }

      // If no API key configured, use built-in question engine
      if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE' || apiKey === '<gemini_api_key>') {
        console.info('No VITE_GEMINI_API_KEY found in .env. Using built-in question revision engine.');
        const fallback = generateHeuristicSuggestion(questionData, subjectName);
        setSuggestion(JSON.stringify(fallback, null, 2));
        return fallback;
      }

      const genAIv1 = new GoogleGenerativeAI(apiKey);
      
      const isRejected = questionData?.autoFlag === 'reject';
      const isNew = questionData?.isNew || !questionData?.text || isRejected;
      const originalStem = questionData?.originalText || questionData?.original_text || questionData?.text || '';
      const currentStem = questionData?.currentText || questionData?.text || '';

      let prompt = '';
      if (isNew) {
        prompt = `You are an expert academic assessment specialist.
Generate ONE high-quality multiple choice question (MCQ) strictly related to the subject below.

${subjectName ? `Target Subject / Course: "${subjectName}"` : 'Target Subject: Academic Core'}
${questionData?.topic || questionData?.text ? `Specific Topic / Concept to focus on: "${questionData.topic || questionData.text}"` : ''}
${currentStem ? `Do NOT repeat this previous question: "${currentStem}". Provide a fresh, distinct question from a different angle.` : ''}

Strict Requirements:
1. The question stem MUST test knowledge or problem-solving directly within "${subjectName || 'the specified subject'}".
2. Must be a fresh, distinct question (not a re-hash of the previous question).
3. Provide exactly 4 realistic multiple choice options: 1 correct answer and 3 plausible, high-quality distractors.
4. Choose a natural position for the correct answer, and set "correct_answer" to its 0-based index (0, 1, 2, or 3).
5. Difficulty should be Moderate (suitable for an academic exam/quiz).
6. Output ONLY valid JSON in the exact format shown below, with NO markdown formatting, NO backticks, NO explanations:

{"text": "Fresh question text?", "options": ["Option A", "Option B", "Option C", "Option D"], "correct_answer": 0}`;
      } else {
        prompt = `You are an expert psychometrician and academic exam author.
The instructor wants to REVISE and IMPROVE this question with a NEW, FRESH, and DISTINCT variation for moderate difficulty (p-value 0.30 - 0.70) and strong discrimination.

${subjectName ? `Subject / Course Context: "${subjectName}"` : ''}
Original Question to Improve: "${originalStem}"
${currentStem && currentStem !== originalStem ? `Current Version to Vary / Replace: "${currentStem}"` : ''}
Original Options: ${JSON.stringify(questionData.options || [])}
Original Correct Answer: ${questionData.correct_answer}
${questionData.difficulty ? `Current Difficulty: ${questionData.difficulty} (${questionData.status || ''})` : ''}
${questionData.discrimination ? `Current Discrimination: ${questionData.discrimination} (${questionData.discStatus || ''})` : ''}

CRITICAL REVISION REQUIREMENTS:
1. You MUST generate a noticeably DIFFERENT and REPHRASED question stem testing this concept. Do NOT simply output the same question verbatim.
2. Frame the question from an engaging practical scenario, conceptual relationship, or analytical problem directly within ${subjectName ? `"${subjectName}"` : 'the subject'}.
3. Create 4 completely polished options: 1 definitively correct answer and 3 realistic distractors (addressing common student misconceptions).
4. Make sure both the stem and distractors are noticeably distinct from the original text.
5. Set "correct_answer" to the 0-based index (0, 1, 2, or 3) of the correct option.
6. Output ONLY valid JSON in the exact format shown below, with NO markdown formatting, NO backticks, NO explanations:

{"text": "Newly revised question stem?", "options": ["Option A", "Option B", "Option C", "Option D"], "correct_answer": 0}`;
      }

      const modelsToTry = [
        'gemini-flash-lite-latest',
        'gemini-3.1-flash-lite',
        'gemini-3.5-flash-lite',
        'gemini-flash-latest',
        'gemini-3.5-flash',
        'gemini-3.8-flash'
      ];
      
      let result = null;
      let lastError = null;

      for (const modelName of modelsToTry) {
        try {
          const model = genAIv1.getGenerativeModel({
            model: modelName,
            generationConfig: {
              temperature: 0.9,
              topP: 0.95,
            }
          });
          result = await model.generateContent(prompt);
          if (result) break;
        } catch (e) {
          lastError = e;
          console.warn(`Gemini model ${modelName} encountered an issue (${e.message}), failing over to next model...`);
        }
      }

      if (result) {
        const response = await result.response;
        const rawText = response.text().trim();
        const cleanText = rawText
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/```\s*$/i, '')
          .trim();
        const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed && parsed.text && Array.isArray(parsed.options) && parsed.options.length >= 2) {
            let correctIdx = 0;
            if (typeof parsed.correct_answer === 'number') {
              correctIdx = parsed.correct_answer;
            } else if (typeof parsed.correct_answer === 'string') {
              const foundIdx = parsed.options.findIndex(
                opt => opt.toLowerCase().trim() === parsed.correct_answer.toLowerCase().trim()
              );
              correctIdx = foundIdx !== -1 ? foundIdx : 0;
            }
            parsed.correct_answer = correctIdx;

            setSuggestion(JSON.stringify(parsed, null, 2));
            return parsed;
          }
        }
      }

      // If Gemini calls failed, fallback to heuristic
      console.warn('Gemini calls failed, applying fallback suggestion. Last error:', lastError?.message);
      if (lastError) setError(lastError.message);
      const fallback = generateHeuristicSuggestion(questionData, subjectName);
      setSuggestion(JSON.stringify(fallback, null, 2));
      return fallback;
    } catch (err) {
      console.error('AI Suggest error:', err);
      setError(err.message);
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

