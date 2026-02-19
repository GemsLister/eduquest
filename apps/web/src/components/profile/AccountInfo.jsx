export const AccountInfo = ({ profileEmail }) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-4 md:p-8 mb-6">
      <h3 className="text-lg md:text-xl font-bold text-hornblende-green mb-6">
        Account Information
      </h3>

      <div className="space-y-4">
        {[
          { label: "Email", text: profileEmail  },
          { label: "Role", text: "Instructor" },
        ].map((info, index) => (
          <div
            key={index}
            className="flex flex-col md:flex-row md:justify-between md:items-center p-4 bg-gray-50 rounded-lg"
          >
            <div>
              <p className="text-sm font-semibold text-gray-700">
                {info.label}
              </p>
              <p className="text-gray-600 break-all">{info.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
