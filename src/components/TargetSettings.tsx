import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, getDocs, addDoc, setDoc, doc, deleteDoc } from 'firebase/firestore';
import { MonthlyTarget, UserProfile } from '../types';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from 'date-fns';
import { Save, Plus, Trash2, Users, Target, TrendingUp, Calendar, AlertCircle } from 'lucide-react';

export default function TargetSettings() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [targets, setTargets] = useState<MonthlyTarget[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [newTarget, setNewTarget] = useState<Omit<MonthlyTarget, 'id' | 'createdAt'>>({
    userId: '',
    month: selectedMonth,
    revenue: 0,
    partners: 0,
    mxh: 0,
    zalo: 0,
  });

  useEffect(() => {
    fetchUsers();
    fetchTargets();
  }, [selectedMonth]);

  const fetchUsers = async () => {
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'sales'));
      const querySnapshot = await getDocs(q);
      const fetchedUsers = querySnapshot.docs.map(doc => doc.data() as UserProfile);
      setUsers(fetchedUsers);
      if (fetchedUsers.length > 0 && !newTarget.userId) {
        setNewTarget(prev => ({ ...prev, userId: fetchedUsers[0].uid }));
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'users');
    }
  };

  const fetchTargets = async () => {
    try {
      const q = query(collection(db, 'monthly_targets'), where('month', '==', selectedMonth));
      const querySnapshot = await getDocs(q);
      setTargets(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MonthlyTarget)));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'monthly_targets');
    }
  };

  const handleAddTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const targetData = {
        ...newTarget,
        month: selectedMonth,
        createdAt: new Date().toISOString(),
      };

      // Check if target already exists for this user and month
      const existing = targets.find(t => t.userId === newTarget.userId);
      if (existing) {
        await setDoc(doc(db, 'monthly_targets', existing.id!), targetData);
      } else {
        await addDoc(collection(db, 'monthly_targets'), targetData);
      }
      
      fetchTargets();
      setNewTarget(prev => ({ ...prev, revenue: 0, partners: 0, mxh: 0, zalo: 0 }));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'monthly_targets');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa mục tiêu này?')) return;
    try {
      await deleteDoc(doc(db, 'monthly_targets', id));
      fetchTargets();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'monthly_targets');
    }
  };

  const calculateDailyTarget = (total: number) => {
    const start = startOfMonth(new Date(selectedMonth));
    const end = endOfMonth(start);
    const days = eachDayOfInterval({ start, end });
    const workingDays = days.filter(day => !isWeekend(day)).length;
    return workingDays > 0 ? (total / workingDays).toLocaleString() : '0';
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Thiết lập mục tiêu</h1>
          <p className="text-gray-400 text-sm font-medium">Quản lý mục tiêu doanh số và KPI cho nhân viên</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
          <Calendar className="w-5 h-5 text-primary ml-2" />
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-transparent border-none focus:ring-0 text-sm font-bold text-gray-900 outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Section */}
        <div className="lg:col-span-1">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-50 sticky top-24">
            <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Target className="text-primary w-5 h-5" />
              Thêm mục tiêu mới
            </h2>
            <form onSubmit={handleAddTarget} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nhân viên</label>
                <select
                  value={newTarget.userId}
                  onChange={(e) => setNewTarget(prev => ({ ...prev, userId: e.target.value }))}
                  className="w-full bg-gray-50 border-none rounded-xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all"
                >
                  <option value="">Chọn nhân viên...</option>
                  {users.map(u => (
                    <option key={u.uid} value={u.uid}>{u.displayName}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Mục tiêu Doanh số</label>
                <div className="relative">
                  <input
                    type="number"
                    value={newTarget.revenue}
                    onChange={(e) => setNewTarget(prev => ({ ...prev, revenue: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-gray-50 border-none rounded-xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all"
                    placeholder="0"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400">VNĐ</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Mục tiêu Đại lý/CTV</label>
                <input
                  type="number"
                  value={newTarget.partners}
                  onChange={(e) => setNewTarget(prev => ({ ...prev, partners: parseFloat(e.target.value) || 0 }))}
                  className="w-full bg-gray-50 border-none rounded-xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all"
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Mục tiêu Bài đăng MXH</label>
                <input
                  type="number"
                  value={newTarget.mxh}
                  onChange={(e) => setNewTarget(prev => ({ ...prev, mxh: parseFloat(e.target.value) || 0 }))}
                  className="w-full bg-gray-50 border-none rounded-xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all"
                  placeholder="0"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !newTarget.userId}
                className="w-full py-4 bg-primary text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95 disabled:opacity-50"
              >
                <Save className="w-5 h-5" />
                Lưu mục tiêu
              </button>
            </form>
          </div>
        </div>

        {/* List Section */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-50 overflow-hidden">
            <div className="p-8 border-b border-gray-50 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-900">Danh sách mục tiêu Tháng {format(new Date(selectedMonth), 'MM/yyyy')}</h2>
              <span className="bg-primary/5 text-primary px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
                {targets.length} Nhân viên
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50/50 text-gray-400 text-[10px] uppercase font-bold tracking-widest">
                  <tr>
                    <th className="px-8 py-4">Nhân viên</th>
                    <th className="px-8 py-4">Doanh số</th>
                    <th className="px-8 py-4">Đại lý/CTV</th>
                    <th className="px-8 py-4">MXH</th>
                    <th className="px-8 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {targets.map((t) => {
                    const user = users.find(u => u.uid === t.userId);
                    return (
                      <tr key={t.id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-primary/5 rounded-lg flex items-center justify-center text-primary font-bold text-xs">
                              {user?.displayName.charAt(0)}
                            </div>
                            <span className="font-bold text-sm text-gray-900">{user?.displayName}</span>
                          </div>
                        </td>
                        <td className="px-8 py-5 font-bold text-sm text-primary">{t.revenue.toLocaleString()}</td>
                        <td className="px-8 py-5 text-sm text-gray-500 font-bold">{t.partners}</td>
                        <td className="px-8 py-5 text-sm text-gray-500 font-bold">{t.mxh}</td>
                        <td className="px-8 py-5 text-right">
                          <button
                            onClick={() => handleDelete(t.id!)}
                            className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {targets.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-8 py-12 text-center text-gray-400 font-medium">
                        Chưa có mục tiêu cho tháng này
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
