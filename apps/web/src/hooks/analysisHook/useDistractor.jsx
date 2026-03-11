export const useDistractor = () => {
  const handleDistractor = (question, questionResponses = []) => {
    if (!question?.options || !Array.isArray(question.options)) return [];

    const totalResponses = questionResponses.length;
    return question.options.map((option, index) => {
      const count = questionResponses.filter((response) => parseInt(response.answer) === index).length;
      const percentage = totalResponses > 0 ? (count / totalResponses) * 100 : 0;
      const isCorrect = index === parseInt(question.correct_answer);

      let status = "Functional";
      if (!isCorrect && count === 0) status = "Non-Functional (Revise)";
      else if (isCorrect) status = "Correct Key";

      return { text: option, count, percentage: percentage.toFixed(1), isCorrect, status };
    });
  };

  return { handleDistractor };
};