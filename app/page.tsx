'use client';

import { ChangeEvent, FormEvent, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { allocateTeams, moveMember, normalizeInstitution, Participant, swapMembers, Team, validateParticipants } from './lib/teamAllocator';
import { buildExportRows, parseParticipantWorkbook, teamsToCsv } from './lib/tabular';

const blankParticipant = (): Participant => ({ id: crypto.randomUUID(), name: '', institution: '', email: '', phone: '', skill: '' });
const initials = (name: string) => name.split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase();

function downloadBlob(content: BlobPart, filename: string, type: string) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([content], { type }));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export default function Home() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [minSize, setMinSize] = useState(3);
  const [maxSize, setMaxSize] = useState(5);
  const [view, setView] = useState<'participants' | 'teams'>('participants');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Participant | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const issues = useMemo(() => validateParticipants(participants), [participants]);
  const blockingIssues = issues.filter((issue) => issue.type === 'error');
  const institutionCount = new Set(participants.map((person) => normalizeInstitution(person.institution)).filter(Boolean)).size;
  const filtered = participants.filter((person) => `${person.name} ${person.institution} ${person.skill}`.toLowerCase().includes(query.toLowerCase()));

  const saveParticipant = (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    const clean = { ...editing, name: editing.name.trim().replace(/\s+/g, ' '), institution: editing.institution.trim().replace(/\s+/g, ' '), email: editing.email?.trim(), phone: editing.phone?.trim(), skill: editing.skill?.trim() };
    setParticipants((current) => current.some((person) => person.id === clean.id) ? current.map((person) => person.id === clean.id ? clean : person) : [...current, clean]);
    setTeams([]);
    setEditing(null);
  };

  const clearAll = () => {
    if (!participants.length || !window.confirm('Clear all participants and generated teams? This cannot be undone.')) return;
    setParticipants([]);
    setTeams([]);
    setSelected([]);
    setQuery('');
    setView('participants');
    setNotice({ kind: 'success', text: 'All participants and team allocations have been cleared.' });
  };

  const generate = () => {
    if (blockingIssues.length) {
      setNotice({ kind: 'error', text: `Resolve ${blockingIssues.length} validation ${blockingIssues.length === 1 ? 'error' : 'errors'} before randomizing.` });
      return;
    }
    const result = allocateTeams(participants, minSize, maxSize);
    if (!result.ok) {
      setNotice({ kind: 'error', text: `${result.message} ${result.suggestion}` });
      return;
    }
    setTeams(result.teams);
    setView('teams');
    setSelected([]);
    setNotice({ kind: 'success', text: `${participants.length} participants assigned to ${result.teams.length} valid teams.` });
  };

  const readUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imported = parseParticipantWorkbook(await file.arrayBuffer());
      if (!imported.length) throw new Error('No rows found');
      setParticipants(imported); setTeams([]); setView('participants');
      setNotice({ kind: 'success', text: `Imported ${imported.length} participants from ${file.name}. Review validation before randomizing.` });
    } catch {
      setNotice({ kind: 'error', text: 'That file could not be read. Use a CSV, XLS, or XLSX file with Name and Institution columns.' });
    }
    event.target.value = '';
  };

  const handleSwap = () => {
    if (selected.length !== 2) return setNotice({ kind: 'error', text: 'Select exactly two participants from different teams to swap.' });
    const result = swapMembers(teams, selected[0], selected[1], minSize, maxSize);
    if (!result.ok) setNotice({ kind: 'error', text: `${result.message} ${result.suggestion}` });
    else { setTeams(result.teams); setSelected([]); setNotice({ kind: 'success', text: 'Participants swapped. All team constraints remain valid.' }); }
  };

  const handleMove = (participantId: string, destinationId: number) => {
    const result = moveMember(teams, participantId, destinationId, minSize, maxSize);
    if (!result.ok) setNotice({ kind: 'error', text: `${result.message} ${result.suggestion}` });
    else { setTeams(result.teams); setNotice({ kind: 'success', text: 'Participant moved. All team constraints remain valid.' }); }
  };

  const exportRows = buildExportRows(teams);
  const exportCsv = () => {
    downloadBlob(teamsToCsv(teams), 'ciris-hackathon-teams.csv', 'text/csv;charset=utf-8');
  };
  const exportExcel = () => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(exportRows), 'Teams');
    XLSX.writeFile(book, 'ciris-hackathon-teams.xlsx');
  };

  return <main className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={() => setView('participants')} aria-label="CIRIS team builder home"><span className="brand-mark">C</span><span><strong>CIRIS</strong><small>Team Builder</small></span></button>
      <div className="event-name"><span className="event-dot" /> Agriculture &amp; Climate Action Hackathon</div>
      <div className="admin-chip"><span>AD</span><div><strong>Admin Desk</strong><small>Event official</small></div></div>
    </header>
    <nav className="step-nav" aria-label="Workflow"><button className={view === 'participants' ? 'active' : ''} onClick={() => setView('participants')}><span>1</span> Participants <b>{participants.length}</b></button><i /><button className={view === 'teams' ? 'active' : ''} onClick={() => teams.length && setView('teams')} disabled={!teams.length}><span>2</span> Team allocation</button></nav>
    {notice && <div className={`notice ${notice.kind}`} role="status"><span>{notice.kind === 'success' ? '✓' : '!'}</span>{notice.text}<button onClick={() => setNotice(null)} aria-label="Dismiss">×</button></div>}

    {view === 'participants' ? <div className="workspace">
      <section className="main-panel">
        <div className="page-heading"><div><p className="eyebrow">ROSTER SETUP</p><h1>Participants</h1><p>Add everyone taking part, then review the roster before creating balanced teams.</p></div><div className="heading-actions"><a className="button secondary" href="/ciris-participant-upload-template.csv" download>↓ Sample CSV</a><button className="button danger" onClick={clearAll} disabled={!participants.length}>Clear all</button><input ref={fileRef} hidden type="file" accept=".csv,.xls,.xlsx" onChange={readUpload} /><button className="button secondary" onClick={() => fileRef.current?.click()}>⇧ Upload CSV / Excel</button><button className="button primary" onClick={() => setEditing(blankParticipant())}>＋ Add participant</button></div></div>
        <div className="stat-grid"><article><span className="stat-icon green">◎</span><div><small>TOTAL PARTICIPANTS</small><strong>{participants.length}</strong></div><em>Ready to review</em></article><article><span className="stat-icon blue">◇</span><div><small>INSTITUTIONS</small><strong>{institutionCount}</strong></div><em>Diverse representation</em></article><article><span className={`stat-icon ${blockingIssues.length ? 'red' : 'green'}`}>{blockingIssues.length ? '!' : '✓'}</span><div><small>DATA QUALITY</small><strong>{blockingIssues.length ? `${blockingIssues.length} issues` : 'All clear'}</strong></div><em>{blockingIssues.length ? 'Needs attention' : 'Ready to randomize'}</em></article></div>
        {issues.length > 0 && <div className="validation-box"><strong>Validation review</strong><span>{blockingIssues.length ? 'Fix the highlighted records before generating teams.' : 'Review these possible matches.'}</span>{issues.slice(0, 4).map((issue, index) => <p key={`${issue.participantId}-${index}`}>• {issue.message}</p>)}</div>}
        <div className="table-card"><div className="table-tools"><div><strong>Participant roster</strong><span>{filtered.length} of {participants.length} people</span></div><label className="search">⌕<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, institution or skill" /></label></div><div className="table-scroll"><table><thead><tr><th>Participant</th><th>Institution / organisation</th><th>Area of expertise</th><th>Contact</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{filtered.map((person) => {
          const hasError = issues.some((issue) => issue.participantId === person.id && issue.type === 'error');
          return <tr key={person.id} className={hasError ? 'row-error' : ''}><td><div className="person-cell"><span className="avatar">{initials(person.name || '?')}</span><div><strong>{person.name || 'Missing name'}</strong><small>{person.email || 'No email provided'}</small></div></div></td><td><strong className="institution">{person.institution || 'Missing institution'}</strong></td><td><span className="skill-tag">{person.skill || 'Not specified'}</span></td><td><span className="phone">{person.phone || '—'}</span></td><td><div className="row-actions"><button onClick={() => setEditing(person)}>Edit</button><button className="delete" onClick={() => { setParticipants((current) => current.filter((item) => item.id !== person.id)); setTeams([]); }} aria-label={`Delete ${person.name}`}>×</button></div></td></tr>;
        })}</tbody></table></div>{!filtered.length && <div className="empty-state">{participants.length ? 'No participants match your search.' : 'No participants yet. Add someone manually or upload a CSV/Excel file.'}</div>}</div>
      </section>
      <aside className="control-panel"><div className="control-title"><span>✦</span><div><p className="eyebrow">ALLOCATION RULES</p><h2>Generate teams</h2></div></div><p className="control-copy">We’ll randomize the roster while protecting institution diversity.</p><div className="size-fields"><label>Minimum team size<input type="number" min="1" max="20" value={minSize} onChange={(e) => setMinSize(Number(e.target.value))} /></label><label>Maximum team size<input type="number" min="1" max="20" value={maxSize} onChange={(e) => setMaxSize(Number(e.target.value))} /></label></div><div className="rule-card"><span>✓</span><div><strong>Institution guardrail</strong><p>No two people from the same institution will ever share a team.</p></div></div><div className="rule-list"><p><span>01</span> Sizes stay as equal as possible</p><p><span>02</span> Every eligible person is assigned once</p><p><span>03</span> Impossible distributions are stopped</p></div><button className="randomize" onClick={generate} disabled={!!blockingIssues.length || participants.length === 0}>Randomize teams <span>→</span></button>{!!blockingIssues.length && <p className="blocked-note">Resolve roster errors to continue.</p>}<p className="privacy-note">Your roster is processed in this browser and is not sent to an external database.</p></aside>
    </div> : <section className="results-page">
      <div className="page-heading results-heading"><div><p className="eyebrow">ALLOCATION COMPLETE</p><h1>Your teams are ready</h1><p>{participants.length} participants · {teams.length} teams · institution rule verified</p></div><div className="heading-actions no-print"><button className="button secondary" onClick={generate}>↻ Randomize again</button><button className="button secondary" onClick={() => window.print()}>⌘ Print</button><div className="export-group"><button className="button primary" onClick={exportCsv}>Export CSV</button><button className="button primary compact" onClick={exportExcel}>Excel</button></div></div></div>
      <div className="result-summary"><span><b>{participants.length}</b> Participants</span><span><b>{teams.length}</b> Teams</span><span><b>{Math.min(...teams.map((team) => team.members.length))}–{Math.max(...teams.map((team) => team.members.length))}</b> Members per team</span><span className="verified">✓ All constraints verified</span></div>
      <div className="adjust-bar no-print"><div><strong>Manual adjustments</strong><span>Select two participants in different teams, then swap them. Moves are available per member.</span></div><button className="button secondary" onClick={handleSwap} disabled={selected.length !== 2}>Swap selected ({selected.length}/2)</button></div>
      <div className="team-grid">{teams.map((team, teamIndex) => <article className="team-card" key={team.id}><header><div><span className={`team-number color-${teamIndex % 4}`}>{String(team.id).padStart(2, '0')}</span><div><h2>Team {team.id}</h2><p>{team.members.length} members · {team.members.length} institutions</p></div></div><span className="valid-chip">✓ Valid</span></header><div className="member-list">{team.members.map((member) => <div className={`member ${selected.includes(member.id) ? 'selected' : ''}`} key={member.id}><button className="select-member no-print" aria-label={`Select ${member.name} for swap`} onClick={() => setSelected((current) => current.includes(member.id) ? current.filter((id) => id !== member.id) : current.length < 2 ? [...current, member.id] : [current[1], member.id])}>{selected.includes(member.id) ? '✓' : ''}</button><span className="avatar">{initials(member.name)}</span><div className="member-main"><strong>{member.name}</strong><span>{member.institution}</span><small>{member.skill || 'Expertise not specified'}</small></div><select className="move-select no-print" value="" aria-label={`Move ${member.name}`} onChange={(event) => handleMove(member.id, Number(event.target.value))}><option value="">Move…</option>{teams.filter((item) => item.id !== team.id).map((item) => <option key={item.id} value={item.id}>Team {item.id}</option>)}</select></div>)}</div></article>)}</div>
      <div className="result-footer no-print"><button className="link-button" onClick={() => setView('participants')}>← Back to participants</button><span>Need a different mix? Randomize again or make a valid swap.</span></div>
    </section>}

    {editing && <div className="modal-backdrop" role="presentation" onMouseDown={() => setEditing(null)}><form className="modal" onSubmit={saveParticipant} onMouseDown={(event) => event.stopPropagation()}><div className="modal-header"><div><p className="eyebrow">PARTICIPANT DETAILS</p><h2>{participants.some((person) => person.id === editing.id) ? 'Edit participant' : 'Add participant'}</h2></div><button type="button" onClick={() => setEditing(null)} aria-label="Close">×</button></div><label>Full name <b>*</b><input autoFocus required value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} placeholder="e.g. Amina Wanjiku" /></label><label>Institution / organisation <b>*</b><input required value={editing.institution} onChange={(event) => setEditing({ ...editing, institution: event.target.value })} placeholder="e.g. Egerton University" /></label><div className="form-row"><label>Email address<input type="email" value={editing.email} onChange={(event) => setEditing({ ...editing, email: event.target.value })} placeholder="name@example.org" /></label><label>Phone number<input value={editing.phone} onChange={(event) => setEditing({ ...editing, phone: event.target.value })} placeholder="+254 700 000 000" /></label></div><label>Skill / area of expertise<input value={editing.skill} onChange={(event) => setEditing({ ...editing, skill: event.target.value })} placeholder="e.g. Data science" /></label><div className="modal-actions"><button type="button" className="button secondary" onClick={() => setEditing(null)}>Cancel</button><button className="button primary">Save participant</button></div></form></div>}
  </main>;
}
