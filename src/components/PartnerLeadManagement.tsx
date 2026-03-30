import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../firebase';
import { toast } from 'sonner';
import {
  Eye, Upload, BarChart2, List, Users, UserPlus, X, ChevronDown, Check,
  Phone, FileSpreadsheet, RefreshCw, Trash2, Briefcase, Plus, AlertCircle
} from 'lucide-react';
import { UserProfile, PartnerLead } from '../types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

// ─── Types ───────────────────────────────────────────────────────────────────

type TinhTrang = 'ĐANG LÀM' | 'THÀNH CÔNG' | 'THẤT BẠI' | 'TIỀM NĂNG' | 'CHƯA XỬ LÝ';
type TabType = 'list' | 'unassigned' | 'import' | 'stats';

interface FirestoreUser {
  uid: string;
  displayName: string;
  role: string;
  status: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TINH_TRANG_OPTIONS: TinhTrang[] = ['ĐANG LÀM', 'THÀNH CÔNG', 'THẤT BẠI', 'TIỀM NĂNG', 'CHƯA XỬ LÝ'];

const LY_DO_TU_CHOI_OPTIONS = [
  'Không tìm được thông tin liên hệ',
  'Liên hệ nhiều lần không phản hồi',
  'Thông tin liên hệ không được',
  'Đã làm đối tác với đơn vị khác',
  'Sản phẩm chưa đáp ứng được',
  'Chính sách không đủ hấp dẫn',
  'Yêu cầu kỹ thuật phức tạp',
  'Rủi ro pháp lý và trách nhiệm',
  'Không phù hợp với mô hình kinh doanh của đối tác',
  'Thiếu niềm tin vào sản phẩm và thương hiệu',
  'Thiếu nguồn lực để triển khai',
  'Chưa thấy nhu cầu từ khách hàng',
];

const statusBadge = (status: TinhTrang) => {
  const map: Record<TinhTrang, string> = {
    'THÀNH CÔNG': 'bg-green-100 text-green-700',
    'ĐANG LÀM': 'bg-blue-100 text-blue-700',
    'THẤT BẠI': 'bg-red-100 text-red-700',
    'TIỀM NĂNG': 'bg-yellow-100 text-yellow-700',
    'CHƯA XỬ LÝ': 'bg-gray-100 text-gray-600',
  };
  return map[status] ?? 'bg-gray-100 text-gray-600';
};

const today = () => new Date().toISOString().split('T')[0];

const normalizeStr = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const boolFromExcel = (v: unknown): boolean => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const lower = v.toLowerCase().trim();
    return lower === 'x' || lower === 'có' || lower === 'true' || lower === '1' || lower === 'yes';
  }
  return false;
};

// ─── LeadDetailModal ─────────────────────────────────────────────────────────

interface LeadDetailModalProps {
  lead: PartnerLead;
  user: UserProfile;
  onClose: () => void;
  onSaved: (updated: PartnerLead) => void;
  users: FirestoreUser[];
}

function LeadDetailModal({ lead, user, onClose, onSaved, users }: LeadDetailModalProps) {
  const [form, setForm] = useState<PartnerLead>({ ...lead });
  const [saving, setSaving] = useState(false);

  const handleAddContact = () => {
    const nextLan = (form.lienHe?.length ?? 0) + 1;
    if (nextLan > 7) { toast.warning('Đã đạt tối đa 7 lần liên hệ'); return; }
    setForm(prev => ({
      ...prev,
      lienHe: [...(prev.lienHe ?? []), { lan: nextLan, ngay: today(), noiDung: '' }]
    }));
  };

  const updateContact = (index: number, field: 'ngay' | 'noiDung', value: string) => {
    setForm(prev => {
      const arr = [...(prev.lienHe ?? [])];
      arr[index] = { ...arr[index], [field]: value };
      return { ...prev, lienHe: arr };
    });
  };

  const handleSave = async () => {
    if (!form.id) return;
    setSaving(true);
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      const updated: PartnerLead = { ...form, updatedAt: new Date().toISOString() };
      await updateDoc(doc(db, 'partner_leads', form.id), updated as Record<string, unknown>);
      toast.success('Đã lưu thay đổi');
      onSaved(updated);
      onClose();
    } catch (e) {
      toast.error('Lỗi khi lưu: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  const isAdmin = user.role === 'admin';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Chi tiết Lead</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 uppercase font-semibold">Tên khách hàng</label>
              <p className="font-bold text-gray-900 mt-1">{form.tenKhachHang}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase font-semibold">Chức vụ</label>
              <p className="text-gray-700 mt-1">{form.tenChucVu || '—'}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase font-semibold">SDT</label>
              <p className="text-gray-700 mt-1 flex items-center gap-1">
                {form.sdt ? <><Phone className="w-3.5 h-3.5 text-gray-400" />{form.sdt}</> : '—'}
              </p>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase font-semibold">Nguồn</label>
              <p className="text-gray-700 mt-1">{form.nguon || '—'}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase font-semibold">Nhóm</label>
              <p className="text-gray-700 mt-1">{form.nhom || '—'}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase font-semibold">Nhân viên</label>
              <p className="text-gray-700 mt-1">{form.assignedToName || 'Chưa phân công'}</p>
            </div>
          </div>

          {/* Reassign (admin only) */}
          {isAdmin && (
            <div>
              <label className="text-xs text-gray-500 uppercase font-semibold block mb-1">Phân công lại</label>
              <select
                value={form.assignedTo || ''}
                onChange={e => {
                  const uid = e.target.value;
                  const u = users.find(x => x.uid === uid);
                  setForm(prev => ({ ...prev, assignedTo: uid || undefined, assignedToName: u?.displayName || undefined }));
                }}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
              >
                <option value="">— Chưa phân công —</option>
                {users.map(u => (
                  <option key={u.uid} value={u.uid}>{u.displayName}</option>
                ))}
              </select>
            </div>
          )}

          {/* Tình trạng */}
          <div>
            <label className="text-xs text-gray-500 uppercase font-semibold block mb-1">Tình trạng</label>
            <select
              value={form.tinhTrang}
              onChange={e => {
                const val = e.target.value as TinhTrang;
                if (val === 'THẤT BẠI' && (form.lienHe?.length ?? 0) < 3) {
                  toast.error('Cần tối thiểu 3 lần liên hệ trước khi chọn Thất bại');
                  return;
                }
                setForm(prev => ({ ...prev, tinhTrang: val }));
              }}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
            >
              {TINH_TRANG_OPTIONS.map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
            {form.tinhTrang !== 'THẤT BẠI' && (form.lienHe?.length ?? 0) < 3 && (
              <p className="text-xs text-amber-500 mt-1">
                Đã liên hệ {form.lienHe?.length ?? 0}/3 lần — cần đủ 3 lần để chọn Thất bại
              </p>
            )}
          </div>

          {/* Lý do từ chối */}
          {form.tinhTrang === 'THẤT BẠI' && (
            <div>
              <label className="text-xs text-gray-500 uppercase font-semibold block mb-1">Lý do từ chối <span className="text-red-500">*</span></label>
              <select
                value={form.lyDoTuChoi || ''}
                onChange={e => setForm(prev => ({ ...prev, lyDoTuChoi: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
              >
                <option value="">— Chọn lý do —</option>
                {LY_DO_TU_CHOI_OPTIONS.map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
          )}

          {/* Checkboxes */}
          <div>
            <label className="text-xs text-gray-500 uppercase font-semibold block mb-2">Trạng thái xử lý</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                ['daTraoDoiChinhSach', 'Đã trao đổi CS'],
                ['daHopDongOnline', 'Đã HĐ online'],
                ['daTichHop', 'Đã tích hợp'],
                ['daKyHopDong', 'Đã ký HĐ'],
                ['daGioiThieuKH', 'Đã giới thiệu KH'],
              ] as [keyof PartnerLead, string][]).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer group">
                  <div
                    onClick={() => setForm(prev => ({ ...prev, [key]: !prev[key as keyof PartnerLead] }))}
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center cursor-pointer transition-all
                      ${form[key as keyof PartnerLead] ? 'bg-primary border-primary' : 'border-gray-300 group-hover:border-primary/50'}`}
                  >
                    {form[key as keyof PartnerLead] && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Lịch sử liên hệ */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs text-gray-500 uppercase font-semibold">Lịch sử liên hệ</label>
              {(form.lienHe?.length ?? 0) < 7 && (
                <button
                  onClick={handleAddContact}
                  className="text-xs bg-primary text-white rounded-lg px-3 py-1.5 font-bold flex items-center gap-1 hover:bg-primary/90 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Thêm lần liên hệ
                </button>
              )}
            </div>
            <div className="space-y-3">
              {Array.from({ length: Math.max(form.lienHe?.length ?? 0, 1) }, (_, i) => {
                const contact = form.lienHe?.[i];
                return (
                  <div key={i} className="border border-gray-100 rounded-xl p-3 bg-gray-50">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-primary">Lần {i + 1}</span>
                      {contact?.ngay && (
                        <span className="text-xs text-gray-400">{contact.ngay}</span>
                      )}
                    </div>
                    {contact ? (
                      <div className="space-y-2">
                        <input
                          type="date"
                          value={contact.ngay || ''}
                          onChange={e => updateContact(i, 'ngay', e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs"
                        />
                        <textarea
                          value={contact.noiDung || ''}
                          onChange={e => updateContact(i, 'noiDung', e.target.value)}
                          placeholder="Nội dung liên hệ..."
                          rows={2}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs resize-none"
                        />
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic">Chưa liên hệ</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
            Hủy
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 text-sm font-bold text-white bg-primary rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
            Lưu thay đổi
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── LeadTable ────────────────────────────────────────────────────────────────

interface LeadTableProps {
  leads: PartnerLead[];
  onView: (lead: PartnerLead) => void;
  onDelete?: (lead: PartnerLead) => void;
  isAdmin: boolean;
  showClaim?: boolean;
  onClaim?: (lead: PartnerLead) => void;
}

function LeadTable({ leads, onView, onDelete, isAdmin, showClaim, onClaim }: LeadTableProps) {
  const COL_HEADERS = ['Tên KH', 'Chức vụ', 'SDT', 'Nguồn', 'Nhóm', 'Nhân viên', 'Tình trạng', 'Liên hệ', ''];
  const [colWidths, setColWidths] = useState([200, 140, 120, 120, 120, 150, 130, 80, 90]);
  const resizing = useRef<{ col: number; startX: number; startW: number } | null>(null);

  const handleResizeMouseDown = (e: React.MouseEvent, colIndex: number) => {
    e.preventDefault();
    resizing.current = { col: colIndex, startX: e.clientX, startW: colWidths[colIndex] };
    const onMouseMove = (ev: MouseEvent) => {
      if (!resizing.current) return;
      const newW = Math.max(60, resizing.current.startW + ev.clientX - resizing.current.startX);
      setColWidths(prev => prev.map((w, i) => i === resizing.current!.col ? newW : w));
    };
    const onMouseUp = () => {
      resizing.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  if (leads.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-40" />
        <p className="font-semibold">Không có dữ liệu</p>
      </div>
    );
  }

  const stickyLastCol: React.CSSProperties = {
    position: 'sticky',
    right: 0,
    background: 'white',
    zIndex: 1,
    boxShadow: '-2px 0 6px -2px rgba(0,0,0,0.06)',
  };

  return (
    <div className="overflow-x-auto">
      <table className="text-sm" style={{ tableLayout: 'fixed', width: colWidths.reduce((a, b) => a + b, 0) }}>
        <colgroup>
          {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
        </colgroup>
        <thead>
          <tr className="border-b border-gray-100">
            {COL_HEADERS.map((h, i) => (
              <th
                key={i}
                className="relative text-left text-xs text-gray-500 uppercase font-semibold pb-3 pr-4 whitespace-nowrap overflow-hidden"
                style={i === COL_HEADERS.length - 1 ? { ...stickyLastCol, width: colWidths[i] } : { width: colWidths[i] }}
              >
                {h}
                {i < COL_HEADERS.length - 1 && (
                  <div
                    onMouseDown={(e) => handleResizeMouseDown(e, i)}
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize flex items-center justify-center group"
                    style={{ userSelect: 'none' }}
                  >
                    <div className="w-0.5 h-4 bg-gray-200 group-hover:bg-primary rounded-full transition-colors" />
                  </div>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {leads.map(lead => (
            <tr key={lead.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
              <td className="py-3 pr-4 font-semibold text-gray-900 overflow-hidden" style={{ maxWidth: colWidths[0] }}><span className="block truncate" title={lead.tenKhachHang}>{lead.tenKhachHang}</span></td>
              <td className="py-3 pr-4 text-gray-500 overflow-hidden" style={{ maxWidth: colWidths[1] }}><span className="block truncate" title={lead.tenChucVu || ''}>{lead.tenChucVu || '—'}</span></td>
              <td className="py-3 pr-4 text-gray-500 overflow-hidden"><span className="block truncate">{lead.sdt || '—'}</span></td>
              <td className="py-3 pr-4 text-gray-500 overflow-hidden"><span className="block truncate" title={lead.nguon || ''}>{lead.nguon || '—'}</span></td>
              <td className="py-3 pr-4 text-gray-500 overflow-hidden"><span className="block truncate" title={lead.nhom || ''}>{lead.nhom || '—'}</span></td>
              <td className="py-3 pr-4 text-gray-500 overflow-hidden"><span className="block truncate">{lead.assignedToName || <span className="italic text-gray-300">Chưa phân công</span>}</span></td>
              <td className="py-3 pr-4">
                <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${statusBadge(lead.tinhTrang)}`}>
                  {lead.tinhTrang}
                </span>
              </td>
              <td className="py-3 pr-4 text-center">
                <span className="font-bold text-primary">{lead.lienHe?.length ?? 0}</span>
              </td>
              <td className="py-3 whitespace-nowrap flex items-center gap-1" style={stickyLastCol}>
                <button
                  onClick={() => onView(lead)}
                  className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                  title="Xem chi tiết"
                >
                  <Eye className="w-4 h-4" />
                </button>
                {showClaim && onClaim && (
                  <button
                    onClick={() => onClaim(lead)}
                    className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors text-xs font-bold"
                    title="Nhận lead này"
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                )}
                {isAdmin && onDelete && (
                  <button
                    onClick={() => onDelete(lead)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Xóa"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  user: UserProfile;
}

export default function PartnerLeadManagement({ user }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>('list');
  const [leads, setLeads] = useState<PartnerLead[]>([]);
  const [users, setUsers] = useState<FirestoreUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterNhom, setFilterNhom] = useState('');
  const [searchName, setSearchName] = useState('');

  // Detail modal
  const [selectedLead, setSelectedLead] = useState<PartnerLead | null>(null);

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importRows, setImportRows] = useState<Record<string, unknown>[]>([]);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [colMap, setColMap] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);

  const isAdmin = user.role === 'admin';

  // ── Fetch users ────────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    try {
      const { collection, getDocs } = await import('firebase/firestore');
      const snap = await getDocs(collection(db, 'users'));
      const list: FirestoreUser[] = [];
      snap.forEach(d => {
        const data = d.data() as FirestoreUser;
        if (data.status === 'active') list.push(data);
      });
      setUsers(list);
    } catch (e) {
      console.error('fetchUsers error', e);
    }
  }, []);

  // ── Fetch leads ────────────────────────────────────────────────────────────
  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const { collection, getDocs, query, where, orderBy } = await import('firebase/firestore');
      let q;
      if (isAdmin) {
        q = query(collection(db, 'partner_leads'), orderBy('createdAt', 'desc'));
      } else {
        q = query(
          collection(db, 'partner_leads'),
          where('assignedTo', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
      }
      const snap = await getDocs(q);
      const list: PartnerLead[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as PartnerLead));
      setLeads(list);
    } catch (e) {
      toast.error('Lỗi tải dữ liệu: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }, [isAdmin, user.uid]);

  useEffect(() => {
    fetchUsers();
    fetchLeads();
  }, [fetchUsers, fetchLeads]);

  // ── Unassigned leads (for "Chưa phân công" tab) ────────────────────────────
  const [unassignedLeads, setUnassignedLeads] = useState<PartnerLead[]>([]);
  const fetchUnassigned = useCallback(async () => {
    try {
      const { collection, getDocs, query, where, orderBy } = await import('firebase/firestore');
      const [snapNull, snapEmpty] = await Promise.all([
        getDocs(query(collection(db, 'partner_leads'), where('assignedTo', '==', null), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'partner_leads'), where('assignedTo', '==', ''), orderBy('createdAt', 'desc'))),
      ]);
      const list: PartnerLead[] = [];
      const seen = new Set<string>();
      [...snapNull.docs, ...snapEmpty.docs].forEach(d => {
        if (!seen.has(d.id)) { seen.add(d.id); list.push({ id: d.id, ...d.data() } as PartnerLead); }
      });
      setUnassignedLeads(list);
    } catch (e) {
      setUnassignedLeads(leads.filter(l => !l.assignedTo));
    }
  }, [leads]);

  useEffect(() => {
    if (activeTab === 'unassigned') fetchUnassigned();
  }, [activeTab, fetchUnassigned]);

  // ── Claim lead ─────────────────────────────────────────────────────────────
  const handleClaim = async (lead: PartnerLead) => {
    if (!lead.id) return;
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'partner_leads', lead.id), {
        assignedTo: user.uid,
        assignedToName: user.displayName,
        updatedAt: new Date().toISOString(),
      });
      toast.success(`Đã nhận lead: ${lead.tenKhachHang}`);
      setUnassignedLeads(prev => prev.filter(l => l.id !== lead.id));
      fetchLeads();
    } catch (e) {
      toast.error('Lỗi khi nhận lead: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  // ── Delete lead ────────────────────────────────────────────────────────────
  const handleDelete = async (lead: PartnerLead) => {
    if (!lead.id || !window.confirm(`Xóa lead "${lead.tenKhachHang}"?`)) return;
    try {
      const { doc, deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'partner_leads', lead.id));
      toast.success('Đã xóa lead');
      setLeads(prev => prev.filter(l => l.id !== lead.id));
    } catch (e) {
      toast.error('Lỗi xóa: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  // ── Lead saved from modal ──────────────────────────────────────────────────
  const handleLeadSaved = (updated: PartnerLead) => {
    setLeads(prev => prev.map(l => (l.id === updated.id ? updated : l)));
  };

  // ── Filters applied ────────────────────────────────────────────────────────
  const filteredLeads = leads.filter(l => {
    if (filterStatus && l.tinhTrang !== filterStatus) return false;
    if (filterEmployee && l.assignedTo !== filterEmployee) return false;
    if (filterNhom && l.nhom !== filterNhom) return false;
    if (searchName && !normalizeStr(l.tenKhachHang).includes(normalizeStr(searchName))) return false;
    return true;
  });

  const allNhom = Array.from(new Set(leads.map(l => l.nhom).filter(Boolean))) as string[];

  // ─── Import Excel ─────────────────────────────────────────────────────────

  const EXCEL_COLS = [
    { key: 'tenKhachHang', label: 'Tên KH' },
    { key: 'tenChucVu', label: 'Tên-Chức vụ' },
    { key: 'sdt', label: 'SDT' },
    { key: 'nguon', label: 'Nguồn' },
    { key: 'nhom', label: 'Nhóm' },
    { key: 'nhanVien', label: 'Nhân viên' },
    { key: 'tinhTrang', label: 'Tình trạng' },
    { key: 'lienHe1', label: 'Liên hệ lần 1' },
    { key: 'lienHe2', label: 'Liên hệ lần 2' },
    { key: 'lienHe3', label: 'Liên hệ lần 3' },
    { key: 'lienHe4', label: 'Liên hệ lần 4' },
    { key: 'lienHe5', label: 'Liên hệ lần 5' },
    { key: 'lienHe6', label: 'Liên hệ lần 6' },
    { key: 'lienHe7', label: 'Liên hệ lần 7' },
    { key: 'daTraoDoiChinhSach', label: 'Đã trao đổi CS' },
    { key: 'daHopDongOnline', label: 'Đã hợp đồng online' },
    { key: 'daTichHop', label: 'Đã tích hợp' },
    { key: 'daKyHopDong', label: 'Đã ký HĐ' },
    { key: 'daGioiThieuKH', label: 'Đã giới thiệu KH' },
    { key: 'lyDoTuChoi', label: 'Lý do từ chối' },
  ];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
      if (data.length === 0) { toast.warning('File không có dữ liệu'); return; }
      const headers = Object.keys(data[0]);
      setImportHeaders(headers);
      setImportRows(data);

      // Auto-map columns
      const autoMap: Record<string, string> = {};
      EXCEL_COLS.forEach(({ key, label }) => {
        const match = headers.find(h => normalizeStr(h).includes(normalizeStr(label)) || normalizeStr(label).includes(normalizeStr(h)));
        if (match) autoMap[key] = match;
      });
      setColMap(autoMap);
      toast.success(`Đọc được ${data.length} dòng từ file`);
    } catch (err) {
      toast.error('Lỗi đọc file: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const parseImportedLead = (row: Record<string, unknown>): Omit<PartnerLead, 'id'> => {
    const get = (key: string) => {
      const col = colMap[key];
      return col ? String(row[col] ?? '').trim() : '';
    };

    // Build lienHe array
    const lienHe: { lan: number; ngay?: string; noiDung?: string }[] = [];
    for (let i = 1; i <= 7; i++) {
      const noiDung = get(`lienHe${i}`);
      if (noiDung) lienHe.push({ lan: i, ngay: '', noiDung });
    }

    // Match employee
    const nhanVienName = get('nhanVien');
    let assignedTo: string | undefined;
    let assignedToName: string | undefined;
    if (nhanVienName) {
      const matched = users.find(u => normalizeStr(u.displayName) === normalizeStr(nhanVienName));
      if (matched) {
        assignedTo = matched.uid;
        assignedToName = matched.displayName;
      } else {
        assignedToName = nhanVienName; // Keep name even if no user match
      }
    }

    const rawTinhTrang = get('tinhTrang').toUpperCase();
    const validStatuses: TinhTrang[] = ['ĐANG LÀM', 'THÀNH CÔNG', 'THẤT BẠI', 'TIỀM NĂNG', 'CHƯA XỬ LÝ'];
    const tinhTrang: TinhTrang = validStatuses.find(s => normalizeStr(s) === normalizeStr(rawTinhTrang)) ?? 'CHƯA XỬ LÝ';

    const now = new Date().toISOString();
    return {
      tenKhachHang: get('tenKhachHang') || 'Không tên',
      tenChucVu: get('tenChucVu') || '',
      sdt: get('sdt') || '',
      nguon: get('nguon') || '',
      nhom: get('nhom') || '',
      assignedTo: assignedTo || '',
      assignedToName: assignedToName || '',
      tinhTrang,
      lienHe,
      daTraoDoiChinhSach: boolFromExcel(colMap['daTraoDoiChinhSach'] ? row[colMap['daTraoDoiChinhSach']] : ''),
      daHopDongOnline: boolFromExcel(colMap['daHopDongOnline'] ? row[colMap['daHopDongOnline']] : ''),
      daTichHop: boolFromExcel(colMap['daTichHop'] ? row[colMap['daTichHop']] : ''),
      daKyHopDong: boolFromExcel(colMap['daKyHopDong'] ? row[colMap['daKyHopDong']] : ''),
      daGioiThieuKH: boolFromExcel(colMap['daGioiThieuKH'] ? row[colMap['daGioiThieuKH']] : ''),
      lyDoTuChoi: get('lyDoTuChoi') || '',
      createdAt: now,
      updatedAt: now,
    };
  };

  const handleImport = async () => {
    if (importRows.length === 0) return;
    setImporting(true);
    try {
      const { collection, addDoc } = await import('firebase/firestore');
      let count = 0;
      for (const row of importRows) {
        const lead = parseImportedLead(row);
        if (!lead.tenKhachHang || lead.tenKhachHang === 'Không tên') continue;
        await addDoc(collection(db, 'partner_leads'), lead);
        count++;
      }
      toast.success(`Đã import ${count} leads thành công`);
      setImportFile(null);
      setImportRows([]);
      setImportHeaders([]);
      setColMap({});
      fetchLeads();
      setActiveTab('list');
    } catch (e) {
      toast.error('Lỗi import: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setImporting(false);
    }
  };

  // ─── Stats ───────────────────────────────────────────────────────────────

  const statsLeads = isAdmin ? leads : leads.filter(l => l.assignedTo === user.uid);

  const byStatus = TINH_TRANG_OPTIONS.map(s => ({
    name: s,
    count: statsLeads.filter(l => l.tinhTrang === s).length,
  }));

  const statusColors: Record<TinhTrang, string> = {
    'THÀNH CÔNG': '#16a34a',
    'ĐANG LÀM': '#2563eb',
    'THẤT BẠI': '#dc2626',
    'TIỀM NĂNG': '#d97706',
    'CHƯA XỬ LÝ': '#9ca3af',
  };

  const perEmployee = users.map(u => {
    const myLeads = statsLeads.filter(l => l.assignedTo === u.uid);
    const chuaXuLy = myLeads.filter(
      l => l.tinhTrang === 'CHƯA XỬ LÝ' || (l.tinhTrang === 'TIỀM NĂNG' && (l.lienHe?.length ?? 0) === 0)
    ).length;
    return {
      name: u.displayName,
      total: myLeads.length,
      thanhCong: myLeads.filter(l => l.tinhTrang === 'THÀNH CÔNG').length,
      dangLam: myLeads.filter(l => l.tinhTrang === 'ĐANG LÀM').length,
      chuaXuLy,
      thatBai: myLeads.filter(l => l.tinhTrang === 'THẤT BẠI').length,
    };
  }).filter(e => e.total > 0);

  // Rejection reasons
  const rejectReasons: Record<string, number> = {};
  statsLeads.filter(l => l.tinhTrang === 'THẤT BẠI' && l.lyDoTuChoi).forEach(l => {
    const r = l.lyDoTuChoi!.trim();
    if (r) rejectReasons[r] = (rejectReasons[r] ?? 0) + 1;
  });
  const topRejects = Object.entries(rejectReasons).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // Contacts per day (last 30 days)
  const contactsByDay: Record<string, number> = {};
  statsLeads.forEach(l => {
    (l.lienHe ?? []).forEach(c => {
      if (c.ngay) {
        const day = c.ngay.substring(0, 10);
        contactsByDay[day] = (contactsByDay[day] ?? 0) + 1;
      }
    });
  });
  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return d.toISOString().split('T')[0];
  });
  const contactChartData = last30Days.map(day => ({
    date: day.substring(5), // MM-DD
    count: contactsByDay[day] ?? 0,
  }));

  // ─── Tab Content ──────────────────────────────────────────────────────────

  const tabs: { key: TabType; label: string; icon: React.ReactNode }[] = [
    { key: 'list', label: 'Danh sách', icon: <List className="w-4 h-4" /> },
    { key: 'unassigned', label: 'Chưa phân công', icon: <Users className="w-4 h-4" /> },
    { key: 'import', label: 'Import Excel', icon: <FileSpreadsheet className="w-4 h-4" /> },
    { key: 'stats', label: 'Thống kê', icon: <BarChart2 className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
            <Briefcase className="w-7 h-7 text-primary" />
            Quản lý Lead đối tác
          </h1>
          <p className="text-sm text-gray-500 mt-1">CRM quản lý lead và theo dõi tiến trình chuyển đổi</p>
        </div>
        <button onClick={fetchLeads} className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl transition-colors" title="Làm mới">
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-5 py-4 text-sm font-bold whitespace-nowrap transition-all border-b-2
                ${activeTab === t.key
                  ? 'text-primary border-primary'
                  : 'text-gray-400 border-transparent hover:text-gray-600'}`}
            >
              {t.icon}
              {t.label}
              {t.key === 'unassigned' && unassignedLeads.length > 0 && (
                <span className="bg-orange-100 text-orange-600 text-xs px-1.5 py-0.5 rounded-full font-bold">
                  {unassignedLeads.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* ── TAB: Danh sách ── */}
          {activeTab === 'list' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-3">
                <input
                  type="text"
                  placeholder="Tìm theo tên KH..."
                  value={searchName}
                  onChange={e => setSearchName(e.target.value)}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm flex-1 min-w-[180px] focus:ring-2 focus:ring-primary/20 outline-none"
                />
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm"
                >
                  <option value="">Tất cả tình trạng</option>
                  {TINH_TRANG_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {isAdmin && (
                  <select
                    value={filterEmployee}
                    onChange={e => setFilterEmployee(e.target.value)}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm"
                  >
                    <option value="">Tất cả nhân viên</option>
                    {users.map(u => <option key={u.uid} value={u.uid}>{u.displayName}</option>)}
                  </select>
                )}
                <select
                  value={filterNhom}
                  onChange={e => setFilterNhom(e.target.value)}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm"
                >
                  <option value="">Tất cả nhóm</option>
                  {allNhom.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <span className="text-sm text-gray-400 self-center font-semibold ml-auto">
                  {filteredLeads.length}/{leads.length} lead
                </span>
              </div>

              {loading ? (
                <div className="flex justify-center py-16">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <LeadTable
                  leads={filteredLeads}
                  onView={setSelectedLead}
                  onDelete={isAdmin ? handleDelete : undefined}
                  isAdmin={isAdmin}
                />
              )}
            </div>
          )}

          {/* ── TAB: Chưa phân công ── */}
          {activeTab === 'unassigned' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Leads chưa được phân công — bất kỳ nhân viên nào đều có thể <strong>Nhận</strong>
                </p>
                <button onClick={fetchUnassigned} className="text-xs text-primary font-bold hover:underline">
                  Làm mới
                </button>
              </div>
              <LeadTable
                leads={unassignedLeads}
                onView={setSelectedLead}
                isAdmin={isAdmin}
                showClaim={true}
                onClaim={handleClaim}
                onDelete={isAdmin ? handleDelete : undefined}
              />
            </div>
          )}

          {/* ── TAB: Import Excel ── */}
          {activeTab === 'import' && (
            <div className="space-y-6">
              {/* File Upload */}
              <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center hover:border-primary/40 transition-colors">
                <FileSpreadsheet className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="font-bold text-gray-700 mb-1">Tải file Excel lên</p>
                <p className="text-sm text-gray-400 mb-4">Hỗ trợ .xlsx, .xls</p>
                <label className="cursor-pointer bg-primary text-white rounded-xl px-5 py-2.5 font-bold text-sm hover:bg-primary/90 transition-colors inline-flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Chọn file
                  <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
                </label>
                {importFile && (
                  <p className="text-sm text-gray-500 mt-3">
                    Đã chọn: <strong>{importFile.name}</strong> ({importRows.length} dòng)
                  </p>
                )}
              </div>

              {/* Column Mapping */}
              {importHeaders.length > 0 && (
                <div>
                  <h3 className="font-bold text-gray-900 mb-3">Ánh xạ cột Excel</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {EXCEL_COLS.map(({ key, label }) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-36 shrink-0 font-semibold">{label}</span>
                        <select
                          value={colMap[key] || ''}
                          onChange={e => setColMap(prev => ({ ...prev, [key]: e.target.value }))}
                          className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
                        >
                          <option value="">— Bỏ qua —</option>
                          {importHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview */}
              {importRows.length > 0 && (
                <div>
                  <h3 className="font-bold text-gray-900 mb-3">Xem trước ({Math.min(importRows.length, 5)} / {importRows.length} dòng)</h3>
                  <div className="overflow-x-auto border border-gray-100 rounded-xl">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          {importHeaders.map(h => (
                            <th key={h} className="text-left text-gray-500 font-semibold px-3 py-2 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importRows.slice(0, 5).map((row, i) => (
                          <tr key={i} className="border-t border-gray-50">
                            {importHeaders.map(h => (
                              <td key={h} className="px-3 py-2 text-gray-600 max-w-[120px] truncate whitespace-nowrap">
                                {String(row[h] ?? '')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Import Button */}
              {importRows.length > 0 && (
                <div className="flex justify-end">
                  <button
                    onClick={handleImport}
                    disabled={importing}
                    className="bg-primary text-white rounded-xl px-6 py-3 font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-2"
                  >
                    {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Import {importRows.length} leads
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: Thống kê ── */}
          {activeTab === 'stats' && (
            <div className="space-y-8">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 col-span-2 md:col-span-1 lg:col-span-1">
                  <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Tổng lead</p>
                  <p className="text-3xl font-extrabold text-gray-900">{statsLeads.length}</p>
                </div>
                {byStatus.map(s => (
                  <div key={s.name} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                    <p className="text-xs text-gray-500 uppercase font-semibold mb-1 truncate">{s.name}</p>
                    <p className="text-2xl font-extrabold" style={{ color: statusColors[s.name as TinhTrang] }}>
                      {s.count}
                    </p>
                  </div>
                ))}
              </div>

              {/* Contacts per Day Chart */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-bold text-gray-900 mb-4">Số lần liên hệ theo ngày (30 ngày gần nhất)</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={contactChartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" name="Liên hệ" fill="var(--color-primary, #6366f1)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Per Employee Table */}
              {isAdmin && perEmployee.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                  <h3 className="font-bold text-gray-900 mb-4">Thống kê theo nhân viên</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          {['Nhân viên', 'Tổng', 'Thành công', 'Đang làm', 'Chưa xử lý', 'Thất bại'].map(h => (
                            <th key={h} className="text-left text-xs text-gray-500 uppercase font-semibold pb-2 pr-4">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {perEmployee.sort((a, b) => b.total - a.total).map(e => (
                          <tr key={e.name} className="border-b border-gray-50">
                            <td className="py-2.5 pr-4 font-semibold text-gray-900">{e.name}</td>
                            <td className="py-2.5 pr-4 font-bold text-gray-700">{e.total}</td>
                            <td className="py-2.5 pr-4 text-green-600 font-bold">{e.thanhCong}</td>
                            <td className="py-2.5 pr-4 text-blue-600 font-bold">{e.dangLam}</td>
                            <td className="py-2.5 pr-4 text-gray-500 font-bold">{e.chuaXuLy}</td>
                            <td className="py-2.5 pr-4 text-red-500 font-bold">{e.thatBai}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Top Rejection Reasons */}
              {topRejects.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                  <h3 className="font-bold text-gray-900 mb-4">Top lý do từ chối</h3>
                  <div className="space-y-2">
                    {topRejects.map(([reason, count]) => (
                      <div key={reason} className="flex items-center gap-3">
                        <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-red-400 h-full rounded-full"
                            style={{ width: `${(count / topRejects[0][1]) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600 max-w-[200px] truncate" title={reason}>{reason}</span>
                        <span className="text-xs font-bold text-red-500 w-6 text-right">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lead Detail Modal */}
      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          user={user}
          users={users}
          onClose={() => setSelectedLead(null)}
          onSaved={handleLeadSaved}
        />
      )}
    </div>
  );
}
