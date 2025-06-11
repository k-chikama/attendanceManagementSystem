"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "./header";
import { User, getCurrentUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

type SafeUser = Omit<User, "password">;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<SafeUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = getCurrentUser();

        if (!currentUser) {
          if (typeof window !== "undefined") {
            toast({
              title: "セッション切れ",
              description: "ログインページにリダイレクトします。",
            });
            router.push("/login");
          }
        } else {
          setUser(currentUser);
        }
      } catch (error) {
        console.error("[AppLayout] 認証チェックエラー:", error);
        toast({
          variant: "destructive",
          title: "エラー",
          description: "認証チェックに失敗しました。",
        });
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router, toast]);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

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
