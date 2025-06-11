import { NextApiRequest, NextApiResponse } from "next";

// グローバル変数でusersを共有
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
    if (users[userId]) {
      return res
        .status(409)
        .json({ error: "このユーザーIDは既に使われています" });
    }
    users[userId] = password;
    return res.status(201).json({ success: true });
  }
  res.status(405).end();
}
