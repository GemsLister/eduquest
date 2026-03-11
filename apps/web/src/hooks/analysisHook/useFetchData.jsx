import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../supabaseClient";
import * as ItemAnalysisService from "../../services/item-analysis/itemAnalysisService";

export const useFetchData = () => {
  const [user, setUser] = useState(null);
  const [sections, setSections] = useState([]);
  const [loadingSections, setLoadingSections] = useState(true);

  // 1. Move logic into a reusable function (useCallback prevents unnecessary re-renders)
  const fetchData = useCallback(async () => {
    try {
      setLoadingSections(true);
      
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      
      setUser(authUser);

      if (authUser) {
        // NOTE: Ensure ItemAnalysisService.getInstructorsSection is awaited if it's an async call
        const { data: sectionsData, error: sectionsError } = 
          await ItemAnalysisService.getInstructorsSection(authUser.id);

        if (sectionsError) throw sectionsError;
        setSections(sectionsData || []);
      }
    } catch (err) {
      console.error("Error in useFetchData:", err);
    } finally {
      setLoadingSections(false);
    }
  }, []);

  // 2. Call useEffect at the top level
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Return the manual fetchData as 'refresh' if you need to call it again later
  return { user, sections, loadingSections, refresh: fetchData };
};