export enum ClinicianSpecialty {
  CARDIOLOGY = 'Cardiology',
  DERMATOLOGY = 'Dermatology',
  ENDOCRINOLOGY = 'Endocrinology',
  FAMILY_MEDICINE = 'Family Medicine',
  GASTROENTEROLOGY = 'Gastroenterology',
  INTERNAL_MEDICINE = 'Internal Medicine',
  NEUROLOGY = 'Neurology',
  OBSTETRICS_GYNECOLOGY = 'Obstetrics & Gynecology',
  ONCOLOGY = 'Oncology',
  OPHTHALMOLOGY = 'Ophthalmology',
  ORTHOPEDICS = 'Orthopedics',
  PEDIATRICS = 'Pediatrics',
  PSYCHIATRY = 'Psychiatry',
  RADIOLOGY = 'Radiology',
  SURGERY = 'Surgery',
  UROLOGY = 'Urology'
}

export interface ClinicianData {
  clerkId: string;
  name: string;
  email: string;
  specialty: ClinicianSpecialty;
  phoneNumber?: string;
}
