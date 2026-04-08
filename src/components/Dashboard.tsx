import React, { useState, useEffect, useMemo } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { DailyReport, MonthlyTarget, UserProfile, PartnerLead } from '../types';
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from 'date-fns';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area 
} from 'recharts';
import { 
  TrendingUp, Users, DollarSign, Target, AlertTriangle, CheckCircle2, 
  Calendar, ArrowUpRight, ArrowDownRight, LayoutDashboard, Filter,
  ChevronDown
} from 'lucide-react';

interface DashboardProps {
  user: UserProfile;
}

export default function Dashboard({ user }: DashboardProps) {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [targets, setTargets] = useState<MonthlyTarget[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [partnerLeads, setPartnerLeads] = useState<PartnerLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'month' | 'quarter' | 'year'>('month');

  const isAdmin = user.role === 'admin';
  const currentMonth = format(new Date(), 'yyyy-MM');

  useEffect(() => {
    fetchData();
  }, [timeRange, user.uid, user.role]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch users (Admin only)
      if (isAdmin) {
        const usersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'sales')));
        const fetchedUsers = usersSnap.docs.map(doc => doc.data() as UserProfile);
        setUsers(fetchedUsers);
      } else {
        setUsers([user]);
      }

      // Fetch targets based on time range
      let targetStart, targetEnd;
      if (timeRange === 'month') {
        targetStart = currentMonth;
        targetEnd = currentMonth;
      } else if (timeRange === 'quarter') {
        const qStart = startOfQuarter(new Date());
        const qEnd = endOfQuarter(new Date());
        targetStart = format(qStart, 'yyyy-MM');
        targetEnd = format(qEnd, 'yyyy-MM');
      } else {
        targetStart = format(startOfYear(new Date()), 'yyyy-MM');
        targetEnd = format(endOfYear(new Date()), 'yyyy-MM');
      }

      let targetQuery = query(
        collection(db, 'monthly_targets'), 
        where('month', '>=', targetStart),
        where('month', '<=', targetEnd)
      );

      if (!isAdmin) {
        targetQuery = query(targetQuery, where('userId', '==', user.uid));
      }

      // For sales, we only show their own targets in the main stats
      // But for the leaderboard, we might need others' targets? 
      // Actually, leaderboard is usually just raw performance.
      const targetsSnap = await getDocs(targetQuery);
      const targetDocs = targetsSnap.docs.map(doc => doc.data() as MonthlyTarget);
      
      // Aggregate targets by user
      const aggregatedTargets: { [userId: string]: MonthlyTarget } = {};
      targetDocs.forEach(t => {
        if (!aggregatedTargets[t.userId]) {
          aggregatedTargets[t.userId] = { ...t, revenue: 0, partners: 0, mxh: 0, zalo: 0 };
        }
        aggregatedTargets[t.userId].revenue += t.revenue;
        aggregatedTargets[t.userId].partners += t.partners;
        aggregatedTargets[t.userId].mxh += t.mxh;
        aggregatedTargets[t.userId].zalo += t.zalo;
      });

      setTargets(Object.values(aggregatedTargets));

      // Fetch reports (Personal for sales, All for admin)
      let start, end;
      if (timeRange === 'month') {
        start = startOfMonth(new Date());
        end = endOfMonth(new Date());
      } else if (timeRange === 'quarter') {
        start = startOfQuarter(new Date());
        end = endOfQuarter(new Date());
      } else {
        start = startOfYear(new Date());
        end = endOfYear(new Date());
      }

      let reportQuery = query(
        collection(db, 'daily_reports'),
        where('date', '>=', format(start, 'yyyy-MM-dd')),
        where('date', '<=', format(end, 'yyyy-MM-dd'))
      );

      if (!isAdmin) {
        reportQuery = query(reportQuery, where('userId', '==', user.uid));
      }

      const reportsSnap = await getDocs(reportQuery);
      setReports(reportsSnap.docs.map(doc => doc.data() as DailyReport));

      // Fetch partner_leads to count processing events (lienHe)
      let partnerLeadQuery = query(collection(db, 'partner_leads'));
      if (!isAdmin) {
        partnerLeadQuery = query(collection(db, 'partner_leads'), where('assignedTo', '==', user.uid));
      }
      const partnerLeadsSnap = await getDocs(partnerLeadQuery);
      setPartnerLeads(partnerLeadsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as PartnerLead));

    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'dashboard_data');
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    // Determine date range bounds for filtering lienHe entries
    let rangeStart: string, rangeEnd: string;
    if (timeRange === 'month') {
      rangeStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      rangeEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');
    } else if (timeRange === 'quarter') {
      rangeStart = format(startOfQuarter(new Date()), 'yyyy-MM-dd');
      rangeEnd = format(endOfQuarter(new Date()), 'yyyy-MM-dd');
    } else {
      rangeStart = format(startOfYear(new Date()), 'yyyy-MM-dd');
      rangeEnd = format(endOfYear(new Date()), 'yyyy-MM-dd');
    }

    const totalRevenue = reports.reduce((sum, r) => sum + r.revenue, 0);
    const userTarget = targets.filter(t => isAdmin ? true : t.userId === user.uid);
    const totalTarget = userTarget.reduce((sum, t) => sum + t.revenue, 0);
    const totalLeads = reports.reduce((sum, r) => sum + r.soKHTiemNang, 0);
    const totalMxh = reports.reduce((sum, r) => sum + (r.dangTinMXH?.length || 0), 0);
    // Count total lienHe (processing events) within the time range
    const totalPartners = partnerLeads.reduce((sum, lead) => {
      const count = (lead.lienHe ?? []).filter(lh => {
        if (!lh.ngay) return false;
        return lh.ngay >= rangeStart && lh.ngay <= rangeEnd;
      }).length;
      return sum + count;
    }, 0);
    const totalExistingCustomers = reports.reduce((sum, r) => sum + (r.khachHangCu || 0), 0);
    
    const revenueProgress = totalTarget > 0 ? (totalRevenue / totalTarget) * 100 : 0;
    
    const uniqueDates = new Set(reports.map(r => r.date)).size;
    const dailyAvg = uniqueDates > 0 ? totalRevenue / uniqueDates : 0;

    return { totalRevenue, totalTarget, totalLeads, totalMxh, totalPartners, totalExistingCustomers, revenueProgress, dailyAvg };
  }, [reports, targets, partnerLeads, timeRange, isAdmin, user.uid]);

  const chartData = useMemo(() => {
    const dataByDate: { [key: string]: any } = {};
    
    reports.forEach(r => {
      if (!dataByDate[r.date]) {
        dataByDate[r.date] = { date: r.date, revenue: 0, leads: 0, partners: 0 };
      }
      dataByDate[r.date].revenue += r.revenue;
      dataByDate[r.date].leads += r.soKHTiemNang;
      dataByDate[r.date].partners += (r.daiLyCTV?.length || 0);
    });

    return Object.values(dataByDate).sort((a, b) => a.date.localeCompare(b.date));
  }, [reports]);

  const userPerformance = useMemo(() => {
    const displayUsers = isAdmin ? users : users.filter(u => u.uid === user.uid);
    return displayUsers.map(u => {
      const userReports = reports.filter(r => r.userId === u.uid);
      const userTarget = targets.find(t => t.userId === u.uid);
      const revenue = userReports.reduce((sum, r) => sum + r.revenue, 0);
      const target = userTarget?.revenue || 0;
      const progress = target > 0 ? (revenue / target) * 100 : 0;
      
      return {
        uid: u.uid,
        name: u.displayName,
        revenue,
        target,
        progress,
        status: progress >= 100 ? 'success' : progress >= 80 ? 'warning' : 'danger'
      };
    });
  }, [users, reports, targets, isAdmin, user.uid]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Header with Time Range Selector */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">
              {isAdmin ? 'Thống kê & Cảnh báo' : 'Thống kê cá nhân'}
            </h1>
            <p className="text-gray-400 text-sm font-medium">
              {isAdmin 
                ? 'Theo dõi hiệu suất và cảnh báo mục tiêu phòng kinh doanh' 
                : 'Theo dõi hiệu suất và tiến độ mục tiêu cá nhân'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100">
          {(['month', 'quarter', 'year'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                timeRange === range 
                  ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
              }`}
            >
              {range === 'month' ? 'Tháng' : range === 'quarter' ? 'Quý' : 'Năm'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <StatCard 
          title="Tổng Doanh Số" 
          value={`${stats.totalRevenue.toLocaleString('vi-VN')}`} 
          unit="VNĐ"
          icon={<DollarSign className="w-5 h-5" />}
          color="indigo"
        />
        <StatCard 
          title="Bài đăng MXH" 
          value={stats.totalMxh.toString()} 
          unit="Bài viết"
          icon={<TrendingUp className="w-5 h-5" />}
          color="blue"
        />
        <StatCard 
          title="KH Tiềm Năng" 
          value={stats.totalLeads.toString()} 
          unit="Khách hàng"
          icon={<Users className="w-5 h-5" />}
          color="emerald"
        />
        <StatCard
          title="Đại lý / CTV"
          value={stats.totalPartners.toString()}
          unit="Lần xử lý"
          icon={<Users className="w-5 h-5" />}
          color="amber"
        />
        <StatCard 
          title="KH Cũ của tôi" 
          value={stats.totalExistingCustomers.toString()} 
          unit="Khách hàng"
          icon={<Users className="w-5 h-5" />}
          color="indigo"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Revenue Trend */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-50">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-lg font-bold text-gray-900">Xu hướng doanh số & Đối tác</h3>
              <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                <Filter className="w-4 h-4" />
                {timeRange === 'month' ? 'Tháng này' : timeRange === 'quarter' ? 'Quý này' : 'Năm nay'}
              </div>
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 10, fill: '#9ca3af'}} 
                    tickFormatter={(val) => format(new Date(val), timeRange === 'year' ? 'MM/yy' : 'dd/MM')}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 10, fill: '#9ca3af'}} 
                    tickFormatter={(val) => val.toLocaleString('vi-VN')}
                  />
                  <Tooltip 
                    contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                    formatter={(value: any) => [value.toLocaleString('vi-VN'), '']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                  <Line type="monotone" dataKey="partners" stroke="#14b8a6" strokeWidth={2} dot={{ r: 4, fill: '#14b8a6' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Sidebar Section */}
        <div className="space-y-8">
          {/* Progress Circle */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-50 flex flex-col items-center justify-center text-center">
            <h3 className="text-lg font-bold text-gray-900 mb-8 w-full text-left">Tiến độ mục tiêu</h3>
            <div className="relative w-48 h-48 mb-8">
              <svg className="w-full h-full" viewBox="0 0 100 100">
                <circle className="text-gray-100 stroke-current" strokeWidth="8" fill="transparent" r="40" cx="50" cy="50" />
                <circle 
                  className="text-primary stroke-current transition-all duration-1000 ease-out" 
                  strokeWidth="8" 
                  strokeLinecap="round" 
                  fill="transparent" 
                  r="40" cx="50" cy="50" 
                  strokeDasharray={`${Math.min(stats.revenueProgress, 100) * 2.51}, 251.2`}
                  transform="rotate(-90 50 50)"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-black text-gray-900">{Math.round(stats.revenueProgress)}%</span>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Hoàn thành</span>
              </div>
            </div>
            <div className="space-y-3 w-full">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-gray-400 uppercase tracking-widest">Còn lại</span>
                <span className="text-gray-900">{(Math.max(0, stats.totalTarget - stats.totalRevenue)).toLocaleString('vi-VN')} VNĐ</span>
              </div>
              <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-primary h-full transition-all duration-1000" style={{ width: `${Math.min(stats.revenueProgress, 100)}%` }} />
              </div>
            </div>
          </div>

          {/* Performance Status Summary */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-50 space-y-6">
            <h3 className="text-lg font-bold text-gray-900">Trạng thái mục tiêu</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-green-50 rounded-2xl">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-green-600 shadow-sm">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-lg font-black text-gray-900">{userPerformance.filter(u => u.status === 'success').length}</p>
                  <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest">Hoàn thành (100%+)</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-amber-50 rounded-2xl">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-amber-600 shadow-sm">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-lg font-black text-gray-900">{userPerformance.filter(u => u.status === 'warning').length}</p>
                  <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Cần cố gắng (80-99%)</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-red-50 rounded-2xl">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-red-600 shadow-sm">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-lg font-black text-gray-900">{userPerformance.filter(u => u.status === 'danger').length}</p>
                  <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest">Cảnh báo (&lt;80%)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-50 overflow-hidden">
        <div className="p-8 border-b border-gray-50 flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-900">
            {isAdmin ? 'Hiệu suất nhân viên' : 'Hiệu suất cá nhân'}
          </h3>
          <ChevronDown className="w-5 h-5 text-gray-400" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 text-gray-400 text-[10px] uppercase font-bold tracking-widest">
              <tr>
                <th className="px-8 py-4">Nhân viên</th>
                <th className="px-8 py-4">Doanh số</th>
                <th className="px-8 py-4">Mục tiêu</th>
                <th className="px-8 py-4">Tiến độ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {userPerformance.map((u) => (
                <tr key={u.uid} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-primary font-bold text-xs">
                        {u.name.charAt(0)}
                      </div>
                      <span className="font-bold text-sm text-gray-900">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 font-bold text-sm text-gray-900">{u.revenue.toLocaleString('vi-VN')}</td>
                  <td className="px-8 py-5 text-sm text-gray-500">{u.target.toLocaleString('vi-VN')}</td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-gray-100 h-1.5 rounded-full overflow-hidden min-w-[80px]">
                        <div 
                          className={`h-full rounded-full transition-all duration-1000 ${
                            u.status === 'success' ? 'bg-green-500' : 
                            u.status === 'warning' ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(u.progress, 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-gray-900">{Math.round(u.progress)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, unit, icon, color }: any) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-50 flex items-center gap-5 hover:shadow-md transition-all group">
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 ${
        color === 'indigo' ? 'bg-indigo-50 text-indigo-600' :
        color === 'blue' ? 'bg-blue-50 text-blue-600' :
        color === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
        'bg-amber-50 text-amber-600'
      }`}>
        {icon}
      </div>
      <div>
        <div className="flex items-baseline gap-1">
          <p className="text-xl font-black text-gray-900">{value}</p>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{unit}</p>
        </div>
        <h4 className="text-xs font-bold text-gray-400 mt-1">{title}</h4>
      </div>
    </div>
  );
}
