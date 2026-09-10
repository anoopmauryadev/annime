import { getDb } from './db';

export type PlaybackSample = {
  session_id: string; episode_id: number; position: number; duration: number;
  state: 'playing' | 'paused' | 'buffering' | 'seeking' | 'ended';
};
type Session = { id:string; visitor:string; episode_id:number; position:number; last_seen:number; state:string };
let initialized = false;
function analyticsDb() {
  const db = getDb();
  if (!initialized) {
    db.exec(`CREATE TABLE IF NOT EXISTS site_presence(visitor TEXT PRIMARY KEY,user_id INTEGER,last_seen INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS video_sessions(
        id TEXT PRIMARY KEY,visitor TEXT NOT NULL,user_id INTEGER,episode_id INTEGER NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
        started_at INTEGER NOT NULL,last_seen INTEGER NOT NULL,position REAL NOT NULL DEFAULT 0,duration REAL NOT NULL DEFAULT 0,
        state TEXT NOT NULL,watched_seconds REAL NOT NULL DEFAULT 0,furthest_position REAL NOT NULL DEFAULT 0);
      CREATE INDEX IF NOT EXISTS idx_video_sessions_time ON video_sessions(last_seen);
      CREATE INDEX IF NOT EXISTS idx_video_sessions_episode ON video_sessions(episode_id,started_at);
      CREATE TABLE IF NOT EXISTS video_retention(session_id TEXT NOT NULL REFERENCES video_sessions(id) ON DELETE CASCADE,
        bucket INTEGER NOT NULL,watched_seconds REAL NOT NULL,PRIMARY KEY(session_id,bucket));
      CREATE TABLE IF NOT EXISTS video_watch_hours(session_id TEXT NOT NULL REFERENCES video_sessions(id) ON DELETE CASCADE,
        hour INTEGER NOT NULL,watched_seconds REAL NOT NULL,PRIMARY KEY(session_id,hour));`);
    initialized=true;
  }
  return db;
}
let lastCleanup=0;
export function recordPresence(visitor:string,userId:number|null,now=Date.now()) {
  const db=analyticsDb();
  db.prepare(`INSERT INTO site_presence VALUES(?,?,?) ON CONFLICT(visitor) DO UPDATE SET user_id=excluded.user_id,last_seen=excluded.last_seen`).run(visitor,userId,now);
  if(now-lastCleanup>3600000) {
    db.prepare('DELETE FROM site_presence WHERE last_seen<?').run(now-86400000);
    db.prepare('DELETE FROM video_sessions WHERE last_seen<?').run(now-90*86400000);
    lastCleanup=now;
  }
}
export function recordPlayback(visitor:string,userId:number|null,sample:PlaybackSample,now=Date.now()) {
  const db=analyticsDb();
  return db.transaction(()=>{
    const previous=db.prepare('SELECT * FROM video_sessions WHERE id=?').get(sample.session_id) as Session|undefined;
    if(previous && (previous.visitor!==visitor || previous.episode_id!==sample.episode_id)) return false;
    const elapsed=previous ? (now-previous.last_seen)/1000 : 0;
    const advance=previous ? sample.position-previous.position : 0;
    // Ignore seeks, stalled video, stale tabs and implausible position jumps.
    const watched=previous?.state==='playing' && sample.state!=='seeking' && elapsed>0 && elapsed<=45 && advance>0 && advance<=elapsed*4+2
      ? Math.min(elapsed,advance) : 0;
    db.prepare(`INSERT INTO video_sessions(id,visitor,user_id,episode_id,started_at,last_seen,position,duration,state)
      VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET user_id=excluded.user_id,last_seen=excluded.last_seen,
      position=excluded.position,duration=MAX(video_sessions.duration,excluded.duration),state=excluded.state,
      watched_seconds=video_sessions.watched_seconds+?,furthest_position=MAX(video_sessions.furthest_position,?)`)
      .run(sample.session_id,visitor,userId,sample.episode_id,now,now,sample.position,sample.duration,sample.state,watched,watched>0?sample.position:0);
    if(watched>0 && previous) {
      const bin=db.prepare(`INSERT INTO video_retention VALUES(?,?,?) ON CONFLICT(session_id,bucket)
        DO UPDATE SET watched_seconds=video_retention.watched_seconds+excluded.watched_seconds`);
      for(let bucket=Math.floor(previous.position/30);bucket<=Math.floor(sample.position/30);bucket++) {
        const overlap=Math.max(0,Math.min(sample.position,(bucket+1)*30)-Math.max(previous.position,bucket*30));
        if(overlap) bin.run(sample.session_id,bucket,watched*overlap/advance);
      }
      const hourly=db.prepare(`INSERT INTO video_watch_hours VALUES(?,?,?) ON CONFLICT(session_id,hour)
        DO UPDATE SET watched_seconds=video_watch_hours.watched_seconds+excluded.watched_seconds`);
      for(let hour=Math.floor(previous.last_seen/3600000);hour<=Math.floor(now/3600000);hour++) {
        const overlap=Math.max(0,Math.min(now,(hour+1)*3600000)-Math.max(previous.last_seen,hour*3600000));
        if(overlap) hourly.run(sample.session_id,hour,watched*overlap/(elapsed*1000));
      }
    }
    return true;
  })();
}
const identity="CASE WHEN user_id IS NOT NULL THEN 'u:'||user_id ELSE 'g:'||visitor END";
export function liveCounts(now=Date.now()) {
  const db=analyticsDb();
  const active=db.prepare(`SELECT COUNT(DISTINCT identity) count FROM (
    SELECT ${identity} identity FROM site_presence WHERE last_seen>=?
    UNION SELECT ${identity} identity FROM video_sessions WHERE last_seen>=? AND state='playing')`).get(now-45000,now-45000) as {count:number};
  const playing=db.prepare(`SELECT COUNT(DISTINCT ${identity}) count FROM video_sessions WHERE last_seen>=? AND state='playing'`).get(now-45000) as {count:number};
  return {activeUsers:active.count,watchingUsers:playing.count};
}
export function videoAnalytics(days:number,episodeId?:number) {
  const db=analyticsDb(),now=Date.now(),since=now-days*86400000;
  const filter=episodeId ? 'AND v.episode_id=@episode' : '';
  const params={since,episode:episodeId||0};
  const episodes=db.prepare(`SELECT e.id,e.title,e.episode_number,s.season_number,a.title anime_title,
    COUNT(*) plays,COUNT(DISTINCT CASE WHEN v.user_id IS NOT NULL THEN 'u:'||v.user_id ELSE 'g:'||v.visitor END) viewers,
    ROUND(SUM(v.watched_seconds)) watch_seconds,ROUND(AVG(v.watched_seconds)) average_seconds,
    ROUND(AVG(CASE WHEN v.duration>0 THEN MIN(100,v.furthest_position/v.duration*100) ELSE 0 END),1) average_progress,
    SUM(CASE WHEN v.duration>0 AND v.furthest_position>=v.duration*0.95 THEN 1 ELSE 0 END) reached_end
    FROM video_sessions v JOIN episodes e ON e.id=v.episode_id JOIN seasons s ON s.id=e.season_id JOIN anime a ON a.id=e.anime_id
    WHERE v.started_at>=@since AND v.watched_seconds>0 ${filter} GROUP BY e.id ORDER BY watch_seconds DESC LIMIT 200`).all(params);
  const hourly=db.prepare(`SELECT h.hour,SUM(h.watched_seconds) watch_seconds,COUNT(DISTINCT v.visitor) viewers
    FROM video_watch_hours h JOIN video_sessions v ON v.id=h.session_id
    WHERE h.hour*3600000>=@since ${filter} GROUP BY h.hour ORDER BY h.hour`).all(params);
  const sessions=db.prepare(`SELECT v.id,u.username,e.title,e.episode_number,a.title anime_title,v.started_at,v.last_seen,
    ROUND(v.position) position,ROUND(v.duration) duration,ROUND(v.watched_seconds) watch_seconds,v.state
    FROM video_sessions v JOIN episodes e ON e.id=v.episode_id JOIN anime a ON a.id=e.anime_id LEFT JOIN users u ON u.id=v.user_id
    WHERE v.started_at>=@since AND v.watched_seconds>0 ${filter} ORDER BY v.last_seen DESC LIMIT 100`).all(params);
  const retention=episodeId ? db.prepare(`SELECT r.bucket*30 second,COUNT(DISTINCT v.visitor) viewers,ROUND(SUM(r.watched_seconds)) watch_seconds
    FROM video_retention r JOIN video_sessions v ON v.id=r.session_id WHERE v.episode_id=@episode AND v.started_at>=@since
    GROUP BY r.bucket ORDER BY r.bucket`).all(params) : [];
  return {...liveCounts(now),episodes,hourly,sessions,retention,generatedAt:now,days};
}
