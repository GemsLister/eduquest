import { useNavigate } from "react-router-dom";

export const ClassInfo = ({ sectionId, sectionName, examCode, subject }) => {
  const navigate = useNavigate();
  return (
    <div>
      {/* Class Header */}
      <div className="h-20 md:h-24 bg-gradient-to-r from-casual-green to-hornblende-green group-hover:opacity-90 transition-opacity flex items-center justify-center">
        <div className="text-white text-center">
          <h1 className="md:text-2xl  font-bold">Section: {sectionName}</h1>
        </div>
      </div>
      {/* Class Info */}
      <div className="p-4 text-gray-600">
        <div className="flex flex-col gap-2 mb-4">
          {[
            {
              label: "Exam Code: ",
              text: examCode,
            },
            {
              label: "Subject: ",
              text: subject,
            },
          ].map((field, index) => (
            <div key={index} className="flex gap-1.5 text-sm">
              <label className="font-bold">{field.label}</label>
              <p>{field.text}</p>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="flex gap-4 text-sm text-gray-600 mb-4 py-3 border-t border-gray-200 pt-3">
          <div>
            <div className="text-xs text-gray-500">Quizzes</div>
            <div className="font-semibold text-gray-800">
              {sectionId?.length || 0}
            </div>
          </div>
        </div>

        {/* Actions */}
        <button
          onClick={() => navigate(`/instructor-dashboard/section/${sectionId}`)}
          className="w-full bg-casual-green text-white py-2 rounded font-semibold text-sm md:text-base hover:bg-hornblende-green transition-colors"
        >
          View Class
        </button>
      </div>
    </div>
  );
};
