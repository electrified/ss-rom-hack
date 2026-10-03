import React from 'react';

export default class EditorBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div className="card" role="alert">
      <p>The editor could not display this document. Your current data is still available to export below.</p>
      <button onClick={() => {
        const url = URL.createObjectURL(new Blob([JSON.stringify(this.props.teams, null, 2)], {type: 'application/json'}));
        const a = document.createElement('a'); a.href = url; a.download = 'recovered-teams.json'; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}>Export current JSON</button>
      <button onClick={this.props.onRecover}>Restore last valid document</button>
    </div>;
  }
}
