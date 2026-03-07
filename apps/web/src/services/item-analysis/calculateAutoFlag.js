export const calculateAutoFlag = (difficultyStatus) => {
  // difficultyStatus can be: "Easy", "Moderate", "Difficult", "N/A"
  switch (difficultyStatus) {
    case "Easy":
      return "retain";
    case "Moderate":
      return "needs_revision";
    case "Difficult":
      return "discard";
    default:
      return "pending";
  }
};
