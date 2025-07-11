// Types
export type ShiftType = "early" | "late" | "dayoff" | "seminar";

export interface Shift {
  id: string;
  userId: string;
  date: string;
  startTime: string;
  endTime: string;
  type: ShiftType;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  updatedAt: string;
}

// Constants
const STORAGE_KEY = "shifts";

// ローカルストレージからデータを取得
function getStoredShifts(): Shift[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Failed to get stored shifts:", error);
    return [];
  }
}

// ローカルストレージにデータを保存
function saveShifts(shifts: Shift[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shifts));
  } catch (error) {
    console.error("Failed to save shifts:", error);
    throw new Error("シフトの保存に失敗しました");
  }
}

// シフト一覧を取得
export function getShifts(): Shift[] {
  return getStoredShifts().sort((a, b) => b.date.localeCompare(a.date));
}

// 特定のユーザーのシフトを取得
export function getUserShifts(userId: string): Shift[] {
  return getShifts().filter((shift) => shift.userId === userId);
}

// 特定の日付のシフトを取得
export function getShiftsByDate(date: string): Shift[] {
  return getShifts().filter((shift) => shift.date === date);
}

// 新しいシフトを作成
export function createShift(
  data: Omit<Shift, "id" | "createdAt" | "updatedAt">
): Shift {
  const shifts = getStoredShifts();
  const newShift: Shift = {
    id: Math.random().toString(36).substr(2, 9),
    ...data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  shifts.push(newShift);
  saveShifts(shifts);
  return newShift;
}

// シフトを更新
export function updateShift(id: string, updates: Partial<Shift>): Shift {
  const shifts = getStoredShifts();
  const index = shifts.findIndex((shift) => shift.id === id);

  if (index === -1) {
    throw new Error("シフトが見つかりません");
  }

  const currentShift = shifts[index];
  const updatedShift: Shift = {
    ...currentShift,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  shifts[index] = updatedShift;
  saveShifts(shifts);
  return updatedShift;
}

// シフトを削除
export function deleteShift(id: string): void {
  const shifts = getStoredShifts();
  const filteredShifts = shifts.filter((shift) => shift.id !== id);

  if (filteredShifts.length === shifts.length) {
    throw new Error("シフトが見つかりません");
  }

  saveShifts(filteredShifts);
}

// 月次のシフト集計を取得
export function getMonthlyShiftSummary(
  userId: string,
  year: number,
  month: number
): {
  totalShifts: number;
  totalRegularHours: number;
  totalOvertimeHours: number;
} {
  const shifts = getShifts();
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(month).padStart(2, "0")}-31`;

  const monthlyShifts = shifts.filter(
    (shift) =>
      shift.userId === userId &&
      shift.date >= startDate &&
      shift.date <= endDate
  );

  const calculateHours = (startTime: string, endTime: string) => {
    const [startHours, startMinutes] = startTime.split(":").map(Number);
    const [endHours, endMinutes] = endTime.split(":").map(Number);
    return endHours - startHours + (endMinutes - startMinutes) / 60;
  };

  // 早番・遅番・セミナーのみを通常勤務時間として集計
  const totalRegularHours = monthlyShifts
    .filter(
      (shift) =>
        shift.type === "early" ||
        shift.type === "late" ||
        shift.type === "seminar"
    )
    .reduce(
      (sum, shift) => sum + calculateHours(shift.startTime, shift.endTime),
      0
    );

  // 残業は現状未使用なので0で返す
  const totalOvertimeHours = 0;

  return {
    totalShifts: monthlyShifts.length,
    totalRegularHours,
    totalOvertimeHours,
  };
}

export function getShiftTypeLabel(type: ShiftType): string {
  switch (type) {
    case "early":
      return "早番";
    case "late":
      return "遅番";
    case "dayoff":
      return "休み";
    case "seminar":
      return "セ";
    default:
      return "不明";
  }
}

export function getShiftTypeColor(type: ShiftType): string {
  switch (type) {
    case "early":
      return "bg-blue-100 text-blue-800";
    case "late":
      return "bg-purple-100 text-purple-800";
    case "dayoff":
      return "bg-gray-100 text-gray-800";
    case "seminar":
      return "bg-green-100 text-green-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}
