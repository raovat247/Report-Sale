import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, getDocs, doc, updateDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { UserProfile } from '../types';
import { 
  Users, 
  UserCheck, 
  UserX, 
  Shield, 
  ShieldAlert, 
  Trash2, 
  Search,
  MoreVertical,
  CheckCircle2,
  Clock,
  Ban,
  Edit2,
  Mail,
  X,
  Save,
  Camera
} from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';

export default function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const usersSnap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc')));
      setUsers(usersSnap.docs.map(doc => doc.data() as UserProfile));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'users');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (userId: string, newStatus: 'active' | 'disabled' | 'pending') => {
    try {
      await updateDoc(doc(db, 'users', userId), { status: newStatus });
      setUsers(users.map(u => u.uid === userId ? { ...u, status: newStatus } : u));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: 'admin' | 'sales') => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      setUsers(users.map(u => u.uid === userId ? { ...u, role: newRole } : u));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa người dùng này?')) return;
    try {
      await deleteDoc(doc(db, 'users', userId));
      setUsers(users.filter(u => u.uid !== userId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${userId}`);
    }
  };

  const handleEditClick = (user: UserProfile) => {
    setEditingUser({ ...user });
    setIsEditModalOpen(true);
    setResetEmailSent(false);
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    setUpdateLoading(true);
    try {
      const { uid, ...data } = editingUser;
      await updateDoc(doc(db, 'users', uid), {
        displayName: editingUser.displayName,
        photoURL: editingUser.photoURL || ''
      });
      setUsers(users.map(u => u.uid === uid ? editingUser : u));
      setIsEditModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${editingUser.uid}`);
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleSendResetEmail = async () => {
    if (!editingUser) return;
    try {
      await sendPasswordResetEmail(auth, editingUser.email);
      setResetEmailSent(true);
    } catch (err) {
      alert('Không thể gửi email đặt lại mật khẩu: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const filteredUsers = users.filter(u => 
    u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Quản lý thành viên</h1>
          <p className="text-gray-400 text-sm font-medium">Phê duyệt và phân quyền cho nhân viên</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm theo tên hoặc email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 text-gray-400 text-[10px] uppercase font-bold tracking-widest">
              <tr>
                <th className="px-8 py-4">Thành viên</th>
                <th className="px-8 py-4">Vai trò</th>
                <th className="px-8 py-4">Trạng thái</th>
                <th className="px-8 py-4">Ngày tham gia</th>
                <th className="px-8 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredUsers.map((u) => (
                <tr key={u.uid} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-primary font-bold text-sm">
                        {u.displayName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-gray-900">{u.displayName}</p>
                        <p className="text-xs text-gray-400">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2">
                      {u.role === 'admin' ? (
                        <span className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                          <Shield className="w-3 h-3" />
                          Quản trị
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 px-3 py-1 bg-gray-50 text-gray-500 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                          <Users className="w-3 h-3" />
                          Nhân viên
                        </span>
                      )}
                      <select 
                        value={u.role}
                        onChange={(e) => handleUpdateRole(u.uid, e.target.value as any)}
                        className="text-[10px] border-none bg-transparent focus:ring-0 cursor-pointer text-gray-400 hover:text-gray-600"
                      >
                        <option value="sales">Sale</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    {u.status === 'active' ? (
                      <span className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-600 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                        <CheckCircle2 className="w-3 h-3" />
                        Đang hoạt động
                      </span>
                    ) : u.status === 'pending' ? (
                      <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                        <Clock className="w-3 h-3" />
                        Chờ phê duyệt
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-600 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                        <Ban className="w-3 h-3" />
                        Đã khóa
                      </span>
                    )}
                  </td>
                  <td className="px-8 py-5 text-sm text-gray-500">
                    {new Date(u.createdAt).toLocaleDateString('vi-VN')}
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {u.status === 'pending' && (
                        <button
                          onClick={() => handleUpdateStatus(u.uid, 'active')}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Phê duyệt"
                        >
                          <UserCheck className="w-4 h-4" />
                        </button>
                      )}
                      {u.status === 'active' ? (
                        <button
                          onClick={() => handleUpdateStatus(u.uid, 'disabled')}
                          className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Khóa tài khoản"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUpdateStatus(u.uid, 'active')}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Mở khóa"
                        >
                          <UserCheck className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleEditClick(u)}
                        className="p-2 text-indigo-400 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors"
                        title="Chỉnh sửa"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u.uid)}
                        className="p-2 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                        title="Xóa"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit User Modal */}
      <AnimatePresence>
        {isEditModalOpen && editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="bg-primary p-6 text-white flex justify-between items-center">
                <h2 className="text-xl font-black tracking-tight">Chỉnh sửa thành viên</h2>
                <button onClick={() => setIsEditModalOpen(false)} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                {/* Avatar Section */}
                <div className="flex flex-col items-center gap-4">
                  <div className="relative group">
                    <div className="w-24 h-24 bg-indigo-50 rounded-2xl flex items-center justify-center text-primary font-black text-3xl border-4 border-white shadow-lg overflow-hidden">
                      {editingUser.photoURL ? (
                        <img src={editingUser.photoURL} alt={editingUser.displayName} className="w-full h-full object-cover" />
                      ) : (
                        editingUser.displayName.charAt(0)
                      )}
                    </div>
                  </div>
                  <div className="w-full space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Link ảnh đại diện</label>
                    <div className="relative">
                      <Camera className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={editingUser.photoURL || ''}
                        onChange={(e) => setEditingUser({ ...editingUser, photoURL: e.target.value })}
                        className="w-full pl-11 pr-4 py-3 bg-gray-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all"
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                </div>

                {/* Name Section */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Họ và tên</label>
                  <input
                    type="text"
                    value={editingUser.displayName}
                    onChange={(e) => setEditingUser({ ...editingUser, displayName: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>

                {/* Password Reset Section */}
                <div className="pt-4 border-t border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Bảo mật</p>
                  {resetEmailSent ? (
                    <div className="flex items-center gap-2 text-green-600 text-xs font-bold bg-green-50 p-3 rounded-xl">
                      <CheckCircle2 className="w-4 h-4" />
                      Đã gửi email đặt lại mật khẩu tới {editingUser.email}
                    </div>
                  ) : (
                    <button
                      onClick={handleSendResetEmail}
                      className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 text-gray-500 rounded-xl text-xs font-bold hover:border-primary hover:text-primary transition-all"
                    >
                      <Mail className="w-4 h-4" />
                      Gửi email đặt lại mật khẩu
                    </button>
                  )}
                </div>
              </div>

              <div className="p-6 bg-gray-50 flex gap-3">
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-3 text-gray-500 font-bold text-xs uppercase tracking-widest hover:bg-gray-100 rounded-xl transition-all"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSaveUser}
                  disabled={updateLoading}
                  className="flex-[2] py-3 bg-primary text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {updateLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Lưu thay đổi
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
