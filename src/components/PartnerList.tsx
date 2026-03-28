import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType, auth } from '../firebase';
import { collection, query, getDocs, where, orderBy, addDoc, writeBatch } from 'firebase/firestore';
import { DailyReport, UserProfile, PartnerDirectory } from '../types';
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, isWithinInterval } from 'date-fns';
import { Users, Search, Calendar, User as UserIcon, Phone, MessageSquare, Plus, Database, Loader2, Building2, UserCircle, X, BarChart3, Filter, ChevronDown, Download, PieChart, CheckCircle2, HelpCircle, Edit, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';

interface PartnerEntry {
  userName: string;
  partnerName: string;
  phone: string;
  content: string;
  date: string;
}

interface RevenueReport {
  partnerName: string;
  saleName: string;
  revenue: number;
  orderCount: number;
}

const SEED_PARTNERS = [
  { name: "NHANH", type: "ĐẶC BIỆT - ĐĂNG KÝ", userName: "Võ Thị Uyên Bình" },
  { name: "CÔNG TY TNHH TƯ VẤN NHÂN ĐỨC", type: "CÔNG TY - ĐĂNG KÝ", userName: "Nguyễn Ngọc Phương Nhi" },
  { name: "Công Ty TNHH TM DV Blue Heaven", type: "CÔNG TY - ĐĂNG KÝ", userName: "Nguyễn Ngọc Phương Nhi" },
  { name: "CÔNG TY CỔ PHẦN SPHACY", type: "CÔNG TY - ĐĂNG KÝ", userName: "Nguyễn Ngọc Phương Nhi" },
  { name: "PHẦN MỀM VÀNG", type: "CÔNG TY - ĐĂNG KÝ", userName: "Lê Thị Kim Quyên" },
  { name: "CÔNG TY CỔ PHẦN SEPAY", type: "CÔNG TY - ĐĂNG KÝ", userName: "Hoàng Minh Nguyệt" },
  { name: "REACH", type: "CÔNG TY - ĐĂNG KÝ", userName: "Lê Thị Kim Quyên" },
  { name: "KIOVN", type: "CÔNG TY - ĐĂNG KÝ", userName: "Lê Thị Kim Quyên" },
  { name: "CÔNG TY TNHH MONA HOST", type: "CÔNG TY - ĐĂNG KÝ", userName: "Nguyễn Ngọc Phương Nhi" },
  { name: "CÔNG TY TNHH CÔNG NGHỆ PHẦN MỀM S.O.C", type: "CÔNG TY - ĐĂNG KÝ", userName: "Nguyễn Ngọc Phương Nhi" },
  { name: "CÔNG TY LUẬT TRÁCH NHIỆM HỮU HẠN MỘT THÀNH VIÊN CG GROUP", type: "CÔNG TY - ĐĂNG KÝ", userName: "Lê Thị Kim Quyên" },
  { name: "VTC POS", type: "CÔNG TY - ĐĂNG KÝ", userName: "Lê Thị Kim Quyên" },
  { name: "CÔNG TY CỔ PHẦN BLUECORE", type: "CÔNG TY - ĐĂNG KÝ", userName: "Hoàng Minh Nguyệt" },
  { name: "CÔNG TY CỔ PHẦN THƯƠNG MẠI DỊCH VỤ 30DAYSUP", type: "CÔNG TY - ĐĂNG KÝ", userName: "Hoàng Minh Nguyệt" },
  { name: "CÔNG TY CỔ PHẦN GIẢI PHÁP CÔNG NGHÊ ZEN", type: "CÔNG TY - ĐĂNG KÝ", userName: "Hoàng Minh Nguyệt" },
  { name: "CÔNG TY TNHH DỊCH VỤ KẾ TOÁN THUẾ LOTUS", type: "CÔNG TY - ĐĂNG KÝ", userName: "Nguyễn Ngọc Phương Nhi" },
  { name: "CTV VÕ MINH NGÂN", type: "CÁ NHÂN", userName: "Lê Thị Kim Quyên" },
  { name: "CTV TRẦN QUANG TRƯỜNG", type: "CÁ NHÂN", userName: "Nguyễn Ngọc Phương Nhi" },
  { name: "CTV Nguyễn Thị Minh", type: "CÁ NHÂN", userName: "Nguyễn Ngọc Phương Nhi" },
  { name: "CTV VÕ QUYỀN ANH", type: "CÁ NHÂN", userName: "Ngô Thị Bích Hằng" },
  { name: "CTV Bùi Mai Anh", type: "CÁ NHÂN", userName: "Ngô Thị Bích Hằng" },
  { name: "CTV Nguyễn Văn Huy", type: "CÁ NHÂN", userName: "Lê Thị Kim Quyên" },
  { name: "CTV Dương Hồng Liên", type: "CÁ NHÂN", userName: "Lê Thị Kim Quyên" },
  { name: "CÔNG TY TNHH CÔNG NGHỆ ENMASYS", type: "CÔNG TY - ĐĂNG KÝ", userName: "Nguyễn Ngọc Phương Nhi" },
  { name: "CÔNG TY CỔ PHẦN GIẢI PHÁP CÔNG NGHỆ GALLOPTECH", type: "CÔNG TY - ĐĂNG KÝ", userName: "Ngô Thị Hồng Duyên" }
];

export default function PartnerList({ user }: { user: UserProfile }) {
  const [partners, setPartners] = useState<PartnerEntry[]>([]);
  const [directory, setDirectory] = useState<PartnerDirectory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [view, setView] = useState<'contacted' | 'directory' | 'report'>('directory');
  const [isSeeding, setIsSeeding] = useState(false);
  const [isAddingPartner, setIsAddingPartner] = useState(false);
  const [editingPartner, setEditingPartner] = useState<PartnerDirectory | null>(null);
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineUserName, setInlineUserName] = useState<string>('');
  const [inlineStatus, setInlineStatus] = useState<'introduced' | 'not_introduced'>('not_introduced');
  const [inlineContractStatus, setInlineContractStatus] = useState<'signed' | 'not_signed'>('not_signed');
  const [reportFilter, setReportFilter] = useState<'month' | 'quarter' | 'year'>('month');
  const [revenueReports, setRevenueReports] = useState<RevenueReport[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);

  const [newPartner, setNewPartner] = useState({
    name: '',
    type: 'CÔNG TY - ĐĂNG KÝ',
    status: 'not_introduced' as 'introduced' | 'not_introduced',
    contractStatus: 'not_signed' as 'signed' | 'not_signed',
    userName: ''
  });

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const isAdmin = user.role === 'admin';

  useEffect(() => {
    if (view === 'contacted') {
      fetchPartners();
    } else if (view === 'directory') {
      fetchDirectory();
      fetchUsers();
    } else {
      fetchRevenueReports();
    }
  }, [selectedMonth, view, reportFilter]);

  const fetchUsers = async () => {
    try {
      const q = query(collection(db, 'users'), where('status', '==', 'active'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setUsers(data);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const fetchRevenueReports = async () => {
    setLoading(true);
    try {
      const now = new Date(selectedMonth);
      let start, end;

      if (reportFilter === 'month') {
        start = startOfMonth(now);
        end = endOfMonth(now);
      } else if (reportFilter === 'quarter') {
        start = startOfQuarter(now);
        end = endOfQuarter(now);
      } else {
        start = startOfYear(now);
        end = endOfYear(now);
      }

      // Fetch revenue records with date filter
      const revQuery = query(
        collection(db, 'general_revenue'),
        where('date', '>=', format(start, 'yyyy-MM-dd')),
        where('date', '<=', format(end, 'yyyy-MM-dd')),
        orderBy('date', 'desc')
      );
      const revSnapshot = await getDocs(revQuery);
      const filteredRev = revSnapshot.docs.map(doc => doc.data());

      // Group by partner (companyName)
      const reportMap = new Map<string, RevenueReport>();
      filteredRev.forEach(r => {
        const key = r.companyName || 'Unknown';
        if (!reportMap.has(key)) {
          reportMap.set(key, {
            partnerName: key,
            saleName: r.employeeName || 'Unknown',
            revenue: 0,
            orderCount: 0
          });
        }
        const entry = reportMap.get(key)!;
        entry.revenue += r.revenue || 0;
        entry.orderCount += 1;
      });

      setRevenueReports(Array.from(reportMap.values()).sort((a, b) => b.revenue - a.revenue));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'general_revenue');
    } finally {
      setLoading(false);
    }
  };

  const fetchDirectory = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'partners_directory'), orderBy('name', 'asc'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PartnerDirectory));
      setDirectory(data);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'partners_directory');
    } finally {
      setLoading(false);
    }
  };

  const handleInlineSave = async (id: string) => {
    try {
      const { updateDoc, doc } = await import('firebase/firestore');
      const selectedUser = users.find(u => u.displayName === inlineUserName);
      
      await updateDoc(doc(db, 'partners_directory', id), {
        userName: inlineUserName || 'Hệ thống',
        userId: selectedUser?.uid || 'system',
        status: inlineStatus,
        contractStatus: inlineContractStatus
      });
      toast.success('Đã cập nhật thông tin đối tác');
      setInlineEditingId(null);
      fetchDirectory();
    } catch (err) {
      toast.error('Lỗi khi cập nhật thông tin');
    }
  };

  const handleEditPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPartner || !editingPartner.name) return;

    try {
      const { updateDoc, doc } = await import('firebase/firestore');
      const selectedUser = users.find(u => u.displayName === editingPartner.userName);
      
      await updateDoc(doc(db, 'partners_directory', editingPartner.id!), {
        name: editingPartner.name,
        type: editingPartner.type,
        status: editingPartner.status,
        contractStatus: editingPartner.contractStatus || 'not_signed',
        userName: editingPartner.userName,
        userId: selectedUser?.uid || 'system'
      });
      toast.success('Đã cập nhật đối tác');
      setEditingPartner(null);
      fetchDirectory();
    } catch (err) {
      toast.error('Lỗi khi cập nhật đối tác');
    }
  };

  const handleDeletePartner = async (id: string) => {
    try {
      const { deleteDoc, doc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'partners_directory', id));
      toast.success('Đã xóa đối tác');
      setDeleteConfirmId(null);
      fetchDirectory();
    } catch (err) {
      console.error('Delete partner error:', err);
      toast.error('Lỗi khi xóa đối tác: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleAddPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartner.name) return;

    try {
      const selectedUser = users.find(u => u.displayName === newPartner.userName);
      await addDoc(collection(db, 'partners_directory'), {
        ...newPartner,
        userId: selectedUser?.uid || 'system',
        userName: newPartner.userName || 'Hệ thống',
        createdAt: new Date().toISOString()
      });
      toast.success('Đã thêm đối tác mới');
      setIsAddingPartner(false);
      setNewPartner({ name: '', type: 'CÔNG TY - ĐĂNG KÝ', status: 'not_introduced', contractStatus: 'not_signed', userName: '' });
      fetchDirectory();
    } catch (err) {
      toast.error('Lỗi khi thêm đối tác');
    }
  };

  const togglePartnerStatus = async (partner: PartnerDirectory) => {
    try {
      const { updateDoc, doc } = await import('firebase/firestore');
      const newStatus = partner.status === 'introduced' ? 'not_introduced' : 'introduced';
      await updateDoc(doc(db, 'partners_directory', partner.id!), {
        status: newStatus
      });
      toast.success('Đã cập nhật trạng thái');
      fetchDirectory();
    } catch (err) {
      toast.error('Lỗi khi cập nhật trạng thái');
    }
  };

  const fetchPartners = async () => {
    setLoading(true);
    try {
      const start = startOfMonth(new Date(selectedMonth)).toISOString();
      const end = endOfMonth(new Date(selectedMonth)).toISOString();

      let q = query(
        collection(db, 'daily_reports'),
        where('date', '>=', start),
        where('date', '<=', end),
        orderBy('date', 'desc')
      );

      if (!isAdmin) {
        q = query(q, where('userId', '==', user.uid));
      }
      
      const querySnapshot = await getDocs(q);
      const reports = querySnapshot.docs.map(doc => doc.data() as DailyReport);

      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersMap = new Map(usersSnapshot.docs.map(doc => [doc.id, (doc.data() as UserProfile).displayName]));

      const allPartners: PartnerEntry[] = [];
      reports.forEach(report => {
        const userName = usersMap.get(report.userId) || 'Unknown';
        report.daiLyCTV.forEach(partner => {
          allPartners.push({
            userName,
            partnerName: partner.name,
            phone: partner.phone,
            content: partner.content,
            date: report.date
          });
        });
      });

      setPartners(allPartners);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'daily_reports');
    } finally {
      setLoading(false);
    }
  };

  const seedPartners = async () => {
    if (!isAdmin) return;
    setIsSeeding(true);
    try {
      const existingNames = new Set(directory.map(p => p.name));
      
      let addedCount = 0;
      for (const partner of SEED_PARTNERS) {
        if (!existingNames.has(partner.name)) {
          await addDoc(collection(db, 'partners_directory'), {
            ...partner,
            status: 'not_introduced',
            userId: partner.userName === 'Hệ thống' ? 'system' : user.uid,
            userName: partner.userName,
            createdAt: new Date().toISOString()
          });
          addedCount++;
        }
      }

      if (addedCount > 0) {
        toast.success(`Đã thêm ${addedCount} đối tác mới`);
        fetchDirectory();
      } else {
        toast.info('Tất cả đối tác đã tồn tại');
      }
    } catch (err) {
      toast.error('Lỗi khi thêm đối tác');
    } finally {
      setIsSeeding(false);
    }
  };

  const cleanupDuplicates = async () => {
    if (!isAdmin) return;
    setIsSeeding(true);
    try {
      const nameGroups = new Map<string, string[]>();
      directory.forEach(p => {
        if (!nameGroups.has(p.name)) {
          nameGroups.set(p.name, []);
        }
        nameGroups.get(p.name)!.push(p.id!);
      });

      let removedCount = 0;
      for (const [name, ids] of nameGroups.entries()) {
        if (ids.length > 1) {
          // Keep the first one, delete the rest
          const toDelete = ids.slice(1);
          for (const id of toDelete) {
            const { deleteDoc, doc } = await import('firebase/firestore');
            await deleteDoc(doc(db, 'partners_directory', id));
            removedCount++;
          }
        }
      }

      if (removedCount > 0) {
        toast.success(`Đã dọn dẹp ${removedCount} đối tác trùng lặp`);
        fetchDirectory();
      } else {
        toast.info('Không tìm thấy đối tác trùng lặp');
      }
    } catch (err) {
      toast.error('Lỗi khi dọn dẹp đối tác');
    } finally {
      setIsSeeding(false);
    }
  };

  const filteredPartners = partners.filter(p => 
    p.partnerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.phone.includes(searchTerm)
  );

  const uniqueDirectory = Array.from(new Map(directory.map(item => [item.name, item])).values());

  const filteredDirectory = uniqueDirectory.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      {isAddingPartner && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-black text-gray-900 tracking-tight">Thêm đối tác mới</h2>
              <button onClick={() => setIsAddingPartner(false)} className="p-2 hover:bg-white rounded-xl transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleAddPartner} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Tên đối tác</label>
                <input
                  required
                  type="text"
                  value={newPartner.name}
                  onChange={(e) => setNewPartner({ ...newPartner, name: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder="Nhập tên đối tác..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Loại đối tác</label>
                <select
                  value={newPartner.type}
                  onChange={(e) => setNewPartner({ ...newPartner, type: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                >
                  <option value="CÔNG TY - ĐĂNG KÝ">CÔNG TY - ĐĂNG KÝ</option>
                  <option value="ĐẶC BIỆT - ĐĂNG KÝ">ĐẶC BIỆT - ĐĂNG KÝ</option>
                  <option value="CÁ NHÂN">CÁ NHÂN</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Trạng thái</label>
                <select
                  value={newPartner.status}
                  onChange={(e) => setNewPartner({ ...newPartner, status: e.target.value as any })}
                  className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                >
                  <option value="not_introduced">Chưa giới thiệu</option>
                  <option value="introduced">Đã giới thiệu</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Hợp đồng</label>
                <select
                  value={newPartner.contractStatus}
                  onChange={(e) => setNewPartner({ ...newPartner, contractStatus: e.target.value as any })}
                  className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                >
                  <option value="not_signed">Chưa ký</option>
                  <option value="signed">Đã ký</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Nhân viên gán</label>
                <select
                  value={newPartner.userName}
                  onChange={(e) => setNewPartner({ ...newPartner, userName: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                >
                  <option value="">Hệ thống</option>
                  {users.map(u => (
                    <option key={u.uid} value={u.displayName}>{u.displayName}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-sm shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all active:scale-[0.98]"
              >
                Xác nhận thêm
              </button>
            </form>
          </div>
        </div>
      )}

      {editingPartner && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-black text-gray-900 tracking-tight">Chỉnh sửa đối tác</h2>
              <button onClick={() => setEditingPartner(null)} className="p-2 hover:bg-white rounded-xl transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleEditPartner} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Tên đối tác</label>
                <input
                  required
                  type="text"
                  value={editingPartner.name}
                  onChange={(e) => setEditingPartner({ ...editingPartner, name: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Loại đối tác</label>
                <select
                  value={editingPartner.type}
                  onChange={(e) => setEditingPartner({ ...editingPartner, type: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                >
                  <option value="CÔNG TY - ĐĂNG KÝ">CÔNG TY - ĐĂNG KÝ</option>
                  <option value="ĐẶC BIỆT - ĐĂNG KÝ">ĐẶC BIỆT - ĐĂNG KÝ</option>
                  <option value="CÁ NHÂN">CÁ NHÂN</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Nhân viên gán</label>
                <select
                  value={editingPartner.userName || ''}
                  onChange={(e) => setEditingPartner({ ...editingPartner, userName: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                >
                  <option value="">Hệ thống</option>
                  {users.map(u => (
                    <option key={u.uid} value={u.displayName}>{u.displayName}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Trạng thái</label>
                <select
                  value={editingPartner.status}
                  onChange={(e) => setEditingPartner({ ...editingPartner, status: e.target.value as any })}
                  className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                >
                  <option value="not_introduced">Chưa giới thiệu</option>
                  <option value="introduced">Đã giới thiệu</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Hợp đồng</label>
                <select
                  value={editingPartner.contractStatus || 'not_signed'}
                  onChange={(e) => setEditingPartner({ ...editingPartner, contractStatus: e.target.value as any })}
                  className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                >
                  <option value="not_signed">Chưa ký</option>
                  <option value="signed">Đã ký</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-sm shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all active:scale-[0.98]"
              >
                Lưu thay đổi
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Danh sách đối tác</h1>
          <p className="text-gray-400 text-sm font-medium">
            {view === 'contacted' ? 'Danh sách các đối tác đã liên hệ trong tháng' : 
             view === 'directory' ? 'Danh mục các loại đối tác hệ thống' : 
             'Báo cáo doanh thu và hiệu quả đối tác'}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-100 w-full sm:w-auto">
            <button
              onClick={() => setView('directory')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                view === 'directory' ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Danh mục
            </button>
            <button
              onClick={() => setView('contacted')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                view === 'contacted' ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Liên hệ tháng
            </button>
            <button
              onClick={() => setView('report')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                view === 'report' ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Báo cáo
            </button>
          </div>

          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all w-full sm:w-64"
            />
          </div>

          {(view === 'contacted' || view === 'report') && (
            <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-gray-100 w-full sm:w-auto">
              <Calendar className="w-5 h-5 text-primary ml-2" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-sm font-bold text-gray-900 outline-none"
              />
            </div>
          )}

          {view === 'report' && (
            <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-100 w-full sm:w-auto">
              {(['month', 'quarter', 'year'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setReportFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                    reportFilter === f ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {f === 'month' ? 'Tháng' : f === 'quarter' ? 'Quý' : 'Năm'}
                </button>
              ))}
            </div>
          )}

          {view === 'directory' && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => setIsAddingPartner(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex-1 sm:flex-none justify-center"
              >
                <Plus className="w-4 h-4" />
                Thêm đối tác
              </button>
              {isAdmin && (
                <>
                  <button
                    onClick={seedPartners}
                    disabled={isSeeding}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 flex-1 sm:flex-none justify-center"
                  >
                    {isSeeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                    Cập nhật
                  </button>
                  <button
                    onClick={cleanupDuplicates}
                    disabled={isSeeding}
                    title="Dọn dẹp trùng lặp"
                    className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all border border-red-100 disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            {view === 'contacted' ? (
              <>
                <thead className="bg-gray-50/50 text-gray-400 text-[9px] uppercase font-bold tracking-widest">
                  <tr>
                    <th className="px-4 py-2">Nhân viên</th>
                    <th className="px-4 py-2">Đối tác</th>
                    <th className="px-4 py-2">Số điện thoại</th>
                    <th className="px-4 py-2">Nội dung liên hệ</th>
                    <th className="px-4 py-2">Ngày</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center">
                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                      </td>
                    </tr>
                  ) : filteredPartners.length > 0 ? (
                    filteredPartners.map((p, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 bg-primary/5 rounded flex items-center justify-center text-primary font-bold text-[9px]">
                              <UserIcon className="w-2.5 h-2.5" />
                            </div>
                            <span className="font-bold text-[11px] text-gray-900">{p.userName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <span className="font-bold text-[11px] text-gray-700">{p.partnerName}</span>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1.5 text-gray-500">
                            <Phone className="w-2.5 h-2.5" />
                            <span className="text-[11px] font-medium">{p.phone}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1.5 text-gray-500">
                            <MessageSquare className="w-2.5 h-2.5" />
                            <span className="text-[11px] font-medium line-clamp-1">{p.content}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <span className="text-[9px] font-bold text-gray-400">{format(new Date(p.date), 'dd/MM/yyyy')}</span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-gray-400 font-medium text-[11px]">
                        Không tìm thấy dữ liệu đối tác
                      </td>
                    </tr>
                  )}
                </tbody>
              </>
            ) : view === 'directory' ? (
              <>
                <thead className="bg-gray-50/50 text-gray-400 text-[9px] uppercase font-bold tracking-widest">
                  <tr>
                    <th className="px-4 py-2">Tên đối tác</th>
                    <th className="px-4 py-2">Loại đối tác</th>
                    <th className="px-4 py-2">Nhân viên</th>
                    <th className="px-4 py-2">Trạng thái</th>
                    <th className="px-4 py-2">Hợp đồng</th>
                    <th className="px-4 py-2">Ngày tạo</th>
                    <th className="px-4 py-2 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center">
                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                      </td>
                    </tr>
                  ) : filteredDirectory.length > 0 ? (
                    filteredDirectory.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 bg-indigo-50 rounded flex items-center justify-center text-indigo-600 font-bold text-[9px]">
                              <Building2 className="w-2.5 h-2.5" />
                            </div>
                            <span className="font-bold text-[11px] text-gray-900">{p.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest ${
                            p.type.includes('ĐẶC BIỆT') ? 'bg-amber-50 text-amber-600' :
                            p.type.includes('CÔNG TY') ? 'bg-blue-50 text-blue-600' :
                            'bg-gray-50 text-gray-600'
                          }`}>
                            {p.type}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          {inlineEditingId === p.id ? (
                            <select
                              value={inlineUserName}
                              onChange={(e) => setInlineUserName(e.target.value)}
                              className="w-full px-2 py-1 bg-white border border-gray-200 rounded-lg text-[11px] font-medium outline-none focus:ring-2 focus:ring-primary/20"
                            >
                              <option value="Hệ thống">Hệ thống</option>
                              {users.map(u => (
                                <option key={u.uid} value={u.displayName}>{u.displayName}</option>
                              ))}
                            </select>
                          ) : (
                            <div 
                              className="flex items-center gap-1.5 text-gray-500 cursor-pointer hover:text-primary transition-colors group/name"
                              onClick={() => {
                                setInlineEditingId(p.id!);
                                setInlineUserName(p.userName || 'Hệ thống');
                                setInlineStatus(p.status);
                                setInlineContractStatus(p.contractStatus || 'not_signed');
                              }}
                            >
                              <UserCircle className="w-2.5 h-2.5" />
                              <span className="text-[11px] font-medium border-b border-transparent group-hover/name:border-primary/30">
                                {p.userName || 'Hệ thống'}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {inlineEditingId === p.id ? (
                            <select
                              value={inlineStatus}
                              onChange={(e) => setInlineStatus(e.target.value as any)}
                              className="w-full px-2 py-1 bg-white border border-gray-200 rounded-lg text-[11px] font-medium outline-none focus:ring-2 focus:ring-primary/20"
                            >
                              <option value="not_introduced">Chưa giới thiệu</option>
                              <option value="introduced">Đã giới thiệu</option>
                            </select>
                          ) : (
                            <button
                              onClick={() => {
                                setInlineEditingId(p.id!);
                                setInlineUserName(p.userName || 'Hệ thống');
                                setInlineStatus(p.status);
                                setInlineContractStatus(p.contractStatus || 'not_signed');
                              }}
                              className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest transition-all ${
                                p.status === 'introduced' ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'
                              }`}
                            >
                              {p.status === 'introduced' ? <CheckCircle2 className="w-2.5 h-2.5" /> : <HelpCircle className="w-2.5 h-2.5" />}
                              {p.status === 'introduced' ? 'Đã giới thiệu' : 'Chưa giới thiệu'}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {inlineEditingId === p.id ? (
                            <select
                              value={inlineContractStatus}
                              onChange={(e) => setInlineContractStatus(e.target.value as any)}
                              className="w-full px-2 py-1 bg-white border border-gray-200 rounded-lg text-[11px] font-medium outline-none focus:ring-2 focus:ring-primary/20"
                            >
                              <option value="not_signed">Chưa ký</option>
                              <option value="signed">Đã ký</option>
                            </select>
                          ) : (
                            <span 
                              onClick={() => {
                                setInlineEditingId(p.id!);
                                setInlineUserName(p.userName || 'Hệ thống');
                                setInlineStatus(p.status);
                                setInlineContractStatus(p.contractStatus || 'not_signed');
                              }}
                              className={`px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest cursor-pointer ${
                                p.contractStatus === 'signed' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                              }`}
                            >
                              {p.contractStatus === 'signed' ? 'Đã ký' : 'Chưa ký'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <span className="text-[9px] font-bold text-gray-400">{format(new Date(p.createdAt), 'dd/MM/yyyy')}</span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className={`flex items-center justify-end gap-2 transition-opacity opacity-100`}>
                            {inlineEditingId === p.id ? (
                              <>
                                <button
                                  onClick={() => handleInlineSave(p.id!)}
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                  title="Lưu"
                                >
                                  <Save className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setInlineEditingId(null)}
                                  className="p-1.5 text-gray-400 hover:bg-gray-50 rounded-lg transition-colors"
                                  title="Hủy"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => setEditingPartner(p)}
                                  className="p-1.5 text-gray-400 hover:text-primary transition-colors"
                                  title="Chỉnh sửa"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                {isAdmin && (
                                  <button
                                    onClick={() => setDeleteConfirmId(p.id!)}
                                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                                    title="Xóa"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-gray-400 font-medium text-[11px]">
                        Chưa có danh mục đối tác. {isAdmin && 'Vui lòng nhấn "Cập nhật" để khởi tạo.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </>
            ) : (
              <>
                <thead className="bg-gray-50/50 text-gray-400 text-[9px] uppercase font-bold tracking-widest">
                  <tr>
                    <th className="px-4 py-2">Đối tác</th>
                    <th className="px-4 py-2">Nhân viên xử lý</th>
                    <th className="px-4 py-2 text-right">Doanh thu</th>
                    <th className="px-4 py-2 text-center">Số đơn hàng</th>
                    <th className="px-4 py-2 text-right">Hiệu quả</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center">
                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                      </td>
                    </tr>
                  ) : revenueReports.length > 0 ? (
                    revenueReports.map((r, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 bg-emerald-50 rounded flex items-center justify-center text-emerald-600 font-bold text-[9px]">
                              <Building2 className="w-2.5 h-2.5" />
                            </div>
                            <span className="font-bold text-[11px] text-gray-900">{r.partnerName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1.5 text-gray-500">
                            <UserCircle className="w-2.5 h-2.5" />
                            <span className="text-[11px] font-medium">{r.saleName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <span className="font-black text-[11px] text-primary">{r.revenue.toLocaleString()}đ</span>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className="px-1.5 py-0.5 bg-gray-100 rounded-full text-[9px] font-bold text-gray-600">{r.orderCount}</span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <div className="w-12 h-1 bg-gray-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary" 
                                style={{ width: `${Math.min(100, (r.revenue / 10000000) * 100)}%` }}
                              ></div>
                            </div>
                            <span className="text-[9px] font-bold text-gray-400">
                              {((r.revenue / 10000000) * 100).toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-gray-400 font-medium text-[11px]">
                        Không có dữ liệu báo cáo trong khoảng thời gian này
                      </td>
                    </tr>
                  )}
                </tbody>
              </>
            )}
          </table>
        </div>
      </div>

      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-gray-900">Xác nhận xóa</h3>
              <p className="text-sm text-gray-500 font-medium">
                Bạn có chắc chắn muốn xóa đối tác này? Hành động này không thể hoàn tác.
              </p>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-2xl font-bold text-sm hover:bg-gray-200 transition-all"
                >
                  Hủy
                </button>
                <button
                  onClick={() => handleDeletePartner(deleteConfirmId)}
                  className="flex-1 py-3 bg-red-600 text-white rounded-2xl font-bold text-sm shadow-xl shadow-red-200 hover:bg-red-700 transition-all"
                >
                  Xóa ngay
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
