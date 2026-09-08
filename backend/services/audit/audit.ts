type AuditInput = {
  actorUserId?: string | null;
  organizationId?: string | null;
  action: string;
  targetType: string;
  targetId: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
};

export function auditStatement(db: D1Database, input: AuditInput) {
  return db.prepare(`
    INSERT INTO audit_events
      (id, actor_user_id, organization_id, action, target_type, target_id,
       request_id, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    input.actorUserId ?? null,
    input.organizationId ?? null,
    input.action,
    input.targetType,
    input.targetId,
    input.requestId ?? crypto.randomUUID(),
    JSON.stringify(input.metadata ?? {}),
  );
}

export async function writeAuditEvent(db: D1Database, input: AuditInput) {
  await auditStatement(db, input).run();
}

