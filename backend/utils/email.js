const nodemailer = require('nodemailer');

// Create transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Send reminder email
const sendReminderEmail = async (to, countyName, taskName, deadline) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to,
      subject: `${countyName} Task Reminder`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">Task Reminder</h2>
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 10px 0;"><strong style="color: #374151;">Task Name:</strong> <span style="color: #111827;">${taskName}</span></p>
            <p style="margin: 10px 0;"><strong style="color: #374151;">Deadline:</strong> <span style="color: #111827;">${new Date(deadline).toLocaleString()}</span></p>
            <p style="margin: 10px 0;"><strong style="color: #374151;">County:</strong> <span style="color: #111827;">${countyName}</span></p>
          </div>
          <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">This is an automated reminder from CiviSight - Association of County Commissioners of Georgia.</p>
        </div>
      `,
      text: `Task Reminder\n\nTask Name: ${taskName}\nDeadline: ${new Date(deadline).toLocaleString()}\nCounty: ${countyName}\n\nThis is an automated reminder from CiviSight.`
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Reminder email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending reminder email:', error);
    throw error;
  }
};

// Send task assignment email
const sendTaskAssignmentEmail = async (to, countyName, taskName, deadline, assignedBy) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to,
      subject: `New Task Assigned: ${taskName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">New Task Assigned</h2>
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 10px 0;"><strong style="color: #374151;">Task Name:</strong> <span style="color: #111827;">${taskName}</span></p>
            <p style="margin: 10px 0;"><strong style="color: #374151;">County:</strong> <span style="color: #111827;">${countyName}</span></p>
            <p style="margin: 10px 0;"><strong style="color: #374151;">Deadline:</strong> <span style="color: #111827;">${new Date(deadline).toLocaleString()}</span></p>
            <p style="margin: 10px 0;"><strong style="color: #374151;">Assigned By:</strong> <span style="color: #111827;">${assignedBy}</span></p>
          </div>
          <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">Please log in to CiviSight to view task details and download required forms.</p>
        </div>
      `,
      text: `New Task Assigned\n\nTask Name: ${taskName}\nCounty: ${countyName}\nDeadline: ${new Date(deadline).toLocaleString()}\nAssigned By: ${assignedBy}\n\nPlease log in to CiviSight to view task details.`
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Task assignment email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending task assignment email:', error);
    throw error;
  }
};

// Send form upload notification email
const sendFormUploadEmail = async (to, countyName, taskName, formName) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to,
      subject: `Form Available: ${taskName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">Form Available for Download</h2>
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 10px 0;"><strong style="color: #374151;">Task Name:</strong> <span style="color: #111827;">${taskName}</span></p>
            <p style="margin: 10px 0;"><strong style="color: #374151;">County:</strong> <span style="color: #111827;">${countyName}</span></p>
            <p style="margin: 10px 0;"><strong style="color: #374151;">Form:</strong> <span style="color: #111827;">${formName}</span></p>
          </div>
          <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">Please log in to CiviSight to download the form and submit your completed version.</p>
        </div>
      `,
      text: `Form Available for Download\n\nTask Name: ${taskName}\nCounty: ${countyName}\nForm: ${formName}\n\nPlease log in to CiviSight to download the form.`
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Form upload notification email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending form upload email:', error);
    throw error;
  }
};

module.exports = {
  sendReminderEmail,
  sendTaskAssignmentEmail,
  sendFormUploadEmail
};

