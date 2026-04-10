import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area 
} from 'recharts';

export const DetailedItemAnalysis = ({ item, index }) => {
  // 1. Prepare Chart Data (Proportion Right per Ability Decile)
  const data = item.decilePerformance || [];

  return (
    <div className="bg-[#e2e8f0] p-1 rounded border border-gray-400">
      <div className="bg-white p-4 border border-gray-400">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* ITEM CHARACTERISTICS - BAR CHART */}
          <div className="border border-gray-300 p-2">
            <h3 className="text-[11px] font-bold text-center text-gray-700 uppercase mb-2">
              ITEM CHARACTERISTICS
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height={250} minWidth={0} minHeight={0}>
                <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="1 1" vertical={true} horizontal={true} stroke="#ccc" />
                  <XAxis 
                    dataKey="ability" 
                    fontSize={10}
                    tickLine={true}
                    label={{ value: 'ability level', position: 'insideBottom', offset: -10, fontSize: 10 }}
                  />
                  <YAxis 
                    domain={[0, 100]} 
                    fontSize={10}
                    tickLine={true}
                    label={{ value: 'proportion right', angle: -90, position: 'insideLeft', offset: 10, fontSize: 10 }}
                  />
                  <Tooltip />
                  <Bar dataKey="proportion" fill="#b91c1c" barSize={25} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ITEM RESPONSE THEORY - AREA CHART */}
          {/* <div className="border border-gray-300 p-2">
            <h3 className="text-[11px] font-bold text-center text-gray-700 uppercase mb-2">
              ITEM RESPONSE THEORY
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height={250} minWidth={0} minHeight={0}>
                <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="1 1" vertical={true} horizontal={true} stroke="#ccc" />
                  <XAxis 
                    dataKey="ability" 
                    fontSize={10}
                    tickLine={true}
                    label={{ value: 'ability level', position: 'insideBottom', offset: -10, fontSize: 10 }}
                  />
                  <YAxis 
                    domain={[0, 100]} 
                    fontSize={10}
                    tickLine={true}
                    label={{ value: 'proportion right', angle: -90, position: 'insideLeft', offset: 10, fontSize: 10 }}
                  />
                  <Tooltip />
                  <Area 
                    type="stepAfter" 
                    dataKey="proportion" 
                    stroke="#7f1d1d" 
                    fill="#b91c1c" 
                    fillOpacity={1}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div> */}
          <div className="flex flex-col gap-4 mt-4">
          {/* HIGH GROUP */}
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-gray-600 mb-1">High Group (Top 27%)</span>
            <div className="border border-gray-400 overflow-hidden">
              <div className="bg-green-50 p-2 border-b border-gray-400">
                <div className="text-[9px] font-semibold text-green-800">
                  Pu = {item.Pu} ({item.upperCorrect}/{item.upperGroupSize} correct)
                </div>
              </div>
              <div className="max-h-32 overflow-y-auto">
                {item.upperGroupNames && item.upperGroupNames.length > 0 ? (
                  <div className="p-2">
                    {item.upperGroupNames.map((name, index) => (
                      <div key={index} className="text-[10px] text-gray-700 py-1 border-b border-gray-100 last:border-0">
                        {index + 1}. {name}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-2 text-[10px] text-gray-400 italic">
                    No high group students available
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* LOW GROUP */}
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-gray-600 mb-1">Low Group (Bottom 27%)</span>
            <div className="border border-gray-400 overflow-hidden">
              <div className="bg-red-50 p-2 border-b border-gray-400">
                <div className="text-[9px] font-semibold text-red-800">
                  Pl = {item.Pl} ({item.lowerCorrect}/{item.lowerGroupSize} correct)
                </div>
              </div>
              <div className="max-h-32 overflow-y-auto">
                {item.lowerGroupNames && item.lowerGroupNames.length > 0 ? (
                  <div className="p-2">
                    {item.lowerGroupNames.map((name, index) => (
                      <div key={index} className="text-[10px] text-gray-700 py-1 border-b border-gray-100 last:border-0">
                        {index + 1}. {name}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-2 text-[10px] text-gray-400 italic">
                    No low group students available
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        </div>

        {/* HIGH AND LOW GROUP STUDENT NAMES */}
        

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          {/* TEST TABLE */}
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-gray-600 mb-1">Test</span>
            <div className="border border-gray-400 overflow-hidden">
              <table className="w-full text-[10px] text-left border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-1 border border-gray-400 text-center font-bold">Item</th>
                    <th className="p-1 border border-gray-400 text-center font-bold">Key</th>
                    <th className="p-1 border border-gray-400 text-center font-bold">Diff</th>
                    <th className="p-1 border border-gray-400 text-center font-bold">Disc</th>
                    <th className="p-1 border border-gray-400 text-center font-bold">Deci</th>
                    <th className="p-1 border border-gray-400 text-center font-bold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-white">
                    <td className="p-1 border border-gray-400 text-center">{index + 1}.</td>
                    <td className="p-1 border border-gray-400 text-center font-bold">{item.correct_answer}</td>
                    <td className="p-1 border border-gray-400 text-center">{item.difficulty}</td>
                    <td className="p-1 border border-gray-400 text-center">{item.discrimination}</td>
                    <td className="p-1 border border-gray-400 text-center">
                      <span className={item.autoFlag === 'approved' ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                        {item.autoFlag === 'approved' ? 'Retain' : 'Reject'}
                      </span>
                    </td>
                    <td className="p-1 border border-gray-400 text-center font-mono">{item.totalResponses}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* EXAMINEE TABLE */}
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-gray-600 mb-1">Examinee</span>
            <div className="border border-gray-400 overflow-hidden">
              <table className="w-full text-[10px] text-left border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-1 border border-gray-400 text-center font-bold">Total</th>
                    <th className="p-1 border border-gray-400 text-center font-bold">Highest</th>
                    <th className="p-1 border border-gray-400 text-center font-bold">Lowest</th>
                    <th className="p-1 border border-gray-400 text-center font-bold">Range</th>
                    <th className="p-1 border border-gray-400 text-center font-bold">Division</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-white">
                    <td className="p-1 border border-gray-400 text-center font-mono">{item.totalResponses}</td>
                    <td className="p-1 border border-gray-400 text-center font-mono">{item.highestScore}</td>
                    <td className="p-1 border border-gray-400 text-center font-mono">{item.lowestScore}</td>
                    <td className="p-1 border border-gray-400 text-center font-mono">{item.highestScore - item.lowestScore}</td>
                    <td className="p-1 border border-gray-400 text-center font-mono">10</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
