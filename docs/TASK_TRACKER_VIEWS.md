# Standard Task Views

This document defines the canonical views for the **Tasks Tracker**.

### 1. 📥 Triage / Inbox
- **Filter**: `Status` = "To do"
- **Sort**: Created time (Ascending)
- **Purpose**: Rapidly triage incoming requests and assign priorities.

### 2. ✅ My Tasks
- **Filter**: `Owner` = Current User AND `Status` != "Done"
- **Sort**: Priority (P0 > P3)
- **Purpose**: Individual daily focus.

### 3. 🗓️ This Week
- **Filter**: `Due date` within next 7 days AND `Status` != "Done"
- **Sort**: Due date (Ascending)
- **Purpose**: Short-term tactical execution.

### 4. 🛑 Blocked
- **Filter**: `Status` = "Blocked"
- **Purpose**: Identify and resolve operational bottlenecks.

### 5. ⏳ Done (30d)
- **Filter**: `Status` = "Done" AND `Last edited` within 30 days
- **Sort**: Completed date (Descending)
- **Purpose**: Track recent velocity and progress.
