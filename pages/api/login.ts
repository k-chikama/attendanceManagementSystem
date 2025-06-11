import { NextApiRequest, NextApiResponse } from "next";

// サインアップAPIと同じメモリDBを利用（グローバル変数として定義）
const globalAny: any = global;
if (!globalAny.users) {
  globalAny.users = {};
}
const users: Record<string, string> = globalAny.users;

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    const { userId, password } = req.body;
    if (!userId || !password) {
      return res
        .status(400)
        .json({ error: "ユーザーIDとパスワードは必須です" });
    }
    if (users[userId] && users[userId] === password) {
      // 認証成功時にセッション用Cookieをセット（簡易実装）
      res.setHeader("Set-Cookie", `user_id=${userId}; Path=/; HttpOnly`);
      return res.status(200).json({ success: true });
    } else {
      return res
        .status(401)
        .json({ error: "ユーザーIDまたはパスワードが正しくありません" });
    }
  }
  res.status(405).end();
}
