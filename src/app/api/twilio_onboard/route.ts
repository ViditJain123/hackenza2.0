import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import User from '@/models/userSchema';
import connectDB from '@/utils/dbConnet';

export async function POST(req: NextRequest) {
  try {
    // Get Twilio credentials from environment variables
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    
    // Validate Twilio credentials
    if (!accountSid || !accountSid.startsWith('AC')) {
      throw new Error('Invalid Twilio Account SID. Must start with "AC"');
    }
    
    if (!authToken) {
      throw new Error('Twilio Auth Token is required');
    }
    
    // Initialize Twilio client with valid credentials
    const twilioClient = twilio(accountSid, authToken);

    await connectDB();
    
    const formData = await req.formData();
    const body = Object.fromEntries(formData);
    
    const from = body.From as string; // WhatsApp number
    const messageBody = body.Body as string; // Message content
    
    // Check if user exists in the database
    let user = await User.findOne({ phoneNumber: from });
    
    if (messageBody.toLowerCase() === 'hi') {
      if (!user) {
        // Create a new user with initial onboarding status
        user = new User({
          phoneNumber: from,
          onboardingStatus: 'awaiting_name'
        });
        await user.save();
        
        // Ask for name first
        await twilioClient.messages.create({
          from: process.env.TWILIO_WHATSAPP_NUMBER,
          to: from,
          body: 'Hello! What is your name?'
        });
      } else if (user.onboardingStatus === 'completed') {
        // User already completed onboarding
        await twilioClient.messages.create({
          from: process.env.TWILIO_WHATSAPP_NUMBER,
          to: from,
          body: `Welcome back, ${user.userName}! How can I help you today?`
        });
      } else {
        // User exists but onboarding not completed - restart onboarding
        user.onboardingStatus = 'awaiting_name';
        await user.save();
        
        await twilioClient.messages.create({
          from: process.env.TWILIO_WHATSAPP_NUMBER,
          to: from,
          body: 'Let\'s finish your onboarding. What is your name?'
        });
      }
    } else if (user) {
      // Process based on current onboarding status
      if (user.onboardingStatus === 'awaiting_name') {
        // Save the name and ask for age
        user.userName = messageBody.trim();
        user.onboardingStatus = 'awaiting_age';
        await user.save();
        
        await twilioClient.messages.create({
          from: process.env.TWILIO_WHATSAPP_NUMBER,
          to: from,
          body: `Thanks, ${user.userName}! Now, what is your age?`
        });
      } else if (user.onboardingStatus === 'awaiting_age') {
        // Try to parse age
        const age = parseInt(messageBody.trim());
        
        if (isNaN(age)) {
          // Invalid age format
          await twilioClient.messages.create({
            from: process.env.TWILIO_WHATSAPP_NUMBER,
            to: from,
            body: 'Please provide a valid number for your age.'
          });
        } else {
          // Save age and complete onboarding
          user.age = age;
          user.onboardingStatus = 'completed';
          await user.save();
          
          await twilioClient.messages.create({
            from: process.env.TWILIO_WHATSAPP_NUMBER,
            to: from,
            body: `Great! Your profile is complete. We've saved your name (${user.userName}) and age (${user.age}). You can now use our service.`
          });
        }
      } else if (user.onboardingStatus === 'completed') {
        // User has completed onboarding and is sending a regular message
        await twilioClient.messages.create({
          from: process.env.TWILIO_WHATSAPP_NUMBER,
          to: from,
          body: `Hello ${user.userName}! How can I help you today?`
        });
      }
    } else {
      // This should rarely happen - no user record but not saying "hi"
      await twilioClient.messages.create({
        from: process.env.TWILIO_WHATSAPP_NUMBER,
        to: from,
        body: 'Hello! To get started, please send "hi" to begin the registration process.'
      });
    }
    
    return NextResponse.json({ 
      status: 'success',
      message: 'Twilio onboarding successful' 
    });
  } catch (error: unknown) {
    console.error('Twilio onboarding error:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        message: error instanceof Error ? error.message : 'An error occurred' 
      },
      { status: 500 }
    );
  }
}
