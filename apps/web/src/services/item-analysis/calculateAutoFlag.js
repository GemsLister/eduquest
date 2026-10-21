export const calculateAutoFlag = (difficultyStatus) => {
  // difficultyStatus can be: "Easy", "Moderately Difficult", "Moderate", "Difficult", "N/A"
  switch (difficultyStatus) {
    case "Easy":
      return "approved";
    case "Moderately Difficult":
    case "Moderate":
      return "approved";
    case "Difficult":
      return "needs_revision";
    default:
      return "pending";
  }
};
