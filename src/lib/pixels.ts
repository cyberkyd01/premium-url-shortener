import { escapeHtml } from "./utils";

/** Retargeting pixel providers supported by the redirect engine. */
export const PIXEL_PROVIDERS = [
  "facebook", "twitter", "bing", "google-ads", "gtm", "ga", "snapchat", "reddit", "quora", "pinterest",
  "tiktok", "linkedin", "adroll", "hotjar", "clarity", "matomo", "custom",
] as const;
export type PixelProvider = (typeof PIXEL_PROVIDERS)[number];

function gtag(id: string) {
  return `<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');</script>`;
}

/** Returns the HTML snippet (scripts + noscript fallbacks) for one pixel. */
export function pixelHtml(provider: string, pixelId: string): string {
  if (provider === "custom") return pixelId;
  const i = escapeHtml(pixelId.trim());
  switch (provider) {
    case "facebook":
      return `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${i}');fbq('track','PageView');</script><noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${i}&ev=PageView&noscript=1"/></noscript>`;
    case "twitter":
      return `<script>!function(e,t,n,s,u,a){e.twq||(s=e.twq=function(){s.exe?s.exe.apply(s,arguments):s.queue.push(arguments);},s.version='1.1',s.queue=[],u=t.createElement(n),u.async=!0,u.src='https://static.ads-twitter.com/uwt.js',a=t.getElementsByTagName(n)[0],a.parentNode.insertBefore(u,a))}(window,document,'script');twq('config','${i}');</script>`;
    case "bing":
      return `<script>(function(w,d,t,r,u){var f,n,i;w[u]=w[u]||[],f=function(){var o={ti:"${i}"};o.q=w[u],w[u]=new UET(o),w[u].push("pageLoad")},n=d.createElement(t),n.src=r,n.async=1,n.onload=n.onreadystatechange=function(){var s=this.readyState;s&&s!=="loaded"&&s!=="complete"||(f(),n.onload=n.onreadystatechange=null)},i=d.getElementsByTagName(t)[0],i.parentNode.insertBefore(n,i)})(window,document,"script","//bat.bing.com/bat.js","uetq");</script>`;
    case "google-ads":
    case "ga":
      return gtag(i);
    case "gtm":
      return `<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${i}');</script><noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${i}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`;
    case "snapchat":
      return `<script>(function(e,t,n){if(e.snaptr)return;var a=e.snaptr=function(){a.handleRequest?a.handleRequest.apply(a,arguments):a.queue.push(arguments)};a.queue=[];var s='script';var r=t.createElement(s);r.async=!0;r.src=n;var u=t.getElementsByTagName(s)[0];u.parentNode.insertBefore(r,u);})(window,document,'https://sc-static.net/scevent.min.js');snaptr('init','${i}');snaptr('track','PAGE_VIEW');</script>`;
    case "reddit":
      return `<script>!function(w,d){if(!w.rdt){var p=w.rdt=function(){p.sendEvent?p.sendEvent.apply(p,arguments):p.callQueue.push(arguments)};p.callQueue=[];var t=d.createElement("script");t.src="https://www.redditstatic.com/ads/pixel.js",t.async=!0;var s=d.getElementsByTagName("script")[0];s.parentNode.insertBefore(t,s)}}(window,document);rdt('init','${i}');rdt('track','PageVisit');</script>`;
    case "quora":
      return `<script>!function(q,e,v,n,t,s){if(q.qp)return;n=q.qp=function(){n.qp?n.qp.apply(n,arguments):n.queue.push(arguments);};n.queue=[];t=document.createElement(e);t.async=!0;t.src=v;s=document.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s);}(window,'script','https://a.quora.com/qevents.js');qp('init','${i}');qp('track','ViewContent');</script>`;
    case "pinterest":
      return `<script>!function(e){if(!window.pintrk){window.pintrk=function(){window.pintrk.queue.push(Array.prototype.slice.call(arguments))};var n=window.pintrk;n.queue=[],n.version="3.0";var t=document.createElement("script");t.async=!0,t.src=e;var r=document.getElementsByTagName("script")[0];r.parentNode.insertBefore(t,r)}}("https://s.pinimg.com/ct/core.js");pintrk('load','${i}');pintrk('page');</script>`;
    case "tiktok":
      return `<script>!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${i}');ttq.page();}(window,document,'ttq');</script>`;
    case "linkedin":
      return `<script>_linkedin_partner_id="${i}";window._linkedin_data_partner_ids=window._linkedin_data_partner_ids||[];window._linkedin_data_partner_ids.push(_linkedin_partner_id);</script><script>(function(l){if(!l){window.lintrk=function(a,b){window.lintrk.q.push([a,b])};window.lintrk.q=[]}var s=document.getElementsByTagName("script")[0];var b=document.createElement("script");b.type="text/javascript";b.async=true;b.src="https://snap.licdn.com/li.lms-analytics/insight.min.js";s.parentNode.insertBefore(b,s);})(window.lintrk);</script><noscript><img height="1" width="1" style="display:none;" alt="" src="https://px.ads.linkedin.com/collect/?pid=${i}&fmt=gif"/></noscript>`;
    case "adroll": {
      const [adv, pix] = i.split("|").map((x) => x.trim());
      return `<script>adroll_adv_id="${adv ?? ""}";adroll_pix_id="${pix ?? ""}";(function(w,d,e,o,a){w.__adroll_loaded=true;w.adroll=w.adroll||[];w.adroll.f=['setProperties','identify','track'];var roundtripUrl="https://s.adroll.com/j/"+adroll_adv_id+"/roundtrip.js";for(a=0;a<w.adroll.f.length;a++){w.adroll[w.adroll.f[a]]=w.adroll[w.adroll.f[a]]||(function(n){return function(){w.adroll.push([n,arguments])}})(w.adroll.f[a])}e=d.createElement('script');o=d.getElementsByTagName('script')[0];e.async=1;e.src=roundtripUrl;o.parentNode.insertBefore(e,o)})(window,document);adroll.track("pageView");</script>`;
    }
    case "hotjar":
      return `<script>(function(h,o,t,j,a,r){h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};h._hjSettings={hjid:${parseInt(i, 10) || 0},hjsv:6};a=o.getElementsByTagName('head')[0];r=o.createElement('script');r.async=1;r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;a.appendChild(r);})(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');</script>`;
    case "clarity":
      return `<script>(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${i}");</script>`;
    case "matomo": {
      const [host, site] = i.split("|").map((x) => x.trim());
      const u = (host ?? "").replace(/\/$/, "") + "/";
      return `<script>var _paq=window._paq=window._paq||[];_paq.push(['trackPageView']);_paq.push(['enableLinkTracking']);(function(){var u="${u}";_paq.push(['setTrackerUrl',u+'matomo.php']);_paq.push(['setSiteId','${site ?? "1"}']);var d=document,g=d.createElement('script'),s=d.getElementsByTagName('script')[0];g.async=true;g.src=u+'matomo.js';s.parentNode.insertBefore(g,s);})();</script>`;
    }
    default:
      return "";
  }
}

/** Concatenated HTML for a list of pixels. */
export function pixelsHtml(pixels: { provider: string; pixelId: string }[]) {
  return pixels.map((p) => pixelHtml(p.provider, p.pixelId)).join("\n");
}

/** Google Analytics snippet used when the tracking method is "ga" instead of system stats. */
export function gaHtml(gaId: string) {
  return gaId ? gtag(escapeHtml(gaId.trim())) : "";
}

/** Alias of pixelHtml (dashboard/pixels module API): `pixelScript(provider, pixelId)` → HTML snippet. */
export const pixelScript = pixelHtml;
