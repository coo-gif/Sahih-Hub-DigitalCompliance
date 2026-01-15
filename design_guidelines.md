# Sahih Certifications QMS - Design Guidelines

## Design Approach
**Selected System**: Fluent Design with Material Design influences
**Justification**: Enterprise productivity application requiring information density, clear hierarchy, and professional polish. Fluent's card-based layouts and Material's elevation system provide structure for complex certification workflows.

**Key Principles**:
- Information clarity over visual embellishment
- Consistent spatial rhythm for cognitive ease
- Professional credibility through restrained design
- Scannable data presentation for audit workflows

## Typography System

**Primary Font**: Inter (Google Fonts)
**Secondary Font**: IBM Plex Mono (for certification numbers, codes)

**Scale**:
- Display: text-3xl/font-bold (Dashboard headers)
- Heading 1: text-2xl/font-semibold (Section titles)
- Heading 2: text-xl/font-semibold (Card headers)
- Body: text-base/font-normal (Default content)
- Small: text-sm/font-medium (Labels, metadata)
- Tiny: text-xs/font-normal (Timestamps, auxiliary)

## Layout System

**Spacing Primitives**: Use Tailwind units 2, 4, 6, 8, 12
- Component padding: p-6
- Card gaps: gap-4
- Section margins: mb-8
- Dense lists: gap-2
- Sidebar items: py-2 px-4

**Grid Structure**:
- Dashboard: 3-4 column grid (grid-cols-3 lg:grid-cols-4)
- Task cards: 2-3 columns (grid-cols-2 lg:grid-cols-3)
- Gmail integration: 2-column split (email list + preview)

## Core Components

### Sidebar Navigation (Fixed Left, 280px width)
- Logo section at top (h-16, p-4)
- Main navigation groups with section headers
- Active state: subtle background, left border accent
- Icons: Heroicons (solid for active, outline for inactive)
- User profile at bottom with notification badge
- Collapsible on mobile

### Dashboard Cards
- White background, subtle shadow (shadow-sm)
- Rounded corners (rounded-lg)
- Header with title + action icon
- Body content with generous padding (p-6)
- Footer for metadata/actions
- Hover: slight shadow increase (hover:shadow-md)

### Task Management Cards
- Compact card design (p-4)
- Priority indicator (left colored border: 4px)
- Status badge (top-right, rounded-full, px-3 py-1)
- Due date with calendar icon
- Assignee avatar (w-8 h-8, rounded-full)
- Progress bar at bottom (h-2, rounded-full)
- Drag handle icon (top-left)

### Gmail Integration Inbox
**Layout**: Split-pane design
- Left pane (40%): Email list with sender, subject, preview, timestamp
- Right pane (60%): Full email preview
- Match existing card aesthetic: same shadows, spacing, typography
- Email list items: p-4, border-b, hover:bg-gray-50
- Unread indicator: colored dot (w-2 h-2, rounded-full)
- Email actions toolbar: sticky top with icons (archive, delete, star)
- Category tabs above list: All, Unread, Starred, Important

### Data Tables
- Zebra striping (even rows subtle gray)
- Fixed header on scroll
- Row hover: background highlight
- Sortable columns with arrow indicators
- Pagination at bottom-right

### Forms
- Label above input (text-sm, font-medium, mb-2)
- Input height: h-10
- Border: border-gray-300, rounded-md
- Focus: ring-2 with primary color
- Help text below: text-xs, text-gray-500
- Multi-column forms: grid-cols-2 with gap-6

## Dashboard-Specific Elements

### Status Overview Cards (Top Row)
- 4 metric cards in grid
- Large number display (text-4xl, font-bold)
- Label below (text-sm, text-gray-600)
- Trend indicator icon + percentage
- Icon in top-right corner (w-12 h-12, subtle background circle)

### Certification Timeline
- Vertical timeline component
- Milestone nodes (w-4 h-4, rounded-full)
- Connecting lines between nodes
- Date labels (text-xs) on left, content on right
- Status colors for nodes (pending, in-progress, completed)

### Quick Actions Panel
- Grid of action buttons (grid-cols-2 gap-3)
- Icon + label buttons (p-4, rounded-lg, border)
- Hover: subtle background shift

### Activity Feed
- List of recent actions
- Avatar + action description + timestamp
- Grouped by date with date headers
- "Load more" button at bottom

## Images Section

**Dashboard Hero Banner** (if login/empty state):
- Placement: Above main dashboard content
- Dimensions: Full-width, 240px height
- Content: Professional certification workspace imagery (clean desk with documents, modern office, or abstract certification icons)
- Treatment: Subtle gradient overlay for text legibility
- Text overlay: "Welcome back, [Name]" + quick stats

**Empty States**:
- No active certifications: Illustration of checklist/certificate
- No emails: Simple inbox icon illustration
- Center-aligned, max-w-md, with descriptive text and CTA button

**Note**: Primary interface is data-dense; images used sparingly for empty states and contextual support, not decorative purposes.

## Animations
Minimal, functional only:
- Sidebar collapse/expand (transition-transform, 200ms)
- Card hover shadow (transition-shadow, 150ms)
- Toast notifications (slide-in from top-right)