"use client";
import { useUser } from "@/contexts/UserContext";
import AppLayout from "@/components/layout/layout";
import { useState, useEffect } from "react";
import {
  getUserAttendance,
  getUserLeaveRequests,
  getTodayAttendance,
  AttendanceRecord,
  LeaveRequest,
} from "@/lib/attendance";
import {
  getPaidLeaveBalance,
  refreshPaidLeaveBalance,
  type PaidLeaveBalance,
} from "@/lib/leave";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Calendar, Clock, UserCheck, FileText } from "lucide-react";

export default function Dashboard() {
  const user = useUser();
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [paidLeaveBalance, setPaidLeaveBalance] =
    useState<PaidLeaveBalance | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;

      try {
        setIsLoading(true);

        // 勤怠データを取得
        const attendance = await getUserAttendance(user.id);
        setAttendanceData(attendance);

        // 休暇申請データを取得
        const leaves = await getUserLeaveRequests(user.id);
        setLeaveRequests(leaves);

        // 有給休暇の残日数を取得
        const currentYear = new Date().getFullYear();
        const balance = await refreshPaidLeaveBalance(user.id, currentYear);
        setPaidLeaveBalance(balance);

        // 今日の勤怠データを取得
        const today = await getTodayAttendance(user.id);
        setTodayRecord(today);
      } catch (error) {
        console.error("データの読み込みに失敗:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    );
  }

  // 勤怠統計
  const totalWorkTime = attendanceData.reduce(
    (sum, record) => sum + (record.totalWorkTime || 0),
    0
  );
  const avgWorkHours =
    attendanceData.length > 0
      ? (totalWorkTime / attendanceData.length / 60).toFixed(1)
      : "0.0";
  const pendingLeaves = leaveRequests.filter(
    (req) => req.status === "pending"
  ).length;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col space-y-2">
          <h1 className="text-base sm:text-2xl md:text-3xl font-bold tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
            {user.name}さん、おはようございます
          </h1>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">勤務状況</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {todayRecord?.clockIn
                  ? todayRecord.clockOut
                    ? "退勤済み"
                    : "勤務中"
                  : "未出勤"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {todayRecord?.clockIn && `出勤: ${todayRecord.clockIn}`}
                {todayRecord?.clockOut && ` / 退勤: ${todayRecord.clockOut}`}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                平均勤務時間
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgWorkHours} 時間</div>
              <p className="text-xs text-muted-foreground mt-1">
                過去30日間の平均
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">勤務日数</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {
                  attendanceData.filter(
                    (record) =>
                      record.status === "present" || record.status === "late"
                  ).length
                }{" "}
                日
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                今月の勤務日数
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">休暇申請</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingLeaves} 件</div>
              <p className="text-xs text-muted-foreground mt-1">
                承認待ちの申請
              </p>
            </CardContent>
          </Card>

          {/* 有給休暇残日数 */}
          {paidLeaveBalance && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  有給休暇残日数
                </CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {paidLeaveBalance.remainingDays} 日
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  付与: {paidLeaveBalance.totalDays}日 / 使用:{" "}
                  {paidLeaveBalance.usedDays}日
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
