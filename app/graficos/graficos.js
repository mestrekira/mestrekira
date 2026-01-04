const API_URL = 'http://localhost:3000';
let chart;

async function loadChart() {
  const studentId = document.getElementById('studentId').value;
  if (!studentId) {
    alert('Informe o Student ID');
    return;
  }

  const res = await fetch(
    `${API_URL}/essays/performance/student?studentId=${studentId}`
  );
  const data = await res.json();

  const labels = data.map((_, i) => `Redação ${i + 1}`);
  const scores = data.map(d => d.score);

  const ctx = document.getElementById('scoreChart').getContext('2d');

  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Nota Total (0–1000)',
        data: scores,
        fill: false,
        tension: 0.2,
      }],
    },
    options: {
      scales: {
        y: {
          min: 0,
          max: 1000,
        },
      },
    },
  });
}
