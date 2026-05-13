import nodemailer from "nodemailer";

const transport = nodemailer.createTransport({
  host: process.env.LOADCLASS_SMTP_HOST ?? "localhost",
  port: Number(process.env.LOADCLASS_SMTP_PORT ?? 1025),
  secure: Number(process.env.LOADCLASS_SMTP_PORT ?? 1025) === 465,
  auth:
    process.env.LOADCLASS_SMTP_USER
      ? { user: process.env.LOADCLASS_SMTP_USER, pass: process.env.LOADCLASS_SMTP_PASS }
      : undefined,
});

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  await transport.sendMail({
    from: process.env.LOADCLASS_EMAIL_FROM ?? "loadclass <noreply@example.invalid>",
    to,
    subject,
    html,
  });
}
