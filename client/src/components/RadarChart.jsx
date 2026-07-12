import { Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const LABELS = ['论点', '表达', '驳论', '结构', '论据', '流利度'];

export default function RadarChart({ scores, size = 280 }) {
  const data = {
    labels: LABELS,
    datasets: [
      {
        data: [
          scores.argument_score,
          scores.delivery_score,
          scores.rebuttal_score,
          scores.structure_score,
          scores.evidence_score,
          scores.fluency_score,
        ],
        backgroundColor: 'rgba(164, 185, 181, 0.2)',
        borderColor: '#a4b9b5',
        borderWidth: 2,
        pointBackgroundColor: '#7d9b96',
        pointBorderColor: '#ebdfcb',
        pointHoverBackgroundColor: '#2C2416',
        pointHoverBorderColor: '#a4b9b5',
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.parsed.r} 分`,
        },
        backgroundColor: '#2C2416',
        titleColor: '#ebdfcb',
        bodyColor: '#a4b9b5',
      },
    },
    scales: {
      r: {
        min: 0,
        max: 10,
        ticks: {
          stepSize: 2,
          font: { size: 10, family: '"Noto Sans SC", system-ui' },
          color: '#9a8570',
          backdropColor: 'transparent',
        },
        grid: { color: '#c8b89a' },
        angleLines: { color: '#c8b89a' },
        pointLabels: {
          font: { size: 13, weight: '500', family: '"Noto Sans SC", system-ui' },
          color: '#2C2416',
        },
      },
    },
  };

  return (
    <div style={{ width: size, height: size, margin: '0 auto' }}>
      <Radar data={data} options={options} />
    </div>
  );
}
