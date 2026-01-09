# Quick Reference: Role-Based System

## Role Comparison Chart

| Feature              | CASH_MANAGER | APPROVER | ADMIN |
| -------------------- | :----------: | :------: | :---: |
| **Create Vouchers**  |      ✅      |    ❌    |  ✅   |
| **View Vouchers**    |      ✅      |    ✅    |  ✅   |
| **Approve Vouchers** |      ❌      |    ✅    |  ✅   |
| **Reject Vouchers**  |      ❌      |    ✅    |  ✅   |
| **Replenishment**    |      ✅      |    ❌    |  ❌   |
| **Budgets**          |      ✅      |    ❌    |  ❌   |
| **Reports**          |      ✅      |    ❌    |  ❌   |
| **Manage Users**     |      ❌      |    ❌    |  ✅   |
| **Settings**         |      ❌      |    ❌    |  ✅   |
| **Audit Logs**       |      ❌      |    ✅    |  ✅   |

## Menu Navigation

### CASH_MANAGER Sidebar

```
🏠 Dashboard
📋 Vouchers
    ➕ New Voucher (button)
💰 Cash Management
    📤 Replenishment
    💵 Budgets
    📊 Reports
💳 Fund Status (widget)
```

### APPROVER Sidebar

```
🏠 Dashboard
📋 Vouchers
✅ Approval Tasks
    👁️ Pending Approvals
    📝 Audit Log
```

### ADMIN Sidebar

```
🏠 Dashboard
📋 Vouchers
⚙️ Administration
    👥 Users
    🔧 Settings
    📝 Audit Log
```

## Key Pages

### CASH_MANAGER

| Page          | URL              | Purpose                 |
| ------------- | ---------------- | ----------------------- |
| Dashboard     | `/`              | Overview of cash status |
| Vouchers      | `/vouchers`      | View & search vouchers  |
| New Voucher   | `/vouchers/new`  | Create voucher          |
| Replenishment | `/replenishment` | Request funds           |
| Budgets       | `/budgets`       | View/manage budgets     |
| Reports       | `/reports`       | Financial reports       |

### APPROVER

| Page              | URL          | Purpose                  |
| ----------------- | ------------ | ------------------------ |
| Dashboard         | `/`          | Overview                 |
| Vouchers          | `/vouchers`  | All vouchers (read-only) |
| Pending Approvals | `/approvals` | Approve/reject vouchers  |
| Audit Log         | `/audit-log` | View action history      |

### ADMIN

| Page      | URL          | Purpose              |
| --------- | ------------ | -------------------- |
| Dashboard | `/`          | Overview             |
| Vouchers  | `/vouchers`  | All vouchers         |
| Users     | `/users`     | Manage users & roles |
| Settings  | `/settings`  | System config        |
| Audit Log | `/audit-log` | Complete audit trail |

## Voucher Workflow

### CREATE PHASE (CASH_MANAGER)

```
1. Login as CASH_MANAGER
2. Go to Vouchers → New Voucher
3. Fill in:
   - Payee
   - Description
   - Amount
   - Date
   - Chart of Account
   - VAT/Net details
4. Submit
5. Status: PENDING
```

### REVIEW PHASE (APPROVER)

```
1. Login as APPROVER
2. Go to Pending Approvals
3. Review voucher details
4. Decision:
   a) Click APPROVE → Status: APPROVED
   b) Click REJECT → Status: REJECTED
5. Action logged in Audit Log
```

### COMPLETE PHASE (CASH_MANAGER)

```
1. See approved vouchers in list
2. Can request replenishment
3. Cannot modify approved vouchers
```

## API Authorization

### Who can call what?

**Voucher Endpoints:**

```
POST   /api/vouchers                 → Everyone (creates with their ID)
GET    /api/vouchers                 → Everyone
GET    /api/vouchers/:id             → Everyone
PATCH  /api/vouchers/:id/approve     → APPROVER, ADMIN
PATCH  /api/vouchers/:id/reject      → APPROVER, ADMIN
```

**User Endpoints:**

```
GET    /api/users                    → Everyone
PATCH  /api/users/:id/role           → ADMIN only
```

**Fund Endpoints:**

```
GET    /api/fund                     → Everyone
PATCH  /api/fund                     → ADMIN only
```

## Practical Examples

### Example 1: Daily Workflow

```
MORNING:
- CASH_MANAGER creates 3 vouchers
- Status: PENDING

MIDDAY:
- APPROVER logs in
- Sees Pending Approvals
- Reviews and approves 2 vouchers
- Rejects 1 voucher for incomplete info

EVENING:
- CASH_MANAGER requests replenishment
- Uses approved vouchers for replenishment request
- ADMIN processes replenishment
```

### Example 2: New User Onboarding

```
STEP 1: ADMIN creates new user account
STEP 2: ADMIN assigns role (preparer/approver/admin)
STEP 3: User logs in
STEP 4: User sees their role-specific interface
STEP 5: User begins their tasks
STEP 6: Audit log records user creation
```

### Example 3: Approver Workflow

```
1. Login
2. See "Pending Approvals" in sidebar
3. Click it → See pending vouchers table
4. Click voucher for details
5. Review expense details
6. Click APPROVE or REJECT
7. Confirm action
8. Voucher updates
9. Audit log updated automatically
```

## Role Selection Guide

**Choose CASH_MANAGER for:**

- ✅ Accounts payable staff
- ✅ Expense handlers
- ✅ Cashiers
- ✅ Finance team creating expenses

**Choose APPROVER for:**

- ✅ Department heads
- ✅ Finance supervisors
- ✅ Cost center managers
- ✅ Budget owners

**Choose ADMIN for:**

- ✅ IT department
- ✅ Finance directors
- ✅ System administrators
- ✅ Account managers

## Troubleshooting

| Issue                     | Check                | Fix                                     |
| ------------------------- | -------------------- | --------------------------------------- |
| Can't create voucher      | Role is APPROVER     | Change role to CASH_MANAGER             |
| Can't approve voucher     | Role is CASH_MANAGER | Change role to APPROVER                 |
| Can't see users page      | Role is not ADMIN    | Only ADMIN can manage users             |
| No fund status in sidebar | Role is APPROVER     | Fund status only shows for CASH_MANAGER |
| Sidebar looks wrong       | Browser cache        | Clear cache & refresh                   |

## URL Access by Role

### CASH_MANAGER can access:

- `/` ✅
- `/vouchers` ✅
- `/vouchers/new` ✅
- `/replenishment` ✅
- `/budgets` ✅
- `/reports` ✅
- `/approvals` ❌ (404)
- `/users` ❌ (404)
- `/settings` ❌ (404)

### APPROVER can access:

- `/` ✅
- `/vouchers` ✅
- `/vouchers/new` ❌ (404)
- `/approvals` ✅
- `/audit-log` ✅
- `/replenishment` ❌ (404)
- `/users` ❌ (404)

### ADMIN can access:

- Everything ✅

## Keyboard Shortcuts (Future)

These are planned for future versions:

```
Pending:
Ctrl+A → Approve voucher
Ctrl+R → Reject voucher
Ctrl+L → Go to Audit Log
```

## Support Commands

To reset a user's role (ADMIN only):

```
Admin Dashboard → Users → Find user → Change Role → Save
```

To view audit trail of actions:

```
Admin/Approver Dashboard → Audit Log → Filter by user/action/date
```

To see pending vouchers count:

```
Approver → Pending Approvals page shows count
Cash Manager → Dashboard shows pending count
```

## Related Documentation

- 📖 [Full Role-Based System Guide](./ROLE_BASED_SYSTEM.md)
- 📖 [Implementation Summary](./IMPLEMENTATION_SUMMARY.md)
- 💾 [Database Schema](./shared/schema.ts)
- 🛣️ [Routes Configuration](./server/routes.ts)
- 🎨 [Frontend Utilities](./client/src/lib/roleUtils.ts)
