// TEMPORÁRIO
const ROOM_ID = 'ROOM_ID_AQUI';

async function carregarRedacoes() {
  const redacoes = await apiRequest(
    `/essays/by-room?roomId=${ROOM_ID}`,
  );

  const ul = document.getElementById('lista');
  ul.innerHTML = '';

  redacoes.forEach(r => {
    const li = document.createElement('li');

    const btn = document.createElement('button');
    btn.innerText = 'Corrigir';
    btn.onclick = () => {
      localStorage.setItem('essay_corrigir', JSON.stringify(r));
      window.location.href = 'corrigir.html';
    };

    li.innerText = `Aluno: ${r.studentId} `;
    li.appendChild(btn);
    ul.appendChild(li);
  });
}

carregarRedacoes();
