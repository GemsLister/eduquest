export const useItemDifficulty = () => {
  const difficultyRules = [
    { condition: (fi) => fi >= 0.75, result: { status: "EASY", action: "retain" } },
    { condition: (fi) => fi < 0.75 && fi >= 0.25, result: { status: "MODERATE", action: "retain" } },
    { condition: (fi) => fi < 0.25 && fi > 0, result: { status: "DIFFICULT", action: "revise" } },
    { condition: (fi) => fi === 0, result: { status: "VERY HARD", action: "discard" } }
  ];

  const handleItemDifficulty = (hasResponses, correct, total) => {
    const fi = hasResponses && total > 0 ? correct / total : 0;
    if (!hasResponses) return { fi: "0.00", status: "N/A", action: "discard" };

    const match = difficultyRules.find((rule) => rule.condition(fi));
    return {
      fi: fi.toFixed(2),
      status: match ? match.result.status : "REVIEW",
      action: match ? match.result.action : "discard"
    };
  };

  return { handleItemDifficulty };
};