import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, updateDoc, getDocs, where, setDoc } from 'firebase/firestore';
import { DailyReport, UserProfile } from '../types';
import { format, parseISO } from 'date-fns';
import { 
  History, 
  Search, 
  Trash2, 
  Edit2, 
  Calendar, 
  User as UserIcon, 
  ChevronRight, 
  X, 
  Save, 
  DollarSign, 
  Users, 
  MessageSquare, 
  Mail, 
  Zap, 
  AlertCircle,
  Plus,
  Link as LinkIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function ReportHistory({ user }: { user: UserProfile }) {
  const [reports, setReports] = useState<(DailyReport & { userName?: string })[]>([]);
  const [users, setUsers] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingReport, setEditingReport] = useState<DailyReport | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    // Fetch users to map userId to displayName and photoURL
    const fetchUsers = async () => {
      const usersSnap = await getDocs(collection(db, 'users'));
      const userMap: Record<string, UserProfile> = {};
      usersSnap.forEach(doc => {
        userMap[doc.id] = doc.data() as UserProfile;
      });
      setUsers(userMap);
    };

    fetchUsers();

    let q = query(collection(db, 'daily_reports'), orderBy('date', 'desc'), orderBy('createdAt', 'desc'));
    
    if (user.role !== 'admin') {
      q = query(collection(db, 'daily_reports'), where('userId', '==', user.uid), orderBy('date', 'desc'), orderBy('createdAt', 'desc'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reportsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as DailyReport[];
      setReports(reportsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'daily_reports');
    });

    return () => unsubscribe();
  }, []);

  const handleDelete = async (report: DailyReport) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa báo cáo này?')) return;
    try {
      await deleteDoc(doc(db, 'daily_reports', report.id!));
      // Delete public stat as well
      const publicStatId = `${report.userId}_${report.date}`;
      await deleteDoc(doc(db, 'public_stats', publicStatId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `daily_reports/${report.id}`);
    }
  };

  const handleEdit = (report: DailyReport) => {
    setEditingReport({ ...report });
    setIsEditModalOpen(true);
  };

  const handleUpdateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReport || !editingReport.id) return;

    try {
      const { id, ...data } = editingReport;
      await updateDoc(doc(db, 'daily_reports', id), data);
      
      // Sync with public_stats
      const reportingUser = users[editingReport.userId];
      const publicStatId = `${editingReport.userId}_${editingReport.date}`;
      await setDoc(doc(db, 'public_stats', publicStatId), {
        userId: editingReport.userId,
        userName: reportingUser?.displayName || 'Unknown',
        userPhotoURL: reportingUser?.photoURL || '',
        date: editingReport.date,
        revenue: editingReport.revenue,
        partnerCount: editingReport.daiLyCTV.length,
        mxhCount: editingReport.dangTinMXH.length,
        leadsCount: editingReport.soKHTiemNang,
        updatedAt: new Date().toISOString()
      });

      setIsEditModalOpen(false);
      setEditingReport(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `daily_reports/${editingReport.id}`);
    }
  };

  const filteredReports = reports.filter(report => {
    const userName = users[report.userId]?.displayName || 'Unknown';
    const searchLower = searchTerm.toLowerCase();
    return (
      userName.toLowerCase().includes(searchLower) ||
      report.date.includes(searchTerm)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-gray-900 flex items-center gap-3">
            <History className="w-8 h-8 text-primary" />
            Lịch sử báo cáo
          </h2>
          <p className="text-gray-500 text-sm mt-1 font-medium">Quản lý và điều chỉnh các báo cáo đã gửi</p>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm theo tên hoặc ngày (YYYY-MM-DD)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border border-gray-100 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
          />
        </div>
      </div>

      {/* Reports List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Nhân viên / Ngày</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Doanh số</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Chỉ số chính</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Đối tác / MXH</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredReports.map((report) => (
                <tr key={report.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-primary/5 rounded-xl flex items-center justify-center text-primary">
                        <UserIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{users[report.userId]?.displayName || 'Unknown'}</p>
                        <div className="flex items-center gap-1.5 text-gray-400 text-[10px] font-bold uppercase tracking-wider mt-0.5">
                          <Calendar className="w-3 h-3" />
                          {format(parseISO(report.date), 'dd/MM/yyyy')}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-6">
                    <p className="font-black text-primary">
                      {new Intl.NumberFormat('vi-VN').format(report.revenue)}
                      <span className="text-[10px] ml-1 opacity-50">đ</span>
                    </p>
                  </td>
                  <td className="px-6 py-6">
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold">
                        {report.donHangMBI} MBI
                      </span>
                      <span className="px-2 py-1 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-bold">
                        {report.chat} Chat
                      </span>
                      <span className="px-2 py-1 bg-purple-50 text-purple-600 rounded-lg text-[10px] font-bold">
                        {report.soKHTiemNang} Tiềm năng
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-6">
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Đối tác</span>
                        <span className="text-sm font-bold text-gray-700">{report.daiLyCTV.length}</span>
                      </div>
                      <div className="w-px h-6 bg-gray-100" />
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">MXH</span>
                        <span className="text-sm font-bold text-gray-700">{report.dangTinMXH.length}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {(user.role === 'admin' || (report.userId === user.uid && report.date === format(new Date(), 'yyyy-MM-dd'))) && (
                        <>
                          <button 
                            onClick={() => handleEdit(report)}
                            className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
                            title="Chỉnh sửa"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(report)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                            title="Xóa"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredReports.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-300">
                        <History className="w-8 h-8" />
                      </div>
                      <p className="text-gray-400 font-medium">Không tìm thấy báo cáo nào</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {isEditModalOpen && editingReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="bg-primary p-8 text-white flex justify-between items-center flex-shrink-0">
                <div>
                  <h3 className="text-xl font-black tracking-tight">Điều chỉnh báo cáo</h3>
                  <p className="text-white/70 text-xs font-bold uppercase tracking-widest mt-1">
                    {users[editingReport.userId]?.displayName || 'Unknown'} • {format(parseISO(editingReport.date), 'dd/MM/yyyy')}
                  </p>
                </div>
                <button 
                  onClick={() => setIsEditModalOpen(false)}
                  className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-8 overflow-y-auto space-y-8">
                <form id="edit-report-form" onSubmit={handleUpdateReport} className="space-y-8">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[
                      { name: 'revenue', label: 'Doanh số (VNĐ)', icon: <DollarSign className="w-4 h-4" /> },
                      { name: 'khachHangTuTim', label: 'KH tự tìm', icon: <Users className="w-4 h-4" /> },
                      { name: 'khachHangGioiThieu', label: 'KH giới thiệu', icon: <Users className="w-4 h-4" /> },
                      { name: 'chat', label: 'Chat', icon: <MessageSquare className="w-4 h-4" /> },
                      { name: 'donHangMBI', label: 'Đơn hàng MBI', icon: <Zap className="w-4 h-4" /> },
                      { name: 'soKHTiemNang', label: 'KH tiềm năng', icon: <Users className="w-4 h-4" /> },
                      { name: 'khachHangCu', label: 'KH Cũ của tôi', icon: <Users className="w-4 h-4" /> },
                    ].map((field) => (
                      <div key={field.name} className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                          {field.icon}
                          {field.label}
                        </label>
                        <input
                          type="number"
                          value={editingReport[field.name as keyof DailyReport] as number}
                          onChange={(e) => setEditingReport({
                            ...editingReport,
                            [field.name]: parseFloat(e.target.value) || 0
                          })}
                          className="w-full bg-gray-50 border-none rounded-xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Partners Section in Edit */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" />
                      Danh sách đối tác ({editingReport.daiLyCTV.length})
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {editingReport.daiLyCTV.map((p, idx) => (
                        <div key={idx} className="p-4 bg-gray-50 rounded-2xl flex items-center justify-between group">
                          <div className="space-y-1">
                            <input 
                              type="text" 
                              value={p.name}
                              onChange={(e) => {
                                const newList = [...editingReport.daiLyCTV];
                                newList[idx].name = e.target.value;
                                setEditingReport({ ...editingReport, daiLyCTV: newList });
                              }}
                              className="bg-transparent border-none p-0 text-sm font-bold focus:ring-0 w-full"
                            />
                            <input 
                              type="text" 
                              value={p.phone}
                              onChange={(e) => {
                                const newList = [...editingReport.daiLyCTV];
                                newList[idx].phone = e.target.value;
                                setEditingReport({ ...editingReport, daiLyCTV: newList });
                              }}
                              className="bg-transparent border-none p-0 text-xs text-gray-400 font-medium focus:ring-0 w-full"
                            />
                          </div>
                          <button 
                            type="button"
                            onClick={() => {
                              const newList = editingReport.daiLyCTV.filter((_, i) => i !== idx);
                              setEditingReport({ ...editingReport, daiLyCTV: newList });
                            }}
                            className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setEditingReport({
                          ...editingReport,
                          daiLyCTV: [...editingReport.daiLyCTV, { name: 'Mới', phone: '', content: '' }]
                        })}
                        className="p-4 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2 text-xs font-bold"
                      >
                        <Plus className="w-4 h-4" /> Thêm đối tác
                      </button>
                    </div>
                  </div>

                  {/* MXH Links Section in Edit */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                      <LinkIcon className="w-4 h-4 text-primary" />
                      Bài đăng MXH ({editingReport.dangTinMXH.length})
                    </h4>
                    <div className="space-y-2">
                      {editingReport.dangTinMXH.map((link, idx) => (
                        <div key={idx} className="flex gap-2">
                          <input 
                            type="text" 
                            value={link}
                            onChange={(e) => {
                              const newList = [...editingReport.dangTinMXH];
                              newList[idx] = e.target.value;
                              setEditingReport({ ...editingReport, dangTinMXH: newList });
                            }}
                            className="flex-1 bg-gray-50 border-none rounded-xl py-3 px-4 text-xs font-medium focus:ring-2 focus:ring-primary/20"
                          />
                          <button 
                            type="button"
                            onClick={() => {
                              const newList = editingReport.dangTinMXH.filter((_, i) => i !== idx);
                              setEditingReport({ ...editingReport, dangTinMXH: newList });
                            }}
                            className="p-3 text-gray-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setEditingReport({
                          ...editingReport,
                          dangTinMXH: [...editingReport.dangTinMXH, '']
                        })}
                        className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2 text-xs font-bold"
                      >
                        <Plus className="w-4 h-4" /> Thêm link
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              <div className="p-8 bg-white border-t border-gray-50 flex justify-end gap-4 flex-shrink-0">
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-8 py-3.5 bg-gray-100 text-gray-600 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-gray-200 transition-all"
                >
                  Hủy
                </button>
                <button
                  form="edit-report-form"
                  type="submit"
                  className="px-10 py-3.5 bg-primary text-white rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
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
