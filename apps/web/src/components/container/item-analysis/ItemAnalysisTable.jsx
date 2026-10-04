import React, { useState } from "react";
import { TakersDetailTable } from "./TakersDetailTable";
import { DetailedItemAnalysis } from "./DetailedItemAnalysis";
import { DistractorAnalysis } from "./DistractorAnalysis";
import { ItemRevisionComparisonModal } from "./ItemRevisionComparisonModal";

export const ItemAnalysisTable = ({
  analysis,
  studentSearchTerm,
  expandedQuestion,
  toggleDetails,
  onFlagClick,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedComparisonItem, setSelectedComparisonItem] = useState(null);
  const [selectedComparisonIndex, setSelectedComparisonIndex] = useState(null);
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
    <div className="bg-white shadow-xs rounded-2xl overflow-hidden border border-slate-200 flex flex-col lg:flex-row gap-6 p-4 lg:p-6">
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
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-brand-indigo/10 text-brand-indigo font-bold uppercase tracking-wider border border-brand-indigo/20 shadow-sm">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Has Revisions ({item.revision_history.length})
                              </span>
                              <span className="text-[10px] text-slate-400 italic font-normal">Saved to Question Bank</span>
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
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          Hi: {item.highestScore} | Lo: {item.lowestScore}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-center hidden lg:table-cell">
                      {item.autoFlag === 'retain' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-700 bg-green-50 px-2.5 py-1 rounded-full border border-green-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          Retain
                        </span>
                      ) : item.autoFlag === 'revise' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          Revise
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          Reject
                        </span>
                      )}
                    </td>

                    <td className="p-3 text-center">
                      <button
                        onClick={() => toggleDetails(item.question_id)}
                        aria-expanded={expandedQuestion === item.question_id}
                        aria-label={`${expandedQuestion === item.question_id ? "Hide" : "Inspect"} breakdown for item ${startIndex + index + 1}`}
                        className={`p-2 rounded-lg border text-xs font-bold transition-all shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 ${
                          expandedQuestion === item.question_id
                            ? 'bg-brand-navy text-white border-brand-navy shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                        title="Inspect breakdown"
                      >
                        {expandedQuestion === item.question_id ? 'Hide' : 'Inspect'}
                      </button>
                    </td>
                  </tr>

                  {/* Expanded detail accordion */}
                  {expandedQuestion === item.question_id && (
                    <tr className="bg-slate-50/50">
                      <td colSpan={5} className="p-4 border-t border-slate-200">
                        <div className="space-y-4">
                          <DetailedItemAnalysis
                            item={item}
                            index={startIndex + index}
                            onOpenRevisionHistory={(itemToCompare, idxToCompare) => {
                              setSelectedComparisonItem(itemToCompare);
                              setSelectedComparisonIndex(idxToCompare);
                            }}
                          />
                          <DistractorAnalysis item={item} />
                          <TakersDetailTable item={item} searchTerm={studentSearchTerm} />
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
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t border-slate-200 text-xs font-semibold text-slate-600">
            <div>
              Showing {startIndex + 1} to {Math.min(endIndex, analysis.length)} of {analysis.length} items
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
                aria-label="Previous page"
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold transition-colors shadow-2xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
              >
                Previous
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                  if (
                    page === 1 || 
                    page === totalPages || 
                    (page >= currentPage - 1 && page <= currentPage + 1)
                  ) {
                    return (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        aria-label={`Go to page ${page}`}
                        aria-current={currentPage === page ? "page" : undefined}
                        className={`w-8 h-8 rounded-lg font-bold text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 ${
                          currentPage === page
                            ? 'bg-brand-navy text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
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
                      <span key={page} className="px-1 text-slate-400">
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
                aria-label="Next page"
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold transition-colors shadow-2xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="lg:w-72 lg:flex-shrink-0 lg:sticky lg:top-4 lg:max-h-[80vh] lg:overflow-y-auto order-1 lg:order-2">
        <div className="bg-slate-50/70 rounded-2xl p-5 border border-slate-200 shadow-xs">
          <h4 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-wider text-center border-b border-slate-200 pb-2 flex items-center justify-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-brand-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Legend
          </h4>
          <div className="space-y-3 mb-4">
            <div>
              <span className="flex items-center justify-center gap-1.5 w-full py-1 rounded-full text-xs font-bold text-green-700 bg-green-50 border border-green-200 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Retain
              </span>
              <div className="text-xs text-slate-700 text-center">
                <strong className="font-mono text-green-700">D: 0.40-1.00</strong>
                <br />
                Good discrimination
              </div>
            </div>
            <div>
              <span className="flex items-center justify-center gap-1.5 w-full py-1 rounded-full text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Revise
              </span>
              <div className="text-xs text-slate-700 text-center">
                <strong className="font-mono text-amber-700">D: 0.20-0.39</strong>
                <br />
                Fair discrimination
              </div>
            </div>
            <div>
              <span className="flex items-center justify-center gap-1.5 w-full py-1 rounded-full text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                Reject
              </span>
              <div className="text-xs text-slate-700 text-center">
                <strong className="font-mono text-rose-700">D: 0.00-0.19</strong>
                <br />
                Poor discrimination
              </div>
            </div>
            <div>
              <span className="flex items-center justify-center gap-1.5 w-full py-1 rounded-full text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Excellent
              </span>
              <div className="text-xs text-slate-700 text-center">Discrimination at least 0.40</div>
            </div>
            <div>
              <span className="flex items-center justify-center gap-1.5 w-full py-1 rounded-full text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Poor
              </span>
              <div className="text-xs text-slate-700 text-center">Discrimination below 0.20</div>
            </div>

            <div className="pt-2 border-t border-slate-200 mt-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-brand-indigo/10 text-brand-indigo font-bold uppercase tracking-wider border border-brand-indigo/20 shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Has Revisions
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

      {/* Side-by-Side Revision History Comparison Modal */}
      {selectedComparisonItem && (
        <ItemRevisionComparisonModal
          isOpen={!!selectedComparisonItem}
          onClose={() => {
            setSelectedComparisonItem(null);
            setSelectedComparisonIndex(null);
          }}
          item={selectedComparisonItem}
          itemIndex={selectedComparisonIndex}
        />
      )}
    </div>
  );
};
