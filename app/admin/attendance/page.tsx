"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import AppLayout from "@/components/layout/layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar, Clock, User, Search, Download, Eye } from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isWeekend,
  addMonths,
} from "date-fns";
import { ja } from "date-fns/locale";
import { getAllUsers as getAllUsersFirestore } from "@/lib/firestoreUsers";
import { getUserAttendance } from "@/lib/attendance";
import { getShiftsByUser } from "@/lib/firestoreShifts";
import {
  getUserLeaveRequests,
  getPaidLeaveBalance,
  refreshPaidLeaveBalance,
  type PaidLeaveBalance,
} from "@/lib/leave";

type SafeUser = {
  id: string;
  name: string;
  email: string;
  role: "employee" | "manager" | "admin";
  department: string;
  position: string;
  createdAt: string;
  updatedAt: string;
};

type AttendanceRecord = {
  id: string;
  userId: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  breakStart: string[];
  breakEnd: string[];
  totalWorkTime: number;
  status: "present" | "late" | "absent" | "leave" | "holiday";
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

type LeaveRequest = {
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
};

type Shift = {
  id: string;
  userId: string;
  date: string;
  startTime: string;
  endTime: string;
  type: "early" | "late" | "dayoff" | "seminar";
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  updatedAt: string;
};

export default function AdminAttendancePage() {
  const router = useRouter();
  const { toast } = useToast();
  const user = useUser();
  const [staff, setStaff] = useState<SafeUser[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [paidLeaveBalance, setPaidLeaveBalance] =
    useState<PaidLeaveBalance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // 月の日数を取得
  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(selectedMonth),
    end: endOfMonth(selectedMonth),
  });

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        if (!user || user.role !== "admin") {
          router.push("/login");
          return;
        }

        // 全スタッフを取得
        const allStaffRaw = await getAllUsersFirestore();
        const allStaff: SafeUser[] = allStaffRaw.map((u: any) => ({
          id: u.uid,
          name: u.name || "",
          email: u.email || "",
          role: u.role || "employee",
          department: u.department || "",
          position: u.position || "",
          createdAt: u.createdAt || "",
          updatedAt: u.updatedAt || "",
        }));
        setStaff(allStaff);

        // 最初のスタッフを選択
        if (allStaff.length > 0 && !selectedStaff) {
          setSelectedStaff(allStaff[0].id);
        }
      } catch (error) {
        console.error("データの読み込みに失敗:", error);
        toast({
          variant: "destructive",
          title: "エラー",
          description: "データの読み込みに失敗しました",
        });
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [router, toast, user]);

  useEffect(() => {
    const loadStaffData = async () => {
      if (!selectedStaff) return;

      try {
        // 選択されたスタッフの勤怠データを取得
        const attendance = await getUserAttendance(selectedStaff);
        setAttendanceData(attendance);

        // シフトデータを取得
        const year = selectedMonth.getFullYear();
        const month = selectedMonth.getMonth() + 1;
        const staffShifts = (await getShiftsByUser(selectedStaff)) as Shift[];

        // 月次フィルタリング
        const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
        const endDate = `${year}-${String(month).padStart(2, "0")}-31`;
        const filteredShifts = staffShifts.filter(
          (shift) => shift.date >= startDate && shift.date <= endDate
        );
        setShifts(filteredShifts);

        // 休暇申請データを取得
        const staffLeaves = await getUserLeaveRequests(selectedStaff);
        setLeaves(staffLeaves);

        // 有給休暇の残日数を取得
        const currentYear = new Date().getFullYear();
        const balance = await refreshPaidLeaveBalance(
          selectedStaff,
          currentYear
        );
        setPaidLeaveBalance(balance);
      } catch (error) {
        console.error("スタッフデータの読み込みに失敗:", error);
      }
    };

    loadStaffData();
  }, [selectedStaff, selectedMonth]);

  // フィルタリングされたスタッフリスト
  const filteredStaff = staff.filter(
    (member) =>
      member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 月選択の処理
  const handleMonthChange = (value: string) => {
    const [year, month] = value.split("-").map(Number);
    setSelectedMonth(new Date(year, month - 1));
  };

  // 月オプションを生成
  const getMonthOptions = () => {
    const options = [];
    const currentYear = new Date().getFullYear();

    for (let year = currentYear; year >= currentYear - 1; year--) {
      for (let month = 12; month >= 1; month--) {
        if (year === currentYear && month > new Date().getMonth() + 1) continue;
        const value = `${year}-${month.toString().padStart(2, "0")}`;
        const label = `${year}年${month}月`;
        options.push({ value, label });
      }
    }
    return options;
  };

  // 勤務時間をフォーマット
  const formatWorkTime = (minutes: number | null) => {
    if (!minutes) return "0h 0m";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  // 休憩時間をフォーマット
  const formatBreakTimes = (starts: string[], ends: string[]) => {
    if (!starts || !ends || starts.length === 0 || ends.length === 0)
      return "-";
    const breakCount = Math.min(starts.length, ends.length);
    const breakStrings = [];
    for (let i = 0; i < breakCount; i++) {
      if (starts[i] && ends[i]) {
        breakStrings.push(`${starts[i]}〜${ends[i]}`);
      }
    }
    return breakStrings.length > 0 ? breakStrings.join(", ") : "-";
  };

  // シフトタイプのラベルを取得
  const getShiftTypeLabel = (type: string | undefined): string => {
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
        return "-";
    }
  };

  // 指定日のシフトを取得
  const getShiftTypeForDate = (date: string) => {
    const shift = shifts.find((s) => s.date === date);
    return shift ? getShiftTypeLabel(shift.type) : "-";
  };

  // 指定日が休暇日かチェック
  const isLeaveDay = (date: string) => {
    return leaves.some(
      (l) => l.status === "approved" && l.startDate <= date && l.endDate >= date
    );
  };

  // 指定日の状態を取得
  const getStatusForDate = (date: string) => {
    // 1. シフトが休み
    const shift = shifts.find((s) => s.date === date);
    if (shift && (shift.type === "dayoff" || shift.type === "seminar")) {
      return "休み";
    }
    // 2. 休暇申請が承認済み
    if (isLeaveDay(date)) {
      return "休暇";
    }
    // 3. 勤怠データ
    const record = attendanceData.find((r) => r.date === date);
    if (!record) {
      return "未登録";
    }
    if (record.clockIn && !record.clockOut) {
      return "勤務中";
    }
    if (record.clockIn && record.clockOut) {
      return "退勤";
    }
    return "未登録";
  };

  // 状態バッジを取得
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "休み":
        return (
          <Badge
            variant="outline"
            className="bg-purple-50 text-purple-700 border-purple-200"
          >
            休み
          </Badge>
        );
      case "休暇":
        return (
          <Badge
            variant="outline"
            className="bg-blue-50 text-blue-700 border-blue-200"
          >
            休暇
          </Badge>
        );
      case "未登録":
        return (
          <Badge
            variant="outline"
            className="bg-slate-50 text-slate-700 border-slate-200"
          >
            未登録
          </Badge>
        );
      case "勤務中":
        return (
          <Badge
            variant="outline"
            className="bg-green-50 text-green-700 border-green-200"
          >
            勤務中
          </Badge>
        );
      case "退勤":
        return (
          <Badge
            variant="outline"
            className="bg-amber-50 text-amber-700 border-amber-200"
          >
            退勤
          </Badge>
        );
      default:
        return (
          <Badge
            variant="outline"
            className="bg-slate-50 text-slate-700 border-slate-200"
          >
            {status}
          </Badge>
        );
    }
  };

  // 月次統計を計算
  const getMonthlyStats = () => {
    const workDays = attendanceData.filter(
      (r) => r.status === "present" || r.status === "late"
    ).length;
    const totalWorkTime = attendanceData.reduce(
      (sum, r) => sum + (r.totalWorkTime || 0),
      0
    );
    const lateDays = attendanceData.filter((r) => r.status === "late").length;
    const absentDays = attendanceData.filter(
      (r) => r.status === "absent"
    ).length;
    const leaveDays = daysInMonth.filter((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      return isLeaveDay(dateStr);
    }).length;

    return {
      workDays,
      totalWorkTime,
      lateDays,
      absentDays,
      leaveDays,
      avgWorkTime: workDays > 0 ? totalWorkTime / workDays : 0,
    };
  };

  if (!user || user.role !== "admin") {
    return (
      <div className="text-center text-red-500 py-10">
        管理者権限がありません
      </div>
    );
  }

  const selectedStaffMember = staff.find((s) => s.id === selectedStaff);
  const stats = getMonthlyStats();

  return (
    <AppLayout>
      <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {/* ヘッダー */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">勤怠管理</h1>
              <p className="text-muted-foreground">
                従業員の勤怠情報を確認・管理できます。
              </p>
            </div>
          </div>

          {/* スタッフ選択と月選択 */}
          <Card>
            <CardHeader>
              <CardTitle>従業員・期間選択</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* スタッフ検索 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">従業員検索</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="名前、メール、部署で検索..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* スタッフ選択 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">従業員</label>
                  <Select
                    value={selectedStaff}
                    onValueChange={setSelectedStaff}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="従業員を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredStaff.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <span>{member.name}</span>
                            <span className="text-muted-foreground text-xs">
                              ({member.department})
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 月選択 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">期間</label>
                  <Select
                    value={`${format(selectedMonth, "yyyy-MM")}`}
                    onValueChange={handleMonthChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="月を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {getMonthOptions().map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 選択された従業員の情報 */}
          {selectedStaffMember && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  {selectedStaffMember.name} の勤怠情報
                </CardTitle>
                <CardDescription>
                  {selectedStaffMember.department} /{" "}
                  {selectedStaffMember.position}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="flex flex-col border rounded-lg p-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Clock className="h-4 w-4" />
                      勤務日数
                    </div>
                    <div className="text-2xl font-bold">{stats.workDays}日</div>
                  </div>

                  <div className="flex flex-col border rounded-lg p-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Calendar className="h-4 w-4" />
                      総勤務時間
                    </div>
                    <div className="text-2xl font-bold">
                      {formatWorkTime(stats.totalWorkTime)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      平均: {formatWorkTime(stats.avgWorkTime)} / 日
                    </div>
                  </div>

                  <div className="flex flex-col border rounded-lg p-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <User className="h-4 w-4" />
                      遅刻日数
                    </div>
                    <div className="text-2xl font-bold">{stats.lateDays}日</div>
                  </div>

                  <div className="flex flex-col border rounded-lg p-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Calendar className="h-4 w-4" />
                      休暇日数
                    </div>
                    <div className="text-2xl font-bold">
                      {stats.leaveDays}日
                    </div>
                  </div>
                </div>

                {/* 有給休暇残日数 */}
                {paidLeaveBalance && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-blue-900">
                          有給休暇残日数
                        </h4>
                        <p className="text-sm text-blue-700">
                          {new Date().getFullYear()}年度
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold text-blue-900">
                          {paidLeaveBalance.remainingDays}日
                        </div>
                        <div className="text-sm text-blue-700">
                          付与: {paidLeaveBalance.totalDays}日 / 使用:{" "}
                          {paidLeaveBalance.usedDays}日
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 勤怠詳細テーブル */}
          {selectedStaffMember && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>勤怠詳細</span>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    エクスポート
                  </Button>
                </CardTitle>
                <CardDescription>
                  {format(selectedMonth, "yyyy年M月", { locale: ja })}
                  の詳細な勤怠記録
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>日付</TableHead>
                        <TableHead>シフト</TableHead>
                        <TableHead>出勤</TableHead>
                        <TableHead>退勤</TableHead>
                        <TableHead>休憩</TableHead>
                        <TableHead>勤務時間</TableHead>
                        <TableHead>状態</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {daysInMonth.map((day) => {
                        const dateStr = format(day, "yyyy-MM-dd");
                        const record = attendanceData.find(
                          (r) => r.date === dateStr
                        );
                        const isWeekendDay = isWeekend(day);

                        return (
                          <TableRow
                            key={dateStr}
                            className={isWeekendDay ? "bg-muted/50" : ""}
                          >
                            <TableCell>
                              <div className="font-medium">
                                {format(day, "M/d", { locale: ja })}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {format(day, "E", { locale: ja })}
                              </div>
                            </TableCell>
                            <TableCell>
                              {getShiftTypeForDate(dateStr)}
                            </TableCell>
                            <TableCell>{record?.clockIn || "-"}</TableCell>
                            <TableCell>{record?.clockOut || "-"}</TableCell>
                            <TableCell>
                              {record
                                ? formatBreakTimes(
                                    record.breakStart,
                                    record.breakEnd
                                  )
                                : "-"}
                            </TableCell>
                            <TableCell>
                              {record?.totalWorkTime
                                ? formatWorkTime(record.totalWorkTime)
                                : "-"}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(getStatusForDate(dateStr))}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
