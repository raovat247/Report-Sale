import { GoogleGenAI } from '@google/genai';
import { ExtractedData } from './types';

const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];

function getAI() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY chưa được cấu hình. Liên hệ quản trị viên.');
  return new GoogleGenAI({ apiKey: key });
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function extractDataFromImages(images: { gpkd: string; cccd: string }): Promise<ExtractedData> {
  const prompt = `
    Bạn là một trợ lý ảo chuyên nghiệp trích xuất dữ liệu từ hình ảnh giấy tờ Việt Nam.
    Hãy trích xuất thông tin từ 2 hình ảnh hoặc tệp PDF sau:
    1. Tài liệu GPKD (Giấy phép kinh doanh)
    2. Tài liệu CCCD (Căn cước công dân)

    Yêu cầu trả về kết quả dưới định dạng JSON duy nhất với cấu trúc sau:
    {
      "organization": {
        "name": "Tên công ty đầy đủ",
        "taxId": "Mã số doanh nghiệp",
        "foundingDate": "Ngày thành lập doanh nghiệp (mm/dd/yyyy) từ GPKD",
        "address": "Địa chỉ trụ sở chính",
        "representativeName": "Họ tên người đại diện pháp luật",
        "representativeId": "Số CCCD người đại diện",
        "phone": "Số điện thoại nếu có",
        "email": "Email nếu có"
      },
      "individual": {
        "fullName": "Họ và tên trên CCCD",
        "position": "Chức vụ (thường là Giám đốc nếu là người đại diện)",
        "idNumber": "Số CCCD",
        "dob": "Ngày tháng năm sinh (mm/dd/yyyy) từ CCCD",
        "address": "Nơi thường trú/Địa chỉ trên CCCD",
        "phone": "Số điện thoại (để trống nếu không có)",
        "email": "Email (để trống nếu không có)"
      },
      "service": {
        "type": "Mặc định 'Đăng ký'",
        "duration": "Mặc định ''",
        "device": "Mặc định 'USB Token'"
      }
    }

    Chú ý:
    - Trích xuất chính xác từng ký tự.
    - Nếu thông tin không tìm thấy, để chuỗi rỗng.
    - Chức vụ có thể suy luận từ GPKD hoặc mặc định là 'Giám đốc'.
  `;

  const fileToPart = (base64: string) => {
    const mimeType = base64.substring(base64.indexOf(':') + 1, base64.indexOf(';')) || 'image/jpeg';
    return { inlineData: { data: base64.split(',')[1] || base64, mimeType } };
  };

  const gpkdPart = fileToPart(images.gpkd);
  const cccdPart = fileToPart(images.cccd);

  let lastError: unknown;

  for (const model of MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await getAI().models.generateContent({
          model,
          contents: [{ role: 'user', parts: [{ text: prompt }, gpkdPart, cccdPart] }],
          config: { responseMimeType: 'application/json' },
        });
        const text = response.text;
        if (!text) throw new Error('Không có phản hồi từ AI');
        return JSON.parse(text) as ExtractedData;
      } catch (error: any) {
        lastError = error;
        const status = error?.status ?? error?.error?.code;
        const isRetryable = status === 503 || status === 429 || status === 500;
        if (isRetryable && attempt < 2) { await sleep(3000); continue; }
        break;
      }
    }
  }

  console.error('AI Extraction Error:', lastError);
  throw new Error('Không thể xử lý lúc này. Vui lòng thử lại sau ít giây.');
}
