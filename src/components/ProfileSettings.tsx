import React, { useState, useRef } from 'react';
import { auth, db, storage, handleFirestoreError, OperationType } from '../firebase';
import { updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { UserProfile } from '../types';
import { Save, User, Lock, Image as ImageIcon, Upload, X, CheckCircle2, AlertCircle } from 'lucide-react';

interface ProfileSettingsProps {
  user: UserProfile;
  onUserUpdate: (updatedUser: UserProfile) => void;
}

export default function ProfileSettings({ user, onUserUpdate }: ProfileSettingsProps) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [photoURL, setPhotoURL] = useState(user.photoURL || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Không tìm thấy người dùng.');

      // Update Firebase Auth Profile
      await updateProfile(currentUser, {
        displayName: displayName,
        photoURL: photoURL
      });

      // Update Firestore User Profile
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        displayName: displayName,
        photoURL: photoURL
      });

      onUserUpdate({
        ...user,
        displayName: displayName,
        photoURL: photoURL
      });

      setMessage({ type: 'success', text: 'Cập nhật thông tin cá nhân thành công!' });
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage({ type: 'error', text: 'Lỗi khi cập nhật thông tin.' });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Mật khẩu mới không khớp.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email) throw new Error('Không tìm thấy người dùng.');

      // Re-authenticate user
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);

      // Update password
      await updatePassword(currentUser, newPassword);

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage({ type: 'success', text: 'Đổi mật khẩu thành công!' });
    } catch (error: any) {
      console.error('Error updating password:', error);
      let errorText = 'Lỗi khi đổi mật khẩu.';
      if (error.code === 'auth/wrong-password') {
        errorText = 'Mật khẩu hiện tại không chính xác.';
      } else if (error.code === 'auth/weak-password') {
        errorText = 'Mật khẩu mới quá yếu.';
      }
      setMessage({ type: 'error', text: errorText });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Vui lòng chọn file hình ảnh.' });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Dung lượng file không được vượt quá 2MB.' });
      return;
    }

    setUploading(true);
    setMessage(null);

    try {
      const storageRef = ref(storage, `avatars/${user.uid}_${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      setPhotoURL(downloadURL);
      setMessage({ type: 'success', text: 'Tải ảnh đại diện lên thành công!' });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      setMessage({ type: 'error', text: 'Lỗi khi tải ảnh lên.' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Profile Info Section */}
        <div className="flex-1 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <h3 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Thông tin cá nhân
            </h3>
            
            <form onSubmit={handleProfileUpdate} className="space-y-6">
              <div className="flex flex-col items-center mb-8">
                <div className="relative group">
                  <div className="w-32 h-32 bg-gray-100 rounded-full overflow-hidden border-4 border-white shadow-lg">
                    {photoURL ? (
                      <img src={photoURL} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <User className="w-12 h-12" />
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 p-2 bg-primary text-white rounded-full shadow-lg hover:bg-primary/90 transition-all"
                  >
                    <Upload className="w-4 h-4" />
                  </button>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                  accept="image/*"
                />
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Họ và tên</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-gray-50 border-none rounded-2xl py-4 px-5 text-gray-900 font-bold focus:ring-2 focus:ring-primary/20 transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Link ảnh đại diện</label>
                  <input
                    type="text"
                    value={photoURL}
                    onChange={(e) => setPhotoURL(e.target.value)}
                    className="w-full bg-gray-50 border-none rounded-2xl py-4 px-5 text-gray-900 font-bold focus:ring-2 focus:ring-primary/20 transition-all"
                    placeholder="Dán URL hình ảnh vào đây..."
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || uploading}
                className="w-full py-4 bg-primary text-white rounded-2xl font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50"
              >
                <Save className="w-5 h-5" />
                Lưu thông tin
              </button>
            </form>
          </div>
        </div>

        {/* Password Section */}
        <div className="w-full md:w-80 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <h3 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              Đổi mật khẩu
            </h3>

            <form onSubmit={handlePasswordUpdate} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Mật khẩu hiện tại</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-gray-50 border-none rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Mật khẩu mới</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-gray-50 border-none rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Xác nhận mật khẩu</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-gray-50 border-none rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-gray-800 transition-all active:scale-95 disabled:opacity-50"
              >
                <Lock className="w-4 h-4" />
                Đổi mật khẩu
              </button>
            </form>
          </div>
        </div>
      </div>

      {message && (
        <div className={`fixed bottom-8 right-8 p-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-4 ${message.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="font-bold text-sm">{message.text}</span>
          <button onClick={() => setMessage(null)} className="ml-4 hover:opacity-70">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
