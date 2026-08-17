import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

export const QuizStatusHistory = ({ quizId, quizTitle }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isOpen && quizId) {
      fetchHistory();
    }
  }, [isOpen, quizId]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc("get_quiz_status_history", {
        p_quiz_id: quizId,
      });

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error("Error fetching quiz status history:", error);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status) => {
    const config = {
      draft: { bg: "bg-gray-100 text-gray-700", label: "Draft" },
      submitted_for_review: { bg: "bg-amber-100 text-amber-700", label: "Submitted for Review" },
      approved: { bg: "bg-emerald-100 text-emerald-700", label: "Approved" },
      rejected: { bg: "bg-red-100 text-red-700", label: "Rejected" },
      scheduled: { bg: "bg-blue-100 text-blue-700", label: "Scheduled" },
      published: { bg: "bg-green-100 text-green-700", label: "Published" },
      ongoing: { bg: "bg-purple-100 text-purple-700", label: "Ongoing" },
      completed: { bg: "bg-indigo-100 text-indigo-700", label: "Completed" },
      archived: { bg: "bg-gray-200 text-gray-600", label: "Archived" },
    };
    const c = config[status] || { bg: "bg-gray-100 text-gray-600", label: status };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${c.bg}`}>
        {c.label}
      </span>
    );
  };

  const getRoleBadge = (role) => {
    const config = {
      admin: { bg: "bg-purple-100 text-purple-700", label: "Admin" },
      faculty_head: { bg: "bg-blue-100 text-blue-700", label: "Department Head" },
      instructor: { bg: "bg-green-100 text-green-700", label: "Instructor" },
    };
    const c = config[role] || { bg: "bg-gray-100 text-gray-600", label: role };
    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c.bg}`}>
        {c.label}
      </span>
    );
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        Status History
      </button>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div>
          <h3 className="font-bold text-gray-800">Status History</h3>
          {quizTitle && (
            <p className="text-xs text-gray-500 mt-0.5">{quizTitle}</p>
          )}
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-gold"></div>
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            No status history available
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((item, index) => (
              <div key={item.history_id} className="relative pl-6 pb-4">
                {index !== history.length - 1 && (
                  <div className="absolute left-2 top-8 bottom-0 w-0.5 bg-gray-200"></div>
                )}
                <div className="absolute left-0 top-1 w-4 h-4 rounded-full bg-brand-navy border-4 border-white shadow"></div>
                
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusBadge(item.new_status)}
                      {item.previous_status && (
                        <span className="text-xs text-gray-400">
                          from {getStatusBadge(item.previous_status)}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs text-gray-600 mt-1">
                      <span className="font-semibold">
                        {item.changed_by_name || "Unknown User"}
                      </span>
                      {getRoleBadge(item.changed_by_role)}
                    </div>
                    
                    {item.reason && (
                      <p className="text-xs text-gray-500 mt-2 italic">
                        "{item.reason}"
                      </p>
                    )}
                  </div>
                  
                  <span className="text-xs text-gray-400 font-mono whitespace-nowrap">
                    {formatDate(item.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
