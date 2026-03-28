import React, { useState, useEffect, useMemo } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { UserProfile, GeneralRevenueRecord } from '../types';
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from 'date-fns';
import confetti from 'canvas-confetti';
import { 
  Trophy, TrendingUp, Filter, Crown, ChevronDown, Check
} from 'lucide-react';

interface LeaderboardProps {
  user: UserProfile;
}

export default function Leaderboard({ user }: LeaderboardProps) {
  const [records, setRecords] = useState<GeneralRevenueRecord[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'month' | 'quarter' | 'year' | 'all'>('month');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [isSourceMenuOpen, setIsSourceMenuOpen] = useState(false);

  const isAdmin = user.role === 'admin';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all revenue records
      const recordsQuery = query(collection(db, 'general_revenue'), orderBy('date', 'desc'));
      const recordsSnap = await getDocs(recordsQuery);
      const fetchedRecords = recordsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as GeneralRevenueRecord));
      setRecords(fetchedRecords);

      // Fetch all users to match names
      const usersSnap = await getDocs(collection(db, 'users'));
      setUsers(usersSnap.docs.map(doc => doc.data() as UserProfile));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'general_revenue');
    } finally {
      setLoading(false);
    }
  };

  const allSources = useMemo(() => {
    return Array.from(new Set(records.map(r => r.source))).sort();
  }, [records]);

  const filteredRecords = useMemo(() => {
    let filtered = records;

    // Filter by time range
    if (timeRange !== 'all') {
      const now = new Date();
      let start, end;
      if (timeRange === 'month') {
        start = startOfMonth(now);
        end = endOfMonth(now);
      } else if (timeRange === 'quarter') {
        start = startOfQuarter(now);
        end = endOfQuarter(now);
      } else {
        start = startOfYear(now);
        end = endOfYear(now);
      }
      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');
      filtered = filtered.filter(r => r.date >= startStr && r.date <= endStr);
    }

    // Filter by source
    if (selectedSource !== 'all') {
      filtered = filtered.filter(r => r.source === selectedSource);
    }

    return filtered;
  }, [records, timeRange, selectedSource]);

  const leaderboardData = useMemo(() => {
    const employeeStats: { [name: string]: { name: string, revenue: number, photoURL?: string, userId?: string } } = {};
    
    filteredRecords.forEach(r => {
      if (!employeeStats[r.employeeName]) {
        // Try to find matching user profile (case-insensitive and trimmed)
        const matchedUser = users.find(u => 
          u.displayName.trim().toLowerCase() === r.employeeName.trim().toLowerCase()
        );
        employeeStats[r.employeeName] = { 
          name: r.employeeName, 
          revenue: 0, 
          photoURL: matchedUser?.photoURL,
          userId: matchedUser?.uid
        };
      }
      employeeStats[r.employeeName].revenue += r.revenue;
    });

    return Object.values(employeeStats)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [filteredRecords, users]);

  useEffect(() => {
    if (leaderboardData.length > 0) {
      const duration = 2 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };
      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval: any = setInterval(function() {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) return clearInterval(interval);
        const particleCount = 50 * (timeLeft / duration);
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);
    }
  }, [leaderboardData]);

  const podiumData = useMemo(() => {
    const top3 = leaderboardData.slice(0, 3);
    const result = [];
    if (top3[1]) result.push({ ...top3[1], rank: 2 });
    if (top3[0]) result.push({ ...top3[0], rank: 1 });
    if (top3[2]) result.push({ ...top3[2], rank: 3 });
    return result;
  }, [leaderboardData]);

  const listData = useMemo(() => leaderboardData.slice(3), [leaderboardData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Bảng xếp hạng</h1>
            <p className="text-gray-400 text-sm font-medium">Vinh danh những chiến binh xuất sắc nhất</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Source Filter */}
          <div className="relative">
            <button
              onClick={() => setIsSourceMenuOpen(!isSourceMenuOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-xl text-xs font-bold text-gray-600 shadow-sm hover:bg-gray-50 transition-all"
            >
              <Filter className="w-3 h-3" />
              <span>{selectedSource === 'all' ? 'Tất cả nguồn' : selectedSource}</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${isSourceMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isSourceMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsSourceMenuOpen(false)}></div>
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-20 animate-in fade-in zoom-in-95 duration-200">
                  <button
                    onClick={() => {
                      setSelectedSource('all');
                      setIsSourceMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all"
                  >
                    Tất cả nguồn
                    {selectedSource === 'all' && <Check className="w-3 h-3 text-primary" />}
                  </button>
                  <div className="h-px bg-gray-50 my-1"></div>
                  {allSources.map(source => (
                    <button
                      key={source}
                      onClick={() => {
                        setSelectedSource(source);
                        setIsSourceMenuOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all"
                    >
                      {source}
                      {selectedSource === source && <Check className="w-3 h-3 text-primary" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100">
            {(['month', 'quarter', 'year', 'all'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                  timeRange === range 
                    ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                }`}
              >
                {range === 'month' ? 'Tháng' : range === 'quarter' ? 'Quý' : range === 'year' ? 'Năm' : 'Tất cả'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="p-8 border-b border-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-br from-indigo-600 to-purple-700 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Trophy className="w-6 h-6 text-yellow-300" />
            </div>
            <div>
              <h3 className="text-xl font-black">Xếp hạng doanh số</h3>
              <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mt-0.5">
                {selectedSource === 'all' ? 'Tổng doanh số tất cả nguồn' : `Doanh số từ nguồn: ${selectedSource}`}
              </p>
            </div>
          </div>
        </div>

        <div className="p-8 bg-gradient-to-b from-indigo-600/5 to-transparent">
          <div className="flex items-end justify-center gap-2 sm:gap-6 mb-12 pt-12">
            {podiumData.map((item) => (
              <div 
                key={item.name} 
                className={`flex flex-col items-center relative transition-all duration-500 hover:-translate-y-2 ${
                  item.rank === 1 ? 'z-10 -mt-8' : 'z-0'
                }`}
              >
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 animate-bounce">
                  <Crown className={`w-10 h-10 ${
                    item.rank === 1 ? 'text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]' :
                    item.rank === 2 ? 'text-gray-300' : 'text-amber-700'
                  }`} fill="currentColor" />
                </div>

                <div className={`relative rounded-full p-1 mb-4 ${
                  item.rank === 1 ? 'bg-gradient-to-tr from-yellow-400 to-yellow-200 w-24 h-24 sm:w-32 sm:h-32' :
                  item.rank === 2 ? 'bg-gradient-to-tr from-gray-300 to-gray-100 w-20 h-20 sm:w-24 sm:h-24' :
                  'bg-gradient-to-tr from-amber-700 to-amber-500 w-16 h-16 sm:w-20 sm:h-20'
                }`}>
                  <div className="w-full h-full rounded-full bg-white overflow-hidden border-4 border-white shadow-lg">
                    {item.photoURL ? (
                      <img src={item.photoURL} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-50 uppercase text-xl font-black">
                        {item.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-black text-white shadow-lg ${
                    item.rank === 1 ? 'bg-yellow-500' :
                    item.rank === 2 ? 'bg-gray-400' : 'bg-amber-600'
                  }`}>
                    #{item.rank}
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-sm font-black text-gray-900 truncate max-w-[100px] sm:max-w-[150px]">{item.name}</p>
                  <p className="text-lg font-black text-indigo-600 mt-1">
                    {item.revenue.toLocaleString('vi-VN')}
                    <span className="text-[10px] ml-0.5 opacity-60"> VNĐ</span>
                  </p>
                </div>

                <div className={`mt-4 w-24 sm:w-32 rounded-t-2xl shadow-inner ${
                  item.rank === 1 ? 'h-32 bg-gradient-to-b from-indigo-500 to-indigo-600' :
                  item.rank === 2 ? 'h-24 bg-gradient-to-b from-indigo-400 to-indigo-500' :
                  'h-16 bg-gradient-to-b from-indigo-300 to-indigo-400'
                } flex items-center justify-center`}>
                  <span className="text-4xl sm:text-6xl font-black text-white/20">{item.rank}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            {listData.map((item, index) => (
              <div 
                key={item.name} 
                className={`flex items-center justify-between p-4 rounded-2xl transition-all ${
                  item.userId === user.uid ? 'bg-indigo-50 border border-indigo-100' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-8 flex justify-center">
                    <span className="text-sm font-black text-gray-300">#{index + 4}</span>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden border-2 border-white shadow-sm">
                    {item.photoURL ? (
                      <img src={item.photoURL} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-50 uppercase text-xs font-bold">
                        {item.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{item.name}</p>
                    {item.userId && (
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">ID: {item.userId.substring(0, 8)}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-base font-black text-gray-900">
                    {item.revenue.toLocaleString('vi-VN')}
                    <span className="text-[10px] ml-1 text-gray-400 font-bold uppercase">VNĐ</span>
                  </p>
                </div>
              </div>
            ))}

            {leaderboardData.length === 0 && (
              <div className="py-20 text-center">
                <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center text-gray-300 mx-auto mb-4">
                  <Trophy className="w-10 h-10" />
                </div>
                <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Chưa có dữ liệu xếp hạng</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
