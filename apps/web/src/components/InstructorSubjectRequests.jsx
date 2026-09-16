import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext.jsx";

export const InstructorSubjectRequests = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyRequests();
    window.addEventListener("subject-requests-changed", fetchMyRequests);
    window.addEventListener("pending-subject-requests-changed", fetchMyRequests);
    return () => {
      window.removeEventListener("subject-requests-changed", fetchMyRequests);
      window.removeEventListener("pending-subject-requests-changed", fetchMyRequests);
    };
  }, [user]);

  const fetchMyRequests = async () => {
    if (!user?.id) {
      setRequests([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      let list = [];

      // Query notifications table for user's submitted requests and updates
      try {
        const { data: notifs, error } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", user.id)
          .or("title.ilike.My Subject Request:%,title.ilike.Subject Request Approved:%,title.ilike.Subject Request Rejected:%")
          .order("created_at", { ascending: false });

        if (!error && notifs) {
          const map = new Map();

          notifs.forEach((n) => {
            let parsed = {};
            try {
              parsed = JSON.parse(n.message);
            } catch (e) {
              parsed = {};
            }

            const subjectName =
              parsed.subject_name ||
              n.title.replace(/^(My Subject Request:|Subject Request Approved:|Subject Request Rejected:)\s*/, "").trim();

            const reqId = parsed.id || subjectName;

            let status = (parsed.request_status || "pending").toLowerCase();
            if (n.title.startsWith("Subject Request Approved:")) status = "approved";
            if (n.title.startsWith("Subject Request Rejected:")) status = "rejected";

            // If not in map or newer update
            if (!map.has(reqId)) {
              map.set(reqId, {
                id: reqId,
                subject_name: subjectName,
                subject_code: parsed.subject_code || null,
                grade_level: parsed.grade_level || "1st",
                description: parsed.description || (status === "rejected" ? "" : n.message),
                request_status: status,
                rejection_reason: parsed.rejection_reason || (status === "rejected" ? n.message.replace(/^Reason:\s*/i, "") : null),
                created_at: parsed.created_at || n.created_at,
                reviewed_at: parsed.reviewed_at || (status !== "pending" ? n.created_at : null),
              });
            }
          });

          list = Array.from(map.values());
        }
      } catch (e) {
        console.warn("Could not query notifications:", e);
      }

      setRequests(list);
    } catch (err) {
      console.error("Error fetching my subject requests:", err);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const s = (status || "").toLowerCase();
    if (s === "approved") {
      return (
        <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wide">
          Approved
        </span>
      );
    }
    if (s === "rejected") {
      return (
        <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wide">
          Rejected
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wide">
        Pending Review
      </span>
    );
  };

  const getGradeLabel = (gradeLevel) => {
    const labels = {
      "1st": "1st Year",
      "2nd": "2nd Year",
      "3rd": "3rd Year",
      "4th": "4th Year",
    };
    return labels[gradeLevel] || gradeLevel;
  };

  // If loading or there are no active requests, render nothing so the UI is completely clean
  if (loading || requests.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
      <div className="px-6 py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
        <h3 className="font-bold text-sm text-brand-navy flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-brand-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>My Subject Requests</span>
        </h3>
        <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-brand-navy text-white">
          {requests.length}
        </span>
      </div>

      <div className="divide-y divide-slate-100">
        {requests.map((request) => (
          <div key={request.id} className="p-4 hover:bg-slate-50 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-slate-800">
                    {request.subject_name}
                  </h4>
                  {request.subject_code && (
                    <span className="text-xs font-mono font-medium text-slate-500">
                      ({request.subject_code})
                    </span>
                  )}
                  {getStatusBadge(request.request_status)}
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                  {request.grade_level && (
                    <>
                      <span>{getGradeLabel(request.grade_level)}</span>
                      <span>•</span>
                    </>
                  )}
                  <span>Requested: {new Date(request.created_at).toLocaleDateString()}</span>
                  {request.reviewed_at && (
                    <>
                      <span>•</span>
                      <span>Reviewed: {new Date(request.reviewed_at).toLocaleDateString()}</span>
                    </>
                  )}
                </div>

                {request.description && (
                  <p className="text-xs text-slate-600">
                    {request.description}
                  </p>
                )}

                {request.rejection_reason && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 mt-2">
                    <p className="text-xs text-rose-800">
                      <strong className="font-bold uppercase text-[10px] block mb-0.5">Rejection Feedback:</strong>
                      {request.rejection_reason}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};