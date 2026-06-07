import json, urllib.request, time, traceback

email = f"test{int(time.time())}@example.com"
signup_url = 'http://127.0.0.1:8000/api/auth/signup'
subject_url = 'http://127.0.0.1:8000/api/subjects'

payload = {
    'first_name': 'Test',
    'last_name': 'User',
    'email': email,
    'password': 'pass123'
}

try:
    req = urllib.request.Request(signup_url, data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=10) as resp:
        body = resp.read().decode()
        print('SIGNUP', resp.status, body)
        obj = json.loads(body)
        token = obj.get('token')
except Exception as e:
    print('SIGNUP ERROR', e)
    traceback.print_exc()
    raise SystemExit(1)

try:
    subj_payload = {'name': 'Programming', 'description': 'Created by test script'}
    req2 = urllib.request.Request(subject_url, data=json.dumps(subj_payload).encode(), headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token})
    with urllib.request.urlopen(req2, timeout=10) as resp2:
        print('SUBJECT', resp2.status, resp2.read().decode())
except Exception as e:
    print('SUBJECT ERROR', e)
    traceback.print_exc()
