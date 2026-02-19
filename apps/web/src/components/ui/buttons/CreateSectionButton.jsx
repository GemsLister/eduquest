import * as Container from "../../container/PopupContainer.jsx";
import { useCreateSection } from "../../../hooks/useCreateSection.jsx";
import { CreateClassPopup } from "../forms/CreateClassPopup.jsx";

export const CreateSectionButton = ({ onSectionCreated, userId }) => {
  const { handleCreateSection, handleInputChange, showForm, setShowForm, loading, error, formData } = useCreateSection(
    onSectionCreated,
    userId,
  );
  // const [close, setClose] = useState(false);

  // const handleCreateSection = async (e) => {
  //   e.preventDefault();
  //   setLoading(true);
  //   setError("");

  //   try {
  //     if (!formData.name.trim()) {
  //       setError("Section name is required");
  //       return;
  //     }

  //     if (!userId) {
  //       console.log(userId);

  //       setError("You must be logged in to create a section");
  //       return;
  //     }

  //     const examCode = () =>
  //       Math.random().toString(36).substring(2, 8).toUpperCase();

  //     const { data, error: insertError } = await supabase
  //       .from("sections")
  //       .insert([
  //         {
  //           instructor_id: userId,
  //           name: formData.name.trim(),
  //           description: formData.description.trim() || null,
  //           exam_code: examCode(),
  //         },
  //       ])
  //       .select();

  //     if (insertError) throw insertError;

  //     setFormData({ name: "", description: "" });
  //     setShowForm(false);

  //     if (onSectionCreated) {
  //       onSectionCreated(data[0]);
  //     }
  //   } catch (err) {
  //     setError(err.message || "Failed to create section");
  //     console.error("Error creating section:", err);
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  return (
    <div>
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-casual-green text-white px-4 py-2 md:py-3 rounded-lg font-semibold text-sm md:text-base hover:bg-hornblende-green transition-colors shadow-md"
        >
          <span className="text-lg">+</span>
          Create New Class
        </button>
      ) : (
        <Container.PopupContainer>
          <CreateClassPopup
            onSubmit={handleCreateSection}
            onClose={() => setShowForm(false)}
            loading={loading}
            error={error}
            formDataName={formData.name}
            formDataDescription={formData.description}
            onInputChange={handleInputChange}
          />
        </Container.PopupContainer>
      )}
    </div>
  );
};
