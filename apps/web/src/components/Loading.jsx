export const Loading = ({ isLoading }) => {
  if (!isLoading) return null;
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-casual-green"></div>
        <p className="mt-4 text-hornblende-green font-semibold">Loading...</p>
      </div>
    </div>
  );
};
