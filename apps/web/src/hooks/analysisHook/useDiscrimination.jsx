export const useDiscrimination = () => {
  const handleDiscrimination = (questionResponses, takersMap = {}) => {
    if (!questionResponses || questionResponses.length < 2) {
      return { discrimination: "0.00", discStatus: "N/A" };
    }

    const scoredResponses = questionResponses.map((response) => ({
      attemptId: response.attempt_id,
      totalScore: takersMap[r.attempt_id]?.score || 0,
      isCorrect: response.is_correct
    })).sort((a, b) => b.totalScore - a.totalScore);

    const groupSize = Math.max(1, Math.floor(scoredResponses.length * 0.27));
    const upperGroup = scoredResponses.slice(0, groupSize);
    const lowerGroup = scoredResponses.slice(-groupSize);

    const dIndex = (upperGroup.filter(g => g.isCorrect).length / groupSize) - 
                  (lowerGroup.filter(g => g.isCorrect).length / groupSize);

    let status = "POOR";
    if (dIndex >= 0.4) status = "EXCELLENT";
    else if (dIndex >= 0.3) status = "GOOD";
    else if (dIndex >= 0.2) status = "FAIR";

    return { discrimination: dIndex.toFixed(2), discStatus: status };
  };

  return { handleDiscrimination };
};