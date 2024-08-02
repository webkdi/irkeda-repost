const mysql = require("mysql2");
require("dotenv").config();

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_DATICO_USER,
    password: process.env.DB_DATICO_PASSWORD,
    database: process.env.DB_DATICO_DB,
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 10,
    idleTimeout: 60000,
    queueLimit: 0,
}).promise();

async function insertIgnore(update_id) {
    const sql = `
      INSERT IGNORE INTO datico.serv_telegram_irkeda (update_id)
      VALUES (${update_id})
    `;
    // 27525383
    try {
        const [res] = await db.query(sql);
        return res.affectedRows;
    } catch (err) {
        console.log(update_id, "error in INSERT IGNORE INTO datico.serv_telegram_irkeda");
        return 0;
    }
}

async function deleteUpdateId(update_id) {
    const sql = `
      DELETE FROM datico.serv_telegram_irkeda WHERE update_id = ?
    `;
    try {
        const [res] = await db.query(sql, [update_id]);
        return res.affectedRows;
    } catch (err) {
        console.log(update_id, "error in DELETE FROM datico.serv_telegram_irkeda", err);
        return 0;
    }
}

module.exports = {
    insertIgnore,
    deleteUpdateId,
};
