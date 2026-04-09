import React, { useState, useEffect, useRef } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { DailyReport, UserProfile } from '../types';
import { format } from 'date-fns';
import { Save, CheckCircle2, AlertCircle, Calendar as CalendarIcon, DollarSign, Users, MessageSquare, Mail, Zap, Link as LinkIcon, User as UserIcon, FileText, X, Copy, Check, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toBlob } from 'html-to-image';
import rankDong from '../Rank/Đồng.webp';
import rankBac from '../Rank/Bạc.webp';
import rankVang from '../Rank/Vàng.webp';
import rankBachKim from '../Rank/Bạch Kim.webp';
import rankKimCuong from '../Rank/Kim Cương.webp';
import rankCaoThu from '../Rank/Cao thủ.webp';
import rankThachDau from '../Rank/Thách đấu.webp';
import rankMaster from '../Rank/Rank.webp';

interface ReportFormProps {
  user: UserProfile;
}

export default function ReportForm({ user }: ReportFormProps) {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryData, setSummaryData] = useState<DailyReport | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState(user.uid);

  const [formData, setFormData] = useState<Omit<DailyReport, 'id' | 'userId' | 'date' | 'createdAt'>>({
    revenue: 0,
    khachHangTuTim: 0,
    daiLyCTV: [],
    khachHangGioiThieu: 0,
    chat: 0,
    donHangMBI: 0,
    dangTinMXH: [],
    soKHTiemNang: 0,
    khachHangCu: 0,
  });

  const [formattedRevenue, setFormattedRevenue] = useState('0');
  const [capturing, setCapturing] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const [partnerLeadCount, setPartnerLeadCount] = useState(0);
  const [mxhCount, setMxhCount] = useState(0);
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);

  useEffect(() => {
    if (user.role === 'admin') {
      const fetchUsers = async () => {
        try {
          const q = query(collection(db, 'users'), where('status', '==', 'active'));
          const querySnapshot = await getDocs(q);
          const usersList = querySnapshot.docs.map(doc => doc.data() as UserProfile);
          setUsers(usersList.sort((a, b) => a.displayName.localeCompare(b.displayName)));
        } catch (err) {
          console.error('Error fetching users:', err);
        }
      };
      fetchUsers();
    }
  }, [user.role]);

  // Auto-fetch partner lead processing count for the selected date
  useEffect(() => {
    const fetchPartnerLeadCount = async () => {
      try {
        const q = query(collection(db, 'partner_leads'), where('assignedTo', '==', selectedUserId));
        const snap = await getDocs(q);
        let count = 0;
        snap.docs.forEach(d => {
          const lead = d.data();
          const lienHe: { ngay?: string }[] = lead.lienHe ?? [];
          count += lienHe.filter(lh => lh.ngay === date).length;
        });
        setPartnerLeadCount(count);
      } catch (err) {
        console.error('Error fetching partner lead count:', err);
      }
    };
    fetchPartnerLeadCount();
  }, [date, selectedUserId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    if (name === 'revenue') {
      // Remove non-numeric characters for the numeric value
      const numericValue = parseInt(value.replace(/\D/g, '')) || 0;
      // Format the display value
      const formatted = new Intl.NumberFormat('vi-VN').format(numericValue);
      
      setFormattedRevenue(formatted);
      setFormData(prev => ({ ...prev, [name]: numericValue }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: e.target.type === 'number' ? (parseFloat(value) || 0) : value
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    setError(null);

    try {
      const reportData: Omit<DailyReport, 'id'> = {
        ...formData,
        dangTinMXH: Array(mxhCount).fill(''),
        userId: selectedUserId,
        date,
        createdAt: new Date().toISOString(),
      };

      const q = query(
        collection(db, 'daily_reports'),
        where('userId', '==', selectedUserId),
        where('date', '==', date)
      );
      const querySnapshot = await getDocs(q);

      let docId;
      if (!querySnapshot.empty) {
        docId = querySnapshot.docs[0].id;
        await setDoc(doc(db, 'daily_reports', docId), reportData);
        setSummaryData({ id: docId, ...reportData });
      } else {
        const docRef = await addDoc(collection(db, 'daily_reports'), reportData);
        docId = docRef.id;
        setSummaryData({ id: docId, ...reportData });
      }

      // Sync with public_stats
      const reportingUser = user.role === 'admin' ? users.find(u => u.uid === selectedUserId) : user;
      const publicStatId = `${selectedUserId}_${date}`;
      await setDoc(doc(db, 'public_stats', publicStatId), {
        userId: selectedUserId,
        userName: reportingUser?.displayName || 'Unknown',
        userPhotoURL: reportingUser?.photoURL || '',
        date,
        revenue: formData.revenue,
        partnerCount: formData.daiLyCTV.length,
        mxhCount: mxhCount,
        leadsCount: formData.soKHTiemNang,
        updatedAt: new Date().toISOString()
      });

      setSuccess(true);
      setShowSummary(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'daily_reports');
    } finally {
      setLoading(false);
    }
  };

  const handleCapture = async () => {
    if (!summaryRef.current) return;
    
    setCapturing(true);
    try {
      // Small delay to ensure everything is rendered
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const blob = await toBlob(summaryRef.current, {
        cacheBust: true,
        backgroundColor: '#fcfcfc',
        pixelRatio: 2, // Higher quality
      });

      if (blob) {
        await navigator.clipboard.write([
          new ClipboardItem({
            [blob.type]: blob
          })
        ]);
        alert('Đã chụp ảnh báo cáo và lưu vào bộ nhớ tạm! Bạn có thể dán (Paste) vào Zalo/Messenger.');
      }
    } catch (err) {
      console.error('Error capturing screenshot:', err);
      alert('Không thể chụp ảnh báo cáo. Vui lòng thử lại hoặc chụp màn hình thủ công.');
    } finally {
      setCapturing(false);
    }
  };

  const fetchMonthlyRevenue = async (userId: string) => {
    try {
      const now = new Date();
      const start = startOfMonth(now);
      const startStr = format(start, 'yyyy-MM-dd');
      
      // Fetch all reports for the month and filter in memory to avoid index issues
      // This matches the logic used in Dashboard.tsx which is known to be working correctly
      const q = query(
        collection(db, 'daily_reports'),
        where('date', '>=', startStr)
      );
      const snap = await getDocs(q);
      
      let total = 0;
      snap.docs.forEach(d => {
        const data = d.data();
        if (data.userId === userId) {
          total += Number(data.revenue) || 0;
        }
      });
      
      // Log for debugging if needed
      console.log(`Monthly revenue for ${userId}: ${total}`);
      setMonthlyRevenue(total);
    } catch (err) {
      console.error('Error fetching monthly revenue:', err);
    }
  };

  useEffect(() => {
    if (showSummary && summaryData) {
      fetchMonthlyRevenue(summaryData.userId);
    }
  }, [showSummary, summaryData]);

  const getRankInfo = (revenue: number) => {
    if (revenue < 10000000) return { name: 'Đồng', icon: rankDong };
    if (revenue < 15000000) return { name: 'Bạc', icon: rankBac };
    if (revenue < 20000000) return { name: 'Vàng', icon: rankVang };
    if (revenue < 25000000) return { name: 'Bạch Kim', icon: rankBachKim };
    if (revenue < 35000000) return { name: 'Kim Cương', icon: rankKimCuong };
    if (revenue < 50000000) return { name: 'Cao thủ', icon: rankCaoThu };
    if (revenue < 80000000) return { name: 'Thách đấu', icon: rankThachDau };
    return { name: 'Top Rank', icon: rankMaster };
  };

  const numericFields = [
    { name: 'revenue', label: 'Doanh số (VNĐ)', icon: <DollarSign className="w-4 h-4" /> },
    { name: 'khachHangTuTim', label: 'Khách hàng tự tìm', icon: <Users className="w-4 h-4" /> },
    { name: 'khachHangGioiThieu', label: 'Khách hàng giới thiệu', icon: <Users className="w-4 h-4" /> },
    { name: 'chat', label: 'Chat', icon: <MessageSquare className="w-4 h-4" /> },
    { name: 'donHangMBI', label: 'Đơn hàng MBI', icon: <Zap className="w-4 h-4" /> },
    { name: 'soKHTiemNang', label: 'Số KH tiềm năng', icon: <Users className="w-4 h-4" /> },
    { name: 'khachHangCu', label: 'KH Cũ của tôi', icon: <Users className="w-4 h-4" /> },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-50 overflow-hidden">
        <div className="bg-primary p-10 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="relative z-10">
            <h2 className="text-3xl font-black tracking-tight">Báo cáo ngày</h2>
            <p className="text-white/70 text-sm mt-2 font-medium">Cập nhật kết quả công việc hàng ngày của bạn</p>
          </div>
          <div className="relative z-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {user.role === 'admin' && (
              <div className="flex items-center gap-3 bg-white/20 px-4 py-3 rounded-2xl border border-white/20 backdrop-blur-md">
                <UserIcon className="w-5 h-5 text-white" />
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="bg-transparent text-white border-none focus:ring-0 text-sm font-bold outline-none [color-scheme:dark] cursor-pointer"
                >
                  {users.map(u => (
                    <option key={u.uid} value={u.uid} className="text-gray-900">
                      {u.displayName} {u.uid === user.uid ? '(Tôi)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex items-center gap-3 bg-white/20 px-6 py-3 rounded-2xl border border-white/20 backdrop-blur-md">
              <CalendarIcon className="w-5 h-5 text-white" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-transparent text-white border-none focus:ring-0 text-sm font-bold outline-none [color-scheme:dark]"
              />
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-10 space-y-12">
          {/* Numeric Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {numericFields.map((field) => (
              <div key={field.name} className="space-y-3 group">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                  <span className="p-1.5 bg-gray-50 rounded-lg text-gray-400 group-focus-within:text-primary transition-colors">{field.icon}</span>
                  {field.label}
                </label>
                <div className="relative">
                  <input
                    type={field.name === 'revenue' ? 'text' : 'number'}
                    name={field.name}
                    value={field.name === 'revenue' ? formattedRevenue : (formData[field.name as keyof typeof formData] as number)}
                    onChange={handleChange}
                    className="w-full bg-gray-50 border-2 border-transparent rounded-2xl py-4 px-5 text-gray-900 font-bold focus:bg-white focus:border-primary/20 focus:ring-0 transition-all"
                    placeholder="0"
                  />
                  {field.name === 'revenue' && (
                    <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400 uppercase">VNĐ</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 pt-12 border-t border-gray-50">
            {/* Dai Ly / CTV Section - auto-counted from partner_leads */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2 text-gray-900">
                  <Users className="text-primary w-5 h-5" />
                  Đại lý / CTV
                </h3>
                <span className="bg-primary/5 text-primary px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
                  {partnerLeadCount} Lần xử lý
                </span>
              </div>

              <div className="bg-gray-50 p-6 rounded-2xl flex flex-col items-center justify-center gap-3 min-h-[120px]">
                <p className="text-5xl font-black text-primary">{partnerLeadCount}</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">
                  Lần xử lý Lead trong ngày {date ? new Date(date + 'T00:00:00').toLocaleDateString('vi-VN') : ''}
                </p>
                <p className="text-xs text-gray-400 text-center">
                  Tự động tổng hợp từ <span className="font-bold text-primary">Quản lý Lead đối tác</span>
                </p>
              </div>
            </div>

            {/* MXH Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2 text-gray-900">
                  <LinkIcon className="text-primary w-5 h-5" />
                  Đăng tin MXH
                </h3>
                <span className="bg-primary/5 text-primary px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
                  {mxhCount} Bài viết
                </span>
              </div>

              <div className="bg-gray-50 p-6 rounded-2xl space-y-3 group">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Số lượng bài đăng MXH hôm nay</label>
                <input
                  type="number"
                  min={0}
                  value={mxhCount}
                  onChange={(e) => setMxhCount(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-white border-2 border-transparent rounded-2xl py-4 px-5 text-gray-900 font-bold focus:bg-white focus:border-primary/20 focus:ring-0 transition-all text-2xl"
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          <div className="mt-16 flex items-center justify-between border-t border-gray-50 pt-10">
            <div className="flex items-center gap-3">
              {success && (
                <div className="flex items-center gap-2 text-green-600 font-bold animate-in fade-in slide-in-from-left-4">
                  <CheckCircle2 className="w-6 h-6" />
                  Báo cáo đã được lưu!
                </div>
              )}
              {error && (
                <div className="flex items-center gap-2 text-red-600 font-bold">
                  <AlertCircle className="w-6 h-6" />
                  {error}
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-10 py-4 bg-primary text-white rounded-2xl font-bold uppercase tracking-widest text-[10px] flex items-center gap-3 hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Lưu báo cáo
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Report Summary Modal */}
      <AnimatePresence>
        {showSummary && summaryData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="bg-primary p-5 text-white relative overflow-hidden flex-shrink-0">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
                <div className="flex justify-between items-start relative z-10">
                  <div>
                    <h2 className="text-xl font-black tracking-tight">Xác nhận báo cáo</h2>
                    <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest mt-0.5">Vui lòng kiểm tra và chụp màn hình</p>
                  </div>
                  <button 
                    onClick={() => setShowSummary(false)}
                    className="p-1.5 hover:bg-white/20 rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div 
                ref={summaryRef}
                id="report-summary" 
                className="p-5 space-y-5 overflow-y-auto bg-[#fcfcfc]"
              >
                {/* User & Date Header Restructured */}
                <div className="flex flex-wrap gap-3 items-center justify-between border-b border-gray-100 pb-4">
                  {/* Left: Rank Info Area */}
                  <div className="flex items-center min-w-[100px] justify-center">
                    {(() => {
                      const rankInfo = getRankInfo(monthlyRevenue);
                      return (
                        <div className="w-12 h-12 relative bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center justify-center">
                          <motion.img
                            initial={{ scale: 0, rotate: -15 }}
                            animate={{ scale: 1, rotate: 0 }}
                            src={rankInfo.icon}
                            alt={rankInfo.name}
                            className="w-20 h-20 absolute drop-shadow-2xl z-20"
                            title={`Hạng: ${rankInfo.name} (${monthlyRevenue.toLocaleString('vi-VN')} đ)`}
                          />
                        </div>
                      );
                    })()}
                  </div>

                  {/* Center: Title & Current Date Info */}
                  <div className="flex-1 text-center py-2">
                    <p className="text-[20px] font-black uppercase tracking-[0.15em] text-[oklch(51.1%_0.262_276.966)] leading-none">BÁO CÁO NGÀY</p>
                    <div className="flex items-center justify-center gap-1.5 mt-2 bg-white/40 backdrop-blur-sm px-3 py-1 rounded-full border border-gray-100 inline-flex mx-auto">
                      <CalendarIcon className="w-3 h-3 text-primary" />
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                        {format(new Date(summaryData.date), 'dd/MM/yyyy')}
                      </span>
                    </div>
                  </div>

                  {/* Right: Employee Info Area */}
                  <div className="flex items-center gap-3 justify-end min-w-[100px]">
                    <div className="text-right">
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Nhân viên</p>
                      {(() => {
                        const reportUser = users.find(u => u.uid === summaryData.userId) || user;
                        return <p className="text-base font-black text-gray-900 leading-tight">{reportUser.displayName}</p>;
                      })()}
                    </div>
                    {(() => {
                      const reportUser = users.find(u => u.uid === summaryData.userId) || user;
                      return (
                        <div className="w-10 h-10 rounded-xl overflow-hidden border-2 border-primary/10 shadow-sm">
                          {reportUser.photoURL ? (
                            <img
                              src={reportUser.photoURL}
                              alt={reportUser.displayName}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full bg-primary/5 flex items-center justify-center text-primary">
                              <UserIcon className="w-5 h-5" />
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {numericFields.map((field) => (
                    <div key={field.name} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm space-y-0.5">
                      <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                        {field.icon}
                        {field.label}
                      </p>
                      <p className="text-base font-black text-gray-900">
                        {field.name === 'revenue' 
                          ? new Intl.NumberFormat('vi-VN').format(summaryData[field.name as keyof DailyReport] as number)
                          : summaryData[field.name as keyof DailyReport] as number
                        }
                        {field.name === 'revenue' && <span className="text-[9px] ml-0.5 text-gray-400">đ</span>}
                      </p>
                    </div>
                  ))}
                  {/* Partners Count */}
                  <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm space-y-0.5">
                    <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-primary" />
                      Đại lý/CTV
                    </p>
                    <p className="text-base font-black text-gray-900">{partnerLeadCount}</p>
                  </div>
                  {/* MXH Count */}
                  <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm space-y-0.5">
                    <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                      <LinkIcon className="w-3.5 h-3.5 text-primary" />
                      Bài viết MXH
                    </p>
                    <p className="text-base font-black text-gray-900">{mxhCount}</p>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-5 bg-white border-t border-gray-50 flex-shrink-0 flex gap-3">
                <button
                  onClick={handleCapture}
                  disabled={capturing}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold uppercase tracking-widest text-[9px] flex items-center justify-center gap-2 hover:bg-gray-200 transition-all active:scale-95 disabled:opacity-50"
                >
                  {capturing ? (
                    <div className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Camera className="w-3.5 h-3.5" />
                  )}
                  {capturing ? 'Đang chụp...' : 'Chụp ảnh'}
                </button>
                <button
                  onClick={() => setShowSummary(false)}
                  className="flex-[2] py-3 bg-primary text-white rounded-xl font-bold uppercase tracking-widest text-[9px] shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95"
                >
                  Hoàn tất
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

