export const ContentContainer = ({ children }) => {
  return (
    <main className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 p-6">
      {children}
    </main>
  );
};
