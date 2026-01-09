# Role-Based System Architecture

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER AUTHENTICATION                          │
│                  (Login → Session → User Object)                    │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         ROLE DETERMINATION                          │
│          (Extract user.role from authenticated session)             │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                ┌──────────────┼──────────────┐
                │              │              │
                ▼              ▼              ▼
           CASH_MANAGER    APPROVER        ADMIN
```

## Frontend Architecture

```
App.tsx (Router)
│
├─ Role Detection
│  ├─ hasAdminAccess()
│  ├─ isCashManager
│  └─ isApprover
│
├─ Conditional Routes
│  ├─ Common: Dashboard, Vouchers
│  ├─ Cash Manager: /vouchers/new, /replenishment, /budgets, /reports
│  ├─ Approver: /approvals, /audit-log
│  └─ Admin: /users, /settings, /audit-log
│
└─ AuthenticatedLayout
   │
   └─ AppSidebar (Role-aware)
      ├─ Cash Manager Sidebar
      ├─ Approver Sidebar
      └─ Admin Sidebar
```

## Backend Authorization Flow

```
HTTP Request
│
▼
Passport Session Check (isAuthenticated middleware)
│
├─ Not authenticated → 401 Unauthorized
│
└─ Authenticated
   │
   ▼
   requireRole(...allowedRoles) middleware
   │
   ├─ Get user from database
   ├─ Check user.role
   │
   ├─ Role allowed → next()
   │
   └─ Role not allowed → 403 Forbidden
       │
       └─ Log to Audit Log
```

## Database Schema Relationship

```
┌──────────────┐
│    users     │
├──────────────┤
│ id (PK)      │
│ username     │
│ password     │
│ firstName    │
│ lastName     │
│ role ◄─────────── "cash_manager" | "approver" | "admin"
│ createdAt    │
└──────────────┘
    │         │
    │         └──────────────┐
    │                        │
    ▼                        ▼
┌──────────────┐      ┌──────────────┐
│  vouchers    │      │ auditLogs    │
├──────────────┤      ├──────────────┤
│ id (PK)      │      │ id (PK)      │
│ requestedById├──────┤ userId ──────┤
│ approvedById │      │ action       │
│ status       │      │ timestamp    │
│ ...          │      │ ...          │
└──────────────┘      └──────────────┘
```

## Role Permission Matrix

```
┌─────────────────────┬──────────────┬──────────┬───────┐
│    Permission       │ CASH_MANAGER │ APPROVER │ ADMIN │
├─────────────────────┼──────────────┼──────────┼───────┤
│ Create Voucher      │      ✅      │    ❌    │  ✅   │
│ Read Voucher        │      ✅      │    ✅    │  ✅   │
│ Approve Voucher     │      ❌      │    ✅    │  ✅   │
│ Reject Voucher      │      ❌      │    ✅    │  ✅   │
│ View Replenishment  │      ✅      │    ❌    │  ❌   │
│ View Budgets        │      ✅      │    ❌    │  ❌   │
│ View Reports        │      ✅      │    ❌    │  ❌   │
│ Manage Users        │      ❌      │    ❌    │  ✅   │
│ Assign Roles        │      ❌      │    ❌    │  ✅   │
│ View Audit Log      │      ❌      │    ✅    │  ✅   │
│ System Settings     │      ❌      │    ❌    │  ✅   │
└─────────────────────┴──────────────┴──────────┴───────┘
```

## Data Flow: Voucher Creation & Approval

```
CASH_MANAGER
│
├─ Submit Voucher (POST /api/vouchers)
│  │
│  ├─ Validation: isAuthenticated + canCreateVouchers
│  │
│  ├─ Database: INSERT voucher with status='pending'
│  │
│  └─ Audit Log: CREATE "voucher_created" record
│
▼ (Notification to APPROVER)

APPROVER
│
├─ View Pending Approvals (/approvals)
│  │
│  └─ Query: GET /api/vouchers?status=pending
│
├─ Review Voucher Details
│
└─ Make Decision:
   │
   ├─ APPROVE (PATCH /api/vouchers/:id/approve)
   │  │
   │  ├─ Validation: requireRole("approver", "admin")
   │  │
   │  ├─ Database: UPDATE voucher SET status='approved', approvedById=userId
   │  │
   │  ├─ Audit Log: CREATE "voucher_approved" record
   │  │
   │  └─ Notification: Toast + Query invalidation
   │
   └─ REJECT (PATCH /api/vouchers/:id/reject)
      │
      ├─ Validation: requireRole("approver", "admin")
      │
      ├─ Database: UPDATE voucher SET status='rejected', approvedById=userId
      │
      ├─ Audit Log: CREATE "voucher_rejected" record
      │
      └─ Notification: Toast + Query invalidation
```

## Component Hierarchy

```
App
├─ QueryClientProvider
├─ ThemeProvider
└─ Router
   │
   ├─ (Not Authenticated)
   │  ├─ Landing
   │  └─ Auth
   │
   └─ (Authenticated)
      │
      └─ AuthenticatedLayout
         │
         ├─ SidebarProvider
         │  └─ AppSidebar (Role-aware)
         │     ├─ Cash Manager Menu
         │     ├─ Approver Menu
         │     └─ Admin Menu
         │
         ├─ Header
         │  ├─ SidebarTrigger
         │  ├─ ThemeToggle
         │  └─ LogoutButton
         │
         └─ Main Content (Role-based)
            ├─ Dashboard
            ├─ Vouchers
            ├─ Approvals (Approver)
            ├─ Replenishment (Cash Manager)
            ├─ Budgets (Cash Manager)
            ├─ Reports (Cash Manager)
            ├─ Users (Admin)
            ├─ Settings (Admin)
            └─ AuditLog
```

## File Structure Overview

```
Cash-Flow-Ledger/
│
├─ shared/
│  └─ schema.ts (UserRole type, authorization rules)
│
├─ server/
│  ├─ routes.ts (requireRole middleware, role-based endpoints)
│  ├─ auth.ts (authentication)
│  └─ storage.ts (database operations)
│
├─ client/src/
│  │
│  ├─ lib/
│  │  ├─ roleUtils.ts (Permission checking functions)
│  │  └─ authUtils.ts (Auth helpers)
│  │
│  ├─ components/
│  │  ├─ app-sidebar.tsx (Role-specific navigation)
│  │  └─ ui/ (UI components)
│  │
│  ├─ pages/
│  │  ├─ approvals.tsx (Approver interface)
│  │  ├─ vouchers.tsx (Role-aware voucher list)
│  │  ├─ users.tsx (Admin user management)
│  │  ├─ dashboard.tsx
│  │  └─ ...
│  │
│  ├─ hooks/
│  │  └─ useAuth.ts (User context)
│  │
│  └─ App.tsx (Role-based routing)
│
└─ Documentation/
   ├─ ROLE_BASED_SYSTEM.md (Full reference)
   ├─ IMPLEMENTATION_SUMMARY.md (What changed)
   ├─ QUICK_REFERENCE.md (Quick lookup)
   ├─ DEPLOYMENT_CHECKLIST.md (Deployment steps)
   └─ ARCHITECTURE.md (This file)
```

## Authentication & Authorization Sequence

```
User Login
│
▼
POST /api/login (username, password)
│
├─ Passport Strategy validates credentials
│
├─ Password comparison succeeds
│
├─ Session created with user.id
│
└─ User object returned with role
   │
   ▼
Protected Route Access
│
├─ Browser cookie contains session ID
│
├─ isAuthenticated() checks passport session
│
│  (Success: user.role available)
│  (Failure: 401 Unauthorized)
│
├─ requireRole middleware runs
│
├─ Database lookup: storage.getUser(userId)
│
├─ Compare user.role with allowed roles
│
│  (Match: next() proceeds)
│  (No match: 403 Forbidden)
│
└─ Request processed
   │
   ▼
Action logged to audit_logs table
```

## API Endpoint Pyramid

```
                    ┌─ ADMIN Only ─┐
                    │ /users/:id/role
                    │ /fund (PATCH)
                    │ /settings
                    └───────────────┘
                  ┌─ ADMIN + APPROVER ─┐
                  │ /vouchers/:id/approve
                  │ /vouchers/:id/reject
                  │ /audit-log
                  └────────────────────┘
          ┌─ ADMIN + CASH_MANAGER + APPROVER ─┐
          │ /vouchers (all queries)
          │ /chart-of-accounts
          │ /fund (GET)
          └────────────────────────────────────┘
    ┌─ All Authenticated Users ─┐
    │ /auth/user
    │ /users (GET list)
    │ /logout
    └───────────────────────────┘
┌─ Public ─┐
│ /login
│ /register
└──────────┘
```

## Role Workflow Timeline

```
Day 1: Setup
├─ Admin creates users
└─ Admin assigns roles

Day 2: Operation
├─ 09:00 - Cash Manager creates vouchers
├─ 10:00 - Approver reviews pending
├─ 11:00 - Approver approves/rejects
├─ 14:00 - Cash Manager requests replenishment
├─ 15:00 - Admin processes replenishment
└─ 16:00 - All actions logged in audit trail

Day 3: Reporting
├─ Admin views complete audit log
├─ Reports show all transactions
└─ Next cycle begins
```

## Security Layers

```
Layer 1: Authentication
├─ Passport.js with LocalStrategy
├─ Password hashing with scrypt
└─ Session-based auth

Layer 2: Authorization
├─ Passport session check
├─ requireRole middleware
└─ Database role verification

Layer 3: Audit Logging
├─ All actions logged
├─ User ID recorded
└─ Timestamp tracking

Layer 4: Frontend Controls
├─ Conditional rendering
├─ Route guards
└─ UI helpers (roleUtils)
```

## Error Handling

```
Error Types & Responses:

401 Unauthorized
├─ Cause: User not authenticated
└─ Action: Redirect to login

403 Forbidden
├─ Cause: User role doesn't have permission
└─ Action: Show 404 or error message

404 Not Found
├─ Cause: Route doesn't exist for role
└─ Action: Redirect to 404 page

500 Server Error
├─ Cause: Server-side error
└─ Action: Log error + show user-friendly message
```

## Performance Considerations

```
Query Optimization:
├─ User role check (single lookup)
├─ Voucher queries with pagination
└─ Audit log queries indexed

Caching:
├─ User data cached in React Query
├─ Role checks performed once per route
└─ Fund status cached on sidebar

Bundle Impact:
├─ roleUtils.ts: ~1KB gzipped
├─ New approvals.tsx: ~8KB gzipped
└─ Total impact: minimal
```

## Scalability Considerations

```
For 1,000+ users:
├─ Index on users(role)
├─ Index on vouchers(status)
├─ Index on auditLogs(userId)
└─ Pagination on list pages

For 100,000+ vouchers:
├─ Implement archival strategy
├─ Use date-based partitioning
└─ Optimize query filters

For concurrent users:
├─ Connection pooling
├─ Rate limiting on endpoints
└─ Caching strategy
```

---

## Key Design Principles

1. **Separation of Concerns**

   - Roles handled at DB schema level
   - Authorization at API middleware level
   - UI at component/route level

2. **Defense in Depth**

   - Backend validates roles (can't be bypassed)
   - Frontend guards for UX
   - Audit logging for accountability

3. **Minimal Coupling**

   - Role utilities are independent
   - Can add new roles without breaking code
   - Extensible permission checking

4. **Clear Responsibility**

   - Cash Manager: Create transactions
   - Approver: Review transactions
   - Admin: System management

5. **Audit Trail**
   - All sensitive actions logged
   - User and timestamp recorded
   - Enables compliance & debugging
