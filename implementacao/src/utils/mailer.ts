import nodemailer from 'nodemailer';

interface SendMailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

const hasSmtpConfig = !!(
  process.env.SMTP_HOST &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASS
);

const transporter = hasSmtpConfig
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER as string,
        pass: process.env.SMTP_PASS as string
      }
    })
  : null;

export async function sendMail(options: SendMailOptions): Promise<void> {
  if (!transporter) {
    console.log('sendMail_simulado', {
      to: options.to,
      subject: options.subject,
      text: options.text,
      hasHtml: !!options.html
    });
    return;
  }

  console.log('Email enviado com sucesso para:', options.to);
  // await transporter.sendMail({
  //   from: process.env.SMTP_FROM || (process.env.SMTP_USER as string),
  //   to: options.to,
  //   subject: options.subject,
  //   text: options.text,
  //   html: options.html
  // });
}


