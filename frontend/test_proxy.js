(async () => {
  const loginRes = await fetch('http://127.0.0.1:8000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'HavenStay123!' })
  });
  const loginData = await loginRes.json();
  console.log('Login:', loginData.token ? 'Success' : loginData);

  const meRes = await fetch('http://127.0.0.1:3000/api/auth/me', {
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + loginData.token }
  });
  const meData = await meRes.text();
  console.log('Me via proxy:', meRes.status, meData);
})();
