from app.config import settings
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def send_email(to_email: str, subject: str, body: str, html_content: str = None):
    try:
        msg = MIMEMultipart("alternative")
        msg['From'] = f"Udyaan Pvt Ltd <{settings.MAIL_FROM}>"
        msg['To'] = to_email
        msg['Subject'] = subject

        # Attach plain text version
        msg.attach(MIMEText(body, 'plain'))
        
        # Attach HTML version if provided
        if html_content:
            msg.attach(MIMEText(html_content, 'html'))

        server = smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT)
        server.starttls()
        server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
        text = msg.as_string()
        server.sendmail(settings.MAIL_FROM, to_email, text)
        server.quit()
        print(f"DEBUG: Email sent to {to_email}")
        return True
    except Exception as e:
        print(f"FAILED TO SEND EMAIL: {e}")
        return False
