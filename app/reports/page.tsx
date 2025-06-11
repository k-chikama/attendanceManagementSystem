"use client";

import { useState, useEffect } from "react";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { ja } from "date-fns/locale";
import { 
  Calendar, 
  Download, 
  FileText, 
  Printer, 
  BarChart2,
  GitBranch,
  Clock,
  Coffee
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line
} from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { User, getCurrentUser } from "@/lib/auth";
import { AttendanceRecord, getUserAttendance } from "@/lib/attendance";
import AppLayout from "@/components/layout/layout";

export default function ReportsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [filteredRecords, setFilteredRecords] = useState<AttendanceRecord[]>([]);
  
  // Load user and attendance data
  useEffect(() => {
    const currentUser = getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      
      // Get user's attendance records
      const attendance = getUserAttendance(currentUser.id);
      setAttendanceData(attendance);
    }
  }, []);
  
  // Filter records when month changes
  useEffect(() => {
    if (attendanceData.length > 0) {
      const startDate = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');
      
      const filtered = attendanceData.filter(record => {
        return record.date >= startDate && record.date <= endDate;
      });
      
      setFilteredRecords(filtered);
    }
  }, [attendanceData, selectedMonth]);
  
  if (!user) {
    return null;
  }
  
  // Handle month change
  const handleMonthChange = (value: string) => {
    const [year, month] = value.split('-').map(Number);
    const newDate = new Date(year, month - 1, 1);
    setSelectedMonth(newDate);
  };
  
  // Generate month options for select
  const getMonthOptions = () => {
    const options = [];
    const currentYear = new Date().getFullYear();
    
    for (let year = currentYear; year >= currentYear - 1; year--) {
      for (let month = 12; month >= 1; month--) {
        // Skip future months
        if (year === currentYear && month > new Date().getMonth() + 1) continue;
        
        const value = `${year}-${month.toString().padStart(2, '0')}`;
        const label = `${year}年${month}月`;
        options.push({ value, label });
      }
    }
    
    return options;
  };
  
  // Format work time
  const formatWorkTime = (minutes: number | null) => {
    if (!minutes) return '0h 0m';
    
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    return `${hours}h ${mins}m`;
  };
  
  // Generate data for daily work time chart
  const getDailyWorkTimeData = () => {
    return filteredRecords.map(record => {
      const date = record.date.split('-')[2]; // Extract day part
      return {
        date: `${date}日`,
        workTime: record.totalWorkTime ? record.totalWorkTime / 60 : 0, // Convert to hours
        breakTime: record.totalBreakTime ? record.totalBreakTime / 60 : 0 // Convert to hours
      };
    }).sort((a, b) => parseInt(a.date) - parseInt(b.date));
  };
  
  // Generate data for status distribution
  const getStatusDistributionData = () => {
    const statusCount = {
      present: 0,
      late: 0,
      absent: 0,
      leave: 0,
      holiday: 0
    };
    
    filteredRecords.forEach(record => {
      statusCount[record.status]++;
    });
    
    return [
      { name: '出勤', value: statusCount.present },
      { name: '遅刻', value: statusCount.late },
      { name: '欠勤', value: statusCount.absent },
      { name: '休暇', value: statusCount.leave },
      { name: '休日', value: statusCount.holiday }
    ];
  };
  
  // Calculate total statistics
  const totalWorkTime = filteredRecords.reduce((sum, record) => sum + (record.totalWorkTime || 0), 0);
  const totalBreakTime = filteredRecords.reduce((sum, record) => sum + (record.totalBreakTime || 0), 0);
  const workDays = filteredRecords.filter(r => r.status === 'present' || r.status === 'late').length;
  const averageWorkTime = workDays > 0 ? totalWorkTime / workDays : 0;
  
  // Generate work time pattern chart data
  const getWorkTimePatternData = () => {
    const inTimes: { [hour: string]: number } = {};
    const outTimes: { [hour: string]: number } = {};
    
    // Initialize with zero counts
    for (let i = 7; i <= 21; i++) {
      const hour = i.toString().padStart(2, '0');
      inTimes[hour] = 0;
      outTimes[hour] = 0;
    }
    
    // Count occurrences of each hour
    filteredRecords.forEach(record => {
      if (record.clockIn) {
        const hour = record.clockIn.split(':')[0];
        inTimes[hour] = (inTimes[hour] || 0) + 1;
      }
      
      if (record.clockOut) {
        const hour = record.clockOut.split(':')[0];
        outTimes[hour] = (outTimes[hour] || 0) + 1;
      }
    });
    
    // Convert to chart data format
    return Object.keys(inTimes)
      .sort()
      .map(hour => ({
        hour: `${hour}時`,
        in: inTimes[hour],
        out: outTimes[hour]
      }));
  };
  
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">勤怠レポート</h1>
            <p className="text-muted-foreground">勤怠データの分析とレポート機能</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <Select 
                defaultValue={`${format(selectedMonth, 'yyyy-MM')}`}
                onValueChange={handleMonthChange}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="月を選択" />
                </SelectTrigger>
                <SelectContent>
                  {getMonthOptions().map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Button variant="outline" size="sm">
              <Printer className="mr-2 h-4 w-4" />
              印刷
            </Button>
            
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              エクスポート
            </Button>
          </div>
        </div>
        
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">総勤務時間</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatWorkTime(totalWorkTime)}</div>
              <p className="text-xs text-muted-foreground">
                平均: {formatWorkTime(averageWorkTime)} / 日
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">勤務日数</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{workDays} 日</div>
              <p className="text-xs text-muted-foreground">
                内、遅刻: {filteredRecords.filter(r => r.status === 'late').length} 日
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Coffee className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">総休憩時間</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatWorkTime(totalBreakTime)}</div>
              <p className="text-xs text-muted-foreground">
                平均: {formatWorkTime(workDays > 0 ? totalBreakTime / workDays : 0)} / 日
              </p>
            </CardContent>
          </Card>
        </div>
        
        <Tabs defaultValue="charts">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="charts">グラフ</TabsTrigger>
            <TabsTrigger value="summary">サマリー</TabsTrigger>
            <TabsTrigger value="table">表形式</TabsTrigger>
          </TabsList>
          
          <TabsContent value="charts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>日別勤務時間</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={getDailyWorkTimeData()}
                    margin={{
                      top: 20,
                      right: 30,
                      left: 20,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis label={{ value: '時間', angle: -90, position: 'insideLeft' }} />
                    <Tooltip formatter={(value) => [`${value.toFixed(1)} 時間`]} />
                    <Legend />
                    <Bar dataKey="workTime" name="勤務時間" fill="hsl(var(--chart-1))" />
                    <Bar dataKey="breakTime" name="休憩時間" fill="hsl(var(--chart-2))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>出退勤パターン</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={getWorkTimePatternData()}
                    margin={{
                      top: 20,
                      right: 30,
                      left: 20,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis label={{ value: '回数', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="in" name="出勤" stroke="hsl(var(--chart-3))" activeDot={{ r: 8 }} />
                    <Line type="monotone" dataKey="out" name="退勤" stroke="hsl(var(--chart-4))" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="summary">
            <Card>
              <CardHeader>
                <CardTitle>{format(selectedMonth, 'yyyy年M月', { locale: ja })} 勤怠サマリー</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h3 className="font-medium text-lg">勤務概要</h3>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between border-b py-1">
                        <span className="text-muted-foreground">所属部署</span>
                        <span className="font-medium">{user.department}</span>
                      </div>
                      <div className="flex items-center justify-between border-b py-1">
                        <span className="text-muted-foreground">役職</span>
                        <span className="font-medium">{user.position}</span>
                      </div>
                      <div className="flex items-center justify-between border-b py-1">
                        <span className="text-muted-foreground">出勤日数</span>
                        <span className="font-medium">{workDays} 日</span>
                      </div>
                      <div className="flex items-center justify-between border-b py-1">
                        <span className="text-muted-foreground">休暇日数</span>
                        <span className="font-medium">
                          {filteredRecords.filter(r => r.status === 'leave').length} 日
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-b py-1">
                        <span className="text-muted-foreground">遅刻日数</span>
                        <span className="font-medium">
                          {filteredRecords.filter(r => r.status === 'late').length} 日
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="font-medium text-lg">時間集計</h3>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between border-b py-1">
                        <span className="text-muted-foreground">総勤務時間</span>
                        <span className="font-medium">{formatWorkTime(totalWorkTime)}</span>
                      </div>
                      <div className="flex items-center justify-between border-b py-1">
                        <span className="text-muted-foreground">総休憩時間</span>
                        <span className="font-medium">{formatWorkTime(totalBreakTime)}</span>
                      </div>
                      <div className="flex items-center justify-between border-b py-1">
                        <span className="text-muted-foreground">平均勤務時間/日</span>
                        <span className="font-medium">{formatWorkTime(averageWorkTime)}</span>
                      </div>
                      <div className="flex items-center justify-between border-b py-1">
                        <span className="text-muted-foreground">最長勤務日</span>
                        <span className="font-medium">
                          {filteredRecords.length > 0 ? (
                            (() => {
                              const maxRecord = [...filteredRecords].sort((a, b) => 
                                (b.totalWorkTime || 0) - (a.totalWorkTime || 0)
                              )[0];
                              return `${maxRecord.date.split('-')[2]}日 (${formatWorkTime(maxRecord.totalWorkTime)})`;
                            })()
                          ) : '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="pt-4">
                  <h3 className="font-medium text-lg mb-2">備考・特記事項</h3>
                  <div className="border rounded-md p-3 text-sm">
                    {filteredRecords.some(r => r.notes) ? (
                      <ul className="list-disc list-inside space-y-1">
                        {filteredRecords
                          .filter(r => r.notes)
                          .map(r => (
                            <li key={r.id}>
                              <span className="font-medium">{r.date.split('-').slice(1).join('/')}</span>: {r.notes}
                            </li>
                          ))}
                      </ul>
                    ) : (
                      <p className="text-muted-foreground">特記事項はありません。</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="table">
            <Card>
              <CardHeader>
                <CardTitle>勤怠詳細データ</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>日付</TableHead>
                        <TableHead>曜日</TableHead>
                        <TableHead>出勤</TableHead>
                        <TableHead>退勤</TableHead>
                        <TableHead>勤務時間</TableHead>
                        <TableHead>休憩時間</TableHead>
                        <TableHead>状態</TableHead>
                        <TableHead>備考</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {eachDayOfInterval({
                        start: startOfMonth(selectedMonth),
                        end: endOfMonth(selectedMonth)
                      }).map(day => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const record = filteredRecords.find(r => r.date === dateStr);
                        
                        return (
                          <TableRow key={dateStr}>
                            <TableCell>{format(day, 'yyyy/MM/dd')}</TableCell>
                            <TableCell>{format(day, 'EEE', { locale: ja })}</TableCell>
                            <TableCell>{record?.clockIn || '-'}</TableCell>
                            <TableCell>{record?.clockOut || '-'}</TableCell>
                            <TableCell>{record?.totalWorkTime ? formatWorkTime(record.totalWorkTime) : '-'}</TableCell>
                            <TableCell>{record?.totalBreakTime ? formatWorkTime(record.totalBreakTime) : '-'}</TableCell>
                            <TableCell>
                              {(() => {
                                if (!record) return '-';
                                
                                switch (record.status) {
                                  case 'present': return '出勤';
                                  case 'late': return '遅刻';
                                  case 'absent': return '欠勤';
                                  case 'leave': return '休暇';
                                  case 'holiday': return '休日';
                                  default: return '-';
                                }
                              })()}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">
                              {record?.notes || '-'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}