import {
  ArrowDownUp,
  ArrowRight,
  ChartNoAxesCombined,
  CircleHelp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardData, Patient, TriageLevel } from "../types/dashboard";
import { calculateMetrics, flowByStage } from "../utils/calculateMetrics";
import { triageColors, triageLabels, duration } from "../utils/formatters";
import { Badge, Insight, Panel } from "./Common";
export function PatientFlowChart({ patients }: { patients: Patient[] }) {
  const data = flowByStage(patients);
  const bottleneck = [...data]
    .filter((d) => d.delay !== null)
    .sort((a, b) => b.delay! - a.delay!)[0];
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <Panel
      title="Patient flow by stage"
      subtitle="A clear view of the journey through your ED"
      extra={
        <span
          className="subtle-icon"
          title="Bars show patient count; time is the median duration in the current stage at the snapshot."
        >
          <CircleHelp size={16} />
        </span>
      }
      className="flow-panel"
    >
      <div className="flow-column-head">
        <span>Stage</span>
        <span>Patients</span>
        <span>Time in stage</span>
      </div>
      <div className="flow-bars">
        {data.map((d, i) => (
          <div
            key={d.stage}
            className={`flow-row ${d.stage === bottleneck?.stage ? "bottleneck" : ""}`}
            title={`${d.stage}: ${d.count} patients, median time in stage ${d.delay ?? "unavailable"}`}
          >
            <span className="flow-stage">
              <span className="stage-number">{i + 1}</span>
              {d.stage}
            </span>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{ width: `${(d.count / max) * 100}%` }}
              />
            </div>
            <strong>{d.count}</strong>
            <span className="flow-delay">
              {d.delay === null ? "—" : duration(d.delay)}{" "}
              {d.stage === bottleneck?.stage && (
                <span className="tiny-warning">!</span>
              )}
            </span>
          </div>
        ))}
      </div>
      <Insight warning={(bottleneck?.delay ?? 0) > 30}>
        {bottleneck ? (
          <>
            <strong>{bottleneck.stage}</strong> has the longest median time in
            stage: {duration(bottleneck.delay!)}. Duration alone does not
            establish the cause.
          </>
        ) : (
          "Stage timing is unavailable for this snapshot."
        )}
      </Insight>
    </Panel>
  );
}
export function TriageChart({ patients }: { patients: Patient[] }) {
  const data = (Object.keys(triageLabels) as TriageLevel[]).map((level) => ({
    name: level,
    value: patients.filter((p) => p.triageLevel === level).length,
  }));
  return (
    <Panel
      title="Triage distribution"
      subtitle="Patient mix by urgency"
      extra={<span className="panel-tag">All active patients</span>}
      className="triage-panel"
    >
      <div className="donut-wrap">
        <ResponsiveContainer width="100%" height={170}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={57}
              outerRadius={76}
              paddingAngle={4}
              stroke="none"
              startAngle={90}
              endAngle={-270}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={triageColors[d.name]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [
                `${value} patients`,
                `${name} · ${triageLabels[name as TriageLevel]}`,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-center">
          <strong>{patients.length}</strong>
          <span>Total patients</span>
        </div>
      </div>
      <div className="triage-legend">
        {data.map((d) => (
          <div key={d.name}>
            <span
              className="legend-dot"
              style={{ background: triageColors[d.name] }}
            />
            <span>
              {d.name}
              <small>{triageLabels[d.name]}</small>
            </span>
            <strong>{d.value}</strong>
            <span className="percent">
              {patients.length
                ? Math.round((d.value / patients.length) * 100)
                : 0}
              %
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
export function ArrivalDepartureChart({ data }: { data: DashboardData }) {
  const m = calculateMetrics(data);
  return (
    <Panel
      title="Arrivals vs. departures"
      subtitle="Hourly patient movement"
      extra={
        <span className="panel-tag">
          <ClockIcon />
          Last 12 hours
        </span>
      }
      className="arrivals-panel"
    >
      <div className="chart-legend">
        <span>
          <i className="blue-line" />
          Arrivals
        </span>
        <span>
          <i className="green-line" />
          Departures
        </span>
        <small>Patients / hour</small>
      </div>
      <div className="area-chart">
        <ResponsiveContainer width="100%" height={207}>
          <AreaChart
            data={data.history}
            margin={{ top: 10, right: 8, left: -25, bottom: 0 }}
          >
            <defs>
              <linearGradient id="arrivalsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4285ed" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#4285ed" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="#edf0f5"
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="hour"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "#8994a4" }}
              tickFormatter={(v) => `${v}:00`}
              interval={2}
              dy={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "#8994a4" }}
              allowDecimals={false}
            />
            <Tooltip
              labelFormatter={(v) => `${v}:00`}
              contentStyle={{
                borderRadius: 8,
                borderColor: "#e4e9f0",
                fontSize: 12,
              }}
            />
            <Area
              type="monotone"
              name="Arrivals"
              dataKey="arrivals"
              stroke="#3779e4"
              strokeWidth={2.5}
              fill="url(#arrivalsGradient)"
            />
            <Area
              type="monotone"
              name="Departures"
              dataKey="departures"
              stroke="#45a48d"
              strokeWidth={2}
              strokeDasharray="5 4"
              fill="transparent"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <Insight warning={m.imbalance}>
        {m.imbalance
          ? "Arrivals have exceeded departures for three consecutive hours."
          : "Arrivals and departures are balanced."}
      </Insight>
    </Panel>
  );
}
function ClockIcon() {
  return <ArrowDownUp size={12} />;
}
export function CapacityPanel({
  data,
  expanded = false,
}: {
  data: DashboardData;
  expanded?: boolean;
}) {
  const m = calculateMetrics(data);
  return (
    <Panel
      id="capacity"
      title="Area capacity"
      subtitle="Staffed spaces and current utilisation"
      extra={
        <Badge tone={m.occupancy >= 85 ? "warning" : "normal"}>
          {m.occupied} / {m.capacity} beds occupied
        </Badge>
      }
      className="capacity-panel"
    >
      <div className="table-scroll">
        <table className="capacity-table">
          <thead>
            <tr>
              <th>ED area</th>
              <th>Occupied / capacity</th>
              <th>Waiting</th>
              <th>Utilisation</th>
              {expanded && <th>Staff on duty</th>}
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.areas.map((a) => {
              const pct = Math.round((a.occupied / a.staffedCapacity) * 100);
              const tone =
                pct >= 100
                  ? "critical"
                  : pct >= 85
                    ? "warning"
                    : pct >= 70
                      ? "info"
                      : "normal";
              return (
                <tr key={a.area}>
                  <td>
                    <span className={`area-icon area-${tone}`}>
                      <ChartNoAxesCombined size={14} />
                    </span>
                    <strong>{a.area}</strong>
                  </td>
                  <td>
                    <b>{a.occupied}</b>
                    <span className="muted"> / {a.staffedCapacity}</span>
                  </td>
                  <td>
                    {a.waiting === 0 ? (
                      <span className="muted">—</span>
                    ) : (
                      a.waiting
                    )}
                  </td>
                  <td>
                    <div className={`utilisation ${tone}`}>
                      <div>
                        <i style={{ width: `${pct}%` }} />
                      </div>
                      <span>{pct}%</span>
                    </div>
                  </td>
                  {expanded && <td>{a.staffOnDuty ?? "—"}</td>}
                  <td>
                    <Badge tone={tone}>
                      {pct >= 100
                        ? "Full"
                        : pct >= 85
                          ? "Near capacity"
                          : pct >= 70
                            ? "Busy"
                            : "Available"}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="panel-footnote">
        <CircleHelp size={12} />
        Capacity reflects staffed spaces, not physical beds. Waiting patients
        may already occupy an area space.
        <ArrowRight size={13} />
      </div>
    </Panel>
  );
}
