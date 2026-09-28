import React, { useState, useMemo, useEffect } from "react";

export const TakersDetailTable = ({ item, searchTerm }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState(null); // 'name' | 'score' | 'choice' | 'result'
  const [sortDirection, setSortDirection] = useState("asc"); // 'asc' | 'desc'
  const [choiceFilter, setChoiceFilter] = useState("all");
  const [resultFilter, setResultFilter] = useState("all");
  const itemsPerPage = 10;

  // Reset page when filters, search, or question item changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, choiceFilter, resultFilter, sortField, sortDirection, item?.question_id]);

  // Extract unique choices and count for each choice
  const choiceCounts = useMemo(() => {
    const details = item?.takersDetails || [];
    const map = {};
    details.forEach((t) => {
      const choice = String(t.answer || "").toUpperCase();
      if (choice) {
        map[choice] = (map[choice] || 0) + 1;
      }
    });
    return map;
  }, [item?.takersDetails]);

  const availableChoices = useMemo(() => {
    return Object.keys(choiceCounts).sort();
  }, [choiceCounts]);

  // Filter and sort student responses
  const filteredTakers = useMemo(() => {
    let list = item?.takersDetails || [];

    // Global search term filter
    if (searchTerm) {
      list = list.filter((t) =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Choice filter (A, B, C, D...)
    if (choiceFilter !== "all") {
      list = list.filter(
        (t) => String(t.answer || "").toUpperCase() === choiceFilter.toUpperCase()
      );
    }

    // Result filter (Correct / Incorrect)
    if (resultFilter === "correct") {
      list = list.filter((t) => t.isCorrect);
    } else if (resultFilter === "incorrect") {
      list = list.filter((t) => !t.isCorrect);
    }

    // Sorting logic
    if (sortField) {
      list = [...list].sort((a, b) => {
        let comp = 0;
        if (sortField === "name") {
          comp = a.name.localeCompare(b.name);
        } else if (sortField === "score") {
          comp = (a.totalScore || 0) - (b.totalScore || 0);
        } else if (sortField === "choice") {
          comp = String(a.answer || "").localeCompare(String(b.answer || ""));
        } else if (sortField === "result") {
          const aVal = a.isCorrect ? 1 : 0;
          const bVal = b.isCorrect ? 1 : 0;
          comp = aVal - bVal;
        }
        return sortDirection === "asc" ? comp : -comp;
      });
    }

    return list;
  }, [item?.takersDetails, searchTerm, choiceFilter, resultFilter, sortField, sortDirection]);

  // Pagination logic
  const paginatedTakers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredTakers.slice(startIndex, endIndex);
  }, [filteredTakers, currentPage]);

  const totalPages = Math.max(1, Math.ceil(filteredTakers.length / itemsPerPage));

  // Handle column header sorting clicks
  const handleSort = (field) => {
    if (sortField === field) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else {
        setSortField(null);
        setSortDirection("asc");
      }
    } else {
      setSortField(field);
      if (field === "score" || field === "result") {
        setSortDirection("desc"); // High score first / Correct first by default
      } else {
        setSortDirection("asc"); // A-Z / Choice A first by default
      }
    }
  };

  const resetFilters = () => {
    setChoiceFilter("all");
    setResultFilter("all");
    setSortField(null);
    setSortDirection("asc");
  };

  const getSortIcon = (field) => {
    if (sortField !== field) {
      return (
        <span className="text-gray-300 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
          ↕
        </span>
      );
    }
    return (
      <span className="text-indigo-600 font-bold ml-1">
        {sortDirection === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-slate-50 border-b p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h4 className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
            <span>STUDENT RESPONSES</span>
            {searchTerm && (
              <span className="text-amber-600 font-semibold lowercase">
                (search: "{searchTerm}")
              </span>
            )}
          </h4>
        </div>
        <span className="text-[10px] font-medium text-slate-400">
          Showing {filteredTakers.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to{" "}
          {Math.min(currentPage * itemsPerPage, filteredTakers.length)} of {filteredTakers.length}
        </span>
      </div>

      {/* Filter & Sort Control Toolbar */}
      <div className="bg-slate-100/80 border-b px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Choice Filter Pills */}
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[10px] font-bold text-slate-500 uppercase mr-1">Choice:</span>
          <button
            onClick={() => setChoiceFilter("all")}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
              choiceFilter === "all"
                ? "bg-brand-navy text-white shadow-xs"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-200"
            }`}
          >
            All ({item?.takersDetails?.length || 0})
          </button>
          {availableChoices.map((choice) => (
            <button
              key={choice}
              onClick={() => setChoiceFilter(choice)}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                choiceFilter === choice
                  ? "bg-brand-navy text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-200"
              }`}
            >
              {choice} ({choiceCounts[choice] || 0})
            </button>
          ))}
        </div>

        {/* Result Filter & Reset */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Result:</span>
            <select
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value)}
              className="text-[11px] font-semibold bg-white border border-slate-200 rounded px-2 py-0.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-navy"
            >
              <option value="all">All Results</option>
              <option value="correct">✓ Correct Only</option>
              <option value="incorrect">✗ Incorrect Only</option>
            </select>
          </div>

          {(choiceFilter !== "all" || resultFilter !== "all" || sortField !== null) && (
            <button
              onClick={resetFilters}
              className="text-[10px] font-semibold text-red-600 hover:text-red-800 underline ml-1"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="max-h-96 overflow-y-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-gray-50 border-b sticky top-0 text-gray-500 font-bold uppercase text-[9px] z-10">
            <tr>
              <th
                onClick={() => handleSort("name")}
                className="p-2 border-r cursor-pointer hover:bg-gray-100 transition-colors group select-none"
                title="Click to sort by Student Name (A-Z / Z-A)"
              >
                <div className="flex items-center justify-between">
                  <span>Student Name</span>
                  {getSortIcon("name")}
                </div>
              </th>
              <th
                onClick={() => handleSort("score")}
                className="p-2 border-r text-center cursor-pointer hover:bg-gray-100 transition-colors group select-none"
                title="Click to sort by Total Exam Score (High-Low / Low-High)"
              >
                <div className="flex items-center justify-center">
                  <span>Score</span>
                  {getSortIcon("score")}
                </div>
              </th>
              <th
                onClick={() => handleSort("choice")}
                className="p-2 border-r text-center cursor-pointer hover:bg-gray-100 transition-colors group select-none"
                title="Click to sort by Choice (A, B, C, D...)"
              >
                <div className="flex items-center justify-center">
                  <span>Choice</span>
                  {getSortIcon("choice")}
                </div>
              </th>
              <th
                onClick={() => handleSort("result")}
                className="p-2 text-center cursor-pointer hover:bg-gray-100 transition-colors group select-none"
                title="Click to sort by Result (Correct First / Incorrect First)"
              >
                <div className="flex items-center justify-center">
                  <span>Result</span>
                  {getSortIcon("result")}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginatedTakers.length > 0 ? (
              paginatedTakers.map((t, idx) => (
                <tr
                  key={idx}
                  className={`hover:bg-slate-50 transition-colors ${
                    searchTerm && t.name.toLowerCase().includes(searchTerm.toLowerCase())
                      ? "bg-yellow-50"
                      : ""
                  }`}
                >
                  <td className="p-2 border-r font-medium text-slate-700">
                    {t.name}
                  </td>
                  <td className="p-2 border-r text-center font-mono font-bold text-indigo-600">
                    {t.totalScore}
                  </td>
                  <td className="p-2 border-r text-center font-mono font-bold">
                    <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-800 font-extrabold text-[10px]">
                      {t.answer}
                    </span>
                  </td>
                  <td className="p-2 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                        t.isCorrect
                          ? "bg-green-100 text-green-700 border border-green-200"
                          : "bg-red-100 text-red-700 border border-red-200"
                      }`}
                    >
                      {t.isCorrect ? "Correct" : "Incorrect"}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="p-8 text-center text-gray-400 italic">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <p>No student responses match your selected filters.</p>
                    <button
                      onClick={resetFilters}
                      className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs font-semibold transition-colors"
                    >
                      Reset Filters
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
              {Math.min(currentPage * itemsPerPage, filteredTakers.length)} of {filteredTakers.length}
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className={`relative inline-flex items-center justify-center w-8 h-8 text-sm font-medium rounded-md transition-colors ${
                  currentPage === 1
                    ? "text-gray-300 cursor-not-allowed"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-200"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {/* Page Numbers */}
              <div className="flex items-center space-x-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                  if (
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - 1 && page <= currentPage + 1)
                  ) {
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`relative inline-flex items-center justify-center w-8 h-8 text-sm font-medium rounded-md transition-colors ${
                          currentPage === page
                            ? "bg-gray-800 text-white"
                            : "text-gray-500 hover:text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {page}
                      </button>
                    );
                  } else if (page === currentPage - 2 || page === currentPage + 2) {
                    return (
                      <span
                        key={page}
                        className="relative inline-flex items-center justify-center w-8 h-8 text-sm font-medium text-gray-400"
                      >
                        ...
                      </span>
                    );
                  }
                  return null;
                })}
              </div>

              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className={`relative inline-flex items-center justify-center w-8 h-8 text-sm font-medium rounded-md transition-colors ${
                  currentPage === totalPages
                    ? "text-gray-300 cursor-not-allowed"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-200"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
