const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./database.sqlite");

function initDB() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS config (
        id INTEGER PRIMARY KEY CHECK (id = 1),

        running INTEGER DEFAULT 0,

        burn_amount REAL DEFAULT 0.01,
        stake_amount REAL DEFAULT 0.01,

        burn_count INTEGER DEFAULT 1,
        stake_count INTEGER DEFAULT 1,
        crate_count INTEGER DEFAULT 1,

        min_delay_minutes INTEGER DEFAULT 1445,
        max_delay_minutes INTEGER DEFAULT 1470,

        next_run INTEGER DEFAULT 0
      )
    `);

    db.get("SELECT * FROM config WHERE id = 1", (err, row) => {
      if (err) {
        console.error(err);
        return;
      }

      if (!row) {
        db.run(`
          INSERT INTO config (
            id,
            running,
            burn_amount,
            stake_amount,
            burn_count,
            stake_count,
            crate_count,
            min_delay_minutes,
            max_delay_minutes,
            next_run
          )
          VALUES (
            1,
            0,
            0.01,
            0.01,
            1,
            1,
            1,
            1445,
            1470,
            0
          )
        `);
      }
    });
  });
}

function getConfig() {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM config WHERE id = 1", (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function updateConfig(fields) {
  return new Promise((resolve, reject) => {
    const keys = Object.keys(fields);

    if (!keys.length) {
      resolve();
      return;
    }

    const setClause = keys.map((k) => `${k} = ?`).join(", ");
    const values = keys.map((k) => fields[k]);

    db.run(
      `UPDATE config SET ${setClause} WHERE id = 1`,
      values,
      function (err) {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

function closeDB() {
  db.close();
}

module.exports = {
  initDB,
  getConfig,
  updateConfig,
  closeDB
};
