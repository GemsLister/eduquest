import { useState, useEffect, useCallback } from "react";
import { notify } from "../../utils/notify.jsx";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../context/AuthContext";
import { fetchQuizQuestionCount } from "../../services/quizService.js";

const isMissingTableError = (error) => {
  if (!error) return false;
  const msg = (error.message || "").toLowerCase();
  const code = error.code || "";
  return (
    code === "42P01" ||
    msg.includes("could not find the table") ||
    msg.includes("does not exist") ||
    (msg.includes("relation") && msg.includes("does not exist"))
  );
};

export const useFetchInstructorQuizzes = () => {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);

  const generateShareToken = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let token = "";
    for (let i = 0; i < 12; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  };

  const getUniqueShareToken = async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateShareToken();
      const { data, error } = await supabase
        .from("quizzes")
        .select("id")
        .eq("share_token", candidate)
        .maybeSingle();

      if (error) throw error;
      if (!data) return candidate;
    }

    throw new Error("Failed to generate a unique share token");
  };

  const fetchQuizzes = useCallback(async () => {
    if (!user) return;
    try {
      // 1. Fetch instructor's section IDs
      const { data: mySections } = await supabase
        .from("sections")
        .select("id")
        .eq("instructor_id", user.id);
      const mySectionIds = (mySections || []).map((s) => s.id).filter(Boolean);

      // 2. Fetch quiz IDs assigned to instructor's sections via quiz_sections junction
      let sectionQuizIds = [];
      if (mySectionIds.length > 0) {
        const { data: qSecs } = await supabase
          .from("quiz_sections")
          .select("quiz_id")
          .in("section_id", mySectionIds);
        sectionQuizIds = (qSecs || []).map((qs) => qs.quiz_id).filter(Boolean);
      }

      // 3. Fetch submissions by instructor
      let submissions = [];
      try {
        const { data: subData, error: submissionsError } = await supabase
          .from("quiz_analysis_submissions")
          .select("quiz_id, status, admin_feedback, analysis_results, created_at")
          .eq("instructor_id", user.id)
          .order("created_at", { ascending: false });

        if (!submissionsError && subData) {
          submissions = subData;
        }
      } catch (subErr) {
        console.warn("Could not fetch quiz_analysis_submissions:", subErr);
      }

      const submissionQuizIds = (submissions || []).map((s) => s.quiz_id).filter(Boolean);

      // Combine section & submission candidate quiz IDs
      const candidateQuizIds = Array.from(new Set([...sectionQuizIds, ...submissionQuizIds]));

      // 4. Fetch quizzes directly without foreign key embedded join requirements
      let rawQuizzes = [];
      try {
        // Fetch user's own quizzes directly (primary)
        const { data: myQuizzes, error: myErr } = await supabase
          .from("quizzes")
          .select("*")
          .eq("instructor_id", user.id)
          .order("created_at", { ascending: false });

        if (myErr) console.error("Error fetching instructor quizzes:", myErr);

        rawQuizzes = myQuizzes || [];
      } catch (quizErr) {
        console.error("Error loading rawQuizzes:", quizErr);
      }

      // Fetch profiles for instructors in a separate, robust query
      const instructorIds = Array.from(
        new Set((rawQuizzes || []).map((q) => q.instructor_id).filter(Boolean))
      );

      const profileMap = new Map();
      if (instructorIds.length > 0) {
        try {
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("id, first_name, last_name, username, email")
            .in("id", instructorIds);

          if (profilesData) {
            profilesData.forEach((p) => {
              profileMap.set(p.id, p);
            });
          }
        } catch (pErr) {
          console.warn("Could not fetch profiles:", pErr);
        }
      }

      const data = (rawQuizzes || []).map((q) => {
        const rawDesc = q.description || "";
        const visMatch = rawDesc.match(/\[vis:(private|shared|public)\]/i);
        const resolvedVis = visMatch
          ? visMatch[1].toLowerCase()
          : (q.visibility ? q.visibility : (q.is_shared ? "shared" : (q.is_private !== false ? "private" : "public")));
        const cleanDesc = rawDesc.replace(/\s*\[vis:(private|shared|public)\]\s*/gi, "").trim();

        const profile = profileMap.get(q.instructor_id);
        const ownerFirstName = profile?.first_name || "";
        const ownerLastName = profile?.last_name || "";
        const fullName = `${ownerFirstName} ${ownerLastName}`.trim();
        const fallbackName = profile?.username || profile?.email || "Instructor";
        return {
          ...q,
          description: cleanDesc,
          visibility: resolvedVis,
          is_shared: resolvedVis === "shared",
          is_private: resolvedVis === "private",
          profiles: profile,
          owner_id: q.instructor_id,
          owner_name: fullName || fallbackName,
          is_archived: Boolean(q.is_archived),
        };
      });

      const maxVersionByRoot = new Map();
      data
        .filter((quiz) => !quiz.is_archived)
        .forEach((quiz) => {
          const rootId = quiz.parent_quiz_id || quiz.id;
          const version = quiz.version_number || 1;
          const currentMax = maxVersionByRoot.get(rootId) || 1;
          if (version > currentMax) {
            maxVersionByRoot.set(rootId, version);
          } else if (!maxVersionByRoot.has(rootId)) {
            maxVersionByRoot.set(rootId, currentMax);
          }
        });

      const latestSubmissionByQuiz = new Map();
      (submissions || []).forEach((submission) => {
        if (!latestSubmissionByQuiz.has(submission.quiz_id)) {
          latestSubmissionByQuiz.set(submission.quiz_id, submission);
        }
      });

      const quizIds = data.map((quiz) => quiz.id);
      const sectionCountByQuiz = new Map();
      const quizSubjectMap = new Map();

      if (quizIds.length > 0) {
        try {
          const { data: quizSections, error: quizSectionsError } = await supabase
            .from("quiz_sections")
            .select("quiz_id, section_id")
            .in("quiz_id", quizIds);

          if (!quizSectionsError && quizSections) {
            const uniqueSections = new Map();
            quizSections.forEach((row) => {
              const existing = uniqueSections.get(row.quiz_id) || new Set();
              existing.add(row.section_id);
              uniqueSections.set(row.quiz_id, existing);
            });

            uniqueSections.forEach((sectionSet, qId) => {
              sectionCountByQuiz.set(qId, sectionSet.size);
            });
          }

          // Fetch all section details (both direct section_id and junction section_ids)
          const directSectionIds = data.map((q) => q.section_id).filter(Boolean);
          const junctionSectionIds = (quizSections || []).map((qs) => qs.section_id).filter(Boolean);
          const allSectionIds = Array.from(new Set([...directSectionIds, ...junctionSectionIds]));

          const sectionMap = new Map();
          if (allSectionIds.length > 0) {
            try {
              const { data: sectionsData } = await supabase
                .from("sections")
                .select("id, name, code, subject_id, subject_code, description, subjects(id, name, code)")
                .in("id", allSectionIds);

              if (sectionsData) {
                sectionsData.forEach((sec) => {
                  sectionMap.set(sec.id, sec);
                });
              }
            } catch (secErr) {
              console.warn("Could not query sections:", secErr);
            }
          }

          // Fetch teaching assignments for sections as another resolution strategy
          const sectionToTaSubjectMap = new Map();
          if (allSectionIds.length > 0) {
            try {
              const { data: taData } = await supabase
                .from("teaching_assignments")
                .select("section_id, subject_id, subjects(id, name, code)")
                .in("section_id", allSectionIds);

              if (taData) {
                taData.forEach((ta) => {
                  if (ta.subjects) sectionToTaSubjectMap.set(ta.section_id, ta.subjects);
                });
              }
            } catch (taErr) {
              console.warn("Could not query teaching assignments:", taErr);
            }
          }

          // Fetch all subject details
          const directSubjectIds = data.map((q) => q.subject_id).filter(Boolean);
          const sectionSubjectIds = Array.from(sectionMap.values())
            .map((sec) => sec.subject_id)
            .filter(Boolean);
          const taSubjectIds = Array.from(sectionToTaSubjectMap.values())
            .map((s) => s?.id)
            .filter(Boolean);
          const allSubjectIds = Array.from(new Set([...directSubjectIds, ...sectionSubjectIds, ...taSubjectIds]));

          const subjectMap = new Map();
          try {
            if (allSubjectIds.length > 0) {
              const { data: subjectsData } = await supabase
                .from("subjects")
                .select("id, name, code, description")
                .in("id", allSubjectIds);

              if (subjectsData) {
                subjectsData.forEach((sub) => {
                  subjectMap.set(sub.id, sub);
                  if (sub.code) subjectMap.set(sub.code.toLowerCase(), sub);
                });
              }
            }

            // Also query overall active subjects as general fallback
            const { data: allActiveSubs } = await supabase
              .from("subjects")
              .select("id, name, code, description")
              .eq("is_archived", false);

            if (allActiveSubs) {
              allActiveSubs.forEach((sub) => {
                if (sub.id && !subjectMap.has(sub.id)) subjectMap.set(sub.id, sub);
                if (sub.code) subjectMap.set(sub.code.toLowerCase(), sub);
                if (sub.name) subjectMap.set(sub.name.toLowerCase(), sub);
              });
            }
          } catch (subErr) {
            console.warn("Could not query subjects:", subErr);
          }

          // Map subject info per quiz
          data.forEach((quiz) => {
            let sub = quiz.subject_id ? subjectMap.get(quiz.subject_id) : null;

            const targetSecId = quiz.section_id || (quizSections?.find((qs) => qs.quiz_id === quiz.id)?.section_id);

            if (!sub && targetSecId) {
              const sec = sectionMap.get(targetSecId);
              if (sec) {
                sub = sec.subjects || (sec.subject_id ? subjectMap.get(sec.subject_id) : null);

                if (!sub && sec.subject_code) {
                  sub = subjectMap.get(sec.subject_code.toLowerCase());
                }

                if (!sub) {
                  sub = sectionToTaSubjectMap.get(sec.id);
                }

                if (!sub && sec.name) {
                  sub = {
                    id: sec.id,
                    name: sec.name,
                    code: sec.subject_code || sec.code || "",
                  };
                }
              }
            }

            if (!sub) {
              const qSecs = (quizSections || []).filter((qs) => qs.quiz_id === quiz.id);
              for (const qs of qSecs) {
                const sec = sectionMap.get(qs.section_id);
                if (sec) {
                  const foundSub =
                    sec.subjects ||
                    (sec.subject_id ? subjectMap.get(sec.subject_id) : null) ||
                    sectionToTaSubjectMap.get(sec.id);
                  if (foundSub) {
                    sub = foundSub;
                    break;
                  }
                  if (sec.name) {
                    sub = {
                      id: sec.id,
                      name: sec.name,
                      code: sec.subject_code || sec.code || "",
                    };
                    break;
                  }
                }
              }
            }

            if (sub) {
              const displayName = sub.code && sub.name !== sub.code ? `${sub.code} - ${sub.name}` : sub.name;
              quizSubjectMap.set(quiz.id, {
                id: sub.id,
                name: sub.name,
                code: sub.code || "",
                display: displayName,
              });
            }
          });
        } catch (subResolveErr) {
          console.warn("Could not resolve subjects for quizzes:", subResolveErr);
        }
      }

      const submissionQuizIdsSet = new Set(submissionQuizIds);
      const sectionQuizIdsSet = new Set(sectionQuizIds);
      const mySectionIdsSet = new Set(mySectionIds);

      // Fetch all attempts for all quizzes & parent quizzes in one query
      const allQuizIds = data.map((q) => q.id);
      const parentQuizIds = data.map((q) => q.parent_quiz_id).filter(Boolean);
      const lookupQuizIds = Array.from(new Set([...allQuizIds, ...parentQuizIds]));

      let attemptsCountByQuiz = new Map();
      if (lookupQuizIds.length > 0) {
        try {
          const { data: attemptsData } = await supabase
            .from("quiz_attempts")
            .select("id, quiz_id")
            .in("quiz_id", lookupQuizIds);

          if (attemptsData) {
            attemptsData.forEach((a) => {
              attemptsCountByQuiz.set(
                a.quiz_id,
                (attemptsCountByQuiz.get(a.quiz_id) || 0) + 1
              );
            });
          }
        } catch (attErr) {
          console.warn("Could not query attempts:", attErr);
        }
      }

      const quizzesWithCounts = await Promise.all(
        data.map(async (quiz) => {
          const resolvedQuestionsCount = await fetchQuizQuestionCount(
            quiz.id,
            quiz.parent_quiz_id
          );

          const latestSubmission = latestSubmissionByQuiz.get(quiz.id);

          const totalAttempts =
            (attemptsCountByQuiz.get(quiz.id) || 0) +
            (quiz.parent_quiz_id ? (attemptsCountByQuiz.get(quiz.parent_quiz_id) || 0) : 0);

          const subjectInfo = quizSubjectMap.get(quiz.id);

          return {
            ...quiz,
            subject_id: quiz.subject_id || subjectInfo?.id || null,
            subject_name: subjectInfo?.name || null,
            subject_code: subjectInfo?.code || null,
            subject_display: subjectInfo?.display || null,
            subjects: subjectInfo
              ? { id: subjectInfo.id, name: subjectInfo.name, code: subjectInfo.code }
              : quiz.subjects || null,
            attempts: totalAttempts,
            questions_count: resolvedQuestionsCount,
            admin_review_status: latestSubmission?.status || null,
            admin_review_feedback: latestSubmission?.admin_feedback || "",
            hasNewerVersion:
              (quiz.version_number || 1) <
              (maxVersionByRoot.get(quiz.parent_quiz_id || quiz.id) ||
                quiz.version_number ||
                1),
            section_count:
              sectionCountByQuiz.get(quiz.id) || (quiz.section_id ? 1 : 0),
          };
        })
      );

      const visibleQuizzes = quizzesWithCounts.filter((quiz) => {
        const isOwner = (quiz.instructor_id || quiz.owner_id) === user.id;
        return isOwner;
      });

      setQuizzes(visibleQuizzes);
    } catch (error) {
      console.error("Error fetching quizzes:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchQuizzes();
  }, [fetchQuizzes]);

  const handleRestoreQuiz = async (quizId) => {
    try {
      const { error } = await supabase
        .from("quizzes")
        .update({ is_archived: false })
        .eq("id", quizId);

      if (error) throw error;

      await fetchQuizzes();
      notify.success("Quiz restored successfully!");
    } catch (error) {
      console.error("Error restoring quiz:", error);
      notify.error("Error restoring quiz: " + error.message);
    }
  };

  const handleArchiveQuiz = async (quizId) => {
    try {
      const { error } = await supabase
        .from("quizzes")
        .update({ is_archived: true })
        .eq("id", quizId);

      if (error) throw error;

      // Log status change
      await supabase.rpc("log_quiz_status_change", {
        p_quiz_id: quizId,
        p_new_status: "archived",
        p_reason: "Quiz archived by instructor"
      });

      await fetchQuizzes();
      notify.success("Quiz archived successfully!");
    } catch (error) {
      console.error("Error archiving quiz:", error);
      notify.error("Error archiving quiz: " + error.message);
    }
  };

  const handlePublishQuiz = async (quizId) => {
    try {
      const { data: quiz, error: fetchError } = await supabase
        .from("quizzes")
        .select("title, share_token")
        .eq("id", quizId)
        .single();

      if (fetchError) throw fetchError;

      const shareToken = quiz?.share_token || (await getUniqueShareToken());

      const cleanTitle = (quiz?.title || "").replace(/\s*\(Revised(?:\s+\d+)?\)\s*$/, "");

      const { error } = await supabase
        .from("quizzes")
        .update({
          is_published: true,
          share_token: shareToken,
          ...(cleanTitle ? { title: cleanTitle } : {}),
        })
        .eq("id", quizId);

      if (error) throw error;

      // Log status change
      await supabase.rpc("log_quiz_status_change", {
        p_quiz_id: quizId,
        p_new_status: "published",
        p_reason: "Quiz published by instructor"
      });

      await fetchQuizzes();
      notify.success("Quiz published successfully!");
    } catch (error) {
      console.error("Error publishing quiz:", error);
      notify.error("Error publishing quiz: " + error.message);
    }
  };

  return {
    quizzes,
    loading,
    fetchQuizzes,
    handleRestoreQuiz,
    handleArchiveQuiz,
    handlePublishQuiz,
  };
};
