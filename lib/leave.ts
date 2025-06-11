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

// ローカルストレージのキー
const LEAVE_REQUESTS_KEY = "leave_requests";

// 休暇申請一覧を取得
export function getLeaveRequests(): LeaveRequest[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(LEAVE_REQUESTS_KEY);
  return stored ? JSON.parse(stored) : [];
}

// ユーザーの休暇申請一覧を取得
export function getUserLeaveRequests(userId: string): LeaveRequest[] {
  const requests = getLeaveRequests();
  return requests.filter((request) => request.userId === userId);
}

// 休暇申請を作成
export function createLeaveRequest(data: {
  userId: string;
  type: LeaveRequest["type"];
  startDate: string;
  endDate: string;
  reason: string;
}): LeaveRequest {
  const requests = getLeaveRequests();

  // 日付の重複チェック
  const hasOverlap = requests.some(
    (request) =>
      request.userId === data.userId &&
      request.status !== "rejected" &&
      ((data.startDate <= request.endDate &&
        data.endDate >= request.startDate) ||
        (data.startDate >= request.startDate &&
          data.startDate <= request.endDate) ||
        (data.endDate >= request.startDate && data.endDate <= request.endDate))
  );

  if (hasOverlap) {
    throw new Error("指定された期間に既に休暇申請が存在します");
  }

  const newRequest: LeaveRequest = {
    id: Math.random().toString(36).substr(2, 9),
    ...data,
    status: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  requests.push(newRequest);
  localStorage.setItem(LEAVE_REQUESTS_KEY, JSON.stringify(requests));

  return newRequest;
}

// 休暇申請を更新
export function updateLeaveRequest(
  requestId: string,
  updates: Partial<LeaveRequest>
): LeaveRequest {
  const requests = getLeaveRequests();
  const index = requests.findIndex((request) => request.id === requestId);

  if (index === -1) {
    throw new Error("休暇申請が見つかりません");
  }

  // 承認状態の変更がある場合
  if (updates.status && updates.status !== requests[index].status) {
    if (updates.status === "approved" || updates.status === "rejected") {
      updates.approvedAt = new Date().toISOString();
      // 実際の実装では、承認者のIDを設定
      updates.approvedBy = "admin";
    }
  }

  const updatedRequest: LeaveRequest = {
    ...requests[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  requests[index] = updatedRequest;
  localStorage.setItem(LEAVE_REQUESTS_KEY, JSON.stringify(requests));

  return updatedRequest;
}

// 休暇申請を削除
export function deleteLeaveRequest(requestId: string): void {
  const requests = getLeaveRequests();
  const filteredRequests = requests.filter(
    (request) => request.id !== requestId
  );

  if (filteredRequests.length === requests.length) {
    throw new Error("休暇申請が見つかりません");
  }

  localStorage.setItem(LEAVE_REQUESTS_KEY, JSON.stringify(filteredRequests));
}

// 休暇申請の統計情報を取得
export function getLeaveRequestStats(userId: string) {
  const requests = getUserLeaveRequests(userId);
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
  if (!data.reason) {
    return "申請理由を入力してください";
  }

  return null;
}
