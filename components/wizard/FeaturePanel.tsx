import React from 'react';
import { ContractKind, FeatureGroup, FieldDef } from '../../services/wizard/schema';

interface FeaturePanelProps {
  kind: ContractKind;
  values: Record<string, string | number | boolean>;
  enabled: Record<string, boolean>;
  errors: Record<string, string>;
  onToggle: (featureId: string) => void;
  onFieldChange: (field: FieldDef, value: string | number | boolean) => void;
}

const GROUPS: FeatureGroup[] = ['Auth', 'Timing', 'Outputs', 'Tokens', 'Policy', 'Info'];

function renderInput(
  field: FieldDef,
  value: string | number | boolean,
  onFieldChange: (field: FieldDef, value: string | number | boolean) => void
) {
  if (field.type === 'bool') {
    return (
      <input
        type="checkbox"
        checked={value === true}
        onChange={(e) => onFieldChange(field, e.target.checked)}
        className="w-4 h-4 accent-emerald-500"
      />
    );
  }
  if (field.type === 'enum') {
    return (
      <select
        value={String(value ?? '')}
        onChange={(e) => onFieldChange(field, e.target.value)}
        className="w-full bg-[#070b09] border border-white/10 rounded px-2 py-1.5 text-xs text-slate-200"
      >
        {(field.options ?? []).map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }
  const type = field.type === 'int' || field.type === 'blockHeight' || field.type === 'unixTime' ? 'number' : 'text';
  return (
    <input
      type={type}
      value={String(value ?? '')}
      placeholder={field.placeholder}
      onChange={(e) => onFieldChange(field, type === 'number' ? Number(e.target.value) : e.target.value)}
      className="w-full bg-[#070b09] border border-white/10 rounded px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-600"
    />
  );
}

export const FeaturePanel: React.FC<FeaturePanelProps> = ({
  kind,
  values,
  enabled,
  errors,
  onToggle,
  onFieldChange,
}) => {
  const grouped = GROUPS.map((group) => ({
    group,
    features: kind.features.filter((f) => f.group === group),
  })).filter((entry) => entry.features.length > 0);

  return (
    <div className="p-4 overflow-auto custom-scrollbar space-y-5">
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-400 font-black">Base fields</div>
        <div className="mt-3 space-y-3">
          {kind.fields.map((field) => (
            <div key={field.id}>
              <label className="text-[10px] text-slate-400 uppercase tracking-wider">{field.label}</label>
              {renderInput(field, values[field.id] ?? '', onFieldChange)}
              {errors[field.id] && <div className="text-[10px] text-red-400 mt-1">{errors[field.id]}</div>}
              <div className="text-[10px] text-slate-600 mt-1">{field.description}</div>
            </div>
          ))}
        </div>
      </div>

      {grouped.map(({ group, features }) => (
        <div key={group}>
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-black">{group}</div>
          <div className="mt-2 space-y-2">
            {features.map((feature) => {
              const checked = !!enabled[feature.id];
              const disabled = !!feature.disabled;
              return (
                <div key={feature.id} className="rounded-md border border-white/10 bg-white/[0.02] p-2.5">
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => !disabled && onToggle(feature.id)}
                      disabled={disabled}
                      className="w-4 h-4 mt-0.5 accent-emerald-500 disabled:opacity-50"
                    />
                    <div className="flex-1">
                      <div className="text-xs text-slate-200 font-semibold">
                        {feature.label}
                        {disabled && (
                          <span className="ml-2 text-[10px] text-amber-400">{feature.disabledReason || 'Coming soon'}</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{feature.description}</div>
                    </div>
                  </label>
                  {checked && (feature.fields ?? []).length > 0 && (
                    <div className="mt-2 pt-2 border-t border-white/5 space-y-2">
                      {feature.fields!.map((field) => (
                        <div key={field.id}>
                          <label className="text-[10px] text-slate-400 uppercase tracking-wider">{field.label}</label>
                          {renderInput(field, values[field.id] ?? '', onFieldChange)}
                          {errors[field.id] && <div className="text-[10px] text-red-400 mt-1">{errors[field.id]}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
