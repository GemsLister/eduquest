export const calculateFlag = (level) => {
  const flagMap = {
    Easy: "Retain",
    Moderate: "Revise",
    Difficult: "Discard",
  };
  return flagMap[level];
};

export const useCalculateFlag = (level) => {
  return calculateFlag(level);
};
