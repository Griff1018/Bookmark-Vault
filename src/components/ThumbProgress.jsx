import React, { useState } from 'react';

const MARK = { ok: '✓', fail: '✗', skip: '–', running: '…' };

function elapsed(job) {
  const ms = (job.endedAt || Date.now()) - job.startedAt;
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

function Job({ job, open, onToggle }) {
  return (
    <li className={`tp-job ${job.status}`}>
      <div className="tp-job-head" onClick={onToggle}>
        <span className={`tp-mark ${job.status}`}>{job.status === 'running' ? '…' : job.status === 'ok' ? '✓' : '✗'}</span>
        <span className="tp-title" title={job.title}>{job.title}</span>
        <span className="tp-time">{elapsed(job)}</span>
      </div>
      {job.summary && <div className="tp-summary-line">{job.summary}</div>}
      {open && (
        <ul className="tp-steps">
          {job.steps.map((st) => (
            <li key={st.label} className={st.status}>
              <span className={`tp-mark ${st.status}`}>{MARK[st.status]}</span>
              <span className="tp-step-label">{st.label}</span>
              {st.detail && <span className="tp-detail" title={st.detail}>{st.detail}</span>}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function ThumbProgress({ jobs, onClose, onClear }) {
  const [toggled, setToggled] = useState({}); // jobId -> explicit open/closed
  const [collapsed, setCollapsed] = useState(false);

  const batch = jobs.find((j) => j.kind === 'batch' && j.status === 'running') || jobs.find((j) => j.kind === 'batch');
  const running = jobs.filter((j) => j.status === 'running' && j.kind !== 'batch').length;
  const visible = jobs.filter((j) => j.kind !== 'batch');
  const failed = visible.filter((j) => j.status === 'fail').length;
  const isOpen = (j) => (j.id in toggled ? toggled[j.id] : j.status !== 'ok');

  return (
    <div className="thumb-progress">
      <div className="tp-head">
        <strong>Progress</strong>
        <span className="tp-counts">{running > 0 ? `${running} running · ` : ''}{visible.length} total{failed ? ` · ${failed} failed` : ''}</span>
        <button className="tp-btn" onClick={() => setCollapsed(!collapsed)} title={collapsed ? 'Expand' : 'Collapse'}>{collapsed ? '▴' : '▾'}</button>
        <button className="tp-btn" onClick={onClear} title="Clear history">⌫</button>
        <button className="tp-btn" onClick={onClose} title="Close">×</button>
      </div>
      {batch && (
        <div className="tp-batch">
          <div className="tp-summary">
            {batch.title}: {batch.status === 'running' ? `${batch.done} / ${batch.total}` : batch.summary}
          </div>
          <div className="tp-bar"><div className="tp-fill" style={{ width: `${batch.total ? Math.round((batch.done / batch.total) * 100) : 100}%` }} /></div>
        </div>
      )}
      {!collapsed && (
        <ul className="tp-list">
          {visible.map((j) => (
            <Job key={j.id} job={j} open={isOpen(j)} onToggle={() => setToggled({ ...toggled, [j.id]: !isOpen(j) })} />
          ))}
        </ul>
      )}
    </div>
  );
}
