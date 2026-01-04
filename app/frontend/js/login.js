async function login() {
  const id = document.getElementById('id').value;
  const password = document.getElementById('password').value;

  const result = await apiRequest('/users/login', 'POST', {
    id,
    password,
  });

  if (result.error) {
    document.getElementById('error').innerText = result.error;
    return;
  }

  localStorage.setItem('user', JSON.stringify(result));

  if (result.role === 'professor') {
    window.location.href = 'professor.html';
  } else {
    window.location.href = 'estudante.html';
  }
}
