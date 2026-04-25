import * as SQLite from 'expo-sqlite';

let db = null;

export const initDB = async () => {
  try {
    db = await SQLite.openDatabaseAsync('savex.db');
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS download_history (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        platform TEXT NOT NULL,
        format TEXT,
        filesize_mb REAL,
        filepath TEXT,
        thumbnail TEXT,
        duration INTEGER,
        downloaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        file_exists INTEGER DEFAULT 1
      );
    `);
    console.log('Database initialized');
  } catch (error) {
    console.error('Failed to initialize database', error);
  }
};

export const saveDownload = async (data) => {
  if (!db) await initDB();
  try {
    await db.runAsync(
      `INSERT INTO download_history (id, title, url, platform, format, filesize_mb, filepath, thumbnail, duration, downloaded_at, file_exists)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.id,
        data.title,
        data.url,
        data.platform,
        data.format || null,
        data.filesize_mb || 0,
        data.filepath,
        data.thumbnail || null,
        data.duration || 0,
        new Date().toISOString(),
        1
      ]
    );
  } catch (error) {
    console.error('Failed to save download', error);
  }
};

export const getHistory = async () => {
  if (!db) await initDB();
  try {
    const result = await db.getAllAsync('SELECT * FROM download_history ORDER BY downloaded_at DESC');
    return result;
  } catch (error) {
    console.error('Failed to fetch history', error);
    return [];
  }
};

export const clearHistory = async () => {
  if (!db) await initDB();
  try {
    await db.runAsync('DELETE FROM download_history');
  } catch (error) {
    console.error('Failed to clear history', error);
  }
};

export const deleteHistoryItem = async (id) => {
  if (!db) await initDB();
  try {
    await db.runAsync('DELETE FROM download_history WHERE id = ?', [id]);
  } catch (error) {
    console.error('Failed to delete item', error);
  }
};

export const updateFileExists = async (id, exists) => {
  if (!db) await initDB();
  try {
    await db.runAsync('UPDATE download_history SET file_exists = ? WHERE id = ?', [exists ? 1 : 0, id]);
  } catch (error) {
    console.error('Failed to update file exists', error);
  }
};
