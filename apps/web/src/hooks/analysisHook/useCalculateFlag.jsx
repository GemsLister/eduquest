export const calculateFlag = (level) => {
  const flagMap = {
    Easy: "Retain",
    "Moderately Difficult": "Retain",
    Moderate: "Retain",
    Difficult: "Discard",
  };
  return flagMap[level];
};

export const useCalculateFlag = (level) => {
  return calculateFlag(level);
};
