const user = JSON.parse(localStorage.getItem('user'));

async function createRoom() {
  const name = document.getElementById('roomName').value;

  await apiRequest('/rooms', 'POST', {
    name,
    professorId: user.id,
  });

  loadRooms();
}

async function loadRooms() {
  const rooms = await apiRequest(
    `/rooms/by-professor?professorId=${user.id}`,
  );

  const ul = document.getElementById('rooms');
  ul.innerHTML = '';

  rooms.forEach(room => {
    const li = document.createElement('li');
    li.innerText = room.name;
    ul.appendChild(li);
  });
}

loadRooms();
