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

// シフト削除
export const deleteShift = async (shiftId: string) => {
  await deleteDoc(doc(db, "shifts", shiftId));
};
