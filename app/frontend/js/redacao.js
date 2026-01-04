const user = JSON.parse(localStorage.getItem('user'));
const editor = document.getElementById('editor');

let textoSalvo = '';

// ❌ Bloquear colar
editor.addEventListener('paste', e => {
  e.preventDefault();
  alert('Colar texto não é permitido.');
});

// Salvar localmente
function salvar() {
  textoSalvo = editor.value;
  localStorage.setItem('redacao_temp', textoSalvo);
  document.getElementById('status').innerText = 'Redação salva.';
}

// Enviar para backend
async function enviar() {
  const content = editor.value;

  if (content.length < 50) {
    alert('Redação muito curta.');
    return;
  }

  await apiRequest('/essays', 'POST', {
    roomId: 'ROOM_ID_AQUI',
    studentId: user.id,
    content,
  });

  document.getElementById('status').innerText =
    'Redação enviada para correção.';
}

// Restaurar texto salvo
const salvo = localStorage.getItem('redacao_temp');
if (salvo) {
  editor.value = salvo;
}
