"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { registerAdmin } from "@/lib/auth";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function AdminRegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (formData.password !== formData.confirmPassword) {
      toast({
        variant: "destructive",
        title: "エラー",
        description: "パスワードが一致しません",
      });
      setIsLoading(false);
      return;
    }

    try {
      const user = registerAdmin({
        name: formData.name,
        email: formData.email,
        password: formData.password,
      });

      if (user) {
        toast({
          title: "登録成功",
          description: "管理者アカウントが作成されました",
        });
        router.push("/login");
      } else {
        throw new Error("登録に失敗しました");
      }
    } catch (error) {
      console.error("登録エラー:", error);
      toast({
        variant: "destructive",
        title: "エラー",
        description:
          error instanceof Error
            ? error.message
            : "アカウントの登録に失敗しました",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="flex flex-col space-y-6">
          <div className="flex items-center space-x-4">
            <Link href="/login">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex flex-col space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                管理者アカウント登録
              </h1>
              <p className="text-sm text-muted-foreground">
                管理者アカウントの情報を入力してください
              </p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>新規登録</CardTitle>
              <CardDescription>管理者アカウントを作成します</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">名前</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="山田 太郎"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">メールアドレス</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">パスワード</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="confirmPassword">パスワード（確認）</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        confirmPassword: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "登録中..." : "登録"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
