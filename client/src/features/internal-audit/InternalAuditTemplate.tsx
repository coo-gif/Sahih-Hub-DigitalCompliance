import { useEffect, useMemo, useState } from "react";
import {
  ALL_CHECKS, CLAUSES, OVERALL_LABEL, RATINGS, RATING_LABEL, SAMPLING_ITEMS, requiresAction, severityOf, summarize,
  toMarkdownReport, validateAudit, type AuditRecord, type CheckResponse, type Rating, type SamplingEntry,
} from "@shared/auditTemplate";
import "./internal-audit.css";

export interface AuditPermissions {
  canView: boolean;
  canEdit: boolean;
  canSubmit: boolean;
  canSignOff: boolean;
  canVerify: boolean;
  canDelete: boolean;
  myActions: string[];
}

export interface AuditView {
  id: number;
  reference: string;
  status: "draft" | "in_progress" | "pending_signoff" | "closed";
  record: AuditRecord;
  returnNote: string | null;
  leadAuditorName: string | null;
  submittedAt: string | null;
  submittedByName: string | null;
  signedOffAt: string | null;
  signedOffByName: string | null;
  updatedAt: string | null;
  permissions: AuditPermissions;
}

export interface AuditEvidence {
  generatedAt: string;
  checks: Record<string, { summary: string; attention: boolean }>;
  sampling: Record<string, { populationSize: string; sampleSize: string }>;
}

export interface AuditChanges {
  meta?: Partial<Pick<AuditRecord["meta"], "periodStart" | "periodEnd" | "scopeNotes" | "leadAuditorId" | "auditTeamIds">>;
  responses?: Record<string, Partial<CheckResponse>>;
  sampling?: Record<string, Partial<SamplingEntry>>;
}

interface Props {
  audit: AuditView;
  users: { id: number; name: string }[];
  evidence?: AuditEvidence;
  evidenceLoading?: boolean;
  canManageTeam: boolean;
  busy?: boolean;
  onSave: (changes: AuditChanges) => Promise<unknown>;
  onRefreshEvidence: () => void;
  onSubmit: () => Promise<unknown>;
  onSignOff: () => Promise<unknown>;
  onReturn: (note: string) => Promise<unknown>;
  onCompleteAction: (checkId: string, actionTaken: string) => Promise<unknown>;
  onVerify: (checkId: string, effective: boolean, note?: string) => Promise<unknown>;
}

const STATUS_LABEL: Record<AuditView["status"], string> = {
  draft: "Draft",
  in_progress: "In progress",
  pending_signoff: "Awaiting management sign-off",
  closed: "Closed (signed off)",
};

type Tab = "checks" | "sampling" | "actions" | "summary";

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * ISO/IEC 17021-1 internal audit, module by module (docs/ISO-17021-AUDIT-FRAMEWORK.md).
 * Edits are kept locally and saved together; corrective-action progress and sign-off are separate steps.
 */
export default function InternalAuditTemplate({
  audit, users, evidence, evidenceLoading, canManageTeam, busy,
  onSave, onRefreshEvidence, onSubmit, onSignOff, onReturn, onCompleteAction, onVerify,
}: Props) {
  const [record, setRecord] = useState<AuditRecord>(audit.record);
  const [changes, setChanges] = useState<AuditChanges>({});
  const [tab, setTab] = useState<Tab>("checks");
  const [clauseId, setClauseId] = useState(CLAUSES[0].id);
  const [returnNote, setReturnNote] = useState("");
  const [actionText, setActionText] = useState<Record<string, string>>({});
  const [verifyNote, setVerifyNote] = useState<Record<string, string>>({});
  const editable = audit.permissions.canEdit;
  const dirty = Object.keys(changes).length > 0;

  // A fresh copy from the server replaces local state once it has been saved
  useEffect(() => {
    setRecord(audit.record);
    setChanges({});
  }, [audit]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const summary = useMemo(() => summarize(record), [record]);
  const issues = useMemo(() => validateAudit(record), [record]);
  const clause = CLAUSES.find(c => c.id === clauseId)!;
  const userName = (id: number | null) => users.find(u => u.id === id)?.name ?? "";

  const setMeta = (patch: AuditChanges["meta"]) => {
    setRecord(r => ({ ...r, meta: { ...r.meta, ...patch } }));
    setChanges(c => ({ ...c, meta: { ...c.meta, ...patch } }));
  };
  const setResponse = (checkId: string, patch: Partial<CheckResponse>) => {
    setRecord(r => ({ ...r, responses: { ...r.responses, [checkId]: { ...r.responses[checkId], ...patch } } }));
    setChanges(c => ({ ...c, responses: { ...c.responses, [checkId]: { ...c.responses?.[checkId], ...patch } } }));
  };
  const setSampling = (key: string, patch: Partial<SamplingEntry>) => {
    setRecord(r => ({ ...r, sampling: { ...r.sampling, [key]: { ...r.sampling[key], ...patch } } }));
    setChanges(c => ({ ...c, sampling: { ...c.sampling, [key]: { ...c.sampling?.[key], ...patch } } }));
  };

  const save = async () => {
    await onSave(changes);
  };

  const fillSamplingFromSystem = () => {
    if (!evidence) return;
    for (const item of SAMPLING_ITEMS) {
      const e = evidence.sampling[item.key];
      if (e) setSampling(item.key, { populationSize: e.populationSize, sampleSize: e.sampleSize });
    }
  };

  const actionChecks = ALL_CHECKS.filter(c => requiresAction(record.responses[c.id].rating));

  return (
    <div className="ia" data-testid="internal-audit">
      <div className="ia-head">
        <div>
          <h1 className="ia-title">Internal Audit {record.meta.reference}</h1>
          <p className="ia-sub">
            ISO/IEC 17021-1:2015 · {record.meta.periodStart || "–"} to {record.meta.periodEnd || "–"} · Lead auditor {record.meta.leadAuditor || "–"} ·{" "}
            <strong>{STATUS_LABEL[audit.status]}</strong>
          </p>
        </div>
        <div className="ia-head-actions">
          <span className="ia-saved" aria-live="polite">
            {dirty ? "Unsaved changes" : audit.updatedAt ? `Saved ${new Date(audit.updatedAt).toLocaleString("en-GB")}` : ""}
          </span>
          <button type="button" className="ia-btn" onClick={() => download(`${record.meta.reference}.md`, toMarkdownReport(record), "text/markdown")}>
            Markdown
          </button>
          <button type="button" className="ia-btn" onClick={() => download(`${record.meta.reference}.json`, JSON.stringify(record, null, 2), "application/json")}>
            JSON
          </button>
          <button type="button" className="ia-btn" onClick={() => window.print()}>Print</button>
          {editable && (
            <button type="button" className="ia-btn ia-btn-primary" disabled={!dirty || busy} onClick={save} data-testid="button-save-audit">
              {busy ? "Saving…" : "Save"}
            </button>
          )}
        </div>
      </div>

      {audit.returnNote && audit.status === "in_progress" && (
        <p className="ia-issues" role="alert" style={{ listStyle: "none", paddingLeft: 0, marginBottom: 12 }}>
          Returned by management: {audit.returnNote}
        </p>
      )}

      <details className="ia-meta" open={audit.status === "draft"}>
        <summary>Audit details</summary>
        <div className="ia-meta-grid">
          <label className="ia-field">
            <span className="ia-label">Period start</span>
            <input type="date" value={record.meta.periodStart} disabled={!editable} onChange={e => setMeta({ periodStart: e.target.value })} />
          </label>
          <label className="ia-field">
            <span className="ia-label">Period end</span>
            <input type="date" value={record.meta.periodEnd} disabled={!editable} onChange={e => setMeta({ periodEnd: e.target.value })} />
          </label>
          <label className="ia-field">
            <span className="ia-label">Lead auditor</span>
            <select
              value={record.meta.leadAuditorId ?? ""}
              disabled={!editable || !canManageTeam}
              onChange={e => {
                const id = Number(e.target.value);
                setMeta({ leadAuditorId: id });
                setRecord(r => ({ ...r, meta: { ...r.meta, leadAuditor: userName(id) } }));
              }}
            >
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </label>
          <div className="ia-field">
            <span className="ia-label">Audit team</span>
            {editable && canManageTeam ? (
              <select
                multiple
                value={record.meta.auditTeamIds.map(String)}
                onChange={e => {
                  const ids = Array.from(e.target.selectedOptions).map(o => Number(o.value));
                  setMeta({ auditTeamIds: ids });
                  setRecord(r => ({ ...r, meta: { ...r.meta, auditTeam: ids.map(userName).join(", ") } }));
                }}
                style={{ minHeight: 80 }}
              >
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            ) : (
              <span>{record.meta.auditTeam || "–"}</span>
            )}
          </div>
          <label className="ia-field ia-wide">
            <span className="ia-label">Scope notes</span>
            <textarea rows={3} value={record.meta.scopeNotes} disabled={!editable} onChange={e => setMeta({ scopeNotes: e.target.value })} />
          </label>
        </div>
      </details>

      <div className="ia-progress">
        <span>{summary.assessed} of {summary.total} checks assessed</span>
        <div className="ia-bar" aria-hidden="true"><span style={{ width: `${(summary.assessed / summary.total) * 100}%` }} /></div>
        <span>{OVERALL_LABEL[summary.overall]}</span>
      </div>

      <div className="ia-tabs" role="tablist">
        {([
          ["checks", "Checks"],
          ["sampling", "Sampling"],
          ["actions", `Corrective actions (${actionChecks.length})`],
          ["summary", "Summary & sign-off"],
        ] as [Tab, string][]).map(([id, label]) => (
          <button key={id} type="button" role="tab" className="ia-tab" aria-selected={tab === id} onClick={() => setTab(id)} data-testid={`tab-${id}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "checks" && (
        <div className="ia-checks">
          <nav className="ia-nav" aria-label="Audit modules">
            {CLAUSES.map(c => {
              const cs = summary.byClause[c.id];
              return (
                <button key={c.id} type="button" className="ia-nav-item" aria-current={c.id === clauseId} onClick={() => setClauseId(c.id)}>
                  <span className="ia-nav-title">{c.number}. {c.title}</span>
                  <span className="ia-nav-meta">
                    {cs.assessed}/{cs.total}
                    <span className="ia-chip" data-rating={cs.worst}>{RATING_LABEL[cs.worst]}</span>
                  </span>
                </button>
              );
            })}
          </nav>

          <section className="ia-panel" aria-labelledby="ia-module-title">
            <h2 className="ia-h2" id="ia-module-title">Module {clause.number} – {clause.title}</h2>
            <p className="ia-req">{clause.requirement}</p>
            <details className="ia-guide">
              <summary>Objectives, questions and conclusion criteria</summary>
              <div className="ia-guide-grid">
                <div>
                  <h3>Control objectives</h3>
                  <ul>{clause.objectives.map(o => <li key={o}>{o}</li>)}</ul>
                </div>
                <div>
                  <h3>Audit evidence questions</h3>
                  <ul>{clause.questions.map(q => <li key={q}>{q}</li>)}</ul>
                </div>
                <div>
                  <h3>Conclusion criteria</h3>
                  <dl>
                    <dt>Compliant</dt><dd>{clause.criteria.compliant}</dd>
                    <dt>Observation</dt><dd>{clause.criteria.observation}</dd>
                    <dt>Non-conformity</dt><dd>{clause.criteria.nonConformity}</dd>
                  </dl>
                </div>
              </div>
            </details>

            <div className="ia-progress">
              <span>{evidence ? `System evidence as of ${new Date(evidence.generatedAt).toLocaleString("en-GB")}` : evidenceLoading ? "Loading system evidence…" : "System evidence not loaded"}</span>
              <span style={{ flex: 1 }} />
              <button type="button" className="ia-btn" onClick={onRefreshEvidence} disabled={evidenceLoading}>Refresh evidence</button>
            </div>

            <ol className="ia-list">
              {clause.checks.map(check => {
                const r = record.responses[check.id];
                const live = evidence?.checks[check.id];
                return (
                  <li key={check.id} className="ia-check" data-severity={severityOf(r.rating)} data-testid={`check-${check.id}`}>
                    <div className="ia-check-top">
                      <div style={{ flex: 1, minWidth: 220 }}>
                        <span className="ia-id">{check.id}</span>
                        <p className="ia-check-text">{check.text}</p>
                        <p className="ia-evidence">Evidence: {check.evidence.join(", ")}</p>
                        {live && (
                          <p className="ia-evidence" style={{ marginTop: 6 }}>
                            <strong>System: </strong>{live.summary}
                            {live.attention && <span className="ia-chip" data-rating="minor_nc" style={{ marginLeft: 6 }}>Look closer</span>}
                          </p>
                        )}
                      </div>
                      <label className="ia-rating">
                        <span className="ia-label">Result</span>
                        <select
                          value={r.rating}
                          disabled={!editable}
                          onChange={e => setResponse(check.id, { rating: e.target.value as Rating })}
                          data-testid={`rating-${check.id}`}
                        >
                          {RATINGS.map(def => <option key={def.value} value={def.value}>{def.label}</option>)}
                        </select>
                      </label>
                    </div>

                    {r.rating !== "not_assessed" && (
                      <div className="ia-detail">
                        <label className="ia-field">
                          <span className="ia-label">Evidence reference{r.rating !== "compliant" ? " (required)" : ""}</span>
                          <input
                            value={r.evidenceRef}
                            disabled={!editable}
                            placeholder="Record IDs, document codes, report period…"
                            onChange={e => setResponse(check.id, { evidenceRef: e.target.value })}
                            data-testid={`evidence-${check.id}`}
                          />
                        </label>
                        {editable && live && (
                          <button type="button" className="ia-btn" style={{ alignSelf: "flex-start" }}
                            onClick={() => setResponse(check.id, { evidenceRef: `${r.evidenceRef ? `${r.evidenceRef}; ` : ""}System ${new Date(evidence!.generatedAt).toISOString().slice(0, 10)}: ${live.summary}` })}>
                            Use system evidence
                          </button>
                        )}
                        <label className="ia-field">
                          <span className="ia-label">What was found</span>
                          <textarea rows={2} value={r.details} disabled={!editable} onChange={e => setResponse(check.id, { details: e.target.value })} />
                        </label>
                        {requiresAction(r.rating) && (
                          <fieldset className="ia-action">
                            <legend>Corrective action (required)</legend>
                            <label className="ia-field">
                              <span className="ia-label">Root cause</span>
                              <textarea rows={2} value={r.rootCause} disabled={!editable} onChange={e => setResponse(check.id, { rootCause: e.target.value })} />
                            </label>
                            <label className="ia-field">
                              <span className="ia-label">Corrective action</span>
                              <textarea rows={2} value={r.correctiveAction} disabled={!editable} onChange={e => setResponse(check.id, { correctiveAction: e.target.value })} />
                            </label>
                            <div className="ia-row">
                              <label className="ia-field">
                                <span className="ia-label">Owner</span>
                                <select
                                  value={r.ownerId ?? ""}
                                  disabled={!editable}
                                  onChange={e => {
                                    const id = e.target.value ? Number(e.target.value) : null;
                                    setResponse(check.id, { ownerId: id, owner: id ? userName(id) : "" });
                                  }}
                                  data-testid={`owner-${check.id}`}
                                >
                                  <option value="">Choose…</option>
                                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                              </label>
                              <label className="ia-field">
                                <span className="ia-label">Due date ({r.rating === "major_nc" ? "14 days suggested" : "30 days suggested"})</span>
                                <input type="date" value={r.dueDate} disabled={!editable} onChange={e => setResponse(check.id, { dueDate: e.target.value })} data-testid={`due-${check.id}`} />
                              </label>
                            </div>
                            {(r.actionCompleted || r.effectivenessVerified) && (
                              <p className="ia-evidence">
                                {r.effectivenessVerified ? "Verified effective. " : "Action recorded, awaiting verification. "}
                                {r.actionTaken && `Action taken: ${r.actionTaken}`}
                              </p>
                            )}
                          </fieldset>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
      )}

      {tab === "sampling" && (
        <section>
          <div className="ia-progress">
            <span>Record the population, sample size and completion for each population (framework section 8).</span>
            <span style={{ flex: 1 }} />
            {editable && <button type="button" className="ia-btn" disabled={!evidence} onClick={fillSamplingFromSystem}>Fill sizes from system</button>}
          </div>
          <ol className="ia-list">
            {SAMPLING_ITEMS.map(item => {
              const e = record.sampling[item.key];
              const live = evidence?.sampling[item.key];
              return (
                <li key={item.key} className="ia-check" data-severity={e.completed ? "low" : undefined} data-testid={`sampling-${item.key}`}>
                  <div className="ia-check-top">
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <p className="ia-check-text">{item.label}</p>
                      <p className="ia-evidence">{item.rule}{live ? ` · System: population ${live.populationSize}, suggested sample ${live.sampleSize}` : ""}</p>
                    </div>
                    <label className="ia-check-row">
                      <input type="checkbox" checked={e.completed} disabled={!editable} onChange={ev => setSampling(item.key, { completed: ev.target.checked })} />
                      Sample checked
                    </label>
                  </div>
                  <div className="ia-row" style={{ marginTop: 10 }}>
                    <label className="ia-field">
                      <span className="ia-label">Population size</span>
                      <input value={e.populationSize} disabled={!editable} onChange={ev => setSampling(item.key, { populationSize: ev.target.value })} />
                    </label>
                    <label className="ia-field">
                      <span className="ia-label">Sample size</span>
                      <input value={e.sampleSize} disabled={!editable} onChange={ev => setSampling(item.key, { sampleSize: ev.target.value })} />
                    </label>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {tab === "actions" && (
        <section>
          {actionChecks.length === 0 ? (
            <p className="ia-ok">No non-conformities recorded, so no corrective actions are needed.</p>
          ) : (
            <ol className="ia-list">
              {actionChecks.map(check => {
                const r = record.responses[check.id];
                const mine = audit.permissions.myActions.includes(check.id);
                const canRecord = audit.status !== "draft" && !r.effectivenessVerified && (mine || audit.permissions.canVerify);
                return (
                  <li key={check.id} className="ia-check" data-severity={severityOf(r.rating)} data-testid={`action-${check.id}`}>
                    <div className="ia-check-top">
                      <div style={{ flex: 1, minWidth: 220 }}>
                        <span className="ia-id">{check.id}</span>{" "}
                        <span className="ia-chip" data-rating={r.rating}>{RATING_LABEL[r.rating]}</span>
                        <p className="ia-check-text">{r.correctiveAction || "Corrective action not written yet"}</p>
                        <p className="ia-evidence">
                          Root cause: {r.rootCause || "–"} · Owner: {r.owner || "–"} · Due: {r.dueDate || "–"}
                        </p>
                        <p className="ia-evidence">
                          Status: {r.effectivenessVerified ? "Verified effective" : r.actionCompleted ? "Action recorded, awaiting verification" : "Open"}
                          {r.actionTaken && ` · Action taken: ${r.actionTaken}`}
                        </p>
                      </div>
                    </div>
                    {canRecord && !r.actionCompleted && (
                      <div className="ia-detail">
                        <label className="ia-field">
                          <span className="ia-label">What was done</span>
                          <textarea rows={2} value={actionText[check.id] ?? ""} onChange={e => setActionText(t => ({ ...t, [check.id]: e.target.value }))} data-testid={`action-text-${check.id}`} />
                        </label>
                        <button type="button" className="ia-btn ia-btn-primary" style={{ alignSelf: "flex-start" }}
                          disabled={busy || !(actionText[check.id] ?? "").trim()}
                          onClick={async () => { await onCompleteAction(check.id, actionText[check.id]); setActionText(t => ({ ...t, [check.id]: "" })); }}
                          data-testid={`button-complete-${check.id}`}>
                          Record action as done
                        </button>
                      </div>
                    )}
                    {audit.permissions.canVerify && r.actionCompleted && !r.effectivenessVerified && (
                      <div className="ia-detail">
                        <label className="ia-field">
                          <span className="ia-label">Verification note (required if not effective)</span>
                          <input value={verifyNote[check.id] ?? ""} onChange={e => setVerifyNote(n => ({ ...n, [check.id]: e.target.value }))} />
                        </label>
                        <div className="ia-actions" style={{ marginTop: 0 }}>
                          <button type="button" className="ia-btn ia-btn-primary" disabled={busy}
                            onClick={() => onVerify(check.id, true, verifyNote[check.id])} data-testid={`button-verify-${check.id}`}>
                            Verified effective
                          </button>
                          <button type="button" className="ia-btn" disabled={busy || !(verifyNote[check.id] ?? "").trim()}
                            onClick={() => onVerify(check.id, false, verifyNote[check.id])}>
                            Not effective: back to owner
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      )}

      {tab === "summary" && (
        <section>
          <p className="ia-overall">Overall conclusion: {OVERALL_LABEL[summary.overall]}</p>
          <div className="ia-counts">
            {(["compliant", "observation", "minor_nc", "major_nc", "not_assessed"] as Rating[]).map(r => (
              <div key={r} className="ia-count" data-rating={r}>
                <strong>{summary.counts[r]}</strong>
                <span>{RATING_LABEL[r]}</span>
              </div>
            ))}
            <div className="ia-count">
              <strong>{summary.openActions}</strong>
              <span>Open corrective actions</span>
            </div>
          </div>

          <h3 className="ia-h3">By module</h3>
          <ol className="ia-list">
            {CLAUSES.map(c => {
              const cs = summary.byClause[c.id];
              return (
                <li key={c.id} className="ia-check" data-severity={severityOf(cs.worst)}>
                  <div className="ia-check-top">
                    <span className="ia-check-text">{c.number}. {c.title}</span>
                    <span className="ia-nav-meta">{cs.assessed}/{cs.total} assessed <span className="ia-chip" data-rating={cs.worst}>{RATING_LABEL[cs.worst]}</span></span>
                  </div>
                </li>
              );
            })}
          </ol>

          <h3 className="ia-h3">Completion check</h3>
          {issues.length === 0 ? (
            <p className="ia-ok">Every check is assessed, findings have evidence and corrective actions, and sampling is complete.</p>
          ) : (
            <ul className="ia-issues">{issues.map(i => <li key={i}>{i}</li>)}</ul>
          )}

          <h3 className="ia-h3">Management sign-off</h3>
          {audit.status === "closed" ? (
            <p>Signed off by {record.signOff.name} ({record.signOff.role}) on {record.signOff.date}.</p>
          ) : audit.status === "pending_signoff" ? (
            <p>Submitted by {audit.submittedByName ?? "the lead auditor"}{audit.submittedAt ? ` on ${new Date(audit.submittedAt).toLocaleDateString("en-GB")}` : ""}. Waiting for the COO or CEO.</p>
          ) : (
            <p className="ia-evidence">The lead auditor submits the completed audit; the COO or CEO then signs it off.</p>
          )}

          <div className="ia-actions">
            {audit.permissions.canSubmit && (
              <button type="button" className="ia-btn ia-btn-primary" disabled={busy || dirty || issues.length > 0} onClick={onSubmit} data-testid="button-submit-audit"
                title={dirty ? "Save your changes first" : issues.length ? "Complete the items above first" : undefined}>
                Submit for sign-off
              </button>
            )}
            {audit.permissions.canSignOff && (
              <>
                <button type="button" className="ia-btn ia-btn-primary" disabled={busy || issues.length > 0} onClick={onSignOff} data-testid="button-signoff-audit">
                  Sign off audit
                </button>
                <input value={returnNote} onChange={e => setReturnNote(e.target.value)} placeholder="Reason to return it" style={{ maxWidth: 320 }} />
                <button type="button" className="ia-btn" disabled={busy || !returnNote.trim()} onClick={async () => { await onReturn(returnNote); setReturnNote(""); }}>
                  Return to audit team
                </button>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
