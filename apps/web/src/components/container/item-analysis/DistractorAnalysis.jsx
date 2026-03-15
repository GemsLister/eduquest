export const DistractorAnalysis = ({ item }) => {
  if (!item?.distractorAnalysis?.length) {
    return (
      <div className="p-4 italic text-gray-400 text-xs">
        Distractor analysis not available for this item type.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border p-4 shadow-sm">
      <h4 className="text-[10px] font-black uppercase text-gray-500 mb-4">
        Distractor Efficiency
      </h4>
      {item.distractorAnalysis.map((opt, i) => (
        <div key={i} className="mb-3">
          <div className="flex justify-between text-[11px] font-bold">
            <span
              className={opt.isCorrect ? "text-green-600" : "text-gray-700"}
            >
              {String.fromCharCode(65 + i)}: {opt.text}
            </span>
<span>{opt.count} students ({opt.percentage}%)</span>
          </div>
          <div className="w-full bg-gray-100 h-1.5 rounded-full mt-1">
            <div
              className={`h-full rounded-full ${opt.isCorrect ? "bg-green-500" : "bg-indigo-500"}`}
              style={{ width: `${opt.percentage}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};
