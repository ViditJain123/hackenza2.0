import mongoose, { Document, Schema } from 'mongoose';

interface IUserQuery extends Document {
    phoneNumber: string;
    query: string;
    status: string;
    response: string;
    doctorCategory: string; // New field for doctor category
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
        enum: ['verified', 'not_verified'],
        default: 'not_verified'
    },
    response: {
        type: String,
        required: false
    },
    doctorCategory: { // New field added to schema
        type: String,
        required: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

const UserQuery = mongoose.model<IUserQuery>('UserQuery', userQuerySchema);

export default UserQuery;
