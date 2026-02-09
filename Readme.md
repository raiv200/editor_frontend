# RFP UI Update - Figma Design Implementation

## Overview

This update implements the new Figma designs with the following features:
- Updated sidebar and header matching Figma design
- New RFP Editor with AI Suggestions and Comments panels
- New Review & Approve page
- New Export & Submit page
- New Success page with Journey Summary

---

## File Structure

```
src/
├── app/
│   ├── layout.tsx                          # Root layout (AuthProvider)
│   └── (dashboard)/
│       ├── layout.tsx                      # Shared layout with Sidebar
│       ├── page.tsx                        # Dashboard
│       ├── rfp/[rfpId]/page.tsx           # RFP Editor (UPDATED)
│       ├── review/[rfpId]/page.tsx        # NEW: Review & Approve
│       ├── export/[rfpId]/page.tsx        # NEW: Export & Submit
│       └── success/[rfpId]/page.tsx       # NEW: Success page
│
└── components/
    ├── layout/
    │   ├── AppSidebar.tsx                  # UPDATED: New icons, user role
    │   └── AppHeader.tsx                   # UPDATED: Search, notifications
    │
    ├── editor/
    │   └── CollaborativeEditor.tsx         # UPDATED: UI only, all functionality preserved
    │
    └── rfp/
        ├── DocumentOutline.tsx             # NEW: Collapsible outline panel
        ├── AISuggestionsPanel.tsx          # NEW: AI + Library Matches tabs
        └── CommentsPanel.tsx               # NEW: Comments sidebar
```

---

## New User Flow

```
Dashboard → RFP Editor → Review & Approve → Export & Submit → Success
```

### 1. Dashboard (`/`)
- RFP cards with status, progress, and actions
- "New RFP" button

### 2. RFP Editor (`/rfp/[rfpId]`)
- **Header**: Back button, RFP title, online users, "Enable Collaboration", "Request Review"
- **Left Panel**: Document Outline (collapsible)
- **Center**: Question editor with Save Draft and Next Question
- **Right Panel**: Toggle between AI Suggestions and Comments

### 3. Review & Approve (`/review/[rfpId]`)
- Approval progress with user avatars
- Sections list with completion status
- Document stats
- Question/Answer preview
- "Request Changes" or "Approve Document" actions

### 4. Export & Submit (`/export/[rfpId]`)
- Export format selection (PDF/DOCX)
- Document options (cover page, TOC, etc.)
- Branding options
- Submission details and checklist
- "Generate & Download" and "Submit RFP Response"

### 5. Success (`/success/[rfpId]`)
- Success message
- Journey Summary (time, speed, team, AI suggestions)
- "Back to Dashboard" and "Start Another RFP"

---

## Key Features

### RFP Editor Page

**Header Actions:**
- `Enable Collaboration` button
- `Request Review` button (navigates to Review page)

**Question Area:**
- Question badge (e.g., "Question 2.3")
- Assigned user and max characters display
- Editor with toolbar (Bold, Italic, Underline, Lists, Link, Image)
- `Save Draft` button (per question)
- `Next Question` button

**Right Sidebar (Toggle):**
1. **AI Suggestions Tab**
   - AI Generated Answers with match percentage
   - "Preview Full" and "Insert" buttons
   
2. **Library Matches Tab**
   - Previous answers from other RFPs
   - "View Source" and "Insert" buttons

3. **Comments Panel**
   - Comment threads with user avatars
   - Reply functionality
   - Recent Activity feed
   - "Add Comment" button

---

## Dummy Data Locations

The following use dummy data that will be replaced with API calls:

### `AISuggestionsPanel.tsx`
- `DUMMY_AI_SUGGESTIONS` - AI generated answer options
- `DUMMY_LIBRARY_MATCHES` - Previous RFP answers

### `CommentsPanel.tsx`
- `DUMMY_COMMENTS` - Comment threads
- `DUMMY_ACTIVITY` - Recent activity items

### `review/[rfpId]/page.tsx`
- `DUMMY_APPROVERS` - Approval progress users

---

## Migration Steps

1. **Backup existing files**

2. **Create new folders:**
   ```bash
   mkdir -p src/app/(dashboard)/review/[rfpId]
   mkdir -p src/app/(dashboard)/export/[rfpId]
   mkdir -p src/app/(dashboard)/success/[rfpId]
   mkdir -p src/components/rfp
   ```

3. **Copy files from this package:**
   - All files in `src/app/`
   - All files in `src/components/`

4. **Remove old files (if different locations):**
   - Remove old `src/app/page.tsx` (moved to `(dashboard)`)
   - Remove old `src/app/rfp/` (moved to `(dashboard)`)
   - Remove old `src/app/preview/` (replaced with new flow)

5. **Update imports if needed**

---

## Dynamic vs Dummy Data

| Feature | Status |
|---------|--------|
| Online users count/avatars | ✅ Dynamic (from CollaborativeEditor) |
| RFP data, questions, answers | ✅ Dynamic (from API) |
| Document outline | ✅ Dynamic |
| Save functionality | ✅ Dynamic |
| Question navigation | ✅ Dynamic |
| AI Suggestions | 🔸 Dummy (API later) |
| Library Matches | 🔸 Dummy (API later) |
| Comments | 🔸 Dummy (API later) |
| Approval Progress | 🔸 Dummy (API later) |
| Journey Summary stats | 🔸 Dummy (API later) |

---

## Notes

1. **CollaborativeEditor**: Only UI was updated. All collaboration functionality (Tiptap, Y.js, awareness) is preserved.

2. **Right Panel Toggle**: Use the floating buttons on the right edge to switch between AI Suggestions and Comments panels.

3. **Preview Page Removed**: The old `/preview/[rfpId]` route is replaced with the new flow: Review → Export → Success.

4. **Sidebar persists**: Using Next.js route groups, the sidebar never re-renders during navigation.