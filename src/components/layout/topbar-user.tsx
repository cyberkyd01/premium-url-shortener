"use client";
import { useState } from "react";
import Link from "next/link";
import { Bell, ChevronDown, LogOut, Settings, Shield, Users } from "lucide-react";
import { signOut } from "next-auth/react";
import { switchTeam } from "@/app/dashboard/teams/actions";

export function TopbarUser({ user, unread, teams, activeTeamId }: { user: { name: string; email: string; avatar?: string | null; role: string; gravatar: boolean }; unread: number; teams: { id: string; name: string }[]; activeTeamId: string | null }) {
  const [open, setOpen] = useState(false);
  const avatar = user.avatar || (user.gravatar ? `https://www.gravatar.com/avatar/${md5(user.email.trim().toLowerCase())}?d=identicon` : "");
  return (
    <div className="flex items-center gap-2">
      {teams.length > 0 && (
        <select className="input w-auto py-1 text-xs" value={activeTeamId ?? ""} onChange={(e) => switchTeam(e.target.value || null)} title="Switch workspace">
          <option value="">My workspace</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      )}
      <Link href="/dashboard/notifications" className="btn-ghost btn-sm relative" aria-label="Notifications"><Bell size={16} />{unread > 0 && <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-danger text-white text-[10px] grid place-items-center">{unread}</span>}</Link>
      <div className="relative">
        <button className="flex items-center gap-2 btn-ghost btn-sm" onClick={() => setOpen(!open)}>
          {avatar ? <img src={avatar} alt="" className="h-7 w-7 rounded-full" /> : <span className="h-7 w-7 rounded-full bg-primary text-primary-fg grid place-items-center text-xs">{user.name[0]?.toUpperCase()}</span>}
          <span className="hidden sm:inline text-sm">{user.name}</span><ChevronDown size={14} />
        </button>
        {open && (
          <div className="absolute right-0 mt-1 w-48 card p-1 text-sm z-50" onMouseLeave={() => setOpen(false)}>
            <Link href="/dashboard/settings" className="nav-item"><Settings size={14} />Settings</Link>
            <Link href="/dashboard/teams" className="nav-item"><Users size={14} />Teams</Link>
            {user.role === "admin" && <Link href="/admin" className="nav-item"><Shield size={14} />Admin panel</Link>}
            <button className="nav-item w-full" onClick={() => signOut({ callbackUrl: "/" })}><LogOut size={14} />Logout</button>
          </div>
        )}
      </div>
    </div>
  );
}

// tiny md5 for gravatar (client-side)
function md5(str: string) {
  function L(k: number, d: number) { return (k << d) | (k >>> (32 - d)); }
  function K(G: number, k: number) { let I, d, F, H, x; F = G & 2147483648; H = k & 2147483648; I = G & 1073741824; d = k & 1073741824; x = (G & 1073741823) + (k & 1073741823); if (I & d) return x ^ 2147483648 ^ F ^ H; if (I | d) { if (x & 1073741824) return x ^ 3221225472 ^ F ^ H; else return x ^ 1073741824 ^ F ^ H; } else return x ^ F ^ H; }
  function r(d: number, F: number, k: number) { return (d & F) | (~d & k); } function q(d: number, F: number, k: number) { return (d & k) | (F & ~k); } function p(d: number, F: number, k: number) { return d ^ F ^ k; } function n(d: number, F: number, k: number) { return F ^ (d | ~k); }
  function u(G: number, F: number, aa: number, Z: number, k: number, H: number, I: number) { G = K(G, K(K(r(F, aa, Z), k), I)); return K(L(G, H), F); }
  function f(G: number, F: number, aa: number, Z: number, k: number, H: number, I: number) { G = K(G, K(K(q(F, aa, Z), k), I)); return K(L(G, H), F); }
  function D(G: number, F: number, aa: number, Z: number, k: number, H: number, I: number) { G = K(G, K(K(p(F, aa, Z), k), I)); return K(L(G, H), F); }
  function t(G: number, F: number, aa: number, Z: number, k: number, H: number, I: number) { G = K(G, K(K(n(F, aa, Z), k), I)); return K(L(G, H), F); }
  function e(G: string) { let Z; const F = G.length; const x = F + 8; const k = (x - (x % 64)) / 64; const I = (k + 1) * 16; const aa = Array(I - 1); let d = 0; let H = 0; while (H < F) { Z = (H - (H % 4)) / 4; d = (H % 4) * 8; aa[Z] = aa[Z] | (G.charCodeAt(H) << d); H++; } Z = (H - (H % 4)) / 4; d = (H % 4) * 8; aa[Z] = aa[Z] | (128 << d); aa[I - 2] = F << 3; aa[I - 1] = F >>> 29; return aa; }
  function B(x: number) { let k = "", F = ""; for (let G = 0; G <= 3; G++) { const d = (x >>> (G * 8)) & 255; F = "0" + d.toString(16); k = k + F.substr(F.length - 2, 2); } return k; }
  function J(k: string) { k = k.replace(/\r\n/g, "\n"); let d = ""; for (let F = 0; F < k.length; F++) { const x = k.charCodeAt(F); if (x < 128) d += String.fromCharCode(x); else if (x > 127 && x < 2048) { d += String.fromCharCode((x >> 6) | 192); d += String.fromCharCode((x & 63) | 128); } else { d += String.fromCharCode((x >> 12) | 224); d += String.fromCharCode(((x >> 6) & 63) | 128); d += String.fromCharCode((x & 63) | 128); } } return d; }
  let C, P, h, E, v, g, Y, X, W, V; const S = 7, Q = 12, N = 17, M = 22, A = 5, z = 9, y = 14, w = 20, o = 4, m = 11, l = 16, j = 23, U = 6, T = 10, R = 15, O = 21;
  str = J(str); C = e(str); Y = 1732584193; X = 4023233417; W = 2562383102; V = 271733878;
  for (P = 0; P < C.length; P += 16) { h = Y; E = X; v = W; g = V; Y = u(Y, X, W, V, C[P + 0], S, 3614090360); V = u(V, Y, X, W, C[P + 1], Q, 3905402710); W = u(W, V, Y, X, C[P + 2], N, 606105819); X = u(X, W, V, Y, C[P + 3], M, 3250441966); Y = u(Y, X, W, V, C[P + 4], S, 4118548399); V = u(V, Y, X, W, C[P + 5], Q, 1200080426); W = u(W, V, Y, X, C[P + 6], N, 2821735955); X = u(X, W, V, Y, C[P + 7], M, 4249261313); Y = u(Y, X, W, V, C[P + 8], S, 1770035416); V = u(V, Y, X, W, C[P + 9], Q, 2336552879); W = u(W, V, Y, X, C[P + 10], N, 4294925233); X = u(X, W, V, Y, C[P + 11], M, 2304563134); Y = u(Y, X, W, V, C[P + 12], S, 1804603682); V = u(V, Y, X, W, C[P + 13], Q, 4254626195); W = u(W, V, Y, X, C[P + 14], N, 2792965006); X = u(X, W, V, Y, C[P + 15], M, 1236535329); Y = f(Y, X, W, V, C[P + 1], A, 4129170786); V = f(V, Y, X, W, C[P + 6], z, 3225465664); W = f(W, V, Y, X, C[P + 11], y, 643717713); X = f(X, W, V, Y, C[P + 0], w, 3921069994); Y = f(Y, X, W, V, C[P + 5], A, 3593408605); V = f(V, Y, X, W, C[P + 10], z, 38016083); W = f(W, V, Y, X, C[P + 15], y, 3634488961); X = f(X, W, V, Y, C[P + 4], w, 3889429448); Y = f(Y, X, W, V, C[P + 9], A, 568446438); V = f(V, Y, X, W, C[P + 14], z, 3275163606); W = f(W, V, Y, X, C[P + 3], y, 4107603335); X = f(X, W, V, Y, C[P + 8], w, 1163531501); Y = f(Y, X, W, V, C[P + 13], A, 2850285829); V = f(V, Y, X, W, C[P + 2], z, 4243563512); W = f(W, V, Y, X, C[P + 7], y, 1735328473); X = f(X, W, V, Y, C[P + 12], w, 2368359562); Y = D(Y, X, W, V, C[P + 5], o, 4294588738); V = D(V, Y, X, W, C[P + 8], m, 2272392833); W = D(W, V, Y, X, C[P + 11], l, 1839030562); X = D(X, W, V, Y, C[P + 14], j, 4259657740); Y = D(Y, X, W, V, C[P + 1], o, 2763975236); V = D(V, Y, X, W, C[P + 4], m, 1272893353); W = D(W, V, Y, X, C[P + 7], l, 4139469664); X = D(X, W, V, Y, C[P + 10], j, 3200236656); Y = D(Y, X, W, V, C[P + 13], o, 681279174); V = D(V, Y, X, W, C[P + 0], m, 3936430074); W = D(W, V, Y, X, C[P + 3], l, 3572445317); X = D(X, W, V, Y, C[P + 6], j, 76029189); Y = D(Y, X, W, V, C[P + 9], o, 3654602809); V = D(V, Y, X, W, C[P + 12], m, 3873151461); W = D(W, V, Y, X, C[P + 15], l, 530742520); X = D(X, W, V, Y, C[P + 2], j, 3299628645); Y = t(Y, X, W, V, C[P + 0], U, 4096336452); V = t(V, Y, X, W, C[P + 7], T, 1126891415); W = t(W, V, Y, X, C[P + 14], R, 2878612391); X = t(X, W, V, Y, C[P + 5], O, 4237533241); Y = t(Y, X, W, V, C[P + 12], U, 1700485571); V = t(V, Y, X, W, C[P + 3], T, 2399980690); W = t(W, V, Y, X, C[P + 10], R, 4293915773); X = t(X, W, V, Y, C[P + 1], O, 2240044497); Y = t(Y, X, W, V, C[P + 8], U, 1873313359); V = t(V, Y, X, W, C[P + 15], T, 4264355552); W = t(W, V, Y, X, C[P + 6], R, 2734768916); X = t(X, W, V, Y, C[P + 13], O, 1309151649); Y = t(Y, X, W, V, C[P + 4], U, 4149444226); V = t(V, Y, X, W, C[P + 11], T, 3174756917); W = t(W, V, Y, X, C[P + 2], R, 718787259); X = t(X, W, V, Y, C[P + 9], O, 3951481745); Y = K(Y, h); X = K(X, E); W = K(W, v); V = K(V, g); }
  return (B(Y) + B(X) + B(W) + B(V)).toLowerCase();
}
