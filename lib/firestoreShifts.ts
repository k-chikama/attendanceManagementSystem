import { db } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";

// シフトの保存
export const addShift = async (shift: any) => {
  await addDoc(collection(db, "shifts"), shift);
};

// ユーザーごとのシフト取得
export const getShiftsByUser = async (userId: string) => {
  const q = query(collection(db, "shifts"), where("userId", "==", userId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

// シフト編集
export const updateShift = async (shiftId: string, updates: any) => {
  await updateDoc(doc(db, "shifts", shiftId), updates);
};

// 複数のシフトを一括更新
export const updateShifts = async (
  updates: { userId: string; date: string; type: string }[]
) => {
  const batch = writeBatch(db);

  // 各シフトの更新をバッチに追加
  for (const update of updates) {
    // 既存のシフトを検索
    const q = query(
      collection(db, "shifts"),
      where("userId", "==", update.userId),
      where("date", "==", update.date)
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      // シフトが存在しない場合は新規作成
      const newShiftRef = doc(collection(db, "shifts"));
      batch.set(newShiftRef, {
        ...update,
        status: "approved",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } else {
      // 既存のシフトを更新
      const shiftDoc = querySnapshot.docs[0];
      batch.update(doc(db, "shifts", shiftDoc.id), {
        ...update,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  // バッチを実行
  await batch.commit();
};

// シフト削除
export const deleteShift = async (shiftId: string) => {
  await deleteDoc(doc(db, "shifts", shiftId));
};
