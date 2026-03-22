export const PrimaryButton = ({ children, ...props }) => {
  return (
    <button
      {...props}
      className="flex-1 bg-brand-gold text-brand-navy px-6 py-3 rounded-lg font-semibold hover:bg-brand-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
};
