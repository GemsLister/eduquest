export const DistractorAnalysis = ({ item }) => {
  if (!item?.distractorAnalysis?.length) {
    return (
      <div className="p-4 italic text-gray-400 text-xs">
        Distractor analysis not available for this item type.
      </div>
    );
  }

  // Get discrimination data from the main item analysis
  const discriminationData = {
    D: item.discrimination,
    status: item.discStatus,
    recommendation: item.recommendation || "",
    Pu: item.Pu || "0.00",
    Pl: item.Pl || "0.00",
    upperGroupSize: item.upperGroupSize || 0,
    lowerGroupSize: item.lowerGroupSize || 0,
    upperCorrect: item.upperCorrect || 0,
    lowerCorrect: item.lowerCorrect || 0
  };

  // Function to determine distractor effectiveness
  const getDistractorEffectiveness = (percentage, isCorrect) => {
    if (isCorrect) {
      // For correct answer, check if it's attracting enough students
      if (percentage >= 40) return { label: "EFFECTIVE", color: "bg-green-100 text-green-700" };
      if (percentage >= 25) return { label: "ADEQUATE", color: "bg-blue-100 text-blue-700" };
      return { label: "WEAK", color: "bg-amber-100 text-amber-700" };
    } else {
      // For distractors (wrong answers)
      if (percentage == 0) return { label: "NON-FUNCTIONAL", color: "bg-gray-100 text-gray-600" };
      if (percentage <= 4) return { label: "QUESTIONABLE", color: "bg-orange-100 text-orange-700" };
      if (percentage >= 5) return { label: "FUNCTIONAL", color: "bg-purple-100 text-purple-700" };
      return { label: "FUNCTIONAL", color: "bg-purple-100 text-purple-700" };
    }
  };

  // Function to get discrimination effectiveness color
  const getDiscriminationEffectiveness = (status) => {
    switch (status) {
      case "Excellent":
        return { label: "EXCELLENT ITEM", color: "bg-emerald-100 text-emerald-700 border-emerald-200" };
      case "Good":
        return { label: "GOOD ITEM", color: "bg-green-100 text-green-700 border-green-200" };
      case "Marginal":
        return { label: "NEEDS REVISION", color: "bg-amber-100 text-amber-700 border-amber-200" };
      case "Poor":
        return { label: "WEAK ITEM", color: "bg-red-100 text-red-700 border-red-200" };
      case "Flawed":
        return { label: "PROBLEMATIC", color: "bg-purple-100 text-purple-700 border-purple-200" };
      default:
        return { label: "UNKNOWN", color: "bg-gray-100 text-gray-600 border-gray-200" };
    }
  };

  return (
    <div className="bg-white rounded-lg border p-4 shadow-sm">
      <h4 className="text-[10px] font-black uppercase text-gray-500 mb-4">
        Distractor Efficiency & Effectiveness
      </h4>

      {/* CTT Discrimination Index Display */}
      {discriminationData && (
        <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
          <h5 className="text-[9px] font-bold uppercase text-blue-800 mb-2">
            CTT Discrimination Index (D)
          </h5>
          <div className="grid grid-cols-2 gap-3 text-[10px]">
            <div>
              <span className="font-mono font-bold text-blue-700">D = {discriminationData.D}</span>
              <div className="text-gray-600 text-[9px] mt-1">
                Pu = {discriminationData.Pu} | Pl = {discriminationData.Pl}
              </div>
            </div>
            <div className="text-right">
              <span className={`inline-block px-2 py-1 rounded-full text-[8px] font-bold border ${getDiscriminationEffectiveness(discriminationData.status).color}`}>
                {getDiscriminationEffectiveness(discriminationData.status).label}
              </span>
              <div className="text-gray-600 text-[9px] mt-1">
                {discriminationData.recommendation}
              </div>
            </div>
          </div>
          <div className="text-[8px] text-gray-500 mt-2 grid grid-cols-2 gap-2">
            <div>Upper: {discriminationData.upperCorrect}/{discriminationData.upperGroupSize} correct</div>
            <div>Lower: {discriminationData.lowerCorrect}/{discriminationData.lowerGroupSize} correct</div>
          </div>
        </div>
      )}

      {item.distractorAnalysis.map((opt, i) => {
        const effectiveness = getDistractorEffectiveness(parseFloat(opt.percentage), opt.isCorrect);
        
        return (
          <div key={i} className="mb-3">
            <div className="flex justify-between items-start mb-1">
              <div className="flex-1">
                <span
                  className={`text-[11px] font-bold ${
                    opt.isCorrect ? "text-green-600" : "text-gray-700"
                  }`}
                >
                  {String.fromCharCode(65 + i)}: {opt.text}
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-600">
                    {opt.count} students ({opt.percentage}%)
                  </span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${effectiveness.color}`}
                  >
                    {effectiveness.label}
                  </span>
                </div>
              </div>
            </div>
            <div className="w-full bg-gray-100 h-1.5 rounded-full mt-1">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  opt.isCorrect ? "bg-green-500" : "bg-indigo-500"
                }`}
                style={{ width: `${opt.percentage}%` }}
              />
            </div>
            {opt.isCorrect && (
              <div className="text-[9px] text-gray-500 mt-1 italic">
                Correct answer should attract majority of responses
              </div>
            )}
            {!opt.isCorrect && (
              <div className="text-[9px] text-gray-500 mt-1 italic">
                {opt.percentage == 0 
                  ? "No students selected this option - may be too obvious"
                  : opt.percentage <= 4
                  ? "Very few students selected - may be weak distractor"
                  : "Good distractor - attracting some students"
                }
              </div>
            )}
          </div>
        );
      })}
      
      {/* Summary Section */}
      <div className="mt-4 pt-3 border-t border-gray-200">
        <h5 className="text-[9px] font-bold uppercase text-gray-600 mb-2">
          Effectiveness Legend:
        </h5>
        
        {/* CTT Discrimination Effectiveness */}
        {/* <div className="mb-3">
          <div className="text-[8px] font-bold text-gray-700 mb-1">CTT Discrimination (D):</div>
          <div className="space-y-1 text-[8px]">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold border border-emerald-200">EXCELLENT</span>
              <span className="text-gray-600">D &ge; 0.40 (Excellent item)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-bold border border-green-200">GOOD</span>
              <span className="text-gray-600">D 0.30-0.39 (Good item)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold border border-amber-200">MARGINAL</span>
              <span className="text-gray-600">D 0.20-0.29 (Needs improvement)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-bold border border-red-200">POOR</span>
              <span className="text-gray-600">D &lt; 0.19 (Failing to sort students)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-bold border border-purple-200">FLAWED</span>
              <span className="text-gray-600">D &lt; 0 (Low scorers got it right more)</span>
            </div>
          </div>
        </div> */}
        
        {/* Distractor Effectiveness */}
        <div>
          <div className="text-[8px] font-bold text-gray-700 mb-1">Distractor Effectiveness:</div>
          <div className="space-y-1 text-[8px]">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-bold">FUNCTIONAL</span>
              <span className="text-gray-600">Distractor: 5%+ (good distractor)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 font-bold">QUESTIONABLE</span>
              <span className="text-gray-600">Distractor: 1-4% (weak distractor)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 font-bold">NON-FUNCTIONAL</span>
              <span className="text-gray-600">Distractor: 0% (too obvious)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-bold">EFFECTIVE</span>
              <span className="text-gray-600">Correct: 40%+ (well-identified)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
