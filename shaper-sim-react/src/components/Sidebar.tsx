import React from 'react';
import type { AppState } from '../types';
import { getBeltTensionN } from '../lib/beltUtils';
import { CaretDown, FloppyDisk, Sliders, Cube, Trash, ArrowCounterClockwise, Waveform } from '@phosphor-icons/react';

interface SidebarProps {
  state: AppState;
  updateState: (key: keyof AppState, value: number | boolean | string) => void;
  resetToDefault: () => void;
  predX: number;
  predY: number;
  scoreX: { results: Record<string, import('../lib/shaperLogic').ShaperScore>; best_shaper: string };
  scoreY: { results: Record<string, import('../lib/shaperLogic').ShaperScore>; best_shaper: string };
  profiles: string[];
  saveProfile: (name: string) => void;
  loadProfile: (name: string) => void;
  deleteProfile: (name: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  state, updateState, resetToDefault, predX, predY, scoreX, scoreY, profiles, saveProfile, loadProfile, deleteProfile 
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

  const displayAccel = (a: number) => Math.round(a / 100.0) * 100.0;

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo-section" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'flex-start',
          gap: '12px',
          width: '100%', 
          padding: '10px 8px', 
          marginBottom: '10px' 
        }}>
          <Waveform size={36} weight="duotone" color="#00ffff" style={{ filter: 'drop-shadow(0 0 8px rgba(0, 255, 255, 0.6))' }} />
          <h2 style={{
            margin: 0,
            fontSize: '2rem',
            fontWeight: 800,
            fontFamily: '"Inter", "Roboto", sans-serif',
            background: 'linear-gradient(90deg, #a855f7 0%, #06b6d4 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 0 8px rgba(168, 85, 247, 0.4))',
            letterSpacing: '0.5px'
          }}>
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
              className="btn-icon btn-save" 
              title="Save Profile" 
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
              className="btn-icon btn-delete" 
              title="Delete Selected" 
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
        <div className="control-group" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-5px', marginBottom: '10px' }}>
          <button 
            className="nav-btn nav-btn-clear" 
            onClick={resetToDefault}
            style={{ fontSize: '0.85rem', padding: '4px 8px' }}
          >
            <ArrowCounterClockwise size={14} weight="bold" style={{ marginRight: '4px' }} /> Reset All Defaults
          </button>
        </div>
        <div className="control-group">
          <label htmlFor="dampingRatio">
            <span>Damping Ratio</span>
            <span className="value-display">{state.dampingRatio.toFixed(3)}</span>
          </label>
          <input type="range" id="dampingRatio" min="0.010" max="0.200" step="0.005" value={state.dampingRatio} onChange={handleChange} />
          <div className="tension-display" style={{ textAlign: 'left', marginTop: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.3' }}>
              <b>Tip:</b> Rigid frames "ring" longer. Use lower values (0.04–0.07) for rigid billet frames, higher (0.10–0.15) for flexible bare/VHB frames.
            </span>
          </div>
        </div>
        <div className="control-group">
          <label htmlFor="scv">
            <span>Square Corner Velocity</span>
            <span className="value-display">{state.scv.toFixed(1)}</span>
          </label>
          <input type="range" id="scv" min="1.0" max="20.0" step="0.5" value={state.scv} onChange={handleChange} />
        </div>
        <div className="control-group">
          <label htmlFor="maxX">
            <span>Max Frequency (Hz)</span>
            <span className="value-display">{state.maxX} Hz</span>
          </label>
          <input type="range" id="maxX" value={state.maxX || 400} step="10" min="50" max="1000" onChange={handleChange} />
        </div>
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
          <input type="range" id="beltTune" min="50" max="400" step="1" value={state.beltTune} onChange={handleChange} />
          <div className="tension-display">
            <span>{state.beltTune} Hz (~{getBeltTensionN(state.beltType, state.beltTune).toFixed(1)} N)</span>
          </div>
        </div>
        <div className="control-group">
          <label htmlFor="frameStiffness">
            <span>Frame Stiffness</span>
            <span className="value-display">{state.frameStiffness.toFixed(1)}</span>
          </label>
          <input type="range" id="frameStiffness" min="0.5" max="10.0" step="0.1" value={state.frameStiffness} onChange={handleChange} />
          <div style={{ marginTop: '6px', display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: '10px', rowGap: '1px', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.7 }}>0.5</span>  <span>Acrylic / Poor</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.7 }}>1.0</span>  <span>Bare 2020</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.7 }}>4.0</span>  <span>Bare 4040</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.7 }}>5.0</span>  <span>2020 + 3mm Alu panel</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.7 }}>6.5</span>  <span>2020 + 5mm Alu panel</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.7 }}>7.5</span>  <span>4040 + 3mm Alu panel</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.7 }}>9.0</span>  <span>4040 + 5mm Alu panel</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.7 }}>10.0</span> <span>CNC Billet / Cast Iron</span>
          </div>
          <div style={{ marginTop: '6px', fontSize: '10px', color: 'var(--text-secondary)', lineHeight: '1.3', opacity: 0.8 }}>
            <em>* Panels must be continuously bolted/bonded to extrusions — flimsy printed clips don't add stiffness.</em><br />
            <em style={{ display: 'inline-block', marginTop: '3px' }}>* ACM/PC composite panels have less than half the shear rigidity of solid aluminum.</em>
          </div>
        </div>

        <details className="sub-category">
          <summary>Stepper Motors (A/B Drives)</summary>
          <div className="sub-category-content">
            <div className="control-group">
              <label htmlFor="motorPreset">Motor Preset</label>
              <select id="motorPreset" value={state.motorPreset} onChange={(e) => {
                const val = e.target.value;
                updateState('motorPreset', val);
                const motorPresets: Record<string, {torque: number, inertia: number}> = {
                    'ldo-48': { torque: 550, inertia: 84.5 },
                    'ldo-40': { torque: 450, inertia: 54.0 },
                    'ldo-kraken': { torque: 800, inertia: 138.0 },
                    'moons': { torque: 550, inertia: 82.0 },
                    'stepperonline': { torque: 590, inertia: 82.0 },
                    'excit3d-max': { torque: 560, inertia: 82.0 }
                };
                if (val !== 'custom' && motorPresets[val]) {
                    updateState('motorTorque', motorPresets[val].torque);
                    updateState('motorInertia', motorPresets[val].inertia);
                }
              }}>
                <option value="custom">Custom...</option>
                <option value="ldo-48">LDO-42STH48-2504AC</option>
                <option value="ldo-40">LDO-42STH40-1684AC</option>
                <option value="ldo-kraken">LDO-42STH60-3004HA (Kraken)</option>
                <option value="moons">Moons MS17HD6P4200</option>
                <option value="stepperonline">StepperOnline 17HS19</option>
                <option value="excit3d-max">Excit3D MaxMotor</option>
              </select>
            </div>
            <div className="control-group">
              <label htmlFor="motorTorque">Rated Holding Torque (mNm)</label>
              <input type="number" id="motorTorque" value={state.motorTorque} step="10" onChange={(e) => {
                updateState('motorPreset', 'custom');
                updateState('motorTorque', parseFloat(e.target.value));
              }} />
            </div>
            <div className="control-group">
              <label htmlFor="motorInertia">Rotor Inertia (g·cm²)</label>
              <input type="number" id="motorInertia" value={state.motorInertia} step="0.1" onChange={(e) => {
                updateState('motorPreset', 'custom');
                updateState('motorInertia', parseFloat(e.target.value));
              }} />
            </div>
            <div className="control-group">
              <label htmlFor="motorCurrent">
                <span>Run Current</span>
                <span className="value-display">{state.motorCurrent}%</span>
              </label>
              <input type="range" id="motorCurrent" min="10" max="150" step="1" value={state.motorCurrent} onChange={handleChange} />
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
            <div className={`control-group ${!state.enableDynamicSpeed ? 'disabled-group' : ''}`}>
              <label htmlFor="printSpeed">
                <span>Print Speed (mm/s)</span>
                <span className="value-display">{state.printSpeed} mm/s</span>
              </label>
              <input type="range" id="printSpeed" min="0" max="1000" step="10" value={state.printSpeed} onChange={handleChange} disabled={!state.enableDynamicSpeed} />
              <div className="tension-display" style={{ textAlign: 'left', marginTop: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.3' }}>
                  <b>Tip:</b> Simulates torque drop-off (shifts resonance peaks lower) and GT2 belt tooth meshing at <b>{(state.printSpeed / 2).toFixed(0)} Hz</b>.
                </span>
              </div>
            </div>
            <div className="control-group">
              <div className="tension-display" style={{ textAlign: 'left', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.3', display: 'inline-block' }}>
                  <b>Tip:</b> Measure all offsets (COM, ADXL, Nozzle) as the physical distance (in mm) from the <b>linear rail carriage center</b>.<br/><br/>
                  <b style={{ opacity: 0.8 }}>Directions (looking from front):</b><br/>
                  <span style={{ opacity: 0.8 }}>• <b>X:</b> (-) Left / (+) Right</span><br/>
                  <span style={{ opacity: 0.8 }}>• <b>Y:</b> (-) Front / (+) Back</span><br/>
                  <span style={{ opacity: 0.8 }}>• <b>Z:</b> (-) Down / (+) Up</span><br/><br/>
                  <b style={{ color: '#ffb84d', opacity: 0.9 }}>⚠ Important:</b><br/>
                  <span style={{ opacity: 0.8 }}>Do not use any offset unless you are going to set them all correctly.</span>
                  
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button className="export-btn" style={{ padding: '4px 8px', fontSize: '11px', flex: 1 }} onClick={() => {
                      updateState('twistX', 0); updateState('twistY', 0); updateState('twistZ', 0);
                      updateState('adxlOffsetX', 0); updateState('adxlOffsetY', 0); updateState('adxlOffsetZ', 0);
                      updateState('nozzleOffsetX', 0); updateState('nozzleOffsetY', 0); updateState('nozzleOffsetZ', 0);
                      updateState('nozzleMountedADXL', false);
                    }}>Reset All</button>
                    <button className="export-btn" style={{ padding: '4px 8px', fontSize: '11px', flex: 1 }} onClick={() => {
                      updateState('twistX', 0); updateState('twistY', -20); updateState('twistZ', -10);
                      updateState('adxlOffsetX', 0); updateState('adxlOffsetY', -45); updateState('adxlOffsetZ', 15);
                      updateState('nozzleOffsetX', 0); updateState('nozzleOffsetY', -35); updateState('nozzleOffsetZ', -40);
                      updateState('nozzleMountedADXL', false);
                    }}>Stealthburner</button>
                  </div>
                </span>
              </div>
              <label htmlFor="twistX"><span>X COM Offset (mm) <span style={{opacity:0.55, fontSize:'10px'}}>(affects Y-axis graph)</span></span><span className="value-display">{state.twistX} mm</span></label>
              <input type="range" id="twistX" min="-100" max="100" step="1" value={state.twistX} onChange={handleChange} />
            </div>
            <div className="control-group">
              <label htmlFor="twistY"><span>Y COM Offset (mm) <span style={{opacity:0.55, fontSize:'10px'}}>(affects X-axis graph)</span></span><span className="value-display">{state.twistY} mm</span></label>
              <input type="range" id="twistY" min="-100" max="100" step="1" value={state.twistY} onChange={handleChange} />
            </div>
            <div className="control-group">
              <label htmlFor="twistZ"><span>Z COM Offset (mm) <span style={{opacity:0.55, fontSize:'10px'}}>(affects both axes)</span></span><span className="value-display">{state.twistZ} mm</span></label>
              <input type="range" id="twistZ" min="-100" max="100" step="1" value={state.twistZ} onChange={handleChange} />
            </div>
            <div className="control-group checkbox-group" style={{ marginTop: '10px' }}>
              <input type="checkbox" id="nozzleMountedADXL" className="checkbox-input" checked={state.nozzleMountedADXL} onChange={handleChange} />
              <label htmlFor="nozzleMountedADXL" className="checkbox-label">Nozzle-Mounted ADXL</label>
            </div>
            {!state.nozzleMountedADXL && (
              <>
                <div className="control-group">
                  <label htmlFor="adxlOffsetX"><span>X ADXL Offset (mm)</span><span className="value-display">{state.adxlOffsetX} mm</span></label>
                  <input type="range" id="adxlOffsetX" min="-100" max="100" step="1" value={state.adxlOffsetX} onChange={handleChange} />
                </div>
                <div className="control-group">
                  <label htmlFor="adxlOffsetY"><span>Y ADXL Offset (mm)</span><span className="value-display">{state.adxlOffsetY} mm</span></label>
                  <input type="range" id="adxlOffsetY" min="-100" max="100" step="1" value={state.adxlOffsetY} onChange={handleChange} />
                </div>
                <div className="control-group">
                  <label htmlFor="adxlOffsetZ"><span>Z ADXL Offset (mm)</span><span className="value-display">{state.adxlOffsetZ} mm</span></label>
                  <input type="range" id="adxlOffsetZ" min="-100" max="100" step="1" value={state.adxlOffsetZ} onChange={handleChange} />
                </div>
              </>
            )}
            <div className="control-group" style={{ marginTop: '10px' }}>
              <label htmlFor="nozzleOffsetX"><span>X Nozzle Offset (mm)</span><span className="value-display">{state.nozzleOffsetX} mm</span></label>
              <input type="range" id="nozzleOffsetX" min="-100" max="100" step="1" value={state.nozzleOffsetX} onChange={handleChange} />
            </div>
            <div className="control-group">
              <label htmlFor="nozzleOffsetY"><span>Y Nozzle Offset (mm)</span><span className="value-display">{state.nozzleOffsetY} mm</span></label>
              <input type="range" id="nozzleOffsetY" min="-100" max="100" step="1" value={state.nozzleOffsetY} onChange={handleChange} />
            </div>
            <div className="control-group">
              <label htmlFor="nozzleOffsetZ"><span>Z Nozzle Offset (mm)</span><span className="value-display">{state.nozzleOffsetZ} mm</span></label>
              <input type="range" id="nozzleOffsetZ" min="-100" max="100" step="1" value={state.nozzleOffsetZ} onChange={handleChange} />
            </div>
            <div className="control-group" style={{ marginTop: '10px' }}>
              <label htmlFor="toolheadStiffness"><span>Toolhead Material Stiffness</span><span className="value-display">{state.toolheadStiffness.toFixed(1)}x</span></label>
              <input type="range" id="toolheadStiffness" min="1.0" max="3.0" step="0.1" value={state.toolheadStiffness} onChange={handleChange} />
              <div style={{ marginTop: '6px', display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: '10px', rowGap: '1px', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.7 }}>1.0</span>  <span>Thick ABS/ASA (Standard)</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.7 }}>1.5</span>  <span>Topo. Optimized Plastic / CF</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.7 }}>2.0</span>  <span>Topo. CF / Machined Alu / Basic SLM</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.7 }}>2.5</span>  <span>Topology Optimized CNC</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.7 }}>3.0</span>  <span>Topology Optimized SLM</span>
              </div>
            </div>
            <div className="control-group" style={{ marginTop: '10px' }}>
              <label htmlFor="bearingPreload">X-Rail Bearing Preload</label>
              <select id="bearingPreload" value={state.bearingPreload} onChange={(e) => updateState('bearingPreload', parseFloat(e.target.value))}>
                <option value="0.7">MGN9 Z0 (Light / Micro-slop)</option>
                <option value="0.85">MGN12 Z0 (Light Preload)</option>
                <option value="1">MGN12 Z1 (Medium Preload - Standard)</option>
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
            <div className="control-group">
              <label htmlFor="beltTensionDiff"><span>Unequal Belt Tension (Split Peak)</span><span className="value-display">{state.beltTensionDiff}%</span></label>
              <input type="range" id="beltTensionDiff" min="0" max="50" step="5" value={state.beltTensionDiff} onChange={handleChange} />
            </div>
            <div className="control-group">
              <label htmlFor="gantryRacking"><span>Gantry Racking (Y only)</span><span className="value-display">{state.gantryRacking}%</span></label>
              <input type="range" id="gantryRacking" min="0" max="100" step="5" value={state.gantryRacking} onChange={handleChange} />
            </div>
          </div>
        </details>

        <details className="sub-category">
          <summary>External & Umbilical</summary>
          <div className="sub-category-content">
            <div className="control-group">
              <label htmlFor="externalSway"><span>External Sway</span><span className="value-display">{state.externalSway}%</span></label>
              <input type="range" id="externalSway" min="0" max="100" step="5" value={state.externalSway} onChange={handleChange} />
            </div>
            <div className="control-group">
              <label htmlFor="externalSwayFreq"><span>Sway Frequency (Hz)</span><span className="value-display">{state.externalSwayFreq} Hz</span></label>
              <input type="range" id="externalSwayFreq" min="5" max="35" step="1" value={state.externalSwayFreq} onChange={handleChange} />
            </div>
            <div className="control-group">
              <label htmlFor="squishyFeet"><span>Squishy Materials</span><span className="value-display">{state.squishyFeet}%</span></label>
              <input type="range" id="squishyFeet" min="0" max="100" step="5" value={state.squishyFeet} onChange={handleChange} />
            </div>
            <div className="control-group">
              <label htmlFor="hoseDrag"><span>Hose Drag Amplitude</span><span className="value-display">{state.hoseDrag}%</span></label>
              <input type="range" id="hoseDrag" min="0" max="100" step="5" value={state.hoseDrag} onChange={handleChange} />
            </div>
            <div className="control-group">
              <label htmlFor="hoseDragFreq"><span>Hose Drag Freq (Hz)</span><span className="value-display">{state.hoseDragFreq} Hz</span></label>
              <input type="range" id="hoseDragFreq" min="5" max="35" step="1" value={state.hoseDragFreq} onChange={handleChange} />
            </div>
            <div className="control-group">
              <label htmlFor="hoseSquishy"><span>Hose Damping</span><span className="value-display">{state.hoseSquishy}%</span></label>
              <input type="range" id="hoseSquishy" min="0" max="100" step="5" value={state.hoseSquishy} onChange={handleChange} />
            </div>
          </div>
        </details>
      </details>

      <div className="control-section">
        <div className="prediction-box mt-0">
          <h4>Predicted Resonance</h4>
          <div className="prediction-freq-list">
            <div className="prediction-item">
              <span className="axis-label">X Axis</span>
              <span className="freq-val">{predX.toFixed(1)} Hz</span>
              {scoreX?.best_shaper && (
                <div className="shaper-detail">
                  {displayAccel(scoreX.results[scoreX.best_shaper].max_accel)} mm/s² | {scoreX.best_shaper}
                </div>
              )}
            </div>
            <div className="prediction-item">
              <span className="axis-label">Y Axis</span>
              <span className="freq-val">{(predY || 0).toFixed(1)} Hz</span>
              {scoreY?.best_shaper && (
                <div className="shaper-detail">
                  {displayAccel(scoreY.results[scoreY.best_shaper].max_accel)} mm/s² | {scoreY.best_shaper}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
