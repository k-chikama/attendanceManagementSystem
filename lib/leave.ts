import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  where,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";

// 休暇申請の型定義
export interface LeaveRequest {
  id: string;
  userId: string;
  type: "有給休暇" | "特別休暇" | "慶弔休暇" | "その他";
  startDate: string;
  endDate: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  updatedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  comment?: string;
}

// 有給休暇の残日数管理
export interface PaidLeaveBalance {
  userId: string;
  year: number;
  totalDays: number; // 年間付与日数
  usedDays: number; // 使用済み日数
  remainingDays: number; // 残日数
  createdAt: string;
  updatedAt: string;
}

const LEAVES_COLLECTION = "leaves";

// 休暇申請一覧を取得
export async function getLeaveRequests(): Promise<LeaveRequest[]> {
  const snapshot = await getDocs(collection(db, LEAVES_COLLECTION));
  return snapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as LeaveRequest)
  );
}

// ユーザーの休暇申請一覧を取得
export async function getUserLeaveRequests(
  userId: string
): Promise<LeaveRequest[]> {
  const q = query(
    collection(db, LEAVES_COLLECTION),
    where("userId", "==", userId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as LeaveRequest)
  );
}

// 承認済みの休暇申請一覧を取得
export async function getApprovedLeaveRequests(): Promise<LeaveRequest[]> {
  const q = query(
    collection(db, LEAVES_COLLECTION),
    where("status", "==", "approved")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as LeaveRequest)
  );
}

// 休暇申請を作成
export async function createLeaveRequest(data: {
  userId: string;
  type: LeaveRequest["type"];
  startDate: string;
  endDate: string;
  reason: string;
}): Promise<LeaveRequest> {
  const now = new Date().toISOString();
  const docRef = await addDoc(collection(db, LEAVES_COLLECTION), {
    ...data,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });
  const docSnap = await getDoc(docRef);
  return { id: docRef.id, ...docSnap.data() } as LeaveRequest;
}

// 休暇申請を更新
export async function updateLeaveRequest(
  requestId: string,
  updates: Partial<LeaveRequest>
): Promise<LeaveRequest> {
  const ref = doc(db, LEAVES_COLLECTION, requestId);
  const now = new Date().toISOString();
  await updateDoc(ref, { ...updates, updatedAt: now });
  const docSnap = await getDoc(ref);
  return { id: requestId, ...docSnap.data() } as LeaveRequest;
}

// 休暇申請を削除
export async function deleteLeaveRequest(requestId: string): Promise<void> {
  const ref = doc(db, LEAVES_COLLECTION, requestId);
  await deleteDoc(ref);
}

// 休暇申請の統計情報を取得
export async function getLeaveRequestStats(userId: string) {
  const requests = await getUserLeaveRequests(userId);
  const currentYear = new Date().getFullYear();

  const stats = {
    total: requests.length,
    pending: requests.filter((r) => r.status === "pending").length,
    approved: requests.filter((r) => r.status === "approved").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
    byType: {
      有給休暇: 0,
      特別休暇: 0,
      慶弔休暇: 0,
      その他: 0,
    },
    byMonth: Array(12).fill(0),
  };

  requests.forEach((request) => {
    // タイプ別の集計
    stats.byType[request.type]++;

    // 月別の集計（承認済みのみ）
    if (request.status === "approved") {
      const startDate = new Date(request.startDate);
      const endDate = new Date(request.endDate);

      // 今年の申請のみを集計
      if (startDate.getFullYear() === currentYear) {
        const startMonth = startDate.getMonth();
        const endMonth = endDate.getMonth();

        if (startMonth === endMonth) {
          // 同じ月内の申請
          stats.byMonth[startMonth]++;
        } else {
          // 月をまたぐ申請
          for (let month = startMonth; month <= endMonth; month++) {
            stats.byMonth[month]++;
          }
        }
      }
    }
  });

  return stats;
}

// 休暇申請の日数計算
export function calculateLeaveDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + 1; // 開始日と終了日を含む
}

// 休暇申請の検証
export function validateLeaveRequest(data: {
  startDate: string;
  endDate: string;
  type: LeaveRequest["type"];
  reason: string;
}): string | null {
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  const today = new Date();

  // 日付の妥当性チェック
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return "無効な日付が指定されています";
  }

  // 過去の日付チェック
  if (start < today) {
    return "開始日は今日以降の日付を指定してください";
  }

  // 日付の順序チェック
  if (end < start) {
    return "終了日は開始日以降の日付を指定してください";
  }

  // 申請期間の長さチェック（例：30日以上）
  const diffDays = calculateLeaveDays(data.startDate, data.endDate);
  if (diffDays > 30) {
    return "一度に申請できる期間は30日までです";
  }

  // 理由の空チェックのみ
  // if (!data.reason) {
  //   return "申請理由を入力してください";
  // }

  return null;
}

// 有給休暇の残日数を取得
export async function getPaidLeaveBalance(
  userId: string,
  year: number
): Promise<PaidLeaveBalance> {
  try {
    const docRef = doc(db, "paidLeaveBalances", `${userId}_${year}`);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...(docSnap.data() as Omit<PaidLeaveBalance, "id">),
      } as PaidLeaveBalance;
    } else {
      // デフォルト値を作成（年間20日付与）
      const defaultBalance: PaidLeaveBalance = {
        userId,
        year,
        totalDays: 20,
        usedDays: 0,
        remainingDays: 20,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // デフォルト値を保存
      await setDoc(docRef, defaultBalance);
      return defaultBalance;
    }
  } catch (error) {
    console.error("有給休暇残日数の取得に失敗:", error);
    throw error;
  }
}

// 有給休暇の残日数を更新
export async function updatePaidLeaveBalance(
  userId: string,
  year: number,
  usedDays: number
): Promise<PaidLeaveBalance> {
  try {
    const balance = await getPaidLeaveBalance(userId, year);
    const updatedBalance: PaidLeaveBalance = {
      ...balance,
      usedDays,
      remainingDays: Math.max(0, balance.totalDays - usedDays),
      updatedAt: new Date().toISOString(),
    };

    const docRef = doc(db, "paidLeaveBalances", `${userId}_${year}`);
    await setDoc(docRef, updatedBalance);

    return updatedBalance;
  } catch (error) {
    console.error("有給休暇残日数の更新に失敗:", error);
    throw error;
  }
}

// 有給休暇の使用日数を計算
export async function calculatePaidLeaveUsedDays(
  userId: string,
  year: number
): Promise<number> {
  try {
    const requests = await getUserLeaveRequests(userId);
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31);

    let totalUsedDays = 0;

    requests.forEach((request) => {
      if (request.type === "有給休暇" && request.status === "approved") {
        const startDate = new Date(request.startDate);
        const endDate = new Date(request.endDate);

        // 指定年の申請のみを集計
        if (startDate >= yearStart && startDate <= yearEnd) {
          const days = calculateLeaveDays(request.startDate, request.endDate);
          totalUsedDays += days;
        }
      }
    });

    return totalUsedDays;
  } catch (error) {
    console.error("有給休暇使用日数の計算に失敗:", error);
    return 0;
  }
}

// 有給休暇の残日数を自動更新
export async function refreshPaidLeaveBalance(
  userId: string,
  year: number
): Promise<PaidLeaveBalance> {
  try {
    const usedDays = await calculatePaidLeaveUsedDays(userId, year);
    return await updatePaidLeaveBalance(userId, year, usedDays);
  } catch (error) {
    console.error("有給休暇残日数の自動更新に失敗:", error);
    throw error;
  }
}
