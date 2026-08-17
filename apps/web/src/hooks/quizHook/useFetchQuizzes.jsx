import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../context/AuthContext";

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

export const useFetchQuizzes = () => {
  const { user } = useAuth();
  const { sectionId } = useParams();
  const [section, setSection] = useState(null);
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

  const fetchQuizzes = async () => {
    try {
      // First, get the current section's subject_id to enable cross-section quiz sharing
      let subjectId = null;
      try {
        const { data: sectionData } = await supabase
          .from("sections")
          .select("subject_id")
          .eq("id", sectionId)
          .single();
        
        if (sectionData) {
          subjectId = sectionData.subject_id;
        }
      } catch (error) {
        console.log("Could not fetch subject_id for cross-section sharing:", error);
      }

      // First try to fetch from quiz_sections table (if it exists)
      let quizIds = [];
      const { data: qsData, error: qsError } = await supabase
        .from("quiz_sections")
        .select("quiz_id")
        .eq("section_id", sectionId);

      if (!qsError && qsData) {
        quizIds = qsData.map((qs) => qs.quiz_id);
      }

      // Also get any quizzes directly linked to this section (backward compatibility)
      const { data: directQuizzes, error: directError } = await supabase
        .from("quizzes")
        .select("id")
        .eq("section_id", sectionId);

      if (!directError && directQuizzes) {
        directQuizzes.forEach((q) => {
          if (!quizIds.includes(q.id)) quizIds.push(q.id);
        });
      }

      // If we have a subject_id, also fetch quizzes from other sections with the same subject
      // Only fetch PUBLIC quizzes from other sections (respect privacy)
      if (subjectId) {
        try {
          // Get all sections with the same subject
          const { data: sameSubjectSections, error: sectionsError } = await supabase
            .from("sections")
            .select("id")
            .eq("subject_id", subjectId)
            .neq("id", sectionId); // Exclude current section

          if (!sectionsError && sameSubjectSections && sameSubjectSections.length > 0) {
            const sameSubjectSectionIds = sameSubjectSections.map(s => s.id);
            
            // Get quiz_sections for these sections - only for public quizzes
            const { data: crossSectionQsData, error: crossSectionQsError } = await supabase
              .from("quiz_sections")
              .select("quiz_id, section_id")
              .in("section_id", sameSubjectSectionIds);

            if (!crossSectionQsError && crossSectionQsData) {
              // Get the actual quiz data to check privacy
              const crossSectionQuizIds = crossSectionQsData.map(qs => qs.quiz_id);
              const { data: quizPrivacyData, error: privacyError } = await supabase
                .from("quizzes")
                .select("id, is_private")
                .in("id", crossSectionQuizIds);

              if (!privacyError && quizPrivacyData) {
                const privateQuizIds = new Set(
                  quizPrivacyData.filter(q => q.is_private !== false).map(q => q.id)
                );
                
                // Only add public quizzes
                crossSectionQsData.forEach((qs) => {
                  if (!quizIds.includes(qs.quiz_id) && !privateQuizIds.has(qs.quiz_id)) {
                    quizIds.push(qs.quiz_id);
                  }
                });
              }
            }

            // Store the source section mapping for cross-section quizzes
            const crossSectionQuizSourceMap = {};
            if (!crossSectionQsError && crossSectionQsData) {
              crossSectionQsData.forEach((qs) => {
                crossSectionQuizSourceMap[qs.quiz_id] = qs.section_id;
              });
            }

            // Also get direct quizzes from these sections (backward compatibility)
            // Only fetch public quizzes
            const { data: crossSectionDirectQuizzes, error: crossSectionDirectError } = await supabase
              .from("quizzes")
              .select("id, is_private")
              .in("section_id", sameSubjectSectionIds);

            if (!crossSectionDirectError && crossSectionDirectQuizzes) {
              crossSectionDirectQuizzes.forEach((q) => {
                // Only add public quizzes
                if (!quizIds.includes(q.id) && q.is_private === false) {
                  quizIds.push(q.id);
                }
              });
            }
          }
        } catch (error) {
          console.error("Error fetching cross-section quizzes:", error);
        }
      }

      let quizzesData = [];
      if (quizIds.length > 0) {
        const { data, error: quizzesError } = await supabase
          .from("quizzes")
          .select("*, quiz_sections(section_id)")
          .in("id", quizIds)
          .eq("is_archived", false)
          .eq("is_published", true)
          .order("created_at", { ascending: false });

        if (quizzesError) throw quizzesError;
        
        // Process quiz data to extract section_id from quiz_sections
        quizzesData = (data || []).map(quiz => {
          // Extract section_id from quiz_sections array
          const sectionId = quiz.quiz_sections && quiz.quiz_sections.length > 0 
            ? quiz.quiz_sections[0].section_id 
            : quiz.section_id; // Fallback to direct section_id
          
          return {
            ...quiz,
            section_id: sectionId
          };
        });

        // Fetch source section information for quizzes from other sections
        const sourceSectionIds = new Set();
        const instructorIds = new Set();
        quizzesData.forEach(quiz => {
          if (quiz.section_id && quiz.section_id !== sectionId) {
            sourceSectionIds.add(quiz.section_id);
          }
          if (quiz.instructor_id) {
            instructorIds.add(quiz.instructor_id);
          }
        });

        // Fetch source section names
        if (sourceSectionIds.size > 0) {
          const { data: sourceSections, error: sourceSectionsError } = await supabase
            .from("sections")
            .select("id, name")
            .in("id", Array.from(sourceSectionIds));

          if (!sourceSectionsError && sourceSections) {
            const sourceSectionMap = {};
            sourceSections.forEach(sec => {
              sourceSectionMap[sec.id] = sec.name;
            });

            quizzesData = quizzesData.map(quiz => ({
              ...quiz,
              source_section_name: quiz.section_id && quiz.section_id !== sectionId 
                ? sourceSectionMap[quiz.section_id] || 'Unknown Section'
                : null
            }));
          }
        }

        // Fetch instructor names
        if (instructorIds.size > 0) {
          const { data: instructors, error: instructorsError } = await supabase
            .from("profiles")
            .select("id, first_name, last_name, username, email")
            .in("id", Array.from(instructorIds));

          if (!instructorsError && instructors) {
            const instructorMap = {};
            instructors.forEach(inst => {
              const firstName = inst.first_name || '';
              const lastName = inst.last_name || '';
              const fullName = `${firstName} ${lastName}`.trim();
              const fallbackName = inst.username || inst.email || 'Unknown Instructor';
              instructorMap[inst.id] = fullName || fallbackName;
            });

            quizzesData = quizzesData.map(quiz => {
              const name = quiz.instructor_id ? instructorMap[quiz.instructor_id] || 'Unknown Instructor' : null;
              return {
                ...quiz,
                instructor_name: name,
                owner_name: name
              };
            });
          }
        }

        const missingTokenQuizzes = (quizzesData || []).filter(
          (quiz) => quiz.is_published && !quiz.share_token,
        );

        for (const quiz of missingTokenQuizzes) {
          const token = await getUniqueShareToken();
          const { error: tokenError } = await supabase
            .from("quizzes")
            .update({ share_token: token })
            .eq("id", quiz.id);

          if (!tokenError) {
            quiz.share_token = token;
          }
        }
      }

      // Fetch question counts and section-specific attempt counts for each quiz
      const quizzesWithCounts = await Promise.all(
        (quizzesData || []).map(async (quiz) => {
          // Check junction table first
          let qCount = null;
          let countError = null;
          try {
            const { count: juncCount, error: juncError } = await supabase
              .from("quiz_questions")
              .select("*", { count: "exact", head: true })
              .eq("quiz_id", quiz.id);
            if (!isMissingTableError(juncError) && juncCount && juncCount > 0) {
              qCount = juncCount;
              countError = null;
            } else if (!isMissingTableError(juncError) && !juncError) {
              qCount = juncCount || 0;
              countError = null;
            } else {
              // Fallback to direct questions table
              const direct = await supabase
                .from("questions")
                .select("*", { count: "exact", head: true })
                .eq("quiz_id", quiz.id);
              qCount = direct.count || 0;
              countError = direct.error;
            }
          } catch (e) {
            // Fallback on any error
            const direct = await supabase
              .from("questions")
              .select("*", { count: "exact", head: true })
              .eq("quiz_id", quiz.id);
            qCount = direct.count || 0;
            countError = direct.error;
          }

          const { count: aCount } = await supabase
            .from("quiz_attempts")
            .select("*", { count: "exact", head: true })
            .eq("quiz_id", quiz.id)
            .eq("section_id", sectionId);

          let resolvedQuestionsCount = !countError ? qCount || 0 : 0;

          if (resolvedQuestionsCount === 0) {
            const { data: sub } = await supabase
              .from("quiz_analysis_submissions")
              .select("analysis_results")
              .eq("quiz_id", quiz.id)
              .limit(1)
              .maybeSingle();

            const payload = sub?.analysis_results?.analysis || sub?.analysis_results?.questionSnapshots || [];
            if (payload.length > 0) {
              resolvedQuestionsCount = payload.length;
            }
          }

          if (resolvedQuestionsCount === 0 && quiz.parent_quiz_id) {
            try {
              const { count: rootJunc, error: rootJuncErr } = await supabase
                .from("quiz_questions")
                .select("*", { count: "exact", head: true })
                .eq("quiz_id", quiz.parent_quiz_id);
              if (!isMissingTableError(rootJuncErr) && rootJunc && rootJunc > 0) {
                resolvedQuestionsCount = rootJunc;
              } else if (!isMissingTableError(rootJuncErr)) {
                const { count: rootCount } = await supabase
                  .from("questions")
                  .select("*", { count: "exact", head: true })
                  .eq("quiz_id", quiz.parent_quiz_id);
                if (rootCount && rootCount > 0) {
                  resolvedQuestionsCount = rootCount;
                }
              } else {
                const { count: rootCount } = await supabase
                  .from("questions")
                  .select("*", { count: "exact", head: true })
                  .eq("quiz_id", quiz.parent_quiz_id);
                if (rootCount && rootCount > 0) {
                  resolvedQuestionsCount = rootCount;
                }
              }
            } catch (e) {
              const { count: rootCount } = await supabase
                .from("questions")
                .select("*", { count: "exact", head: true })
                .eq("quiz_id", quiz.parent_quiz_id);
              if (rootCount && rootCount > 0) {
                resolvedQuestionsCount = rootCount;
              }
            }
          }

          return {
            ...quiz,
            attempts: aCount || 0,
            questions_count: resolvedQuestionsCount,
          };
        }),
      );

      setQuizzes(quizzesWithCounts);
    } catch (error) {
      console.error("Error fetching quizzes:", error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        // Fetch section
        const { data: sectionData, error: sectionError } = await supabase
          .from("sections")
          .select("*")
          .eq("id", sectionId)
          .single();

        if (sectionError) throw sectionError;
        setSection(sectionData);

        // Fetch quizzes
        await fetchQuizzes();
      } catch (error) {
        console.error("Error fetching section data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, sectionId]);
  return { fetchQuizzes, section, quizzes, loading, user };
};
