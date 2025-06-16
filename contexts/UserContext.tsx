"use client";

import { createContext, useContext, useEffect, useState, useRef } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { getUserProfile } from "@/lib/firestoreUsers";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

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

const toRole = (role: string): "employee" | "manager" | "admin" => {
  if (role === "employee" || role === "manager" || role === "admin") {
    return role;
  }
  return "employee";
};

export function UserProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<SafeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const isFirstCheck = useRef(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      try {
        if (!firebaseUser) {
          if (isFirstCheck.current) {
            // 初回はローディング解除のみ
            setLoading(false);
            isFirstCheck.current = false;
            setUser(null);
            return;
          }
          if (typeof window !== "undefined") {
            toast({
              title: "セッション切れ",
              description: "ログインページにリダイレクトします。",
            });
            router.push("/login");
          }
          setUser(null);
        } else {
          isFirstCheck.current = false;
          let profile = await getUserProfile(firebaseUser.uid);
          let retry = 0;
          while (!profile && retry < 3) {
            await new Promise((res) => setTimeout(res, 500));
            profile = await getUserProfile(firebaseUser.uid);
            retry++;
          }
          if (profile) {
            setUser({
              id: profile.uid,
              name: profile.name || "",
              email: profile.email || "",
              role: toRole(profile.role),
              department: profile.department || "",
              position: profile.position || "",
              createdAt: profile.createdAt || "",
              updatedAt: profile.updatedAt || "",
            });
          } else {
            toast({
              variant: "destructive",
              title: "ユーザー情報取得エラー",
              description: "再度ログインしてください。",
            });
            await auth.signOut();
            router.push("/login");
            setUser(null);
          }
        }
      } catch (error) {
        console.error("[UserProvider] 認証チェックエラー:", error);
        toast({
          variant: "destructive",
          title: "エラー",
          description: "認証チェックに失敗しました。",
        });
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router, toast]);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}
