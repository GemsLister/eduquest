export const EmptyClassSection = ({ title, icon }) => {
  return (
    <div className="bg-white rounded-lg p-8 md:p-12 text-center shadow-sm border border-gray-200">
      <div className="text-4xl md:text-6xl mb-4">{icon}</div>
      <h3 className="text-lg md:text-xl font-semibold text-gray-700 mb-2">
        {title}
      </h3>
      <p className="text-sm md:text-base text-gray-500">
        Create your first subject to get started!
      </p>
    </div>
  );
};
