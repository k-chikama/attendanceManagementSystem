"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginUser, registerUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

const emailRegex = /^[\w.!#$%&'*+/=?^_`{|}~-]+@[\w-]+(\.[\w-]+)+$/;
const passwordRegex = /^[a-zA-Z0-9]+$/;

export default function SignupPage() {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // 入力値の検証
      if (!userId) {
        throw new Error("メールアドレスを入力してください。");
      }
      if (!password) {
        throw new Error("パスワードを入力してください。");
      }
      if (!emailRegex.test(userId)) {
        throw new Error("有効なメールアドレス形式で入力してください。");
      }
      if (!passwordRegex.test(password)) {
        throw new Error("パスワードは半角英数字のみで入力してください。");
      }
      if (password !== "password") {
        throw new Error("パスワードは「password」を入力してください。");
      }

      console.log("サインアップ開始:", { userId, password });

      // 新規ユーザーを作成してログイン
      const user = await loginUser(userId, password);
      console.log("ログイン成功:", user);

      toast({
        title: "アカウント作成成功",
        description: "ダッシュボードにリダイレクトします。",
      });

      router.push("/dashboard");
    } catch (error) {
      console.error("サインアップエラー:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "アカウント作成に失敗しました。";
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "エラー",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            新規アカウント作成
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            または{" "}
            <a
              href="/login"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              既存のアカウントでログイン
            </a>
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-6 bg-white p-6 rounded-lg shadow"
        >
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                メールアドレス
              </label>
              <input
                id="email"
                type="email"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                required
                disabled={isLoading}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                placeholder="example@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                パスワード
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                placeholder="password"
              />
              <p className="mt-1 text-sm text-gray-500">
                デモ用パスワード: password
              </p>
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">{error}</h3>
                </div>
              </div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isLoading ? "作成中..." : "アカウント作成"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
