import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const BLOOM_COLORS = {
  Remembering: "#3b82f6",
  Understanding: "#06b6d4",
  Applying: "#22c55e",
  Analyzing: "#eab308",
  Evaluating: "#f97316",
  Creating: "#a855f7",
};

const BLOOM_ORDER = [
  "Remembering",
  "Understanding",
  "Applying",
  "Analyzing",
  "Evaluating",
  "Creating",
];

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-white px-3 py-2 rounded-lg shadow-lg border border-gray-200 text-sm">
        <p className="font-semibold text-gray-800">{data.name}</p>
        <p className="text-gray-600">
          {data.value} question{data.value !== 1 ? "s" : ""}
        </p>
      </div>
    );
  }
  return null;
};

const CustomPieLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
  name,
}) => {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      className="text-xs font-bold"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

/**
 * Bloom's Distribution Donut Chart
 */
export const BloomsDistributionChart = ({ distribution, size = "md" }) => {
  const data = BLOOM_ORDER.filter((level) => (distribution[level] || 0) > 0).map(
    (level) => ({
      name: level,
      value: distribution[level] || 0,
    }),
  );

  if (data.length === 0) return null;

  const dimensions = {
    sm: { width: 240, height: 200, outer: 75, inner: 40 },
    md: { width: 320, height: 260, outer: 100, inner: 55 },
    lg: { width: 400, height: 320, outer: 130, inner: 70 },
  };
  const dim = dimensions[size] || dimensions.md;

  return (
    <div className="flex flex-col items-center">
      <ResponsiveContainer width="100%" height={dim.height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={CustomPieLabel}
            outerRadius={dim.outer}
            innerRadius={dim.inner}
            dataKey="value"
            strokeWidth={2}
            stroke="#fff"
          >
            {data.map((entry) => (
              <Cell
                key={entry.name}
                fill={BLOOM_COLORS[entry.name]}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
        {data.map((entry) => (
          <div key={entry.name} className="flex items-center gap-1.5 text-xs">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: BLOOM_COLORS[entry.name] }}
            />
            <span className="text-gray-600">{entry.name}</span>
            <span className="font-bold text-gray-800">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * LOTS vs HOTS Horizontal Comparison Bar
 */
export const LotsHotsBar = ({ lotsCount, hotsCount, lotsPercentage, hotsPercentage }) => {
  const total = lotsCount + hotsCount;
  if (total === 0) return null;

  const lotsPct = lotsPercentage ?? Math.round((lotsCount / total) * 100);
  const hotsPct = hotsPercentage ?? Math.round((hotsCount / total) * 100);

  return (
    <div className="w-full">
      <div className="flex justify-between text-sm font-semibold mb-2">
        <span className="text-emerald-600">
          LOTS ({lotsCount}) - {lotsPct}%
        </span>
        <span className="text-amber-600">
          HOTS ({hotsCount}) - {hotsPct}%
        </span>
      </div>
      <div className="flex h-8 rounded-full overflow-hidden shadow-inner bg-gray-100">
        {lotsPct > 0 && (
          <div
            className="bg-gradient-to-r from-emerald-400 to-emerald-500 flex items-center justify-center transition-all duration-500"
            style={{ width: `${lotsPct}%` }}
          >
            {lotsPct >= 15 && (
              <span className="text-white text-xs font-bold">{lotsPct}%</span>
            )}
          </div>
        )}
        {hotsPct > 0 && (
          <div
            className="bg-gradient-to-r from-amber-400 to-amber-500 flex items-center justify-center transition-all duration-500"
            style={{ width: `${hotsPct}%` }}
          >
            {hotsPct >= 15 && (
              <span className="text-white text-xs font-bold">{hotsPct}%</span>
            )}
          </div>
        )}
      </div>
      <div className="flex justify-between text-[10px] text-gray-400 mt-1">
        <span>Remembering, Understanding, Applying</span>
        <span>Analyzing, Evaluating, Creating</span>
      </div>
    </div>
  );
};

/**
 * Bloom's Taxonomy Pyramid
 */
export const BloomsPyramid = ({ distribution }) => {
  const levels = [...BLOOM_ORDER].reverse(); // Creating at top, Remembering at bottom
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col items-center gap-1 py-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
        Bloom's Taxonomy Pyramid
      </p>
      {levels.map((level, idx) => {
        const count = distribution[level] || 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        const widthPct = 40 + idx * 10; // Pyramid gets wider as we go down
        const isHots = ["Analyzing", "Evaluating", "Creating"].includes(level);

        return (
          <div
            key={level}
            className="flex items-center justify-center py-1.5 rounded-md text-white text-xs font-bold transition-all duration-300 relative"
            style={{
              width: `${widthPct}%`,
              backgroundColor: BLOOM_COLORS[level],
              opacity: count > 0 ? 1 : 0.4,
            }}
          >
            <span className="truncate px-2">
              {level} {count > 0 ? `(${count})` : ""}
            </span>
            {count > 0 && (
              <span className="absolute right-2 text-white/70 text-[10px]">
                {pct}%
              </span>
            )}
          </div>
        );
      })}
      <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-400">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          HOTS (top)
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          LOTS (bottom)
        </div>
      </div>
    </div>
  );
};

/**
 * Bloom's Level Bar Chart
 */
export const BloomsBarChart = ({ distribution }) => {
  const data = BLOOM_ORDER.map((level) => ({
    name: level.substring(0, 3),
    fullName: level,
    count: distribution[level] || 0,
    fill: BLOOM_COLORS[level],
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: "#6b7280" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: "#6b7280" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              return (
                <div className="bg-white px-3 py-2 rounded-lg shadow-lg border border-gray-200 text-sm">
                  <p className="font-semibold">{payload[0].payload.fullName}</p>
                  <p className="text-gray-600">
                    {payload[0].value} question{payload[0].value !== 1 ? "s" : ""}
                  </p>
                </div>
              );
            }
            return null;
          }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((entry) => (
            <Cell key={entry.fullName} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

/**
 * Combined Bloom's Visualization Panel
 * Use this to render all charts together in a grid
 */
export const BloomsVisualizationPanel = ({ summary }) => {
  if (!summary) return null;

  const { distribution, lotsCount, hotsCount, lotsPercentage, hotsPercentage } =
    summary;

  return (
    <div className="space-y-6">
      {/* LOTS vs HOTS Bar */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <p className="text-sm font-semibold text-gray-600 mb-3">
          LOTS vs HOTS Distribution
        </p>
        <LotsHotsBar
          lotsCount={lotsCount}
          hotsCount={hotsCount}
          lotsPercentage={lotsPercentage}
          hotsPercentage={hotsPercentage}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Donut Chart */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <p className="text-sm font-semibold text-gray-600 mb-2 text-center">
            Level Distribution
          </p>
          <BloomsDistributionChart distribution={distribution} size="sm" />
        </div>

        {/* Bar Chart */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <p className="text-sm font-semibold text-gray-600 mb-2 text-center">
            Questions per Level
          </p>
          <BloomsBarChart distribution={distribution} />
        </div>

        {/* Pyramid */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <BloomsPyramid distribution={distribution} />
        </div>
      </div>
    </div>
  );
};
