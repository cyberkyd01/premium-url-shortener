export function ChatWidget({ provider, id }: { provider: string; id: string }) {
  if (!id || provider === "none") return null;
  const scripts: Record<string, string> = {
    intercom: `window.intercomSettings={app_id:"${id}"};(function(){var w=window;var ic=w.Intercom;if(typeof ic==="function"){ic('reattach_activator');ic('update',w.intercomSettings);}else{var d=document;var i=function(){i.c(arguments);};i.q=[];i.c=function(args){i.q.push(args);};w.Intercom=i;var l=function(){var s=d.createElement('script');s.type='text/javascript';s.async=true;s.src='https://widget.intercom.io/widget/${id}';var x=d.getElementsByTagName('script')[0];x.parentNode.insertBefore(s,x);};l();}})();`,
    tidio: `(function(){var s=document.createElement('script');s.src='//code.tidio.co/${id}.js';s.async=true;document.body.appendChild(s);})();`,
    tawk: `var Tawk_API=Tawk_API||{},Tawk_LoadStart=new Date();(function(){var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];s1.async=true;s1.src='https://embed.tawk.to/${id}';s1.charset='UTF-8';s1.setAttribute('crossorigin','*');s0.parentNode.insertBefore(s1,s0);})();`,
    crisp: `window.$crisp=[];window.CRISP_WEBSITE_ID="${id}";(function(){d=document;s=d.createElement("script");s.src="https://client.crisp.chat/l.js";s.async=1;d.getElementsByTagName("head")[0].appendChild(s);})();`,
  };
  const code = scripts[provider];
  if (!code) return null;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
