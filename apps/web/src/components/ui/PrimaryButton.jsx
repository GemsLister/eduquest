export const PrimaryButton = ({ children, ...props }) => {
  return (
    <button
      {...props}
      className="flex-1 bg-casual-green text-white px-6 py-3 rounded-lg font-semibold hover:bg-hornblende-green transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
};
