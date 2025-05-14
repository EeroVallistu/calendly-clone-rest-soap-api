const db = require('./db');

// Insert example users
db.serialize(() => {
  // Clear existing data
  db.run('DELETE FROM users');
  db.run('DELETE FROM events');
  db.run('DELETE FROM schedules');
  db.run('DELETE FROM appointments');

  // Insert users
  const users = [
    { id: '1', name: 'John Doe', email: 'john@example.com', password: 'password123', timezone: 'UTC' },
    { id: '2', name: 'Jane Smith', email: 'jane@example.com', password: 'password456', timezone: 'EST' }
  ];

  const insertUser = db.prepare('INSERT INTO users (id, name, email, password, timezone) VALUES (?, ?, ?, ?, ?)');
  users.forEach(user => {
    insertUser.run(user.id, user.name, user.email, user.password, user.timezone);
  });
  insertUser.finalize();

  // Insert events
  const events = [
    { id: '101', name: 'Team Meeting', duration: 30, description: 'Daily standup', color: '#FF0000', userId: '1' },
    { id: '102', name: 'Client Call', duration: 60, description: 'Monthly review', color: '#00FF00', userId: '2' }
  ];

  const insertEvent = db.prepare('INSERT INTO events (id, name, duration, description, color, userId) VALUES (?, ?, ?, ?, ?, ?)');
  events.forEach(event => {
    insertEvent.run(event.id, event.name, event.duration, event.description, event.color, event.userId);
  });
  insertEvent.finalize();

  // Insert schedules
  const schedules = [
    { userId: '1', availability: JSON.stringify([{ day: 'monday', startTime: '09:00', endTime: '17:00' }]) }
  ];

  const insertSchedule = db.prepare('INSERT INTO schedules (userId, availability) VALUES (?, ?)');
  schedules.forEach(schedule => {
    insertSchedule.run(schedule.userId, schedule.availability);
  });
  insertSchedule.finalize();

  // Create appointments table with status field
  db.run(`CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    eventId TEXT NOT NULL,
    userId TEXT NOT NULL,
    inviteeEmail TEXT NOT NULL,
    startTime TEXT NOT NULL,
    endTime TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled',
    FOREIGN KEY (eventId) REFERENCES events(id),
    FOREIGN KEY (userId) REFERENCES users(id)
  )`);

  // Add token column to users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    timezone TEXT,
    token TEXT  -- Token is optional
  )`);

  console.log('Database seeded successfully!');
});

db.close(); 