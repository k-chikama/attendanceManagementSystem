import { db } from "./firebase";
import { doc, setDoc, getDoc, getDocs, collection } from "firebase/firestore";

// ユーザー情報を保存
export const saveUserProfile = async (user: {
  uid: string;
  name: string;
  email: string;
  department: string;
  position: string;
  role: string;
}) => {
  await setDoc(doc(db, "users", user.uid), user);
};

// ユーザー情報を取得
export const getUserProfile = async (uid: string) => {
  const docRef = doc(db, "users", uid);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data() : null;
};

// 全ユーザー一覧を取得
export const getAllUsers = async () => {
  const querySnapshot = await getDocs(collection(db, "users"));
  return querySnapshot.docs.map((doc) => ({ uid: doc.id, ...doc.data() }));
};
