"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, updateUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import AppLayout from "@/components/layout/layout";

const departments = ["開発部", "人事部", "経営企画部", "営業部", "新規"];

const positions = [
  "社員",
  "主任",
  "マネージャー",
  "部長",
  "ソフトウェアエンジニア",
];

export default function ProfilePage() {
  const router = useRouter();
  const { toast } = useToast();
  const currentUser = useUser();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<User>>({
    name: "",
    email: "",
    department: "",
    position: "",
  });

  // 初期データの設定
  useEffect(() => {
    if (currentUser) {
      setFormData({
        name: currentUser.name,
        email: currentUser.email,
        department: currentUser.department,
        position: currentUser.position,
      });
    }
  }, [currentUser]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    setIsLoading(true);
    try {
      await updateUser(currentUser.id, formData);
      setIsEditing(false);
      toast({
        title: "プロフィールを更新しました",
        description: "変更が保存されました。",
      });
    } catch (error) {
      console.error("プロフィール更新エラー:", error);
      toast({
        variant: "destructive",
        title: "エラー",
        description: "プロフィールの更新に失敗しました。",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!currentUser) {
    return null; // UserProviderでリダイレクトされるので、ここでは何も表示しない
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto space-y-4">
          <Button
            variant="ghost"
            onClick={() => router.push("/dashboard")}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            ダッシュボードに戻る
          </Button>

          <Card>
            <CardHeader>
              <CardTitle>プロフィール</CardTitle>
              <CardDescription>
                あなたのプロフィール情報を管理できます。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">名前</Label>
                    {isEditing ? (
                      <Input
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        disabled={isLoading}
                        required
                      />
                    ) : (
                      <div className="text-lg font-medium">
                        {currentUser.name}
                      </div>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="email">メールアドレス</Label>
                    {isEditing ? (
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        disabled={isLoading}
                        required
                        autoComplete="username"
                      />
                    ) : (
                      <div className="text-lg font-medium">
                        {currentUser.email}
                      </div>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="department">部署</Label>
                    {isEditing ? (
                      <Select
                        value={formData.department}
                        onValueChange={(value) =>
                          handleSelectChange("department", value)
                        }
                        disabled={isLoading}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="部署を選択" />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map((dept) => (
                            <SelectItem key={dept} value={dept}>
                              {dept}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="text-lg font-medium">
                        {currentUser.department}
                      </div>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="position">役職</Label>
                    {isEditing ? (
                      <Select
                        value={formData.position}
                        onValueChange={(value) =>
                          handleSelectChange("position", value)
                        }
                        disabled={isLoading}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="役職を選択" />
                        </SelectTrigger>
                        <SelectContent>
                          {positions.map((pos) => (
                            <SelectItem key={pos} value={pos}>
                              {pos}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="text-lg font-medium">
                        {currentUser.position}
                      </div>
                    )}
                  </div>

                  <div>
                    <Label>権限</Label>
                    <div className="text-lg font-medium">
                      {currentUser.role === "admin"
                        ? "管理者"
                        : currentUser.role === "manager"
                        ? "マネージャー"
                        : "一般社員"}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-4">
                  {isEditing ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsEditing(false);
                          setFormData({
                            name: currentUser.name,
                            email: currentUser.email,
                            department: currentUser.department,
                            position: currentUser.position,
                          });
                        }}
                        disabled={isLoading}
                      >
                        キャンセル
                      </Button>
                      <Button type="submit" disabled={isLoading}>
                        {isLoading ? "保存中..." : "保存"}
                      </Button>
                    </>
                  ) : (
                    <Button type="button" onClick={() => setIsEditing(true)}>
                      編集
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
