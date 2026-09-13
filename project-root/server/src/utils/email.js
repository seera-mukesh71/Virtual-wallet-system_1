import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

export async function sendOtpEmail(toEmail, otp) {
  // Development mode: print OTP in backend terminal
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[DEV MODE] OTP for ${toEmail}: ${otp}`);
    return;
  }

  // Production mode: send OTP through email
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: toEmail,
    subject: 'Your Wallet App Verification Code',
    text: `Your OTP is ${otp}. It expires in 10 minutes.`
  });
}