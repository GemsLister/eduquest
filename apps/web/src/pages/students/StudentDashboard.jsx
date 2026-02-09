export const StudentDashboard = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md text-center">
        <div className="text-4xl mb-4">📚</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          Student Portal
        </h1>
        <p className="text-gray-600 mb-6">
          To take a quiz, please use the link provided by your instructor or
          enter the quiz code.
        </p>
        <div className="bg-blue-50 p-4 rounded-lg text-sm text-gray-700">
          <p className="mb-3">
            <strong>How to access a quiz:</strong>
          </p>
          <ol className="text-left space-y-2 list-decimal list-inside">
            <li>Ask your instructor for the quiz link</li>
            <li>Click the link or enter the quiz code</li>
            <li>Enter your name and email</li>
            <li>Complete the quiz</li>
          </ol>
        </div>
      </div>
    </div>
  );
};
