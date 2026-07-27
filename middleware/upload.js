// middleware/upload.js
// Multer config for the CSV import upload. Keeps the file in memory
// (not written to disk) since we only ever parse it once and discard
// it -- simplest and fastest for files in the tens-of-MB range this
// feature targets (10,000 rows is roughly 500KB-1MB of CSV text).
const multer = require('multer');

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB, comfortably covers 10k+ rows

const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  const isCsv =
    file.mimetype === 'text/csv' ||
    file.mimetype === 'application/vnd.ms-excel' ||
    file.originalname.toLowerCase().endsWith('.csv');

  if (!isCsv) {
    return cb(new Error('Only .csv files are accepted.'));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES }
});

module.exports = upload;
