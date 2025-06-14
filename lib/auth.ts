/**
 * @deprecated このファイルは非推奨です。Firebase Authに移行しました。
 * 新しい認証処理は lib/firebaseAuth.ts と lib/firestoreUsers.ts を使用してください。
 */

// Simulated authentication functions
// In a real application, you would implement proper authentication
// with a backend service or auth provider

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: "employee" | "manager" | "admin";
  department: string;
  position: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// ローカルストレージのキー
const USERS_STORAGE_KEY = "users";
const CURRENT_USER_KEY = "current_user";

// サンプルユーザーデータ（初期データとして使用）
const sampleUsers: User[] = [
  {
    id: "1",
    name: "山田 太郎",
    email: "yamada@example.com",
    password: btoa("password"), // 簡易的なハッシュ化
    role: "employee",
    department: "開発部",
    position: "ソフトウェアエンジニア",
    avatarUrl:
      "https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=300",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "2",
    name: "佐藤 花子",
    email: "sato@example.com",
    password: btoa("password"), // 簡易的なハッシュ化
    role: "manager",
    department: "人事部",
    position: "マネージャー",
    avatarUrl:
      "https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=300",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "3",
    name: "鈴木 一郎",
    email: "suzuki@example.com",
    password: btoa("password"), // 簡易的なハッシュ化
    role: "admin",
    department: "経営企画部",
    position: "部長",
    avatarUrl:
      "https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=300",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// ローカルストレージからユーザー一覧を取得
function getStoredUsers(): User[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(USERS_STORAGE_KEY);
  if (!stored) {
    // 初回実行時はサンプルユーザーを保存
    saveUsers(sampleUsers);
    return sampleUsers;
  }
  return JSON.parse(stored);
}

// ローカルストレージにユーザー一覧を保存
function saveUsers(users: User[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

// パスワードのハッシュ化（簡易的な実装）
function hashPassword(password: string): string {
  return btoa(password); // 実際の実装では、より安全なハッシュ化を使用してください
}

// パスワードの検証
function verifyPassword(password: string, hashedPassword: string): boolean {
  return btoa(password) === hashedPassword;
}

// 現在のユーザーを取得
export function getCurrentUser(): Omit<User, "password"> | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(CURRENT_USER_KEY);
  return stored ? JSON.parse(stored) : null;
}

// ユーザー登録（従業員用）
export function registerUser(data: {
  name: string;
  email: string;
  password: string;
  department: string;
  position: string;
}): Omit<User, "password"> {
  const users = getStoredUsers();

  // メールアドレスの重複チェック
  if (users.some((user) => user.email === data.email)) {
    throw new Error("このメールアドレスは既に登録されています");
  }

  const newUser: User = {
    id: Math.random().toString(36).substr(2, 9),
    name: data.name,
    email: data.email,
    password: hashPassword(data.password),
    department: data.department,
    position: data.position,
    role: "employee", // デフォルトは一般社員
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  users.push(newUser);
  saveUsers(users);

  // 登録後は自動的にログイン
  const { password, ...userWithoutPassword } = newUser;
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(userWithoutPassword));

  return userWithoutPassword;
}

// 管理者登録
export function registerAdmin(data: {
  name: string;
  email: string;
  password: string;
}): Omit<User, "password"> {
  const users = getStoredUsers();

  // メールアドレスの重複チェック
  if (users.some((user) => user.email === data.email)) {
    throw new Error("このメールアドレスは既に登録されています");
  }

  const newUser: User = {
    id: Math.random().toString(36).substr(2, 9),
    name: data.name,
    email: data.email,
    password: hashPassword(data.password),
    department: "経営企画部", // 管理者のデフォルト部門
    position: "管理者", // 管理者のデフォルト役職
    role: "admin",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  users.push(newUser);
  saveUsers(users);

  // 登録後は自動的にログイン
  const { password, ...userWithoutPassword } = newUser;
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(userWithoutPassword));

  return userWithoutPassword;
}

// ログイン
export function loginUser(
  email: string,
  password: string
): Omit<User, "password"> {
  const users = getStoredUsers();
  const user = users.find((u) => u.email === email);

  if (!user || !verifyPassword(password, user.password)) {
    throw new Error("メールアドレスまたはパスワードが正しくありません");
  }

  const { password: _, ...userWithoutPassword } = user;
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(userWithoutPassword));

  return userWithoutPassword;
}

// ログアウト
export function logoutUser(): void {
  localStorage.removeItem(CURRENT_USER_KEY);
}

// ユーザー情報を更新
export function updateUser(
  userId: string,
  updates: Partial<Omit<User, "id" | "role" | "createdAt" | "updatedAt">>
): Omit<User, "password"> {
  const users = getStoredUsers();
  const index = users.findIndex((user) => user.id === userId);

  if (index === -1) {
    throw new Error("ユーザーが見つかりません");
  }

  // メールアドレスの重複チェック（変更がある場合）
  if (updates.email && updates.email !== users[index].email) {
    if (users.some((user) => user.email === updates.email)) {
      throw new Error("このメールアドレスは既に使用されています");
    }
  }

  // パスワードの更新がある場合はハッシュ化
  if (updates.password) {
    updates.password = hashPassword(updates.password);
  }

  const updatedUser: User = {
    ...users[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  users[index] = updatedUser;
  saveUsers(users);

  // 現在のユーザー情報も更新
  const currentUser = getCurrentUser();
  if (currentUser && currentUser.id === userId) {
    const { password, ...userWithoutPassword } = updatedUser;
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(userWithoutPassword));
  }

  const { password, ...userWithoutPassword } = updatedUser;
  return userWithoutPassword;
}

// パスワード変更
export function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): void {
  const users = getStoredUsers();
  const user = users.find((u) => u.id === userId);

  if (!user) {
    throw new Error("ユーザーが見つかりません");
  }

  if (!verifyPassword(currentPassword, user.password)) {
    throw new Error("現在のパスワードが正しくありません");
  }

  user.password = hashPassword(newPassword);
  user.updatedAt = new Date().toISOString();

  saveUsers(users);
}

// すべてのユーザーを取得
export function getAllUsers(): Omit<User, "password">[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(USERS_STORAGE_KEY);
    const users: User[] = stored ? JSON.parse(stored) : [];
    return users.map(({ password, ...user }) => user);
  } catch (error) {
    console.error("Failed to get users:", error);
    return [];
  }
}
