import React from 'react';
import { COLOUR_NAMES, STYLE_NAMES } from '../lib/sslib/index';

const COLOURS = Object.values(COLOUR_NAMES);
const STYLES = Object.values(STYLE_NAMES);

const COLOUR_CSS = {
  grey: '#808080', white: '#ffffff', black: '#1a1a1a', brown: '#8B4513',
  dark_orange: '#cc6600', orange: '#ff8c00', light_grey: '#c0c0c0',
  dark_grey: '#505050', dark_grey_2: '#404040', red: '#dc2626',
  blue: '#2563eb', dark_red: '#8b0000', light_blue: '#60a5fa',
  green: '#16a34a', yellow: '#eab308',
};

function KitSetEditor({ kitSet, label, onChange }) {
  const update = (field, value) => {
    onChange({ ...kitSet, [field]: value });
  };

  const renderPreview = () => {
    const c1 = COLOUR_CSS[kitSet.shirt1] || '#888';
    const c2 = COLOUR_CSS[kitSet.shirt2] || '#888';

    if (kitSet.style === 'vertical') {
      return (
        <div className="kit-shirt-preview style-vertical">
          <div className="kit-stripe" style={{ background: c1 }} />
          <div className="kit-stripe" style={{ background: c2 }} />
        </div>
      );
    }
    if (kitSet.style === 'horizontal') {
      return (
        <div className="kit-shirt-preview style-horizontal">
          <div className="kit-stripe" style={{ background: c1 }} />
          <div className="kit-stripe" style={{ background: c2 }} />
        </div>
      );
    }
    if (kitSet.style === 'sleeves') {
      return (
        <div className="kit-shirt-preview" style={{
          background: `linear-gradient(90deg, ${c2} 20%, ${c1} 20%, ${c1} 80%, ${c2} 80%)`
        }} />
      );
    }
    return <div className="kit-shirt-preview" style={{ background: c1 }} />;
  };

  const colorRow = (field, labelText) => (
    <div className="kit-color-row">
      <label>{labelText}</label>
      <div className="color-swatch" style={{ background: COLOUR_CSS[kitSet[field]] || '#888' }} />
      <select value={kitSet[field]} onChange={e => update(field, e.target.value)}>
        {COLOURS.map(c => (
          <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="kit-set">
      <h5>{label}</h5>
      <div className="kit-preview">{renderPreview()}</div>
      <div className="kit-color-row">
        <label>Style</label>
        <select value={kitSet.style} onChange={e => update('style', e.target.value)}
          style={{ flex: 1, marginLeft: '16px' }}>
          {STYLES.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      {colorRow('shirt1', 'Shirt 1')}
      {colorRow('shirt2', 'Shirt 2')}
      {colorRow('shorts', 'Shorts')}
      {colorRow('socks', 'Socks')}
    </div>
  );
}

function KitEditor({ kit, onChange }) {
  const updateSet = (which, kitSet) => {
    onChange({ ...kit, [which]: kitSet });
  };

  return (
    <div className="editor-section">
      <h4>Kit</h4>
      <div className="kit-sets">
        <KitSetEditor
          kitSet={kit.first}
          label="Home Kit"
          onChange={set => updateSet('first', set)}
        />
        <KitSetEditor
          kitSet={kit.second}
          label="Away Kit"
          onChange={set => updateSet('second', set)}
        />
      </div>
    </div>
  );
}

export default React.memo(KitEditor);
