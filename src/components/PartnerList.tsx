import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, getDocs, where, orderBy } from 'firebase/firestore';
import { DailyReport, UserProfile } from '../types';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Users, Search, Calendar, User as UserIcon, Phone, MessageSquare } from 'lucide-react';

interface PartnerEntry {
  userName: string;
  partnerName: string;
  phone: string;
  content: string;
  date: string;
}

export default function PartnerList() {
  const [partners, setPartners] = useState<PartnerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

  useEffect(() => {
    fetchPartners();
  }, [selectedMonth]);

  const fetchPartners = async () => {
    setLoading(true);
    try {
      const start = startOfMonth(new Date(selectedMonth)).toISOString();
      const end = endOfMonth(new Date(selectedMonth)).toISOString();

      // Fetch all reports for the month
      const q = query(
        collection(db, 'daily_reports'),
        where('date', '>=', start),
        where('date', '<=', end),
        orderBy('date', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const reports = querySnapshot.docs.map(doc => doc.data() as DailyReport);

      // Fetch all users to map names
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

  const filteredPartners = partners.filter(p => 
    p.partnerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.phone.includes(searchTerm)
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Danh sách đối tác</h1>
          <p className="text-gray-400 text-sm font-medium">Danh sách các đối tác đã liên hệ trong tháng</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm đối tác, nhân viên..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all w-64"
            />
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
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 text-gray-400 text-[10px] uppercase font-bold tracking-widest">
              <tr>
                <th className="px-8 py-4">Nhân viên</th>
                <th className="px-8 py-4">Đối tác</th>
                <th className="px-8 py-4">Số điện thoại</th>
                <th className="px-8 py-4">Nội dung liên hệ</th>
                <th className="px-8 py-4">Ngày</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-8 py-12 text-center">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                  </td>
                </tr>
              ) : filteredPartners.length > 0 ? (
                filteredPartners.map((p, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary/5 rounded-lg flex items-center justify-center text-primary font-bold text-xs">
                          <UserIcon className="w-4 h-4" />
                        </div>
                        <span className="font-bold text-sm text-gray-900">{p.userName}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className="font-bold text-sm text-gray-700">{p.partnerName}</span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2 text-gray-500">
                        <Phone className="w-3 h-3" />
                        <span className="text-sm font-medium">{p.phone}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2 text-gray-500">
                        <MessageSquare className="w-3 h-3" />
                        <span className="text-sm font-medium line-clamp-1">{p.content}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-xs font-bold text-gray-400">{format(new Date(p.date), 'dd/MM/yyyy')}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-8 py-12 text-center text-gray-400 font-medium">
                    Không tìm thấy dữ liệu đối tác
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
