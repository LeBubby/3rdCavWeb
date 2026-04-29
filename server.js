const express = require('express');
const path = require('path');
const session = require('express-session');
const SQLiteStoreFactory = require('connect-sqlite3');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const app = express();
const SQLiteStore = SQLiteStoreFactory(session);
const PORT = process.env.PORT || 3000;
const db = new Database(path.join(__dirname, 'data', 'site.db'));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: path.join(__dirname, 'data') }),
  secret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Member',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      author_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (author_id) REFERENCES users(id)
    );
  `);

  const admin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!admin) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run('admin', hash, 'Administrator');
  }

  const postCount = db.prepare('SELECT COUNT(*) as count FROM posts').get().count;
  if (postCount === 0) {
    const adminUser = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
    const insertPost = db.prepare('INSERT INTO posts (title, body, author_id) VALUES (?, ?, ?)');
    insertPost.run('Regimental Notice', 'Welcome to the 3rd Cavalry Regiment forum. Use this board for announcements, after action reports, and public unit updates.', adminUser.id);
    insertPost.run('Recruitment Status', '1st Squadron remains the primary open assignment block. Additional units may open as the ORBAT changes.', adminUser.id);
  }
}

initDb();

app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.currentPath = req.path;
  next();
});

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

function pageData(overrides = {}) {
  return {
    siteName: '3rd Cavalry Regiment',
    motto: 'Blood and Steel!',
    discord: 'https://discord.gg/B3qXb2SXrW',
    ...overrides
  };
}

app.get('/', (req, res) => {
  res.render('index', pageData());
});

app.get('/about', (req, res) => {
  res.render('about', pageData());
});

app.get('/roster', (req, res) => {
  const roster = [
    { title: 'Apache Troop', subtitle: '1st Squadron • Open', image: '/public/assets/guidon-a.jpg', text: 'Infantry troop and one of the clearest entry points for new recruits.' },
    { title: 'Bandit Troop', subtitle: '1st Squadron • Closed', image: '/public/assets/guidon-b.jpg', text: 'Closed at present due to balancing and assignment distribution.' },
    { title: 'Crazy Horse Troop', subtitle: '1st Squadron • Closed', image: '/public/assets/guidon-c.jpg', text: 'Included as part of the regiment’s troop identity and public ORBAT presentation.' }
  ];
  res.render('roster', pageData({ roster }));
});

app.get('/mos', (req, res) => {
  const mosBlocks = [
    { title: '1st Squadron, 3rd Cavalry Regiment (CN - Tiger)', status: 'Open', items: ['HHT (Roughrider)', 'A Troop (Apache Troop) — Infantry Troop', 'B Troop (Bandit Troop) — Infantry Troop (Closed)', 'C Troop (Crazy Horse Troop) — Infantry Troop (Closed)', 'D Troop (Dragon Troop) — Squadron Support Troop (Closed)'] },
    { title: '2nd Squadron, 3rd Cavalry Regiment (CN - Saber)', status: 'Closed', items: ['HHT (Rattler)', 'F Troop (Fox Troop) — Infantry Troop', 'E Troop (Eagle Troop) — Infantry Troop', 'G Troop (Grim Troop) — Infantry Troop', 'H Troop (Heavy Troop) — Squadron Support Troop'] },
    { title: '3rd Squadron, 3rd Cavalry Regiment (CN - Thunder)', status: 'Closed', items: ['HHT (Havoc Hounds)', 'I Troop (Ironhawk Troop) — Infantry Troop', 'K Troop (Killer Troop) — Infantry Troop', 'L Troop (Lightning Troop) — Infantry Troop', 'M Troop (Maddog Troop) — Squadron Support Troop'] },
    { title: '4th Squadron, 3rd Cavalry Regiment (CN - Longknife)', status: 'Closed', items: ['HHT (Headhunters)', 'N Troop (Nomad Troop) — Reconnaissance Troop', 'O Troop (Outlaw Troop) — Reconnaissance Troop', 'P Troop (Predator Troop) — Reconnaissance Troop, JTAC Authorized', 'Q Troop (Quicksilver Troop) — Heavy weapons troop with MGS and ATGM Stryker variants', 'R Troop (Renegade Troop) — Squadron Support Troop'] },
    { title: 'Field Artillery Squadron, 3rd Cavalry Regiment (CN - Steel)', status: 'Closed', items: ['HHB (Brimstone)', 'A Battery (King) — M777 & Mortars', 'B Battery (Lion) — M777 & Mortars', 'C Battery (Regulator) — M777', 'Service Battery (Caisson) — Squadron Support Battery'] },
    { title: 'Support Squadron, 3rd Cavalry Regiment (CN - Muleskinner)', status: 'Closed', items: ['HHT (Bullwhip)', 'Supply and Transportation Troop (Packhorse)', 'Maintenance Troop (Blacksmith)', 'Medical Troop (Scalpel)'] }
  ];
  res.render('mos', pageData({ mosBlocks }));
});

app.get('/medals', (req, res) => {
  const medals = [
    { ribbon: 'r1', tier: 'Valor', title: 'Regimental Valor Ribbon', text: 'Awarded for exceptional courage or decisive action during high-pressure operations.' },
    { ribbon: 'r2', tier: 'Service', title: 'Campaign Service Ribbon', text: 'Granted for completing a full campaign rotation with steady attendance.' },
    { ribbon: 'r3', tier: 'Merit', title: 'Combat Achievement Ribbon', text: 'Recognizes repeated tactical performance and reliability in operations.' },
    { ribbon: 'r4', tier: 'Leadership', title: 'Troop Leadership Ribbon', text: 'For leaders who improve readiness, discipline, and mission execution.' },
    { ribbon: 'r5', tier: 'Training', title: 'Readiness Ribbon', text: 'Issued for qualification excellence, doctrine knowledge, or training mastery.' },
    { ribbon: 'r6', tier: 'Campaign', title: 'Expeditionary Cavalry Ribbon', text: 'Used for long-running theater participation and sustained commitment.' }
  ];
  res.render('medals', pageData({ medals }));
});

app.get('/forum', (req, res) => {
  const posts = db.prepare(`
    SELECT posts.id, posts.title, posts.body, posts.created_at, users.username, users.role
    FROM posts
    JOIN users ON users.id = posts.author_id
    ORDER BY posts.id DESC
  `).all();
  res.render('forum', pageData({ posts }));
});

app.get('/login', (req, res) => {
  res.render('login', pageData({ error: null }));
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).render('login', pageData({ error: 'Invalid username or password.' }));
  }
  req.session.user = { id: user.id, username: user.username, role: user.role };
  res.redirect('/forum');
});

app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password || password.length < 6) {
    return res.status(400).render('login', pageData({ error: 'Use a username and a password at least 6 characters long.' }));
  }
  try {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(username.trim(), hash, 'Member');
    res.redirect('/login');
  } catch (error) {
    res.status(400).render('login', pageData({ error: 'That username is already taken.' }));
  }
});

app.post('/posts', requireAuth, (req, res) => {
  const { title, body } = req.body;
  if (!title || !body) {
    return res.redirect('/forum');
  }
  db.prepare('INSERT INTO posts (title, body, author_id) VALUES (?, ?, ?)').run(title.trim(), body.trim(), req.session.user.id);
  res.redirect('/forum');
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

app.listen(PORT, () => {
  console.log(`3rd Cavalry Regiment app running on http://localhost:${PORT}`);
  console.log('Default admin login: admin / admin123');
});
