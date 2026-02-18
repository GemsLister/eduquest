import { useLogout } from "../../hooks/useLogout.jsx";

export const SecuritySettings = () => {
  const { handleLogout } = useLogout();
  return (
    <div className="bg-white rounded-lg shadow-md md:p-8">
      <h3 className="text-lg md:text-xl font-bold text-hornblende-green mb-6">
        Security
      </h3>

      <div className="space-y-4">
        <p className="text-gray-600 mb-4 text-sm md:text-base">
          For your account security, you can change your password or manage your
          account settings.
        </p>

        <button className=" bg-gray-100 text-gray-800 border-2 border-gray-300 px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors">
          Change Password
        </button>

        <button
          type="button"
          onClick={handleLogout}
          className=" bg-red-100 text-red-800 border-2 border-red-300 px-6 py-3 rounded-lg font-semibold hover:bg-red-200 transition-colors"
        >
          Logout
        </button>
      </div>
    </div>
  );
};
