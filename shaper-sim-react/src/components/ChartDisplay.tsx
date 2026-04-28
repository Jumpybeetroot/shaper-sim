import { useMemo } from 'react';
import type { ReactNode } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import type { ChartOptions, ChartData, Plugin } from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ChartDisplayProps {
  data: ChartData<'line'>;
  options: ChartOptions<'line'>;
  plugins?: Plugin<'line'>[];
  children?: ReactNode;
}

export const ChartDisplay: React.FC<ChartDisplayProps> = ({ data, options, plugins, children }) => {
  const mergedOptions = useMemo(() => {
    return {
      ...options,
      maintainAspectRatio: false,
      responsive: true,
    };
  }, [options]);

  return (
    <div className="chart-container">
      <Line data={data} options={mergedOptions} plugins={plugins} />
      {children}
    </div>
  );
};
