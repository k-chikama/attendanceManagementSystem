"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import AppLayout from "@/components/layout/layout";
import {
  getLeaveRequests,
  updateLeaveRequest,
  type LeaveRequest,
} from "@/lib/leave";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface User {
  id: string;
  name: string;
  role: string;
}

export default function AdminLeaveRequestsPage() {
  const user = useUser();
  const { toast } = useToast();
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [users, setUsers] = useState<{ [key: string]: string }>({});
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(
    null
  );
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 管理者権限チェック
  if (!user || user.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">アクセス権限がありません</h1>
          <p>このページは管理者のみアクセスできます。</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    // 休暇申請一覧を取得
    (async () => {
      const requests = await getLeaveRequests();
      setLeaveRequests(requests);
    })();

    // ユーザー情報を取得
    const fetchUsers = async () => {
      const usersSnapshot = await getDocs(collection(db, "users"));
      const userMap = usersSnapshot.docs.reduce((acc, doc) => {
        const userData = doc.data() as User;
        acc[userData.id] = userData.name;
        return acc;
      }, {} as { [key: string]: string });
      setUsers(userMap);
    };

    fetchUsers();
  }, []);

  // 申請状態によるフィルタリング
  const filteredRequests = leaveRequests.filter((request) => {
    if (statusFilter === "all") return true;
    return request.status === statusFilter;
  });

  // 申請の承認/却下処理
  const handleStatusUpdate = async (
    requestId: string,
    newStatus: "approved" | "rejected"
  ) => {
    try {
      setIsSubmitting(true);
      const updatedRequest = await updateLeaveRequest(requestId, {
        status: newStatus,
        comment: comment,
        approvedBy: user?.id,
        approvedAt: new Date().toISOString(),
      });

      setLeaveRequests((prev) =>
        prev.map((req) => (req.id === requestId ? updatedRequest : req))
      );

      toast({
        title: "更新完了",
        description: `休暇申請を${
          newStatus === "approved" ? "承認" : "却下"
        }しました。`,
      });

      setSelectedRequest(null);
      setComment("");
    } catch (error) {
      console.error("更新エラー:", error);
      toast({
        variant: "destructive",
        title: "エラー",
        description: "更新に失敗しました。",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">休暇申請管理</h1>
          <p className="text-muted-foreground">
            従業員からの休暇申請を承認または却下できます。
          </p>
        </div>

        <div className="flex items-center gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="状態でフィルター" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              <SelectItem value="pending">承認待ち</SelectItem>
              <SelectItem value="approved">承認済み</SelectItem>
              <SelectItem value="rejected">却下</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>申請一覧</CardTitle>
            <CardDescription>全従業員の休暇申請を管理します。</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              {/* PC用テーブル */}
              <div className="overflow-x-auto w-full hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-left">申請者</TableHead>
                      <TableHead className="text-left">種類</TableHead>
                      <TableHead className="text-left">期間</TableHead>
                      <TableHead className="text-left">理由</TableHead>
                      <TableHead className="text-left">申請日</TableHead>
                      <TableHead className="text-left">状態</TableHead>
                      <TableHead className="text-left">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests
                      .sort(
                        (a, b) =>
                          new Date(b.createdAt).getTime() -
                          new Date(a.createdAt).getTime()
                      )
                      .map((request) => (
                        <TableRow key={request.id}>
                          <TableCell className="text-left">
                            {users[request.userId] || request.userId}
                          </TableCell>
                          <TableCell className="text-left">
                            {request.type}
                          </TableCell>
                          <TableCell className="text-left">
                            {format(new Date(request.startDate), "yyyy/MM/dd", {
                              locale: ja,
                            })}{" "}
                            〜{" "}
                            {format(new Date(request.endDate), "yyyy/MM/dd", {
                              locale: ja,
                            })}
                          </TableCell>
                          <TableCell className="text-left max-w-[200px] truncate">
                            {request.reason}
                          </TableCell>
                          <TableCell className="text-left">
                            {format(new Date(request.createdAt), "yyyy/MM/dd", {
                              locale: ja,
                            })}
                          </TableCell>
                          <TableCell className="text-left">
                            <Badge
                              variant="outline"
                              className={
                                request.status === "approved"
                                  ? "bg-green-50 text-green-700 border-green-200"
                                  : request.status === "rejected"
                                  ? "bg-red-50 text-red-700 border-red-200"
                                  : "bg-yellow-50 text-yellow-700 border-yellow-200"
                              }
                            >
                              {request.status === "approved"
                                ? "承認済み"
                                : request.status === "rejected"
                                ? "却下"
                                : "承認待ち"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-left">
                            {request.status === "pending" && (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSelectedRequest(request)}
                                  >
                                    承認/却下
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>休暇申請の処理</DialogTitle>
                                    <DialogDescription>
                                      {users[request.userId] || "不明"}{" "}
                                      からの休暇申請を処理します。
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                      <div className="text-sm font-medium">
                                        申請内容
                                      </div>
                                      <div className="text-sm">
                                        <div>種類: {request.type}</div>
                                        <div>
                                          期間:{" "}
                                          {format(
                                            new Date(request.startDate),
                                            "M/d",
                                            {
                                              locale: ja,
                                            }
                                          )}{" "}
                                          〜{" "}
                                          {format(
                                            new Date(request.endDate),
                                            "M/d",
                                            {
                                              locale: ja,
                                            }
                                          )}
                                        </div>
                                        <div>理由: {request.reason}</div>
                                      </div>
                                    </div>
                                    <div className="space-y-2">
                                      <div className="text-sm font-medium">
                                        コメント
                                      </div>
                                      <Textarea
                                        placeholder="承認/却下の理由を入力（任意）"
                                        value={comment}
                                        onChange={(e) =>
                                          setComment(e.target.value)
                                        }
                                      />
                                    </div>
                                  </div>
                                  <DialogFooter>
                                    <Button
                                      variant="outline"
                                      onClick={() => {
                                        setSelectedRequest(null);
                                        setComment("");
                                      }}
                                    >
                                      キャンセル
                                    </Button>
                                    <Button
                                      variant="destructive"
                                      onClick={() =>
                                        handleStatusUpdate(
                                          request.id,
                                          "rejected"
                                        )
                                      }
                                      disabled={isSubmitting}
                                    >
                                      却下
                                    </Button>
                                    <Button
                                      onClick={() =>
                                        handleStatusUpdate(
                                          request.id,
                                          "approved"
                                        )
                                      }
                                      disabled={isSubmitting}
                                    >
                                      承認
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            )}
                            {request.status !== "pending" &&
                              request.comment && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {request.comment}
                                </div>
                              )}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
              {/* モバイル用カード型表示 */}
              <div className="block md:hidden space-y-4">
                {filteredRequests
                  .sort(
                    (a, b) =>
                      new Date(b.createdAt).getTime() -
                      new Date(a.createdAt).getTime()
                  )
                  .map((request) => (
                    <div
                      key={request.id}
                      className="border rounded-lg p-4 bg-white"
                    >
                      <div className="mb-2 font-bold text-base">
                        {users[request.userId] || request.userId}
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-sm">
                        <div className="text-muted-foreground">種類</div>
                        <div className="text-left">{request.type}</div>
                        <div className="text-muted-foreground">期間</div>
                        <div className="text-left">
                          {format(new Date(request.startDate), "yyyy/MM/dd", {
                            locale: ja,
                          })}{" "}
                          〜{" "}
                          {format(new Date(request.endDate), "yyyy/MM/dd", {
                            locale: ja,
                          })}
                        </div>
                        <div className="text-muted-foreground">理由</div>
                        <div className="text-left break-all">
                          {request.reason}
                        </div>
                        <div className="text-muted-foreground">申請日</div>
                        <div className="text-left">
                          {format(new Date(request.createdAt), "yyyy/MM/dd", {
                            locale: ja,
                          })}
                        </div>
                        <div className="text-muted-foreground">状態</div>
                        <div className="text-left">
                          <Badge
                            variant="outline"
                            className={
                              request.status === "approved"
                                ? "bg-green-50 text-green-700 border-green-200"
                                : request.status === "rejected"
                                ? "bg-red-50 text-red-700 border-red-200"
                                : "bg-yellow-50 text-yellow-700 border-yellow-200"
                            }
                          >
                            {request.status === "approved"
                              ? "承認済み"
                              : request.status === "rejected"
                              ? "却下"
                              : "承認待ち"}
                          </Badge>
                        </div>
                      </div>
                      <div className="mt-2">
                        {request.status === "pending" && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedRequest(request)}
                              >
                                承認/却下
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>休暇申請の処理</DialogTitle>
                                <DialogDescription>
                                  {users[request.userId] || "不明"}{" "}
                                  からの休暇申請を処理します。
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <div className="text-sm font-medium">
                                    申請内容
                                  </div>
                                  <div className="text-sm">
                                    <div>種類: {request.type}</div>
                                    <div>
                                      期間:{" "}
                                      {format(
                                        new Date(request.startDate),
                                        "M/d",
                                        {
                                          locale: ja,
                                        }
                                      )}{" "}
                                      〜{" "}
                                      {format(
                                        new Date(request.endDate),
                                        "M/d",
                                        {
                                          locale: ja,
                                        }
                                      )}
                                    </div>
                                    <div>理由: {request.reason}</div>
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <div className="text-sm font-medium">
                                    コメント
                                  </div>
                                  <Textarea
                                    placeholder="承認/却下の理由を入力（任意）"
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                  />
                                </div>
                              </div>
                              <DialogFooter>
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedRequest(null);
                                    setComment("");
                                  }}
                                >
                                  キャンセル
                                </Button>
                                <Button
                                  variant="destructive"
                                  onClick={() =>
                                    handleStatusUpdate(request.id, "rejected")
                                  }
                                  disabled={isSubmitting}
                                >
                                  却下
                                </Button>
                                <Button
                                  onClick={() =>
                                    handleStatusUpdate(request.id, "approved")
                                  }
                                  disabled={isSubmitting}
                                >
                                  承認
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        )}
                        {request.status !== "pending" && request.comment && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {request.comment}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
