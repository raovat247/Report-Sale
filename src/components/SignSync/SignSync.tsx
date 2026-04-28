import React, { useState, useRef } from 'react';
import {
  FileText, User, Building2, Loader2, Download,
  CheckCircle2, AlertCircle, RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import html2pdf from 'html2pdf.js';
import { extractDataFromImages } from './geminiService';
import { ExtractedData, emptyData } from './types';

export default function SignSync() {
  const [images, setImages] = useState({ gpkd: '', cccd: '' });
  const [data, setData] = useState<ExtractedData>(emptyData);
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'upload' | 'review' | 'success'>('upload');
  const [error, setError] = useState<string | null>(null);
  const [signLocation, setSignLocation] = useState('Hồ Chí Minh');
  const [signDate, setSignDate] = useState(() => new Date().toISOString().split('T')[0]);

  const fileInputGpkd = useRef<HTMLInputElement>(null);
  const fileInputCccd = useRef<HTMLInputElement>(null);
  const pdfTemplateRef = useRef<HTMLDivElement>(null);

  const compressImage = (dataUrl: string): Promise<string> =>
    new Promise((resolve) => {
      if (dataUrl.startsWith('data:application/pdf')) { resolve(dataUrl); return; }
      const img = new Image();
      img.onload = () => {
        const MAX = 1400;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else { width = Math.round(width * MAX / height); height = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = dataUrl;
    });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'gpkd' | 'cccd') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result as string);
        setImages(prev => ({ ...prev, [type]: compressed }));
      };
      reader.readAsDataURL(file);
    }
  };

  const processImages = async () => {
    if (!images.gpkd || !images.cccd) { setError('Vui lòng tải lên cả bản scan GPKD và CCCD'); return; }
    setIsProcessing(true); setError(null);
    try {
      const result = await extractDataFromImages(images);
      setData({ ...emptyData, ...result });
      setStep('review');
    } catch (err: any) {
      setError(err?.message || 'Đã có lỗi xảy ra. Vui lòng thử lại sau ít phút.');
      console.error(err);
    } finally { setIsProcessing(false); }
  };

  const generatePDF = () => {
    const element = pdfTemplateRef.current;
    if (!element) return;
    const opt = {
      margin: 0,
      filename: `PYC_MATBAO_${data.organization.taxId || 'KYS'}.pdf`,
      image: { type: 'jpeg' as const, quality: 1 },
      html2canvas: {
        scale: 2, useCORS: true, letterRendering: true, scrollX: 0, scrollY: 0,
        onclone: (clonedDoc: Document) => {
          Array.from(clonedDoc.getElementsByTagName('style')).forEach(s => s.remove());
          Array.from(clonedDoc.getElementsByTagName('link')).forEach(l => {
            if (l.rel === 'stylesheet') l.remove();
          });
        }
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
    };
    html2pdf().from(element).set(opt).save().then(() => {
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      setStep('success');
    });
  };

  const signDateFormatted = signDate
    ? (() => { const [y, m, d] = signDate.split('-'); return `Ngày ${d} tháng ${m} năm ${y}`; })()
    : 'Ngày .......tháng ....... năm …………';

  return (
    <div className="p-6 space-y-6">
      {/* PDF Template (hidden) */}
      <div style={{ position: 'fixed', left: '-10000px', top: 0, pointerEvents: 'none' }}>
        <div ref={pdfTemplateRef} style={{ width: '210mm', fontFamily: '"Times New Roman", Times, serif', fontSize: '11pt', color: '#000000' }}>
          {/* Page 1 */}
          <div style={{ width: '210mm', height: '297mm', boxSizing: 'border-box', backgroundColor: '#ffffff', padding: '15mm 20mm 6mm 20mm', lineHeight: '1.4', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ width: '130px' }}>
                <img src="/matbao-ca-logo.png" alt="MATBAO CA Logo" style={{ width: '130px', height: 'auto', display: 'block' }} referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    const parent = (e.target as HTMLImageElement).parentElement;
                    if (parent && !parent.querySelector('.logo-fallback')) {
                      const fb = document.createElement('div');
                      fb.className = 'logo-fallback'; fb.style.display = 'flex'; fb.style.alignItems = 'center';
                      fb.innerHTML = `<span style="font-weight:bold;font-size:20pt;color:#ed1c24;font-family:Arial,sans-serif;">MATBAO</span><div style="margin:0 4px;width:18px;height:18px;border:3px solid #f7941d;border-radius:50%;"></div><span style="font-weight:bold;font-size:20pt;color:#0054a6;font-family:Arial,sans-serif;">CA</span>`;
                      parent.appendChild(fb);
                    }
                  }} />
              </div>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontWeight: 'bold', fontSize: '10pt', textTransform: 'uppercase', lineHeight: '1.4', whiteSpace: 'nowrap' }}>CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                <div style={{ fontWeight: 'bold', fontSize: '10pt', lineHeight: '1.4' }}>Độc lập - Tự do - Hạnh phúc</div>
              </div>
              <div style={{ width: '130px', textAlign: 'right', fontStyle: 'italic', fontSize: '11pt', fontWeight: 'bold' }}>MB-CA/DK03</div>
            </div>
            <div style={{ width: '100%', height: '0.8pt', backgroundColor: '#000000', marginBottom: '15px' }}></div>
            <div style={{ textAlign: 'center', marginBottom: '15px' }}>
              <h1 style={{ fontSize: '16pt', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px', fontFamily: '"Times New Roman", Times, serif' }}>PHIẾU YÊU CẦU DỊCH VỤ CHỨNG THƯ SỐ MATBAO-CA</h1>
              <div style={{ fontSize: '10pt', fontStyle: 'italic' }}>(Dành cho Tổ chức, doanh nghiệp, Hộ kinh doanh)</div>
            </div>

            {/* Section A */}
            <div style={{ marginBottom: '15px' }}>
              <div style={{ backgroundColor: '#cfe2f3', padding: '6px 10px', border: '0.8pt solid #000000', fontWeight: 'bold', fontSize: '10pt', textTransform: 'uppercase', lineHeight: '1.4' }}>A. THÔNG TIN KHÁCH HÀNG</div>
              <div style={{ display: 'grid', gridTemplateColumns: '18% 32% 18% 32%', borderLeft: '0.8pt solid #000000', borderRight: '0.8pt solid #000000' }}>
                {/* Sub-headers */}
                <div style={{ gridColumn: 'span 2', padding: '6px 8px', fontWeight: 'bold', backgroundColor: '#f3f3f3', borderBottom: '0.8pt solid #000000', borderRight: '0.8pt solid #000000', lineHeight: '1.4' }}>I. Thông tin người Đại diện</div>
                <div style={{ gridColumn: 'span 2', padding: '6px 8px', fontWeight: 'bold', backgroundColor: '#f3f3f3', borderBottom: '0.8pt solid #000000', lineHeight: '1.4' }}>II. Thông tin Tổ chức, doanh nghiệp, Hộ kinh doanh</div>
                {/* Row 1 */}
                <div style={{ padding: '3px 8px 6px 8px', borderBottom: '0.8pt solid #000000', borderRight: '0.8pt solid #000000', fontSize: '9pt', lineHeight: '1.2' }}>Họ và tên*:</div>
                <div style={{ padding: '3px 8px 6px 8px', borderBottom: '0.8pt solid #000000', borderRight: '0.8pt solid #000000', fontWeight: 'bold', fontSize: '10pt', lineHeight: '1.2' }}>{data.individual.fullName}</div>
                <div style={{ padding: '3px 8px 6px 8px', borderBottom: '0.8pt solid #000000', borderRight: '0.8pt solid #000000', fontSize: '9pt', lineHeight: '1.2' }}>Tên giao dịch*:</div>
                <div style={{ padding: '3px 8px 6px 8px', borderBottom: '0.8pt solid #000000', fontWeight: 'bold', fontSize: '10pt', textTransform: 'uppercase', lineHeight: '1.2' }}>{data.organization.name}</div>
                {/* Row 2 */}
                <div style={{ padding: '3px 8px 6px 8px', borderBottom: '0.8pt solid #000000', borderRight: '0.8pt solid #000000', fontSize: '9pt', lineHeight: '1.2' }}>Chức vụ*:</div>
                <div style={{ padding: '3px 8px 6px 8px', borderBottom: '0.8pt solid #000000', borderRight: '0.8pt solid #000000', fontSize: '10pt', lineHeight: '1.2' }}>{data.individual.position}</div>
                <div style={{ padding: '3px 8px 6px 8px', borderBottom: '0.8pt solid #000000', borderRight: '0.8pt solid #000000', fontSize: '8pt', lineHeight: '1.2' }}>Mã số Thuế/Mã đơn vị/Mã ngân sách*:</div>
                <div style={{ padding: '3px 8px 6px 8px', borderBottom: '0.8pt solid #000000', fontWeight: 'bold', fontSize: '10pt', lineHeight: '1.2' }}>{data.organization.taxId}</div>
                {/* Row 3 */}
                <div style={{ padding: '3px 8px 6px 8px', borderBottom: '0.8pt solid #000000', borderRight: '0.8pt solid #000000', fontSize: '9pt', lineHeight: '1.2' }}>Số CCCD/ Hộ chiếu*:</div>
                <div style={{ padding: '3px 8px 6px 8px', borderBottom: '0.8pt solid #000000', borderRight: '0.8pt solid #000000', fontSize: '10pt', lineHeight: '1.2' }}>{data.individual.idNumber}</div>
                <div style={{ padding: '3px 8px 6px 8px', borderBottom: '0.8pt solid #000000', borderRight: '0.8pt solid #000000', fontSize: '8pt', lineHeight: '1.2' }}>Địa chỉ (ghi theo ĐKKD)*:</div>
                <div style={{ padding: '3px 8px 6px 8px', borderBottom: '0.8pt solid #000000', fontSize: '9pt', lineHeight: '1.2' }}>{data.organization.address}</div>
                {/* Row 4 */}
                <div style={{ padding: '3px 8px 6px 8px', borderBottom: '0.8pt solid #000000', borderRight: '0.8pt solid #000000', fontSize: '9pt', lineHeight: '1.2' }}>Số điện thoại*:</div>
                <div style={{ padding: '3px 8px 6px 8px', borderBottom: '0.8pt solid #000000', borderRight: '0.8pt solid #000000', fontSize: '10pt', lineHeight: '1.2' }}>{data.organization.phone}</div>
                <div style={{ padding: '3px 8px 6px 8px', borderBottom: '0.8pt solid #000000', borderRight: '0.8pt solid #000000', fontSize: '9pt', lineHeight: '1.2' }}>Số điện thoại*:</div>
                <div style={{ padding: '3px 8px 6px 8px', borderBottom: '0.8pt solid #000000', fontSize: '10pt', lineHeight: '1.2' }}>{data.organization.phone}</div>
                {/* Row 5 */}
                <div style={{ padding: '3px 8px 6px 8px', borderBottom: '0.8pt solid #000000', borderRight: '0.8pt solid #000000', fontSize: '9pt', lineHeight: '1.2' }}>Email*:</div>
                <div style={{ padding: '3px 8px 6px 8px', borderBottom: '0.8pt solid #000000', borderRight: '0.8pt solid #000000', fontSize: '10pt', color: '#0054a6', lineHeight: '1.2' }}>{data.organization.email}</div>
                <div style={{ padding: '3px 8px 6px 8px', borderBottom: '0.8pt solid #000000', borderRight: '0.8pt solid #000000', fontSize: '9pt', lineHeight: '1.2' }}>Email*:</div>
                <div style={{ padding: '3px 8px 6px 8px', borderBottom: '0.8pt solid #000000', fontSize: '10pt', color: '#0054a6', lineHeight: '1.2' }}>{data.organization.email}</div>
              </div>
            </div>

            {/* Section B */}
            <div style={{ marginBottom: '15px' }}>
              <div style={{ backgroundColor: '#cfe2f3', padding: '6px 10px', border: '0.8pt solid #000000', fontWeight: 'bold', fontSize: '10pt', textTransform: 'uppercase', lineHeight: '1.4' }}>B. THÔNG TIN DỊCH VỤ</div>
              <div style={{ display: 'grid', gridTemplateColumns: '25% 25% 50%', borderLeft: '0.8pt solid #000000', borderRight: '0.8pt solid #000000', borderBottom: '0.8pt solid #000000', backgroundColor: '#f3f3f3' }}>
                <div style={{ padding: '3px 8px 6px 8px', borderRight: '0.8pt solid #000000', fontWeight: 'bold', fontSize: '9pt', display: 'flex', alignItems: 'center', minHeight: '24px' }}>I. Dịch vụ yêu cầu*</div>
                <div style={{ padding: '3px 8px 6px 8px', borderRight: '0.8pt solid #000000', fontWeight: 'bold', fontSize: '9pt', display: 'flex', alignItems: 'center', minHeight: '24px' }}>II. Thời gian cấp mới/gia hạn*</div>
                <div style={{ padding: '3px 8px 6px 8px', fontWeight: 'bold', fontSize: '9pt', display: 'flex', alignItems: 'center', minHeight: '24px' }}>III. Thiết bị sử dụng dịch vụ*</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '25% 25% 50%', borderLeft: '0.8pt solid #000000', borderRight: '0.8pt solid #000000', borderBottom: '0.8pt solid #000000' }}>
                <div style={{ borderRight: '0.8pt solid #000000', padding: '3px 8px 6px 8px', fontSize: '10pt', display: 'flex', alignItems: 'center', minHeight: '24px' }}>{data.service.type}</div>
                <div style={{ borderRight: '0.8pt solid #000000', padding: '3px 8px 6px 8px', fontSize: '10pt', display: 'flex', alignItems: 'center', minHeight: '24px' }}>{data.service.duration}</div>
                <div style={{ padding: '3px 8px 6px 8px', fontSize: '10pt', display: 'flex', alignItems: 'center', minHeight: '24px' }}>{data.service.device}</div>
              </div>
              <div style={{ display: 'flex', borderLeft: '0.8pt solid #000000', borderRight: '0.8pt solid #000000', borderBottom: '0.8pt solid #000000' }}>
                <div style={{ width: '50%', padding: '3px 8px 6px 8px', borderRight: '0.8pt solid #000000', display: 'flex', alignItems: 'center', minHeight: '32px' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '9pt', fontStyle: 'italic', lineHeight: '1.1' }}>IV. Chứng thư được yêu cầu (Đối với khách hàng đã có chứng thư trên hệ thống MATBAO-CA) – Số Serial chứng thư</div>
                </div>
                <div style={{ width: '50%', padding: '3px 8px 6px 8px', fontWeight: 'bold', fontSize: '11pt', color: '#0054a6', display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '1px', minHeight: '32px' }}>{data.service.serialNumber}</div>
              </div>
            </div>

            {/* Section C */}
            <div style={{ marginBottom: '15px' }}>
              <div style={{ fontWeight: 'bold', fontSize: '10pt' }}>C. CAM KẾT:</div>
              <div style={{ fontSize: '10pt', marginTop: '8px', paddingLeft: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '3px' }}>
                  <div style={{ position: 'relative', top: '2px', fontSize: '12pt', marginRight: '6px', lineHeight: '1', flexShrink: 0 }}>☒</div>
                  <div style={{ lineHeight: '1.3' }}>Chúng tôi <b>đồng ý ủy quyền</b> cho Nhà cung cấp sinh cặp khóa,</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '4px' }}>
                  <div style={{ position: 'relative', top: '2px', fontSize: '12pt', marginRight: '6px', lineHeight: '1', flexShrink: 0 }}>☐</div>
                  <div style={{ lineHeight: '1.3' }}>Chúng tôi <b>đồng ý thực hiện</b> sinh cặp khóa,</div>
                </div>
                <div style={{ lineHeight: '1.4', marginTop: '2px', textAlign: 'justify' }}>đồng thời cam kết các thông tin khai trong bản yêu cầu này là đúng sự thật và chịu hoàn toàn trách nhiệm đối với các thông tin này.</div>
                <div style={{ lineHeight: '1.4', marginTop: '4px', textAlign: 'justify' }}>Chúng tôi xác nhận đã đọc, hiểu rõ và cam kết thực hiện các điều khoản tại Quy định chung về dịch vụ được công khai trên website của MATBAO-CA tại địa chỉ <span style={{ color: '#1155CC', textDecoration: 'underline' }}>https://www.matbao.net/thong-tin/chinh-sach-thoa-thuan-chu-ky-so-matbao-ca.html</span>.</div>
              </div>
            </div>

            {/* Signature */}
            <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ width: '55%', textAlign: 'center' }}>
                <div style={{ fontSize: '10pt', fontStyle: 'italic', marginBottom: '15px' }}>{signLocation || '.......................'}, {signDateFormatted}</div>
                <div style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '11pt' }}>KHÁCH HÀNG</div>
                <div style={{ fontSize: '9pt', fontStyle: 'italic', lineHeight: '1.4' }}>(Ký, ghi rõ họ tên Người đại diện Pháp luật/ Người đại diện hợp pháp và đóng dấu)</div>
              </div>
            </div>
            <div style={{ flex: 1 }}></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: '6mm', marginTop: '100px' }}>
              <div style={{ width: '55%', textAlign: 'center', fontWeight: 'bold', fontSize: '11pt' }}>{data.individual.fullName}</div>
            </div>
          </div>

          {/* Page 2 */}
          <div style={{ width: '210mm', height: '297mm', overflow: 'hidden', boxSizing: 'border-box', backgroundColor: '#ffffff', padding: '15mm 20mm', lineHeight: '1.4' }}>
            <div style={{ borderTop: '0.8pt solid #000000', paddingTop: '8px', paddingBottom: '12px', fontSize: '9pt' }}>
              <div>Hồ sơ gồm:</div>
              <div style={{ paddingLeft: '20px' }}>
                <div>o&nbsp;&nbsp;&nbsp;01 Phiếu yêu cầu dịch vụ Chứng thư số</div>
                <div>o&nbsp;&nbsp;&nbsp;01 Bản sao Giấy chứng nhận Đăng ký kinh doanh hoặc tương đương</div>
                <div>o&nbsp;&nbsp;&nbsp;01 Bản sao CMND/CCCD người Đại diện Pháp luật/ Người đại diện hợp pháp</div>
              </div>
              <div style={{ marginTop: '4px' }}>Trường hợp Ủy quyền: 01 Văn bản ủy quyền, 01 Bản sao CMND/CCCD người đại diện theo ủy quyền</div>
            </div>
          </div>
        </div>
      </div>

      {/* Page header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Phiếu DK03</h1>
          <p className="text-sm text-gray-400 mt-0.5">Tạo phiếu yêu cầu dịch vụ chứng thư số MATBAO-CA</p>
        </div>
        <div className="flex items-center gap-2">
          {['upload', 'review', 'success'].map((s) => (
            <div key={s} className={`h-1.5 rounded-full transition-all duration-500 ${s === step ? 'bg-primary w-8' : 'bg-gray-200 w-4'}`} />
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {step === 'upload' && (
          <motion.div key="upload" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { id: 'gpkd', label: 'Quét GPKD', icon: Building2, file: images.gpkd, input: fileInputGpkd, desc: 'Giấy phép kinh doanh (.jpg, .png, .pdf)' },
                { id: 'cccd', label: 'Quét CCCD', icon: User, file: images.cccd, input: fileInputCccd, desc: 'Căn cước công dân (.jpg, .png, .pdf)' },
              ].map((item) => (
                <div key={item.id} onClick={() => item.input.current?.click()}
                  className={`cursor-pointer border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-4 min-h-64 transition-all
                    ${item.file ? 'border-primary/50 bg-primary/5' : 'border-gray-200 hover:border-primary/30 hover:bg-gray-50'}`}>
                  <input type="file" className="hidden" ref={item.input} accept="image/*,application/pdf"
                    onChange={(e) => handleFileUpload(e, item.id as 'gpkd' | 'cccd')} />
                  {item.file ? (
                    <div className="w-full flex flex-col items-center gap-3">
                      <div className="w-full h-48 bg-white rounded-xl overflow-hidden border border-gray-100 flex items-center justify-center">
                        {item.file.startsWith('data:application/pdf')
                          ? <div className="flex flex-col items-center gap-2"><FileText className="w-12 h-12 text-red-400" /><span className="text-xs text-gray-400 font-medium">PDF đã sẵn sàng</span></div>
                          : <img src={item.file} alt={item.label} className="w-full h-full object-contain" />}
                      </div>
                      <div className="flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-wider">
                        <CheckCircle2 className="w-4 h-4" /><span>Đã nhận {item.label}</span>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); setImages(prev => ({ ...prev, [item.id]: '' })); }}
                        className="text-xs text-gray-400 hover:text-red-500 font-semibold">Thay đổi</button>
                    </div>
                  ) : (
                    <>
                      <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center">
                        <item.icon className="w-6 h-6 text-gray-400" />
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-gray-700">{item.label}</p>
                        <p className="text-xs text-gray-400 mt-1">{item.desc}</p>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {error && (
              <div className="flex items-center gap-3 bg-red-50 text-red-700 px-5 py-3 rounded-xl border border-red-100">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">{error}</span>
              </div>
            )}

            <div className="flex justify-center pt-4">
              <button onClick={processImages} disabled={isProcessing || !images.gpkd || !images.cccd}
                className={`px-12 py-4 rounded-xl font-bold text-sm uppercase tracking-wider transition-all
                  ${isProcessing || !images.gpkd || !images.cccd
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/25'}`}>
                {isProcessing
                  ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Đang trích xuất...</span>
                  : 'Bắt đầu trích xuất AI'}
              </button>
            </div>
          </motion.div>
        )}

        {step === 'review' && (
          <motion.div key="review" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Dữ liệu đã nhận diện</h2>
                <p className="text-xs text-gray-400">Mẫu MB-CA/DK03 — Kiểm tra và chỉnh sửa trước khi xuất</p>
              </div>
              <button onClick={() => setStep('upload')} className="p-2 text-gray-400 hover:text-primary transition-colors" title="Làm lại">
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Organization */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
                <p className="text-xs font-black uppercase text-gray-400 tracking-widest border-b border-gray-100 pb-3">II. Thông tin tổ chức</p>
                <div className="grid gap-4">
                  {(() => {
                    const orgField = (label: string, key: keyof typeof data.organization, required = true) => {
                      const val = data.organization[key] || '';
                      const isEmpty = required && !val.trim();
                      return (
                        <div key={key} className="flex flex-col gap-1">
                          <label className={`text-[10px] font-bold uppercase tracking-wider ${isEmpty ? 'text-red-400' : 'text-gray-400'}`}>{label}{required && ' *'}</label>
                          <input type="text" value={val}
                            onChange={(e) => setData(prev => ({ ...prev, organization: { ...prev.organization, [key]: e.target.value } }))}
                            className={`w-full px-4 py-2.5 rounded-xl focus:ring-2 outline-none text-sm font-semibold text-gray-800 border transition-colors
                              ${isEmpty ? 'bg-red-50 border-red-300 focus:border-red-400 focus:ring-red-100' : 'bg-gray-50 border-transparent focus:bg-white focus:border-gray-200 focus:ring-gray-100'}`} />
                        </div>
                      );
                    };
                    return (
                      <>
                        {orgField('Tên Doanh Nghiệp', 'name')}
                        <div className="grid grid-cols-2 gap-4">
                          {orgField('Mã Số Thuế', 'taxId')}
                          {orgField('Ngày Thành Lập', 'foundingDate', false)}
                        </div>
                        {orgField('Địa Chỉ (Theo ĐKKD)', 'address')}
                        <div className="grid grid-cols-2 gap-4">
                          {orgField('Đại Diện Pháp Luật', 'representativeName')}
                          {(() => {
                            const val = data.individual.dob || '';
                            return (
                              <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Ngày Sinh Đại Diện</label>
                                <input type="text" value={val}
                                  onChange={(e) => setData(prev => ({ ...prev, individual: { ...prev.individual, dob: e.target.value } }))}
                                  className="w-full px-4 py-2.5 rounded-xl focus:ring-2 outline-none text-sm font-semibold text-gray-800 border border-transparent bg-gray-50 focus:bg-white focus:border-gray-200 focus:ring-gray-100 transition-colors" />
                              </div>
                            );
                          })()}
                        </div>
                        {orgField('Số CCCD Đại Diện', 'representativeId')}
                        {orgField('Số Điện Thoại', 'phone')}
                        {orgField('Email', 'email')}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Individual */}
              <div className="space-y-6">
                <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
                  <p className="text-xs font-black uppercase text-gray-400 tracking-widest border-b border-gray-100 pb-3">I. Thông tin đại diện</p>
                  <div className="grid gap-4">
                    {[
                      { label: 'Họ và tên', key: 'fullName', parent: 'individual', required: true },
                      { label: 'Chức Vụ', key: 'position', parent: 'individual', required: true },
                      { label: 'Số CCCD/Hộ chiếu', key: 'idNumber', parent: 'individual', required: true },
                    ].map((field) => {
                      const val = (data as any)[field.parent][field.key] || '';
                      const isEmpty = field.required && !val.trim();
                      return (
                        <div key={field.key} className="flex flex-col gap-1">
                          <label className={`text-[10px] font-bold uppercase tracking-wider ${isEmpty ? 'text-red-400' : 'text-gray-400'}`}>{field.label} *</label>
                          <input type="text" value={val}
                            onChange={(e) => setData(prev => ({ ...prev, [field.parent]: { ...(prev as any)[field.parent], [field.key]: e.target.value } }))}
                            className={`w-full px-4 py-2.5 rounded-xl focus:ring-2 outline-none text-sm font-semibold text-gray-800 border transition-colors
                              ${isEmpty ? 'bg-red-50 border-red-300 focus:border-red-400 focus:ring-red-100' : 'bg-gray-50 border-transparent focus:bg-white focus:border-gray-200 focus:ring-gray-100'}`} />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Ký kết */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
                  <p className="text-xs font-black uppercase text-gray-400 tracking-widest border-b border-gray-100 pb-3">IV. Thông tin ký kết</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Nơi ký</label>
                      <input type="text" placeholder="TP. Hồ Chí Minh" value={signLocation} onChange={(e) => setSignLocation(e.target.value)}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-gray-200 outline-none text-sm font-semibold text-gray-800" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Ngày ký</label>
                      <input type="date" value={signDate} onChange={(e) => setSignDate(e.target.value)}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-gray-200 outline-none text-sm font-semibold text-gray-800" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Service */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
              <p className="text-xs font-black uppercase text-gray-400 tracking-widest border-b border-gray-100 pb-3">III. Thông tin dịch vụ</p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Loại dịch vụ*</label>
                  <select value={data.service.type} onChange={(e) => setData(prev => ({ ...prev, service: { ...prev.service, type: e.target.value } }))}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-transparent rounded-xl outline-none text-sm font-semibold text-gray-800">
                    <option>Cấp mới</option><option>Gia hạn</option><option>Thay đổi thông tin</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className={`text-[10px] font-bold uppercase tracking-wider ${!data.service.duration ? 'text-red-400' : 'text-gray-400'}`}>Thời gian *</label>
                  <select value={data.service.duration} onChange={(e) => setData(prev => ({ ...prev, service: { ...prev.service, duration: e.target.value } }))}
                    className={`w-full px-4 py-2.5 rounded-xl outline-none text-sm font-semibold text-gray-800 border transition-colors
                      ${!data.service.duration ? 'bg-red-50 border-red-300' : 'bg-gray-50 border-transparent'}`}>
                    <option value="">Chọn</option><option>1 năm</option><option>2 năm</option><option>3 năm</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Thiết bị*</label>
                  <select value={data.service.device} onChange={(e) => setData(prev => ({ ...prev, service: { ...prev.service, device: e.target.value } }))}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-transparent rounded-xl outline-none text-sm font-semibold text-gray-800">
                    <option>USB Token</option><option>Chữ ký số Tập Trung</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Số Serial (Nếu có)</label>
                  <input type="text" placeholder="Serial chứng thư..." value={data.service.serialNumber || ''} onChange={(e) => setData(prev => ({ ...prev, service: { ...prev.service, serialNumber: e.target.value } }))}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-transparent rounded-xl outline-none text-sm font-semibold text-gray-800" />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-12 bg-red-50 rounded-lg flex items-center justify-center text-red-500 font-bold text-xs">PDF</div>
                <div>
                  <p className="text-sm font-bold text-gray-800">PYC_MATBAO_{data.organization.taxId || 'KYS'}.pdf</p>
                  <p className="text-xs text-gray-400">Mẫu MB-CA/DK03 — 2 trang A4</p>
                </div>
              </div>
              <button onClick={generatePDF} className="flex items-center gap-2 bg-primary text-white px-8 py-3 rounded-xl font-bold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/25">
                <Download className="w-4 h-4" />Xuất PDF
              </button>
            </div>
          </motion.div>
        )}

        {step === 'success' && (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl border border-gray-100 p-16 text-center space-y-8">
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Hồ sơ đã sẵn sàng</h2>
              <p className="text-gray-400 mt-2">Tài liệu đã được tạo theo mẫu MATBAO-CA và tải xuống thành công.</p>
            </div>
            <div className="flex justify-center gap-4 pt-2">
              <button onClick={() => setStep('review')} className="px-8 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200 transition-colors">
                Quay lại chỉnh sửa
              </button>
              <button onClick={() => { setStep('upload'); setImages({ gpkd: '', cccd: '' }); setData(emptyData); setSignLocation('Hồ Chí Minh'); setSignDate(new Date().toISOString().split('T')[0]); }}
                className="px-8 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition-all">
                Hồ sơ mới
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
