import { useState } from "react";

export const useFilteredQuestion = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");

  const filteredQuestions = questions.filter((q) => {
    const matchesSearch = q.text
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || q.type === filterType;
    return matchesSearch && matchesType;
  });

  return { filteredQuestions, setSearchTerm, setFilterType };
};
