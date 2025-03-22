// /components/FileTypeChart.tsx
import React from "react";
import { Box, Typography } from "@mui/material";
import { Pie } from "react-chartjs-2";
import { FileMeta } from "./FileList";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

// Register Chart.js components.
ChartJS.register(ArcElement, Tooltip, Legend);

// Fixed color mapping for common file types.
const defaultColor = "#607D8B";
const colorMapping: { [key: string]: string } = {
  pdf: "#F44336",
  doc: "#2196F3",
  docx: "#2196F3",
  xls: "#4CAF50",
  xlsx: "#4CAF50",
  png: "#FF9800",
  jpg: "#9C27B0",
  jpeg: "#9C27B0",
  mp4: "#3F51B5",
  mp3: "#009688",
  txt: "#795548",
};

interface FileTypeChartProps {
  files: FileMeta[];
}

const FileTypeChart: React.FC<FileTypeChartProps> = ({ files }) => {
  // Count file types.
  const typeCounts: { [key: string]: number } = {};
  files.forEach((file) => {
    const ext = file.originalName.split(".").pop()?.toLowerCase() || "unknown";
    typeCounts[ext] = (typeCounts[ext] || 0) + 1;
  });
  const labels = Object.keys(typeCounts);
  const dataValues = Object.values(typeCounts);
  const backgroundColors = labels.map(
    (ext) => colorMapping[ext] || defaultColor
  );

  const data = {
    labels,
    datasets: [
      {
        data: dataValues,
        backgroundColor: backgroundColors,
      },
    ],
  };

  // Chart options for a small, concise graph.
  const options = {
    plugins: {
      legend: {
        display: true,
        position: "right" as const,
        labels: {
          generateLabels: (chart: any) => {
            const dataset = chart.data.datasets[0];
            return chart.data.labels.map((label: string, i: number) => ({
              text: `${label}: ${dataset.data[i]}`,
              fillStyle: dataset.backgroundColor[i],
              strokeStyle: dataset.backgroundColor[i],
              index: i,
            }));
          },
        },
      },
    },
    maintainAspectRatio: false,
  };

  return (
    <Box sx={{ mt: 4, width: 300, height: 300 }}>
      <Typography variant="h6" gutterBottom>
        File Types
      </Typography>
      <Pie data={data} options={options} />
    </Box>
  );
};

export default FileTypeChart;
