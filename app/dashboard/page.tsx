"use client";

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import { Calendar, Clock, UserCheck, FileText } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getTodayAttendance,
  getCurrentDate,
  getUserAttendance,
  getUserLeaveRequests,
  AttendanceRecord,
  LeaveRequest,
} from "@/lib/attendance";
import { User, getCurrentUser } from "@/lib/auth";
import AppLayout from "@/components/layout/layout";
import { getUserProfile } from "@/lib/firestoreUsers";
import { auth } from "@/lib/firebase";

// Generate recent attendance data for the last 7 days
const generateWeeklyData = (records: AttendanceRecord[]) => {
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  const today = new Date();

  const weeklyData = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);

    const formattedDate = `${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const dayName = days[date.getDay()];

    const record = records.find((r) => r.date === formattedDate);
    const workMinutes = record?.totalWorkTime || 0;
    const workHours = workMinutes / 60;

    weeklyData.push({
      date: `${date.getDate()}日(${dayName})`,
      hours: workHours,
      status: record?.status || "absent",
    });
  }

  return weeklyData;
};

// Generate attendance summary by status
const generateStatusData = (records: AttendanceRecord[]) => {
  const countByStatus: Record<AttendanceRecord["status"], number> = {
    present: 0,
    late: 0,
    absent: 0,
    leave: 0,
    holiday: 0,
  };

  records.forEach((record) => {
    countByStatus[record.status]++;
  });

  return [
    { name: "出勤", value: countByStatus.present, color: "#10B981" },
    { name: "遅刻", value: countByStatus.late, color: "#F59E0B" },
    { name: "欠勤", value: countByStatus.absent, color: "#EF4444" },
    { name: "休暇", value: countByStatus.leave, color: "#6366F1" },
    { name: "休日", value: countByStatus.holiday, color: "#8B5CF6" },
  ];
};

// Custom tooltip for charts
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background p-2 border rounded shadow-sm">
        <p className="font-medium">{label}</p>
        <p className="text-sm">{`勤務時間: ${payload[0].value.toFixed(
          1
        )}時間`}</p>
      </div>
    );
  }

  return null;
};

export default function Dashboard({
  user,
}: {
  user: Omit<User, "password"> | null;
}) {
  // userがなければ何も表示しない
  if (!user) return null;

  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const profile = await getUserProfile(user.uid);
        const toRole = (role: string): "employee" | "manager" | "admin" => {
          if (role === "employee" || role === "manager" || role === "admin") {
            return role;
          }
          return "employee";
        };
        if (profile) {
          setUser({
            id: user.uid,
            name: profile.name || "",
            email: user.email || "",
            role: toRole(profile.role),
            department: profile.department || "",
            position: profile.position || "",
            createdAt: profile.createdAt || "",
            updatedAt: profile.updatedAt || "",
          });
          setRole(toRole(profile.role));
        } else {
          setUser(null);
          setRole(null);
        }
        // 勤怠データ等も取得
        const attendance = getUserAttendance(user.uid);
        setAttendanceData(attendance);
        const leaves = getUserLeaveRequests(user.uid);
        setLeaveRequests(leaves);
        const today = getTodayAttendance(user.uid);
        if (today) {
          setTodayRecord(today);
        }
      } else {
        setRole("none");
        setUser(null);
      }
    });
    return unsubscribe;
  }, []);

  if (role === null) {
    return <div>Loading...</div>;
  }

  const weeklyData = generateWeeklyData(attendanceData);
  const statusData = generateStatusData(attendanceData);

  // Calculate summary statistics
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

  // Get current date in Japanese format
  const today = new Date();
  const dateOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  };
  const japaneseDate = today.toLocaleDateString("ja-JP", dateOptions);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col space-y-2">
          <h1 className="text-base sm:text-2xl md:text-3xl font-bold tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
            {user.name}さん、おはようございます
          </h1>
          <p className="text-muted-foreground">{japaneseDate}</p>
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
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>週間勤務時間</CardTitle>
              <CardDescription>過去7日間の勤務時間</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData}>
                  <XAxis
                    dataKey="date"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tickFormatter={(value) => `${value}h`}
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
                    {weeklyData.map((entry, index) => {
                      let fill = "#10B981"; // default: present (green)

                      if (entry.status === "late") fill = "#F59E0B"; // yellow
                      else if (entry.status === "absent")
                        fill = "#EF4444"; // red
                      else if (entry.status === "leave")
                        fill = "#6366F1"; // indigo
                      else if (entry.status === "holiday") fill = "#8B5CF6"; // purple

                      return <Cell key={`cell-${index}`} fill={fill} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>勤怠内訳</CardTitle>
              <CardDescription>今月の勤怠状況</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
