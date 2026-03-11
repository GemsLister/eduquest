import { supabase } from "../../supabaseClient";
import * as ItemAnalysisService from "../../services/item-analysis/itemAnalysisService";
export const useFetchData = () => {
  const [user, setUser] = useState(null);
  const [sections, setSections] = useState([]);
  const [loadingSections, setLoadingSections] = useState(true);
  // Fetch user and sections on mount
  const handleFetchData = () => {
    useEffect(() => {
      const fetchData = async () => {
        try {
          // Get current user
          const {
            data: { user: authUser },
            error: authError,
          } = await supabase.auth.getUser();

          if (authError) throw authError;
          setUser(authUser);

          if (authUser) {
            // Fetch instructor's sections
            const { data: sectionsData, error: sectionsError } =
              ItemAnalysisService.getInstructorsSection(authUser.id);

            if (sectionsError) {
              console.error("Error fetching sections:", sectionsError);
            } else {
              setSections(sectionsData || []);
            }
          }
        } catch (err) {
          console.error("Error fetching sections:", err);
        } finally {
          setLoadingSections(false);
        }
      };
      fetchData();
    }, []);
  };
  return { user, sections, loadingSections, handleFetchData };
};
