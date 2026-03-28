import React, { useState, useEffect, useMemo } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, getDocs, writeBatch, doc, query, orderBy, where } from 'firebase/firestore';
import { GeneralRevenueRecord, UserProfile } from '../types';
import { format, parse, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from 'date-fns';
import * as XLSX from 'xlsx';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { 
  Upload, FileSpreadsheet, TrendingUp, Users, DollarSign, PieChart as PieChartIcon, 
  Calendar, Filter, Download, Trash2, Loader2
} from 'lucide-react';

import { toast } from 'sonner';

interface GeneralDashboardProps {
  user: UserProfile;
}

const COLORS = ['#6366f1', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export default function GeneralDashboard({ user }: GeneralDashboardProps) {
  const [records, setRecords] = useState<GeneralRevenueRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [timeRange, setTimeRange] = useState<'month' | 'year' | 'all'>('all');
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [monthlyTargetsMap, setMonthlyTargetsMap] = useState<{ [month: string]: number }>({});
  const chartYear = new Date().getFullYear();

  const isAdmin = user.role === 'admin';

  const allAvailableSources = useMemo(() => {
    return Array.from(new Set(records.map(r => r.source))).sort();
  }, [records]);

  // Initialize selectedSources when records load for the first time
  useEffect(() => {
    if (records.length > 0 && selectedSources.length === 0) {
      setSelectedSources(Array.from(new Set(records.map(r => r.source))));
    }
  }, [records]);

  useEffect(() => {
    fetchRecords();
    fetchMonthlyTargets();
  }, []);

  const fetchMonthlyTargets = async () => {
    try {
      const snap = await getDocs(collection(db, 'monthly_targets'));
      const map: { [month: string]: number } = {};
      snap.docs.forEach(d => {
        const data = d.data();
        if (data.month && data.revenue) {
          map[data.month] = (map[data.month] || 0) + data.revenue;
        }
      });
      setMonthlyTargetsMap(map);
    } catch (err) {
      console.error('Failed to fetch monthly targets', err);
    }
  };

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'general_revenue'), orderBy('date', 'asc'));
      const snap = await getDocs(q);
      const fetchedRecords = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as GeneralRevenueRecord));
      console.log('Fetched records:', fetchedRecords.length);
      setRecords(fetchedRecords);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'general_revenue');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        console.log('Raw Excel data:', data.slice(0, 2));

        if (data.length === 0) {
          toast.error('File Excel không có dữ liệu');
          setImporting(false);
          return;
        }

        const batch = writeBatch(db);
        const newRecords: GeneralRevenueRecord[] = [];

        // Helper to find column by flexible name
        const normalize = (str: string) => 
          str.toLowerCase()
             .trim()
             .normalize('NFD')
             .replace(/[\u0300-\u036f]/g, '')
             .replace(/[đĐ]/g, 'd');

        const findCol = (row: any, keywords: string[]) => {
          const keys = Object.keys(row);
          const normalizedKeywords = keywords.map(normalize);
          
          for (const key of keys) {
            const normalizedKey = normalize(key);
            if (normalizedKeywords.some(kw => normalizedKey.includes(kw) || kw.includes(normalizedKey))) {
              return row[key];
            }
          }
          return null;
        };

        const parseRevenue = (val: any): number => {
          if (typeof val === 'number') return val;
          if (typeof val === 'string') {
            // Remove currency symbols and spaces
            let s = val.replace(/[^\d.,-]/g, '').trim();
            if (!s) return 0;
            
            // Handle common formats: 1.000.000,00 (VN) or 1,000,000.00 (US)
            const hasComma = s.includes(',');
            const hasDot = s.includes('.');
            
            if (hasComma && hasDot) {
              // Both present - usually the one at the end is the decimal separator
              if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
                // VN format: 1.000.000,00
                s = s.replace(/\./g, '').replace(',', '.');
              } else {
                // US format: 1,000,000.00
                s = s.replace(/,/g, '');
              }
            } else if (hasComma) {
              // Only comma - could be 1,000,000 (US thousand) or 1000,50 (VN decimal)
              // If multiple commas, they are thousand separators
              if ((s.match(/,/g) || []).length > 1) {
                s = s.replace(/,/g, '');
              } else {
                // Single comma - check position
                const parts = s.split(',');
                if (parts[1].length <= 2) {
                  s = s.replace(',', '.'); // Likely decimal
                } else {
                  s = s.replace(',', ''); // Likely thousand
                }
              }
            } else if (hasDot) {
              // Only dot - could be 1.000.000 (VN thousand) or 1000.50 (US decimal)
              if ((s.match(/\./g) || []).length > 1) {
                s = s.replace(/\./g, '');
              }
            }
            
            return Number(s) || 0;
          }
          return Number(val) || 0;
        };

        data.forEach((row: any, index) => {
          // Map Excel columns to our interface
          const source = findCol(row, ['nguon', 'source', 'kenh']) || '';
          const orderId = findCol(row, ['don hang', 'order', 'ma don', 'id', 'bill']) || '';
          const dateVal = findCol(row, ['ngay', 'date', 'thoi gian', 'time']) || '';
          const companyName = findCol(row, ['cong ty', 'khach hang', 'company', 'customer', 'doi tac']) || '';
          const employeeName = findCol(row, ['nhan vien', 'employee', 'sales', 'nguoi ban', 'user']) || '';
          const revenue = parseRevenue(findCol(row, ['doanh thu', 'doanh so', 'revenue', 'so tien', 'thanh tien', 'gia tri', 'money']));

          if (!source || !orderId || !dateVal || !employeeName) {
            if (index === 0) {
              console.log('Available columns in Excel:', Object.keys(row));
              console.log('First row mapping attempt:', { source, orderId, dateVal, employeeName, revenue });
            }
            return;
          }

          // Parse date
          let formattedDate = '';
          try {
            if (dateVal instanceof Date) {
              formattedDate = format(dateVal, 'yyyy-MM-dd');
            } else if (typeof dateVal === 'string') {
              // Try common formats
              let parsedDate: Date | null = null;
              const formats = ['dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd'];
              for (const f of formats) {
                try {
                  const d = parse(dateVal, f, new Date());
                  if (!isNaN(d.getTime())) {
                    parsedDate = d;
                    break;
                  }
                } catch (e) {}
              }
              if (parsedDate) {
                formattedDate = format(parsedDate, 'yyyy-MM-dd');
              } else {
                console.error('Could not parse date string:', dateVal);
                return;
              }
            } else if (typeof dateVal === 'number') {
              // Fallback if it's still a number (sometimes happens if cellDates didn't catch it)
              const date = new Date((dateVal - (25567 + 1)) * 86400 * 1000);
              formattedDate = format(date, 'yyyy-MM-dd');
            } else {
              console.error('Unknown date format:', typeof dateVal, dateVal);
              return;
            }
          } catch (e) {
            console.error('Date parsing error', dateVal);
            return;
          }

          const record: GeneralRevenueRecord = {
            source,
            orderId,
            date: formattedDate,
            companyName,
            employeeName,
            revenue,
            createdAt: new Date().toISOString()
          };

          const newDocRef = doc(collection(db, 'general_revenue'));
          const recordWithId: GeneralRevenueRecord = { ...record, id: newDocRef.id };
          batch.set(newDocRef, record);
          newRecords.push(recordWithId);
        });

        if (newRecords.length === 0) {
          toast.error('Không tìm thấy bản ghi hợp lệ trong file Excel. Vui lòng kiểm tra tiêu đề cột.');
          setImporting(false);
          return;
        }

        await batch.commit();
        setRecords(prev => [...prev, ...newRecords].sort((a, b) => a.date.localeCompare(b.date)));
        toast.success(`Đã nhập thành công ${newRecords.length} bản ghi!`);
      } catch (err) {
        console.error('Import error', err);
        toast.error('Lỗi khi nhập file Excel. Vui lòng kiểm tra định dạng file.');
      } finally {
        setImporting(false);
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const filteredRecords = useMemo(() => {
    if (timeRange === 'all') return records;
    const now = new Date();
    let start: Date;
    if (timeRange === 'month') {
      start = startOfMonth(now);
    } else {
      start = startOfYear(now);
    }
    const startStr = format(start, 'yyyy-MM-dd');
    return records.filter(r => r.date >= startStr);
  }, [records, timeRange]);

  const employeeRevenueData = useMemo(() => {
    const map: { [key: string]: any } = {};
    const sources = new Set<string>();
    
    filteredRecords.forEach(r => {
      if (!selectedSources.includes(r.source)) return;
      
      if (!map[r.employeeName]) {
        map[r.employeeName] = { name: r.employeeName, total: 0 };
      }
      map[r.employeeName][r.source] = (map[r.employeeName][r.source] || 0) + r.revenue;
      map[r.employeeName].total += r.revenue;
      sources.add(r.source);
    });

    const data = Object.values(map).sort((a: any, b: any) => b.total - a.total);

    return {
      data,
      allSources: Array.from(sources)
    };
  }, [filteredRecords, selectedSources]);

  const monthlyData = useMemo(() => {
    const actualMap: { [key: string]: number } = {};
    records.forEach(r => {
      const month = r.date.substring(0, 7);
      actualMap[month] = (actualMap[month] || 0) + r.revenue;
    });
    return Array.from({ length: 12 }, (_, i) => {
      const m = String(i + 1).padStart(2, '0');
      const key = `${chartYear}-${m}`;
      return {
        month: `T${i + 1}`,
        thucHien: actualMap[key] || 0,
        mucTieu: monthlyTargetsMap[key] || 0,
      };
    });
  }, [records, monthlyTargetsMap, chartYear]);

  const sourceData = useMemo(() => {
    const map: { [key: string]: number } = {};
    filteredRecords.forEach(r => {
      map[r.source] = (map[r.source] || 0) + r.revenue;
    });
    return Object.keys(map).map(name => ({
      name,
      value: map[name]
    }));
  }, [filteredRecords]);

  const performanceData = useMemo(() => {
    const employees = Array.from(new Set(filteredRecords.map(r => r.employeeName)));
    const sources = Array.from(new Set(filteredRecords.map(r => r.source)))
      .filter(s => selectedSources.includes(s));
    
    if (employees.length === 0 || sources.length === 0) return { chartData: [], employees: [] };

    // 1. Pre-aggregate revenue by [employee][source]
    const agg: Record<string, Record<string, number>> = {};
    filteredRecords.forEach(r => {
      if (!agg[r.employeeName]) agg[r.employeeName] = {};
      agg[r.employeeName][r.source] = (agg[r.employeeName][r.source] || 0) + r.revenue;
    });

    // 2. Build chart data (one row per source)
    const chartData = sources.map(source => {
      const row: any = { subject: source };
      employees.forEach(emp => {
        const rev = agg[emp]?.[source] || 0;
        // Use actual revenue instead of normalized score
        row[emp] = rev;
      });
      return row;
    });

    return { chartData, employees };
  }, [filteredRecords, selectedSources]);

  const stats = useMemo(() => {
    const totalRevenue = filteredRecords.reduce((sum, r) => sum + r.revenue, 0);
    const totalOrders = filteredRecords.length;
    const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const uniqueEmployees = new Set(filteredRecords.map(r => r.employeeName)).size;

    return { totalRevenue, totalOrders, avgOrder, uniqueEmployees };
  }, [filteredRecords]);

  const [showConfirmClear, setShowConfirmClear] = useState(false);

  const clearAllData = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'general_revenue'));
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      setRecords([]);
      toast.success('Đã xóa toàn bộ dữ liệu thành công');
      setShowConfirmClear(false);
    } catch (err) {
      toast.error('Lỗi khi xóa dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Dashboard Tổng</h1>
          <p className="text-gray-400 text-sm font-medium">Phân tích doanh thu tổng hợp từ dữ liệu Excel</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100">
            {(['month', 'year', 'all'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                  timeRange === range 
                    ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                }`}
              >
                {range === 'month' ? 'Tháng này' : range === 'year' ? 'Năm nay' : 'Tất cả'}
              </button>
            ))}
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <div className="relative group">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={importing}
                />
                <button className={`flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all ${importing ? 'opacity-50' : ''}`}>
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {importing ? 'Đang nhập...' : 'Nhập Excel'}
                </button>
                <div className="absolute top-full left-0 mt-2 w-64 p-3 bg-white rounded-xl shadow-xl border border-gray-100 text-[10px] text-gray-500 hidden group-hover:block z-50">
                  <p className="font-bold mb-1 text-gray-700">Yêu cầu các cột:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Nguồn (Source)</li>
                    <li>Đơn hàng (Order ID)</li>
                    <li>Ngày (Date)</li>
                    <li>Nhân viên (Employee)</li>
                    <li>Doanh số (Revenue)</li>
                    <li>Tên công ty (Tùy chọn)</li>
                  </ul>
                </div>
              </div>
              
              {showConfirmClear ? (
                <div className="flex items-center gap-2 animate-in slide-in-from-right-4">
                  <button 
                    onClick={clearAllData}
                    className="px-4 py-2 bg-red-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-red-700"
                  >
                    Xác nhận xóa
                  </button>
                  <button 
                    onClick={() => setShowConfirmClear(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-gray-200"
                  >
                    Hủy
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setShowConfirmClear(true)}
                  className="p-2.5 bg-white text-red-500 rounded-xl border border-red-100 hover:bg-red-50 transition-all shadow-sm"
                  title="Xóa tất cả dữ liệu"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-50 flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xl font-black text-gray-900">{stats.totalRevenue.toLocaleString('vi-VN')} VNĐ</p>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Tổng doanh thu</h4>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-50 flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xl font-black text-gray-900">{stats.totalOrders.toLocaleString()}</p>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Tổng đơn hàng</h4>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-50 flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xl font-black text-gray-900">{stats.avgOrder.toLocaleString('vi-VN')} VNĐ</p>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Giá trị TB/Đơn</h4>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-50 flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xl font-black text-gray-900">{stats.uniqueEmployees}</p>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Nhân viên</h4>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Monthly Revenue Chart */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-50 lg:col-span-2">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Doanh số theo tháng {chartYear} — Mục tiêu và Thực hiện</h3>
              <p className="text-xs text-gray-400 font-medium mt-0.5">Tổng mục tiêu toàn đội vs Doanh số thực hiện — 12 tháng</p>
            </div>
            <TrendingUp className="w-5 h-5 text-gray-400" />
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} barCategoryGap="20%" barGap={4}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: 600 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  tickFormatter={(val) => val >= 1000000 ? (val / 1000000).toFixed(0) + 'M' : val.toLocaleString()}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any, name: string) => [
                    value.toLocaleString('vi-VN') + ' VNĐ',
                    name === 'mucTieu' ? 'Mục tiêu' : 'Thực hiện'
                  ]}
                />
                <Legend
                  formatter={(value) => value === 'mucTieu' ? 'Mục tiêu' : 'Thực hiện'}
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '12px', fontWeight: '600' }}
                />
                <Bar dataKey="mucTieu" fill="#e0e7ff" radius={[4, 4, 0, 0]} name="mucTieu" />
                <Bar dataKey="thucHien" fill="#6366f1" radius={[4, 4, 0, 0]} name="thucHien" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Annual Progress Circle */}
        {(() => {
          const totalTarget = Object.entries(monthlyTargetsMap)
            .filter(([m]) => m.startsWith(String(chartYear)))
            .reduce((sum, [, v]) => sum + v, 0);
          const totalActual = records
            .filter(r => r.date.startsWith(String(chartYear)))
            .reduce((sum, r) => sum + r.revenue, 0);
          const pct = totalTarget > 0 ? Math.min(100, Math.round((totalActual / totalTarget) * 100)) : 0;
          const remaining = Math.max(0, totalTarget - totalActual);
          const radius = 70;
          const circumference = 2 * Math.PI * radius;
          const strokeDash = (pct / 100) * circumference;
          return (
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-50 flex flex-col justify-between">
              <h3 className="text-lg font-bold text-gray-900 mb-6">Tiến độ mục tiêu</h3>
              <div className="flex flex-col items-center flex-1 justify-center gap-6">
                <div className="relative w-44 h-44">
                  <svg viewBox="0 0 180 180" className="w-full h-full -rotate-90">
                    <circle cx="90" cy="90" r={radius} fill="none" stroke="#e0e7ff" strokeWidth="14" strokeLinecap="round" />
                    <circle
                      cx="90" cy="90" r={radius} fill="none"
                      stroke="#6366f1" strokeWidth="14" strokeLinecap="round"
                      strokeDasharray={`${strokeDash} ${circumference}`}
                      style={{ transition: 'stroke-dasharray 0.6s ease' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black text-gray-900">{pct}%</span>
                    <span className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mt-0.5">Hoàn thành</span>
                  </div>
                </div>
                <div className="w-full space-y-3">
                  <div className="flex justify-between text-xs font-bold text-gray-400 uppercase tracking-widest">
                    <span>Còn lại</span>
                    <span className="text-gray-700">{remaining.toLocaleString('vi-VN')} VNĐ</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-[11px] font-medium text-gray-400">
                    <span>Thực hiện: <span className="text-indigo-600 font-bold">{totalActual.toLocaleString('vi-VN')}</span></span>
                    <span>Mục tiêu: <span className="text-gray-600 font-bold">{totalTarget.toLocaleString('vi-VN')}</span></span>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Employee Revenue Bar Chart - Expanded to Full Width */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-50 lg:col-span-3">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Doanh số theo nhân viên (Phân tích theo nguồn)</h3>
              <p className="text-xs text-gray-400 mt-1 italic">* Tùy chỉnh nguồn doanh thu để xem chi tiết</p>
            </div>
            
            {/* Source Filter */}
            <div className="flex flex-wrap gap-2">
              {allAvailableSources.map(source => (
                <button
                  key={source}
                  onClick={() => {
                    setSelectedSources(prev => 
                      prev.includes(source) 
                        ? prev.filter(s => s !== source) 
                        : [...prev, source]
                    );
                  }}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${
                    selectedSources.includes(source)
                      ? 'bg-primary text-white shadow-md shadow-primary/20'
                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                  }`}
                >
                  {source}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[450px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={employeeRevenueData.data} layout="vertical" margin={{ left: 40, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f3f4f6" />
                <XAxis 
                  type="number"
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fontSize: 10, fill: '#9ca3af'}} 
                  tickFormatter={(val) => (val / 1000000).toFixed(1) + 'M'}
                />
                <YAxis 
                  dataKey="name"
                  type="category"
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fontSize: 10, fill: '#4b5563', fontWeight: 'bold'}} 
                  width={100}
                />
                <Tooltip 
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  formatter={(value: any, name: string) => [value.toLocaleString('vi-VN') + ' VNĐ', name]}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                {employeeRevenueData.allSources.map((source) => (
                  <Bar 
                    key={source} 
                    dataKey={source} 
                    stackId="a" 
                    fill={COLORS[allAvailableSources.indexOf(source) % COLORS.length]} 
                    barSize={20} 
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Source Distribution Chart */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-50">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-lg font-bold text-gray-900">Tỉ lệ nguồn doanh thu</h3>
            <PieChartIcon className="w-5 h-5 text-gray-400" />
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sourceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {sourceData.map((entry, index) => (
                    <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  formatter={(value: any, name: string) => {
                    const percent = stats.totalRevenue > 0 ? ((value / stats.totalRevenue) * 100).toFixed(1) : 0;
                    return [`${value.toLocaleString('vi-VN')} VNĐ (${percent}%)`, name];
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Employee Performance Bar Chart - Expanded to Full Width */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-50 lg:col-span-2">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Doanh số theo nguồn doanh thu (So sánh trực tiếp)</h3>
              <p className="text-xs text-gray-400 mt-1 italic">* So sánh doanh số thực tế của từng nhân viên trên cùng một nguồn</p>
            </div>
            
            {/* Source Filter */}
            <div className="flex flex-wrap gap-2">
              {allAvailableSources.map(source => (
                <button
                  key={source}
                  onClick={() => {
                    setSelectedSources(prev => 
                      prev.includes(source) 
                        ? prev.filter(s => s !== source) 
                        : [...prev, source]
                    );
                  }}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${
                    selectedSources.includes(source)
                      ? 'bg-primary text-white shadow-md shadow-primary/20'
                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                  }`}
                >
                  {source}
                </button>
              ))}
            </div>
          </div>
          
          <div className="h-[450px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData.chartData} margin={{ top: 20, right: 30, left: 40, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="subject" tick={{fontSize: 10, fill: '#9ca3af'}} axisLine={false} tickLine={false} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fontSize: 10, fill: '#9ca3af'}} 
                  tickFormatter={(value) => value.toLocaleString('vi-VN')}
                  label={{ value: 'Doanh số (VNĐ)', angle: -90, position: 'insideLeft', offset: -30, fontSize: 10, fill: '#9ca3af' }} 
                />
                <Tooltip 
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  formatter={(value: any, name: string) => {
                    return [value.toLocaleString('vi-VN') + ' VNĐ', name];
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                {performanceData.employees.map((emp, index) => (
                  <Bar
                    key={emp}
                    name={emp}
                    dataKey={emp}
                    fill={COLORS[index % COLORS.length]}
                    radius={[4, 4, 0, 0]}
                    barSize={30}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Records Table */}
      {filteredRecords.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-50 p-12 text-center">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
            <FileSpreadsheet className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Chưa có dữ liệu</h3>
          <p className="text-gray-400 max-w-xs mx-auto">Vui lòng nhập file Excel để bắt đầu phân tích doanh thu.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-50 overflow-hidden">
          <div className="p-8 border-b border-gray-50 flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-900">Dữ liệu gần đây</h3>
            <Download className="w-5 h-5 text-gray-400" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50/50 text-gray-400 text-[10px] uppercase font-bold tracking-widest">
                <tr>
                  <th className="px-8 py-4">Ngày</th>
                  <th className="px-8 py-4">Nhân viên</th>
                  <th className="px-8 py-4">Công ty</th>
                  <th className="px-8 py-4">Nguồn</th>
                  <th className="px-8 py-4 text-right">Doanh số</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredRecords.slice(-10).reverse().map((record, index) => (
                  <tr key={record.id || `record-${index}`} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-8 py-5 text-sm text-gray-500">{format(new Date(record.date), 'dd/MM/yyyy')}</td>
                    <td className="px-8 py-5 font-bold text-sm text-gray-900">{record.employeeName}</td>
                    <td className="px-8 py-5 text-sm text-gray-600">{record.companyName}</td>
                    <td className="px-8 py-5">
                      <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-bold uppercase tracking-widest">
                        {record.source}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right font-black text-sm text-gray-900">
                      {record.revenue.toLocaleString('vi-VN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
