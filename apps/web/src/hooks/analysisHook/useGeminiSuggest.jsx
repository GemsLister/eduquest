import { useState, useCallback } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '../../supabaseClient';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY);

export const useGeminiSuggest = () => {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const [error, setError] = useState(null);

  const generateSuggestion = useCallback(async (questionData) => {
    setLoading(true);
    setError(null);
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const prompt = `
Improve this question for moderate difficulty (P-value between 0.25-0.75).
Original question: "${questionData.text}"
Type: ${questionData.type}
Correct answer: ${questionData.correct_answer}
Current difficulty: ${questionData.difficulty} (${questionData.status})
Distractors: ${JSON.stringify(questionData.distractorAnalysis || [])}

Suggest:
1. Revised question text (same length/style).
2. Same 4 options (better distractors for moderate difficulty).
3. Same correct answer position.
4. Keep same points/type.

Output ONLY JSON:
{"text": "revised text", "options": ["A", "B", "C", "D"], "correct_answer": "0"}
`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Parse JSON from response
      const jsonMatch = text.match(/\{.*\}/s);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { text: 'AI failed to parse', options: [], correct_answer: questionData.correct_answer };
      
      setSuggestion(JSON.stringify(parsed, null, 2));
      return parsed;
    } catch (err) {
      setError(err.message);
      console.error('Gemini error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateQuestion = async (questionId, newText, newOptions, newCorrect) => {
    const { error } = await supabase
      .from('questions')
      .update({ 
        text: newText,
        options: newOptions,
        correct_answer: newCorrect,
        flag: 'retain',
        updated_at: new Date().toISOString()
      })
      .eq('id', questionId);
    if (error) throw error;
  };

  return { generateSuggestion, updateQuestion, loading, suggestion, error };
};

