import React from "react";
import { TakersDetailTable } from "./TakersDetailTable";
import { DistractorAnalysis } from "./DistractorAnalysis";

export const ItemAnalysisTable = ({ analysis, expandedQuestion, toggleDetails }) => {
  return (
    <div className="bg-white shadow-xl rounded-xl overflow-hidden border">
      <table className="w-full text-left">
        <thead className="bg-gray-50 text-[10px] uppercase font-bold text-gray-400 border-b">
          <tr>
            <th className="p-4">Item</th>
            <th className="p-4 text-center">Difficulty ($P$)</th>
            <th className="p-4 text-center">Discrimination ($D$)</th>
            <th className="p-4 text-center">AI Decision</th>
            <th className="p-4 text-center">Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {analysis.map((item) => (
            <React.Fragment key={item.question_id}>
              <tr className="hover:bg-gray-50 transition-colors">
                <td className="p-4 text-sm font-medium">{item.text}</td>
                <td className="p-4 text-center">
                   <div className="text-sm font-bold text-indigo-600">{item.difficulty}</div>
                   <div className="text-[10px] uppercase text-gray-400">{item.status}</div>
                </td>
                <td className="p-4 text-center">
                   <div className="text-sm font-bold text-gray-700">{item.discrimination}</div>
                   <div className="text-[10px] uppercase text-gray-400">{item.discStatus}</div>
                </td>
                <td className="p-4 text-center">
                  <span className={`px-4 py-1 rounded-md text-[10px] font-black text-white uppercase ${
                    item.autoFlag === "retain" ? "bg-green-600" : "bg-red-600"
                  }`}>
                    {item.autoFlag}
                  </span>
                </td>
                <td className="p-4 text-center">
                  <button onClick={() => toggleDetails(item.question_id)} className="text-indigo-600 font-bold text-xs uppercase hover:underline">
                    {expandedQuestion === item.question_id ? "Hide" : "Inspect"}
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
  );
};