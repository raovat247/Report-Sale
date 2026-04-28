export interface ExtractedData {
  organization: {
    name: string;
    taxId: string;
    foundingDate: string;
    address: string;
    representativeName: string;
    representativeId: string;
    phone: string;
    email: string;
  };
  individual: {
    fullName: string;
    position: string;
    idNumber: string;
    dob: string;
    address: string;
    phone: string;
    email: string;
  };
  service: {
    type: string;
    duration: string;
    device: string;
    serialNumber: string;
  };
}

export const emptyData: ExtractedData = {
  organization: { name: '', taxId: '', foundingDate: '', address: '', representativeName: '', representativeId: '', phone: '', email: '' },
  individual: { fullName: '', position: '', idNumber: '', dob: '', address: '', phone: '', email: '' },
  service: { type: 'Đăng ký', duration: '', device: 'USB Token', serialNumber: '' },
};
