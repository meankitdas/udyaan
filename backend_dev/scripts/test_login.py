import requests

url = "http://localhost:8000/auth/login"
payload = {
    "username": "superadmin@example.com",
    "password": "password123"
}
headers = {
    "Content-Type": "application/x-www-form-urlencoded"
}

try:
    response = requests.post(url, data=payload, headers=headers)
    print(f"Status Code: {response.status_code}")
    try:
        data = response.json()
        print(f"Debug Info: {data.get('debug_info')}")
        print(f"Role Key: {data.get('role_key')}")
    except:
        print(f"Response Body: {response.text}")
except Exception as e:
    print(f"Error: {e}")
