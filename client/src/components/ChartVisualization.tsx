import { useState, useRef } from "react";
import { ChartConfig } from "@shared/schema";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  RadialLinearScale,
  Filler,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { Bar, Line, Pie, Doughnut, Scatter, Radar, Bubble } from "react-chartjs-2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Download, 
  Settings2,
  BarChart3,
  LineChart as LineChartIcon,
  PieChart,
  Activity,
  Radar as RadarIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  RadialLinearScale,
  Filler,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels
);

interface ChartVisualizationProps {
  config: ChartConfig;
}

// Color schemes for different themes
const COLOR_SCHEMES = {
  default: [
    "rgba(54, 162, 235, 0.6)",
    "rgba(255, 99, 132, 0.6)",
    "rgba(255, 206, 86, 0.6)",
    "rgba(75, 192, 192, 0.6)",
    "rgba(153, 102, 255, 0.6)",
    "rgba(255, 159, 64, 0.6)",
  ],
  vibrant: [
    "rgba(255, 71, 87, 0.7)",
    "rgba(0, 191, 255, 0.7)",
    "rgba(255, 193, 7, 0.7)",
    "rgba(0, 230, 118, 0.7)",
    "rgba(138, 43, 226, 0.7)",
    "rgba(255, 105, 180, 0.7)",
  ],
  pastel: [
    "rgba(179, 229, 252, 0.7)",
    "rgba(255, 179, 186, 0.7)",
    "rgba(255, 223, 186, 0.7)",
    "rgba(186, 255, 201, 0.7)",
    "rgba(220, 198, 224, 0.7)",
    "rgba(255, 218, 193, 0.7)",
  ],
  monochrome: [
    "rgba(100, 100, 100, 0.6)",
    "rgba(150, 150, 150, 0.6)",
    "rgba(200, 200, 200, 0.6)",
    "rgba(75, 75, 75, 0.6)",
    "rgba(125, 125, 125, 0.6)",
    "rgba(175, 175, 175, 0.6)",
  ],
};

const BORDER_COLOR_SCHEMES = {
  default: [
    "rgba(54, 162, 235, 1)",
    "rgba(255, 99, 132, 1)",
    "rgba(255, 206, 86, 1)",
    "rgba(75, 192, 192, 1)",
    "rgba(153, 102, 255, 1)",
    "rgba(255, 159, 64, 1)",
  ],
  vibrant: [
    "rgba(255, 71, 87, 1)",
    "rgba(0, 191, 255, 1)",
    "rgba(255, 193, 7, 1)",
    "rgba(0, 230, 118, 1)",
    "rgba(138, 43, 226, 1)",
    "rgba(255, 105, 180, 1)",
  ],
  pastel: [
    "rgba(129, 199, 232, 1)",
    "rgba(255, 129, 136, 1)",
    "rgba(255, 173, 136, 1)",
    "rgba(136, 255, 151, 1)",
    "rgba(170, 148, 174, 1)",
    "rgba(255, 168, 143, 1)",
  ],
  monochrome: [
    "rgba(100, 100, 100, 1)",
    "rgba(150, 150, 150, 1)",
    "rgba(200, 200, 200, 1)",
    "rgba(75, 75, 75, 1)",
    "rgba(125, 125, 125, 1)",
    "rgba(175, 175, 175, 1)",
  ],
};

export function ChartVisualization({ config }: ChartVisualizationProps) {
  const chartRef = useRef<any>(null);
  const [currentChartType, setCurrentChartType] = useState(config?.type ?? "bar");
  const [showLegend, setShowLegend] = useState(config?.showLegend ?? false);
  const [colorScheme, setColorScheme] = useState(config?.colorScheme ?? "default");
  
  // Guard against undefined config (after hooks)
  if (!config) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <p>No chart data available</p>
      </div>
    );
  }

  // Check if data is in point format (for scatter/bubble charts)
  const hasPointData = config.datasets.some((dataset) => 
    Array.isArray(dataset.data) && 
    dataset.data.length > 0 && 
    typeof dataset.data[0] === "object" && 
    dataset.data[0] !== null &&
    "x" in dataset.data[0] && 
    "y" in dataset.data[0]
  );
  // Get colors from selected scheme
  const backgroundColors = COLOR_SCHEMES[colorScheme as keyof typeof COLOR_SCHEMES];
  const borderColors = BORDER_COLOR_SCHEMES[colorScheme as keyof typeof BORDER_COLOR_SCHEMES];

  const chartData = {
    labels: config.labels,
    datasets: config.datasets.map((dataset, index) => ({
      ...dataset,
      label: dataset.label || "Value",
      backgroundColor: dataset.backgroundColor || (
        currentChartType === "pie" || currentChartType === "doughnut"
          ? backgroundColors
          : backgroundColors[index % backgroundColors.length]
      ),
      borderColor: dataset.borderColor || (
        currentChartType === "pie" || currentChartType === "doughnut"
          ? borderColors
          : borderColors[index % borderColors.length]
      ),
      borderWidth: dataset.borderWidth || (currentChartType === "pie" || currentChartType === "doughnut" ? 2 : 1),
      fill: currentChartType === "area",
      tension: currentChartType === "area" || currentChartType === "line" ? 0.4 : 0,
    })),
  };

  // Format tooltip value based on format type
  const formatTooltipValue = (value: number) => {
    const tooltipFormat = config.tooltipFormat || "currency";
    
    switch (tooltipFormat) {
      case "percentage":
        return `${value.toFixed(2)}%`;
      case "number":
        return new Intl.NumberFormat("en-US").format(value);
      case "currency":
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 0,
        }).format(value);
      default:
        return value.toString();
    }
  };

  const legendPosition = config.legendPosition || "top";

  const options: any = {
    responsive: true,
    maintainAspectRatio: true,
    layout: {
      padding: {
        bottom: 20,
      },
    },
    plugins: {
      legend: {
        display: showLegend,
        position: legendPosition,
        labels: {
          color: "#374151",
          font: {
            size: 12,
          },
        },
      },
      title: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            let label = context.dataset.label || "";
            if (label) {
              label += ": ";
            }
            const value = context.parsed.y !== undefined ? context.parsed.y : context.parsed;
            if (value !== null && value !== undefined) {
              label += formatTooltipValue(value);
            }
            return label;
          },
        },
      },
      datalabels: {
        display: currentChartType === "pie" || currentChartType === "doughnut",
        color: "#fff",
        font: {
          weight: "bold" as const,
          size: 11,
        },
        formatter: (value: any, context: any) => {
          const label = context.chart.data.labels?.[context.dataIndex];
          if (!label) return "";
          const numValue = Number(value) || 0;
          const dataset = context.chart.data.datasets?.[context.datasetIndex];
          const total = (dataset?.data || []).reduce((s: number, v: any) => s + (Number(v) || 0), 0);
          if (total > 0 && numValue / total < 0.05) return "";
          const labelStr = String(label);
          return labelStr.length > 12 ? labelStr.substring(0, 12) + "\u2026" : labelStr;
        },
        textStrokeColor: "#000",
        textStrokeWidth: 2,
        anchor: "center" as const,
        align: "center" as const,
      },
    },
    scales:
      currentChartType !== "pie" && currentChartType !== "doughnut" && currentChartType !== "radar"
        ? {
            y: {
              beginAtZero: true,
              ticks: {
                color: "#6B7280",
                callback: function (value: any) {
                  return new Intl.NumberFormat("en-US", {
                    notation: "compact",
                    compactDisplay: "short",
                  }).format(value);
                },
              },
              grid: {
                color: "#E5E7EB",
              },
            },
            x: {
              ticks: {
                color: "#6B7280",
                maxRotation: 45,
                minRotation: 45,
                font: {
                  size: 10,
                },
                callback: function(value: any, index: number) {
                  const label = this.getLabelForValue(value);
                  if (typeof label === 'string' && label.length > 15) {
                    return label.substring(0, 15) + '...';
                  }
                  return label;
                },
              },
              grid: {
                color: "#E5E7EB",
              },
            },
          }
        : undefined,
  };

  // Download chart as PNG
  const downloadChart = () => {
    const chart = chartRef.current;
    if (chart) {
      const url = chart.toBase64Image();
      const link = document.createElement("a");
      link.download = `${config.title.replace(/\s+/g, "_")}_chart.png`;
      link.href = url;
      link.click();
    }
  };

  // Render appropriate chart based on type
  const renderChart = () => {
    const chartProps = { ref: chartRef, data: chartData, options };
    
    switch (currentChartType) {
      case "bar":
        return <Bar {...chartProps} />;
      case "line":
        return <Line {...chartProps} />;
      case "area":
        return <Line {...chartProps} />;
      case "pie":
        return (
          <div className="aspect-square max-w-md mx-auto">
            <Pie {...chartProps} />
          </div>
        );
      case "doughnut":
        return (
          <div className="aspect-square max-w-md mx-auto">
            <Doughnut {...chartProps} />
          </div>
        );
      case "scatter":
        return <Scatter {...chartProps} />;
      case "radar":
        return (
          <div className="aspect-square max-w-lg mx-auto">
            <Radar {...chartProps} />
          </div>
        );
      case "bubble":
        return <Bubble {...chartProps} />;
      default:
        return <Bar {...chartProps} />;
    }
  };

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-xl">{config.title}</CardTitle>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" data-testid="button-chart-type">
                <BarChart3 className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Chart Type</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {!hasPointData && (
                <>
                  <DropdownMenuItem onClick={() => setCurrentChartType("bar")} data-testid="menu-item-bar">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Bar Chart
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCurrentChartType("line")} data-testid="menu-item-line">
                    <LineChartIcon className="h-4 w-4 mr-2" />
                    Line Chart
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCurrentChartType("area")} data-testid="menu-item-area">
                    <Activity className="h-4 w-4 mr-2" />
                    Area Chart
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCurrentChartType("pie")} data-testid="menu-item-pie">
                    <PieChart className="h-4 w-4 mr-2" />
                    Pie Chart
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCurrentChartType("doughnut")} data-testid="menu-item-doughnut">
                    <PieChart className="h-4 w-4 mr-2" />
                    Doughnut Chart
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCurrentChartType("radar")} data-testid="menu-item-radar">
                    <RadarIcon className="h-4 w-4 mr-2" />
                    Radar Chart
                  </DropdownMenuItem>
                </>
              )}
              {hasPointData && (
                <>
                  <DropdownMenuItem onClick={() => setCurrentChartType("scatter")} data-testid="menu-item-scatter">
                    <Activity className="h-4 w-4 mr-2" />
                    Scatter Plot
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCurrentChartType("bubble")} data-testid="menu-item-bubble">
                    <Activity className="h-4 w-4 mr-2" />
                    Bubble Chart
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" data-testid="button-chart-settings">
                <Settings2 className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Customization</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowLegend(!showLegend)} data-testid="menu-item-toggle-legend">
                {showLegend ? "Hide" : "Show"} Legend
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Color Scheme</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setColorScheme("default")} data-testid="menu-item-color-default">
                Default
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setColorScheme("vibrant")} data-testid="menu-item-color-vibrant">
                Vibrant
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setColorScheme("pastel")} data-testid="menu-item-color-pastel">
                Pastel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setColorScheme("monochrome")} data-testid="menu-item-color-monochrome">
                Monochrome
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button size="icon" variant="ghost" onClick={downloadChart} data-testid="button-download-chart">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="aspect-video">
          {renderChart()}
        </div>
      </CardContent>
    </Card>
  );
}
