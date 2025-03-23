import mongoose, { Schema, Document } from 'mongoose';
import { ClinicianSpecialty } from '@/types/clinician';

export interface Clinician extends Document {
  clerkId: string;
  name: string;
  email: string;
  specialty: ClinicianSpecialty;
  phoneNumber?: string;
  isOnboarded?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const clinicianSchema = new Schema<Clinician>(
  {
    clerkId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    specialty: { 
      type: String, 
      required: true,
      enum: Object.values(ClinicianSpecialty)
    },
    phoneNumber: { type: String }
  },
  { timestamps: true }
);

// Only create the model on the server side
const Clinician = (mongoose.models?.Clinician || 
  (typeof window === 'undefined' ? mongoose.model<Clinician>('Clinician', clinicianSchema) : null)) as 
  mongoose.Model<Clinician>;

export { ClinicianSpecialty };
export default Clinician;
