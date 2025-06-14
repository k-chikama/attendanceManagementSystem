import { createContext, useContext } from "react";

export type SafeUser = {
  id: string;
  name: string;
  email: string;
  role: "employee" | "manager" | "admin";
  department: string;
  position: string;
  createdAt: string;
  updatedAt: string;
};

export const UserContext = createContext<SafeUser | null>(null);
export const useUser = () => useContext(UserContext);
