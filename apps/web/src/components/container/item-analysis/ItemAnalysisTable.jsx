import React, { useState } from "react";
import { TakersDetailTable } from "./TakersDetailTable";
import { DetailedItemAnalysis } from "./DetailedItemAnalysis";
import { DistractorAnalysis } from "./DistractorAnalysis";

export const ItemAnalysisTable = ({
  analysis,
  studentSearchTerm,
  expandedQuestion,
  toggleDetails,
  onFlagClick,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Pagination calculations
  const totalPages = Math.ceil(analysis.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = analysis.slice(startIndex, endIndex);

  // Reset to page 1 only when analysis length changes (new quiz loaded)
  React.useEffect(() => {
    setCurrentPage(1);
  }, [analysis.length]);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };

  return (
    <div className="bg-white shadow-xl rounded-xl overflow-hidden border border-slate-300 flex flex-col lg:flex-row gap-6 p-4 lg:p-6">
      <div className="lg:flex-1 min-w-0 order-2 lg:order-1">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-xs uppercase font-bold text-gray-400 border-b sticky top-0 z-10">
              <tr>
                <th className="p-3 font-medium w-1/3 min-w-[200px]">Item</th>
                <th className="p-3 text-center w-1/6 min-w-[100px] hidden sm:table-cell">Difficulty (P)</th>
                <th className="p-3 text-center w-1/5 min-w-[110px] hidden md:table-cell">Discrimination</th>
                <th className="p-3 text-center w-1/8 min-w-[90px] hidden lg:table-cell">Flag</th>
                <th className="p-3 text-center w-1/8 min-w-[80px]">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {currentItems.map((item, index) => (
                <React.Fragment key={item.question_id}>
                  <tr className="hover:bg-gray-50 transition-colors h-14">
                    <td className="p-3 text-sm font-medium" title={item.text}>
                      {item.autoFlag === 'revise' || item.revised_content || item.previous_text || item.revision_history?.length > 0 ? (
                        <div 
                          className="group hover:bg-indigo-50/50 p-2 rounded-lg transition-all"
                          title="Item has revision history"
                        >
                          <span className="font-bold text-indigo-900 text-sm mr-2 group-hover:text-indigo-600">Q{startIndex + index + 1}:</span>
                          <span className="max-w-[200px] inline-block truncate lg:max-w-none lg:whitespace-normal lg:break-words group-hover:text-indigo-700">{item.text}</span>
                          
                          {item.revision_history && item.revision_history.length > 0 && (
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-bold uppercase tracking-wider border border-purple-200 shadow-sm">
                              📜 Has Revisions
                            </span>
                            <span className="text-[10px] text-slate-400 italic font-normal">({item.revision_history.length} version{item.revision_history.length !== 1 ? 's' : ''})</span>
                          </div>
                        )}
                        
                        {item.revised_content && (
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold uppercase tracking-wider animate-pulse border border-amber-200 shadow-sm">
                              📝 Revision Pending
                            </span>
                            <span className="text-[10px] text-slate-400 italic font-normal">(Click to see changes)</span>
                          </div>
                        )}

                        {item.previous_text && !item.revised_content && (
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-bold uppercase tracking-wider border border-green-200 shadow-sm">
                              ✓ Item Revised
                            </span>
                            <span className="text-[10px] text-slate-400 italic font-normal">(Click to see history)</span>
                          </div>
                        )}
                        </div>
                      ) : (
                        <div className="p-2">
                          <span className="font-bold text-indigo-900 text-sm mr-2">Q{startIndex + index + 1}:</span>
                          <span className="max-w-[200px] inline-block truncate lg:max-w-none lg:whitespace-normal lg:break-words">{item.text}</span>
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-center hidden sm:table-cell">
                      <div className="font-mono text-sm font-bold text-indigo-600">
                        {item.difficulty}
                      </div>
                      <div className="text-xs uppercase text-gray-500 font-medium">
                        {item.status}
                      </div>
                    </td>
                    <td className="p-3 text-center hidden md:table-cell">
                      <div className="font-mono text-sm font-bold text-gray-700">
                        {item.discrimination}
                      </div>
                      <div className="text-xs uppercase text-gray-500 font-medium">
                        {item.discStatus}
                      </div>
                      {item.highestScore !== undefined && (
                        <div className="text-xs text-gray-500 mt-1 font-mono text-[11px]">
                          H{item.highestScore} L{item.lowestScore}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-center hidden lg:table-cell">
                      <span 
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold text-white uppercase tracking-wide transition-all ${
                          item.autoFlag === "approved" 
                            ? "bg-green-500 opacity-80" 
                            : item.autoFlag === "reject"
                            ? "bg-gray-700 opacity-90"
                            : "bg-red-500 hover:bg-red-600 cursor-pointer hover:shadow-md"
                        }`}
                        onClick={() => item.autoFlag === 'revise' && onFlagClick(item)}
                        title={
                          item.autoFlag === 'revise' 
                            ? "Click to edit revision" 
                            : item.autoFlag === 'reject'
                            ? "Item rejected - poor quality"
                            : "Good item (no revision needed)"
                        }
                      >
                        {item.autoFlag === 'approved' ? 'RETAIN' : item.autoFlag?.toUpperCase()}
                      </span>
                    </td>

                    <td className="p-3">
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => toggleDetails(item.question_id)}
                          className="w-full text-indigo-600 font-bold text-xs uppercase hover:underline px-3 py-1 rounded hover:bg-indigo-50 transition-colors text-center block"
                        >
                          {expandedQuestion === item.question_id ? "Hide" : "View"}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedQuestion === item.question_id && (
                    <tr className="bg-gray-50">
                      <td colSpan="5" className="p-0 border-t border-b border-indigo-100">
                        <div className="p-6">
                          <DetailedItemAnalysis item={item} index={startIndex + index} />
                          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="max-h-[600px] overflow-y-auto">
                              <DistractorAnalysis item={item} />
                            </div>
                            <TakersDetailTable item={item} searchTerm={studentSearchTerm} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 sm:px-6">
            <div className="flex items-center justify-between flex-1">
              <div>
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
                  <span className="font-medium">{Math.min(endIndex, analysis.length)}</span> of{' '}
                  <span className="font-medium">{analysis.length}</span> results
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-3 py-2 text-sm font-semibold text-gray-900 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                
                {/* Page Numbers */}
                <div className="flex space-x-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                    // Show first page, last page, current page, and pages around current
                    if (
                      page === 1 || 
                      page === totalPages || 
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    ) {
                      return (
                        <button
                          key={page}
                          onClick={() => handlePageChange(page)}
                          className={`relative inline-flex items-center px-3 py-2 text-sm font-semibold rounded-md ${
                            currentPage === page
                              ? 'z-10 bg-indigo-600 text-white'
                              : 'text-gray-900 bg-white border border-gray-300 hover:bg-gray-50'
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
                        <span key={page} className="relative inline-flex items-center px-3 py-2 text-sm font-semibold text-gray-700">
                          ...
                        </span>
                      );
                    }
                    return null;
                  })}
                </div>
                
                <button
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-3 py-2 text-sm font-semibold text-gray-900 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="lg:w-72 lg:flex-shrink-0 lg:sticky lg:top-4 lg:max-h-[80vh] lg:overflow-y-auto order-1 lg:order-2">
        <div className="bg-gradient-to-b from-slate-50 to-white rounded-xl p-5 border-2 border-dashed border-slate-200 shadow-md">
          <h4 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-wide text-center border-b border-slate-200 pb-2">
            📊 Legend
          </h4>
          <div className="space-y-3 mb-4">
            <div className="group">
              <span className="block w-full h-7 bg-green-500 rounded-lg text-white text-xs font-bold text-center py-1 mb-1 shadow-sm group-hover:shadow-md transition-all">RETAIN</span>
              <div className="text-xs text-slate-700 text-center">
                <strong className="text-green-700">D: 0.40-1.00</strong>
                <br />
                Good discrimination
              </div>
            </div>
            <div className="group">
              <span className="block w-full h-7 bg-red-500 rounded-lg text-white text-xs font-bold text-center py-1 mb-1 shadow-sm group-hover:shadow-md transition-all">REVISE</span>
              <div className="text-xs text-slate-700 text-center">
                <strong className="text-red-700">D: 0.20-0.39</strong>
                <br />
                Fair discrimination
              </div>
            </div>
            <div className="group">
              <span className="block w-full h-7 bg-gray-700 rounded-lg text-white text-xs font-bold text-center py-1 mb-1 shadow-sm group-hover:shadow-md transition-all">REJECT</span>
              <div className="text-xs text-slate-700 text-center">
                <strong className="text-gray-700">D: 0.00-0.19</strong>
                <br />
                Poor discrimination
              </div>
            </div>
            <div className="group">
              <span className="block w-full h-6 bg-emerald-500 rounded-lg text-white text-[10px] font-bold text-center py-0.5 mb-1 shadow-sm group-hover:shadow-md transition-all">EXCELLENT</span>
              <div className="text-xs text-slate-700 text-center">Discrimination at least 0.40</div>
            </div>
            <div className="group">
              <span className="block w-full h-7 bg-amber-500 rounded-lg text-white text-xs font-bold text-center py-1 mb-1 shadow-sm group-hover:shadow-md transition-all">POOR</span>
              <div className="text-xs text-slate-700 text-center">Discrimination below 0.20</div>
            </div>
            
            <div className="pt-2 border-t border-slate-200 mt-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold uppercase tracking-wider border border-amber-200 shadow-sm">
                  📝 Revision Pending
                </span>
              </div>
              <p className="text-[10px] text-slate-500 italic mb-2">
                A draft revision exists. Click to compare and finalize.
              </p>

              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-bold uppercase tracking-wider border border-green-200 shadow-sm">
                  ✓ Item Revised
                </span>
              </div>
              <p className="text-[10px] text-slate-500 italic mb-2">
                This item has been finalized with a revision.
              </p>

              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-bold uppercase tracking-wider border border-purple-200 shadow-sm">
                  📜 Has Revisions
                </span>
              </div>
              <p className="text-[10px] text-slate-500 italic">
                This item has revision history. Click "Revision History" to view past versions.
              </p>
            </div>
          </div>
          <div className="text-[10px] text-slate-500 mt-2 text-center leading-tight">
            <strong>P</strong> = % correct answers (0.0–1.0)<br/>
            <strong>Hi/Lo</strong> = top/bottom performer total scores
          </div>
        </div>
      </div>
    </div>
  );
};
