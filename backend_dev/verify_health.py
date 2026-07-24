import urllib.request
import json
import sys

try:
    with urllib.request.urlopen("http://127.0.0.1:8000/") as response:
        status_code = response.getcode()
        content = response.read().decode('utf-8')
        data = json.loads(content)
        
        print(f"Status Code: {status_code}")
        print(f"Response: {data}")
        
        if status_code == 200 and data.get("status") == "healthy":
            print("Backend is working correctly!")
        else:
            print("Backend returned unexpected response.")
            sys.exit(1)
except Exception as e:
    print(f"Failed to connect to backend: {e}")
    sys.exit(1)
