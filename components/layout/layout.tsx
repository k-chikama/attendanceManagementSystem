"use client";

import { useUser } from "@/contexts/UserContext";
import Header from "./header";
import { MainNav } from "@/components/layout/nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const user = useUser();

  if (!user) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="text-lg">未ログインです</div>
          <div className="text-sm text-muted-foreground">
            ログインページへリダイレクト中...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header user={user} />
      <MainNav user={user} />
      <main className="flex-1 w-full">
        <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
      <footer className="border-t py-4 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} 勤怠管理システム
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
