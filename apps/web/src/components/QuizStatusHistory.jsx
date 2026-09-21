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
      draft: { bg: "bg-slate-100 text-slate-700 border border-slate-200", label: "Draft" },
      submitted_for_review: { bg: "bg-amber-50 text-amber-700 border border-amber-200", label: "Submitted for Review" },
      approved: { bg: "bg-emerald-50 text-emerald-700 border border-emerald-200", label: "Approved" },
      rejected: { bg: "bg-rose-50 text-rose-700 border border-rose-200", label: "Rejected" },
      scheduled: { bg: "bg-sky-50 text-sky-700 border border-sky-200", label: "Scheduled" },
      published: { bg: "bg-emerald-50 text-emerald-700 border border-emerald-200", label: "Published" },
      ongoing: { bg: "bg-purple-50 text-purple-700 border border-purple-200", label: "Ongoing" },
      completed: { bg: "bg-indigo-50 text-indigo-700 border border-indigo-200", label: "Completed" },
      archived: { bg: "bg-slate-100 text-slate-600 border border-slate-200", label: "Archived" },
    };
    const c = config[status] || { bg: "bg-slate-100 text-slate-600 border border-slate-200", label: status };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${c.bg}`}>
        {c.label}
      </span>
    );
  };

  const getRoleBadge = (role) => {
    const config = {
      admin: { bg: "bg-purple-50 text-purple-700 border border-purple-200", label: "Admin" },
      faculty_head: { bg: "bg-sky-50 text-sky-700 border border-sky-200", label: "Department Head" },
      senior_faculty: { bg: "bg-amber-50 text-amber-700 border border-amber-200", label: "Senior Faculty" },
      instructor: { bg: "bg-emerald-50 text-emerald-700 border border-emerald-200", label: "Instructor" },
    };
    const c = config[role] || { bg: "bg-slate-100 text-slate-600 border border-slate-200", label: role };
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
        className="flex items-center gap-2 px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-brand-navy transition-all shadow-2xs"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 text-brand-navy"
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
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="flex items-center justify-between p-4 bg-slate-50/70 border-b border-slate-200">
        <div>
          <h3 className="font-bold text-sm text-brand-navy">Status History</h3>
          {quizTitle && (
            <p className="text-xs text-slate-500 mt-0.5 font-medium">{quizTitle}</p>
          )}
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/50 transition-colors"
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
          <div className="text-center py-8 text-slate-500 text-xs font-medium">
            No status history available
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((item, index) => (
              <div key={item.history_id} className="relative pl-6 pb-4">
                {index !== history.length - 1 && (
                  <div className="absolute left-2 top-8 bottom-0 w-0.5 bg-slate-200"></div>
                )}
                <div className="absolute left-0 top-1 w-4 h-4 rounded-full bg-brand-navy border-4 border-white shadow-xs"></div>
                
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusBadge(item.new_status)}
                      {item.previous_status && (
                        <span className="text-xs text-slate-400 font-medium">
                          from {getStatusBadge(item.previous_status)}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs text-slate-600 mt-1">
                      <span className="font-bold text-slate-800">
                        {item.changed_by_name || "Unknown User"}
                      </span>
                      {getRoleBadge(item.changed_by_role)}
                    </div>
                    
                    {item.reason && (
                      <div className="bg-amber-50/80 border-l-2 border-amber-400 p-2.5 rounded-r-xl mt-2">
                        <p className="text-xs text-amber-950 italic">
                          "{item.reason}"
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <span className="text-xs text-slate-400 font-mono whitespace-nowrap">
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
