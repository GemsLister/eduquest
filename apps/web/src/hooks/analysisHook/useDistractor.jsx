export const useDistractor = () => {
  const calculateDiscriminationIndex = (question, studentResponses) => {
    if (!studentResponses || studentResponses.length < 2) return { D: 0, status: "Insufficient Data" };

    // Sort students by total score (descending)
    const sortedStudents = studentResponses.sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
    const totalStudents = sortedStudents.length;
    
    // Calculate group size (27% of total)
    const groupSize = Math.max(1, Math.floor(totalStudents * 0.27));
    
    // Get upper and lower groups
    const upperGroup = sortedStudents.slice(0, groupSize);
    const lowerGroup = sortedStudents.slice(-groupSize);
    
    // Calculate proportion correct in upper group (Pu)
    const upperCorrect = upperGroup.filter(student => 
      parseInt(student.answer) === parseInt(question.correct_answer)
    ).length;
    const Pu = upperCorrect / groupSize;
    
    // Calculate proportion correct in lower group (Pl)
    const lowerCorrect = lowerGroup.filter(student => 
      parseInt(student.answer) === parseInt(question.correct_answer)
    ).length;
    const Pl = lowerCorrect / groupSize;
    
    // Calculate discrimination index D = Pu - Pl
    const D = Pu - Pl;
    
    // Determine effectiveness based on provided table criteria
    let status, recommendation;
    if (D < 0) {
      status = "Flawed";
      recommendation = "Reject (Low scorers got it right more than high scorers)";
    } else if (D >= 0 && D <= 0.19) {
      status = "Poor";
      recommendation = "Reject or Revise (The item is failing to sort students)";
    } else if (D >= 0.20 && D <= 0.29) {
      status = "Marginal";
      recommendation = "Revise (Needs improvement)";
    } else if (D >= 0.30 && D <= 0.39) {
      status = "Good";
      recommendation = "Retain (Good item)";
    } else if (D >= 0.40) {
      status = "Excellent";
      recommendation = "Retain (Excellent item)";
    }
    
    return {
      D: D.toFixed(2),
      Pu: Pu.toFixed(2),
      Pl: Pl.toFixed(2),
      upperGroupSize: groupSize,
      lowerGroupSize: groupSize,
      status,
      recommendation,
      upperCorrect,
      lowerCorrect
    };
  };

  const handleDistractor = (question, questionResponses = [], allStudentResponses = []) => {
    if (!question?.options || !Array.isArray(question.options)) return [];

    const totalResponses = questionResponses.length;
    const discriminationData = calculateDiscriminationIndex(question, allStudentResponses);
    
    return question.options.map((option, index) => {
      const count = questionResponses.filter((response) => parseInt(response.answer) === index).length;
      const percentage = totalResponses > 0 ? (count / totalResponses) * 100 : 0;
      const isCorrect = index === parseInt(question.correct_answer);

      let status = "Functional";
      if (!isCorrect && count === 0) status = "Non-Functional (Revise)";
      else if (isCorrect) status = "Correct Key";

      return { 
        text: option, 
        count, 
        percentage: percentage.toFixed(1), 
        isCorrect, 
        status,
        discriminationData
      };
    });
  };

  return { handleDistractor, calculateDiscriminationIndex };
};