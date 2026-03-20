import React from "react";

export const TakersDetailTable = ({ item, searchTerm }) => {
  const filteredTakers = (item.takersDetails || []).filter(t => 
    !searchTerm || t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-slate-50 border-b p-3 flex justify-between items-center">
        <h4 className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
          STUDENT RESPONSES {searchTerm && `(Filtered: "${searchTerm}")`}
        </h4>
        <span className="text-[10px] font-medium text-slate-400">
          Showing {filteredTakers.length} of {item.takersDetails?.length || 0}
        </span>
      </div>
      <div className="max-h-80 overflow-y-auto">
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
            {filteredTakers.length > 0 ? (
              filteredTakers.map((t, idx) => (
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
    </div>
  );
};

