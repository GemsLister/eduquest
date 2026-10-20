export const NotFoundPage = () => (
  <div className="flex flex-col items-center justify-center h-screen bg-brand-navy text-white gap-6">
    <div className="text-8xl font-bold text-brand-gold">404</div>
    <h1 className="text-2xl font-semibold">Page Not Found</h1>
    <p className="text-sm text-gray-400 max-w-xs text-center">
      The page you are looking for does not exist or has been moved.
    </p>
    <a
      href="/"
      className="mt-2 px-6 py-2.5 bg-brand-gold text-brand-navy font-semibold rounded-lg hover:bg-yellow-400 transition-colors"
    >
      Back to Login
    </a>
  </div>
);
