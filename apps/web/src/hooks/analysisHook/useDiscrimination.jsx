export const useDiscrimination = () => {
  const handleDiscrimination = (questionResponses, takersMap = {}) => {
    if (!questionResponses || questionResponses.length < 2) {
      return { discrimination: "0.00", discStatus: "N/A", status: "Insufficient Data", recommendation: "" };
    }

    const scoredResponses = questionResponses.map((response) => ({
      attemptId: response.attempt_id,
      totalScore: takersMap[response.attempt_id]?.score || 0,
      isCorrect: response.is_correct
    })).sort((a, b) => b.totalScore - a.totalScore);

    const groupSize = Math.max(1, Math.floor(scoredResponses.length * 0.27));
    const upperGroup = scoredResponses.slice(0, groupSize);
    const lowerGroup = scoredResponses.slice(-groupSize);

    const upperCorrect = upperGroup.filter(g => g.isCorrect).length;
    const lowerCorrect = lowerGroup.filter(g => g.isCorrect).length;
    
    const Pu = upperCorrect / groupSize;
    const Pl = lowerCorrect / groupSize;
    const dIndex = Pu - Pl;

    // Determine effectiveness based on provided table criteria
    let status, recommendation;
    if (dIndex < 0) {
      status = "Flawed";
      recommendation = "Reject (Low scorers got it right more than high scorers)";
    } else if (dIndex >= 0 && dIndex <= 0.19) {
      status = "Poor";
      recommendation = "Reject or Revise (The item is failing to sort students)";
    } else if (dIndex >= 0.20 && dIndex <= 0.29) {
      status = "Marginal";
      recommendation = "Revise (Needs improvement)";
    } else if (dIndex >= 0.30 && dIndex <= 0.39) {
      status = "Good";
      recommendation = "Retain (Good item)";
    } else if (dIndex >= 0.40) {
      status = "Excellent";
      recommendation = "Retain (Excellent item)";
    }

    return { 
      discrimination: dIndex.toFixed(2), 
      numericDisc: dIndex,
      discStatus: status,
      status,
      recommendation,
      Pu: Pu.toFixed(2),
      Pl: Pl.toFixed(2),
      upperGroupSize: groupSize,
      lowerGroupSize: groupSize,
      upperCorrect,
      lowerCorrect
    };
  };

  return { handleDiscrimination };
};