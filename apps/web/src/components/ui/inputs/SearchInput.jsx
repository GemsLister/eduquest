export const SearchInput = ({ searchTerm, setSearchTerm, setFilterType, setFilterFlag }) => {
  return (
    <div className="flex flex-wrap gap-4 mb-6">
      {/* Search Input */}
      <div className="relative flex-1 min-w-[200px]">
        <input
          type="text"
          placeholder="Search questions..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold focus:ring-opacity-20"
        />
        <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
          🔍
        </span>
        {searchTerm && (
          <button
            onClick={() => setSearchTerm("")}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        )}
      </div>

      {/* Filter by Type */}
      {setFilterType && (
        <select
          onChange={(e) => setFilterType(e.target.value)}
          className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-gold bg-white"
        >
          <option value="all">All Types</option>
          <option value="mcq">Multiple Choice</option>
          <option value="true_false">True/False</option>
          <option value="short_answer">Short Answer</option>
        </select>
      )}

      {/* Filter by Flag */}
      {setFilterFlag && (
        <select
          onChange={(e) => setFilterFlag(e.target.value)}
          className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-gold bg-white"
        >
          <option value="all">All Flags</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="retain">Retain</option>
          <option value="needs_revision">Needs Revision</option>
          <option value="discard">Discard</option>
        </select>
      )}
    </div>
  );
};
