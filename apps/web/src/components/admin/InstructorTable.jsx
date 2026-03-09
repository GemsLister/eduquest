export const InstructorTable = ({ instructors, deleteLoading, onDelete }) => {
  if (instructors.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-4xl mb-3">👥</p>
        <p className="font-semibold text-lg">No instructors yet</p>
        <p className="text-sm mt-1">
          Create one using the &quot;Create Instructor&quot; page.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
      <table className="w-full text-sm text-left">
        <thead className="bg-hornblende-green text-white">
          <tr>
            <th className="px-5 py-4 font-semibold">Name</th>
            <th className="px-5 py-4 font-semibold">Username</th>
            <th className="px-5 py-4 font-semibold">Email</th>
            <th className="px-5 py-4 font-semibold">Date Created</th>
            <th className="px-5 py-4 font-semibold text-center">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {instructors.map((instructor) => {
            const fullName =
              instructor.first_name || instructor.last_name
                ? `${instructor.first_name || ""} ${instructor.last_name || ""}`.trim()
                : "—";
            const createdAt = instructor.created_at
              ? new Date(instructor.created_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })
              : "—";

            return (
              <tr
                key={instructor.id}
                className="hover:bg-gray-50 transition-colors"
              >
                <td className="px-5 py-4 font-medium text-gray-800">
                  {fullName}
                </td>
                <td className="px-5 py-4 text-gray-600">
                  {instructor.username || "—"}
                </td>
                <td className="px-5 py-4 text-gray-600">
                  {instructor.email || "—"}
                </td>
                <td className="px-5 py-4 text-gray-500">{createdAt}</td>
                <td className="px-5 py-4 text-center">
                  <button
                    onClick={() => onDelete(instructor.id)}
                    disabled={deleteLoading === instructor.id}
                    className="px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleteLoading === instructor.id ? "Deleting..." : "Delete"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
