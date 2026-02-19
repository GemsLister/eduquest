export const SectionContainer = ({ children }) => {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group">
      {children}
    </div>
  );
};
