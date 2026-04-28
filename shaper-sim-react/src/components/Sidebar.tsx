import React from 'react';
import { defaultState } from '../types';
import type { AppState } from '../types';
import { getBeltTensionN } from '../lib/beltUtils';
import { getMotorPreset, MOTOR_PRESET_OPTIONS } from '../lib/motorPresets';
import { STATE_RANGES } from '../lib/stateSanitizer';
import { CaretDown, FloppyDisk, Sliders, Cube, Trash, ArrowCounterClockwise, Waveform } from '@phosphor-icons/react';

interface SidebarProps {
  state: AppState;
  updateState: (key: keyof AppState, value: number | boolean | string) => void;
  resetToDefault: () => void;
  profiles: string[];
  saveProfile: (name: string) => void;
  loadProfile: (name: string) => void;
  deleteProfile: (name: string) => void;
}

interface RangeControlProps {
  id: keyof AppState;
  label: React.ReactNode;
  value: number;
  display?: React.ReactNode;
  min: number;
  max: number;
  step: number | string;
  disabled?: boolean;
  help?: React.ReactNode;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const RangeControl: React.FC<RangeControlProps> = ({
  id,
  label,
  value,
  display,
  min,
  max,
  step,
  disabled,
  help,
  onChange
}) => (
  <div className={`control-group ${disabled ? 'disabled-group' : ''}`}>
    <label htmlFor={id}>
      <span>{label}</span>
      {display !== undefined && <span className="value-display">{display}</span>}
    </label>
    <input type="range" id={id} min={min} max={max} step={step} value={value} onChange={onChange} disabled={disabled} />
    {help && <div className="help-text-block">{help}</div>}
  </div>
);

const ScaleLegend: React.FC<{ rows: Array<[string, string]> }> = ({ rows }) => (
  <div className="scale-grid">
    {rows.map(([value, label]) => (
      <React.Fragment key={`${value}-${label}`}>
        <span className="scale-marker">{value}</span>
        <span>{label}</span>
      </React.Fragment>
    ))}
  </div>
);

export const Sidebar: React.FC<SidebarProps> = ({ 
  state, updateState, resetToDefault, profiles, saveProfile, loadProfile, deleteProfile 
}) => {
  const [selectedProfile, setSelectedProfile] = React.useState<string>('');
  const profileInputRef = React.useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { id, value, type } = e.target;
    if (type === 'checkbox') {
      updateState(id as keyof AppState, (e.target as HTMLInputElement).checked);
    } else {
      const val = value === '' ? NaN : parseFloat(value);
      updateState(id as keyof AppState, val);
    }
  };

  const updateCustomMotorNumber = (key: keyof AppState, value: number) => {
    updateState('motorPreset', 'custom');
    updateState(key, value);
  };

  const applyMotorPreset = (id: string) => {
    updateState('motorPreset', id);
    const preset = getMotorPreset(id);
    if (!preset) return;

    updateState('motorTorque', preset.torque);
    updateState('motorInertia', preset.inertia);
    updateState('motorRatedCurrent', preset.ratedCurrent);
    updateState('motorResistance', preset.resistance);
    updateState('motorInductance', preset.inductance);
    updateState('motorRotorTeeth', preset.rotorTeeth);
    updateState('motorCurrent', preset.runCurrent);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo-section">
          <Waveform size={36} weight="duotone" color="#00ffff" className="logo-icon" />
          <h2 className="brand-title">
            ShaperSim
          </h2>
        </div>
      </div>

      <details className="control-section highlighted-section" open>
        <summary>
          <h3 className="highlighted-title">
            <FloppyDisk size={18} weight="duotone" /> Tuning Profiles
            <CaretDown size={18} className="ml-auto ph-caret-down" />
          </h3>
        </summary>
        <div className="control-group">
          <select 
            className="profile-select" 
            value={selectedProfile} 
            onChange={e => {
              const val = e.target.value;
              setSelectedProfile(val);
              if (val) loadProfile(val);
            }}
          >
            <option value="">-- Select Profile --</option>
            {profiles.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <div className="profile-actions">
            <input 
              type="text" 
              ref={profileInputRef}
              className="profile-input" 
              placeholder="New Profile Name..." 
            />
            <button 
              type="button"
              className="btn-icon btn-save" 
              title="Save Profile" 
              aria-label="Save profile"
              onClick={() => {
                const name = profileInputRef.current?.value;
                if (name) {
                  saveProfile(name);
                  setSelectedProfile(name);
                  profileInputRef.current!.value = '';
                }
              }}
            >
              <FloppyDisk size={16} weight="bold" />
            </button>
            <button 
              type="button"
              className="btn-icon btn-delete" 
              title="Delete Selected" 
              aria-label="Delete selected profile"
              onClick={() => {
                if (selectedProfile && window.confirm(`Delete profile '${selectedProfile}'?`)) {
                  deleteProfile(selectedProfile);
                  setSelectedProfile('');
                }
              }} 
              disabled={!selectedProfile}
            >
              <Trash size={16} weight="bold" />
            </button>
          </div>
        </div>
      </details>

      <details className="control-section" open>
        <summary>
          <h3><Sliders size={16} weight="duotone" /> Simulation Settings<CaretDown size={16} className="ml-auto ph-caret-down" /></h3>
        </summary>
        <div className="control-actions">
          <button 
            type="button"
            className="nav-btn nav-btn-clear" 
            onClick={resetToDefault}
          >
            <ArrowCounterClockwise size={14} weight="bold" /> Reset All Defaults
          </button>
        </div>
        <RangeControl
          id="dampingRatio"
          label="Damping Ratio"
          value={state.dampingRatio}
          display={state.dampingRatio.toFixed(3)}
          min={STATE_RANGES.dampingRatio.min}
          max={STATE_RANGES.dampingRatio.max}
          step="0.005"
          onChange={handleChange}
          help={<span className="help-text"><b>Tip:</b> Rigid frames "ring" longer. Use lower values (0.04-0.07) for rigid billet frames, higher (0.10-0.15) for flexible bare/VHB frames.</span>}
        />
        <RangeControl
          id="scv"
          label="Square Corner Velocity"
          value={state.scv}
          display={state.scv.toFixed(1)}
          min={STATE_RANGES.scv.min}
          max={STATE_RANGES.scv.max}
          step="0.5"
          onChange={handleChange}
        />
        <RangeControl
          id="maxX"
          label="Max Frequency (Hz)"
          value={state.maxX || 400}
          display={`${state.maxX} Hz`}
          min={STATE_RANGES.maxX.min}
          max={STATE_RANGES.maxX.max}
          step="10"
          onChange={handleChange}
        />
      </details>

      <details className="control-section" open>
        <summary>
          <h3><Cube size={16} weight="duotone" /> CoreXY Mechanicals<CaretDown size={16} className="ml-auto ph-caret-down" /></h3>
        </summary>
        <div className="control-group">
          <label htmlFor="driveType">Drive Configuration</label>
          <select id="driveType" value={state.driveType} onChange={handleChange}>
            <option value={2}>2WD (Standard CoreXY)</option>
            <option value={4}>AWD (4-Motor CoreXY)</option>
          </select>
        </div>
        <div className="control-group">
          <label htmlFor="toolheadWeight">Toolhead Weight (g)</label>
          <input type="number" id="toolheadWeight" value={isNaN(state.toolheadWeight) ? '' : state.toolheadWeight} step="10" onChange={handleChange} />
        </div>
        <div className="control-group">
          <label htmlFor="yGantryWeight">Y Gantry Weight (g)</label>
          <input type="number" id="yGantryWeight" value={isNaN(state.yGantryWeight) ? '' : state.yGantryWeight} step="10" onChange={handleChange} />
        </div>
        <div className="control-group">
          <label htmlFor="beltLength">A/B Belt Path (mm)</label>
          <input type="number" id="beltLength" value={isNaN(state.beltLength) ? '' : state.beltLength} step="10" onChange={handleChange} />
        </div>
        <div className="control-group">
          <label htmlFor="beltType">Belt Type</label>
          <select id="beltType" value={state.beltType} onChange={handleChange}>
            <option value={12000}>GT2 6mm (Standard)</option>
            <option value={18000}>GT2 9mm (AWD/Heavy Duty)</option>
            <option value={20000}>GT2 10mm (AWD/Heavy Duty)</option>
            <option value={25000}>GT2 12mm (Extreme)</option>
          </select>
        </div>
        <div className="control-group">
          <label htmlFor="beltTune">
            <span>Gates Belt Tune (Hz @ 150mm span)</span>
          </label>
          <input type="range" id="beltTune" min={STATE_RANGES.beltTune.min} max={STATE_RANGES.beltTune.max} step="1" value={state.beltTune} onChange={handleChange} />
          <div className="tension-display">
            <span>{state.beltTune} Hz (~{getBeltTensionN(state.beltType, state.beltTune).toFixed(1)} N)</span>
          </div>
        </div>
        <div className="control-group">
          <label htmlFor="frameStiffness">
            <span>Frame Stiffness</span>
            <span className="value-display">{state.frameStiffness.toFixed(1)}</span>
          </label>
          <input type="range" id="frameStiffness" min={STATE_RANGES.frameStiffness.min} max={STATE_RANGES.frameStiffness.max} step="0.1" value={state.frameStiffness} onChange={handleChange} />
          <ScaleLegend rows={[
            ['0.5', 'Acrylic / Poor'],
            ['1.0', 'Bare 2020'],
            ['4.0', 'Bare 4040'],
            ['5.0', '2020 + 3mm Alu panel'],
            ['6.5', '2020 + 5mm Alu panel'],
            ['7.5', '4040 + 3mm Alu panel'],
            ['9.0', '4040 + 5mm Alu panel'],
            ['10.0', 'CNC Billet / Cast Iron']
          ]} />
          <div className="subtle-note">
            <em>* Panels must be continuously bolted/bonded to extrusions — flimsy printed clips don't add stiffness.</em><br />
            <em className="note-em">* ACM/PC composite panels have less than half the shear rigidity of solid aluminum.</em>
          </div>
        </div>

        <details className="sub-category">
          <summary>Stepper Motors (A/B Drives)</summary>
          <div className="sub-category-content">
            <div className="control-group">
              <label htmlFor="motorPreset">Motor Preset</label>
              <select id="motorPreset" value={state.motorPreset} onChange={(e) => applyMotorPreset(e.target.value)}>
                {MOTOR_PRESET_OPTIONS.map(option => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="control-group">
              <label htmlFor="motorTorque">Rated Holding Torque (mNm)</label>
              <input type="number" id="motorTorque" value={state.motorTorque} min={STATE_RANGES.motorTorque.min} max={STATE_RANGES.motorTorque.max} step="10" onChange={(e) => updateCustomMotorNumber('motorTorque', parseFloat(e.target.value))} />
            </div>
            <div className="control-group">
              <label htmlFor="motorInertia">Rotor Inertia (g·cm²)</label>
              <input type="number" id="motorInertia" value={state.motorInertia} min={STATE_RANGES.motorInertia.min} max={STATE_RANGES.motorInertia.max} step="0.1" onChange={(e) => updateCustomMotorNumber('motorInertia', parseFloat(e.target.value))} />
            </div>
            <div className="control-group">
              <label htmlFor="motorRatedCurrent">Rated Current (A/phase)</label>
              <input type="number" id="motorRatedCurrent" value={state.motorRatedCurrent} min={STATE_RANGES.motorRatedCurrent.min} max={STATE_RANGES.motorRatedCurrent.max} step="0.05" onChange={(e) => updateCustomMotorNumber('motorRatedCurrent', parseFloat(e.target.value))} />
            </div>
            <div className="control-group">
              <label htmlFor="motorResistance">Phase Resistance (ohms)</label>
              <input type="number" id="motorResistance" value={state.motorResistance} min={STATE_RANGES.motorResistance.min} max={STATE_RANGES.motorResistance.max} step="0.05" onChange={(e) => updateCustomMotorNumber('motorResistance', parseFloat(e.target.value))} />
            </div>
            <div className="control-group">
              <label htmlFor="motorInductance">Phase Inductance (mH)</label>
              <input type="number" id="motorInductance" value={state.motorInductance} min={STATE_RANGES.motorInductance.min} max={STATE_RANGES.motorInductance.max} step="0.05" onChange={(e) => updateCustomMotorNumber('motorInductance', parseFloat(e.target.value))} />
            </div>
            <div className="control-group">
              <label htmlFor="motorRotorTeeth">Rotor Teeth</label>
              <input type="number" id="motorRotorTeeth" value={state.motorRotorTeeth} min={STATE_RANGES.motorRotorTeeth.min} max={STATE_RANGES.motorRotorTeeth.max} step="1" onChange={(e) => updateCustomMotorNumber('motorRotorTeeth', parseFloat(e.target.value))} />
            </div>
            <div className="control-group">
              <label htmlFor="motorCurrent">
                <span>Run Current</span>
                <span className="value-display">{state.motorCurrent}%</span>
              </label>
              <input type="range" id="motorCurrent" min={STATE_RANGES.motorCurrent.min} max={STATE_RANGES.motorCurrent.max} step="1" value={state.motorCurrent} onChange={handleChange} />
            </div>
            <div className="control-group">
              <label htmlFor="motorVoltage">Supply Voltage (V)</label>
              <input type="number" id="motorVoltage" value={state.motorVoltage} min={STATE_RANGES.motorVoltage.min} max={STATE_RANGES.motorVoltage.max} step="1" onChange={handleChange} />
            </div>
            <div className="control-group">
              <label htmlFor="pulleyTeeth">GT2 Pulley Teeth</label>
              <input type="number" id="pulleyTeeth" value={state.pulleyTeeth} min={STATE_RANGES.pulleyTeeth.min} max={STATE_RANGES.pulleyTeeth.max} step="1" onChange={handleChange} />
            </div>
          </div>
        </details>

        <details className="sub-category">
          <summary>Experimental Physics (Advanced)</summary>
          <div className="sub-category-content">
            <div className="control-group checkbox-group">
              <input type="checkbox" id="enableDynamicSpeed" className="checkbox-input" checked={state.enableDynamicSpeed} onChange={handleChange} />
              <label htmlFor="enableDynamicSpeed" className="checkbox-label">Enable Speed Simulation</label>
            </div>
            <div className="help-text-block">
              <span className="help-text">Before using speed simulation, verify the motor stats above, including supply voltage, pulley teeth, rated current, resistance, inductance, and rotor teeth.</span>
            </div>
            <RangeControl
              id="printSpeed"
              label="Print Speed (mm/s)"
              value={state.printSpeed}
              display={`${state.printSpeed} mm/s`}
              min={STATE_RANGES.printSpeed.min}
              max={STATE_RANGES.printSpeed.max}
              step="10"
              disabled={!state.enableDynamicSpeed}
              onChange={handleChange}
              help={<span className="help-text"><b>Tip:</b> Simulates torque drop-off (shifts resonance peaks lower) and GT2 belt tooth meshing at <b>{(state.printSpeed / 2).toFixed(0)} Hz</b>.</span>}
            />
            <div className="control-group">
              <div className="help-panel">
                <div className="help-text">
                  <b>Tip:</b> Measure all offsets (COM, ADXL, Nozzle) as the physical distance (in mm) from the <b>linear rail carriage center</b>.<br/><br/>
                  <b className="muted-strong">Directions (looking from front):</b><br/>
                  <span className="muted-text">• <b>X:</b> (-) Left / (+) Right</span><br/>
                  <span className="muted-text">• <b>Y:</b> (-) Front / (+) Back</span><br/>
                  <span className="muted-text">• <b>Z:</b> (-) Down / (+) Up</span><br/><br/>
                  <b className="warning-text">⚠ Important:</b><br/>
                  <span className="muted-text">Do not use any offset unless you are going to set them all correctly.</span>
                  
                  <div className="preset-actions">
                    <button type="button" className="export-btn compact-action" onClick={() => {
                      updateState('twistX', 0); updateState('twistY', 0); updateState('twistZ', 0);
                      updateState('adxlOffsetX', 0); updateState('adxlOffsetY', 0); updateState('adxlOffsetZ', 0);
                      updateState('nozzleOffsetX', 0); updateState('nozzleOffsetY', 0); updateState('nozzleOffsetZ', 0);
                      updateState('nozzleMountedADXL', false);
                      updateState('toolheadStiffness', defaultState.toolheadStiffness);
                      updateState('bearingPreload', defaultState.bearingPreload);
                    }}>Reset All</button>
                    <button type="button" className="export-btn compact-action" onClick={() => {
                      updateState('twistX', 0); updateState('twistY', -20); updateState('twistZ', -10);
                      updateState('adxlOffsetX', 0); updateState('adxlOffsetY', -45); updateState('adxlOffsetZ', 15);
                      updateState('nozzleOffsetX', 0); updateState('nozzleOffsetY', -35); updateState('nozzleOffsetZ', -40);
                      updateState('toolheadStiffness', 0.65);
                      updateState('nozzleMountedADXL', false);
                    }}>Stealthburner</button>
                  </div>
                </div>
              </div>
            </div>
            <RangeControl id="twistX" label={<>X COM Offset (mm) <span className="label-note">(affects Y-axis graph)</span></>} value={state.twistX} display={`${state.twistX} mm`} min={STATE_RANGES.twistX.min} max={STATE_RANGES.twistX.max} step="1" onChange={handleChange} />
            <RangeControl id="twistY" label={<>Y COM Offset (mm) <span className="label-note">(affects X-axis graph)</span></>} value={state.twistY} display={`${state.twistY} mm`} min={STATE_RANGES.twistY.min} max={STATE_RANGES.twistY.max} step="1" onChange={handleChange} />
            <RangeControl id="twistZ" label={<>Z COM Offset (mm) <span className="label-note">(affects both axes)</span></>} value={state.twistZ} display={`${state.twistZ} mm`} min={STATE_RANGES.twistZ.min} max={STATE_RANGES.twistZ.max} step="1" onChange={handleChange} />
            <div className="control-group checkbox-group control-group-offset">
              <input type="checkbox" id="nozzleMountedADXL" className="checkbox-input" checked={state.nozzleMountedADXL} onChange={handleChange} />
              <label htmlFor="nozzleMountedADXL" className="checkbox-label">Nozzle-Mounted ADXL</label>
            </div>
            {!state.nozzleMountedADXL && (
              <>
                <RangeControl id="adxlOffsetX" label="X ADXL Offset (mm)" value={state.adxlOffsetX} display={`${state.adxlOffsetX} mm`} min={STATE_RANGES.adxlOffsetX.min} max={STATE_RANGES.adxlOffsetX.max} step="1" onChange={handleChange} />
                <RangeControl id="adxlOffsetY" label="Y ADXL Offset (mm)" value={state.adxlOffsetY} display={`${state.adxlOffsetY} mm`} min={STATE_RANGES.adxlOffsetY.min} max={STATE_RANGES.adxlOffsetY.max} step="1" onChange={handleChange} />
                <RangeControl id="adxlOffsetZ" label="Z ADXL Offset (mm)" value={state.adxlOffsetZ} display={`${state.adxlOffsetZ} mm`} min={STATE_RANGES.adxlOffsetZ.min} max={STATE_RANGES.adxlOffsetZ.max} step="1" onChange={handleChange} />
              </>
            )}
            <RangeControl id="nozzleOffsetX" label="X Nozzle Offset (mm)" value={state.nozzleOffsetX} display={`${state.nozzleOffsetX} mm`} min={STATE_RANGES.nozzleOffsetX.min} max={STATE_RANGES.nozzleOffsetX.max} step="1" onChange={handleChange} />
            <RangeControl id="nozzleOffsetY" label="Y Nozzle Offset (mm)" value={state.nozzleOffsetY} display={`${state.nozzleOffsetY} mm`} min={STATE_RANGES.nozzleOffsetY.min} max={STATE_RANGES.nozzleOffsetY.max} step="1" onChange={handleChange} />
            <RangeControl id="nozzleOffsetZ" label="Z Nozzle Offset (mm)" value={state.nozzleOffsetZ} display={`${state.nozzleOffsetZ} mm`} min={STATE_RANGES.nozzleOffsetZ.min} max={STATE_RANGES.nozzleOffsetZ.max} step="1" onChange={handleChange} />
            <div className="control-group control-group-offset">
              <label htmlFor="toolheadStiffness"><span>Toolhead Material Stiffness</span><span className="value-display">{state.toolheadStiffness.toFixed(1)}x</span></label>
              <input type="range" id="toolheadStiffness" min={STATE_RANGES.toolheadStiffness.min} max={STATE_RANGES.toolheadStiffness.max} step="0.05" value={state.toolheadStiffness} onChange={handleChange} />
              <ScaleLegend rows={[
                ['0.5', 'Flexible printed stack / weak ducts'],
                ['0.7', 'StealthBurner-style ABS assembly'],
                ['1.0', 'Stiff printed baseline'],
                ['1.5', 'Topo. Optimized Plastic / CF'],
                ['2.0', 'Topo. CF / Machined Alu / Basic SLM'],
                ['2.5', 'Topology Optimized CNC'],
                ['3.0', 'Topology Optimized SLM']
              ]} />
              <div className="subtle-note">
                <em>* These stiffness values are provisional model estimates, not measured material facts. Use them for relative what-if comparisons only.</em>
              </div>
            </div>
            <div className="control-group control-group-offset">
              <label htmlFor="bearingPreload">X-Rail Bearing Preload</label>
              <select id="bearingPreload" value={state.bearingPreload} onChange={(e) => updateState('bearingPreload', parseFloat(e.target.value))}>
                <option value="0.7">MGN9 Z0 (Light / Micro-slop)</option>
                <option value="0.85">MGN12 Z0 (Light Preload - Default)</option>
                <option value="1">MGN12 Z1 (Medium Preload)</option>
                <option value="1.15">MGN12 Z2 (Heavy Preload)</option>
                <option value="1.2">Dual MGN9 / Wide Carriage</option>
              </select>
            </div>
          </div>
        </details>
      </details>

      <details className="control-section">
        <summary>
          <h3><Sliders weight="bold" /> Mechanical Imperfections<CaretDown size={16} className="ml-auto ph-caret-down" /></h3>
        </summary>
        
        <details className="sub-category">
          <summary>Drive System & Frame</summary>
          <div className="sub-category-content">
            <RangeControl id="beltTensionDiff" label="Unequal Belt Tension (Split Peak)" value={state.beltTensionDiff} display={`${state.beltTensionDiff}%`} min={STATE_RANGES.beltTensionDiff.min} max={STATE_RANGES.beltTensionDiff.max} step="5" onChange={handleChange} />
            <RangeControl id="gantryRacking" label="Gantry Racking (Y only)" value={state.gantryRacking} display={`${state.gantryRacking}%`} min={STATE_RANGES.gantryRacking.min} max={STATE_RANGES.gantryRacking.max} step="5" onChange={handleChange} />
          </div>
        </details>

        <details className="sub-category">
          <summary>External & Umbilical</summary>
          <div className="sub-category-content">
            <RangeControl id="externalSway" label="External Sway" value={state.externalSway} display={`${state.externalSway}%`} min={STATE_RANGES.externalSway.min} max={STATE_RANGES.externalSway.max} step="5" onChange={handleChange} />
            <RangeControl id="externalSwayFreq" label="Sway Frequency (Hz)" value={state.externalSwayFreq} display={`${state.externalSwayFreq} Hz`} min={STATE_RANGES.externalSwayFreq.min} max={STATE_RANGES.externalSwayFreq.max} step="1" onChange={handleChange} />
            <RangeControl id="squishyFeet" label="Squishy Materials" value={state.squishyFeet} display={`${state.squishyFeet}%`} min={STATE_RANGES.squishyFeet.min} max={STATE_RANGES.squishyFeet.max} step="5" onChange={handleChange} />
            <RangeControl id="hoseDrag" label="Hose Drag Amplitude" value={state.hoseDrag} display={`${state.hoseDrag}%`} min={STATE_RANGES.hoseDrag.min} max={STATE_RANGES.hoseDrag.max} step="5" onChange={handleChange} />
            <RangeControl id="hoseDragFreq" label="Hose Drag Freq (Hz)" value={state.hoseDragFreq} display={`${state.hoseDragFreq} Hz`} min={STATE_RANGES.hoseDragFreq.min} max={STATE_RANGES.hoseDragFreq.max} step="1" onChange={handleChange} />
            <RangeControl id="hoseSquishy" label="Hose Damping" value={state.hoseSquishy} display={`${state.hoseSquishy}%`} min={STATE_RANGES.hoseSquishy.min} max={STATE_RANGES.hoseSquishy.max} step="5" onChange={handleChange} />
          </div>
        </details>
      </details>

    </aside>
  );
};
