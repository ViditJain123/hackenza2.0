import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/utils/dbConnet';
import UserQuery from '@/models/userQuerySchema';
import Clinician from '@/models/clinicianSchema';
import twilio from 'twilio';
import { auth } from '@clerk/nextjs/server';

interface QueryFilter {
  status: string;
  doctorCategory?: string;
}

export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clinician = await Clinician.findOne({ clerkId: userId });
    if (!clinician) {
      return NextResponse.json({ error: 'Clinician not found' }, { status: 404 });
    }

    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get('status') || 'not_verified';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    const filter: QueryFilter = { status };

    if (status === 'not_verified') {
      filter.doctorCategory = clinician.specialty;
    }

    const queries = await UserQuery.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await UserQuery.countDocuments(filter);

    return NextResponse.json({
      queries,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching clinician queries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch queries' },
      { status: 500 }
    );
  }
}

// POST: Update query verification status and notify user
export async function POST(req: NextRequest) {
  try {
    await connectDB();

    // Get authenticated user ID from Clerk
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get clinician data
    const clinician = await Clinician.findOne({ clerkId: userId });
    if (!clinician) {
      return NextResponse.json({ error: 'Clinician not found' }, { status: 404 });
    }

    // Ensure the clinician document has the expected MongoDB structure
    if (!clinician._id) {
      return NextResponse.json({ error: 'Invalid clinician data' }, { status: 500 });
    }

    // Parse request body
    const body = await req.json();
    const { queryId, status, doctorComment } = body;

    if (!queryId || !status) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Find and update the query
    const query = await UserQuery.findById(queryId);
    if (!query) {
      return NextResponse.json(
        { error: 'Query not found' },
        { status: 404 }
      );
    }

    // Update query status
    query.status = status;
    query.doctorComment = doctorComment || '';
    query.verifiedBy = clinician._id.toString();
    query.verifiedAt = new Date();
    await query.save();

    // Notify user via Twilio if query is verified
    if (status === 'verified' || status === 'incorrect') {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;

      console.log(accountSid)
      console.log(authToken)

      if (accountSid && authToken) {
        try {
          if (!accountSid || !accountSid.startsWith('AC')) {
            console.error('❌ Invalid Twilio Account SID:', accountSid);
            throw new Error('Invalid Twilio Account SID. Must start with "AC"');
          }

          if (!authToken) {
            console.error('❌ Missing Twilio Auth Token');
            throw new Error('Twilio Auth Token is required');
          }

          console.log('✅ Twilio credentials validated');

          const twilioClient = twilio(accountSid, authToken);

          // Helper function to truncate text to fit the message limit
          const truncateText = (text: string, maxLength: number): string => {
            if (!text) return '';
            return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
          };

          // Set max lengths for different parts of the message to ensure total stays under 1600
          const MAX_QUERY_LENGTH = 100;
          const MAX_RESPONSE_LENGTH = 400;
          const MAX_COMMENT_LENGTH = 300;

          // Truncate long text fields
          const truncatedQuery = truncateText(query.query, MAX_QUERY_LENGTH);
          const truncatedResponse = truncateText(query.response, MAX_RESPONSE_LENGTH);
          const truncatedComment = truncateText(
            doctorComment || (status === 'verified' 
              ? 'The information provided is medically accurate.' 
              : 'Please consult with a healthcare provider for accurate guidance on this matter.'),
            MAX_COMMENT_LENGTH
          );

          let messageTemplate = '';

          if (status === 'verified') {
            messageTemplate =
              `*Healthcare Query Verification*\n\n` +
              `Your question: "${truncatedQuery}"\n\n` +
              `*Status*: ✅ Verified by a ${clinician.specialty} specialist\n\n` +
              `*AI Response*:\n${truncatedResponse}\n\n` +
              `*Doctor's Comment*:\n${truncatedComment}\n\n` +
              `Thank you for using our service. For medical emergencies, always consult a healthcare provider immediately.`;
          } else {
            messageTemplate =
              `*Healthcare Query Verification*\n\n` +
              `Your question: "${truncatedQuery}"\n\n` +
              `*Status*: ⚠️ The AI response requires clarification\n\n` +
              `*AI Response*:\n${truncatedResponse}\n\n` +
              `*Doctor's Correction*:\n${truncatedComment}\n\n` +
              `Thank you for using our service. For medical emergencies, always consult a healthcare provider immediately.`;
          }

          // Check final message length
          if (messageTemplate.length > 1600) {
            console.warn(`⚠️ Message still too long (${messageTemplate.length} chars). Applying additional truncation.`);
            messageTemplate = messageTemplate.substring(0, 1590) + '...';
          }

          const toNumber = query.phoneNumber.startsWith('whatsapp:')
            ? query.phoneNumber
            : `whatsapp:${query.phoneNumber}`;

          console.log(`📤 Attempting to send WhatsApp message to: ${toNumber}`);
          console.log(`📱 Using from number: ${process.env.TWILIO_WHATSAPP_NUMBER}`);

          const message = await twilioClient.messages.create({
            from: process.env.TWILIO_WHATSAPP_NUMBER,
            to: toNumber,
            body: messageTemplate
          });

          console.log(`✅ Notification sent to user ${query.phoneNumber}, SID: ${message.sid}`);
        } catch (error) {
          console.error('❌ Failed to send Twilio notification:', error);

          const twilioError = error as { status?: number; code?: string; moreInfo?: string; details?: unknown };

          console.error('Error details:', JSON.stringify({
            status: twilioError.status,
            code: twilioError.code,
            moreInfo: twilioError.moreInfo,
            details: twilioError.details
          }));
        }
      } else {
        console.warn('⚠️ Twilio credentials not properly configured. Values present:', {
          accountSid: !!accountSid,
          authToken: !!authToken,
          fromNumber: !!process.env.TWILIO_WHATSAPP_NUMBER
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Query updated successfully',
      query
    });

  } catch (error) {
    console.error('Error updating query verification:', error);
    return NextResponse.json(
      { error: 'Failed to update query' },
      { status: 500 }
    );
  }
}
