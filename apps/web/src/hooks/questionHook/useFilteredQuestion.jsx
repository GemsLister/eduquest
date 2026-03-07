import { useState } from "react";

export const useFilteredQuestion = (questions = []) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterFlag, setFilterFlag] = useState("all");

  const filteredQuestions = questions.filter((question) => {
    const matchesSearch = question.text
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || question.type === filterType;
    const matchesFlag = filterFlag === "all" || question.flag === filterFlag;
    return matchesSearch && matchesType && matchesFlag;
  });

  return { 
    filteredQuestions, 
    searchTerm, 
    setSearchTerm, 
    setFilterType,
    filterFlag,
    setFilterFlag,
  };
};
