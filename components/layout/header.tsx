"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Calendar,
  Clock,
  FileText,
  Home,
  LogOut,
  Menu,
  User,
  X,
  Settings,
  Users,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";

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

interface HeaderProps {
  user: SafeUser;
}

const navigationItems: {
  name: string;
  href: string;
  icon: any;
  adminOnly?: boolean;
}[] = [
  {
    name: "ダッシュボード",
    href: "/dashboard",
    icon: Home,
  },
  {
    name: "勤怠打刻",
    href: "/time-clock",
    icon: Clock,
  },
  {
    name: "勤怠管理",
    href: "/attendance",
    icon: Calendar,
  },
  {
    name: "休暇申請",
    href: "/leave",
    icon: FileText,
  },
  {
    name: "レポート",
    href: "/reports",
    icon: FileText,
  },
  {
    name: "シフト表",
    href: "/shifts",
    icon: Calendar,
  },
  {
    name: "シフト管理",
    href: "/admin/shifts/create",
    icon: Settings,
    adminOnly: true,
  },
  {
    name: "勤怠管理",
    href: "/admin/attendance",
    icon: Users,
    adminOnly: true,
  },
];

export default function Header({ user }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await signOut(auth);
      toast({
        title: "ログアウトしました",
        description: "ログインページにリダイレクトします。",
      });
      router.push("/login");
    } catch (error) {
      console.error("ログアウトエラー:", error);
      toast({
        variant: "destructive",
        title: "エラー",
        description: "ログアウトに失敗しました。",
      });
    } finally {
      setIsLoggingOut(false);
      setIsOpen(false);
    }
  };

  const handleNavigation = () => {
    setIsOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto max-w-7xl px-2 sm:px-4 lg:px-6">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-1 sm:gap-2 md:gap-4 min-w-0 flex-1">
            <Link
              href="/dashboard"
              className="flex items-center space-x-1 sm:space-x-2 transition-colors hover:text-primary shrink-0"
            >
              <span className="text-sm sm:text-base md:text-lg font-semibold tracking-tight whitespace-nowrap">
                勤怠管理システム
              </span>
            </Link>
            <nav className="flex items-center space-x-1 xl:space-x-2 overflow-x-auto scrollbar-hide min-w-0 flex-1 ml-2 sm:ml-4 max-w-full">
              {navigationItems.map((item) => {
                if (item.adminOnly && user.role !== "admin") {
                  return null;
                }
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center px-2 sm:px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 min-w-[70px] sm:min-w-[80px] md:min-w-[90px] lg:min-w-[100px] justify-center",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    <item.icon className="h-4 w-4 mr-1 sm:mr-2 shrink-0" />
                    <span className="hidden sm:inline">{item.name}</span>
                    <span className="sm:hidden text-xs">
                      {item.name.substring(0, 2)}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 lg:gap-4 shrink-0">
            <div className="hidden sm:flex items-center gap-1 sm:gap-2">
              <Link
                href="/profile"
                className="flex items-center text-sm text-muted-foreground hover:text-foreground whitespace-nowrap px-2 sm:px-3 py-2"
              >
                <User className="h-4 w-4 mr-1 sm:mr-2 shrink-0" />
                <span className="hidden md:inline">{user.name}さん</span>
                <span className="md:hidden">プロフィール</span>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="text-muted-foreground hover:text-foreground whitespace-nowrap px-2 sm:px-3 py-2"
              >
                <LogOut className="h-4 w-4 mr-1 sm:mr-2 shrink-0" />
                <span className="hidden md:inline">
                  {isLoggingOut ? "ログアウト中..." : "ログアウト"}
                </span>
                <span className="md:hidden">ログアウト</span>
              </Button>
            </div>

            {/* モバイルメニュー */}
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="sm:hidden -mr-1">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">メニューを開く</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] sm:w-[320px]">
                <SheetHeader>
                  <SheetTitle>メニュー</SheetTitle>
                </SheetHeader>
                <div className="mt-4 sm:mt-6 flex flex-col space-y-2 sm:space-y-4">
                  {navigationItems.map((item) => {
                    if (item.adminOnly && user.role !== "admin") {
                      return null;
                    }
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={handleNavigation}
                        className={cn(
                          "flex items-center px-3 sm:px-4 py-2 text-sm font-medium rounded-md transition-colors",
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        )}
                      >
                        <item.icon className="h-4 w-4 mr-2" />
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                  <div className="border-t pt-3 sm:pt-4 mt-3 sm:mt-4">
                    <Link
                      href="/profile"
                      onClick={handleNavigation}
                      className="flex items-center px-3 sm:px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md"
                    >
                      <User className="h-4 w-4 mr-2" />
                      {user.name}さん
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      className="w-full justify-start text-muted-foreground hover:text-foreground px-3 sm:px-4 py-2"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      {isLoggingOut ? "ログアウト中..." : "ログアウト"}
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
