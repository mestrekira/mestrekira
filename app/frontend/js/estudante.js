const user = JSON.parse(localStorage.getItem('user'));

async function enroll() {
  const roomId = document.getElementById('roomId').value;

  await apiRequest('/enrollments', 'POST', {
    studentId: user.id,
    roomId,
  });

  loadRooms();
}

async function loadRooms() {
  const enrollments = await apiRequest(
    `/enrollments/by-student?studentId=${user.id}`,
  );

  const ul = document.getElementById('rooms');
  ul.innerHTML = '';

  enrollments.forEach(e => {
    const li = document.createElement('li');
    li.innerText = `Sala: ${e.roomId}`;
    ul.appendChild(li);
  });
}

loadRooms();
