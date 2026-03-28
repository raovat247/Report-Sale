import React, { useState, useEffect } from 'react';
import { auth, db, googleProvider } from '../firebase';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile 
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { UserProfile, AppSetting } from '../types';
import { LogIn, Users, Mail, Lock, User, ArrowRight } from 'lucide-react';

interface LoginProps {
  onUserLoaded: (user: UserProfile) => void;
}

export default function Login({ onUserLoaded }: LoginProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [settings, setSettings] = useState<AppSetting>({
    appName: 'MBI Team 69',
    logoUrl: '',
    updatedAt: new Date().toISOString()
  });

  useEffect(() => {
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
  }, []);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const profile = userDoc.data() as UserProfile;
        onUserLoaded(profile);
      } else {
        // Default role is sales, status is pending (except for the main admin)
        const isAdmin = user.email === 'toanlv@matbao.vn';
        const newUser: UserProfile = {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || 'Anonymous',
          role: isAdmin ? 'admin' : 'sales',
          status: isAdmin ? 'active' : 'pending',
          createdAt: new Date().toISOString(),
        };
        await setDoc(userDocRef, newUser);
        onUserLoaded(newUser);
      }
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        setError(null);
      } else {
        setError('Đăng nhập Google thất bại.');
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'login') {
        const result = await signInWithEmailAndPassword(auth, email, password);
        const userDoc = await getDoc(doc(db, 'users', result.user.uid));
        if (userDoc.exists()) {
          onUserLoaded(userDoc.data() as UserProfile);
        } else {
          setError('Không tìm thấy thông tin người dùng.');
        }
      } else {
        if (!displayName) {
          setError('Vui lòng nhập họ tên.');
          setLoading(false);
          return;
        }
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(result.user, { displayName });
        
        const isAdmin = email === 'toanlv@matbao.vn';
        const newUser: UserProfile = {
          uid: result.user.uid,
          email: result.user.email || '',
          displayName: displayName,
          role: isAdmin ? 'admin' : 'sales',
          status: isAdmin ? 'active' : 'pending',
          createdAt: new Date().toISOString(),
        };
        await setDoc(doc(db, 'users', result.user.uid), newUser);
        onUserLoaded(newUser);
      }
    } catch (err: any) {
      console.error('Auth Error:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Email hoặc mật khẩu không chính xác.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Email này đã được sử dụng.');
      } else if (err.code === 'auth/weak-password') {
        setError('Mật khẩu quá yếu (tối thiểu 6 ký tự).');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Đăng ký bằng Email/Mật khẩu hiện đang bị tắt. Vui lòng liên hệ Admin.');
      } else if (err.code === 'permission-denied') {
        setError('Bạn không có quyền thực hiện thao tác này.');
      } else {
        setError(`Lỗi: ${err.message || 'Thao tác thất bại. Vui lòng thử lại.'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f0] p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 md:p-10 text-center">
        <div className="mb-8">
          <div className="w-20 h-20 flex items-center justify-center mx-auto mb-4">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt={settings.appName} className="w-full h-full object-contain" />
            ) : (
              <div className="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center shadow-lg">
                <Users className="text-white w-10 h-10" />
              </div>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{settings.appName}</h1>
          <p className="text-gray-500 mt-2 text-sm">Hệ thống báo cáo & quản lý mục tiêu kinh doanh</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 text-red-600 rounded-xl text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-4 mb-6">
          {mode === 'register' && (
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Họ và tên"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          )}
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full pl-11 pr-4 py-3 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="password"
              placeholder="Mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full pl-11 pr-4 py-3 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-primary text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95 disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                {mode === 'login' ? 'Đăng nhập' : 'Đăng ký tài khoản'}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-100"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-gray-400 font-bold tracking-widest">Hoặc</span>
          </div>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full py-3.5 px-6 bg-white border border-gray-100 text-gray-700 rounded-xl font-bold text-sm flex items-center justify-center gap-3 hover:bg-gray-50 transition-all shadow-sm active:scale-95 disabled:opacity-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Tiếp tục với Google
        </button>

        <div className="mt-8 pt-6 border-t border-gray-50">
          <button
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            className="text-sm font-bold text-primary hover:underline"
          >
            {mode === 'login' ? 'Chưa có tài khoản? Đăng ký ngay' : 'Đã có tài khoản? Đăng nhập'}
          </button>
        </div>
        
        <p className="mt-8 text-[10px] text-gray-400 uppercase font-bold tracking-widest">Mat Bao Sales Team</p>
      </div>
    </div>
  );
}
