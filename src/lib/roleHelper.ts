import { UserRole } from "../types";

export function getDashboardRouteForRole(role?: string): string {
  if (!role) return "/welcome";
  if (role === "Super Admin") return "/super-admin";
  if (role === "Admin") return "/admin";
  if (role === "Organizer") return "/organizer";
  if (role === "Manager") return "/manager";
  if (role === "Employee") return "/employee";
  
  return "/dashboard";
}
