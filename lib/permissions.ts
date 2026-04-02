import { Role } from "@prisma/client";

export const can = {
  viewClientInfo: (role: Role) =>
    ["ADMIN", "INTAKE", "OPS", "ACCOUNTS"].includes(role),
  viewFinancials: (role: Role) => ["ADMIN", "ACCOUNTS"].includes(role),
  createJob: (role: Role) => ["ADMIN", "INTAKE"].includes(role),
  editDiagnosis: (role: Role) =>
    ["ADMIN", "TECHNICIAN_INTERNAL", "TECHNICIAN_EXTERNAL"].includes(role),
  manageUsers: (role: Role) => role === "ADMIN",
  approveWork: (role: Role) => ["ADMIN", "OPS"].includes(role),
};
