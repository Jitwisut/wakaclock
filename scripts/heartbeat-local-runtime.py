#!/usr/bin/env python3
"""Supervise only the verified original local backend and its external volumes.

No database initialization, credential output, or heartbeat synthesis. Service
installation requires a sealed verification manifest produced by preflight.
"""
import argparse, datetime as dt, fcntl, hashlib, json, os, pathlib, plistlib, signal, socket, subprocess, time, urllib.parse, urllib.request
ROOT=pathlib.Path(os.environ.get('WAKACLOCK_REPOSITORY',str(pathlib.Path(__file__).resolve().parents[1])))
HOME_DIR=pathlib.Path.home()/'.wakaclock'
LABEL='com.atoaxis.wakaclock.backend'
VOLUMES=('wakaclock_clickhouse_data','wakaclock_clickhouse_logs','wakaclock_postgres_data','wakaclock_redis_data')
RUNTIME=HOME_DIR/'runtime'
MANIFEST=HOME_DIR/'backend-runtime-binding.json'
STATE=HOME_DIR/'backend-state.json'

def private_save(path,value):
    path.parent.mkdir(parents=True,exist_ok=True);temp=path.with_suffix('.tmp');temp.write_text(json.dumps(value,indent=2));temp.chmod(0o600);temp.replace(path)
def configuration():
    values={}
    for line in (RUNTIME/'backend.env' if (RUNTIME/'backend.env').exists() else ROOT/'backend/api/.env').read_text().splitlines():
        line=line.strip()
        if line and not line.startswith('#') and '=' in line:
            k,v=line.split('=',1);values[k.strip()]=v.strip().strip('\"\'')
    pg=urllib.parse.urlparse(values.get('POSTGRES_URL',values.get('DATABASE_URL','')))
    ch=urllib.parse.urlparse(values.get('CLICKHOUSE_URL',''))
    if pg.hostname not in ('127.0.0.1','localhost') or pg.port!=5432 or ch.hostname not in ('127.0.0.1','localhost') or ch.port!=8123:raise ValueError('original_runtime_endpoint_mismatch')
    env=dict(os.environ);env.update(values)
    env.update(HEARTBEAT_PG_USER=urllib.parse.unquote(pg.username or ''),HEARTBEAT_PG_PASSWORD=urllib.parse.unquote(pg.password or ''),HEARTBEAT_PG_DATABASE=pg.path.strip('/'),HEARTBEAT_CH_USER=values.get('CLICKHOUSE_USER','default'),HEARTBEAT_CH_PASSWORD=values.get('CLICKHOUSE_PASSWORD','default'),SERVER_HOST='127.0.0.1',SERVER_PORT='8080')
    return env

def docker(args,env=None):
    return subprocess.run(['/usr/local/bin/docker',*args],env=env,capture_output=True,timeout=120,check=False)
def volume_metadata():
    r=docker(['volume','inspect',*VOLUMES])
    if r.returncode:raise ValueError('original_volume_missing')
    data=json.loads(r.stdout)
    if any(v.get('Labels',{}).get('com.docker.compose.project')!='wakaclock' for v in data):raise ValueError('original_volume_identity_mismatch')
    return [{'name':v['Name'],'created_at':v['CreatedAt'],'project':v['Labels']['com.docker.compose.project']} for v in data]
def dependency_readiness():
    # A listening port alone is not proof of the original database. Refuse
    # foreign containers/volumes or an occupied unmanaged endpoint.
    services={'postgres':(5432,'wakaclock_postgres_data'), 'clickhouse':(8123,'wakaclock_clickhouse_data'), 'redis':(6379,'wakaclock_redis_data')}
    ready=True
    for service,(port,volume) in services.items():
        r=docker(['inspect',f'wakaclock-heartbeat-runtime-{service}-1'])
        if r.returncode:
            if connected(port):raise ValueError('dependency_endpoint_unmanaged')
            ready=False;continue
        c=json.loads(r.stdout)[0];labels=c.get('Config',{}).get('Labels') or {}
        if labels.get('com.docker.compose.project')!='wakaclock-heartbeat-runtime' or labels.get('com.docker.compose.service')!=service or volume not in {m.get('Name') for m in c.get('Mounts',[])}:
            raise ValueError('dependency_container_binding_changed')
        bindings=c.get('HostConfig',{}).get('PortBindings',{}).get(f'{port}/tcp') or []
        if not any(b.get('HostIp')=='127.0.0.1' and b.get('HostPort')==str(port) for b in bindings):raise ValueError('dependency_port_binding_changed')
        if not c.get('State',{}).get('Running') or not connected(port):ready=False
    return ready

def connected(port):
    try:
        with socket.create_connection(('127.0.0.1',port),timeout=1):return True
    except OSError:return False
def healthy():
    try:
        with urllib.request.urlopen('http://127.0.0.1:8080/health',timeout=2) as r:return r.status==200
    except OSError:return False

def verify_binding():
    binding=json.loads(MANIFEST.read_text())
    if not binding.get('account_verified') or not binding.get('canonical_data_verified'):raise ValueError('original_account_and_data_unconfirmed')
    if binding['volumes']!=volume_metadata():raise ValueError('original_volume_binding_changed')
    binary=RUNTIME/'wakaclock-server' if (RUNTIME/'wakaclock-server').exists() else ROOT/'backend/api/target/debug/wakaclock-server'
    if hashlib.sha256(binary.read_bytes()).hexdigest()!=binding['backend_sha256']:raise ValueError('backend_build_mismatch')
    return binary

def run(once=False):
    HOME_DIR.mkdir(exist_ok=True);lock=open(HOME_DIR/'backend-runtime.lock','a');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    child=None;stopping=False;restart_count=0;backoff=15;next_attempt=0;last_exit=None;last_tick=time.monotonic();health_failures=0;last_health_failure=None;last_restart=None;previous_status=None
    def stop(*_):
        nonlocal stopping
        stopping=True
    signal.signal(signal.SIGTERM,stop);signal.signal(signal.SIGINT,stop)
    try:
        while not stopping:
            now=time.monotonic();wake_gap=now-last_tick;last_tick=now
            code=None
            try:
                if docker(['info','--format','{{.ServerVersion}}']).returncode:
                    if now>=next_attempt:
                        subprocess.run(['/usr/bin/open','-g','-a','Docker'],capture_output=True,check=False)
                        next_attempt=now+60
                    raise ValueError('docker_engine_unavailable')
                binary=verify_binding();env=configuration();deps=dependency_readiness()
                if not deps and now>=next_attempt:
                    r=docker(['compose','-p','wakaclock-heartbeat-runtime','-f',str(RUNTIME/'compose.yaml' if (RUNTIME/'compose.yaml').exists() else ROOT/'deployment/heartbeat-local/compose.yaml'),'up','-d','--no-deps','--pull','never','postgres','clickhouse','redis'],env)
                    if r.returncode:code='dependency_start_failed'
                    next_attempt=now+backoff;backoff=min(backoff*2,300)
                if child and child.poll() is not None:
                    last_exit=child.returncode;child=None;restart_count+=1;last_restart=dt.datetime.now(dt.timezone.utc).isoformat();health_failures=0;next_attempt=now+backoff;backoff=min(backoff*2,300)
                if deps and not child and not connected(8080) and now>=next_attempt:
                    child=subprocess.Popen([str(binary)],cwd=RUNTIME if RUNTIME.exists() else ROOT/'backend/api',env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
                if deps and healthy():backoff=15;code=None;health_failures=0
                elif child and child.poll() is None:
                    health_failures+=1;code='backend_health_failed';last_health_failure=dt.datetime.now(dt.timezone.utc).isoformat()
                    if health_failures>=4:
                        child.terminate()
                        try:child.wait(timeout=15)
                        except subprocess.TimeoutExpired:child.kill();child.wait()
                        last_exit=child.returncode;child=None;restart_count+=1;last_restart=dt.datetime.now(dt.timezone.utc).isoformat();health_failures=0;next_attempt=now+backoff;backoff=min(backoff*2,300)
                elif deps and connected(8080) and not child:code='unmanaged_backend_present'
                elif not deps:code=code or 'dependency_unavailable'
                else:code='backend_starting'
            except (OSError,ValueError,KeyError,subprocess.SubprocessError):code='runtime_binding_or_start_failed'
            observation={'checked_at':dt.datetime.now(dt.timezone.utc).isoformat(),'pid':os.getpid(),'backend_pid':child.pid if child else None,'restart_count':restart_count,'last_exit_status':last_exit,'last_restart_at':last_restart,'last_health_failure_at':last_health_failure,'healthy':healthy(),'error_code':code,'wake_gap_seconds':round(wake_gap,3)}
            private_save(STATE,observation)
            transition=(observation['healthy'],code,observation['backend_pid'],restart_count)
            if transition!=previous_status or wake_gap>45:
                history=HOME_DIR/'backend-history.jsonl'
                with history.open('a') as log:log.write(json.dumps(observation)+'\n')
                history.chmod(0o600);previous_status=transition
            if once:break
            for _ in range(15):
                if stopping:break
                time.sleep(1)
    finally:
        if child and child.poll() is None:
            child.terminate()
            try:child.wait(timeout=15)
            except subprocess.TimeoutExpired:child.kill();child.wait()

def install():
    import shutil
    verify_binding()
    RUNTIME.mkdir(mode=0o700,exist_ok=True);RUNTIME.chmod(0o700)
    existing=RUNTIME/'wakaclock-server'
    source_binary=ROOT/'backend/api/target/debug/wakaclock-server'
    if existing.exists() and hashlib.sha256(existing.read_bytes()).digest()!=hashlib.sha256(source_binary.read_bytes()).digest():
        shutil.copyfile(existing,RUNTIME/'wakaclock-server.previous');(RUNTIME/'wakaclock-server.previous').chmod(0o700)
    for source,target in [(ROOT/'backend/api/.env',RUNTIME/'backend.env'),(ROOT/'deployment/heartbeat-local/compose.yaml',RUNTIME/'compose.yaml'),(ROOT/'backend/api/target/debug/wakaclock-server',RUNTIME/'wakaclock-server'),(pathlib.Path(__file__).resolve(),RUNTIME/'supervisor.py')]:
        if source.resolve()!=target.resolve():
            temp=target.with_suffix('.new');shutil.copyfile(source,temp);temp.chmod(0o700 if target.name=='wakaclock-server' else 0o600);temp.replace(target)
    binding=json.loads(MANIFEST.read_text());binding['backend_sha256']=hashlib.sha256((RUNTIME/'wakaclock-server').read_bytes()).hexdigest();binding['installed_at']=dt.datetime.now(dt.timezone.utc).isoformat();private_save(MANIFEST,binding)
    # Runtime lives outside Desktop so launchd needs no access to protected workspaces.
    path=pathlib.Path.home()/'Library/LaunchAgents'/f'{LABEL}.plist';uid=os.getuid()
    subprocess.run(['launchctl','bootout',f'gui/{uid}/{LABEL}'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    manifest={'Label':LABEL,'ProgramArguments':['/usr/bin/python3',str(RUNTIME/'supervisor.py'),'run'],'RunAtLoad':True,'KeepAlive':True,'ThrottleInterval':15,'EnvironmentVariables':{'PATH':'/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin','HOME':str(pathlib.Path.home()),'WAKACLOCK_REPOSITORY':str(ROOT)}}
    path.write_bytes(plistlib.dumps(manifest));path.chmod(0o600)
    # bootout completes asynchronously. Wait for the registered service to
    # disappear before bootstrapping the same label again.
    for _ in range(30):
        if subprocess.run(['launchctl','print',f'gui/{uid}/{LABEL}'],capture_output=True).returncode:
            break
        time.sleep(.5)
    for attempt in range(3):
        result=subprocess.run(['launchctl','bootstrap',f'gui/{uid}',str(path)],capture_output=True)
        if result.returncode==0:break
        time.sleep(1)
    if result.returncode:raise RuntimeError('backend_service_bootstrap_failed')
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('action',choices=['run','install','preflight']);p.add_argument('--once',action='store_true');a=p.parse_args()
    if a.action=='run':run(a.once)
    elif a.action=='install':install()
    else:print(json.dumps({'volumes':volume_metadata(),'endpoints_valid':bool(configuration()),'bound':MANIFEST.exists()}))
