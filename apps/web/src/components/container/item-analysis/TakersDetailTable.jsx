import React, { useState, useMemo } from "react";

export const TakersDetailTable = ({ item, searchTerm }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredTakers = useMemo(() => {
    return (item.takersDetails || []).filter(t => 
      !searchTerm || t.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [item.takersDetails, searchTerm]);

  // Pagination logic
  const paginatedTakers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredTakers.slice(startIndex, endIndex);
  }, [filteredTakers, currentPage]);

  const totalPages = Math.ceil(filteredTakers.length / itemsPerPage);

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-slate-50 border-b p-3 flex justify-between items-center">
        <h4 className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
          STUDENT RESPONSES {searchTerm && `(Filtered: "${searchTerm}")`}
        </h4>
        <span className="text-[10px] font-medium text-slate-400">
          Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredTakers.length)} of {filteredTakers.length}
        </span>
      </div>
      <div className="max-h-96 overflow-y-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-gray-50 border-b sticky top-0 text-gray-500 font-bold uppercase text-[9px]">
            <tr>
              <th className="p-2 border-r">Student Name</th>
              <th className="p-2 border-r text-center">Score</th>
              <th className="p-2 border-r text-center">Choice</th>
              <th className="p-2 text-center">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginatedTakers.length > 0 ? (
              paginatedTakers.map((t, idx) => (
                <tr key={idx} className={`hover:bg-slate-50 transition-colors ${
                  searchTerm && t.name.toLowerCase().includes(searchTerm.toLowerCase()) ? "bg-yellow-50" : ""
                }`}>
                  <td className="p-2 border-r font-medium text-slate-700">
                    {t.name}
                  </td>
                  <td className="p-2 border-r text-center font-mono font-bold text-indigo-600">
                    {t.totalScore}
                  </td>
                  <td className="p-2 border-r text-center font-mono font-bold">
                    {t.answer}
                  </td>
                  <td className="p-2 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                      t.isCorrect ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}>
                      {t.isCorrect ? "Correct" : "Incorrect"}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="3" className="p-8 text-center text-gray-400 italic">
                  No students match your search criteria.
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
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredTakers.length)} of {filteredTakers.length}
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className={`relative inline-flex items-center justify-center w-8 h-8 text-sm font-medium rounded-md transition-colors ${
                  currentPage === 1
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
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
                            ? 'bg-gray-800 text-white'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  } else if (
                    page === currentPage - 2 || 
                    page === currentPage + 2
                  ) {
                    return (
                      <span key={page} className="relative inline-flex items-center justify-center w-8 h-8 text-sm font-medium text-gray-400">
                        ...
                      </span>
                    );
                  }
                  return null;
                })}
              </div>
              
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className={`relative inline-flex items-center justify-center w-8 h-8 text-sm font-medium rounded-md transition-colors ${
                  currentPage === totalPages
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
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

