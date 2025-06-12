import Link from "next/link";
import { User, getCurrentUser } from "@/lib/auth";
import { Calendar, Clock, LogOut, Users, Settings } from "lucide-react";

export function MainNav() {
  const user = getCurrentUser();
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
      {isAdmin && (
        <Link
          href="/admin/shifts"
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          <Settings className="h-4 w-4 mr-2 inline" />
          シフト管理
        </Link>
      )}
    </nav>
  );
}
