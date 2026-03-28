export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: 'admin' | 'sales';
  status: 'pending' | 'active' | 'disabled';
  createdAt: string;
}

export interface MonthlyTarget {
  id?: string;
  userId: string;
  month: string; // YYYY-MM
  revenue: number;
  partners: number; // Số Đại lý/CTV ký hợp đồng
  mxh: number; // Số bài đăng MXH
  zalo: number;
  createdAt: string;
}

export interface DailyReport {
  id?: string;
  userId: string;
  date: string; // YYYY-MM-DD
  revenue: number;
  khachHangTuTim: number;
  daiLyCTV: {
    name: string;
    phone: string;
    content: string;
  }[];
  khachHangGioiThieu: number;
  chat: number;
  donHangMBI: number;
  dangTinMXH: string[];
  soKHTiemNang: number;
  khachHangCu: number;
  createdAt: string;
}

export interface AppSetting {
  appName: string;
  logoUrl?: string;
  updatedAt: string;
}

export interface PublicStat {
  id?: string;
  userId: string;
  userName: string;
  userPhotoURL?: string;
  date: string; // YYYY-MM-DD
  revenue: number;
  partnerCount: number;
  mxhCount: number;
  leadsCount: number;
  updatedAt: string;
}

export interface GeneralRevenueRecord {
  id?: string;
  source: string; // Nguồn
  orderId: string; // Đơn hàng
  date: string; // YYYY-MM-DD
  companyName: string; // Tên công ty
  employeeName: string; // Nhân viên
  revenue: number; // Doanh số
  createdAt: string;
}
