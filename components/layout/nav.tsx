"use client";

import Link from "next/link";
import {
  Calendar,
  Clock,
  LogOut,
  Users,
  Settings,
  CalendarDays,
} from "lucide-react";

type SafeUser = {
  id: string;
  name: string;
  email: string;
  role: "employee" | "manager" | "admin";
  department: string;
  position: string;
  createdAt: string;
  updatedAt: string;
};

export function MainNav({ user }: { user: SafeUser }) {
  const isAdmin = user?.role === "admin";

  return (
    <nav className="flex items-center space-x-4 lg:space-x-6">
      <Link
        href="/dashboard"
        className="text-sm font-medium transition-colors hover:text-primary"
      >
        <Clock className="h-4 w-4 mr-2 inline" />
        ダッシュボード
      </Link>
      <Link
        href="/time-clock"
        className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        <Calendar className="h-4 w-4 mr-2 inline" />
        勤怠管理
      </Link>
      <Link
        href="/attendance"
        className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        <Users className="h-4 w-4 mr-2 inline" />
        勤怠記録
      </Link>
      <Link
        href="/shifts"
        className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        <CalendarDays className="h-4 w-4 mr-2 inline" />
        シフト確認
      </Link>
      {isAdmin && (
        <Link
          href="/admin/shifts/create"
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          <Settings className="h-4 w-4 mr-2 inline" />
          シフト管理
        </Link>
      )}
    </nav>
  );
}
