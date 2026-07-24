import urllib.request
import json
import sys

# The hosted URL from frontend .env.production
HOSTED_URL = "https://dqfmykxohfjc3ur5eoi4uvkfly0ghmip.lambda-url.ap-south-1.on.aws/"

def check_health():
    print(f"Checking health of hosted API: {HOSTED_URL}")
    try:
        with urllib.request.urlopen(HOSTED_URL) as response:
            status_code = response.getcode()
            content = response.read().decode('utf-8')
            data = json.loads(content)
            
            print(f"Status Code: {status_code}")
            print(f"Response: {data}")
            
            if status_code == 200 and data.get("status") == "healthy":
                print("HOSTED BACKEND IS ONLINE AND HEALTHY!")
            else:
                print("HOSTED BACKEND RETURNED UNEXPECTED RESPONSE.")
    except Exception as e:
        print(f"FAILED TO CONNECT TO HOSTED BACKEND: {e}")

if __name__ == "__main__":
    check_health()
