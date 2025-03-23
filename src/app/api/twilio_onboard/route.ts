import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import User from '@/models/userSchema';
import connectDB from '@/utils/dbConnet';

export async function POST(req: NextRequest) {
  console.log('📞 Twilio onboarding route called');
  try {
    // Get Twilio credentials from environment variables
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (!accountSid || !accountSid.startsWith('AC')) {
      console.error('❌ Invalid Twilio Account SID:', accountSid);
      throw new Error('Invalid Twilio Account SID. Must start with "AC"');
    }
    
    if (!authToken) {
      console.error('❌ Missing Twilio Auth Token');
      throw new Error('Twilio Auth Token is required');
    }
    
    console.log('✅ Twilio credentials validated');
    // Initialize Twilio client with valid credentials
    const twilioClient = twilio(accountSid, authToken);

    console.log('🔄 Connecting to database...');
    await connectDB();
    console.log('✅ Database connected successfully');
    
    // Parse form data after successful DB connection
    console.log('📄 Parsing form data...');
    const formData = await req.formData();
    const body = Object.fromEntries(formData);
    
    const from = body.From as string; // WhatsApp number
    const messageBody = body.Body as string; // Message content
    
    console.log('📩 Received message:', { from, body: messageBody });
    
    // Check if user exists in the database
    let user = await User.findOne({ phoneNumber: from });
    console.log('👤 User lookup result:', user ? `Found user: ${user.userName || 'unnamed'}` : 'User not found');
    
    if (messageBody.toLowerCase() === 'hi') {
      if (!user) {
        // Create a new user with initial onboarding status
        console.log('➕ Creating new user for:', from);
        user = new User({
          phoneNumber: from,
          onboardingStatus: 'awaiting_name'
        });
        await user.save();
        console.log('✅ New user created');
        
        // Ask for name first
        console.log('📤 Sending name request message');
        const message = await twilioClient.messages.create({
          from: process.env.TWILIO_WHATSAPP_NUMBER,
          to: from,
          body: 'Hello! What is your name?'
        });
        console.log('✅ Message sent:', message.sid);
      } else if (user.onboardingStatus === 'completed') {
        // User already completed onboarding
        console.log('👋 Welcoming returning user:', user.userName);
        const message = await twilioClient.messages.create({
          from: process.env.TWILIO_WHATSAPP_NUMBER,
          to: from,
          body: `Welcome back, ${user.userName}! How can I help you today?`
        });
        console.log('✅ Message sent:', message.sid);
      } else {
        // User exists but onboarding not completed - restart onboarding
        console.log('🔄 Restarting onboarding for user:', from);
        user.onboardingStatus = 'awaiting_name';
        await user.save();
        
        console.log('📤 Sending onboarding continuation message');
        const message = await twilioClient.messages.create({
          from: process.env.TWILIO_WHATSAPP_NUMBER,
          to: from,
          body: 'Let\'s finish your onboarding. What is your name?'
        });
        console.log('✅ Message sent:', message.sid);
      }
    } else if (user) {
      // Process based on current onboarding status
      if (user.onboardingStatus === 'awaiting_name') {
        // Save the name and ask for age
        console.log('✏️ Saving user name:', messageBody.trim());
        user.userName = messageBody.trim();
        user.onboardingStatus = 'awaiting_age';
        await user.save();
        
        console.log('📤 Sending age request message');
        const message = await twilioClient.messages.create({
          from: process.env.TWILIO_WHATSAPP_NUMBER,
          to: from,
          body: `Thanks, ${user.userName}! Now, what is your age?`
        });
        console.log('✅ Message sent:', message.sid);
      } else if (user.onboardingStatus === 'awaiting_age') {
        // Try to parse age
        const age = parseInt(messageBody.trim());
        console.log('🔢 Parsing age:', messageBody.trim(), '→', age);
        
        if (isNaN(age)) {
          // Invalid age format
          console.log('⚠️ Invalid age format received');
          const message = await twilioClient.messages.create({
            from: process.env.TWILIO_WHATSAPP_NUMBER,
            to: from,
            body: 'Please provide a valid number for your age.'
          });
          console.log('✅ Message sent:', message.sid);
        } else {
          // Save age and complete onboarding
          console.log('✅ Completing onboarding, age:', age);
          user.age = age;
          user.onboardingStatus = 'completed';
          await user.save();
          
          console.log('📤 Sending completion message');
          const message = await twilioClient.messages.create({
            from: process.env.TWILIO_WHATSAPP_NUMBER,
            to: from,
            body: `Great! Your profile is complete. We've saved your name (${user.userName}) and age (${user.age}). You can now use our service.`
          });
          console.log('✅ Message sent:', message.sid);
        }
      } else if (user.onboardingStatus === 'completed') {
        // User has completed onboarding and is sending a regular message
        console.log('💬 Handling regular message from completed user:', user.userName);
        const message = await twilioClient.messages.create({
          from: process.env.TWILIO_WHATSAPP_NUMBER,
          to: from,
          body: `Hello ${user.userName}! How can I help you today?`
        });
        console.log('✅ Message sent:', message.sid);
      }
    } else {
      // This should rarely happen - no user record but not saying "hi"
      console.log('⚠️ New user not starting with "hi":', from);
      const message = await twilioClient.messages.create({
        from: process.env.TWILIO_WHATSAPP_NUMBER,
        to: from,
        body: 'Hello! To get started, please send "hi" to begin the registration process.'
      });
      console.log('✅ Message sent:', message.sid);
    }
    
    console.log('🎉 Twilio onboarding process completed successfully');
    return NextResponse.json({ 
      status: 'success',
      message: 'Twilio onboarding successful' 
    });
  } catch (error: unknown) {
    console.error('❌ Twilio onboarding error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    } else {
      console.error('Unknown error type:', typeof error);
    }
    return NextResponse.json(
      { 
        status: 'error', 
        message: error instanceof Error ? error.message : 'An error occurred' 
      },
      { status: 500 }
    );
  }
}
