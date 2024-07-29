const nodemailer = require('nodemailer');
const { convert } = require('html-to-text');
const dotenv = require('dotenv');
dotenv.config({ path: './.env' });
module.exports = class Email {
  constructor(user, verificationCode) {
    this.to = user.email;
    this.name = user.firstName;
    this.verificationCode = verificationCode;
    this.from = `Smart Way <${process.env.EMAIL_FROM}>`;
  }

  newTransport() {
    
    
    return nodemailer.createTransport({
      service: 'gmail',
      type: 'SMTP',
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_FROM,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  async send(text, subject) {
    const mailOptions = {
      from: this.from,
      to: this.to,
      subject,
      html: text,
      text
    };

    await this.newTransport().sendMail(mailOptions);
  }

  async sendVerificationEmail() {
    const options = {
      wordwrap: 130,
    };
    const subject = 'Email Verification';
    const content = `<p>Hello ${this.name},</p><p>Your verification code is: ${this.verificationCode}</p>`;
    await this.send(content, subject);
  }

  async sendForgotPassword() {
    const options = {
      wordwrap: 130,
    };
    const subject = 'Password Reset';
    const content = `<p>Hello ${this.name},</p><p>Your verification code is: ${this.verificationCode}</p>`;
    const text = convert(content, options);
    await this.send(content, subject);
  }
};
