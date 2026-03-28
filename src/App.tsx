import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { auth, db, testConnection } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { UserProfile } from './types';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ReportForm from './components/ReportForm';
import TargetSettings from './components/TargetSettings';
import PartnerList from './components/PartnerList';
import SocialPostList from './components/SocialPostList';
import SystemSettings from './components/SystemSettings';
import UserManagement from './components/UserManagement';
import ReportHistory from './components/ReportHistory';
import Leaderboard from './components/Leaderboard';
import GeneralDashboard from './components/GeneralDashboard';
import ProfileSettings from './components/ProfileSettings';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppSetting } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster } from 'sonner';
import { 
  LayoutDashboard, 
  FileText, 
  Target, 
  LogOut, 
  User as UserIcon, 
  Menu, 
  X,
  ChevronRight,
  Search,
  Bell,
  ChevronDown,
  Plus,
  Smartphone,
  Users,
  Share2,
  History,
  Settings as SettingsIcon,
  UserCheck,
  Clock,
  Trophy,
  BarChart3,
  Ban
} from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<AppSetting>({
    appName: 'MBI Team 69',
    logoUrl: '',
    updatedAt: new Date().toISOString()
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    testConnection();
    
    // Fetch settings on mount
    const fetchSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
        if (settingsDoc.exists()) {
          setSettings(settingsDoc.data() as AppSetting);
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      }
    };
    fetchSettings();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          setUser(userDoc.data() as UserProfile);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-main-bg">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <ErrorBoundary>
        <Login onUserLoaded={setUser} />
      </ErrorBoundary>
    );
  }

  if (user.status === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f0] p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-10 text-center">
          <div className="w-20 h-20 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-amber-600">
            <Clock className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Chờ phê duyệt</h1>
          <p className="text-gray-500 mb-8">Tài khoản của bạn đang chờ quản trị viên phê duyệt. Vui lòng quay lại sau.</p>
          <button
            onClick={() => signOut(auth)}
            className="w-full py-3.5 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200 transition-all"
          >
            Đăng xuất
          </button>
        </div>
      </div>
    );
  }

  if (user.status === 'disabled') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f0] p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-10 text-center">
          <div className="w-20 h-20 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-red-600">
            <Ban className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Tài khoản bị khóa</h1>
          <p className="text-gray-500 mb-8">Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên để biết thêm chi tiết.</p>
          <button
            onClick={() => signOut(auth)}
            className="w-full py-3.5 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200 transition-all"
          >
            Đăng xuất
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Toaster position="top-right" richColors />
      <Router>
        <Layout user={user} settings={settings}>
          <Routes>
            <Route path="/" element={<Dashboard user={user} />} />
            <Route path="/report" element={<ReportForm user={user} />} />
            <Route path="/dashboard" element={<Dashboard user={user} />} />
            <Route path="/general-dashboard" element={<GeneralDashboard user={user} />} />
            <Route path="/leaderboard" element={<Leaderboard user={user} />} />
            <Route path="/targets" element={<TargetSettings user={user} />} />
            <Route path="/partners" element={<PartnerList user={user} />} />
            <Route path="/social-posts" element={<SocialPostList user={user} />} />
            <Route path="/users" element={<UserManagement user={user} />} />
            <Route path="/history" element={<ReportHistory user={user} />} />
            <Route path="/profile" element={<ProfileSettings user={user} onUserUpdate={setUser} />} />
            <Route path="/settings" element={<SystemSettings user={user} />} />
          </Routes>
        </Layout>
      </Router>
    </ErrorBoundary>
  );
}

function Layout({ children, user, settings }: { children: React.ReactNode; user: UserProfile; settings: AppSetting }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await signOut(auth);
    window.location.reload();
  };

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard className="w-5 h-5" />, roles: ['admin', 'sales'] },
    { label: 'Dashboard Tổng', path: '/general-dashboard', icon: <BarChart3 className="w-5 h-5" />, roles: ['admin', 'sales'] },
    { label: 'Bảng xếp hạng', path: '/leaderboard', icon: <Trophy className="w-5 h-5" />, roles: ['admin', 'sales'] },
    { label: 'Báo cáo ngày', path: '/report', icon: <FileText className="w-5 h-5" />, roles: ['admin', 'sales'] },
    { label: 'Mục tiêu', path: '/targets', icon: <Target className="w-5 h-5" />, roles: ['admin'] },
    { label: 'Danh sách đối tác', path: '/partners', icon: <Users className="w-5 h-5" />, roles: ['admin', 'sales'] },
    { label: 'Bài đăng MXH', path: '/social-posts', icon: <Share2 className="w-5 h-5" />, roles: ['admin', 'sales'] },
    { label: 'Thành viên', path: '/users', icon: <UserCheck className="w-5 h-5" />, roles: ['admin'] },
    { label: 'Lịch sử', path: '/history', icon: <History className="w-5 h-5" />, roles: ['admin', 'sales'] },
    { label: 'Cài đặt', path: '/settings', icon: <SettingsIcon className="w-5 h-5" />, roles: ['admin'] },
  ].filter(item => item.roles.includes(user.role));

  return (
    <div className="min-h-screen bg-main-bg flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 bg-white border-r border-gray-100 transform transition-all duration-300 ease-in-out md:sticky md:top-0 md:h-screen md:translate-x-0
        ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        ${isSidebarCollapsed ? 'md:w-24' : 'md:w-72'}
        w-72
      `}>
        <div className="h-full flex flex-col p-6 overflow-y-auto overflow-x-hidden">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center">
                {settings.logoUrl ? (
                  <img src={settings.logoUrl} alt={settings.appName} className="w-full h-full object-contain" />
                ) : (
                  <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                )}
              </div>
              {!isSidebarCollapsed && (
                <span className="text-xl font-extrabold text-gray-900 tracking-tight whitespace-nowrap">{settings.appName}</span>
              )}
            </div>
            <button onClick={() => setIsMenuOpen(false)} className="md:hidden text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>

          <button 
            onClick={() => navigate('/report')}
            className={`
              bg-primary text-white rounded-xl font-bold flex items-center mb-8 shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all active:scale-[0.98]
              ${isSidebarCollapsed ? 'w-12 h-12 justify-center mx-auto' : 'w-full py-3.5 px-6 justify-between'}
            `}
            title="Báo cáo mới"
          >
            {!isSidebarCollapsed && <span>Báo cáo mới</span>}
            <Plus className="w-5 h-5" />
          </button>

          <nav className="flex-1 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.label}
                to={item.path}
                onClick={() => setIsMenuOpen(false)}
                title={isSidebarCollapsed ? item.label : ''}
                className={`
                  flex items-center gap-4 py-3 rounded-xl transition-all group
                  ${isSidebarCollapsed ? 'px-0 justify-center' : 'px-4'}
                  ${location.pathname === item.path ? 'bg-primary/5 text-primary' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'}
                `}
              >
                <div className={`${location.pathname === item.path ? 'text-primary' : 'text-gray-400 group-hover:text-gray-600'}`}>
                  {item.icon}
                </div>
                {!isSidebarCollapsed && <span className="font-semibold text-sm whitespace-nowrap">{item.label}</span>}
              </Link>
            ))}
          </nav>

          <div className="mt-auto pt-6">
            {/* Mobile App Card */}
            {!isSidebarCollapsed && (
              <div className="bg-indigo-50 rounded-2xl p-5 mb-6 relative overflow-hidden group">
                <div className="absolute -top-4 -right-4 w-20 h-20 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-all" />
                <div className="relative z-10">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center mb-3 shadow-sm">
                    <Smartphone className="w-5 h-5 text-primary" />
                  </div>
                  <p className="text-sm font-bold text-gray-900 mb-1">Tải ứng dụng mobile</p>
                  <p className="text-[10px] text-gray-500 font-medium mb-3">Theo dõi báo cáo mọi lúc mọi nơi</p>
                  <div className="flex gap-2">
                    <div className="w-6 h-6 bg-white rounded-md flex items-center justify-center shadow-sm" title="Android">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-green-600">
                        <path d="M17.523 15.3414C17.523 15.8614 17.103 16.2814 16.583 16.2814C16.063 16.2814 15.643 15.8614 15.643 15.3414C15.643 14.8214 16.063 14.4014 16.583 14.4014C17.103 14.4014 17.523 14.8214 17.523 15.3414ZM8.357 15.3414C8.357 15.8614 7.937 16.2814 7.417 16.2814C6.897 16.2814 6.477 15.8614 6.477 15.3414C6.477 14.8214 6.897 14.4014 7.417 14.4014C7.937 14.4014 8.357 14.8214 8.357 15.3414ZM17.92 11.6214L19.53 8.83142C19.64 8.64142 19.57 8.40142 19.38 8.29142C19.19 8.18142 18.95 8.25142 18.84 8.44142L17.21 11.2614C15.76 10.6014 13.96 10.2214 12 10.2214C10.04 10.2214 8.24 10.6014 6.79 11.2614L5.16 8.44142C5.05 8.25142 4.81 8.18142 4.62 8.29142C4.43 8.40142 4.36 8.64142 4.47 8.83142L6.08 11.6214C3.17 13.2014 1.19 16.1414 1.02 19.5914H22.98C22.81 16.1414 20.83 13.2014 17.92 11.6214Z"/>
                      </svg>
                    </div>
                    <div className="w-6 h-6 bg-white rounded-md flex items-center justify-center shadow-sm" title="iOS">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-gray-900">
                        <path d="M17.05 20.28c-.96.95-2.04 1.78-3.23 1.78-.55 0-1.03-.14-1.43-.42-.4-.28-.8-.42-1.21-.42-.4 0-.8.14-1.2.42-.4.28-.88.42-1.43.42-1.19 0-2.27-.83-3.23-1.78C3.33 18.31 2 15.11 2 12.19c0-2.32.88-4.12 2.62-5.24 1.04-.67 2.27-1.02 3.69-1.02.55 0 1.03-.07 1.43.21.4.14.8.21 1.2.21.4 0 .8-.07 1.2-.21.4-.14.88-.21 1.43-.21 1.42 0 2.65.35 3.69 1.02 1.74 1.12 2.62 2.92 2.62 5.24 0 2.92-1.33 6.12-3.32 8.09zM12.03 5.07c-.05 0-.11 0-.16.01-.05.01-.1.01-.15.02-.05.01-.1.02-.15.03-.05.01-.1.02-.15.04-.05.02-.1.04-.15.06-.05.02-.1.05-.15.08-.05.03-.1.06-.15.1-.05.04-.1.08-.14.13-.04.05-.08.1-.12.16-.04.05-.08.1-.12.16-.04.06-.07.12-.1.19-.03.07-.05.14-.07.22-.02.08-.03.16-.03.25 0 .09.01.18.03.27.02.09.05.18.09.27.04.09.09.17.15.25.06.08.13.15.21.21.08.06.17.11.27.15.1.04.2.07.31.09.11.02.22.03.34.03.12 0 .24-.01.36-.03.12-.02.24-.05.35-.09.11-.04.22-.09.32-.15.1-.06.19-.13.27-.21.08-.08.15-.17.21-.27.06-.1.11-.21.15-.32.04-.11.07-.23.09-.35.02-.12.03-.24.03-.36 0-.12-.01-.24-.03-.36-.02-.12-.05-.24-.09-.35-.04-.11-.09-.22-.15-.32-.06-.1-.13-.19-.21-.27-.08-.08-.17-.15-.27-.21-.1-.06-.21-.11-.32-.15-.11-.04-.23-.07-.35-.09-.12-.02-.24-.03-.36-.03z"/>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleLogout}
              title={isSidebarCollapsed ? 'Đăng xuất' : ''}
              className={`
                w-full flex items-center gap-4 py-3 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all font-semibold text-sm
                ${isSidebarCollapsed ? 'px-0 justify-center' : 'px-4'}
              `}
            >
              <LogOut className="w-5 h-5" />
              {!isSidebarCollapsed && <span>Đăng xuất</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="bg-white px-8 py-4 flex items-center justify-between border-b border-gray-100 sticky top-0 z-40">
          <div className="flex items-center gap-4 flex-1 max-w-xl">
            <button 
              onClick={() => {
                if (window.innerWidth < 768) {
                  setIsMenuOpen(true);
                } else {
                  setIsSidebarCollapsed(!isSidebarCollapsed);
                }
              }} 
              className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Tìm kiếm báo cáo, nhân viên..." 
                className="w-full bg-gray-50 border-none rounded-xl py-2.5 pl-11 pr-4 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <button className="relative p-2 text-gray-400 hover:bg-gray-50 rounded-xl transition-all">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
            </button>
            
            <div className="relative">
              <button 
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-3 pl-6 border-l border-gray-100 hover:opacity-80 transition-all"
              >
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-bold text-gray-900">{user.displayName}</p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{user.role}</p>
                </div>
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-primary font-black text-lg border-2 border-white shadow-sm overflow-hidden">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary">
                      <UserIcon className="w-5 h-5" />
                    </div>
                  )}
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isProfileOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isProfileOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setIsProfileOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-20 overflow-hidden"
                    >
                      <Link 
                        to="/profile" 
                        onClick={() => setIsProfileOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <UserIcon className="w-4 h-4 text-primary" />
                        Thông tin cá nhân
                      </Link>
                      <div className="h-px bg-gray-50 my-1" />
                      <button 
                        onClick={() => {
                          setIsProfileOpen(false);
                          handleLogout();
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Đăng xuất
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
