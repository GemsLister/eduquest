import React from "react";
import { TakersDetailTable } from "./TakersDetailTable";
import { DistractorAnalysis } from "./DistractorAnalysis";

export const ItemAnalysisTable = ({
  analysis,
  expandedQuestion,
  toggleDetails,
  onFlagClick,
}) => {

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
              {analysis.map((item, index) => (
                <React.Fragment key={item.question_id}>
                  <tr className="hover:bg-gray-50 transition-colors h-14">
                    <td className="p-3 text-sm font-medium" title={item.text}>
                      <span className="font-bold text-indigo-900 text-sm mr-2">Q{index + 1}:</span>
                      <span className="max-w-[200px] inline-block truncate lg:max-w-none lg:whitespace-normal lg:break-words">{item.text}</span>
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
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold text-white uppercase tracking-wide cursor-pointer hover:shadow-md transition-all ${
                          item.autoFlag === "retain" ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600"
                        }`}
                        onClick={() => onFlagClick(item)}
                        title="Click to edit (revise only)"
                      >
                        {item.autoFlag?.toUpperCase()}
                      </span>

                    </td>

                    <td className="p-3">
                      <button
                        onClick={() => toggleDetails(item.question_id)}
                        className="w-full text-indigo-600 font-bold text-xs uppercase hover:underline px-3 py-1 rounded hover:bg-indigo-50 transition-colors text-center block"
                      >
                        {expandedQuestion === item.question_id ? "Hide" : "View"}
                      </button>
                    </td>
                  </tr>
                  {expandedQuestion === item.question_id && (
                    <tr className="bg-gray-50">
                      <td colSpan="5" className="p-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                          <DistractorAnalysis item={item} />
                          <TakersDetailTable item={item} />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
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
                <strong className="text-green-700">P: 0.25–0.75</strong>
                <br />
                Moderate / Easy items
              </div>
            </div>
            <div className="group">
              <span className="block w-full h-7 bg-red-500 rounded-lg text-white text-xs font-bold text-center py-1 mb-1 shadow-sm group-hover:shadow-md transition-all">REVISE</span>
              <div className="text-xs text-slate-700 text-center">
                <strong className="text-red-700">P: below 0.25 or above 0.75</strong>
                <br />
                <small>(1.0 = too easy, 0.0 = too hard)</small>
              </div>
            </div>
            <div className="group">
              <span className="block w-full h-6 bg-emerald-500 rounded-lg text-white text-[10px] font-bold text-center py-0.5 mb-1 shadow-sm group-hover:shadow-md transition-all">EXCELLENT</span>
              <div className="text-xs text-slate-700 text-center">Discrimination at least 0.40</div>
            </div>
            <div className="group">
              <span className="block w-full h-6 bg-amber-500 rounded-lg text-white text-[10px] font-bold text-center py-0.5 mb-1 shadow-sm group-hover:shadow-md transition-all">POOR</span>
              <div className="text-xs text-slate-700 text-center">Discrimination below 0.20</div>
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
