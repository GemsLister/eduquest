import React from "react";
import { calculateFlag } from "../../../hooks/analysisHook/useCalculateFlag";

export const ItemAnalysisTable = ({
  loading,
  analysis,
  expandedQuestion,
  toggleDetails,
  takersPage,
  setTakersPage,
}) => {
  return (
    <div className="bg-white shadow-lg rounded-xl overflow-hidden">
      {!loading && (!analysis || analysis.length === 0) ? (
        <div className="p-8 text-center">
          <p className="text-gray-500 text-lg">No analysis data available for this quiz.</p>
          <p className="text-gray-400 text-sm mt-2">Students need to take the quiz first to generate analysis data.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 text-gray-600 text-xs uppercase">
              <tr>
                <th className="p-4 text-left w-1/4">Question</th>
                {["Takers", "Difficulty", "Status", "Discrimination", "Disc. Status", "Flag", "Details"].map((thead) => (
                  <th key={thead} className="p-4 text-center">{thead}</th>
                ))}
              </tr>
            </thead>
            {/* Table body */}
            <tbody>
              {analysis.map((item, idx) => {
                const autoFlag = calculateFlag(item.status);

                // Define every column's logic here
                const columns = [
                  {
                    id: "text",
                    content: <span className="truncate max-w-xs block">{item.text}</span>,
                    className: "p-4 text-sm text-gray-700 text-left",
                  },
                  {
                    id: "takers",
                    content: item.total,
                    className: "p-4 text-center font-mono",
                  },
                  {
                    id: "difficulty",
                    content: item.difficulty,
                    className: "p-4 text-center font-bold text-indigo-600",
                  },
                  {
                    id: "status",
                    content: (
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                        item.status === "Easy" ? "bg-green-100 text-green-700" :
                        item.status === "Moderate" ? "bg-yellow-100 text-yellow-700" :
                        item.status === "Difficult" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"
                      }`}>
                        {item.status}
                      </span>
                    ),
                    className: "p-4 text-center",
                  },
                  {
                    id: "discrimination",
                    content: item.discStatus !== "N/A" ? item.discrimination : "N/A",
                    className: "p-4 text-center font-mono text-indigo-600",
                  },
                  {
                    id: "discStatus",
                    content: (
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                        item.discStatus === "Excellent" ? "bg-green-100 text-green-700" :
                        item.discStatus === "Good" ? "bg-blue-100 text-blue-700" :
                        item.discStatus === "Acceptable" ? "bg-yellow-100 text-yellow-700" :
                        item.discStatus === "Poor" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"
                      }`}>
                        {item.discStatus}
                      </span>
                    ),
                    className: "p-4 text-center",
                  },
                  {
                    id: "flag",
                    content: (
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${
                        autoFlag === "Retain" ? "bg-green-100 text-green-700 border-green-200" :
                        autoFlag === "Revise" ? "bg-orange-100 text-orange-700 border-orange-200" :
                        autoFlag === "Discard" ? "bg-red-100 text-red-700 border-red-200" : "bg-gray-100 text-gray-700 border-gray-200"
                      }`}>
                        {autoFlag}
                      </span>
                    ),
                    className: "p-4 text-center",
                  },
                  {
                    id: "details",
                    content: (item.distractorAnalysis || (item.takersDetails?.length > 0)) ? (
                      <button
                        onClick={() => toggleDetails(item.question_id)}
                        className="px-3 py-1 bg-indigo-100 text-indigo-700 text-xs rounded hover:bg-indigo-200 transition"
                      >
                        {expandedQuestion === item.question_id ? "Hide" : "View"}
                      </button>
                    ) : <span className="text-xs text-gray-400">N/A</span>,
                    className: "p-4 text-center",
                  }
                ];

                return (
                  <React.Fragment key={item.question_id || idx}>
                    <tr className="border-b hover:bg-gray-50 transition">
                      {columns.map((col) => (
                        <td key={col.id} className={col.className}>
                          {col.content}
                        </td>
                      ))}
                    </tr>

                    {/* Expanded Section logic remains the same for readability */}
                    {expandedQuestion === item.question_id && (
                      <tr className="bg-indigo-50">
                        <td colSpan={columns.length} className="p-4">
                           {/* ... pagination and student answer logic ... */}
                           <div className="ml-4 space-y-4">
                             {item.takersDetails?.length > 0 && (
                               <TakersDetailTable 
                                 item={item} 
                                 takersPage={takersPage} 
                                 setTakersPage={setTakersPage} 
                               />
                             )}
                           </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};