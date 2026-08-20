import type { SeriesPoint } from '@/lib/data';

/**
 * 막대(신규 DB) + 선(광고비 또는 확정매출) 겹쳐 그리는 차트.
 * 외부 라이브러리를 쓰지 않고 SVG로 직접 그린다. 화면 폭에 맞춰 늘어난다.
 */

const W = 900;
const H = 300;
const PAD = { top: 20, right: 64, bottom: 42, left: 64 };

const 만원 = (n: number) => `${Math.round(n / 10000).toLocaleString('ko-KR')}만`;

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / mag) * mag;
}

export function TrendChart({
  points,
  lineKey = '광고비',
  lineLabel = '광고비',
}: {
  points: SeriesPoint[];
  lineKey?: '광고비' | '확정매출';
  lineLabel?: string;
}) {
  if (points.length === 0) {
    return (
      <p className="py-10 text-center text-[14px] text-ink-400">그릴 자료가 아직 없습니다.</p>
    );
  }

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const barMax = niceMax(Math.max(...points.map((p) => p.신규DB), 1));
  const lineVals = points.map((p) => p[lineKey]).filter((v): v is number => v !== null);
  const lineMax = lineVals.length ? niceMax(Math.max(...lineVals)) : 0;

  const step = plotW / points.length;
  const barW = Math.min(38, step * 0.5);

  const x = (i: number) => PAD.left + step * i + step / 2;
  const yBar = (v: number) => PAD.top + plotH - (v / barMax) * plotH;
  const yLine = (v: number) => PAD.top + plotH - (lineMax ? (v / lineMax) * plotH : 0);

  // 선은 값이 있는 구간만 잇는다. 중간에 비면 끊는다.
  const segments: { i: number; v: number }[][] = [];
  let current: { i: number; v: number }[] = [];
  points.forEach((p, i) => {
    const v = p[lineKey];
    if (v === null) {
      if (current.length) segments.push(current);
      current = [];
    } else {
      current.push({ i, v });
    }
  });
  if (current.length) segments.push(current);

  // x축 라벨이 빽빽하면 건너뛴다
  const labelEvery = Math.ceil(points.length / 12);
  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="-mx-2 overflow-x-auto px-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-[280px] w-full min-w-[560px]"
        role="img"
        aria-label={`신규 DB와 ${lineLabel} 추이`}
      >
        {/* 가로 눈금 */}
        {gridLines.map((g) => {
          const y = PAD.top + plotH * (1 - g);
          return (
            <g key={g}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y}
                y2={y}
                stroke="currentColor"
                className="text-ink-100"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-ink-400 text-[11px]"
              >
                {Math.round(barMax * g)}
              </text>
              {lineMax > 0 && (
                <text
                  x={W - PAD.right + 8}
                  y={y + 4}
                  textAnchor="start"
                  className="fill-ink-400 text-[11px]"
                >
                  {만원(lineMax * g)}
                </text>
              )}
            </g>
          );
        })}

        {/* 신규 DB 막대 */}
        {points.map((p, i) => {
          const h = plotH - (yBar(p.신규DB) - PAD.top);
          return (
            <g key={p.key}>
              <rect
                x={x(i) - barW / 2}
                y={yBar(p.신규DB)}
                width={barW}
                height={Math.max(h, p.신규DB > 0 ? 2 : 0)}
                rx={3}
                className="fill-brand-300"
              />
              {p.신규DB > 0 && (
                <text
                  x={x(i)}
                  y={yBar(p.신규DB) - 5}
                  textAnchor="middle"
                  className="fill-brand-700 text-[11px] font-semibold"
                >
                  {p.신규DB}
                </text>
              )}
            </g>
          );
        })}

        {/* 광고비 선 */}
        {segments.map((seg, si) => (
          <polyline
            key={si}
            fill="none"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-amber-500"
            points={seg.map((s) => `${x(s.i)},${yLine(s.v)}`).join(' ')}
          />
        ))}
        {segments.flat().map((s) => (
          <circle
            key={`${s.i}`}
            cx={x(s.i)}
            cy={yLine(s.v)}
            r={3}
            className="fill-amber-500"
          />
        ))}

        {/* x축 라벨 */}
        {points.map((p, i) =>
          i % labelEvery === 0 || points.length <= 12 ? (
            <text
              key={`l-${p.key}`}
              x={x(i)}
              y={H - PAD.bottom + 20}
              textAnchor="middle"
              className="fill-ink-400 text-[11px]"
            >
              {p.label}
            </text>
          ) : null,
        )}
      </svg>

      <div className="mt-2 flex flex-wrap gap-4 px-2 text-[12px] text-ink-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-brand-300" /> 신규 DB (건, 왼쪽)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-amber-500" /> {lineLabel} (원, 오른쪽)
        </span>
      </div>
    </div>
  );
}
