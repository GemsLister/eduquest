import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../context/AuthContext";
import { fetchQuestionCounts, fetchAttemptsByQuiz } from "../../utils/quizCounts.js";

export const useFetchQuizzes = () => {
  const { user } = useAuth();
  const { sectionId } = useParams();
  const [section, setSection] = useState(null);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);

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
        console.warn("Could not fetch subject_id for cross-section sharing:", error);
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

      }

      // Question and section-specific attempt counts, batched
      const lookupIds = Array.from(
        new Set(
          (quizzesData || []).flatMap((q) => [q.id, q.parent_quiz_id]).filter(Boolean),
        ),
      );
      const [questionCounts, attemptsByQuiz] = await Promise.all([
        fetchQuestionCounts(lookupIds),
        fetchAttemptsByQuiz(lookupIds),
      ]);

      const quizzesWithCounts = (quizzesData || []).map((quiz) => {
        const attemptRows = [
          ...(attemptsByQuiz.get(quiz.id) || []),
          ...(quiz.parent_quiz_id ? attemptsByQuiz.get(quiz.parent_quiz_id) || [] : []),
        ];
        const aCount = attemptRows.filter((a) => (sectionId ? a.section_id === sectionId : true)).length;

        let resolvedQuestionsCount = questionCounts.get(quiz.id) || 0;
        if (resolvedQuestionsCount === 0 && quiz.parent_quiz_id) {
          resolvedQuestionsCount = questionCounts.get(quiz.parent_quiz_id) || 0;
        }

        return {
          ...quiz,
          attempts: aCount,
          questions_count: resolvedQuestionsCount,
        };
      });

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
