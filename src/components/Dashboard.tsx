import React, { useState, useEffect, useMemo } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { DailyReport, MonthlyTarget, UserProfile, PartnerLead } from '../types';
import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear } from 'date-fns';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area 
} from 'recharts';
import { 
  TrendingUp, Users, DollarSign, Filter, ChevronDown, ChevronLeft, ChevronRight
} from 'lucide-react';

interface DashboardProps {
  user: UserProfile;
}

type TimeRange = 'day' | 'week' | 'month' | 'year';

function computeDateRange(timeRange: TimeRange, selectedDate: string) {
  const ref = parseISO(selectedDate);
  let start: Date, end: Date;
  if (timeRange === 'day') {
    start = ref; end = ref;
  } else if (timeRange === 'week') {
    start = startOfWeek(ref, { weekStartsOn: 1 });
    end = endOfWeek(ref, { weekStartsOn: 1 });
  } else if (timeRange === 'month') {
    start = startOfMonth(ref);
    end = endOfMonth(ref);
  } else {
    start = startOfYear(ref);
    end = endOfYear(ref);
  }
  return {
    rangeStart: format(start, 'yyyy-MM-dd'),
    rangeEnd: format(end, 'yyyy-MM-dd'),
    targetMonthStart: format(start, 'yyyy-MM'),
    targetMonthEnd: format(end, 'yyyy-MM'),
  };
}

export default function Dashboard({ user }: DashboardProps) {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [targets, setTargets] = useState<MonthlyTarget[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [partnerLeads, setPartnerLeads] = useState<PartnerLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const isAdmin = user.role === 'admin';

  useEffect(() => {
    fetchData();
  }, [timeRange, selectedDate, user.uid]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { rangeStart, rangeEnd, targetMonthStart, targetMonthEnd } = computeDateRange(timeRange, selectedDate);

      // Fetch all sales users (both admin and sales can see all)
      const usersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'sales')));
      setUsers(usersSnap.docs.map(doc => doc.data() as UserProfile));

      // Fetch targets for the relevant months
      const targetsSnap = await getDocs(query(
        collection(db, 'monthly_targets'),
        where('month', '>=', targetMonthStart),
        where('month', '<=', targetMonthEnd)
      ));
      const targetDocs = targetsSnap.docs.map(doc => doc.data() as MonthlyTarget);
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

      // Fetch all reports in date range
      const reportsSnap = await getDocs(query(
        collection(db, 'daily_reports'),
        where('date', '>=', rangeStart),
        where('date', '<=', rangeEnd)
      ));
      setReports(reportsSnap.docs.map(doc => doc.data() as DailyReport));

      // Fetch all partner_leads
      const partnerLeadsSnap = await getDocs(query(collection(db, 'partner_leads')));
      setPartnerLeads(partnerLeadsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as PartnerLead));

    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'dashboard_data');
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const { rangeStart, rangeEnd } = computeDateRange(timeRange, selectedDate);

    const totalRevenue = reports.reduce((sum, r) => sum + r.revenue, 0);
    const totalTarget = targets.reduce((sum, t) => sum + t.revenue, 0);
    const totalLeads = reports.reduce((sum, r) => sum + r.soKHTiemNang, 0);
    const totalMxh = reports.reduce((sum, r) => sum + (r.dangTinMXH?.length || 0), 0);
    const totalPartners = partnerLeads.reduce((sum, lead) => {
      return sum + (lead.lienHe ?? []).filter(lh => lh.ngay && lh.ngay >= rangeStart && lh.ngay <= rangeEnd).length;
    }, 0);
    const totalExistingCustomers = reports.reduce((sum, r) => sum + (r.khachHangCu || 0), 0);
    const revenueProgress = totalTarget > 0 ? (totalRevenue / totalTarget) * 100 : 0;
    const uniqueDates = new Set(reports.map(r => r.date)).size;
    const dailyAvg = uniqueDates > 0 ? totalRevenue / uniqueDates : 0;

    return { totalRevenue, totalTarget, totalLeads, totalMxh, totalPartners, totalExistingCustomers, revenueProgress, dailyAvg };
  }, [reports, targets, partnerLeads, timeRange, selectedDate]);

  const chartData = useMemo(() => {
    const dataByDate: { [key: string]: any } = {};

    reports.forEach(r => {
      if (!dataByDate[r.date]) {
        dataByDate[r.date] = { date: r.date, revenue: 0, leads: 0, partners: 0 };
      }
      dataByDate[r.date].revenue += r.revenue;
      dataByDate[r.date].leads += r.soKHTiemNang;
    });

    // Count lienHe (xử lý đối tác) per date from partner_leads
    partnerLeads.forEach(lead => {
      (lead.lienHe ?? []).forEach(lh => {
        if (!lh.ngay) return;
        if (!dataByDate[lh.ngay]) {
          dataByDate[lh.ngay] = { date: lh.ngay, revenue: 0, leads: 0, partners: 0 };
        }
        dataByDate[lh.ngay].partners += 1;
      });
    });

    return Object.values(dataByDate).sort((a, b) => a.date.localeCompare(b.date));
  }, [reports, partnerLeads]);

  const userPerformance = useMemo(() => {
    return users.map(u => {
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
  }, [users, reports, targets]);

  const userPartnerStats = useMemo(() => {
    const { rangeStart, rangeEnd } = computeDateRange(timeRange, selectedDate);
    return users.map(u => {
      const userTarget = targets.find(t => t.userId === u.uid);
      const actual = partnerLeads
        .filter(lead => lead.assignedTo === u.uid)
        .reduce((sum, lead) => {
          return sum + (lead.lienHe ?? []).filter(lh => lh.ngay && lh.ngay >= rangeStart && lh.ngay <= rangeEnd).length;
        }, 0);
      const target = userTarget?.partners || 0;
      return { name: u.displayName, actual, target };
    });
  }, [users, partnerLeads, targets, timeRange, selectedDate]);

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
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Thống kê phòng kinh doanh</h1>
            <p className="text-gray-400 text-sm font-medium">Theo dõi hiệu suất toàn đội</p>
          </div>
          {/* Range tabs */}
          <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100">
            {(['day', 'week', 'month', 'year'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                  timeRange === range
                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                }`}
              >
                {range === 'day' ? 'Ngày' : range === 'week' ? 'Tuần' : range === 'month' ? 'Tháng' : 'Năm'}
              </button>
            ))}
          </div>
        </div>

        {/* Date picker row */}
        <div className="flex items-center gap-3 bg-white p-3 rounded-2xl shadow-sm border border-gray-100 w-fit">
          <button
            onClick={() => {
              const ref = parseISO(selectedDate);
              const prev = new Date(ref);
              if (timeRange === 'day') prev.setDate(prev.getDate() - 1);
              else if (timeRange === 'week') prev.setDate(prev.getDate() - 7);
              else if (timeRange === 'month') prev.setMonth(prev.getMonth() - 1);
              else prev.setFullYear(prev.getFullYear() - 1);
              setSelectedDate(format(prev, 'yyyy-MM-dd'));
            }}
            className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {timeRange === 'day' && (
            <input type="date" value={selectedDate}
              onChange={e => e.target.value && setSelectedDate(e.target.value)}
              className="border-none outline-none text-sm font-bold text-gray-700 bg-transparent cursor-pointer" />
          )}
          {timeRange === 'week' && (
            <input type="date" value={selectedDate}
              onChange={e => e.target.value && setSelectedDate(e.target.value)}
              className="border-none outline-none text-sm font-bold text-gray-700 bg-transparent cursor-pointer"
              title="Chọn ngày bất kỳ trong tuần cần xem" />
          )}
          {timeRange === 'month' && (
            <input type="month" value={selectedDate.slice(0, 7)}
              onChange={e => e.target.value && setSelectedDate(e.target.value + '-01')}
              className="border-none outline-none text-sm font-bold text-gray-700 bg-transparent cursor-pointer" />
          )}
          {timeRange === 'year' && (
            <input type="number" value={selectedDate.slice(0, 4)} min="2020" max="2035"
              onChange={e => e.target.value && setSelectedDate(e.target.value + '-01-01')}
              className="border-none outline-none text-sm font-bold text-gray-700 bg-transparent w-20 cursor-pointer" />
          )}

          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">
            {(() => {
              const { rangeStart, rangeEnd } = computeDateRange(timeRange, selectedDate);
              if (timeRange === 'day') return format(parseISO(rangeStart), 'dd/MM/yyyy');
              if (timeRange === 'week') return `${format(parseISO(rangeStart), 'dd/MM')} – ${format(parseISO(rangeEnd), 'dd/MM/yyyy')}`;
              if (timeRange === 'month') return format(parseISO(rangeStart), 'MM/yyyy');
              return rangeStart.slice(0, 4);
            })()}
          </span>

          <button
            onClick={() => {
              const ref = parseISO(selectedDate);
              const next = new Date(ref);
              if (timeRange === 'day') next.setDate(next.getDate() + 1);
              else if (timeRange === 'week') next.setDate(next.getDate() + 7);
              else if (timeRange === 'month') next.setMonth(next.getMonth() + 1);
              else next.setFullYear(next.getFullYear() + 1);
              setSelectedDate(format(next, 'yyyy-MM-dd'));
            }}
            className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
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
                {timeRange === 'day' ? 'Ngày' : timeRange === 'week' ? 'Tuần' : timeRange === 'month' ? 'Tháng' : 'Năm'}
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
                    tickFormatter={(val) => format(parseISO(val), timeRange === 'year' ? 'MM/yy' : 'dd/MM')}
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

        </div>
      </div>

      {/* Two member comparison charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Chart 1: Revenue vs Target per member */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-50">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Doanh số vs Mục tiêu</h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={userPerformance} barGap={4} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(v) => (v / 1000000).toFixed(0) + 'tr'} />
                <Tooltip
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any, name: string) => [value.toLocaleString('vi-VN') + ' đ', name === 'revenue' ? 'Doanh số' : 'Mục tiêu']}
                />
                <Legend formatter={(v) => v === 'revenue' ? 'Doanh số' : 'Mục tiêu'} />
                <Bar dataKey="target" fill="#e0e7ff" radius={[6, 6, 0, 0]} name="target" />
                <Bar dataKey="revenue" fill="#6366f1" radius={[6, 6, 0, 0]} name="revenue" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Partner lead processing vs Target per member */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-50">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Đại lý / CTV — Xử lý Lead vs Mục tiêu</h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={userPartnerStats} barGap={4} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any, name: string) => [value, name === 'actual' ? 'Đã xử lý' : 'Mục tiêu']}
                />
                <Legend formatter={(v) => v === 'actual' ? 'Đã xử lý' : 'Mục tiêu'} />
                <Bar dataKey="target" fill="#fde68a" radius={[6, 6, 0, 0]} name="target" />
                <Bar dataKey="actual" fill="#f59e0b" radius={[6, 6, 0, 0]} name="actual" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Performance Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-50 overflow-hidden">
        <div className="p-8 border-b border-gray-50 flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-900">Hiệu suất nhân viên</h3>
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
