import { TrendingDown, TrendingUp } from 'lucide-react';
import { intensityToColor } from './heat-color';

const STEPS = [0, 1, 2, 5, 10, 20, 40];

export function HeatmapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-sysde-mid">
      <div className="flex items-center gap-2">
        <span>Frío</span>
        <div className="flex">
          {STEPS.map((s) => (
            <div
              key={s}
              className="h-4 w-6 border border-white"
              style={{ backgroundColor: intensityToColor(s) }}
              title={`${s} actividad${s === 1 ? '' : 'es'}`}
            />
          ))}
        </div>
        <span>Caliente</span>
      </div>
      <div className="flex items-center gap-1.5">
        <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
        <span>Calentando (silencio → activo)</span>
      </div>
      <div className="flex items-center gap-1.5">
        <TrendingDown className="h-3.5 w-3.5 text-red-600" />
        <span>Enfriándose (activo → silencio)</span>
      </div>
    </div>
  );
}
