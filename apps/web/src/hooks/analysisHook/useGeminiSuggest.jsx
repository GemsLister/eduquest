import { useState, useCallback } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '../../supabaseClient';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || 'YOUR_GEMINI_API_KEY_HERE');

export const useGeminiSuggest = () => {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const [error, setError] = useState(null);

  const generateSuggestion = useCallback(async (questionData) => {
    setLoading(true);
    setError(null);
    setSuggestion('');
    try {
      // Check if API key is present
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
        throw new Error('Gemini API key is missing. Please add VITE_GEMINI_API_KEY to your .env file.');
      }

      // Initialize genAI with v1 as default (v1beta often 404s for some keys/regions)
      const genAIv1 = new GoogleGenerativeAI(apiKey);
      
      // Define the prompt
      const prompt = `
Improve this question for moderate difficulty (P-value between 0.25-0.75).
Original question: "${questionData.text}"
Type: ${questionData.type}
Correct answer: ${questionData.correct_answer}
Current difficulty: ${questionData.difficulty} (${questionData.status})
Discrimination: ${questionData.discrimination} (${questionData.discStatus})

Suggest:
1. Revised question text (similar length/style).
2. 4 MC options (better distractors).
3. Same correct answer position (0-3).
4. Keep same type/points.

Output ONLY valid JSON object with NO markdown formatting:
{"text": "revised question?", "options": ["Option A", "Option B", "Option C", "Option D"], "correct_answer": 0}
`;

      // Try common model names until one works
      const modelsToTry = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];
      let result = null;
      let lastError = null;

      for (const modelName of modelsToTry) {
        try {
          console.log(`Trying Gemini model: ${modelName} (v1)...`);
          // Force v1 API version which is often more stable than v1beta
          const model = genAIv1.getGenerativeModel({ model: modelName }, { apiVersion: 'v1' });
          result = await model.generateContent(prompt);
          if (result) break; // Success!
        } catch (e) {
          console.warn(`Gemini model ${modelName} (v1) failed:`, e.message);
          
          try {
            console.log(`Trying Gemini model: ${modelName} (v1beta)...`);
            const modelBeta = genAIv1.getGenerativeModel({ model: modelName }); // defaults to v1beta
            result = await modelBeta.generateContent(prompt);
            if (result) break;
          } catch (e2) {
            console.warn(`Gemini model ${modelName} (v1beta) failed:`, e2.message);
            lastError = e2;
          }
        }
      }

      if (!result) {
        throw lastError || new Error('All available Gemini models failed to generate content.');
      }
      
      const response = await result.response;
      const text = response.text();
      
      // Extract JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      let parsed;
      try {
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      } catch (e) {
        console.error('JSON parse error:', e, 'Raw text:', text);
        throw new Error('Failed to parse AI response. Please try again.');
      }
      
      if (!parsed || !parsed.text || !parsed.options) {
        throw new Error('AI response was incomplete. Please try again.');
      }
      
      setSuggestion(JSON.stringify(parsed, null, 2));
      return parsed;
    } catch (err) {
      setError(`API error: ${err.message}. Add VITE_GEMINI_API_KEY to .env`);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateQuestion = async (questionId, newText, newOptions, newCorrect) => {
    // Determine the correct_answer value to store
    // If it's a number (index), store the option text to match existing convention
    let correctAnswerValue = newCorrect;
    if (typeof newCorrect === 'number' && newOptions[newCorrect]) {
      correctAnswerValue = newOptions[newCorrect];
    } else if (typeof newCorrect === 'string' && !isNaN(parseInt(newCorrect)) && newOptions[parseInt(newCorrect)]) {
      correctAnswerValue = newOptions[parseInt(newCorrect)];
    }

    const { error } = await supabase
      .from('questions')
      .update({ 
        text: newText,
        options: newOptions,
        correct_answer: correctAnswerValue,
        flag: 'approved',
        revised_content: null, // Clear revision text
        revised_options: null, // Clear revision options
        updated_at: new Date().toISOString()
      })
      .eq('id', questionId);
    if (error) throw error;
  };

  const saveRevision = async (questionId, revisedText, revisedOptions, revisedCorrect) => {
    // Determine the correct_answer value to store in the revision
    let correctAnswerValue = revisedCorrect;
    if (typeof revisedCorrect === 'number' && revisedOptions[revisedCorrect]) {
      correctAnswerValue = revisedOptions[revisedCorrect];
    } else if (typeof revisedCorrect === 'string' && !isNaN(parseInt(revisedCorrect)) && revisedOptions[parseInt(revisedCorrect)]) {
      correctAnswerValue = revisedOptions[parseInt(revisedCorrect)];
    }

    // 1. Fetch current question to preserve it as "original" if it's not already preserved
    const { data: current } = await supabase
      .from('questions')
      .select('original_text, text, options, correct_answer')
      .eq('id', questionId)
      .single();

    const updateData = {
      // Update live content
      text: revisedText,
      options: revisedOptions,
      correct_answer: correctAnswerValue,
      
      // Update tracking columns
      revised_content: {
        text: revisedText,
        correct_answer: correctAnswerValue,
        revised_at: new Date().toISOString()
      },
      revised_options: revisedOptions,
      updated_at: new Date().toISOString()
    };

    // If it's the first revision, preserve current as original
    if (current && !current.original_text) {
      updateData.original_text = current.text;
      updateData.original_options = current.options;
      updateData.original_correct_answer = current.correct_answer;
    }

    const { error } = await supabase
      .from('questions')
      .update(updateData)
      .eq('id', questionId);
    
    if (error) throw error;
  };

  return { generateSuggestion, updateQuestion, saveRevision, loading, suggestion, error };
};

