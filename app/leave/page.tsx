"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { CalendarIcon, ArrowLeft } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { getCurrentUser, getAllUsers } from "@/lib/auth";
import {
  createLeaveRequest,
  getUserLeaveRequests,
  getLeaveRequests,
  updateLeaveRequest,
  deleteLeaveRequest,
  validateLeaveRequest,
  calculateLeaveDays,
  type LeaveRequest,
} from "@/lib/leave";
import AppLayout from "@/components/layout/layout";
import { useUser } from "@/contexts/UserContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const formSchema = z.object({
  type: z.enum(["有給休暇", "特別休暇", "慶弔休暇", "その他"]),
  startDate: z.date({
    required_error: "開始日を選択してください",
  }),
  endDate: z.date({
    required_error: "終了日を選択してください",
  }),
  reason: z.string().optional(),
});

export default function LeavePage() {
  const user = useUser();
  const { toast } = useToast();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allRequests, setAllRequests] = useState<LeaveRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(
    null
  );
  const [adminComment, setAdminComment] = useState("");
  const [isAdminSubmitting, setIsAdminSubmitting] = useState(false);
  const [userMap, setUserMap] = useState<{ [key: string]: string }>({});

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: "有給休暇",
      reason: "",
    },
  });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const reqs = await getUserLeaveRequests(user.id);
      setRequests(reqs);
    })();
  }, [user]);

  useEffect(() => {
    if (user && user.role === "admin") {
      (async () => {
        const all = await getLeaveRequests();
        setAllRequests(all);
        const users = getAllUsers();
        const map: { [key: string]: string } = {};
        users.forEach((u) => {
          map[u.id] = u.name;
        });
        setUserMap(map);
      })();
    }
  }, [user]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) return;
    try {
      setIsSubmitting(true);
      const validationError = validateLeaveRequest({
        startDate: values.startDate.toISOString(),
        endDate: values.endDate.toISOString(),
        type: values.type,
        reason: values.reason ?? "",
      });
      if (validationError) {
        toast({
          variant: "destructive",
          title: "エラー",
          description: validationError,
        });
        return;
      }
      // Firestoreに申請
      const newRequest = await createLeaveRequest({
        userId: user.id,
        type: values.type,
        startDate: values.startDate.toISOString(),
        endDate: values.endDate.toISOString(),
        reason: values.reason ?? "",
      });
      setRequests((prev) => [...prev, newRequest]);
      toast({
        title: "申請が完了しました",
        description: "休暇申請が正常に送信されました。",
      });
      form.reset();
    } catch (error) {
      console.error("申請エラー:", error);
      toast({
        variant: "destructive",
        title: "エラー",
        description:
          error instanceof Error ? error.message : "申請に失敗しました",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 管理者用 承認/却下処理
  const handleAdminStatusUpdate = async (
    requestId: string,
    newStatus: "approved" | "rejected"
  ) => {
    try {
      setIsAdminSubmitting(true);
      const updatedRequest = await updateLeaveRequest(requestId, {
        status: newStatus,
        comment: adminComment,
        approvedBy: user?.id,
        approvedAt: new Date().toISOString(),
      });
      setAllRequests((prev) =>
        prev.map((req) => (req.id === requestId ? updatedRequest : req))
      );
      setSelectedRequest(null);
      setAdminComment("");
      toast({
        title: "更新完了",
        description: `休暇申請を${
          newStatus === "approved" ? "承認" : "却下"
        }しました。`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "エラー",
        description: "更新に失敗しました。",
      });
    } finally {
      setIsAdminSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <AppLayout>
      {user?.role === "admin" && (
        <div className="max-w-6xl w-full mx-auto mb-8">
          <Card>
            <CardHeader>
              <CardTitle>全ユーザーの休暇申請一覧（管理者用）</CardTitle>
              <CardDescription>
                全従業員の休暇申請を承認または却下できます。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto w-full hidden md:block">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr>
                      <th className="px-2 py-1 text-left">申請者名</th>
                      <th className="px-2 py-1 text-left">種類</th>
                      <th className="px-2 py-1 text-left">期間</th>
                      <th className="px-2 py-1 text-left">理由</th>
                      <th className="px-2 py-1 text-left">申請日</th>
                      <th className="px-2 py-1 text-left">状態</th>
                      <th className="px-2 py-1 text-left">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allRequests.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="text-center text-muted-foreground py-4"
                        >
                          申請はありません
                        </td>
                      </tr>
                    ) : (
                      allRequests
                        .sort(
                          (a, b) =>
                            new Date(b.createdAt).getTime() -
                            new Date(a.createdAt).getTime()
                        )
                        .map((request) => (
                          <tr key={request.id}>
                            <td className="px-2 py-1 text-left">
                              {userMap[request.userId] || "不明"}
                            </td>
                            <td className="px-2 py-1 text-left">
                              {request.type}
                            </td>
                            <td className="px-2 py-1 text-left">
                              {format(
                                new Date(request.startDate),
                                "yyyy/MM/dd",
                                { locale: ja }
                              )}{" "}
                              〜{" "}
                              {format(new Date(request.endDate), "yyyy/MM/dd", {
                                locale: ja,
                              })}
                            </td>
                            <td className="px-2 py-1 text-left max-w-[200px] truncate">
                              {request.reason}
                            </td>
                            <td className="px-2 py-1 text-left">
                              {format(
                                new Date(request.createdAt),
                                "yyyy/MM/dd",
                                { locale: ja }
                              )}
                            </td>
                            <td className="px-2 py-1 text-left">
                              <span
                                className={cn(
                                  "rounded-full px-2 py-1 text-xs",
                                  request.status === "approved"
                                    ? "bg-green-100 text-green-800"
                                    : request.status === "rejected"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-yellow-100 text-yellow-800"
                                )}
                              >
                                {request.status === "approved"
                                  ? "承認済み"
                                  : request.status === "rejected"
                                  ? "却下"
                                  : "承認待ち"}
                              </span>
                            </td>
                            <td className="px-2 py-1 text-left">
                              {request.status === "pending" && (
                                <Dialog
                                  open={selectedRequest?.id === request.id}
                                  onOpenChange={(open) => {
                                    if (!open) {
                                      setSelectedRequest(null);
                                      setAdminComment("");
                                    }
                                  }}
                                >
                                  <DialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        setSelectedRequest(request)
                                      }
                                    >
                                      承認/却下
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>休暇申請の処理</DialogTitle>
                                      <DialogDescription>
                                        申請者ID: {request.userId}{" "}
                                        の休暇申請を処理します。
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-2 py-2">
                                      <div className="text-sm">
                                        種類: {request.type}
                                      </div>
                                      <div className="text-sm">
                                        期間:{" "}
                                        {format(
                                          new Date(request.startDate),
                                          "yyyy/MM/dd",
                                          { locale: ja }
                                        )}{" "}
                                        〜{" "}
                                        {format(
                                          new Date(request.endDate),
                                          "yyyy/MM/dd",
                                          { locale: ja }
                                        )}
                                      </div>
                                      <div className="text-sm">
                                        理由: {request.reason}
                                      </div>
                                      <div className="text-sm font-medium mt-2">
                                        コメント
                                      </div>
                                      <Textarea
                                        placeholder="承認/却下の理由を入力（任意）"
                                        value={adminComment}
                                        onChange={(e) =>
                                          setAdminComment(e.target.value)
                                        }
                                      />
                                    </div>
                                    <DialogFooter>
                                      <Button
                                        variant="outline"
                                        onClick={() => {
                                          setSelectedRequest(null);
                                          setAdminComment("");
                                        }}
                                      >
                                        キャンセル
                                      </Button>
                                      <Button
                                        variant="destructive"
                                        onClick={() =>
                                          handleAdminStatusUpdate(
                                            request.id,
                                            "rejected"
                                          )
                                        }
                                        disabled={isAdminSubmitting}
                                      >
                                        却下
                                      </Button>
                                      <Button
                                        onClick={() =>
                                          handleAdminStatusUpdate(
                                            request.id,
                                            "approved"
                                          )
                                        }
                                        disabled={isAdminSubmitting}
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
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="block md:hidden space-y-4">
                {allRequests
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
                      <div className="mb-2 font-bold text-base text-left">
                        {userMap[request.userId] || "不明"}
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
                          <span
                            className={cn(
                              "rounded-full px-2 py-1 text-xs",
                              request.status === "approved"
                                ? "bg-green-100 text-green-800"
                                : request.status === "rejected"
                                ? "bg-red-100 text-red-800"
                                : "bg-yellow-100 text-yellow-800"
                            )}
                          >
                            {request.status === "approved"
                              ? "承認済み"
                              : request.status === "rejected"
                              ? "却下"
                              : "承認待ち"}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2">
                        {request.status === "pending" && (
                          <Dialog
                            open={selectedRequest?.id === request.id}
                            onOpenChange={(open) => {
                              if (!open) {
                                setSelectedRequest(null);
                                setAdminComment("");
                              }
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedRequest(request)}
                              >
                                承認/却下
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>休暇申請の処理</DialogTitle>
                                <DialogDescription>
                                  申請者ID: {request.userId}{" "}
                                  の休暇申請を処理します。
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-2 py-2">
                                <div className="text-sm">
                                  種類: {request.type}
                                </div>
                                <div className="text-sm">
                                  期間:{" "}
                                  {format(
                                    new Date(request.startDate),
                                    "yyyy/MM/dd",
                                    { locale: ja }
                                  )}{" "}
                                  〜{" "}
                                  {format(
                                    new Date(request.endDate),
                                    "yyyy/MM/dd",
                                    { locale: ja }
                                  )}
                                </div>
                                <div className="text-sm">
                                  理由: {request.reason}
                                </div>
                                <div className="text-sm font-medium mt-2">
                                  コメント
                                </div>
                                <Textarea
                                  placeholder="承認/却下の理由を入力（任意）"
                                  value={adminComment}
                                  onChange={(e) =>
                                    setAdminComment(e.target.value)
                                  }
                                />
                              </div>
                              <DialogFooter>
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedRequest(null);
                                    setAdminComment("");
                                  }}
                                >
                                  キャンセル
                                </Button>
                                <Button
                                  variant="destructive"
                                  onClick={() =>
                                    handleAdminStatusUpdate(
                                      request.id,
                                      "rejected"
                                    )
                                  }
                                  disabled={isAdminSubmitting}
                                >
                                  却下
                                </Button>
                                <Button
                                  onClick={() =>
                                    handleAdminStatusUpdate(
                                      request.id,
                                      "approved"
                                    )
                                  }
                                  disabled={isAdminSubmitting}
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
            </CardContent>
          </Card>
        </div>
      )}
      <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>休暇申請</CardTitle>
                <CardDescription>
                  休暇の申請を行います。申請内容を入力してください。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-6"
                  >
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>休暇の種類</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="休暇の種類を選択" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="有給休暇">有給休暇</SelectItem>
                              <SelectItem value="特別休暇">特別休暇</SelectItem>
                              <SelectItem value="慶弔休暇">慶弔休暇</SelectItem>
                              <SelectItem value="その他">その他</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="startDate"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>開始日</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant={"outline"}
                                    className={cn(
                                      "w-full pl-3 text-left font-normal",
                                      !field.value && "text-muted-foreground"
                                    )}
                                  >
                                    {field.value ? (
                                      format(field.value, "PPP", { locale: ja })
                                    ) : (
                                      <span>日付を選択</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent
                                className="w-auto p-0"
                                align="start"
                              >
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  disabled={(date) =>
                                    date < new Date() ||
                                    date >
                                      new Date(
                                        new Date().setMonth(
                                          new Date().getMonth() + 3
                                        )
                                      )
                                  }
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="endDate"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>終了日</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant={"outline"}
                                    className={cn(
                                      "w-full pl-3 text-left font-normal",
                                      !field.value && "text-muted-foreground"
                                    )}
                                  >
                                    {field.value ? (
                                      format(field.value, "PPP", { locale: ja })
                                    ) : (
                                      <span>日付を選択</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent
                                className="w-auto p-0"
                                align="start"
                              >
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  disabled={(date) =>
                                    date < new Date() ||
                                    date >
                                      new Date(
                                        new Date().setMonth(
                                          new Date().getMonth() + 3
                                        )
                                      )
                                  }
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="reason"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>申請理由</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="申請理由を入力してください"
                              className="resize-none"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "申請中..." : "申請する"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>申請履歴</CardTitle>
                <CardDescription>
                  過去の休暇申請の履歴を表示します。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {requests.length === 0 ? (
                    <p className="text-center text-muted-foreground">
                      申請履歴はありません
                    </p>
                  ) : (
                    requests
                      .sort(
                        (a, b) =>
                          new Date(b.createdAt).getTime() -
                          new Date(a.createdAt).getTime()
                      )
                      .map((request) => (
                        <div
                          key={request.id}
                          className="flex flex-col space-y-2 rounded-lg border p-4"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="font-medium">
                                {request.type}
                              </span>
                              <span
                                className={cn(
                                  "rounded-full px-2 py-1 text-xs",
                                  request.status === "approved"
                                    ? "bg-green-100 text-green-800"
                                    : request.status === "rejected"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-yellow-100 text-yellow-800"
                                )}
                              >
                                {request.status === "approved"
                                  ? "承認済み"
                                  : request.status === "rejected"
                                  ? "却下"
                                  : "承認待ち"}
                              </span>
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {format(
                                new Date(request.createdAt),
                                "yyyy/MM/dd",
                                {
                                  locale: ja,
                                }
                              )}
                            </span>
                          </div>
                          <div className="text-sm">
                            <p>
                              期間:{" "}
                              {format(
                                new Date(request.startDate),
                                "yyyy/MM/dd",
                                {
                                  locale: ja,
                                }
                              )}{" "}
                              〜{" "}
                              {format(new Date(request.endDate), "yyyy/MM/dd", {
                                locale: ja,
                              })}
                              （
                              {calculateLeaveDays(
                                request.startDate,
                                request.endDate
                              )}
                              日間）
                            </p>
                            <p className="mt-1 text-muted-foreground">
                              {request.reason}
                            </p>
                          </div>
                          {request.comment && (
                            <div className="mt-2 rounded bg-muted p-2 text-sm">
                              <p className="font-medium">コメント:</p>
                              <p className="mt-1">{request.comment}</p>
                            </div>
                          )}
                        </div>
                      ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
