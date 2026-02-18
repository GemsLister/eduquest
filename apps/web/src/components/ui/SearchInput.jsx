export const SearchInput = ({type, value, onChange}) => {
  return (
    <div className="flex-1 flex justify-between">
      <div className="relative">
        <input
          type={type}
          placeholder="e.g. T16"
          value={value}
          onChange={onChange}
          className="px-4 py-3 pl-12 border border-gray-300 rounded-lg focus:outline-none focus:border-casual-green focus:ring-2 focus:ring-casual-green focus:ring-opacity-20"
        />
        <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
          🔍
        </span>
        {onChange && (
          <button
            onClick={() => onChange("")}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
};