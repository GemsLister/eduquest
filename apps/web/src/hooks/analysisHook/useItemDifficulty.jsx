export const useItemDifficulty = () => {
  const difficultyRules = [
    { condition: (fi) => fi > 0.70, result: { status: "EASY", action: "retain" } },
    { condition: (fi) => fi >= 0.30 && fi <= 0.70, result: { status: "MODERATELY DIFFICULT", action: "retain" } },
    { condition: (fi) => fi < 0.30, result: { status: "DIFFICULT", action: "revise" } }
  ];

  const handleItemDifficulty = (hasResponses, correct, total) => {
    const fi = hasResponses && total > 0 ? correct / total : 0;
    if (!hasResponses) return { fi: "0.00", status: "N/A", action: "reject" };

    const match = difficultyRules.find((rule) => rule.condition(fi));
    return {
      fi: fi.toFixed(2),
      status: match ? match.result.status : "REVIEW",
      action: match ? match.result.action : "revise"
    };
  };

  return { handleItemDifficulty };
};