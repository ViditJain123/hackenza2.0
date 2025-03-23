import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import User from '@/models/userSchema';
import UserQuery from '@/models/userQuerySchema';
import connectDB from '@/utils/dbConnet';
import OpenAI from 'openai';

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
    
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

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
        // User has completed onboarding and is sending a health query
        console.log('💬 Processing health query from user:', user.userName);
        
        try {
          // Save the query to database
          const userQuery = new UserQuery({
            phoneNumber: from,
            query: messageBody,
            status: 'not_verified'
          });
          
          // Process query with OpenAI
          console.log('🤖 Sending to GPT-4o:', messageBody);
          const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content: "You are a helpful AI assistant that provides medical information. Always be professional and compassionate. Remember you're not a doctor, so always include a disclaimer. Keep responses under 250 words."
              },
              {
                role: "user",
                content: messageBody
              }
            ],
            max_tokens: 500,
          });
          
          // Extract the response
          const aiResponse = completion.choices[0].message.content;
          console.log('🤖 AI response received:', aiResponse);
          
          // Add disclaimer and save response
          const fullResponse = `${aiResponse}\n\n*This response is not yet verified by the doctor.*`;
          userQuery.response = fullResponse;
          await userQuery.save();
          
          // Send response to user
          const message = await twilioClient.messages.create({
            from: process.env.TWILIO_WHATSAPP_NUMBER,
            to: from,
            body: fullResponse
          });
          console.log('✅ Message sent:', message.sid);
        } catch (aiError) {
          console.error('❌ AI processing error:', aiError);
          const message = await twilioClient.messages.create({
            from: process.env.TWILIO_WHATSAPP_NUMBER,
            to: from,
            body: "I'm sorry, I couldn't process your health query at the moment. Please try again later."
          });
          console.log('✅ Error message sent:', message.sid);
        }
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
