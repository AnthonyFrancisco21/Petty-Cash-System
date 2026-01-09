# Role-Based Access Control System

## Overview

The Cash Flow Ledger system has been redesigned with three distinct roles, each with specific responsibilities and permissions.

## Roles

### 1. PREPARER

**Responsibilities:** Creates and manages petty cash vouchers

**Permissions:**

- ✅ Create new vouchers
- ✅ View all vouchers (created and accepted/rejected ones)
- ✅ View dashboard
- ✅ Access replenishment requests
- ✅ View budgets and financial reports
- ✅ View fund balance and status in sidebar

**Sidebar Navigation:**

- Dashboard
- Vouchers (create and view)
- Replenishment
- Budgets
- Reports
- Fund Status widget

**Pages:**

- `/` - Dashboard
- `/vouchers` - View all vouchers with creation capability
- `/vouchers/new` - Create new voucher
- `/replenishment` - Request fund replenishment
- `/budgets` - View and manage budgets
- `/reports` - View financial reports

---

### 2. APPROVER

**Responsibilities:** Reviews and approves/rejects pending vouchers

**Permissions:**

- ✅ View all vouchers
- ✅ Approve pending vouchers
- ✅ Reject pending vouchers
- ✅ View audit logs
- ✅ Cannot create vouchers
- ✅ Cannot manage cash or access replenishment

**Sidebar Navigation:**

- Dashboard
- Vouchers (view only)
- Pending Approvals (dedicated approval interface)
- Audit Log

**Pages:**

- `/` - Dashboard
- `/vouchers` - View all vouchers (read-only)
- `/approvals` - Dedicated interface for pending vouchers with action buttons
- `/audit-log` - View system audit logs

**Key Features:**

- Dedicated "Pending Approvals" page showing only pending vouchers
- Approve button: Changes status to "approved"
- Reject button: Changes status to "rejected"
- Audit trail of all actions recorded

---

### 3. ADMIN

**Responsibilities:** Technical system management and user administration

**Permissions:**

- ✅ Manage user roles (assign/change roles)
- ✅ System settings
- ✅ View audit logs
- ✅ All other permissions (admin override)
- ✅ Access to technical configuration

**Sidebar Navigation:**

- Dashboard
- Vouchers
- Users (user management)
- Settings
- Audit Log
- Administration section

**Pages:**

- `/` - Dashboard
- `/vouchers` - View all vouchers
- `/users` - User management and role assignment
- `/settings` - System settings configuration
- `/audit-log` - View detailed system audit logs

**Key Features:**

- User role assignment interface
- System configuration access
- Complete audit trail visibility

---

## Database Schema Updates

### Users Table

```typescript
export type UserRole = "preparer" | "approver" | "admin";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  role: text("role").notNull().default("preparer"),
  createdAt: timestamp("created_at").defaultNow(),
});
```

---

## Authorization Rules

### Voucher Creation

- **Allowed for:** PREPARER, ADMIN
- **Endpoint:** `POST /api/vouchers`

### Voucher Approval

- **Allowed for:** APPROVER, ADMIN
- **Endpoint:** `PATCH /api/vouchers/:id/approve`

### Voucher Rejection

- **Allowed for:** APPROVER, ADMIN
- **Endpoint:** `PATCH /api/vouchers/:id/reject`

### User Role Management

- **Allowed for:** ADMIN only
- **Endpoint:** `PATCH /api/users/:id/role`

---

## Frontend Utilities

### Role Helper Functions

Located in `client/src/lib/roleUtils.ts`:

```typescript
// Get display label for role
getRoleLabel(role: UserRole): string

// Get badge variant for role
getRoleVariant(role: UserRole): "default" | "secondary" | "outline"

// Get role description
getRoleDescription(role: UserRole): string

// Check permissions
hasAdminAccess(role: UserRole): boolean
canApproveVouchers(role: UserRole): boolean
canCreateVouchers(role: UserRole): boolean
canManageUsers(role: UserRole): boolean
canViewAuditLogs(role: UserRole): boolean
```

### Usage Example

```typescript
import { canCreateVouchers, hasAdminAccess } from "@/lib/roleUtils";

const { user } = useAuth();

if (canCreateVouchers(user?.role)) {
  // Show create button
}

if (hasAdminAccess(user?.role)) {
  // Show admin options
}
```

---

## Sidebar Navigation by Role

### Preparer View

```
Navigation
├── Dashboard
└── Vouchers
Cash Management
├── Replenishment
├── Budgets
└── Reports
Fund Status
├── Balance: ₱[amount]
└── Progress indicator
```

### Approver View

```
Navigation
├── Dashboard
└── Vouchers
Approval Tasks
├── Pending Approvals
└── Audit Log
```

### Admin View

```
Navigation
├── Dashboard
└── Vouchers
Administration
├── Users
├── Settings
└── Audit Log
```

---

## Routing Logic

### Protected Routes by Role

```
Dashboard (/)
  ✅ All roles

Vouchers (/vouchers)
  ✅ All roles (read based on role permissions)

New Voucher (/vouchers/new)
  ✅ PREPARER, ADMIN

Replenishment (/replenishment)
  ✅ PREPARER, ADMIN

Budgets (/budgets)
  ✅ PREPARER, ADMIN

Reports (/reports)
  ✅ PREPARER, ADMIN

Pending Approvals (/approvals)
  ✅ APPROVER, ADMIN

Audit Log (/audit-log)
  ✅ APPROVER, ADMIN

Users (/users)
  ✅ ADMIN

Settings (/settings)
  ✅ ADMIN
```

---

## API Endpoints with Role Authorization

### Authentication

```
POST /api/register         - Public (new user registration)
POST /api/login            - Public
POST /api/logout           - All authenticated users
GET  /api/user             - All authenticated users
```

### Users

```
GET  /api/users            - All authenticated users
PATCH /api/users/:id/role  - ADMIN only
```

### Vouchers

```
GET  /api/vouchers                 - All authenticated users
GET  /api/vouchers/stats           - All authenticated users
POST /api/vouchers                 - All authenticated users
PATCH /api/vouchers/:id/approve    - APPROVER, ADMIN
PATCH /api/vouchers/:id/reject     - APPROVER, ADMIN
PATCH /api/vouchers/:id/submit     - All authenticated users
```

### Chart of Accounts

```
GET  /api/chart-of-accounts        - All authenticated users
POST /api/chart-of-accounts        - ADMIN
```

### Fund Management

```
GET  /api/fund                     - All authenticated users
PATCH /api/fund                    - ADMIN
```

---

## Migration Guide

If upgrading from previous role system:

1. **Old roles:**

   - `requester` → Remove (consolidate to `cash_manager`)
   - `cash_manager` → Migrate to `preparer`
   - `admin` → Keep as `admin`

2. **New roles:**

   - `preparer` - Handles voucher creation
   - `approver` - Handles voucher approval
   - `admin` - System administration

3. **Database Migration:**

```sql
-- If you have old 'requester' users, migrate them:
UPDATE users SET role = 'preparer' WHERE role = 'requester';

-- Migrate existing cash_manager users to preparer
UPDATE users SET role = 'preparer' WHERE role = 'cash_manager';

-- Verify migration
SELECT role, COUNT(*) FROM users GROUP BY role;
```

---

## Audit Logging

All role-based actions are logged:

- Voucher creation
- Voucher approval
- Voucher rejection
- User role assignment
- System configuration changes

Audit logs can be viewed by:

- **APPROVER**: View relevant approval actions
- **ADMIN**: View all system actions

---

## Security Considerations

1. **Role Validation:** Every protected endpoint validates the user's role
2. **Authorization Middleware:** `requireRole()` middleware enforces permissions
3. **Session Management:** Sessions are invalidated on logout
4. **Audit Trail:** All sensitive actions are logged with user information

---

## Testing Roles

To test different roles:

1. Create users with different roles through `/users` page (ADMIN only)
2. Or create test data with SQL:

```sql
-- Create test users
INSERT INTO users (username, password, first_name, last_name, role)
VALUES
  ('preparer1', 'hashedpass1', 'John', 'Preparer', 'preparer'),
  ('approver1', 'hashedpass2', 'Jane', 'Reviewer', 'approver'),
  ('admin1', 'hashedpass3', 'Admin', 'User', 'admin');
```

---

## Support & Troubleshooting

### Issue: User can't access their role's pages

**Solution:** Clear browser cache and reload. Verify user's role in database.

### Issue: Approval buttons not visible

**Solution:** Verify user has `approver` or `admin` role. Check browser console for errors.

### Issue: Role mismatch after database migration

**Solution:** Run the migration SQL to consolidate old roles to new role system.

---

## Future Enhancements

Potential improvements to the role-based system:

- [ ] Custom role creation
- [ ] Permission groups
- [ ] Time-based role escalation
- [ ] Delegation of approval authority
- [ ] Role-based reporting
