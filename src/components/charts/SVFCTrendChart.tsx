import React from 'react';
import { View, Text, Dimensions } from 'react-native';
import Svg, { Path, Rect, Line, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import type { ReadinessAssessment } from '../../types/readiness';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 48;
const CHART_HEIGHT = 140;
const PAD_LEFT = 32;
const PAD_RIGHT = 8;
const PAD_TOP = 12;
const PAD_BOTTOM = 24;
const PLOT_W = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_H = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

interface SVFCTrendChartProps {
  assessments: ReadinessAssessment[];
  mu28SVC: number;
  sigma28SVC: number;
}

function xFor(i: number, total: number): number {
  if (total < 2) return PAD_LEFT + PLOT_W / 2;
  return PAD_LEFT + (i / (total - 1)) * PLOT_W;
}

function yFor(value: number): number {
  return PAD_TOP + PLOT_H - (Math.min(100, Math.max(0, value)) / 100) * PLOT_H;
}

function buildLinePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  return points.reduce(
    (path, pt, i) => path + (i === 0 ? `M${pt.x},${pt.y}` : ` L${pt.x},${pt.y}`),
    '',
  );
}

export function SVFCTrendChart({ assessments, mu28SVC, sigma28SVC }: SVFCTrendChartProps) {
  const sorted = [...assessments].reverse();
  const svcValues = sorted.map((a) => a.s_vfc ?? 0);

  if (sorted.length < 2) {
    return (
      <View style={{ height: CHART_HEIGHT }} className="items-center justify-center">
        <Text className="text-text-muted text-sm">Dados insuficientes para o gráfico</Text>
      </View>
    );
  }

  const total = sorted.length;
  const bandTop = Math.min(100, mu28SVC + sigma28SVC);
  const bandBot = Math.max(0, mu28SVC - sigma28SVC);
  const yBandTop = yFor(bandTop);
  const yBandBot = yFor(bandBot);
  const yMu = yFor(mu28SVC);

  const linePoints = svcValues.map((v, i) => ({ x: xFor(i, total), y: yFor(v) }));
  const linePath = buildLinePath(linePoints);

  // Area below the line for shading
  const areaPath =
    linePath +
    ` L${xFor(total - 1, total)},${PAD_TOP + PLOT_H} L${PAD_LEFT},${PAD_TOP + PLOT_H} Z`;

  const firstDate = new Date(sorted[0].assessed_at).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  });
  const lastDate = new Date(sorted[sorted.length - 1].assessed_at).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  });

  return (
    <View>
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
        <Defs>
          <LinearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#22C55E" stopOpacity="0.25" />
            <Stop offset="100%" stopColor="#22C55E" stopOpacity="0.02" />
          </LinearGradient>
        </Defs>

        {/* σ-band (µ±σ green zone) */}
        <Rect
          x={PAD_LEFT}
          y={yBandTop}
          width={PLOT_W}
          height={Math.max(0, yBandBot - yBandTop)}
          fill="#22C55E"
          fillOpacity={0.08}
        />

        {/* µ28 baseline */}
        {mu28SVC > 0 && (
          <Line
            x1={PAD_LEFT}
            y1={yMu}
            x2={PAD_LEFT + PLOT_W}
            y2={yMu}
            stroke="#22C55E"
            strokeWidth={1}
            strokeDasharray="4,3"
            strokeOpacity={0.5}
          />
        )}

        {/* Y-axis ticks */}
        {[0, 25, 50, 75, 100].map((tick) => (
          <React.Fragment key={tick}>
            <Line
              x1={PAD_LEFT - 4}
              y1={yFor(tick)}
              x2={PAD_LEFT}
              y2={yFor(tick)}
              stroke="#525252"
              strokeWidth={1}
            />
            <SvgText
              x={PAD_LEFT - 6}
              y={yFor(tick) + 4}
              textAnchor="end"
              fontSize={9}
              fill="#525252"
            >
              {tick}
            </SvgText>
          </React.Fragment>
        ))}

        {/* Area fill under line */}
        <Path d={areaPath} fill="url(#lineGrad)" />

        {/* Line */}
        <Path d={linePath} stroke="#22C55E" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {/* Data points */}
        {linePoints.map((pt, i) => {
          const val = svcValues[i];
          const inBand = val >= bandBot && val <= bandTop;
          return (
            <React.Fragment key={i}>
              <Rect
                x={pt.x - 3}
                y={pt.y - 3}
                width={6}
                height={6}
                rx={3}
                fill={inBand ? '#22C55E' : val >= 70 ? '#22C55E' : val >= 40 ? '#F97316' : '#EF4444'}
                strokeWidth={1.5}
                stroke="#0A0A0A"
              />
            </React.Fragment>
          );
        })}
      </Svg>

      {/* X-axis labels */}
      <View className="flex-row justify-between" style={{ marginLeft: PAD_LEFT, marginRight: PAD_RIGHT }}>
        <Text className="text-text-muted text-xs">{firstDate}</Text>
        {mu28SVC > 0 && (
          <Text className="text-brand-green/60 text-xs">µ={Math.round(mu28SVC)} ±{Math.round(sigma28SVC)}</Text>
        )}
        <Text className="text-text-muted text-xs">{lastDate}</Text>
      </View>
    </View>
  );
}
