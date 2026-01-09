# Role-Based System Implementation Checklist

## ✅ Completed Items

### Database & Schema

- ✅ Updated `UserRole` type to include: `"cash_manager" | "approver" | "admin"`
- ✅ Removed obsolete `"requester"` role
- ✅ Updated default role to `"cash_manager"`
- ✅ Schema file: `shared/schema.ts`

### Backend Authorization

- ✅ Updated `requireRole()` middleware
- ✅ Simplified role validation (removed legacy mapping)
- ✅ Updated approval endpoints to require `approver` or `admin`
- ✅ Restricted user role assignment to `admin` only
- ✅ File: `server/routes.ts`

### Frontend Utilities

- ✅ Created `client/src/lib/roleUtils.ts` with:
  - `getRoleLabel()` - Display friendly role names
  - `getRoleVariant()` - Badge styling
  - `getRoleDescription()` - Role descriptions
  - `hasAdminAccess()` - Admin permission check
  - `canApproveVouchers()` - Approval permission check
  - `canCreateVouchers()` - Creation permission check
  - `canManageUsers()` - User management check
  - `canViewAuditLogs()` - Audit log access check

### Sidebar Navigation

- ✅ Complete redesign in `client/src/components/app-sidebar.tsx`
- ✅ Cash Manager: Dashboard, Vouchers, Replenishment, Budgets, Reports, Fund Status
- ✅ Approver: Dashboard, Vouchers, Pending Approvals, Audit Log
- ✅ Admin: Dashboard, Vouchers, Users, Settings, Audit Log
- ✅ Role-specific grouping and display

### Application Routing

- ✅ Updated `client/src/App.tsx` with role-based routes
- ✅ Cash Manager routes protected
- ✅ Approver routes protected
- ✅ Admin routes protected
- ✅ Common routes accessible to all

### New Pages

- ✅ Created `client/src/pages/approvals.tsx`
  - Displays pending vouchers
  - Approve button with confirmation
  - Reject button with confirmation
  - Toast notifications
  - Audit logging

### Existing Pages Updated

- ✅ `client/src/pages/vouchers.tsx` enhanced with:
  - Role-aware headings and descriptions
  - Conditional "New Voucher" button
  - `canCreateVouchers()` utility usage

### Documentation

- ✅ `ROLE_BASED_SYSTEM.md` - Complete reference guide
- ✅ `IMPLEMENTATION_SUMMARY.md` - What changed and why
- ✅ `QUICK_REFERENCE.md` - Quick lookup guide
- ✅ This checklist

## 📋 Pre-Deployment Checklist

### Database Preparation

- [ ] Backup production database
- [ ] Review current user roles:
  ```sql
  SELECT role, COUNT(*) FROM users GROUP BY role;
  ```
- [ ] Migrate existing `requester` users:
  ```sql
  UPDATE users SET role = 'cash_manager' WHERE role = 'requester';
  ```
- [ ] Verify role migration:
  ```sql
  SELECT role, COUNT(*) FROM users GROUP BY role;
  ```

### Backend Setup

- [ ] Pull latest code
- [ ] Update dependencies if needed
- [ ] Test role-based endpoints:

  ```bash
  # Test as cash_manager
  curl /api/vouchers/1/approve  # Should fail

  # Test as approver
  curl /api/vouchers/1/approve  # Should succeed

  # Test as admin
  curl /api/users/1/role        # Should succeed
  ```

### Frontend Setup

- [ ] Pull latest code
- [ ] Install dependencies
- [ ] Clear browser cache
- [ ] Test build: `npm run build`

### Testing

- [ ] Test as CASH_MANAGER
  - [ ] Create voucher
  - [ ] View vouchers
  - [ ] Access replenishment
  - [ ] Access budgets
  - [ ] Access reports
  - [ ] See fund status
  - [ ] Cannot access approvals
  - [ ] Cannot access users
- [ ] Test as APPROVER
  - [ ] View vouchers (read-only)
  - [ ] Access pending approvals
  - [ ] Approve a voucher
  - [ ] Reject a voucher
  - [ ] View audit log
  - [ ] Cannot create voucher
  - [ ] Cannot access cash management
- [ ] Test as ADMIN

  - [ ] Access users page
  - [ ] Assign roles to users
  - [ ] Access settings
  - [ ] View audit logs
  - [ ] Access all features

- [ ] Test Route Protection
  - [ ] APPROVER accessing `/vouchers/new` → 404
  - [ ] CASH_MANAGER accessing `/approvals` → 404
  - [ ] ADMIN accessing all routes → 200

### Security Review

- [ ] Verify authorization middleware is applied
- [ ] Check that old role mappings are removed
- [ ] Confirm audit logging for role changes
- [ ] Test session invalidation on logout
- [ ] Verify no console errors or warnings

### Performance

- [ ] Check bundle size (roleUtils.ts is minimal)
- [ ] Test page load times per role
- [ ] Verify no N+1 queries on user loading
- [ ] Test with multiple concurrent users

### Rollback Plan

- [ ] Document current schema state
- [ ] Have backup SQL to revert roles if needed:
  ```sql
  UPDATE users SET role = 'requester' WHERE role = 'cash_manager';
  ```
- [ ] Have previous version available
- [ ] Document rollback procedure

## 🚀 Deployment Steps

1. **Pre-Deployment**

   - [ ] Run database backup
   - [ ] Run pre-deployment checks above
   - [ ] Get stakeholder approval

2. **Code Deployment**

   - [ ] Deploy backend changes
   - [ ] Deploy frontend changes
   - [ ] Verify deployment successful

3. **Database Migration**

   - [ ] Run role migration SQL
   - [ ] Verify migration results
   - [ ] Document any issues

4. **Testing**

   - [ ] Quick smoke test as each role
   - [ ] Verify no errors in logs
   - [ ] Check database constraints

5. **Monitoring**

   - [ ] Monitor error logs
   - [ ] Watch for authorization failures
   - [ ] Track user feedback

6. **Communication**
   - [ ] Notify users of new system
   - [ ] Share documentation
   - [ ] Provide support contact

## 📚 Documentation for Users

### To Share with Users:

- [ ] QUICK_REFERENCE.md - For quick lookups
- [ ] ROLE_BASED_SYSTEM.md - Complete guide
- [ ] Role-specific email with their role details

### Communication Template:

```
Subject: New Role-Based System for Cash Flow Ledger

Dear Team,

We have deployed a new role-based access system with three distinct roles:

1. CASH_MANAGER - Create and manage vouchers
2. APPROVER - Review and approve/reject vouchers
3. ADMIN - System administration

Your role is: [INSERT ROLE]

Quick Guide:
- You can access: [LIST FEATURES]
- You cannot access: [LIST RESTRICTED FEATURES]

See attached documentation for details.
Questions? Contact: [SUPPORT EMAIL]

Best regards,
[ADMIN NAME]
```

## 🔍 Post-Deployment Verification

- [ ] All users can login
- [ ] Sidebars show correct options per role
- [ ] Approve/reject buttons work for APPROVER
- [ ] New voucher button only visible to CASH_MANAGER
- [ ] Users page only accessible to ADMIN
- [ ] Audit logs record all actions
- [ ] No permission errors in logs
- [ ] Performance is acceptable

## ⚠️ Known Issues & Solutions

### Issue: Old Role Still Visible

**Solution:**

```sql
UPDATE users SET role = 'cash_manager' WHERE role = 'requester';
```

### Issue: User Locked Out

**Solution:**

```sql
-- Re-assign user role
UPDATE users SET role = 'cash_manager' WHERE id = [user_id];
```

### Issue: Sidebar Not Updating

**Solution:**

- Clear browser cache
- Hard refresh (Ctrl+Shift+R)
- Re-login

### Issue: Approval Buttons Not Showing

**Solution:**

- Verify user role is `approver` or `admin`
- Check browser console for errors
- Verify backend authorization middleware is working

## 📞 Support Contacts

**System Questions:**

- Check ROLE_BASED_SYSTEM.md

**Technical Issues:**

- Review IMPLEMENTATION_SUMMARY.md
- Check server logs for authorization errors
- Verify database role values

**User Access Issues:**

- Verify role in database
- Check audit logs for attempts
- Re-assign role if needed

## ✨ Future Enhancements

These items are planned for future versions:

- [ ] Role delegation (temporary authority transfer)
- [ ] Custom role creation
- [ ] Permission groups
- [ ] Approval workflows with multiple levels
- [ ] Email notifications for pending approvals
- [ ] Bulk role assignment
- [ ] Role usage analytics
- [ ] Time-based role escalation

## 📝 Sign-Off

- [ ] Development complete
- [ ] Testing complete
- [ ] Documentation complete
- [ ] Security review passed
- [ ] Stakeholder approval obtained
- [ ] Deployment approved
- [ ] Post-deployment verified

**Deployed by:** ********\_********  
**Date:** ********\_********  
**Status:** ********\_********

---

## Questions?

Refer to the comprehensive documentation:

- Quick lookups: `QUICK_REFERENCE.md`
- Full details: `ROLE_BASED_SYSTEM.md`
- What changed: `IMPLEMENTATION_SUMMARY.md`
- Code: Review files listed in IMPLEMENTATION_SUMMARY.md
