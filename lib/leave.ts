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
