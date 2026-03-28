import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { AppSetting } from '../types';
import { Save, Image as ImageIcon, Type, Upload, X } from 'lucide-react';

export default function Settings() {
  const [settings, setSettings] = useState<AppSetting>({
    appName: 'MBI Team 69',
    logoUrl: '',
    updatedAt: new Date().toISOString()
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'global');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSettings(docSnap.data() as AppSetting);
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Vui lòng chọn file hình ảnh.' });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Dung lượng file không được vượt quá 2MB.' });
      return;
    }

    setUploading(true);
    setMessage(null);

    try {
      const storageRef = ref(storage, `branding/logo_${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      setSettings(prev => ({ ...prev, logoUrl: downloadURL }));
      setMessage({ type: 'success', text: 'Tải ảnh lên thành công!' });
    } catch (error) {
      console.error('Error uploading file:', error);
      setMessage({ type: 'error', text: 'Lỗi khi tải ảnh lên. Vui lòng kiểm tra lại cấu hình Firebase Storage.' });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const updatedSettings = {
        ...settings,
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'settings', 'global'), updatedSettings);
      setSettings(updatedSettings);
      setMessage({ type: 'success', text: 'Cài đặt đã được lưu thành công!' });
      // Reload to apply changes globally
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: 'Lỗi khi lưu cài đặt.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Cài đặt hệ thống</h2>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <form onSubmit={handleSave} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
              <Type className="w-4 h-4" />
              Tên ứng dụng
            </label>
            <input
              type="text"
              value={settings.appName}
              onChange={(e) => setSettings({ ...settings, appName: e.target.value })}
              className="w-full bg-gray-50 border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary/20 transition-all"
              placeholder="Nhập tên ứng dụng..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              Logo ứng dụng
            </label>
            
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-all text-sm font-medium disabled:opacity-50"
                >
                  {uploading ? (
                    <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  Tải ảnh lên
                </button>
                <span className="text-xs text-gray-400">Hoặc dán URL bên dưới</span>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept="image/*"
              />

              <input
                type="text"
                value={settings.logoUrl || ''}
                onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })}
                className="w-full bg-gray-50 border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="Dán URL hình ảnh logo vào đây..."
              />
            </div>
            <p className="mt-2 text-xs text-gray-400">Dán URL hình ảnh logo hoặc tải file lên (PNG, JPG, SVG)</p>
          </div>

          {settings.logoUrl && (
            <div className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-bold text-gray-700">Xem trước Logo:</p>
                <button 
                  type="button"
                  onClick={() => setSettings({ ...settings, logoUrl: '' })}
                  className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  Gỡ bỏ
                </button>
              </div>
              <div className="w-32 h-32 bg-gray-50 rounded-2xl flex items-center justify-center border border-dashed border-gray-200 overflow-hidden p-4">
                <img src={settings.logoUrl} alt="Logo Preview" className="max-w-full max-h-full object-contain" />
              </div>
            </div>
          )}

          {message && (
            <div className={`p-4 rounded-xl text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
              {message.text}
            </div>
          )}

          <div className="pt-6">
            <button
              type="submit"
              disabled={saving || uploading}
              className="w-full bg-primary text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Lưu cài đặt
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
