import mongoose, { Document, Schema } from 'mongoose';

interface IUserQuery extends Document {
    phoneNumber: string;
    query: string;
    status: string;
    response: string;
    doctorCategory: string;
    doctorComment?: string; // New field for doctor's comments
    verifiedBy?: string; // Reference to clinician who verified
    verifiedAt?: Date; // When the verification happened
    createdAt: Date;
}

const userQuerySchema = new Schema<IUserQuery>({
    phoneNumber: {
        type: String,
        required: true
    },
    query: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['verified', 'not_verified', 'incorrect'],
        default: 'not_verified'
    },
    response: {
        type: String,
        required: false
    },
    doctorCategory: {
        type: String,
        required: false
    },
    doctorComment: {
        type: String,
        required: false
    },
    verifiedBy: {
        type: Schema.Types.ObjectId,
        ref: 'Clinician',
        required: false
    },
    verifiedAt: {
        type: Date,
        required: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Prevent model overwrite by checking if model already exists
const UserQuery = mongoose.models.UserQuery || mongoose.model<IUserQuery>('UserQuery', userQuerySchema);

export default UserQuery;
