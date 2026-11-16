export const useDiscrimination = () => {
  const handleDiscrimination = (questionResponses, takersMap = {}) => {
    if (!questionResponses || questionResponses.length < 2) {
      return { discrimination: "0.00", discStatus: "N/A", status: "Insufficient Data", recommendation: "" };
    }

    const scoredResponses = questionResponses.map((response) => ({
      attemptId: response.attempt_id,
      totalScore: takersMap[response.attempt_id]?.totalScore || 0,
      isCorrect: response.is_correct
    })).sort((a, b) => b.totalScore - a.totalScore);

    const groupSize = Math.max(1, Math.floor(scoredResponses.length * 0.27));
    const upperGroup = scoredResponses.slice(0, groupSize);
    const lowerGroup = scoredResponses.slice(-groupSize);

    const upperCorrect = upperGroup.filter(g => g.isCorrect).length;
    const lowerCorrect = lowerGroup.filter(g => g.isCorrect).length;
    
    const Pu = upperCorrect / groupSize;
    const Pl = lowerCorrect / groupSize;
    // Round to the 2 decimals shown on screen before labeling: 0.7 - 0.3 is
    // 0.39999... in floating point and would otherwise be labeled "Good".
    const dIndex = Number((Pu - Pl).toFixed(2));

    // Get student names for upper and lower groups
    const upperGroupNames = upperGroup.map(g => takersMap[g.attemptId]?.name || 'Unknown').filter(name => name !== 'Unknown');
    const lowerGroupNames = lowerGroup.map(g => takersMap[g.attemptId]?.name || 'Unknown').filter(name => name !== 'Unknown');

    // Determine effectiveness based on provided table criteria.
    // Each range ends where the next begins (< 0.20, < 0.30, < 0.40) so
    // values such as 0.195 or 0.296 still get a label.
    let status, recommendation;
    if (dIndex < 0) {
      status = "Flawed";
      recommendation = "Reject (Low scorers got it right more than high scorers)";
    } else if (dIndex < 0.20) {
      status = "Poor";
      recommendation = "Reject or Revise (The item is failing to sort students)";
    } else if (dIndex < 0.30) {
      status = "Marginal";
      recommendation = "Revise (Needs improvement)";
    } else if (dIndex < 0.40) {
      status = "Good";
      recommendation = "Retain (Good item)";
    } else {
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
      lowerCorrect,
      upperGroupNames,
      lowerGroupNames
    };
  };

  return { handleDiscrimination };
};