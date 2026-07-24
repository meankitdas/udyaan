import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from dotenv import load_dotenv

# Load env from local .env
load_dotenv()

MAIL_SERVER = "smtp.zeptomail.in"
MAIL_PORT = 587
MAIL_USERNAME = os.getenv("MAIL_USERNAME")
MAIL_PASSWORD = os.getenv("MAIL_PASSWORD")
MAIL_FROM = "info@udyaan.org"
TO_EMAIL = "arvindkumawat8094@gmail.com" # Using a test email, or user's email if known

def test_send_email():
    print(f"Attempting to send email to {TO_EMAIL}...")
    print(f"Server: {MAIL_SERVER}:{MAIL_PORT}")
    print(f"Username: {MAIL_USERNAME}")
    
    try:
        msg = MIMEMultipart()
        msg['From'] = MAIL_FROM
        msg['To'] = TO_EMAIL
        msg['Subject'] = "Udyaan Email Test"
        msg.attach(MIMEText("This is a test email to verify SMTP settings.", 'plain'))

        server = smtplib.SMTP(MAIL_SERVER, MAIL_PORT)
        server.set_debuglevel(1) # Enable debug output
        server.starttls()
        server.login(MAIL_USERNAME, MAIL_PASSWORD)
        server.sendmail(MAIL_FROM, TO_EMAIL, msg.as_string())
        server.quit()
        print("SUCCESS: Email sent successfully!")
    except Exception as e:
        print(f"FAILED: {e}")

if __name__ == "__main__":
    test_send_email()
