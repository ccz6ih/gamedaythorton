/**
 * serve-restart.cjs
 * Stops whatever is on port 3000, then starts a fresh production server.
 *
 * WHY THIS EXISTS
 * `pkill -f "next start"` does not reliably kill the server on Windows — it
 * matches the npm wrapper rather than the node process actually holding the
 * port. The old server keeps serving the old build, and the symptom is not
 * "server failed to start", it is a passing-looking app quietly serving stale
 * code. It cost three separate debugging round trips in one session: a
 * middleware change that looked ignored, routes that 404'd after they were
 * built, and a gate that appeared not to open.
 *
 * So: find the listener by port, kill it by PID, then start.
 *
 *   node scripts/serve-restart.cjs          # build already done
 *   node scripts/serve-restart.cjs --build  # build first
 */

const { execSync, spawn } = require('child_process');

const PORT = Number(process.env.PORT || 3000);

function pidsOnPort(port) {
  try {
    if (process.platform === 'win32') {
      const out = execSync(`netstat -ano -p tcp | findstr LISTENING | findstr :${port}`, {
        encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']
      });
      return [...new Set(
        out.split('\n')
          .map(l => l.trim().split(/\s+/).pop())
          .filter(p => p && /^\d+$/.test(p) && p !== '0')
      )];
    }
    const out = execSync(`lsof -ti tcp:${port}`, {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']
    });
    return out.split('\n').map(s => s.trim()).filter(Boolean);
  } catch {
    return [];                         // nothing listening
  }
}

function kill(pid) {
  try {
    execSync(process.platform === 'win32' ? `taskkill /PID ${pid} /F /T` : `kill -9 ${pid}`,
      { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const before = pidsOnPort(PORT);
if (before.length) {
  console.log(`  port ${PORT} held by pid ${before.join(', ')} — stopping`);
  before.forEach(kill);
  // Give the socket a moment to actually release before rebinding.
  execSync(process.platform === 'win32' ? 'ping -n 3 127.0.0.1 > NUL' : 'sleep 2', { stdio: 'ignore' });
}

const after = pidsOnPort(PORT);
if (after.length) {
  console.error(`\n  Port ${PORT} is STILL held by pid ${after.join(', ')}.`);
  console.error('  Refusing to start — a second server would serve an unpredictable build.\n');
  process.exit(1);
}
console.log(`  port ${PORT} free`);

if (process.argv.includes('--build')) {
  console.log('  building...');
  execSync('npm run build', { stdio: 'inherit' });
}

console.log(`  starting on ${PORT}\n`);
spawn('npm', ['start'], { stdio: 'inherit', shell: true });
