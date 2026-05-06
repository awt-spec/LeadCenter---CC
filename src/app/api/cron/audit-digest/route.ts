import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { prisma } from '@/lib/db';
import {
  getAuditStatsWithDeltas,
  getTopUsers,
  getOnlineUsers,
  getInactiveUsers,
} from '@/lib/audit/queries';
import { verifyChain } from '@/lib/audit/hash-chain';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Cron semanal — lunes 13:00 UTC.
 *
 * Vercel agrega header `Authorization: Bearer ${CRON_SECRET}` cuando
 * dispara crons configurados en vercel.json (si CRON_SECRET está set).
 * Verificamos contra el env para que nadie pueda triggerar manualmente.
 *
 * Si RESEND_API_KEY o CRON_SECRET no están seteados, devuelve un mensaje
 * informativo en lugar de fallar — el operador setea las envs y el
 * próximo tick anda.
 */

function buildHTML(data: {
  stats: Awaited<ReturnType<typeof getAuditStatsWithDeltas>>;
  topUsers: Awaited<ReturnType<typeof getTopUsers>>;
  onlineNow: Awaited<ReturnType<typeof getOnlineUsers>>;
  inactive: Awaited<ReturnType<typeof getInactiveUsers>>;
  chain: Awaited<ReturnType<typeof verifyChain>>;
}): string {
  const { stats, topUsers, onlineNow, inactive, chain } = data;
  const fmt = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toString();
  const deltaPill = (pct: number | null) => {
    if (pct === null) return `<span style="color:#888880;font-size:11px">—</span>`;
    const color =
      Math.abs(pct) < 5 ? '#888880' : pct > 0 ? '#16a34a' : '#d97706';
    const sign = pct > 0 ? '+' : '';
    return `<span style="color:${color};font-size:11px;font-weight:600">${sign}${pct.toFixed(0)}%</span>`;
  };

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>LeadCenter — Digest de auditoría</title>
</head>
<body style="font-family:'Inter',system-ui,sans-serif;background:#F4F4F2;color:#3D3D3D;margin:0;padding:24px">
  <div style="max-width:640px;margin:0 auto;background:white;border-radius:12px;overflow:hidden">
    <header style="background:#C8200F;color:white;padding:24px">
      <h1 style="margin:0;font-size:20px;font-weight:700;text-transform:uppercase;letter-spacing:-0.01em">
        Digest semanal · Auditoría
      </h1>
      <p style="margin:4px 0 0;font-size:13px;opacity:0.9">
        Resumen de los últimos 7 días · LeadCenter
      </p>
    </header>

    <section style="padding:24px">
      <h2 style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#888880;margin:0 0 12px">Volumen</h2>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">
        <tr>
          <td style="padding:8px 12px;background:#F4F4F2;border-radius:8px">
            <div style="font-size:24px;font-weight:700;color:#3D3D3D">${fmt(stats.total24h)}</div>
            <div style="font-size:11px;color:#888880">en 24h ${deltaPill(stats.delta24h)}</div>
          </td>
          <td style="width:8px"></td>
          <td style="padding:8px 12px;background:#F4F4F2;border-radius:8px">
            <div style="font-size:24px;font-weight:700;color:#3D3D3D">${fmt(stats.total7d)}</div>
            <div style="font-size:11px;color:#888880">en 7d ${deltaPill(stats.delta7d)}</div>
          </td>
          <td style="width:8px"></td>
          <td style="padding:8px 12px;background:#F4F4F2;border-radius:8px">
            <div style="font-size:24px;font-weight:700;color:#3D3D3D">${stats.uniqueUsers30d}</div>
            <div style="font-size:11px;color:#888880">usuarios activos 30d</div>
          </td>
        </tr>
      </table>

      <h2 style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#888880;margin:24px 0 12px">Top usuarios (7d)</h2>
      <ul style="margin:0;padding:0;list-style:none">
        ${topUsers
          .slice(0, 5)
          .map(
            (u) =>
              `<li style="padding:6px 0;border-bottom:1px solid #E2E8F0;display:flex;justify-content:space-between"><span>${u.name}</span><strong style="color:#C8200F">${u.count.toLocaleString('es')}</strong></li>`
          )
          .join('')}
      </ul>

      ${
        onlineNow.length > 0
          ? `
      <h2 style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#888880;margin:24px 0 12px">Online ahora (5m)</h2>
      <p style="margin:0;font-size:13px">${onlineNow.map((u) => u.name).join(', ')}</p>
      `
          : ''
      }

      ${
        inactive.length > 0
          ? `
      <h2 style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#d97706;margin:24px 0 12px">Usuarios inactivos (>14d)</h2>
      <p style="margin:0;font-size:13px;color:#888880">
        ${inactive.length} usuario${inactive.length === 1 ? '' : 's'} sin actividad reciente: ${inactive.slice(0, 5).map((u) => u.name).join(', ')}${inactive.length > 5 ? ` +${inactive.length - 5} más` : ''}
      </p>
      `
          : ''
      }

      <h2 style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#888880;margin:24px 0 12px">Integridad de la cadena</h2>
      <div style="padding:12px;background:${chain.ok ? '#dcfce7' : '#fee2e2'};border-radius:8px;color:${chain.ok ? '#15803d' : '#b91c1c'};font-size:13px">
        ${chain.ok ? `✓ Verificada — ${chain.totalChecked.toLocaleString('es')} eventos sin tampering en 7d.` : `⚠ Cadena rota en evento ${chain.firstBreak?.id ?? '?'}. Revisar urgente.`}
      </div>

      <p style="margin:24px 0 0;font-size:11px;color:#888880;text-align:center">
        Reporte generado automáticamente · <a href="https://lead-center-cc.vercel.app/audit" style="color:#C8200F">Ir a auditoría</a>
      </p>
    </section>
  </div>
</body>
</html>`;
}

export async function GET(req: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');

  if (!expectedSecret) {
    return NextResponse.json({
      ok: false,
      message: 'CRON_SECRET no está configurada — saltando.',
    });
  }
  if (auth !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      message: 'RESEND_API_KEY no está configurada — saltando.',
    });
  }

  // Buscar admins
  const adminRole = await prisma.role.findFirst({ where: { key: 'admin' } });
  if (!adminRole) {
    return NextResponse.json({
      ok: false,
      message: 'No hay rol admin definido.',
    });
  }
  const admins = await prisma.userRole.findMany({
    where: { roleId: adminRole.id },
    include: { user: { select: { email: true, name: true, isActive: true } } },
  });
  const recipients = admins
    .filter((a) => a.user.isActive)
    .map((a) => a.user.email);

  if (recipients.length === 0) {
    return NextResponse.json({
      ok: true,
      message: 'No hay admins activos a quienes mandar el digest.',
    });
  }

  // Recolectar data
  const [stats, topUsers, onlineNow, inactive, chain] = await Promise.all([
    getAuditStatsWithDeltas(),
    getTopUsers(7, 5),
    getOnlineUsers(5, 10),
    getInactiveUsers(14),
    verifyChain(7),
  ]);

  const html = buildHTML({ stats, topUsers, onlineNow, inactive, chain });
  const subject = `LeadCenter · Audit weekly · ${stats.total7d.toLocaleString('es')} eventos en 7d${chain.ok ? '' : ' · ⚠ cadena rota'}`;

  const resend = new Resend(apiKey);
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'audit@lead-center-cc.vercel.app';

  try {
    const result = await resend.emails.send({
      from: `LeadCenter Audit <${fromEmail}>`,
      to: recipients,
      subject,
      html,
    });
    return NextResponse.json({
      ok: true,
      sent: recipients.length,
      messageId: result.data?.id,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: 'resend_failed',
        message: String(err),
      },
      { status: 500 }
    );
  }
}
