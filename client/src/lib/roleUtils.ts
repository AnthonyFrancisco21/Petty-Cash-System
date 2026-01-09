import { UserRole } from "@shared/schema";

export function getRoleLabel(role: UserRole | string): string {
  switch (role) {
    case "preparer":
      return "Preparer";
    case "approver":
      return "Approver";
    case "admin":
      return "Administrator";
    default:
      return "Unknown";
  }
}

export function getRoleVariant(
  role: UserRole | string
): "default" | "secondary" | "outline" {
  switch (role) {
    case "preparer":
    case "approver":
    case "admin":
      return "default";
    default:
      return "outline";
  }
}

export function getRoleDescription(role: UserRole | string): string {
  switch (role) {
    case "preparer":
      return "Creates vouchers and manages cash flow";
    case "approver":
      return "Reviews and approves pending vouchers";
    case "admin":
      return "System administration and user management";
    default:
      return "Standard user";
  }
}

// Check if user has admin access
export function hasAdminAccess(role: UserRole | string): boolean {
  return role === "admin";
}

// Check if user can approve vouchers
export function canApproveVouchers(role: UserRole | string): boolean {
  return role === "approver" || role === "admin";
}

// Check if user can create vouchers
export function canCreateVouchers(role: UserRole | string): boolean {
  return role === "preparer" || role === "admin";
}

// Check if user can manage users (assign roles)
export function canManageUsers(role: UserRole | string): boolean {
  return role === "admin";
}

// Check if user can view audit logs
export function canViewAuditLogs(role: UserRole | string): boolean {
  return role === "admin" || role === "approver";
}
