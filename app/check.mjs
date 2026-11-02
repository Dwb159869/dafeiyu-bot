const result={protocol:'SnowLuma',qqOnline:false,historySeeded:false};
try{
  const call=async name=>{
    const r=await fetch(`http://snowluma:3000/${name}`,{method:'POST',headers:{Authorization:`Bearer ${process.env.ONEBOT_HTTP_TOKEN}`,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(6000)});
    if(!r.ok)throw new Error('OneBot API not ready');
    const value=await r.json();if(value.retcode!==0)throw new Error('OneBot action failed');return value.data;
  };
  const [status,login,version]=await Promise.all([call('get_status'),call('get_login_info'),call('get_version_info')]);
  result.qqOnline=status.online===true&&String(login.user_id)===process.env.BOT_QQ;
  result.account=String(login.user_id);result.version=version.app_version;
  result.message=result.qqOnline?'QQ online; verify a real private message next':'Waiting for the configured bot account';
}catch{result.message='SnowLuma/QQ awaiting manual startup, consent, Load or login';}
console.log(JSON.stringify(result,null,2));
process.exitCode=result.qqOnline?0:2;
