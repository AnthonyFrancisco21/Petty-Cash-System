# P CashManager Design Guidelines

## Design Approach
**Selected Approach:** Design System with Productivity Tool Inspiration
- Primary Reference: Linear's clean data presentation + Stripe's financial clarity
- Design System: Fluent Design principles for enterprise productivity
- **Rationale:** Financial applications require clarity, precision, and efficiency. Users need to quickly scan data, enter information accurately, and track fund status without distraction.

## Core Design Principles
1. **Data Clarity First:** Financial figures and status indicators are the hero elements
2. **Hierarchical Scanning:** Enable quick comprehension of fund status, pending requests, and disbursement history
3. **Trust Through Precision:** Clean layouts and consistent spacing convey professionalism

## Typography System

**Font Families:**
- Primary: Inter (Google Fonts) - for UI elements and body text
- Monospace: JetBrains Mono - for financial figures, account codes, amounts

**Type Scale:**
- Page Headers: text-3xl font-semibold
- Section Headers: text-xl font-semibold
- Card Titles: text-lg font-medium
- Body Text: text-base font-normal
- Financial Figures: text-2xl font-mono font-semibold
- Labels: text-sm font-medium uppercase tracking-wide
- Helper Text: text-sm
- Table Data: text-sm font-mono (for amounts and codes)

## Layout System

**Spacing Primitives:** Use Tailwind units of 2, 4, 6, and 8 consistently
- Component padding: p-6
- Card spacing: space-y-6
- Form field gaps: gap-4
- Section margins: my-8
- Container padding: px-6 md:px-8

**Grid Structure:**
- Dashboard: max-w-7xl mx-auto
- Forms: max-w-3xl mx-auto
- Tables: w-full with horizontal scroll on mobile
- Two-column forms: grid grid-cols-1 md:grid-cols-2 gap-6

## Component Library

### Dashboard Components
**Fund Status Card:**
- Large financial figure display with label above
- Progress indicator showing depletion percentage
- Grid layout: Current Balance | Imprest Amount | Remaining %
- Prominent visual hierarchy for critical fund status

**Quick Action Panel:**
- Primary actions: "New Disbursement" and "Request Replenishment" buttons
- Secondary actions in dropdown menu
- Sticky positioning on scroll for easy access

### Forms
**Voucher Entry Form:**
- Single-column layout on mobile, two-column on desktop
- Group related fields: Financial Details section, Approval section, Accounting section
- Required field indicators (asterisk)
- Field structure: Label above input, helper text below
- Date picker with calendar icon
- Autocomplete dropdowns for requesters/approvers from database
- Monetary inputs: Right-aligned with currency symbol prefix
- VAT calculation: Auto-compute total from net amount + VAT fields

**Form Controls:**
- Input fields: h-10 with clear focus states
- Dropdowns: Searchable select with user avatars
- Buttons: h-10 with icon + label for primary actions
- File upload: Drag-and-drop zone for invoice attachments

### Data Display
**Disbursement Register Table:**
- Fixed header row with sortable columns
- Columns: Date | Voucher # | Payee | Description | Amount | VAT | Net | Status | Actions
- Alternating row treatment for readability
- Right-align all numerical columns
- Status badges: Pending/Approved/Replenished with visual distinction
- Expandable rows for additional details (Chart of Account, Approver, etc.)
- Sticky header on scroll
- Column filters: Date range picker, payee search, status filter

**Replenishment Report:**
- Summary cards at top: Total Disbursed | Total VAT | Total Withheld
- Grouped by Chart of Account code with subtotals
- Export button (CSV format) prominently placed
- Print-friendly layout option

### Navigation
**Top Navigation Bar:**
- Logo/App name left
- Main nav center: Dashboard | Vouchers | Replenishment | Users (admin only)
- User menu right: Profile avatar with dropdown (Settings, Logout)
- Role badge indicator next to username

**Sidebar (Desktop only):**
- Collapsible for more screen space
- Icons from Heroicons with labels
- Active state indicator
- Quick fund status widget at bottom

### Approval Workflow
**Pending Requests View:**
- Card-based layout for each pending voucher
- Clear requester information with avatar
- Request details in structured format
- Approve/Reject buttons with confirmation modal
- Comment field for rejection reasons

### Icons
**Icon Library:** Heroicons (via CDN)
- Dashboard: ViewGridIcon
- Vouchers: DocumentTextIcon
- Money: CashIcon, CurrencyDollarIcon
- Users: UserGroupIcon
- Approve: CheckCircleIcon
- Reject: XCircleIcon
- Export: DownloadIcon

## Authentication & User Management
**Login Screen:**
- Centered card (max-w-md) with logo above
- Clean form: Email/Username and Password fields
- "Remember me" checkbox
- Replit Auth integration for OAuth options
- Role assignment happens post-authentication

**User Database Interface:**
- Table view of all users with Name | Email | Role | Status
- Inline role editing for admins
- Add user modal with role selection dropdown

## Responsive Behavior
- Mobile: Stack all cards and forms single-column, horizontal scroll for tables
- Tablet: Two-column grids where appropriate
- Desktop: Full multi-column layouts with sidebar navigation

## Professional Touches
- Loading states for data fetches with skeleton screens
- Empty states with helpful illustrations and CTAs
- Success/error toast notifications for actions
- Confirmation modals for critical actions (approval, replenishment submission)
- Auto-save indicators for form drafts

**Critical Constraint:** No animations beyond subtle transitions (200ms) on state changes. Financial data demands stability.