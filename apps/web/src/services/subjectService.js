import { supabase } from "../supabaseClient.js";

/**
 * Subject Service
 * Handles subject and instructor-subject-section relationship operations
 */

export const subjectService = {
  // ============ SUBJECT OPERATIONS ============

  /**
   * Get all subjects (independent of instructor)
   * @returns {Promise<{data, error}>}
   */
  getAllSubjects: async () => {
    return await supabase
      .from("subjects")
      .select("*")
      .eq("is_archived", false)
      .order("name", { ascending: true });
  },

  /**
   * Get subjects assigned to current instructor
   * @returns {Promise<{data, error}>}
   */
  getInstructorSubjects: async () => {
    return await supabase.rpc("get_instructor_subjects_with_sections");
  },

  /**
   * Create a new subject
   * @param {object} subjectData - Subject data (name, code, description, grade_level)
   * @returns {Promise<{data, error}>}
   */
  createSubject: async (subjectData) => {
    return await supabase.from("subjects").insert([subjectData]).select();
  },

  /**
   * Update a subject
   * @param {string} subjectId - Subject ID
   * @param {object} updates - Fields to update
   * @returns {Promise<{data, error}>}
   */
  updateSubject: async (subjectId, updates) => {
    return await supabase
      .from("subjects")
      .update(updates)
      .eq("id", subjectId)
      .select();
  },

  /**
   * Archive a subject
   * @param {string} subjectId - Subject ID
   * @returns {Promise<{error}>}
   */
  archiveSubject: async (subjectId) => {
    return await supabase
      .from("subjects")
      .update({ is_archived: true })
      .eq("id", subjectId);
  },

  // ============ INSTRUCTOR-SUBJECT OPERATIONS ============

  /**
   * Assign a subject to the current instructor
   * @param {string} subjectId - Subject ID
   * @param {string} instructorId - Optional instructor ID (defaults to current user)
   * @returns {Promise<{data, error}>}
   */
  assignSubjectToInstructor: async (subjectId, instructorId = null) => {
    return await supabase.rpc("assign_subject_to_instructor", {
      p_subject_id: subjectId,
      p_instructor_id: instructorId,
    });
  },

  /**
   * Remove subject assignment from instructor
   * @param {string} instructorSubjectId - Instructor-subject junction ID
   * @returns {Promise<{error}>}
   */
  removeInstructorSubject: async (instructorSubjectId) => {
    return await supabase
      .from("instructor_subjects")
      .delete()
      .eq("id", instructorSubjectId);
  },

  /**
   * Get instructor-subject assignments for current instructor
   * @returns {Promise<{data, error}>}
   */
  getInstructorSubjectAssignments: async () => {
    return await supabase
      .from("instructor_subjects")
      .select("*, subjects(*)")
      .eq("instructor_id", (await supabase.auth.getUser()).data.user.id);
  },

  // ============ SECTION ASSIGNMENT OPERATIONS ============

  /**
   * Assign sections to an instructor-subject combination
   * @param {string} instructorSubjectId - Instructor-subject junction ID
   * @param {string[]} sectionIds - Array of section IDs to assign
   * @returns {Promise<{data, error}>}
   */
  assignSectionsToInstructorSubject: async (instructorSubjectId, sectionIds) => {
    return await supabase.rpc("assign_sections_to_instructor_subject", {
      p_instructor_subject_id: instructorSubjectId,
      p_section_ids: sectionIds,
    });
  },

  /**
   * Remove section assignment from instructor-subject
   * @param {string} instructorSubjectId - Instructor-subject junction ID
   * @param {string} sectionId - Section ID to remove
   * @returns {Promise<{data, error}>}
   */
  removeSectionFromInstructorSubject: async (instructorSubjectId, sectionId) => {
    return await supabase.rpc("remove_section_from_instructor_subject", {
      p_instructor_subject_id: instructorSubjectId,
      p_section_id: sectionId,
    });
  },

  /**
   * Get sections assigned to an instructor-subject combination
   * @param {string} instructorSubjectId - Instructor-subject junction ID
   * @returns {Promise<{data, error}>}
   */
  getSectionsForInstructorSubject: async (instructorSubjectId) => {
    return await supabase
      .from("instructor_subject_sections")
      .select("*, sections(*)")
      .eq("instructor_subject_id", instructorSubjectId);
  },

  /**
   * Get all sections for current instructor
   * @returns {Promise<{data, error}>}
   */
  getInstructorSections: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return await supabase
      .from("sections")
      .select("*")
      .eq("instructor_id", user.id)
      .eq("is_archived", false)
      .order("name", { ascending: true });
  },

  // ============ ADMIN/SENIOR FACULTY OPERATIONS ============

  /**
   * Get all instructors with their profiles
   * @returns {Promise<{data, error}>}
   */
  getAllInstructors: async () => {
    return await supabase
      .from("profiles")
      .select("id, first_name, last_name, email, username")
      .eq("is_instructor", true)
      .order("last_name", { ascending: true });
  },

  /**
   * Get all instructor-subject assignments
   * @returns {Promise<{data, error}>}
   */
  getAllInstructorSubjectAssignments: async () => {
    return await supabase
      .from("instructor_subjects")
      .select("*, subjects(*), profiles(first_name, last_name, email)")
      .order("assigned_at", { ascending: false });
  },

  /**
   * Get instructors assigned to a specific subject
   * @param {string} subjectId - Subject ID
   * @returns {Promise<{data, error}>}
   */
  getInstructorsForSubject: async (subjectId) => {
    return await supabase
      .from("instructor_subjects")
      .select("*, profiles(first_name, last_name, email)")
      .eq("subject_id", subjectId);
  },

  // ============ GRADE LEVEL OPERATIONS ============

  /**
   * Get subjects by grade level
   * @param {string} gradeLevel - Grade level (1st, 2nd, 3rd, 4th)
   * @returns {Promise<{data, error}>}
   */
  getSubjectsByGradeLevel: async (gradeLevel) => {
    return await supabase.rpc("get_subjects_by_grade_level", {
      p_grade_level: gradeLevel,
    });
  },

  /**
   * Get all grade levels with subject counts
   * @returns {Promise<{data, error}>}
   */
  getGradeLevelsWithCounts: async () => {
    return await supabase.rpc("get_grade_levels_with_counts");
  },

  /**
   * Join a subject (assign current instructor to subject)
   * @param {string} subjectId - Subject ID
   * @returns {Promise<{data, error}>}
   */
  joinSubject: async (subjectId) => {
    return await supabase.rpc("join_subject", { p_subject_id: subjectId });
  },

  /**
   * Leave a subject (remove current instructor from subject)
   * @param {string} subjectId - Subject ID
   * @returns {Promise<{data, error}>}
   */
  leaveSubject: async (subjectId) => {
    return await supabase.rpc("leave_subject", { p_subject_id: subjectId });
  },

  // ============ SUBJECT REQUEST WORKFLOW OPERATIONS ============

  /**
   * Submit a new subject request (by Instructor or Senior Faculty)
   * Saves to subject_requests table and dispatches notifications
   */
  submitSubjectRequest: async ({
    subject_name,
    subject_code = null,
    grade_level = "1st",
    description = "",
    requested_by,
    requester_name = "Faculty Member",
    requester_email = null,
  }) => {
    let requestId = `req_${crypto.randomUUID()}`;
    const subjectNameTrimmed = subject_name.trim();

    // 1. Try RPC submit_subject_request first if available
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc(
        "submit_subject_request",
        {
          p_subject_name: subjectNameTrimmed,
          p_subject_code: subject_code?.trim() || null,
          p_grade_level: grade_level || "1st",
          p_description: description?.trim() || null,
        }
      );
      if (!rpcErr && rpcData?.success && rpcData?.request_id) {
        requestId = rpcData.request_id;
      }
    } catch (rpcEx) {
      console.warn("RPC submit_subject_request note:", rpcEx);
    }

    // 2. Direct insert into subject_requests table (only if user is instructor to prevent 403)
    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("is_instructor, is_admin")
        .eq("id", requested_by)
        .maybeSingle();

      if (prof?.is_instructor) {
        const { data: inserted, error: tableError } = await supabase
          .from("subject_requests")
          .insert([
            {
              subject_name: subjectNameTrimmed,
              subject_code: subject_code?.trim() || null,
              grade_level: grade_level || "1st",
              description: description?.trim() || null,
              requested_by: requested_by,
              request_status: "pending",
            },
          ])
          .select()
          .maybeSingle();

        if (!tableError && inserted?.id) {
          requestId = inserted.id;
        } else if (tableError) {
          console.warn("Direct subject_requests insert note:", tableError);
        }
      }
    } catch (e) {
      console.warn("Notice: subject_requests table insert note:", e);
    }

    const requestPayload = {
      id: requestId,
      subject_name: subjectNameTrimmed,
      subject_code: subject_code?.trim() || null,
      grade_level: grade_level || "1st",
      description: description?.trim() || "",
      requested_by: requested_by,
      requester_name: requester_name,
      requester_email: requester_email,
      request_status: "pending",
      created_at: new Date().toISOString(),
    };

    // 3. Broadcast notifications to Department Heads & Senior Faculty / Admins
    try {
      const { data: headsAndAdmins } = await supabase
        .from("profiles")
        .select("id, is_faculty_head, is_admin")
        .or("is_faculty_head.eq.true,is_admin.eq.true");

      const targetUserIds = new Set();
      (headsAndAdmins || []).forEach((u) => targetUserIds.add(u.id));

      for (const headId of targetUserIds) {
        try {
          await supabase.from("notifications").insert([
            {
              user_id: headId,
              title: `Subject Request: ${subjectNameTrimmed}`,
              message: JSON.stringify(requestPayload),
              type: "info",
              link: "/faculty-head-dashboard/subject-requests",
              is_read: false,
            },
          ]);
        } catch (singleErr) {
          console.warn("Failed to notify head:", headId, singleErr);
        }
      }

      // Self-tracking notification for requester
      if (requested_by) {
        try {
          await supabase.from("notifications").insert([
            {
              user_id: requested_by,
              title: `My Subject Request: ${subjectNameTrimmed}`,
              message: JSON.stringify(requestPayload),
              type: "info",
              link: "/faculty-head-dashboard/subject-requests",
              is_read: false,
            },
          ]);
        } catch (selfErr) {
          console.warn("Failed to insert self-tracking notification:", selfErr);
        }
      }
    } catch (notifErr) {
      console.warn("Could not insert notifications:", notifErr);
    }

    return { success: true, id: requestId, payload: requestPayload };
  },

  /**
   * Get all subject requests for Department Head / Admin review
   * Merges subject_requests table and notifications for resilience
   */
  getAllSubjectRequests: async () => {
    const listMap = new Map();

    // 1. Try fetching from subject_requests table (clean select without foreign key join bug)
    try {
      const { data: tableData, error: tableErr } = await supabase
        .from("subject_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (!tableErr && Array.isArray(tableData)) {
        // Collect requester IDs to fetch profile details in batch
        const requesterIds = [
          ...new Set(tableData.map((r) => r.requested_by).filter(Boolean)),
        ];
        const profilesMap = {};
        if (requesterIds.length > 0) {
          try {
            const { data: profs } = await supabase
              .from("profiles")
              .select("id, first_name, last_name, email, username")
              .in("id", requesterIds);

            (profs || []).forEach((p) => {
              profilesMap[p.id] = p;
            });
          } catch (pErr) {
            console.warn("Could not query profiles for requesters:", pErr);
          }
        }

        tableData.forEach((req) => {
          const prof = profilesMap[req.requested_by] || {};
          const reqName =
            `${prof.first_name || ""} ${prof.last_name || ""}`.trim() ||
            prof.username ||
            prof.email ||
            "Faculty Member";

          const key = req.id || `${req.subject_name}_${req.grade_level}`;
          listMap.set(key, {
            id: req.id,
            subject_name: req.subject_name,
            subject_code: req.subject_code || null,
            grade_level: req.grade_level || "1st",
            description: req.description || "",
            requested_by: req.requested_by,
            requester_name: reqName,
            requested_by_email: prof.email || null,
            request_status: (req.request_status || "pending").toLowerCase(),
            rejection_reason: req.rejection_reason || null,
            created_at: req.created_at,
            reviewed_at: req.reviewed_at || null,
            source: "table",
          });
        });
      } else if (tableErr) {
        console.warn("Could not query subject_requests table:", tableErr);
      }
    } catch (e) {
      console.warn("Could not query subject_requests table:", e);
    }

    // 2. Fetch from notifications table as secondary source / fallback
    try {
      const { data: notifs, error: notifErr } = await supabase
        .from("notifications")
        .select("*")
        .ilike("title", "Subject Request:%")
        .order("created_at", { ascending: false });

      if (!notifErr && Array.isArray(notifs)) {
        notifs.forEach((n) => {
          let parsed = {};
          try {
            parsed = JSON.parse(n.message);
          } catch (e) {
            parsed = {
              subject_name: n.title.replace("Subject Request:", "").trim(),
              description: n.message,
              request_status: "pending",
            };
          }

          const subjectName =
            parsed.subject_name ||
            n.title.replace("Subject Request:", "").trim();
          const reqId = parsed.id || n.id;
          const key = parsed.id || `${subjectName}_${parsed.grade_level || "1st"}`;

          if (!listMap.has(key)) {
            listMap.set(key, {
              notification_id: n.id,
              id: reqId,
              subject_name: subjectName,
              subject_code: parsed.subject_code || null,
              grade_level: parsed.grade_level || "1st",
              description:
                typeof parsed.description === "string" && !parsed.description.startsWith("{")
                  ? parsed.description.trim()
                  : "",
              requested_by: parsed.requested_by,
              requester_name: parsed.requester_name || "Faculty Member",
              requested_by_email: parsed.requester_email || null,
              request_status: (parsed.request_status || "pending").toLowerCase(),
              rejection_reason: parsed.rejection_reason || null,
              created_at: parsed.created_at || n.created_at,
              reviewed_at: parsed.reviewed_at || null,
              source: "notification",
            });
          }
        });
      }
    } catch (e) {
      console.warn("Could not query notifications:", e);
    }

    return { data: Array.from(listMap.values()), error: null };
  },

  /**
   * Get subject requests submitted by the current user
   */
  getMySubjectRequests: async (userId) => {
    if (!userId) return { data: [], error: null };

    const listMap = new Map();

    // 1. Query subject_requests table for this user
    try {
      const { data: tableData, error: tableErr } = await supabase
        .from("subject_requests")
        .select("*")
        .eq("requested_by", userId)
        .order("created_at", { ascending: false });

      if (!tableErr && Array.isArray(tableData)) {
        tableData.forEach((req) => {
          const key = req.id || `${req.subject_name}_${req.grade_level}`;
          listMap.set(key, {
            id: req.id,
            subject_name: req.subject_name,
            subject_code: req.subject_code || null,
            grade_level: req.grade_level || "1st",
            description: req.description || "",
            requested_by: req.requested_by,
            request_status: (req.request_status || "pending").toLowerCase(),
            rejection_reason: req.rejection_reason || null,
            created_at: req.created_at,
            reviewed_at: req.reviewed_at || null,
            source: "table",
          });
        });
      }
    } catch (e) {
      console.warn("Could not query subject_requests table for user:", e);
    }

    // 2. Query notifications for user's submitted requests
    try {
      const { data: notifs, error: notifErr } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .or(
          "title.ilike.My Subject Request:%,title.ilike.Subject Request Approved:%,title.ilike.Subject Request Rejected:%"
        )
        .order("created_at", { ascending: false });

      if (!notifErr && Array.isArray(notifs)) {
        notifs.forEach((n) => {
          let parsed = {};
          try {
            parsed = JSON.parse(n.message);
          } catch (e) {
            parsed = {};
          }

          const subjectName =
            parsed.subject_name ||
            n.title.replace(
              /^(My Subject Request:|Subject Request Approved:|Subject Request Rejected:)\s*/,
              ""
            ).trim();

          let status = (parsed.request_status || "pending").toLowerCase();
          if (n.title.startsWith("Subject Request Approved:")) status = "approved";
          if (n.title.startsWith("Subject Request Rejected:")) status = "rejected";

          const rawDesc = parsed.description;
          const cleanDesc =
            typeof rawDesc === "string" &&
            !rawDesc.trim().startsWith("{") &&
            !rawDesc.trim().startsWith('{"id"')
              ? rawDesc.trim()
              : "";

          const reqId = parsed.id || `${subjectName}_${parsed.grade_level || "1st"}`;
          if (!listMap.has(reqId)) {
            listMap.set(reqId, {
              id: reqId,
              subject_name: subjectName,
              subject_code: parsed.subject_code || null,
              grade_level: parsed.grade_level || "1st",
              description: cleanDesc,
              request_status: status,
              rejection_reason:
                parsed.rejection_reason ||
                (status === "rejected" && typeof n.message === "string" && !n.message.startsWith("{")
                  ? n.message.replace(/^Reason:\s*/i, "")
                  : null),
              created_at: parsed.created_at || n.created_at,
              reviewed_at: parsed.reviewed_at || (status !== "pending" ? n.created_at : null),
              source: "notification",
            });
          }
        });
      }
    } catch (e) {
      console.warn("Could not query user notifications:", e);
    }

    return { data: Array.from(listMap.values()), error: null };
  },

  /**
   * Get all approved curriculum subjects created by or assigned to an instructor
   * Used by InstructorDashboard to show approved subjects even with 0 sections
   */
  getInstructorApprovedSubjects: async (instructorId) => {
    if (!instructorId) return { data: [], error: null };

    const subjectMap = new Map();

    try {
      // 1. Fetch approved subjects created by this instructor
      const { data: createdSubs, error: createdErr } = await supabase
        .from("subjects")
        .select("*")
        .eq("created_by", instructorId)
        .eq("status", "approved")
        .eq("is_archived", false)
        .order("name", { ascending: true });

      if (!createdErr && Array.isArray(createdSubs)) {
        createdSubs.forEach((s) => {
          subjectMap.set(s.id, s);
        });
      }

      // 2. Fetch approved subjects assigned to this instructor via instructor_subjects junction
      const { data: assignedSubs, error: assignedErr } = await supabase
        .from("instructor_subjects")
        .select("subject_id, subjects(*)")
        .eq("instructor_id", instructorId);

      if (!assignedErr && Array.isArray(assignedSubs)) {
        assignedSubs.forEach((item) => {
          if (
            item.subjects &&
            item.subjects.status === "approved" &&
            !item.subjects.is_archived
          ) {
            subjectMap.set(item.subjects.id, item.subjects);
          }
        });
      }
    } catch (e) {
      console.warn("Could not fetch instructor approved subjects:", e);
    }

    return { data: Array.from(subjectMap.values()), error: null };
  },

  /**
   * Approve a subject request (Department Head)
   */
  approveSubjectRequest: async (requestId, targetReq, reviewerId) => {
    let approvedViaRpc = false;
    let createdSubject = null;

    // 1. Try RPC approve_subject_request first if this is a table UUID
    if (requestId && typeof requestId === "string" && !requestId.startsWith("req_")) {
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc(
          "approve_subject_request",
          { p_request_id: requestId }
        );
        if (!rpcErr && rpcData?.success) {
          approvedViaRpc = true;
          if (rpcData.subject_id) {
            createdSubject = { id: rpcData.subject_id, name: targetReq.subject_name };
          }
        }
      } catch (e) {
        console.warn("approve_subject_request RPC note:", e);
      }
    }

    // 2. If not approved via RPC, perform direct database operations
    if (!approvedViaRpc) {
      // 2a. Insert into subjects table (NO instructor_id column!)
      const { data: newSubData, error: insertSubErr } = await supabase
        .from("subjects")
        .insert([
          {
            name: targetReq.subject_name,
            code: targetReq.subject_code || null,
            grade_level: targetReq.grade_level || "1st",
            description: targetReq.description || null,
            status: "approved",
            created_by: targetReq.requested_by || reviewerId,
            approved_by: reviewerId,
            approved_at: new Date().toISOString(),
            is_archived: false,
          },
        ])
        .select();

      if (insertSubErr) throw insertSubErr;
      createdSubject = newSubData?.[0];

      // 2b. Assign requesting instructor in instructor_subjects junction
      if (createdSubject?.id && targetReq.requested_by) {
        try {
          await supabase.from("instructor_subjects").insert([
            {
              instructor_id: targetReq.requested_by,
              subject_id: createdSubject.id,
            },
          ]);
        } catch (assignErr) {
          console.warn("Instructor assignment note:", assignErr);
        }
      }

      // 2c. Update subject_requests table row if valid UUID
      if (requestId && !requestId.startsWith("req_")) {
        try {
          await supabase
            .from("subject_requests")
            .update({
              request_status: "approved",
              reviewed_by: reviewerId,
              reviewed_at: new Date().toISOString(),
            })
            .eq("id", requestId);
        } catch (e) {
          console.warn("Could not update subject_requests row:", e);
        }
      }
    }

    // 3. Update notification records
    const updatedPayload = {
      ...targetReq,
      request_status: "approved",
      reviewed_at: new Date().toISOString(),
    };

    if (targetReq.notification_id) {
      try {
        await supabase
          .from("notifications")
          .update({
            message: JSON.stringify(updatedPayload),
            is_read: true,
          })
          .eq("id", targetReq.notification_id);
      } catch (e) {}
    }

    // 4. Send approval notification to requesting instructor
    if (targetReq.requested_by) {
      try {
        await supabase.from("notifications").insert([
          {
            user_id: targetReq.requested_by,
            title: `Subject Request Approved: ${targetReq.subject_name}`,
            message: JSON.stringify(updatedPayload),
            type: "success",
            link: "/instructor-dashboard",
            is_read: false,
          },
        ]);
      } catch (e) {}
    }

    return { success: true, subject: createdSubject };
  },

  /**
   * Reject a subject request (Department Head)
   */
  rejectSubjectRequest: async (requestId, targetReq, reason, reviewerId) => {
    const updatedPayload = {
      ...targetReq,
      request_status: "rejected",
      rejection_reason: reason.trim(),
      reviewed_at: new Date().toISOString(),
    };

    // 1. Try RPC approve_subject_request with rejection reason
    let rejectedViaRpc = false;
    if (requestId && typeof requestId === "string" && !requestId.startsWith("req_")) {
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc(
          "approve_subject_request",
          {
            p_request_id: requestId,
            p_rejection_reason: reason.trim(),
          }
        );
        if (!rpcErr && rpcData?.success) {
          rejectedViaRpc = true;
        }
      } catch (e) {
        console.warn("reject via approve_subject_request RPC note:", e);
      }
    }

    // 2. If not rejected via RPC, perform direct table update
    if (!rejectedViaRpc && requestId && !requestId.startsWith("req_")) {
      try {
        await supabase
          .from("subject_requests")
          .update({
            request_status: "rejected",
            rejection_reason: reason.trim(),
            reviewed_by: reviewerId,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", requestId);
      } catch (e) {
        console.warn("Could not update subject_requests row:", e);
      }
    }

    // 3. Update notification record
    if (targetReq.notification_id) {
      try {
        await supabase
          .from("notifications")
          .update({
            message: JSON.stringify(updatedPayload),
            is_read: true,
          })
          .eq("id", targetReq.notification_id);
      } catch (e) {}
    }

    // 4. Send rejection notification to requesting instructor
    if (targetReq.requested_by) {
      try {
        await supabase.from("notifications").insert([
          {
            user_id: targetReq.requested_by,
            title: `Subject Request Rejected: ${targetReq.subject_name}`,
            message: JSON.stringify(updatedPayload),
            type: "error",
            link: "/instructor-dashboard",
            is_read: false,
          },
        ]);
      } catch (e) {}
    }

    return { success: true };
  },

  /**
   * Directly create a subject (by Department Head)
   */
  createDirectSubject: async ({
    subject_name,
    subject_code = null,
    grade_level = "1st",
    description = null,
    creatorId,
  }) => {
    // Note: subjects table has no instructor_id column, uses created_by & approved_by
    const { data, error } = await supabase
      .from("subjects")
      .insert([
        {
          name: subject_name.trim(),
          code: subject_code?.trim() || null,
          grade_level: grade_level || "1st",
          description: description?.trim() || null,
          status: "approved",
          created_by: creatorId,
          approved_by: creatorId,
          approved_at: new Date().toISOString(),
          is_archived: false,
        },
      ])
      .select();

    if (error) throw error;
    return { data, error: null };
  },
};
