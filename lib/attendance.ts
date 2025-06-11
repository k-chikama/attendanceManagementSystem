// Types
export interface AttendanceRecord {
  id: string;
  userId: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  breakStart: string[];
  breakEnd: string[];
  totalWorkTime: number; // in minutes
  status: "present" | "late" | "absent" | "leave" | "holiday";
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveRequest {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  type: "paid" | "sick" | "other";
  createdAt: string;
}

// Mock data for development
const mockAttendanceData: AttendanceRecord[] = [
  {
    id: "1",
    userId: "1",
    date: "2025-01-01",
    clockIn: "09:00",
    clockOut: "18:00",
    breakStart: ["12:00"],
    breakEnd: ["13:00"],
    totalWorkTime: 480,
    status: "present",
    createdAt: "2025-01-01T09:00:00Z",
    updatedAt: "2025-01-01T18:00:00Z",
  },
  // Add more mock records as needed
];

const mockLeaveRequests: LeaveRequest[] = [
  {
    id: "1",
    userId: "1",
    startDate: "2025-01-10",
    endDate: "2025-01-12",
    reason: "休暇",
    status: "pending",
    type: "paid",
    createdAt: "2025-01-05T10:00:00Z",
  },
  // Add more mock records as needed
];

// ローカルストレージのキー
const STORAGE_KEY = "attendance_records";

// ローカルストレージからデータを取得
function getStoredRecords(): AttendanceRecord[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

// ローカルストレージにデータを保存
function saveRecords(records: AttendanceRecord[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

// Helper function to format date as YYYY-MM-DD
export function getCurrentDate(): string {
  const date = new Date();
  return date.toISOString().split("T")[0];
}

// Helper function to format time as HH:mm
export function getCurrentTime(): string {
  const now = new Date();
  return now.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// 勤務時間を計算（分単位）
function calculateWorkTime(
  clockIn: string | null,
  clockOut: string | null,
  breakStart: string[],
  breakEnd: string[]
): number {
  if (!clockIn || !clockOut) return 0;

  const parseTime = (time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  };

  let totalMinutes = parseTime(clockOut) - parseTime(clockIn);

  // 休憩時間を差し引く
  for (let i = 0; i < breakStart.length; i++) {
    if (breakEnd[i]) {
      totalMinutes -= parseTime(breakEnd[i]) - parseTime(breakStart[i]);
    }
  }

  return Math.max(0, totalMinutes);
}

// 勤怠状態を判定
function determineStatus(
  clockIn: string | null,
  clockOut: string | null,
  date: string
): AttendanceRecord["status"] {
  if (!clockIn && !clockOut) return "absent";
  if (clockIn && !clockOut) return "present";

  const clockInTime = clockIn ? new Date(`${date}T${clockIn}`) : null;
  const workStartTime = new Date(`${date}T09:00`);

  if (clockInTime && clockInTime > workStartTime) return "late";
  return "present";
}

// Get today's attendance for a user
export function getTodayAttendance(userId: string): AttendanceRecord | null {
  const today = getCurrentDate();
  const records = getStoredRecords();
  return (
    records.find(
      (record) => record.userId === userId && record.date === today
    ) || null
  );
}

// Get all attendance records for a user
export function getUserAttendance(
  userId: string,
  startDate?: string,
  endDate?: string
): AttendanceRecord[] {
  const records = getStoredRecords();
  return records
    .filter((record) => {
      if (record.userId !== userId) return false;
      if (startDate && record.date < startDate) return false;
      if (endDate && record.date > endDate) return false;
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

// Get all leave requests for a user
export function getUserLeaveRequests(userId: string): LeaveRequest[] {
  return mockLeaveRequests.filter((request) => request.userId === userId);
}

// Create a new attendance record
export function createAttendanceRecord(userId: string): AttendanceRecord {
  const records = getStoredRecords();
  const today = getCurrentDate();
  const now = getCurrentTime();

  // 既存の記録を確認
  const existingRecord = records.find(
    (record) => record.userId === userId && record.date === today
  );

  if (existingRecord) {
    throw new Error("本日の勤怠記録は既に存在します");
  }

  const newRecord: AttendanceRecord = {
    id: Math.random().toString(36).substr(2, 9),
    userId,
    date: today,
    clockIn: now,
    clockOut: null,
    breakStart: [],
    breakEnd: [],
    totalWorkTime: 0,
    status: "present",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  records.push(newRecord);
  saveRecords(records);
  return newRecord;
}

// Update an existing attendance record
export function updateAttendanceRecord(
  id: string,
  updates: Partial<AttendanceRecord>
): AttendanceRecord {
  const records = getStoredRecords();
  const index = records.findIndex((record) => record.id === id);

  if (index === -1) {
    throw new Error("勤怠記録が見つかりません");
  }

  const currentRecord = records[index];
  const updatedRecord: AttendanceRecord = {
    ...currentRecord,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  // 勤務時間を再計算
  updatedRecord.totalWorkTime = calculateWorkTime(
    updatedRecord.clockIn,
    updatedRecord.clockOut,
    updatedRecord.breakStart,
    updatedRecord.breakEnd
  );

  // 勤怠状態を更新
  updatedRecord.status = determineStatus(
    updatedRecord.clockIn,
    updatedRecord.clockOut,
    updatedRecord.date
  );

  records[index] = updatedRecord;
  saveRecords(records);
  return updatedRecord;
}

// 休憩開始
export function startBreak(recordId: string): AttendanceRecord {
  const records = getStoredRecords();
  const record = records.find((r) => r.id === recordId);

  if (!record) {
    throw new Error("勤怠記録が見つかりません");
  }

  if (!record.clockIn) {
    throw new Error("出勤していません");
  }

  if (record.clockOut) {
    throw new Error("退勤済みです");
  }

  const now = getCurrentTime();
  const breakStart = [...record.breakStart, now];
  const breakEnd = [...record.breakEnd];

  return updateAttendanceRecord(recordId, {
    breakStart,
    breakEnd,
  });
}

// 休憩終了
export function endBreak(recordId: string): AttendanceRecord {
  const records = getStoredRecords();
  const record = records.find((r) => r.id === recordId);

  if (!record) {
    throw new Error("勤怠記録が見つかりません");
  }

  if (!record.clockIn) {
    throw new Error("出勤していません");
  }

  if (record.clockOut) {
    throw new Error("退勤済みです");
  }

  if (record.breakStart.length <= record.breakEnd.length) {
    throw new Error("休憩中ではありません");
  }

  const now = getCurrentTime();
  const breakEnd = [...record.breakEnd, now];

  return updateAttendanceRecord(recordId, {
    breakEnd,
  });
}

// 退勤
export function clockOut(recordId: string): AttendanceRecord {
  const records = getStoredRecords();
  const record = records.find((r) => r.id === recordId);

  if (!record) {
    throw new Error("勤怠記録が見つかりません");
  }

  if (!record.clockIn) {
    throw new Error("出勤していません");
  }

  if (record.clockOut) {
    throw new Error("既に退勤済みです");
  }

  if (record.breakStart.length > record.breakEnd.length) {
    throw new Error("休憩中です。休憩を終了してください");
  }

  const now = getCurrentTime();
  return updateAttendanceRecord(recordId, {
    clockOut: now,
  });
}

// 勤怠記録を削除（管理者用）
export function deleteAttendanceRecord(id: string): void {
  const records = getStoredRecords();
  const filteredRecords = records.filter((record) => record.id !== id);

  if (filteredRecords.length === records.length) {
    throw new Error("勤怠記録が見つかりません");
  }

  saveRecords(filteredRecords);
}

// 月次集計を取得
export function getMonthlySummary(
  userId: string,
  year: number,
  month: number
): {
  totalWorkDays: number;
  totalWorkTime: number;
  lateDays: number;
  absentDays: number;
  leaveDays: number;
} {
  const records = getStoredRecords();
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(month).padStart(2, "0")}-31`;

  const monthlyRecords = records.filter(
    (record) =>
      record.userId === userId &&
      record.date >= startDate &&
      record.date <= endDate
  );

  return {
    totalWorkDays: monthlyRecords.filter(
      (r) => r.status === "present" || r.status === "late"
    ).length,
    totalWorkTime: monthlyRecords.reduce((sum, r) => sum + r.totalWorkTime, 0),
    lateDays: monthlyRecords.filter((r) => r.status === "late").length,
    absentDays: monthlyRecords.filter((r) => r.status === "absent").length,
    leaveDays: monthlyRecords.filter((r) => r.status === "leave").length,
  };
}

// 新しい休暇申請を作成
export function createLeaveRequest(data: {
  userId: string;
  startDate: string;
  endDate: string;
  reason: string;
  type: "paid" | "sick" | "other";
}) {
  const newRequest: LeaveRequest = {
    id: Math.random().toString(36).substr(2, 9),
    userId: data.userId,
    startDate: data.startDate,
    endDate: data.endDate,
    reason: data.reason,
    status: "pending",
    type: data.type,
    createdAt: new Date().toISOString(),
  };
  mockLeaveRequests.unshift(newRequest);
  return newRequest;
}
