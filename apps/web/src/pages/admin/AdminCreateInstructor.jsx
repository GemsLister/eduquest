import { useState } from "react";
import { useAdminInstructors } from "../../hooks/adminHook/useAdminInstructors.jsx";
import { CreateInstructorForm } from "../../components/admin/CreateInstructorForm.jsx";

export const AdminCreateInstructor = () => {
  const { createInstructor, createLoading, error } = useAdminInstructors();
  const [success, setSuccess] = useState("");
  const [formError, setFormError] = useState("");

  const handleSubmit = async (formData) => {
    setFormError("");
    setSuccess("");
    const result = await createInstructor(formData);
    if (result.success) {
      setSuccess(
        `Instructor account for "${formData.email}" was created successfully.`,
      );
    } else {
      setFormError(result.error || "Something went wrong.");
    }
    return result;
  };

  return (
    <>
      {/* Page Header */}
      <div className="bg-gradient-to-r from-brand-navy to-brand-indigo px-6 py-8">
        <p className="text-brand-gold text-sm font-semibold uppercase tracking-widest mb-1">
          Admin
        </p>
        <h1 className="text-2xl md:text-3xl font-black text-white">
          Create Instructor
        </h1>
        <p className="text-white/60 text-sm mt-1">
          Add a new instructor account to BUKSU CITL.
        </p>
      </div>

      <div className="p-6">
        <CreateInstructorForm
          onSubmit={handleSubmit}
          loading={createLoading}
          error={formError || error}
          success={success}
        />
      </div>
    </>
  );
};
