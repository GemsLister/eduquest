# Centralized Subject Management Implementation Summary

## Overview
This implementation adds a comprehensive centralized subject management and subject request workflow to the EduQuest system. It enables proper subject normalization, prevents duplicate subjects, and provides a formal approval workflow for new subjects through Department Head oversight.

## Database Schema Changes

### 1. Updated `subjects` table
**File:** `supabase/migrations/20260810_010000_add_subject_request_workflow.sql`

**Changes:**
- Added `status` column (VARCHAR(20)) with values: 'pending', 'approved', 'rejected'
- Added `approved_by` column (UUID) referencing auth.users
- Added `approved_at` column (TIMESTAMPTZ)
- Added `created_by` column (UUID) referencing auth.users
- Removed `instructor_id` column (replaced by created_by and instructor_subjects junction table)
- Updated unique constraint to `(name, code, grade_level)` instead of `(instructor_id, name)`
- Added check constraints for valid status and grade level values

**Purpose:** Supports subject approval workflow and removes direct instructor ownership.

### 2. New `subject_requests` table
**File:** `supabase/migrations/20260810_010000_add_subject_request_workflow.sql`

**Columns:**
- `id` (UUID, primary key)
- `subject_name` (VARCHAR(255), NOT NULL)
- `subject_code` (VARCHAR(50))
- `grade_level` (VARCHAR(20), NOT NULL, DEFAULT '1st')
- `description` (TEXT)
- `requested_by` (UUID, NOT NULL, references auth.users)
- `request_status` (VARCHAR(20), NOT NULL, DEFAULT 'pending')
- `rejection_reason` (TEXT)
- `reviewed_by` (UUID, references auth.users)
- `reviewed_at` (TIMESTAMPTZ)
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

**Indexes:**
- `idx_subject_requests_requested_by` on requested_by
- `idx_subject_requests_status` on request_status
- `idx_subject_requests_grade_level` on grade_level
- `idx_subject_requests_name_grade` on (subject_name, grade_level)

**Purpose:** Stores instructor subject requests awaiting Department Head approval.

### 3. Existing tables (already present)
- `instructor_subjects` - Junction table for instructor-subject relationships
- `instructor_subject_sections` - Junction table for instructor-subject-section relationships
- `sections` - Already has `subject_id` foreign key
- `quizzes` - Already has `subject_id` foreign key

## Database Functions (RPC)

### 1. `submit_subject_request`
**Purpose:** Submit a new subject request with built-in duplicate prevention.

**Parameters:**
- `p_subject_name` (VARCHAR(255))
- `p_subject_code` (VARCHAR(50))
- `p_grade_level` (VARCHAR(20))
- `p_description` (TEXT)

**Returns:** JSONB with success status, request_id, or error details

**Duplicate Prevention:**
- Checks for existing approved subjects with same name/code/grade_level
- Checks for duplicate pending requests from same instructor
- Returns existing subject/request IDs if duplicates found

### 2. `approve_subject_request`
**Purpose:** Department Head approval/rejection of subject requests.

**Parameters:**
- `p_request_id` (UUID)
- `p_rejection_reason` (TEXT, optional)

**Returns:** JSONB with success status, action taken, subject_id (if approved)

**Workflow:**
- If rejection_reason provided: rejects request, saves reason
- If no rejection: creates approved subject, assigns requesting instructor, updates request status

### 3. `create_subject_direct`
**Purpose:** Department Head direct subject creation (no approval needed).

**Parameters:**
- `p_subject_name` (VARCHAR(255))
- `p_subject_code` (VARCHAR(50))
- `p_grade_level` (VARCHAR(20))
- `p_description` (TEXT)

**Returns:** JSONB with success status and subject_id

**Permission:** Faculty head only

### 4. `get_approved_subjects`
**Purpose:** Fetch all approved subjects with instructor assignment status.

**Returns:** Table with subject details and `is_assigned` boolean for current user

### 5. `get_my_subject_requests`
**Purpose:** Fetch current instructor's subject requests.

**Returns:** Table with request details for current user

### 6. `get_all_subject_requests`
**Purpose:** Fetch all subject requests for Department Head review.

**Returns:** Table with all requests including requester details

### 7. Existing functions (preserved)
- `join_subject` - Assign instructor to subject
- `leave_subject` - Remove instructor from subject
- `get_instructor_subjects_with_sections` - Get instructor's subjects with sections

## Role-Based Security Policies

### Subject Requests RLS
- **Instructors:** Can view own requests, create requests
- **Faculty Heads:** Can view all requests, update requests (approve/reject)

### Subjects RLS (Updated)
- **All authenticated:** Can view approved subjects
- **Subject creators:** Can view own subjects (even if not approved)
- **Faculty Heads:** Can view all subjects, create/update/delete subjects
- **Instructors:** Can view subjects they're assigned to (via existing policies)

## Frontend Components

### 1. SubjectRequestForm.jsx
**Location:** `apps/web/src/components/SubjectRequestForm.jsx`

**Purpose:** Modal form for instructors to request new subjects.

**Features:**
- Subject name, code, grade level, description fields
- Grade level dropdown (1st-4th Year)
- Client-side validation
- Calls `submit_subject_request` RPC with duplicate prevention
- User feedback for duplicate subjects/requests
- Success/error notifications

### 2. CentralizedSubjectDropdown.jsx
**Location:** `apps/web/src/components/CentralizedSubjectDropdown.jsx`

**Purpose:** Reusable dropdown component for selecting approved subjects.

**Features:**
- Fetches approved subjects via `get_approved_subjects` RPC
- Shows assignment status (✓ for already assigned)
- "+ Request New Subject" option
- Automatic instructor assignment on selection
- Grade level filtering support
- Loading and error states

### 3. FacultyHeadSubjectRequests.jsx
**Location:** `apps/web/src/pages/faculty-head/FacultyHeadSubjectRequests.jsx`

**Purpose:** Department Head interface for managing subject requests.

**Features:**
- Statistics dashboard (pending, approved today, total processed)
- Filter by status (all, pending, approved, rejected)
- Request list with full details
- Approve/Reject buttons with reason prompt
- Direct subject creation form (faculty head only)
- Real-time status updates

### 4. InstructorSubjectRequests.jsx
**Location:** `apps/web/src/components/InstructorSubjectRequests.jsx`

**Purpose:** Instructor view of their subject requests.

**Features:**
- List of instructor's own requests
- Status badges (pending, approved, rejected)
- Rejection reason display
- Request and review timestamps
- Empty state with guidance

### 5. useCentralizedSubjects.jsx
**Location:** `apps/web/src/hooks/useCentralizedSubjects.jsx`

**Purpose:** Custom hook for subject management.

**Features:**
- Fetch approved subjects
- Assign instructor to subject
- Remove instructor from subject
- Local state management
- Error handling

## Updated Components

### 1. CreateSectionButton.jsx
**Location:** `apps/web/src/components/ui/buttons/CreateSectionButton.jsx`

**Changes:**
- Replaced direct subject creation with centralized subject selection
- Integrated `CentralizedSubjectDropdown` component
- Sections now linked to centralized subjects via `subject_id`
- Updated messaging to reflect new workflow

### 2. CreateQuizFormButton.jsx
**Location:** `apps/web/src/components/ui/buttons/CreateQuizFormButton.jsx`

**Changes:**
- Updated messaging to reference "sections" instead of "subjects"
- Clarified that sections must have assigned subjects
- Prepared for future subject-based quiz assignment

### 3. InstructorDashboard.jsx
**Location:** `apps/web/src/pages/instructors/InstructorDashboard.jsx`

**Changes:**
- Added `InstructorSubjectRequests` component display
- Shows instructor's pending/approved/rejected requests
- Integrated with existing dashboard layout

### 4. FacultyHeadSidebar.jsx
**Location:** `apps/web/src/components/faculty-head/FacultyHeadSidebar.jsx`

**Changes:**
- Added "Subject Requests" navigation item
- Placed between Quiz Approvals and Audit Trail

### 5. Routes Configuration
**Location:** `apps/web/src/routes/routes.jsx`

**Changes:**
- Added `/faculty-head-dashboard/subject-requests` route
- Connected to `FacultyHeadSubjectRequests` component

### 6. Faculty Head Index
**Location:** `apps/web/src/pages/faculty-head/facultyHeadPageIndex.js`

**Changes:**
- Exported `FacultyHeadSubjectRequests` component

## Subject Request and Approval Workflow

### Instructor Workflow
1. **Subject Selection:**
   - Instructor uses `CentralizedSubjectDropdown` to select from approved subjects
   - If desired subject exists, selection automatically assigns instructor to subject
   - Subject is immediately available for use

2. **New Subject Request:**
   - If subject doesn't exist, instructor clicks "+ Request New Subject"
   - `SubjectRequestForm` modal opens
   - Instructor fills in subject details (name, code, grade level, description)
   - Form calls `submit_subject_request` RPC
   - Duplicate prevention checks run automatically
   - If duplicates found, instructor is informed and directed to existing subject
   - If no duplicates, request is created with "pending" status
   - Instructor can track request status in dashboard

3. **Request Tracking:**
   - `InstructorSubjectRequests` component shows all instructor's requests
   - Status updates in real-time
   - Rejection reasons displayed if rejected
   - Approved subjects automatically become available

### Department Head Workflow
1. **Request Review:**
   - Department Head accesses "Subject Requests" from sidebar
   - Dashboard shows pending requests count and statistics
   - Can filter by status (pending, approved, rejected)

2. **Request Processing:**
   - For each pending request, Department Head can:
     - **Approve:** Creates subject in `subjects` table with "approved" status
     - **Reject:** Updates request status to "rejected" with reason
   - On approval:
     - Subject created with `approved_by` = Department Head
     - Requesting instructor automatically assigned via `instructor_subjects`
     - Request status updated to "approved"
     - Subject immediately available in dropdown for all instructors

3. **Direct Subject Creation:**
   - Department Head can bypass request process
   - Uses "Create Subject Directly" button
   - Subject immediately created as "approved"
   - Available in dropdown immediately
   - Useful for pre-approving known subjects

## Duplicate Prevention Logic

### Database Level (RPC Functions)
1. **`submit_subject_request` checks:**
   - Existing approved subjects with same `(name, code, grade_level)`
   - Pending requests from same instructor with same `(name, code, grade_level)`
   - Returns appropriate error with existing IDs
   - Prevents duplicate records at source

2. **`create_subject_direct` checks:**
   - Existing subjects (any status) with same `(name, code, grade_level)`
   - Prevents faculty head from creating duplicates

### Application Level
1. **User Interface:**
   - Clear error messages when duplicates detected
   - Guidance to select existing subject instead
   - Prevents form submission when duplicates found

2. **Data Integrity:**
   - Unique constraints on `(name, code, grade_level)` in database
   - Check constraints for valid status and grade level values
   - RLS policies prevent unauthorized modifications

## Quiz Collaboration Support

### Existing Infrastructure (Preserved)
The implementation leverages existing quiz collaboration features:

1. **Subject-Level Access:**
   - Quizzes already linked to subjects via `subject_id` foreign key
   - Existing RLS policies allow subject-based quiz access
   - Instructors assigned to same subject can access each other's quizzes

2. **Instructor-Subject Relationships:**
   - `instructor_subjects` junction table enables many-to-many relationships
   - Multiple instructors can be assigned to same subject
   - One instructor can handle multiple subjects

3. **Quiz Access Policies:**
   - Existing policies allow instructors to access quizzes from their assigned subjects
   - Quiz collaboration already implemented in `20260809_020000_add_quiz_collaboration.sql`
   - Audit trail preserved (created_by, updated_at, etc.)

### How This Implementation Enhances Collaboration
1. **Centralized Subject Management:**
   - All instructors work with same subject definitions
   - No duplicate subjects causing confusion
   - Consistent subject codes and grade levels

2. **Standardized Assignment:**
   - Instructors formally assigned to subjects
   - Clear permission boundaries
   - Easy to see who can access which quizzes

3. **Approval Process:**
   - Department Head oversight ensures subject quality
   - Prevents inconsistent subject creation
   - Maintains academic standards

## Files and Components Changed

### Database Files
1. `supabase/migrations/20260810_010000_add_subject_request_workflow.sql` (NEW)
   - Subject requests table
   - Updated subjects table
   - All RPC functions
   - RLS policies

### Frontend Components (NEW)
1. `apps/web/src/components/SubjectRequestForm.jsx`
2. `apps/web/src/components/CentralizedSubjectDropdown.jsx`
3. `apps/web/src/components/InstructorSubjectRequests.jsx`
4. `apps/web/src/pages/faculty-head/FacultyHeadSubjectRequests.jsx`
5. `apps/web/src/hooks/useCentralizedSubjects.jsx`

### Frontend Components (UPDATED)
1. `apps/web/src/components/ui/buttons/CreateSectionButton.jsx`
2. `apps/web/src/components/ui/buttons/CreateQuizFormButton.jsx`
3. `apps/web/src/pages/instructors/InstructorDashboard.jsx`
4. `apps/web/src/components/faculty-head/FacultyHeadSidebar.jsx`
5. `apps/web/src/routes/routes.jsx`
6. `apps/web/src/pages/faculty-head/facultyHeadPageIndex.js`

## Department Head Permissions

### Subject Management
- **View:** All subject requests (pending, approved, rejected)
- **Approve:** Subject requests (creates subject, assigns instructor)
- **Reject:** Subject requests (with reason)
- **Create:** Direct subject creation (bypasses request process)
- **Access:** Subject Requests management page

### Existing Permissions (Preserved)
- Quiz approvals
- Audit trail access
- Settings management
- All existing faculty head capabilities

## Instructor Workflow Summary

### Before Implementation
- Instructors created subjects independently
- No centralized subject list
- Duplicate subjects common
- No formal approval process
- Limited collaboration support

### After Implementation
1. **Subject Selection:**
   - Choose from centralized approved subjects dropdown
   - Automatic assignment on selection
   - Clear indication of assigned subjects

2. **New Subject Request:**
   - Submit request through formal form
   - Automatic duplicate prevention
   - Track request status in dashboard
   - Receive feedback on approval/rejection

3. **Section Creation:**
   - Create sections linked to centralized subjects
   - No direct subject creation
   - Consistent subject usage across system

4. **Quiz Collaboration:**
   - Work with standardized subjects
   - Clear access boundaries
   - Enhanced collaboration with same-subject instructors

## Data Integrity and Validation

### Database Constraints
- Unique constraints on subject identification
- Check constraints for valid statuses and grade levels
- Foreign key constraints for relationships
- NOT NULL constraints on required fields

### Application Validation
- Client-side form validation
- RPC-level duplicate prevention
- User feedback for validation errors
- Loading and error states

### Security
- Row Level Security (RLS) on all tables
- Role-based access control
- Faculty head permissions enforced
- Instructor permissions scoped to own data

## Migration and Backward Compatibility

### Data Migration
- Existing subjects updated to "approved" status
- `created_by` set from original `instructor_id`
- `approved_at` set to original `created_at`
- Existing instructor-subject relationships preserved

### Backward Compatibility
- Existing sections preserved
- Existing quizzes preserved
- Existing instructor-subject assignments preserved
- Quiz collaboration features maintained
- No breaking changes to existing functionality

## Testing Recommendations

### Database Testing
1. Test RPC functions with various inputs
2. Verify duplicate prevention logic
3. Test RLS policies for different roles
4. Verify data migration accuracy

### Frontend Testing
1. Test subject request submission
2. Test duplicate prevention UI
3. Test Department Head approval/rejection
4. Test direct subject creation
5. Test instructor subject assignment
6. Test quiz collaboration with new subjects

### Integration Testing
1. End-to-end subject request workflow
2. Quiz creation with new subjects
3. Section creation with centralized subjects
4. Multi-instructor collaboration scenarios

## Future Enhancements

### Potential Improvements
1. Subject editing capabilities (Department Head)
2. Subject archiving/deactivation
3. Bulk subject operations
4. Subject usage analytics
5. Advanced filtering and search
6. Subject versioning
7. Department head assignment per subject
8. Subject categories or departments

### Scalability Considerations
1. Caching for subject dropdowns
2. Pagination for large subject lists
3. Background job for request notifications
4. Audit trail for subject changes
5. Performance monitoring

## Conclusion

This implementation successfully provides a centralized subject management system with:
- ✅ Centralized subject dropdown for instructors
- ✅ Formal subject request workflow
- ✅ Department Head approval interface
- ✅ Direct subject creation for Department Heads
- ✅ Comprehensive duplicate prevention
- ✅ Proper instructor-subject relationships
- ✅ Quiz collaboration support
- ✅ Role-based permissions
- ✅ Data integrity and validation
- ✅ Backward compatibility

The system maintains all existing functionality while adding the requested centralized subject management capabilities, enabling better collaboration and data consistency across the EduQuest platform.