import React from "react";

export const TakersDetailTable = ({ item }) => (
  <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
    <table className="w-full text-left text-sm">
      <thead className="bg-gray-50 text-[10px] uppercase font-bold text-gray-400">
        <tr>
          <th className="p-3">Student Name</th>
          {/* <th className="p-3">Response</th> */}
          <th className="p-3 text-center">Status</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {item.takersDetails.map((t, i) => (
          <tr key={i}>
            <td className="p-3">{t.name}</td>
            {/* <td className="p-3 font-mono text-xs font-bold text-lg">{t.answer}</td> */}
            <td className="p-3 text-center">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                t.isCorrect ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              }`}>
                {t.isCorrect ? "CORRECT" : "WRONG"}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

