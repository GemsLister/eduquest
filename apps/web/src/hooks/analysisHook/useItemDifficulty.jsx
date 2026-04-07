export const useItemDifficulty = () => {
  const difficultyRules = [
    { condition: (fi) => fi >= 0.81, result: { status: "VERY EASY", action: "reject" } },
    { condition: (fi) => fi >= 0.61 && fi <= 0.80, result: { status: "EASY", action: "revise" } },
    { condition: (fi) => fi >= 0.41 && fi <= 0.60, result: { status: "MODERATE", action: "retain" } },
    { condition: (fi) => fi >= 0.21 && fi <= 0.40, result: { status: "DIFFICULT", action: "revise" } },
    { condition: (fi) => fi >= 0 && fi <= 0.20, result: { status: "VERY DIFFICULT", action: "reject" } }
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